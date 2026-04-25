/* ═══════════════════════════════════════════════════════════════════════════
   Psychrometric UI — state management, event binding, compute orchestration.
   Depends on math.js (pure calcs), chart.js (SVG), report.js (exports).
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  pressureFromAlt, computeState, mixStates,
  coilProcess, apparatusDewPoint, bypassFactor, economizerStatus,
  humidityRatioFromRh
} from './math.js';
import { buildChartDark } from './chart.js';
import { buildTextReport, buildHtmlReport } from './report.js';

const APP = {
  mode: 'single',        // 'single' | 'multi'
  showComfort: false,
  pAtm: 14.696,
  /* Per-state moisture-input preference ('wb' or 'rh') */
  moistureMode: { single: 'wb', RA: 'wb', SA: 'wb', OA: 'wb', MA: 'wb' },
  /* MA source: 'measure' (own inputs) or 'calc' (from OA + OA%) */
  maSource: 'calc',
  computed: {}  // populated by calc()
};

/* ─── DOM helpers ──────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

function numVal(id) {
  const el = $(id);
  if (!el) return NaN;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : NaN;
}

function readStateInputs(key) {
  /* Keys: 'single', 'RA', 'SA', 'OA', 'MA' */
  const suffix = key.toLowerCase();
  const tdb = numVal(`in-${suffix}-tdb`);
  const twb = numVal(`in-${suffix}-twb`);
  const rh  = numVal(`in-${suffix}-rh`);
  const moistureMode = APP.moistureMode[key];
  if (!Number.isFinite(tdb)) return null;
  if (moistureMode === 'wb' && !Number.isFinite(twb)) return null;
  if (moistureMode === 'rh' && !Number.isFinite(rh))  return null;
  return { tdb, twb: moistureMode === 'wb' ? twb : undefined, rh: moistureMode === 'rh' ? rh : undefined };
}

/* ─── Calc pipeline ────────────────────────────────────────────────────── */
function calc() {
  const alt = numVal('in-alt');
  APP.pAtm = pressureFromAlt(Number.isFinite(alt) ? alt : 0);

  $('rd-pressure').textContent = APP.pAtm.toFixed(3) + ' psia';

  const computed = {};

  if (APP.mode === 'single') {
    const input = readStateInputs('single');
    computed.single = input ? computeState(input, APP.pAtm) : null;
  } else {
    /* Read all states that have inputs */
    for (const k of ['RA', 'SA', 'OA']) {
      const inp = readStateInputs(k);
      computed[k] = inp ? computeState(inp, APP.pAtm) : null;
    }
    /* Mixed air: measured or calculated */
    if (APP.maSource === 'calc') {
      const oaPct = numVal('in-ma-oapct');
      if (computed.OA && computed.RA && Number.isFinite(oaPct) && oaPct >= 0 && oaPct <= 100) {
        computed.MA = mixStates(computed.OA, computed.RA, oaPct / 100, APP.pAtm);
      } else {
        computed.MA = null;
      }
    } else {
      const inp = readStateInputs('MA');
      computed.MA = inp ? computeState(inp, APP.pAtm) : null;
    }

    /* Coil process RA → SA */
    const cfm = numVal('in-cfm');
    computed.coilProcess = (computed.RA && computed.SA)
      ? coilProcess(computed.RA, computed.SA, Number.isFinite(cfm) ? cfm : null, APP.pAtm)
      : null;

    /* ADP + bypass factor */
    computed.adp = (computed.RA && computed.SA)
      ? apparatusDewPoint(computed.RA, computed.SA, APP.pAtm)
      : null;
    computed.bypassFactor = (computed.RA && computed.SA && Number.isFinite(computed.adp))
      ? bypassFactor(computed.RA, computed.SA, computed.adp)
      : null;

    /* Economizer */
    computed.economizer = (computed.OA && computed.RA)
      ? economizerStatus(computed.OA, computed.RA)
      : null;
  }

  /* Target delta (vs primary = RA in multi, single in single) */
  const targetRh = numVal('in-target-rh');
  const refState = APP.mode === 'single' ? computed.single : computed.RA;
  if (Number.isFinite(targetRh) && targetRh > 0 && targetRh < 100 && refState) {
    const targetW = humidityRatioFromRh(refState.tdb, targetRh, APP.pAtm);
    computed.targetDelta = {
      dRh: targetRh - refState.rh,
      dW:  targetW - refState.w,
      dGr: (targetW - refState.w) * 7000,
      targetW
    };
  } else {
    computed.targetDelta = null;
  }

  APP.computed = computed;

  renderResults();
  renderChart();
}

