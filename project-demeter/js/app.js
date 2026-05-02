// Project Demeter — Application Controller
// Holds APP state, mediates render, routes mutations through setState/setUI.
// Survey-record marshalling and disk I/O lives in storage.js.

import {
  getDeviceId,
  createSurvey,
  loadSurvey,
  listSurveys,
  saveSurvey,
  archiveSurvey,
  deleteSurvey
} from './storage.js';
import { initMap, renderMap, getMeasuredVPDLabel } from './map.js';
import { initChecklist, renderChecklist } from './checklist-view.js';
import { c9Failed } from './checklist.js';
import {
  initReport,
  renderReport,
  computeViabilityLabel
} from './report.js';

// ---- State ----------------------------------------------------------------

const APP = {
  // UI-only state (not persisted)
  view: 'list',           // 'list' | 'editor'
  activeTab: 'survey',
  listSection: 'active',  // 'active' | 'complete' | 'archived'
  listItems: [],
  saveStatus: 'idle',     // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  // Lifecycle lock for the editor. True when the open survey is 'complete'
  // or 'archived' — soft-locks the form/map/checklist until the tech taps
  // Unlock. Resets on each survey open. Not persisted.
  editLocked: false,

  // SurveyRecord-derived state (persisted)
  surveyId: null,
  status: 'active',       // 'active' | 'complete' | 'archived'
  createdAt: null,
  updatedAt: null,
  reportGeneratedAt: null,
  lastEditedDevice: null,
  version: 2,

  unitF: true,
  stage: 0,
  lights: 'on',           // 'on' | 'off' | 'transition'

  customer: '',
  facility: '',
  room: '',
  equipmentModel: '',
  equipmentSerial: '',
  equipmentNotes: '',
  tech: '',
  date: '',
  narrative: '',

  mapMode: 'single',
  roomLen: null,
  roomWid: null,
  activeTool: 'select',
  // Sub-mode for the equipment tool: which S/R variant a tap will drop.
  // UI-only (not persisted); placed modules carry .type independently.
  equipmentPlacementType: 'supply',
  nudgeStep: 0.5,
  selectedId: null,
  selectedType: null,
  airflowConfidence: 'UNKNOWN',
  coverageNotes: '',

  sensors: [],
  zones: [],
  equipmentModules: [],
  ducts: [],
  registers: [],

  tierCount: 2,
  lighting: 'led',
  tierSensors: {},

  checklistState: {},

  reportSnapshot: null
};

// Fields that map into SurveyRecord. Used to decide whether a setState
// patch should schedule an auto-save.
const PERSISTED_FIELDS = new Set([
  'unitF', 'stage', 'lights',
  'customer', 'facility', 'room',
  'equipmentModel', 'equipmentSerial', 'equipmentNotes',
  'tech', 'date', 'narrative',
  'mapMode', 'roomLen', 'roomWid', 'airflowConfidence', 'coverageNotes',
  'sensors', 'zones', 'equipmentModules', 'ducts', 'registers',
  'tierCount', 'lighting', 'tierSensors',
  'checklistState',
  'reportSnapshot', 'reportGeneratedAt',
  'status'
]);

// Subset of PERSISTED_FIELDS that the lifecycle lock allows to mutate even
// when the survey is read-only. Lifecycle bookkeeping (status flip, snapshot
// freeze on re-print) should still flow through; tech-entered survey data
// must not.
const LOCK_BYPASS_FIELDS = new Set([
  'status', 'reportSnapshot', 'reportGeneratedAt'
]);

// ---- Marshal APP <-> SurveyRecord -----------------------------------------

