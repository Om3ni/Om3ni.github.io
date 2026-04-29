/* ═══════════════════════════════════════════════════════════════════════════
   Psychrometric chart renderer — pure functions producing SVG strings.
   Shared geometry + math; two style themes (dark for in-app, light for email).
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  satPressure, satHumidityRatio, humidityRatioFromRh, humidityRatioFromTwb,
  COMFORT_ZONES
} from './math.js';

/* ─── Chart geometry ────────────────────────────────────────────────────── */
const C = {
  X_MIN: 40,  X_MAX: 110,        // dry-bulb °F
  Y_MIN: 0,   Y_MAX: 0.030,      // humidity ratio lb/lb (= 210 gr/lb)
  VB_W: 420,  VB_H: 300,
  PAD_L: 30,  PAD_R: 56, PAD_T: 14, PAD_B: 34
};
const RH_MAJOR = [20, 40, 60, 80];
const RH_MINOR = [10, 30, 50, 70, 90];
const WB_LINES = [40, 50, 60, 70, 80];

/* ─── State colors — dark + light pairs ────────────────────────────────── */
const STATE_COLORS = {
  RA:  { dark: '#e8702f', light: '#c8553d' },     // orange
  SA:  { dark: '#4ec9b0', light: '#2a8d7a' },     // teal
  OA:  { dark: '#6fc876', light: '#3a9a44' },     // green
  MA:  { dark: '#b987d6', light: '#7a4fa0' },     // purple
  ADP: { dark: '#ffd166', light: '#b88a00' },     // amber
  TGT: { dark: '#e86d10', light: '#c85a00' }      // orange (matches project accent + RA)
};

/* ─── Shared helpers ───────────────────────────────────────────────────── */
function transforms() {
  const plotW = C.VB_W - C.PAD_L - C.PAD_R;
  const plotH = C.VB_H - C.PAD_T - C.PAD_B;
  const x1 = C.PAD_L, y1 = C.PAD_T, x2 = C.VB_W - C.PAD_R, y2 = C.VB_H - C.PAD_B;
  return {
    x1, y1, x2, y2, plotW, plotH,
    tx: (t) => x1 + ((t - C.X_MIN) / (C.X_MAX - C.X_MIN)) * plotW,
    ty: (W) => y2 - ((W - C.Y_MIN) / (C.Y_MAX - C.Y_MIN)) * plotH,
  };
}

function clipToPlot(pts) {
  const out = [];
  for (const p of pts) {
    const inside = p[0] >= C.X_MIN && p[0] <= C.X_MAX && p[1] >= C.Y_MIN && p[1] <= C.Y_MAX;
    if (inside) out.push(p);
    else if (out.length) break;     // first exit stops; reentrant curves not needed for our data
  }
  return out;
}

function pathD(T, pts) {
  if (!pts.length) return '';
  let d = 'M' + T.tx(pts[0][0]).toFixed(1) + ' ' + T.ty(pts[0][1]).toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    d += 'L' + T.tx(pts[i][0]).toFixed(1) + ' ' + T.ty(pts[i][1]).toFixed(1);
  }
  return d;
}

/* ─── Curve generators (pure) ──────────────────────────────────────────── */
function rhCurvePts(rhPct, pAtm) {
  const pts = [];
  for (let t = C.X_MIN; t <= C.X_MAX; t += 1) {
    pts.push([t, humidityRatioFromRh(t, rhPct, pAtm)]);
  }
  return pts;
}
function satCurvePts(pAtm) {
  const pts = [];
  for (let t = C.X_MIN; t <= C.X_MAX; t += 1) {
    pts.push([t, satHumidityRatio(t, pAtm)]);
  }
  return pts;
}
function wbCurvePts(twb, pAtm) {
  const pts = [];
  const wsWb = satHumidityRatio(twb, pAtm);
  for (let t = twb; t <= C.X_MAX; t += 1) {
    const W = ((1093 - 0.556 * twb) * wsWb - 0.240 * (t - twb))
            / (1093 + 0.444 * t - twb);
    pts.push([t, Math.max(0, W)]);
  }
  return pts;
}
function comfortPolygonPts(zone, pAtm) {
  return zone.points.map(p => [p.tdb, humidityRatioFromRh(p.tdb, p.rh, pAtm)]);
}