/* ─── Rendering ───────────────────────────────────────────────────────── */
function renderChart() {
  const host = $('chart-host');
  const targetRh = numVal('in-target-rh');
  host.innerHTML = buildChartDark({
    pAtm: APP.pAtm,
    states: APP.mode === 'multi' ? APP.computed : {},
    singleState: APP.mode === 'single' ? APP.computed.single : null,
    adp: APP.computed.adp,
    targetRh: Number.isFinite(targetRh) && targetRh > 0 && targetRh < 100 ? targetRh : null,
    showComfort: APP.showComfort
  });

  /* State tag below chart */
  const tagHost = $('state-tag');
  if (APP.mode === 'single' && APP.computed.single) {
    const s = APP.computed.single;
    tagHost.textContent = `STATE  ${s.tdb.toFixed(1)}°F db / ${s.twb.toFixed(1)}°F wb · ${s.rh.toFixed(0)}% RH · ${s.gr.toFixed(0)} gr/lb`;
    tagHost.style.display = '';
  } else if (APP.mode === 'multi') {
    const entered = ['RA','SA','OA','MA'].filter(k => APP.computed[k]);
    if (entered.length) {
      tagHost.textContent = 'STATES  ' + entered.map(k => `${k}: ${APP.computed[k].tdb.toFixed(0)}°/${APP.computed[k].rh.toFixed(0)}%`).join('  ·  ');
      tagHost.style.display = '';
    } else {
      tagHost.style.display = 'none';
    }
  } else {
    tagHost.style.display = 'none';
  }

  /* Target delta tag */
  const dTag = $('delta-tag');
  if (APP.computed.targetDelta) {
    const td = APP.computed.targetDelta;
    dTag.textContent = `TARGET  Δ ${(td.dRh >= 0 ? '+' : '') + td.dRh.toFixed(1)}% RH  (${(td.dGr >= 0 ? '+' : '') + td.dGr.toFixed(1)} gr/lb) — ${td.dRh > 0 ? 'humidify' : 'dehumidify'}`;
    dTag.style.display = '';
  } else {
    dTag.style.display = 'none';
  }
}

function renderResults() {
  /* Show single-state results pane, hide multi-state (or vice-versa) */
  $('results-single').style.display = APP.mode === 'single' ? '' : 'none';
  $('results-multi' ).style.display = APP.mode === 'multi'  ? '' : 'none';

  if (APP.mode === 'single') {
    const s = APP.computed.single;
    if (!s) {
      setRowDim(['H','W','Gr','Alt','Dp']);
      return;
    }
    setRowLive('H',  s.h.toFixed(2) + ' BTU/lb');
    setRowLive('W',  s.w.toFixed(6) + ' lb/lb');
    setRowLive('Gr', s.gr.toFixed(1) + ' gr/lb');
    if (APP.moistureMode.single === 'wb') {
      $('lbl-Alt').textContent = 'Relative Humidity';
      setRowLive('Alt', s.rh.toFixed(1) + ' %');
      $('sub-Alt').textContent = 'Computed from wet-bulb input';
    } else {
      $('lbl-Alt').textContent = 'Wet Bulb';
      setRowLive('Alt', s.twb.toFixed(1) + ' °F');
      $('sub-Alt').textContent = 'Computed from RH input';
    }
    setRowLive('Dp', s.dp.toFixed(1) + ' °F');
  } else {
    /* Multi-state: state cards + coil process + ADP + economizer */
    renderStateCards();
    renderCoilProcess();
    renderAdpCard();
    renderEconomizerCard();
  }
}