function appIntoRecord(rec) {
  rec.status = APP.status;
  rec.metadata = {
    customer: APP.customer,
    facility: APP.facility,
    room: APP.room,
    equipmentModel: APP.equipmentModel,
    equipmentSerial: APP.equipmentSerial,
    equipmentNotes: APP.equipmentNotes,
    tech: APP.tech,
    date: APP.date,
    narrative: APP.narrative,
    stage: APP.stage,
    lights: APP.lights,
    unitF: APP.unitF
  };
  rec.mapData = {
    roomLen: APP.roomLen,
    roomWid: APP.roomWid,
    mapMode: APP.mapMode,
    airflowConfidence: APP.airflowConfidence,
    coverageNotes: APP.coverageNotes,
    sensors: APP.sensors,
    zones: APP.zones,
    equipmentModules: APP.equipmentModules,
    ducts: APP.ducts,
    registers: APP.registers,
    tierCount: APP.tierCount,
    lighting: APP.lighting,
    tierSensors: APP.tierSensors
  };
  rec.checklistState = APP.checklistState;
  rec.reportSnapshot = APP.reportSnapshot;
  rec.reportGeneratedAt = APP.reportGeneratedAt;
  return rec;
}

function recordToPatch(rec) {
  const m = rec.metadata || {};
  const d = rec.mapData  || {};
  return {
    surveyId:          rec.id,
    status:            rec.status || 'active',
    createdAt:         rec.createdAt,
    updatedAt:         rec.updatedAt,
    reportGeneratedAt: rec.reportGeneratedAt,
    lastEditedDevice:  rec.lastEditedDevice,
    version:           rec.version,

    customer:        m.customer        ?? '',
    facility:        m.facility        ?? '',
    room:            m.room            ?? '',
    equipmentModel:  m.equipmentModel  ?? '',
    equipmentSerial: m.equipmentSerial ?? '',
    equipmentNotes:  m.equipmentNotes  ?? '',
    tech:            m.tech            ?? '',
    date:            m.date            ?? '',
    narrative:       m.narrative       ?? '',
    stage:           (typeof m.stage === 'number') ? m.stage : 0,
    lights:          m.lights          ?? 'on',
    unitF:           m.unitF !== false,

    roomLen:           d.roomLen           ?? null,
    roomWid:           d.roomWid           ?? null,
    mapMode:           d.mapMode           ?? 'single',
    airflowConfidence: d.airflowConfidence ?? 'UNKNOWN',
    coverageNotes:     d.coverageNotes     ?? '',
    sensors:           d.sensors           ?? [],
    zones:             d.zones             ?? [],
    equipmentModules:  d.equipmentModules  ?? [],
    ducts:             d.ducts             ?? [],
    registers:         d.registers         ?? [],
    tierCount:         d.tierCount         ?? 2,
    lighting:          d.lighting          ?? 'led',
    tierSensors:       d.tierSensors       ?? {},

    checklistState:    rec.checklistState  ?? {},
    reportSnapshot:    rec.reportSnapshot  ?? null
  };
}

// ---- Save scheduling ------------------------------------------------------

const SAVE_DEBOUNCE_MS = 800;
let _saveTimer  = null;
let _activeRec  = null;   // SurveyRecord currently mutated

function scheduleSave() {
  if (!APP.surveyId || !_activeRec) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  setUI({ saveStatus: 'pending' });
  _saveTimer = setTimeout(() => { flushSave(); }, SAVE_DEBOUNCE_MS);
}

async function flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (!APP.surveyId || !_activeRec) return;
  setUI({ saveStatus: 'saving' });
  try {
    appIntoRecord(_activeRec);
    await saveSurvey(_activeRec);
    setUI({
      updatedAt:        _activeRec.updatedAt,
      lastEditedDevice: _activeRec.lastEditedDevice,
      saveStatus:       'saved'
    });
  } catch (err) {
    console.error('Save failed:', err);
    setUI({ saveStatus: 'error' });
  }
}

window.addEventListener('beforeunload', () => {
  // Best-effort: kick the pending save synchronously. IDB write is async,
  // but the operation is enqueued before the page tears down.
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    flushSave();
  }
});

// ---- State mutators -------------------------------------------------------

function patchTouchesPersisted(patch) {
  for (const k of Object.keys(patch)) {
    if (PERSISTED_FIELDS.has(k)) return true;
  }
  return false;
}

