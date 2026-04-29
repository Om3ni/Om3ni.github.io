/* ═══════════════════════════════════════════════════════════════════════════
   Psychrometric report builders — text (for XOI) and HTML (for email).
   Both consume a single `snapshot` object produced by ui.js; no DOM access.
   ═══════════════════════════════════════════════════════════════════════════ */

import { buildChartLight } from './chart.js';

const FONT = "ui-monospace,Menlo,'Liberation Mono',Consolas,monospace";

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function pad(label, width) {
  return (label + ':').padEnd(width, ' ');
}
function fmtF(v, digits = 1) { return Number.isFinite(v) ? v.toFixed(digits) + ' °F' : '—'; }
function fmtPct(v)           { return Number.isFinite(v) ? v.toFixed(1) + ' %'    : '—'; }
function fmtHR(v)            { return Number.isFinite(v) ? v.toFixed(6) + ' lb/lb' : '—'; }
function fmtGr(v)            { return Number.isFinite(v) ? v.toFixed(1) + ' gr/lb' : '—'; }
function fmtEn(v)            { return Number.isFinite(v) ? v.toFixed(2) + ' BTU/lb' : '—'; }
function fmtBtuh(v)          { return Number.isFinite(v) ? Math.round(v).toLocaleString() + ' BTU/h' : '—'; }
function fmtSgn(v, digits = 1) {
  if (!Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(digits);
}

/* ─── Text report (plain ASCII for XOI) ────────────────────────────────── */
export function buildTextReport(snap) {
  const rule = '══════════════════════════════════════════';
  const bar  = '──────────────────────────────────────────';
  const ts = new Date().toLocaleString();
  const L = [];
  const W = 18;  // label width for padding

  L.push(rule);
  L.push(' PSYCHROMETRIC ANALYSIS — FIELD REPORT');
  L.push(' ' + ts);
  L.push(rule);
  L.push('');

  L.push('── CONDITIONS ──');
  L.push(pad('Mode', W) + (snap.mode === 'single' ? 'Single State' : 'System Diagnostic'));
  L.push(pad('Elevation', W) + (Number.isFinite(snap.alt) ? snap.alt.toFixed(0) + ' ft' : '—'));
  L.push(pad('Barometric', W) + (Number.isFinite(snap.pAtm) ? snap.pAtm.toFixed(3) + ' psia' : '—'));
  if (snap.mode === 'multi' && Number.isFinite(snap.cfm) && snap.cfm > 0) {
    L.push(pad('Airflow (CFM)', W) + snap.cfm.toFixed(0) + ' CFM');
  }
  if (Number.isFinite(snap.targetRh)) {
    L.push(pad('Target RH', W) + snap.targetRh.toFixed(1) + ' %');
  }
  L.push('');

  /* ── Single state ── */
  if (snap.mode === 'single') {
    const s = snap.computed.single;
    L.push('── INPUT ──');
    L.push(pad('Dry Bulb', W) + fmtF(snap.inputs.single.tdb));
    if (snap.inputs.single.moistureMode === 'wb') {
      L.push(pad('Wet Bulb', W) + fmtF(snap.inputs.single.twb));
    } else {
      L.push(pad('Relative Humidity', W) + fmtPct(snap.inputs.single.rh));
    }
    L.push('');
    if (s) {
      L.push('── DERIVED ──');
      L.push(pad('Enthalpy', W) + fmtEn(s.h) + ' dry air');
      L.push(pad('Humidity Ratio', W) + fmtHR(s.w));
      L.push(pad('', W) + fmtGr(s.gr));
      if (snap.inputs.single.moistureMode === 'wb') {
        L.push(pad('Relative Humidity', W) + fmtPct(s.rh));
      } else {
        L.push(pad('Wet Bulb', W) + fmtF(s.twb));
      }
      L.push(pad('Dew Point', W) + fmtF(s.dp));
      L.push('');
    }
  }

  /* ── Multi-state ── */
  if (snap.mode === 'multi') {
    const keys = ['RA', 'SA', 'OA', 'MA'];
    const labels = { RA: 'Return Air', SA: 'Supply Air', OA: 'Outdoor Air', MA: 'Mixed Air' };
    const entered = keys.filter(k => snap.computed[k]);

    if (entered.length) {
      L.push('── STATES ──');
      for (const k of entered) {
        const s = snap.computed[k];
        L.push(k + ' (' + labels[k] + ')');
        L.push(pad('  Dry Bulb', W) + fmtF(s.tdb));
        L.push(pad('  Wet Bulb', W) + fmtF(s.twb));
        L.push(pad('  Rel Humidity', W) + fmtPct(s.rh));
        L.push(pad('  Humidity Ratio', W) + fmtHR(s.w) + '  (' + fmtGr(s.gr) + ')');
        L.push(pad('  Enthalpy', W) + fmtEn(s.h));
        L.push(pad('  Dew Point', W) + fmtF(s.dp));
        if (k === 'MA' && snap.mixedAirAutoCalculated && Number.isFinite(snap.inputs.MA.oaPct)) {
          L.push(pad('  Source', W) + 'Calculated: ' + (snap.inputs.MA.oaPct * 100).toFixed(0) + '% OA + ' + ((1 - snap.inputs.MA.oaPct) * 100).toFixed(0) + '% RA');
        }
        L.push('');
      }
    }

    /* Coil process */
    const cp = snap.computed.coilProcess;
    if (cp) {
      L.push('── COIL PROCESS (RA → SA) ──');
      L.push(pad('Sensible ΔT', W) + fmtF(cp.dT) + ' (cooling)');
      L.push(pad('Latent ΔW', W) + fmtGr(cp.dGr) + ' removed');
      L.push(pad('Total Δh', W) + fmtEn(cp.dH));
      if (Number.isFinite(cp.shr)) {
        L.push(pad('SHR', W) + cp.shr.toFixed(2) + ' (sensible fraction)');
      }
      if (Number.isFinite(cp.qSensibleBtuh)) {
        L.push(pad('Sensible Cap', W) + fmtBtuh(cp.qSensibleBtuh));
        L.push(pad('Latent Cap', W) + fmtBtuh(cp.qLatentBtuh));
        L.push(pad('Total Cap', W) + fmtBtuh(cp.qTotalBtuh) + '  (' + (cp.capacityTons).toFixed(2) + ' tons)');
        if (Number.isFinite(cp.densityFactor) && Math.abs(cp.densityFactor - 1) > 0.01) {
          L.push(pad('Density Factor', W) + cp.densityFactor.toFixed(3) + ' (altitude-corrected)');
        }
      }
      L.push('');
    }

    /* ADP + Bypass */
    if (Number.isFinite(snap.computed.adp)) {
      L.push('── COIL PERFORMANCE ──');
      L.push(pad('Apparatus DP', W) + fmtF(snap.computed.adp) + ' (effective coil surface)');
      if (Number.isFinite(snap.computed.bypassFactor)) {
        const bf = snap.computed.bypassFactor;
        let rating = 'typical';
        if (bf < 0.10) rating = 'high-performance';
        else if (bf > 0.25) rating = 'poor (shallow/fouled?)';
        L.push(pad('Bypass Factor', W) + bf.toFixed(2) + '  (' + rating + ')');
      }
      L.push('');
    }

    /* Economizer */
    const eco = snap.computed.economizer;
    if (eco) {
      L.push('── ECONOMIZER EVALUATION ──');
      L.push(pad('Enthalpy Check', W) + (eco.enthalpyFavorable ? 'FAVORABLE (OA < RA)' : 'not favorable'));
      L.push(pad('Dry-Bulb Check', W) + (eco.dryBulbFavorable ? 'favorable' : 'not favorable'));
      L.push(pad('High-Limit OK', W) + (eco.highLimitOk ? 'within 90.1 limit' : 'above 28 BTU/lb'));
      if (eco.savings > 0) {
        L.push(pad('OA Cooling', W) + eco.savings.toFixed(2) + ' BTU/lb available');
      }
      L.push('');
    }

    /* Target delta */
    if (Number.isFinite(snap.targetRh) && snap.computed.targetDelta) {
      const td = snap.computed.targetDelta;
      L.push('── TARGET DELTA ──');
      L.push(pad('Reference', W) + (snap.computed.RA ? 'RA state' : '—'));
      L.push(pad('RH Delta', W) + fmtSgn(td.dRh) + ' %');
      L.push(pad('Moisture Delta', W) + fmtSgn(td.dGr) + ' gr/lb');
      L.push(pad('Action', W) + (td.dRh > 0 ? 'humidify' : 'dehumidify'));
      L.push('');
    }
  }

  L.push(rule);
  L.push(' ASHRAE Fund. 2017 Ch. 1 (Eq. 3, 5/6, 22, 32, 35) + Ch. 23 (ADP, BF)');
  if (snap.mode === 'multi') L.push(' ASHRAE 55-2020 comfort · ASHRAE 90.1 economizer');
  L.push(' om3ni.github.io');
  L.push(rule);

  return L.join('\n');
}

/* ─── HTML report (rich, email-friendly, light theme) ──────────────────── */
export function buildHtmlReport(snap) {
  const ts = new Date().toLocaleString();
  const sBody   = `font-family:${FONT};max-width:760px;margin:0 auto;padding:24px;background:#fff;color:#1a1a1a;line-height:1.5;`;
  const sTitleBox = `border-bottom:2px solid #c8553d;padding-bottom:10px;margin-bottom:16px;`;
  const sTitle  = `margin:0;font-size:17px;letter-spacing:0.05em;color:#1a1a1a;font-weight:600;`;
  const sTs     = `font-size:11px;color:#888;margin-top:4px;`;
  const sH      = `font-size:11px;font-weight:600;letter-spacing:0.1em;color:#c8553d;margin:18px 0 6px;text-transform:uppercase;`;
  const sTbl    = `border-collapse:collapse;width:100%;font-size:13px;`;
  const sLbl    = `padding:4px 12px 4px 0;color:#666;width:38%;vertical-align:top;`;
  const sVal    = `padding:4px 0;color:#1a1a1a;font-weight:500;`;
  const sStatesTbl = `border-collapse:collapse;width:100%;font-size:12px;margin-top:4px;`;
  const sStatesTh  = `padding:6px 8px;color:#666;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;font-size:10px;text-align:left;border-bottom:1px solid #ddd;`;
  const sStatesTd  = `padding:5px 8px;color:#1a1a1a;border-bottom:1px solid #eee;`;
  const sChartBox  = `background:#fdfaf5;border:1px solid #e6dccb;border-radius:3px;padding:14px;margin:6px 0 6px;`;
  const sFooter    = `font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px;margin-top:20px;line-height:1.5;`;
  const sColors    = { RA: '#c8553d', SA: '#2a8d7a', OA: '#3a9a44', MA: '#7a4fa0' };

  const H = [];
  H.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Psychrometric Report<\/title><\/head>');
  H.push(`<body style="${sBody}">`);
  H.push(`<div style="${sTitleBox}">`);
  H.push(`<h1 style="${sTitle}">PSYCHROMETRIC ANALYSIS</h1>`);
  H.push(`<div style="${sTs}">${ts}</div>`);
  H.push(`</div>`);

  /* Conditions */
  H.push(`<div style="${sH}">Conditions</div>`);
  H.push(`<table style="${sTbl}">`);
  H.push(`<tr><td style="${sLbl}">Mode</td><td style="${sVal}">${snap.mode === 'single' ? 'Single State' : 'System Diagnostic'}</td></tr>`);
  H.push(`<tr><td style="${sLbl}">Elevation</td><td style="${sVal}">${Number.isFinite(snap.alt) ? snap.alt.toFixed(0) + ' ft' : '—'}</td></tr>`);
  H.push(`<tr><td style="${sLbl}">Barometric Pressure</td><td style="${sVal}">${Number.isFinite(snap.pAtm) ? snap.pAtm.toFixed(3) + ' psia' : '—'}</td></tr>`);
  if (snap.mode === 'multi' && Number.isFinite(snap.cfm) && snap.cfm > 0) {
    H.push(`<tr><td style="${sLbl}">Airflow</td><td style="${sVal}">${snap.cfm.toFixed(0)} CFM</td></tr>`);
  }
  if (Number.isFinite(snap.targetRh)) {
    H.push(`<tr><td style="${sLbl}">Target RH</td><td style="${sVal};color:#c85a00;">${snap.targetRh.toFixed(1)} %</td></tr>`);
  }
  H.push(`</table>`);

  /* Single-state body */
  if (snap.mode === 'single') {
    const s = snap.computed.single;
    H.push(`<div style="${sH}">Input</div>`);
    H.push(`<table style="${sTbl}">`);
    H.push(`<tr><td style="${sLbl}">Dry Bulb</td><td style="${sVal}">${fmtF(snap.inputs.single.tdb)}</td></tr>`);
    if (snap.inputs.single.moistureMode === 'wb') {
      H.push(`<tr><td style="${sLbl}">Wet Bulb</td><td style="${sVal}">${fmtF(snap.inputs.single.twb)}</td></tr>`);
    } else {
      H.push(`<tr><td style="${sLbl}">Relative Humidity</td><td style="${sVal}">${fmtPct(snap.inputs.single.rh)}</td></tr>`);
    }
    H.push(`</table>`);

    if (s) {
      H.push(`<div style="${sH}">Derived Values</div>`);
      H.push(`<table style="${sTbl}">`);
      H.push(`<tr><td style="${sLbl}">Enthalpy</td><td style="${sVal}">${fmtEn(s.h)} dry air</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Humidity Ratio</td><td style="${sVal}">${fmtHR(s.w)}&nbsp;(${fmtGr(s.gr)})</td></tr>`);
      if (snap.inputs.single.moistureMode === 'wb') {
        H.push(`<tr><td style="${sLbl}">Relative Humidity</td><td style="${sVal}">${fmtPct(s.rh)}</td></tr>`);
      } else {
        H.push(`<tr><td style="${sLbl}">Wet Bulb</td><td style="${sVal}">${fmtF(s.twb)}</td></tr>`);
      }
      H.push(`<tr><td style="${sLbl}">Dew Point</td><td style="${sVal}">${fmtF(s.dp)}</td></tr>`);
      H.push(`</table>`);
    }
  }

  /* Multi-state body */
  if (snap.mode === 'multi') {
    const keys = ['RA', 'SA', 'OA', 'MA'];
    const labels = { RA: 'Return Air', SA: 'Supply Air', OA: 'Outdoor Air', MA: 'Mixed Air' };
    const entered = keys.filter(k => snap.computed[k]);
    if (entered.length) {
      H.push(`<div style="${sH}">Air States</div>`);
      H.push(`<table style="${sStatesTbl}">`);
      H.push(`<tr>`);
      H.push(`<th style="${sStatesTh}">State</th>`);
      H.push(`<th style="${sStatesTh}">Tdb °F</th>`);
      H.push(`<th style="${sStatesTh}">Twb °F</th>`);
      H.push(`<th style="${sStatesTh}">RH %</th>`);
      H.push(`<th style="${sStatesTh}">gr/lb</th>`);
      H.push(`<th style="${sStatesTh}">h BTU/lb</th>`);
      H.push(`<th style="${sStatesTh}">Dp °F</th>`);
      H.push(`</tr>`);
      for (const k of entered) {
        const s = snap.computed[k];
        H.push(`<tr>`);
        H.push(`<td style="${sStatesTd};color:${sColors[k]};font-weight:600;">${k} — ${labels[k]}</td>`);
        H.push(`<td style="${sStatesTd}">${s.tdb.toFixed(1)}</td>`);
        H.push(`<td style="${sStatesTd}">${s.twb.toFixed(1)}</td>`);
        H.push(`<td style="${sStatesTd}">${s.rh.toFixed(1)}</td>`);
        H.push(`<td style="${sStatesTd}">${s.gr.toFixed(1)}</td>`);
        H.push(`<td style="${sStatesTd}">${s.h.toFixed(2)}</td>`);
        H.push(`<td style="${sStatesTd}">${Number.isFinite(s.dp) ? s.dp.toFixed(1) : '—'}</td>`);
        H.push(`</tr>`);
      }
      H.push(`</table>`);
    }

    /* Coil process */
    const cp = snap.computed.coilProcess;
    if (cp) {
      H.push(`<div style="${sH}">Coil Process (RA → SA)</div>`);
      H.push(`<table style="${sTbl}">`);
      H.push(`<tr><td style="${sLbl}">Sensible ΔT</td><td style="${sVal}">${fmtF(cp.dT)} (cooling)</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Latent ΔW</td><td style="${sVal}">${fmtGr(cp.dGr)} removed</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Total Δh</td><td style="${sVal}">${fmtEn(cp.dH)}</td></tr>`);
      if (Number.isFinite(cp.shr)) {
        H.push(`<tr><td style="${sLbl}">SHR</td><td style="${sVal}">${cp.shr.toFixed(2)} (sensible fraction)</td></tr>`);
      }
      if (Number.isFinite(cp.qTotalBtuh)) {
        H.push(`<tr><td style="${sLbl}">Sensible Capacity</td><td style="${sVal}">${fmtBtuh(cp.qSensibleBtuh)}</td></tr>`);
        H.push(`<tr><td style="${sLbl}">Latent Capacity</td><td style="${sVal}">${fmtBtuh(cp.qLatentBtuh)}</td></tr>`);
        H.push(`<tr><td style="${sLbl}">Total Capacity</td><td style="${sVal}">${fmtBtuh(cp.qTotalBtuh)}&nbsp;(${cp.capacityTons.toFixed(2)} tons)</td></tr>`);
      }
      H.push(`</table>`);
    }

    /* ADP / BF */
    if (Number.isFinite(snap.computed.adp)) {
      H.push(`<div style="${sH}">Coil Performance</div>`);
      H.push(`<table style="${sTbl}">`);
      H.push(`<tr><td style="${sLbl}">Apparatus Dew Point</td><td style="${sVal};color:#b88a00;">${fmtF(snap.computed.adp)} (effective coil surface)</td></tr>`);
      if (Number.isFinite(snap.computed.bypassFactor)) {
        const bf = snap.computed.bypassFactor;
        let rating = 'typical residential/light commercial';
        if (bf < 0.10) rating = 'high-performance deep-slab';
        else if (bf > 0.25) rating = 'poor — shallow or fouled coil';
        H.push(`<tr><td style="${sLbl}">Bypass Factor</td><td style="${sVal}">${bf.toFixed(2)}&nbsp;(${rating})</td></tr>`);
      }
      H.push(`</table>`);
    }

    /* Economizer */
    const eco = snap.computed.economizer;
    if (eco) {
      H.push(`<div style="${sH}">Economizer Evaluation</div>`);
      H.push(`<table style="${sTbl}">`);
      H.push(`<tr><td style="${sLbl}">Enthalpy (h_OA &lt; h_RA?)</td><td style="${sVal};color:${eco.enthalpyFavorable ? '#3a9a44' : '#888'};">${eco.enthalpyFavorable ? 'FAVORABLE — free cooling available' : 'Not favorable'}</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Dry Bulb (T_OA &lt; T_RA?)</td><td style="${sVal};">${eco.dryBulbFavorable ? 'favorable' : 'not favorable'}</td></tr>`);
      H.push(`<tr><td style="${sLbl}">90.1 High-Limit</td><td style="${sVal};">${eco.highLimitOk ? 'OK (&le; 28 BTU/lb)' : 'above limit — lockout'}</td></tr>`);
      if (eco.savings > 0) {
        H.push(`<tr><td style="${sLbl}">OA Cooling Available</td><td style="${sVal}">${eco.savings.toFixed(2)} BTU/lb</td></tr>`);
      }
      H.push(`</table>`);
    }

    /* Target delta */
    if (Number.isFinite(snap.targetRh) && snap.computed.targetDelta) {
      const td = snap.computed.targetDelta;
      H.push(`<div style="${sH}">Target Delta (vs Return Air)</div>`);
      H.push(`<table style="${sTbl}">`);
      H.push(`<tr><td style="${sLbl}">RH Delta</td><td style="${sVal}">${fmtSgn(td.dRh)} %</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Moisture Delta</td><td style="${sVal}">${fmtSgn(td.dGr)} gr/lb</td></tr>`);
      H.push(`<tr><td style="${sLbl}">Action</td><td style="${sVal}">${td.dRh > 0 ? 'Humidify' : 'Dehumidify'}</td></tr>`);
      H.push(`</table>`);
    }
  }

  /* Chart */
  H.push(`<div style="${sH}">Psychrometric Chart</div>`);
  H.push(`<div style="${sChartBox}">`);
  H.push(buildChartLight({
    pAtm: snap.pAtm,
    states: snap.mode === 'multi' ? snap.computed : {},
    singleState: snap.mode === 'single' ? snap.computed.single : null,
    adp: snap.computed.adp,
    targetRh: snap.targetRh,
    showComfort: snap.showComfort
  }));
  H.push(`</div>`);

  /* Footer */
  H.push(`<p style="${sFooter}">`);
  H.push('ASHRAE Fundamentals 2017 Ch. 1 (Eq. 3 atmospheric pressure, Eq. 5/6 saturation pressure, Eq. 22 humidity ratio, Eq. 32 enthalpy, Eq. 35 wet-bulb); Ch. 23 (apparatus dew point + bypass factor).');
  if (snap.mode === 'multi') H.push('<br>ASHRAE Standard 55-2020 comfort zones · ASHRAE 90.1 economizer high-limit.');
  H.push(`<br>Generated by Project Hermes — om3ni.github.io`);
  H.push(`</p>`);
  H.push(`<\/body><\/html>`);

  return H.join('');
}