/* ─── Theme definitions ────────────────────────────────────────────────── */
const FONT = "ui-monospace,Menlo,'Liberation Mono',Consolas,monospace";

const DARK_THEME = {
  id: 'dark',
  useClasses: true,
  svgOpenAttrs: 'class="psy-chart"',
  arrowIdPrefix: 'psy-arr-d-',
  styles: {} // unused for dark; CSS classes live in host HTML
};

const LIGHT_THEME = {
  id: 'light',
  useClasses: false,
  svgOpenAttrs: `width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:620px;margin:0 auto;background:#fdfaf5;"`,
  arrowIdPrefix: 'psy-arr-l-',
  styles: {
    axis:       `stroke:#444;stroke-width:0.8;fill:none`,
    axisTick:   `stroke:#555;stroke-width:0.5;fill:none`,
    axisLabel:  `fill:#555;font-family:${FONT};font-size:7px`,
    axisTitle:  `fill:#777;font-family:${FONT};font-size:6.5px;letter-spacing:0.08em;text-transform:uppercase`,
    satCurve:   `stroke:#c8553d;stroke-width:1.4;fill:none`,
    satLabel:   `fill:#c8553d;font-family:${FONT};font-size:6.5px;font-weight:600`,
    rhCurve:    `stroke:#888;stroke-width:0.5;stroke-dasharray:3,2;fill:none;opacity:0.65`,
    rhCurveMin: `stroke:#aaa;stroke-width:0.35;stroke-dasharray:2,2.5;fill:none;opacity:0.45`,
    rhLabel:    `fill:#777;font-family:${FONT};font-size:5.5px`,
    wbLine:     `stroke:#bbb;stroke-width:0.4;stroke-dasharray:1.5,1.5;fill:none;opacity:0.6`,
    wbLabel:    `fill:#999;font-family:${FONT};font-size:5px`,
    comfortCool:`fill:#c85a00;opacity:0.10;stroke:#c85a00;stroke-width:0.4;stroke-dasharray:3,2`,
    comfortHeat:`fill:#e8a04a;opacity:0.10;stroke:#e8a04a;stroke-width:0.4;stroke-dasharray:3,2`,
    comfortLabel:`fill:#666;font-family:${FONT};font-size:5.5px;font-weight:600`,
    targetCurve:`stroke:#c85a00;stroke-width:1.0;stroke-dasharray:2,2;fill:none`,
    targetLabel:`fill:#c85a00;font-family:${FONT};font-size:6px;font-weight:600`,
    deltaLine:  `stroke:#c85a00;stroke-width:0.6;stroke-dasharray:1,2;fill:none;opacity:0.85`,
    targetPt:   `fill:#c85a00;stroke:#fff;stroke-width:0.6`,
    adpLine:    `stroke:#b88a00;stroke-width:0.8;stroke-dasharray:3,2;fill:none;opacity:0.9`,
    adpPoint:   `fill:#b88a00;stroke:#fff;stroke-width:0.6`,
    adpLabel:   `fill:#b88a00;font-family:${FONT};font-size:6px;font-weight:600`,
    processLine:`stroke-width:1.3;fill:none`,
    mixLine:    `stroke:#3a9a44;stroke-width:0.8;stroke-dasharray:4,2;fill:none;opacity:0.8`,
    stateLabel: `font-family:${FONT};font-size:6.5px;font-weight:700`,
    stateCross: `stroke-width:0.5;stroke-dasharray:2,1.5;fill:none;opacity:0.7`
  }
};

/* Attribute resolver — picks class or inline style per element "type". */
function attrs(theme, type, extra = '') {
  if (theme.useClasses) {
    return `class="${type}"${extra ? ' ' + extra : ''}`;
  }
  const style = theme.styles[type];
  return `style="${style}${extra ? ';' + extra : ''}"`;
}

/* ─── Theme color picker for state dots ────────────────────────────────── */
function stateColor(themeId, key) {
  const c = STATE_COLORS[key];
  if (!c) return '#999';
  return c[themeId] || c.dark;
}

