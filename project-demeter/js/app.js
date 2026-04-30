const APP = {
  unitF: true,
  stage: 0,
  lights: 'on',

  customer: '',
  facility: '',
  room: '',
  equipmentServing: '',
  tech: '',
  date: '',
  narrative: '',

  mapMode: 'single',
  roomLen: null,
  roomWid: null,
  activeTool: 'sensor',
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

  surveyId: null,
  createdAt: null,
  updatedAt: null,
  reportGeneratedAt: null,
  lastEditedDevice: null,
  version: 2,

  activeTab: 'survey'
};

function setState(patch) {
  Object.assign(APP, patch);
  render();
}

function render() {
  const tabs = document.querySelectorAll('.tab-bar__tab');
  tabs.forEach((btn) => {
    const isActive = btn.dataset.tab === APP.activeTab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach((panel) => {
    const isActive = panel.id === `tab-${APP.activeTab}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  const vpd = document.getElementById('vpd-readout');
  const via = document.getElementById('viability-readout');
  if (vpd) vpd.textContent = '--';
  if (via) via.textContent = '--';
}

function init() {
  document.querySelectorAll('.tab-bar__tab').forEach((btn) => {
    btn.addEventListener('click', () => setState({ activeTab: btn.dataset.tab }));
  });
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.APP = APP;
window.setState = setState;