// All survey-data mutations route through here. Triggers debounced save.
// When the open survey is editLocked (complete/archived, not yet unlocked),
// persisted-field writes are dropped so a stray UI event can't quietly
// mutate a delivered survey. Lifecycle bookkeeping (status, snapshot)
// flows through regardless.
function setState(patch) {
  if (APP.editLocked) {
    let dropped = false;
    for (const k of Object.keys(patch)) {
      if (PERSISTED_FIELDS.has(k) && !LOCK_BYPASS_FIELDS.has(k)) {
        delete patch[k];
        dropped = true;
      }
    }
    if (dropped && !Object.keys(patch).length) return;
  }
  Object.assign(APP, patch);
  render();
  if (patchTouchesPersisted(patch)) scheduleSave();
}

// UI-only mutations (view, tabs, list section, save status). No save.
function setUI(patch) {
  Object.assign(APP, patch);
  render();
}

// Replace APP fields from a freshly loaded record. Bypasses save trigger
// (we just read this from disk; echoing it back would only churn updatedAt).
function hydrateFromRecord(rec) {
  _activeRec = rec;
  const patch = recordToPatch(rec);
  patch.saveStatus = 'idle';
  patch.editLocked = (patch.status !== 'active');
  setUI(patch);
}

function clearActiveSurvey() {
  _activeRec = null;
  setUI({
    surveyId:          null,
    status:            'active',
    createdAt:         null,
    updatedAt:         null,
    reportGeneratedAt: null,
    lastEditedDevice:  null,
    saveStatus:        'idle',
    editLocked:        false
  });
}

// Generate-report handoff. Stores the frozen snapshot on APP and the
// active record, then forces a flush so the snapshot is on disk before
// the technician moves on. Persistence is via PERSISTED_FIELDS, so the
// patch goes through the normal save scheduler — flushSave() collapses
// any in-flight debounce.
//
// First-time generation flips status 'active' → 'complete' per spec
// lifecycle (Edit → Generate Report → Freeze Snapshot → Complete) and
// soft-locks the editor. Re-generating from an already-complete survey
// just refreshes the snapshot — status stays 'complete'.
function commitReportSnapshot(snapshot) {
  if (!snapshot) return;
  const patch = {
    reportSnapshot:    snapshot,
    reportGeneratedAt: snapshot.generatedAt
  };
  // First-time generation flips status and re-locks in a single render —
  // setting editLocked here piggybacks on the same setState pass so the
  // Generate button doesn't visibly toggle to enabled-then-disabled.
  // Re-generating an already-complete (and possibly unlocked) survey just
  // refreshes the snapshot — status and lock state are left as-is.
  if (APP.status === 'active') {
    patch.status = 'complete';
    patch.editLocked = true;
  }
  setState(patch);
  flushSave().catch((err) => console.error('Snapshot save failed:', err));
}

// ---- Survey lifecycle actions --------------------------------------------

async function actionNewSurvey() {
  await flushSave();
  const rec = await createSurvey();
  hydrateFromRecord(rec);
  setUI({ view: 'editor', activeTab: 'survey' });
}

async function actionResume(id) {
  const rec = await loadSurvey(id);
  if (!rec) return;

  // Archived surveys require explicit confirmation per spec — they are
  // locked after client delivery to prevent accidental post-delivery edits.
  // Opening still lands in read-only; unlock is a separate confirmation.
  if (rec.status === 'archived') {
    const ok = confirm(
      'This survey is archived. Open it for viewing?\n\n' +
      'It will open in read-only mode. You can tap Unlock to make changes.'
    );
    if (!ok) return;
  }

  // Device-collision warning: another device edited recently.
  const myDevice = getDeviceId();
  if (rec.lastEditedDevice && rec.lastEditedDevice !== myDevice) {
    const updated = new Date(rec.updatedAt).getTime();
    const recent  = (Date.now() - updated) < 60 * 60 * 1000;
    if (recent) {
      const when = new Date(rec.updatedAt).toLocaleString();
      const ok = confirm(
        `This survey was last edited on a different device at ${when}. ` +
        `Continuing here may overwrite changes made there. Continue?`
      );
      if (!ok) return;
    }
  }

  await flushSave();
  hydrateFromRecord(rec);
  setUI({ view: 'editor', activeTab: 'survey' });
}