function setRowDim(ids) {
  for (const id of ids) {
    const row = $('row-' + id);
    const val = $('val-' + id);
    if (row) row.className = 'result-row dim';
    if (val) { val.className = 'rr-val'; val.textContent = '—'; }
  }
}
function setRowLive(id, text, state) {
  const row = $('row-' + id);
  const val = $('val-' + id);
  if (!row || !val) return;
  row.className = 'result-row live' + (state ? ' ' + state : '');
  val.className = 'rr-val live' + (state ? ' ' + state : '');
  val.textContent = text;
}

function renderStateCards() {
  const container = $('state-cards');
  container.innerHTML = '';
  const keys = ['RA', 'SA', 'OA', 'MA'];
  const labels = { RA: 'Return Air', SA: 'Supply Air', OA: 'Outdoor Air', MA: 'Mixed Air' };
  const colors = { RA: 'var(--orange-hi)', SA: '#4a9de8', OA: '#6fc876', MA: '#b987d6' };
  let anyEntered = false;
  for (const k of keys) {
    const s = APP.computed[k];
    if (!s) continue;
    anyEntered = true;
    const div = document.createElement('div');
    div.className = 'state-card';
    div.innerHTML = `
      <div class="state-card-hdr" style="color:${colors[k]}">${k} — ${labels[k]}</div>
      <div class="state-card-grid">
        <div><span class="sc-lbl">Tdb</span> ${s.tdb.toFixed(1)} °F</div>
        <div><span class="sc-lbl">Twb</span> ${s.twb.toFixed(1)} °F</div>
        <div><span class="sc-lbl">RH</span> ${s.rh.toFixed(1)} %</div>
        <div><span class="sc-lbl">gr/lb</span> ${s.gr.toFixed(1)}</div>
        <div><span class="sc-lbl">h</span> ${s.h.toFixed(2)} BTU/lb</div>
        <div><span class="sc-lbl">Dp</span> ${s.dp.toFixed(1)} °F</div>
      </div>`;
    container.appendChild(div);
  }
  $('state-cards-wrap').style.display = anyEntered ? '' : 'none';
}

function renderCoilProcess() {
  const cp = APP.computed.coilProcess;
  $('coil-wrap').style.display = cp ? '' : 'none';
  if (!cp) return;
  setRowLive('dT',  cp.dT.toFixed(1) + ' °F');
  setRowLive('dGr', cp.dGr.toFixed(1) + ' gr/lb');
  setRowLive('dH',  cp.dH.toFixed(2) + ' BTU/lb');
  setRowLive('shr', Number.isFinite(cp.shr) ? cp.shr.toFixed(2) : '—');
  if (Number.isFinite(cp.qTotalBtuh)) {
    setRowLive('qSens',  Math.round(cp.qSensibleBtuh).toLocaleString() + ' BTU/h');
    setRowLive('qLat',   Math.round(cp.qLatentBtuh).toLocaleString() + ' BTU/h');
    setRowLive('qTotal', Math.round(cp.qTotalBtuh).toLocaleString() + ' BTU/h');
    setRowLive('qTons',  cp.capacityTons.toFixed(2) + ' tons');
    $('cap-wrap').style.display = '';
  } else {
    $('cap-wrap').style.display = 'none';
  }
}

function renderAdpCard() {
  const show = Number.isFinite(APP.computed.adp);
  $('adp-wrap').style.display = show ? '' : 'none';
  if (!show) return;
  setRowLive('adp', APP.computed.adp.toFixed(1) + ' °F');
  const bf = APP.computed.bypassFactor;
  if (Number.isFinite(bf)) {
    let rating = 'typical';
    let state = '';
    if (bf < 0.10) { rating = 'high-performance'; state = 'ok'; }
    else if (bf > 0.25) { rating = 'poor — shallow/fouled'; state = 'warn'; }
    else { rating = 'typical residential/light commercial'; state = 'ok'; }
    setRowLive('bf', bf.toFixed(2) + '  (' + rating + ')', state);
  } else {
    setRowDim(['bf']);
  }
}

