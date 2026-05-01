// Project Demeter — Checklist tab renderer.
// Builds the per-item DOM once on init (32 + 1 items × 7 groups) and
// then reconciles dynamic state on each render: status pill is-active,
// evidence basis selector value, field-note textarea value, group
// counts, conditional hint visibility (Group B equipment-module hint,
// C9 missing-field-note warning).
//
// Item content (name / failure mode / method / AGIQ ref) is static;
// only state-derived values change between renders. This avoids
// destroying DOM nodes mid-keystroke and preserves textarea focus,
// caret position, and selection across setState() round-trips.
//
// All mutations route through api.setState({ checklistState: ... }) per
// the project's state discipline. No direct mutation of APP.

import {
  CHECKLIST_GROUPS,
  CHECKLIST_HEADER_NOTE,
  EVIDENCE_BASIS_OPTIONS,
  C9_DETAIL,
  defaultItemState,
  getItemState,
  groupCounts,
  requiresEquipmentModule
} from './checklist.js';

let _api  = null;
let _root = null;             // <div id="cl-groups">
let _refs = null;             // { groups: {...}, items: {...} } element refs
let _built = false;

export function initChecklist(api) {
  _api = api;
  _root = document.getElementById('cl-groups');
  if (!_root) return;
  _buildOnce();
  _wireDelegation();
}

// Idempotent. Called every render() in app.js. Reads current state and
// reconciles dynamic node properties only.
export function renderChecklist() {
  if (!_root || !_built) return;
  const state = _api.getState();
  _syncGroups(state);
  _syncItems(state);
}

// ── Build (one-time) ──────────────────────────────────────────────────

function _buildOnce() {
  if (_built) return;
  _refs = { groups: Object.create(null), items: Object.create(null) };

  // Header note
  const note = document.createElement('p');
  note.className = 'cl-tab__note';
  note.textContent = CHECKLIST_HEADER_NOTE;
  _root.appendChild(note);

  for (const g of CHECKLIST_GROUPS) {
    _root.appendChild(_buildGroup(g));
  }

  _built = true;
}

function _buildGroup(g) {
  const det = document.createElement('details');
  det.className = 'cl-group';
  det.dataset.clGroup = g.key;
  // Per spec: collapsed by default. Native <details> default is closed,
  // so no `open` attribute set here.

  const sum = document.createElement('summary');
  sum.className = 'cl-group__head';

  const title = document.createElement('span');
  title.className = 'cl-group__title';
  title.textContent = g.title;
  sum.appendChild(title);

  const counts = document.createElement('span');
  counts.className = 'cl-group__counts';
  counts.dataset.clCounts = g.key;
  sum.appendChild(counts);

  det.appendChild(sum);

  const body = document.createElement('div');
  body.className = 'cl-group__body';

  for (const it of g.items) {
    body.appendChild(_buildItem(it));
  }

  det.appendChild(body);

  _refs.groups[g.key] = { details: det, counts };
  return det;
}