// Unlock a soft-locked (complete/archived) survey for editing. Status is
// not reverted — 'complete' marks delivery, not immutability. The tech can
// edit and re-generate the report; the snapshot refreshes in place.
async function actionUnlock() {
  if (!APP.editLocked) return;
  const label = (APP.status === 'archived')
    ? 'archived'
    : 'completed';
  const ok = confirm(
    `Unlock this ${label} survey for editing?\n\n` +
    `Edits will be saved over the existing record. ` +
    `The report snapshot stays until you regenerate it.`
  );
  if (!ok) return;
  setUI({ editLocked: false });
}

async function actionBackToList() {
  await flushSave();
  clearActiveSurvey();
  setUI({ view: 'list' });
  refreshList();
}

async function actionArchive(id) {
  const ok = confirm('Archive this survey? Archived surveys require confirmation to re-open.');
  if (!ok) return;
  await archiveSurvey(id);
  refreshList();
}

// Permanent delete — only offered on archived surveys, so an active or
// completed survey must be archived first. Two-step path makes accidental
// deletion of in-progress field work much harder.
async function actionDelete(id) {
  const ok = confirm('Permanently delete this archived survey? This cannot be undone.');
  if (!ok) return;
  await deleteSurvey(id);
  refreshList();
}

// ---- Theme toggle ---------------------------------------------------------
// Theme is a UI preference, not survey data — lives in localStorage,
// not in APP. The pre-paint script in index.html sets the initial
// data-theme on <html> before CSS applies. This module only handles
// the button label and click toggling.

const THEME_KEY = 'demeter_theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function syncThemeButtonLabel() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  // Label shows the destination state — clicking goes to that.
  btn.textContent = currentTheme() === 'dark' ? 'light' : 'dark';
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  syncThemeButtonLabel();
}

// Manual escape hatch when auto-update fails. Flushes pending edits, asks
// the SW to check for a new version, drops all caches, and reloads.
async function actionForceRefresh() {
  await flushSave();
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch (_) { /* ignore */ }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) { /* ignore */ }
  }
  location.reload();
}

async function refreshList() {
  const items = await listSurveys(APP.listSection);
  setUI({ listItems: items });
}

// ---- Rendering ------------------------------------------------------------

function render() {
  document.body.dataset.view = APP.view;

  const listEl   = document.getElementById('list-view');
  const editorEl = document.getElementById('editor-view');
  if (listEl)   listEl.hidden   = (APP.view !== 'list');
  if (editorEl) editorEl.hidden = (APP.view !== 'editor');

  if (APP.view === 'list') {
    renderList();
  } else {
    renderEditor();
  }
  renderHeader();
}

function renderHeader() {
  const vpd  = document.getElementById('vpd-readout');
  const via  = document.getElementById('viability-readout');
  const stateBadge = document.getElementById('state-badge');

  // C9 fail invalidates measured state per spec; VPD reads VOID even
  // when sensor readings exist. This is the only condition under which
  // one state overrides the other in the UI.
  const c9Bad = c9Failed(APP.checklistState);
  if (vpd) {
    vpd.textContent = c9Bad ? 'VOID' : getMeasuredVPDLabel(APP);
    vpd.dataset.status = c9Bad ? 'void' : 'live';
  }
  if (via) {
    via.textContent = computeViabilityLabel({ checklistState: APP.checklistState });
  }

  if (stateBadge) stateBadge.hidden = (APP.lights !== 'transition');
}