function renderEconomizerCard() {
  const eco = APP.computed.economizer;
  $('eco-wrap').style.display = eco ? '' : 'none';
  if (!eco) return;
  setRowLive('ecoH', eco.enthalpyFavorable ? 'FAVORABLE (OA < RA)' : 'Not favorable', eco.enthalpyFavorable ? 'ok' : '');
  setRowLive('ecoT', eco.dryBulbFavorable  ? 'favorable' : 'not favorable');
  setRowLive('ecoLim', eco.highLimitOk ? 'within 90.1 limit (≤ 28 BTU/lb)' : 'above limit — lockout required', eco.highLimitOk ? 'ok' : 'warn');
  if (eco.savings > 0) {
    setRowLive('ecoSave', eco.savings.toFixed(2) + ' BTU/lb OA cooling available');
  } else {
    setRowDim(['ecoSave']);
  }
}

/* ─── Event binding ────────────────────────────────────────────────────── */
function bindMoistureToggle(stateKey) {
  /* Each state has a WB/RH toggle. Mobile-mode binds all. */
  const grid = $(`moisture-${stateKey}`);
  if (!grid) return;
  const btns = grid.querySelectorAll('.phase-btn');
  btns.forEach(b => {
    b.addEventListener('click', () => {
      APP.moistureMode[stateKey] = b.getAttribute('data-mode');
      btns.forEach(x => x.classList.toggle('active', x === b));
      const prefix = stateKey.toLowerCase();
      $(`wb-input-${prefix}`).style.display = APP.moistureMode[stateKey] === 'wb' ? '' : 'none';
      $(`rh-input-${prefix}`).style.display = APP.moistureMode[stateKey] === 'rh' ? '' : 'none';
      calc();
    });
  });
}

function bindModeToggle() {
  const btns = document.querySelectorAll('#mode-toggle .phase-btn');
  btns.forEach(b => {
    b.addEventListener('click', () => {
      APP.mode = b.getAttribute('data-mode');
      btns.forEach(x => x.classList.toggle('active', x === b));
      $('single-inputs').style.display = APP.mode === 'single' ? '' : 'none';
      $('multi-inputs').style.display  = APP.mode === 'multi'  ? '' : 'none';
      calc();
    });
  });
}

function bindMaSourceToggle() {
  const btns = document.querySelectorAll('#ma-source .phase-btn');
  btns.forEach(b => {
    b.addEventListener('click', () => {
      APP.maSource = b.getAttribute('data-src');
      btns.forEach(x => x.classList.toggle('active', x === b));
      $('ma-calc-inputs').style.display    = APP.maSource === 'calc'    ? '' : 'none';
      $('ma-measure-inputs').style.display = APP.maSource === 'measure' ? '' : 'none';
      calc();
    });
  });
}

function bindComfortToggle() {
  const btn = $('comfort-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    APP.showComfort = !APP.showComfort;
    btn.classList.toggle('active', APP.showComfort);
    btn.textContent = APP.showComfort ? 'Hide Comfort Zone' : 'Show Comfort Zone';
    renderChart();
  });
}

function bindAllInputs() {
  /* Collect all numeric inputs and wire 'input' → calc */
  const ids = [
    'in-alt', 'in-cfm', 'in-target-rh', 'in-ma-oapct',
    'in-single-tdb', 'in-single-twb', 'in-single-rh',
    'in-ra-tdb', 'in-ra-twb', 'in-ra-rh',
    'in-sa-tdb', 'in-sa-twb', 'in-sa-rh',
    'in-oa-tdb', 'in-oa-twb', 'in-oa-rh',
    'in-ma-tdb', 'in-ma-twb', 'in-ma-rh'
  ];
  for (const id of ids) {
    const el = $(id);
    if (el) el.addEventListener('input', calc);
  }
}

