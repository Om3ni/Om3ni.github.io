// Project Demeter — Persistence Layer
// IndexedDB wrapper. SurveyRecord schema v2.
// No DOM, no app state. Pure I/O.

const DB_NAME    = 'demeter';
const DB_VERSION = 1;
const STORE      = 'surveys';
const DEVICE_KEY = 'demeter.deviceId';

const SCHEMA_VERSION = 2;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  return _dbPromise;
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

// ---- Device fingerprint ----------------------------------------------------

export function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem(DEVICE_KEY); } catch (_) {}
  if (!id) {
    id = (crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
  }
  return id;
}

// ---- Schema ----------------------------------------------------------------

function newId() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build a fresh v2 SurveyRecord. Single source of truth for default shape.
export function newSurveyRecord() {
  const now = new Date().toISOString();
  return {
    id: newId(),
    status: 'active',
    version: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    reportGeneratedAt: null,
    lastEditedDevice: null,
    metadata: {
      customer: '',
      facility: '',
      room: '',
      equipmentServing: '',
      tech: '',
      date: todayISO(),
      narrative: '',
      stage: 0,
      lights: 'on',
      unitF: true
    },
    mapData: {
      roomLen: null,
      roomWid: null,
      mapMode: 'single',
      airflowConfidence: 'UNKNOWN',
      coverageNotes: '',
      sensors: [],
      zones: [],
      equipmentModules: [],
      ducts: [],
      registers: [],
      tierCount: 2,
      lighting: 'led',
      tierSensors: {}
    },
    checklistState: {},
    reportSnapshot: null
  };
}

// Idempotent v1 → v2 migration. Applied on load.
// THIS codebase only writes v2; migration exists to absorb records from
// earlier deployments without crashing.
function migrateToV2(rec) {
  if (!rec || rec.version === SCHEMA_VERSION) return rec;

  if (!rec.metadata) rec.metadata = {};
  if (!rec.mapData)  rec.mapData  = {};
  if (!rec.checklistState) rec.checklistState = {};

  if (rec.metadata.lights == null) rec.metadata.lights = 'on';
  if (rec.mapData.coverageNotes == null) rec.mapData.coverageNotes = '';

  const mods = rec.mapData.equipmentModules || [];
  for (const m of mods) {
    if (m.model == null) m.model = '';
    if (m.serial == null) m.serial = '';
    if (m.unitType == null) m.unitType = '';
    if (m.reheatType == null) m.reheatType = '';
    if (m.commissioningPresent == null) m.commissioningPresent = false;
    if (m.internetConnected == null)    m.internetConnected = false;
  }

  const tiers = rec.mapData.tierSensors || {};
  for (const t of Object.keys(tiers)) {
    for (const s of (tiers[t] || [])) {
      if (s.position == null) s.position = 'mid';
    }
  }

  for (const itemId of Object.keys(rec.checklistState)) {
    const it = rec.checklistState[itemId];
    if (it && it.evidenceBasis == null) it.evidenceBasis = 'Not Verified';
  }

  rec.version = SCHEMA_VERSION;
  return rec;
}

// Defensive: enforce v2 on write. Throw loudly if a caller hands us junk.
function assertV2(rec) {
  if (!rec || typeof rec !== 'object') throw new Error('SurveyRecord: not an object');
  if (rec.version !== SCHEMA_VERSION) {
    throw new Error(`SurveyRecord: expected version ${SCHEMA_VERSION}, got ${rec.version}`);
  }
  if (!rec.id) throw new Error('SurveyRecord: missing id');
  if (!rec.status) throw new Error('SurveyRecord: missing status');
  if (!rec.metadata || !rec.mapData) throw new Error('SurveyRecord: missing metadata/mapData');
}

// ---- Public API ------------------------------------------------------------

export async function createSurvey() {
  const rec = newSurveyRecord();
  rec.lastEditedDevice = getDeviceId();
  const store = await tx('readwrite');
  await reqToPromise(store.add(rec));
  return rec;
}

export async function loadSurvey(id) {
  const store = await tx('readonly');
  const rec = await reqToPromise(store.get(id));
  if (!rec) return null;
  return migrateToV2(rec);
}

// status: 'active' | 'complete' | 'archived' | undefined (returns all)
export async function listSurveys(status) {
  const store = await tx('readonly');
  const all = await reqToPromise(store.getAll());
  const filtered = (status == null) ? all : all.filter((r) => r.status === status);
  filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return filtered.map(migrateToV2);
}

export async function saveSurvey(rec) {
  rec.updatedAt = new Date().toISOString();
  rec.lastEditedDevice = getDeviceId();
  assertV2(rec);
  const store = await tx('readwrite');
  await reqToPromise(store.put(rec));
  return rec;
}

export async function archiveSurvey(id) {
  const rec = await loadSurvey(id);
  if (!rec) return null;
  rec.status = 'archived';
  return saveSurvey(rec);
}

export async function deleteSurvey(id) {
  const store = await tx('readwrite');
  await reqToPromise(store.delete(id));
}