function renderList() {
  // Section tabs
  document.querySelectorAll('.list-tab').forEach((btn) => {
    const isActive = btn.dataset.section === APP.listSection;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  const ul = document.getElementById('survey-list');
  if (!ul) return;
  ul.innerHTML = '';

  if (!APP.listItems.length) {
    const li = document.createElement('li');
    li.className = 'survey-list__empty';
    li.textContent = emptyMessage(APP.listSection);
    ul.appendChild(li);
    return;
  }

  for (const rec of APP.listItems) {
    ul.appendChild(buildSurveyRow(rec));
  }
}

function emptyMessage(section) {
  switch (section) {
    case 'active':   return 'No active surveys. Tap + NEW SURVEY to begin.';
    case 'complete': return 'No completed surveys yet.';
    case 'archived': return 'No archived surveys.';
    default:         return 'No surveys.';
  }
}

function statusBadgeLabel(status) {
  switch (status) {
    case 'complete': return 'Complete';
    case 'archived': return 'Archived';
    case 'active':   return 'Active';
    default:         return String(status || 'Active');
  }
}

function buildSurveyRow(rec) {
  const li = document.createElement('li');
  li.className = 'survey-row';
  li.dataset.id = rec.id;
  li.dataset.status = rec.status || 'active';

  const m = rec.metadata || {};
  const headerParts = [m.customer, m.facility, m.room].filter(Boolean);
  const headerText  = headerParts.length ? headerParts.join(' · ') : 'Untitled survey';
  const dateText    = m.date || '—';
  const updatedText = formatRelative(rec.updatedAt);
  const statusText  = statusBadgeLabel(rec.status);

  const head = document.createElement('div');
  head.className = 'survey-row__head';
  head.innerHTML = `
    <div class="survey-row__title-line">
      <span class="survey-row__title"></span>
      <span class="survey-row__badge"></span>
    </div>
    <div class="survey-row__meta">
      <span class="survey-row__date"></span>
      <span class="survey-row__sep">·</span>
      <span class="survey-row__updated"></span>
    </div>
  `;
  head.querySelector('.survey-row__title').textContent   = headerText;
  head.querySelector('.survey-row__date').textContent    = dateText;
  head.querySelector('.survey-row__updated').textContent = updatedText;
  const badgeEl = head.querySelector('.survey-row__badge');
  badgeEl.textContent = statusText;
  badgeEl.dataset.status = rec.status || 'active';

  const actions = document.createElement('div');
  actions.className = 'survey-row__actions';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'btn btn--ghost';
  openBtn.textContent = (rec.status === 'active') ? 'Resume' : 'Open';
  openBtn.addEventListener('click', () => actionResume(rec.id));
  actions.appendChild(openBtn);

  // Spec lifecycle is active → complete → archived, so both editable and
  // delivered rows can move forward to archived from the list.
  if (rec.status === 'active' || rec.status === 'complete') {
    const archBtn = document.createElement('button');
    archBtn.type = 'button';
    archBtn.className = 'btn btn--ghost btn--quiet';
    archBtn.textContent = 'Archive';
    archBtn.addEventListener('click', () => actionArchive(rec.id));
    actions.appendChild(archBtn);
  }

  if (rec.status === 'archived') {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--ghost btn--quiet btn--danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => actionDelete(rec.id));
    actions.appendChild(delBtn);
  }

  li.appendChild(head);
  li.appendChild(actions);
  return li;
}

function formatRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const delta = Math.max(0, Date.now() - t);
  const sec = Math.floor(delta / 1000);
  if (sec < 60)    return `updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)    return `updated ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)     return `updated ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)     return `updated ${day}d ago`;
  return `updated ${new Date(iso).toLocaleDateString()}`;
}

function renderEditor() {
  // Tabs
  document.querySelectorAll('.tab-bar__tab').forEach((btn) => {
    const isActive = btn.dataset.tab === APP.activeTab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const isActive = panel.id === `tab-${APP.activeTab}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  // Editor nav label
  const label = document.getElementById('editor-label');
  if (label) {
    const parts = [APP.customer, APP.facility, APP.room].filter(Boolean);
    label.textContent = parts.length ? parts.join(' · ') : 'Untitled Survey';
  }

  renderSurveyTab();
  renderMap();
  renderChecklist();
  renderReport();
  renderSaveStatus();
  renderLockState();
}