function _buildItem(it) {
  const row = document.createElement('div');
  row.className = 'cl-item';
  row.dataset.clId = it.id;
  if (it.c9) row.classList.add('cl-item--c9');

  // Header: name + priority badge
  const head = document.createElement('div');
  head.className = 'cl-item__header';

  const name = document.createElement('div');
  name.className = 'cl-item__name';
  name.textContent = `${it.id}. ${it.name}`;
  head.appendChild(name);

  const pri = document.createElement('span');
  pri.className = `cl-priority cl-priority--${it.priority.toLowerCase()}`;
  pri.textContent = it.priority;
  head.appendChild(pri);

  row.appendChild(head);

  // Standard item body: failure mode / method / AGIQ ref.
  // C9 gets the extended detail block in place of the short body.
  if (it.c9) {
    row.appendChild(_buildC9Detail());
  } else {
    if (it.fail) {
      const failEl = document.createElement('div');
      failEl.className = 'cl-item__fail';
      failEl.textContent = it.fail;
      row.appendChild(failEl);
    }
    if (it.method) {
      const methodEl = document.createElement('div');
      methodEl.className = 'cl-item__method';
      methodEl.innerHTML =
        '<span class="cl-item__label">Method:</span> ' + _esc(it.method);
      row.appendChild(methodEl);
    }
    if (it.agiq) {
      const agiqEl = document.createElement('div');
      agiqEl.className = 'cl-item__agiq';
      agiqEl.textContent = `◆ ${it.agiq}`;
      row.appendChild(agiqEl);
    }
  }

  // Conditional hints
  let equipHint = null;
  if (requiresEquipmentModule(it.id)) {
    equipHint = document.createElement('div');
    equipHint.className = 'cl-item__hint cl-item__hint--equipment';
    equipHint.textContent =
      'No equipment module recorded for this item. Add modules in the Map tab.';
    equipHint.hidden = true;
    row.appendChild(equipHint);
  }

  let c9Hint = null;
  if (it.c9) {
    c9Hint = document.createElement('div');
    c9Hint.className = 'cl-item__hint cl-item__hint--c9';
    c9Hint.textContent =
      'AGIQ Ch.9 requires a field note on C9 fail: ' +
      C9_DETAIL.fieldNoteOnFail;
    c9Hint.hidden = true;
    row.appendChild(c9Hint);
  }

  // Controls: status pills + evidence basis selector
  const controls = document.createElement('div');
  controls.className = 'cl-item__controls';

  const statusGroup = document.createElement('div');
  statusGroup.className = 'cl-item__status';
  statusGroup.setAttribute('role', 'radiogroup');
  statusGroup.setAttribute('aria-label', 'Item status');

  const statusBtns = {};
  for (const s of [
    { v: 'pass', label: 'Pass' },
    { v: 'fail', label: 'Fail' },
    { v: 'na',   label: 'N/A'  }
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cl-status cl-status--${s.v}`;
    b.dataset.clStatus = s.v;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.textContent = s.label;
    statusGroup.appendChild(b);
    statusBtns[s.v] = b;
  }
  controls.appendChild(statusGroup);

  const evidenceLabel = document.createElement('label');
  evidenceLabel.className = 'cl-item__evidence';
  const evSpan = document.createElement('span');
  evSpan.textContent = 'Evidence';
  evidenceLabel.appendChild(evSpan);
  const evidence = document.createElement('select');
  evidence.dataset.clField = 'evidenceBasis';
  for (const opt of EVIDENCE_BASIS_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    evidence.appendChild(o);
  }
  evidenceLabel.appendChild(evidence);
  controls.appendChild(evidenceLabel);

  row.appendChild(controls);

  const note = document.createElement('textarea');
  note.className = 'cl-item__note';
  note.dataset.clField = 'note';
  note.rows = 2;
  note.placeholder = 'Field note';
  row.appendChild(note);

  _refs.items[it.id] = { row, statusBtns, evidence, note, equipHint, c9Hint };
  return row;
}

function _buildC9Detail() {
  const wrap = document.createElement('div');
  wrap.className = 'cl-item__c9';

  const fm = document.createElement('div');
  fm.className = 'cl-item__c9-block';
  fm.innerHTML = '<span class="cl-item__label">Failure mode:</span> ' +
    _esc(C9_DETAIL.failureMode);
  wrap.appendChild(fm);

  const mt = document.createElement('div');
  mt.className = 'cl-item__c9-block';
  mt.innerHTML = '<span class="cl-item__label">Method:</span> ' +
    _esc(C9_DETAIL.method);
  wrap.appendChild(mt);

  const fn = document.createElement('div');
  fn.className = 'cl-item__c9-block';
  fn.innerHTML = '<span class="cl-item__label">Field note required on fail:</span> ' +
    _esc(C9_DETAIL.fieldNoteOnFail);
  wrap.appendChild(fn);

  const ag = document.createElement('div');
  ag.className = 'cl-item__agiq';
  ag.textContent = `◆ ${C9_DETAIL.agiqRef}`;
  wrap.appendChild(ag);

  return wrap;
}

// ── Sync (every render) ───────────────────────────────────────────────

function _syncGroups(state) {
  for (const g of CHECKLIST_GROUPS) {
    const ref = _refs.groups[g.key];
    if (!ref) continue;
    const c = groupCounts(state.checklistState, g.key);
    const text =
      `${c.pass} pass · ${c.fail} fail · ${c.na} n/a · ${c.open} open`;
    if (ref.counts.textContent !== text) ref.counts.textContent = text;
  }
}

function _syncItems(state) {
  const cs = state.checklistState || {};
  const noEquip = !state.equipmentModules || state.equipmentModules.length === 0;

  for (const g of CHECKLIST_GROUPS) {
    for (const it of g.items) {
      const ref = _refs.items[it.id];
      if (!ref) continue;
      const s = getItemState(cs, it.id);

      // Status pills
      for (const v of ['pass', 'fail', 'na']) {
        const btn = ref.statusBtns[v];
        const active = s.status === v;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', String(active));
      }

      // Evidence basis selector
      const ev = s.evidenceBasis || 'Not Verified';
      if (ref.evidence.value !== ev) ref.evidence.value = ev;

      // Field note textarea — only write if value diverges, to preserve
      // focus and caret while the user is typing.
      const note = s.note || '';
      if (ref.note.value !== note) ref.note.value = note;

      // Conditional hints
      if (ref.equipHint) {
        const show = noEquip && s.status === 'fail';
        if (ref.equipHint.hidden !== !show) ref.equipHint.hidden = !show;
      }
      if (ref.c9Hint) {
        const show = s.status === 'fail' && !note.trim();
        if (ref.c9Hint.hidden !== !show) ref.c9Hint.hidden = !show;
      }

      // Row-level marker for failed C9 (drives any future styling).
      if (it.c9) {
        ref.row.classList.toggle('cl-item--c9-fail', s.status === 'fail');
      }
    }
  }
}

// ── Event delegation ──────────────────────────────────────────────────

function _wireDelegation() {
  // Status pill clicks. Toggling the same value clears the status (matches
  // the v1.1 monolith UX so techs can un-set without an extra control).
  _root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cl-status]');
    if (!btn) return;
    const row = btn.closest('[data-cl-id]');
    if (!row) return;
    const id = row.dataset.clId;
    const v  = btn.dataset.clStatus;
    const cs = _api.getState().checklistState || {};
    const cur = cs[id] ? cs[id].status : null;
    _patchItem(id, { status: cur === v ? null : v });
  });

  // Evidence basis selector
  _root.addEventListener('change', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLSelectElement)) return;
    if (el.dataset.clField !== 'evidenceBasis') return;
    const row = el.closest('[data-cl-id]');
    if (!row) return;
    _patchItem(row.dataset.clId, { evidenceBasis: el.value });
  });

  // Field note textarea — input fires per keystroke, debounced save in
  // app.js makes this safe.
  _root.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLTextAreaElement)) return;
    if (el.dataset.clField !== 'note') return;
    const row = el.closest('[data-cl-id]');
    if (!row) return;
    _patchItem(row.dataset.clId, { note: el.value });
  });
}

function _patchItem(id, patch) {
  const cur  = _api.getState().checklistState || {};
  const prev = cur[id] || defaultItemState();
  const next = { ...prev, ...patch };
  _api.setState({ checklistState: { ...cur, [id]: next } });
}

// ── Util ──────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