/* ─── Arrow marker defs ────────────────────────────────────────────────── */
function arrowMarkers(theme) {
  /* Define color-matched arrowheads per state pair. Unique IDs per theme. */
  const colors = {
    process: stateColor(theme.id, 'SA'),   // coil process arrow head matches SA (destination)
    mix:     stateColor(theme.id, 'MA')    // mixing arrow head matches MA
  };
  const defs = [];
  for (const [key, fill] of Object.entries(colors)) {
    defs.push(
      `<marker id="${theme.arrowIdPrefix}${key}" viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 Z" fill="${fill}"/>
      </marker>`
    );
  }
  return `<defs>${defs.join('')}</defs>`;
}

/* ─── Main render ───────────────────────────────────────────────────────── */
export function buildChart(input, theme = DARK_THEME) {
  const T = transforms();
  const { pAtm = 14.696, states = {}, adp = null, targetRh = null,
          showComfort = false, singleState = null } = input || {};
  const svg = [];

  svg.push(arrowMarkers(theme));

  /* ── Comfort zones (bottom layer) ── */
  if (showComfort) {
    for (const [zoneKey, zone] of Object.entries(COMFORT_ZONES)) {
      const pts = comfortPolygonPts(zone, pAtm);
      const points = pts.map(p => `${T.tx(p[0]).toFixed(1)},${T.ty(p[1]).toFixed(1)}`).join(' ');
      const cls = zoneKey === 'cooling' ? 'comfortCool' : 'comfortHeat';
      svg.push(`<polygon points="${points}" ${attrs(theme, cls)}/>`);
      /* Label at polygon centroid */
      const cx = pts.reduce((s, p) => s + T.tx(p[0]), 0) / pts.length;
      const cy = pts.reduce((s, p) => s + T.ty(p[1]), 0) / pts.length;
      const lbl = zoneKey === 'cooling' ? 'COOL COMFORT' : 'HEAT COMFORT';
      svg.push(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" ${attrs(theme, 'comfortLabel')}>${lbl}</text>`);
    }
  }

  /* ── Wet-bulb diagonals ── */
  for (const twb of WB_LINES) {
    const clipped = clipToPlot(wbCurvePts(twb, pAtm));
    if (clipped.length < 2) continue;
    svg.push(`<path d="${pathD(T, clipped)}" ${attrs(theme, 'wbLine')}/>`);
    const lp = clipped[0];
    svg.push(`<text x="${(T.tx(lp[0]) + 1).toFixed(1)}" y="${(T.ty(lp[1]) - 1).toFixed(1)}" ${attrs(theme, 'wbLabel')}>${twb}°wb</text>`);
  }

  /* ── Minor RH curves (10/30/50/70/90) — no labels ── */
  for (const rh of RH_MINOR) {
    const clipped = clipToPlot(rhCurvePts(rh, pAtm));
    if (clipped.length > 1) svg.push(`<path d="${pathD(T, clipped)}" ${attrs(theme, 'rhCurveMin')}/>`);
  }
  /* ── Major RH curves (20/40/60/80) — labeled ── */
  for (const rh of RH_MAJOR) {
    const clipped = clipToPlot(rhCurvePts(rh, pAtm));
    if (clipped.length < 2) continue;
    svg.push(`<path d="${pathD(T, clipped)}" ${attrs(theme, 'rhCurve')}/>`);
    const ep = clipped[clipped.length - 1];
    svg.push(`<text x="${(T.tx(ep[0]) - 2).toFixed(1)}" y="${(T.ty(ep[1]) - 2).toFixed(1)}" text-anchor="end" ${attrs(theme, 'rhLabel')}>${rh}%</text>`);
  }

  /* ── Saturation curve ── */
  const satClipped = clipToPlot(satCurvePts(pAtm));
  if (satClipped.length > 1) {
    svg.push(`<path d="${pathD(T, satClipped)}" ${attrs(theme, 'satCurve')}/>`);
    const sep = satClipped[satClipped.length - 1];
    svg.push(`<text x="${(T.tx(sep[0]) - 2).toFixed(1)}" y="${(T.ty(sep[1]) - 3).toFixed(1)}" text-anchor="end" ${attrs(theme, 'satLabel')}>100% (sat)</text>`);
  }

  /* ── Axes + ticks ── */
  svg.push(`<line x1="${T.x1}" y1="${T.y2}" x2="${T.x2}" y2="${T.y2}" ${attrs(theme, 'axis')}/>`);
  svg.push(`<line x1="${T.x2}" y1="${T.y1}" x2="${T.x2}" y2="${T.y2}" ${attrs(theme, 'axis')}/>`);
  for (let xt = C.X_MIN; xt <= C.X_MAX; xt += 10) {
    const sx = T.tx(xt);
    svg.push(`<line x1="${sx}" y1="${T.y2}" x2="${sx}" y2="${T.y2 + 3}" ${attrs(theme, 'axisTick')}/>`);
    svg.push(`<text x="${sx}" y="${T.y2 + 11}" text-anchor="middle" ${attrs(theme, 'axisLabel')}>${xt}</text>`);
  }
  svg.push(`<text x="${T.x1 + T.plotW / 2}" y="${C.VB_H - 4}" text-anchor="middle" ${attrs(theme, 'axisTitle')}>DRY BULB °F</text>`);
  for (let gr = 0; gr <= 210; gr += 30) {
    const sy = T.ty(gr / 7000);
    svg.push(`<line x1="${T.x2}" y1="${sy}" x2="${T.x2 + 3}" y2="${sy}" ${attrs(theme, 'axisTick')}/>`);
    svg.push(`<text x="${T.x2 + 5}" y="${sy + 2.5}" ${attrs(theme, 'axisLabel')}>${gr}</text>`);
  }
  svg.push(`<text x="${T.x2 + 5}" y="${T.y1 - 3}" ${attrs(theme, 'axisTitle')}>gr/lb</text>`);

  /* ── Target RH curve + delta to state ── */
  if (Number.isFinite(targetRh) && targetRh > 0 && targetRh < 100) {
    const tgtPts = clipToPlot(rhCurvePts(targetRh, pAtm));
    if (tgtPts.length > 1) {
      svg.push(`<path d="${pathD(T, tgtPts)}" ${attrs(theme, 'targetCurve')}/>`);
      const ep = tgtPts[tgtPts.length - 1];
      svg.push(`<text x="${(T.tx(ep[0]) - 2).toFixed(1)}" y="${(T.ty(ep[1]) - 3).toFixed(1)}" text-anchor="end" ${attrs(theme, 'targetLabel')}>TGT ${targetRh.toFixed(0)}%</text>`);
      /* Delta line: from primary (RA or single) state down/up to target W at same tdb */
      const ref = singleState || states.RA;
      if (ref && Number.isFinite(ref.tdb) && Number.isFinite(ref.w)
          && ref.tdb >= C.X_MIN && ref.tdb <= C.X_MAX) {
        const tgtW = humidityRatioFromRh(ref.tdb, targetRh, pAtm);
        if (tgtW <= C.Y_MAX && ref.w <= C.Y_MAX) {
          const psx = T.tx(ref.tdb);
          svg.push(`<line x1="${psx}" y1="${T.ty(ref.w).toFixed(1)}" x2="${psx}" y2="${T.ty(tgtW).toFixed(1)}" ${attrs(theme, 'deltaLine')}/>`);
          svg.push(`<circle cx="${psx}" cy="${T.ty(tgtW).toFixed(1)}" r="2.5" ${attrs(theme, 'targetPt')}/>`);
        }
      }
    }
  }

  /* ── ADP projection ── */
  if (Number.isFinite(adp) && states.RA && states.SA) {
    const saT = states.SA.tdb, saW = states.SA.w;
    /* Compute ADP W on saturation curve */
    const adpW = satHumidityRatio(adp, pAtm);
    if (adp >= C.X_MIN && saT >= C.X_MIN && saT <= C.X_MAX && saW <= C.Y_MAX) {
      /* Dashed line from SA to ADP along the extrapolated process line */
      svg.push(`<line x1="${T.tx(saT).toFixed(1)}" y1="${T.ty(saW).toFixed(1)}" x2="${T.tx(adp).toFixed(1)}" y2="${T.ty(adpW).toFixed(1)}" ${attrs(theme, 'adpLine')}/>`);
      svg.push(`<circle cx="${T.tx(adp).toFixed(1)}" cy="${T.ty(adpW).toFixed(1)}" r="2.8" ${attrs(theme, 'adpPoint')}/>`);
      svg.push(`<text x="${(T.tx(adp) + 4).toFixed(1)}" y="${(T.ty(adpW) + 3).toFixed(1)}" ${attrs(theme, 'adpLabel')}>ADP ${adp.toFixed(1)}°F</text>`);
    }
  }

  /* ── Process arrow: RA → SA ── */
  if (states.RA && states.SA
      && Number.isFinite(states.RA.tdb) && Number.isFinite(states.SA.tdb)) {
    const color = stateColor(theme.id, 'SA');
    const extra = `stroke="${color}" marker-end="url(#${theme.arrowIdPrefix}process)"`;
    svg.push(`<line x1="${T.tx(states.RA.tdb).toFixed(1)}" y1="${T.ty(states.RA.w).toFixed(1)}" x2="${T.tx(states.SA.tdb).toFixed(1)}" y2="${T.ty(states.SA.w).toFixed(1)}" ${attrs(theme, 'processLine', extra)}/>`);
  }

  /* ── Mixing line: RA→MA and OA→MA ── */
  if (states.MA && states.OA && states.RA) {
    /* Short segments connecting RA and OA to the mixed-air point */
    svg.push(`<line x1="${T.tx(states.OA.tdb).toFixed(1)}" y1="${T.ty(states.OA.w).toFixed(1)}" x2="${T.tx(states.MA.tdb).toFixed(1)}" y2="${T.ty(states.MA.w).toFixed(1)}" ${attrs(theme, 'mixLine')}/>`);
    svg.push(`<line x1="${T.tx(states.RA.tdb).toFixed(1)}" y1="${T.ty(states.RA.w).toFixed(1)}" x2="${T.tx(states.MA.tdb).toFixed(1)}" y2="${T.ty(states.MA.w).toFixed(1)}" ${attrs(theme, 'mixLine')}/>`);
  }

  /* ── State points ── */
  const renderPoints = [];
  if (singleState) renderPoints.push(['RA', singleState, true]);
  else {
    for (const key of ['RA', 'SA', 'OA', 'MA']) {
      if (states[key]) renderPoints.push([key, states[key], key === 'RA']);
    }
  }
  for (const [key, st, isPrimary] of renderPoints) {
    if (!Number.isFinite(st.tdb) || !Number.isFinite(st.w)) continue;
    if (st.tdb < C.X_MIN || st.tdb > C.X_MAX || st.w < C.Y_MIN || st.w > C.Y_MAX) continue;
    const psx = T.tx(st.tdb), psy = T.ty(st.w);
    const color = stateColor(theme.id, key);
    /* Crosshair only on the primary state (RA or single) to avoid clutter */
    if (isPrimary) {
      svg.push(`<line x1="${psx}" y1="${psy}" x2="${psx}" y2="${T.y2}" ${attrs(theme, 'stateCross', `stroke="${color}"`)}/>`);
      svg.push(`<line x1="${psx}" y1="${psy}" x2="${T.x2}" y2="${psy}" ${attrs(theme, 'stateCross', `stroke="${color}"`)}/>`);
    }
    svg.push(`<circle cx="${psx}" cy="${psy}" r="${isPrimary ? 3.8 : 3.2}" fill="${color}" stroke="${theme.useClasses ? 'var(--text)' : '#fff'}" stroke-width="0.8"/>`);
    /* Tag label right of point */
    svg.push(`<text x="${(psx + 5).toFixed(1)}" y="${(psy + 2.5).toFixed(1)}" fill="${color}" ${attrs(theme, 'stateLabel')}>${key}</text>`);
  }

  return `<svg viewBox="0 0 ${C.VB_W} ${C.VB_H}" xmlns="http:/\/www.w3.org/2000/svg" ${theme.svgOpenAttrs}>${svg.join('')}<\/svg>`;
}

export function buildChartDark(input)  { return buildChart(input, DARK_THEME);  }
export function buildChartLight(input) { return buildChart(input, LIGHT_THEME); }