// Lock banner sits between the editor nav strip and the tab bar. The
// is-readonly class on .tab-panels disables pointer interaction in the
// content area; the unlock button stays clickable because it lives outside
// .tab-panels. The setState gate is the actual write-block — this is the
// visible affordance.
function renderLockState() {
  const editorEl = document.getElementById('editor-view');
  const banner   = document.getElementById('lock-banner');
  const panels   = editorEl ? editorEl.querySelector('.tab-panels') : null;
  const genBtn   = document.getElementById('btn-generate-report');

  const locked = !!APP.editLocked;

  if (panels) panels.classList.toggle('is-readonly', locked);
  if (banner) {
    banner.hidden = !locked;
    if (locked) {
      const msg = banner.querySelector('.lock-banner__msg');
      if (msg) msg.textContent = (APP.status === 'archived')
        ? 'Archived survey — read-only.'
        : 'Completed survey — read-only.';
    }
  }
  // Generate Report writes the snapshot, so disable while locked. Copy
  // and Print are read-only on the snapshot and stay enabled.
  if (genBtn) genBtn.disabled = locked;
}

function renderSurveyTab() {
  const form = document.getElementById('survey-form');
  if (!form) return;

  // Text inputs / textareas — write current value if it differs.
  for (const el of form.querySelectorAll('[data-field]')) {
    const f = el.dataset.field;
    const v = APP[f] ?? '';
    if (el.value !== String(v)) el.value = v;
  }

  // Stage toggle group
  document.querySelectorAll('#stage-group .toggle').forEach((btn) => {
    const active = Number(btn.dataset.stage) === APP.stage;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });

  // Lights toggle group
  document.querySelectorAll('#lights-group .toggle').forEach((btn) => {
    const active = btn.dataset.lights === APP.lights;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });

  const lightsHint = document.getElementById('lights-hint');
  if (lightsHint) lightsHint.hidden = (APP.lights !== 'transition');
}

function renderSaveStatus() {
  const el = document.getElementById('save-status');
  if (!el) return;
  switch (APP.saveStatus) {
    case 'pending': el.textContent = 'Editing…';   el.dataset.status = 'pending'; break;
    case 'saving':  el.textContent = 'Saving…';    el.dataset.status = 'saving';  break;
    case 'saved':   el.textContent = 'Saved';      el.dataset.status = 'saved';   break;
    case 'error':   el.textContent = 'Save failed';el.dataset.status = 'error';   break;
    default:        el.textContent = '';           el.dataset.status = 'idle';
  }
}

// ---- Wiring ---------------------------------------------------------------

function wireListView() {
  document.getElementById('btn-new-survey').addEventListener('click', () => {
    actionNewSurvey().catch((err) => console.error(err));
  });

  const refreshBtn = document.getElementById('btn-refresh-app');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      actionForceRefresh().catch((err) => console.error(err));
    });
  }

  document.querySelectorAll('.list-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      setUI({ listSection: btn.dataset.section });
      refreshList();
    });
  });
}

function wireEditorView() {
  document.getElementById('btn-back-to-list').addEventListener('click', () => {
    actionBackToList().catch((err) => console.error(err));
  });

  const unlockBtn = document.getElementById('btn-unlock');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      actionUnlock().catch((err) => console.error(err));
    });
  }

  document.querySelectorAll('.tab-bar__tab').forEach((btn) => {
    btn.addEventListener('click', () => setUI({ activeTab: btn.dataset.tab }));
  });

  // Form: text inputs / textareas
  const form = document.getElementById('survey-form');
  for (const el of form.querySelectorAll('[data-field]')) {
    el.addEventListener('input', (e) => {
      setState({ [el.dataset.field]: e.target.value });
    });
  }

  // Stage toggles
  document.querySelectorAll('#stage-group .toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ stage: Number(btn.dataset.stage) });
    });
  });

  // Lights toggles
  document.querySelectorAll('#lights-group .toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ lights: btn.dataset.lights });
    });
  });
}

function init() {
  wireListView();
  wireEditorView();

  // Map module needs the same setState/setUI pipe so its mutations route
  // through the auto-save scheduler. getState returns the live APP object.
  initMap({
    getState: () => APP,
    setState,
    setUI
  });
  initChecklist({
    getState: () => APP,
    setState,
    setUI
  });
  initReport({
    getState: () => APP,
    setState,
    setUI,
    commitReportSnapshot
  });

  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  syncThemeButtonLabel();

  render();
  refreshList().catch((err) => console.error('List load failed:', err));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Debug surface
window.APP = APP;
window.setState = setState;
window.setUI    = setUI;