function snapshot() {
  return {
    mode: APP.mode,
    pAtm: APP.pAtm,
    alt: numVal('in-alt'),
    cfm: numVal('in-cfm'),
    targetRh: numVal('in-target-rh'),
    showComfort: APP.showComfort,
    mixedAirAutoCalculated: APP.maSource === 'calc',
    inputs: {
      single: { tdb: numVal('in-single-tdb'), twb: numVal('in-single-twb'), rh: numVal('in-single-rh'), moistureMode: APP.moistureMode.single },
      RA: { tdb: numVal('in-ra-tdb'), twb: numVal('in-ra-twb'), rh: numVal('in-ra-rh'), moistureMode: APP.moistureMode.RA },
      SA: { tdb: numVal('in-sa-tdb'), twb: numVal('in-sa-twb'), rh: numVal('in-sa-rh'), moistureMode: APP.moistureMode.SA },
      OA: { tdb: numVal('in-oa-tdb'), twb: numVal('in-oa-twb'), rh: numVal('in-oa-rh'), moistureMode: APP.moistureMode.OA },
      MA: { tdb: numVal('in-ma-tdb'), twb: numVal('in-ma-twb'), rh: numVal('in-ma-rh'), moistureMode: APP.moistureMode.MA,
            oaPct: numVal('in-ma-oapct') / 100 }
    },
    computed: APP.computed
  };
}

/* ─── Report modal ─────────────────────────────────────────────────────── */
function openModal(title, text) {
  $('modal-title').textContent = title;
  $('report-text').textContent = text;
  $('report-modal').classList.add('open');
}
function closeModal() { $('report-modal').classList.remove('open'); }
function showToast(msg) {
  const t = $('toast');
  if (msg) t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function bindReport() {
  $('btn-report').addEventListener('click', () => {
    openModal('Psychrometric — Report', buildTextReport(snapshot()));
  });
  $('modal-close').addEventListener('click', closeModal);
  $('report-modal').addEventListener('click', e => { if (e.target.id === 'report-modal') closeModal(); });

  $('btn-copy').addEventListener('click', () => {
    const t = $('report-text').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => showToast('Copied to clipboard'));
    else {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('Copied to clipboard');
    }
  });

  $('btn-copy-html').addEventListener('click', () => {
    const html = buildHtmlReport(snapshot());
    const textVer = $('report-text').textContent;
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const item = new ClipboardItem({
          'text/html':  new Blob([html],   { type: 'text/html' }),
          'text/plain': new Blob([textVer], { type: 'text/plain' })
        });
        navigator.clipboard.write([item]).then(
          () => showToast('HTML copied — paste into email'),
          () => fallback()
        );
        return;
      } catch (e) { /* fall through */ }
    }
    fallback();
    function fallback() {
      const w = window.open('', '_blank');
      if (!w) { showToast('Pop-up blocked — allow pop-ups to export HTML'); return; }
      w.document.write(html);
      w.document.close();
      showToast('Opened in new tab — Ctrl+A, Ctrl+C to copy');
    }
  });

  $('btn-print').addEventListener('click', () => {
    const html = buildHtmlReport(snapshot());
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up blocked'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  });
}

/* ─── Favorites (matches convention in other tools) ────────────────────── */
function bindFavorites() {
  const KEY = 'hermes_favorites';
  const id = 'psychrometric';
  const title = 'Psychrometric';
  const tierEl = document.querySelector('.hdr-tier');
  const tier = tierEl ? (tierEl.classList.contains('t1') ? 't1' : tierEl.classList.contains('t3') ? 't3' : 't2') : 't3';
  const btn = $('favBtn');
  if (!btn) return;
  const getFavs = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const isFav = () => getFavs().some(f => f.id === id);
  const sync  = () => { btn.textContent = isFav() ? '★' : '☆'; btn.classList.toggle('on', isFav()); };
  window.toggleFav = () => {
    const favs = getFavs();
    const idx = favs.findIndex(f => f.id === id);
    if (idx !== -1) favs.splice(idx, 1);
    else favs.push({ id, title, tier, label: title, type: 'module' });
    localStorage.setItem(KEY, JSON.stringify(favs));
    sync();
    try { if (window.parent !== window) window.parent.postMessage({ type: 'hermes-fav-toggle' }, '*'); } catch {}
  };
  sync();
}

/* ─── Init ──────────────────────────────────────────────────────────────── */
function init() {
  bindModeToggle();
  bindMaSourceToggle();
  ['single', 'RA', 'SA', 'OA', 'MA'].forEach(bindMoistureToggle);
  bindComfortToggle();
  bindAllInputs();
  bindReport();
  bindFavorites();

  calc();
}
document.addEventListener('DOMContentLoaded', init);
