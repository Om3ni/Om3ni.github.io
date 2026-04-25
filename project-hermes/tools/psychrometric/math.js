/* ═══════════════════════════════════════════════════════════════════════════
   Psychrometric math — pure functions, no DOM, no state.
   Source: ASHRAE Handbook—Fundamentals 2017, Chapter 1 (Psychrometrics)
           and Chapter 23 (Air Heating and Cooling Equipment).
   All temperatures °F, pressures psia, humidity ratios lb water / lb dry air,
   enthalpy BTU / lb dry air unless noted.
   ═══════════════════════════════════════════════════════════════════════════ */

export const STD_P_ATM = 14.696; // psia — ASHRAE Table 1, sea level

/* ─── Atmospheric pressure from altitude ─────────────────────────────────────
   ASHRAE Ch. 1 Eq. 3:  p = 14.696 × (1 − 6.8754×10⁻⁶ · Z)^5.2559
   where Z = altitude in ft, p in psia. Valid for troposphere (Z ≤ 36,000 ft). */
export function pressureFromAlt(altFt) {
  if (!Number.isFinite(altFt) || altFt <= 0) return STD_P_ATM;
  return STD_P_ATM * Math.pow(1 - 6.8754e-6 * altFt, 5.2559);
}

/* ─── Saturation pressure of water vapor ─────────────────────────────────────
   ASHRAE Ch. 1:
     Eq. 6 (over liquid water, T ≥ 32°F) — six-term polynomial
     Eq. 5 (over ice, T < 32°F) — seven-term polynomial
   Input: tF in °F.  Output: pws in psia.  Internal T in Rankine.
   Validation: pws(32°F) = 0.0886 psia; pws(70°F) = 0.3632 psia; both match
   NIST steam tables to better than 0.05%. */
export function satPressure(tF) {
  const T = tF + 459.67;
  let lnPws;
  if (tF >= 32) {
    /* Eq. 6 — water */
    lnPws = -1.0440397e4 / T
          + -1.1294650e1
          + -2.7022355e-2 * T
          +  1.2890360e-5 * T * T
          + -2.4780681e-9 * T * T * T
          +  6.5459673    * Math.log(T);
  } else {
    /* Eq. 5 — ice */
    lnPws = -1.0214165e4 / T
          + -4.8932428
          + -5.3765794e-3 * T
          +  1.9202377e-7 * T * T
          +  3.5575832e-10 * T * T * T
          + -9.0344688e-14 * T * T * T * T
          +  4.1635019    * Math.log(T);
  }
  return Math.exp(lnPws);
}

/* ─── Humidity ratio relationships ──────────────────────────────────────────
   ASHRAE Ch. 1:
     Eq. 22: W = 0.62198 · pw / (p − pw)             (from partial pressure)
     Eq. 23: Ws = 0.62198 · pws / (p − pws)          (saturation)
     Eq. 24: pw = RH · pws / 100
     Eq. 35: W = ((1093 − 0.556·twb)·Ws(twb) − 0.240·(tdb − twb))
                 / (1093 + 0.444·tdb − twb)          (from wet-bulb, IP units) */

export function satHumidityRatio(tF, pAtm) {
  const pws = satPressure(tF);
  return 0.62198 * pws / (pAtm - pws);
}

export function humidityRatioFromRh(tdb, rhPct, pAtm) {
  const pws = satPressure(tdb);
  const pw = (rhPct / 100) * pws;
  const w = 0.62198 * pw / (pAtm - pw);
  return Math.max(0, w);
}

export function humidityRatioFromTwb(tdb, twb, pAtm) {
  const wsWb = satHumidityRatio(twb, pAtm);
  const w = ((1093 - 0.556 * twb) * wsWb - 0.240 * (tdb - twb))
          / (1093 + 0.444 * tdb - twb);
  return Math.max(0, w);
}

/* ─── Enthalpy of moist air ─────────────────────────────────────────────────
   ASHRAE Ch. 1 Eq. 32 (IP units):
     h = 0.240·t + W·(1061 + 0.444·t)              [BTU / lb dry air]
   0.240 = cp,air (dry),  0.444 = cp,v (water vapor),  1061 ≈ hfg of water at 0°F */
export function enthalpy(tdb, w) {
  return 0.240 * tdb + w * (1061 + 0.444 * tdb);
}

/* ─── Relative humidity from humidity ratio ─────────────────────────────────
   ASHRAE Ch. 1: μ (degree of saturation) × 100 approximates RH; exact relation
   uses partial pressures. Field-accurate form: RH ≈ W / Ws(tdb) × 100. */
export function rhFromW(tdb, w, pAtm) {
  const wsDb = satHumidityRatio(tdb, pAtm);
  if (wsDb <= 0) return 0;
  return Math.max(0, Math.min(100, (w / wsDb) * 100));
}

/* ─── Dew point temperature ─────────────────────────────────────────────────
   Solve for tdp where Ws(tdp) = W  (air at saturation holds exactly W).
   Monotonic in T, so binary search converges. Range bracketed to [−60, 200]°F. */
export function dewPoint(w, pAtm) {
  let lo = -60, hi = 200, mid = 0;
  for (let i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    if (satHumidityRatio(mid, pAtm) < w) lo = mid;
    else hi = mid;
  }
  return mid;
}

/* ─── Wet-bulb from humidity ratio (inverse of Eq. 35) ──────────────────────
   Binary search: at fixed tdb, W is monotonically increasing in twb (twb ≤ tdb).
   Bracket twb in [−60, tdb]. */
export function wetBulbFromW(tdb, w, pAtm) {
  let lo = -60, hi = tdb, mid = 0;
  for (let i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    const wCalc = humidityRatioFromTwb(tdb, mid, pAtm);
    if (wCalc < w) lo = mid;
    else hi = mid;
  }
  return mid;
}

/* ─── Full state computation from partial input ─────────────────────────────
   Accepts { tdb, twb? | rh? }. Returns null on invalid input, otherwise
   a complete state: { tdb, twb, rh, w, h, dp, gr }. */
export function computeState(input, pAtm) {
  if (input == null || !Number.isFinite(input.tdb)) return null;
  const tdb = input.tdb;
  let w;
  if (Number.isFinite(input.twb)) {
    if (input.twb > tdb + 0.1) return null; // wet-bulb must be ≤ dry-bulb
    w = humidityRatioFromTwb(tdb, Math.min(input.twb, tdb), pAtm);
  } else if (Number.isFinite(input.rh)) {
    if (input.rh < 0 || input.rh > 100) return null;
    w = humidityRatioFromRh(tdb, input.rh, pAtm);
  } else {
    return null;
  }
  const h = enthalpy(tdb, w);
  const rh = rhFromW(tdb, w, pAtm);
  const twb = Number.isFinite(input.twb) ? input.twb : wetBulbFromW(tdb, w, pAtm);
  const dp = w > 0 ? dewPoint(w, pAtm) : tdb;
  return { tdb, twb, rh, w, h, dp, gr: w * 7000 };
}

/* ─── Adiabatic mixing of two moist air streams ─────────────────────────────
   ASHRAE Ch. 1, "Adiabatic Mixing of Two Moist Airstreams":
     Conservation of dry-air mass, water vapor mass, and enthalpy gives
       W_mix = x·W_OA + (1−x)·W_RA
       h_mix = x·h_OA + (1−x)·h_RA
     where x = (mass flow of OA) / (total mass flow of dry air).
   Solve Eq. 32 back for tdb given h and W:
       h = 0.240·t + W·(1061 + 0.444·t)
       t = (h − 1061·W) / (0.240 + 0.444·W)                                   */
export function mixStates(stateOA, stateRA, oaFraction, pAtm) {
  if (stateOA == null || stateRA == null) return null;
  if (!Number.isFinite(oaFraction) || oaFraction < 0 || oaFraction > 1) return null;
  const x = oaFraction;
  const wMix = x * stateOA.w + (1 - x) * stateRA.w;
  const hMix = x * stateOA.h + (1 - x) * stateRA.h;
  const tMix = (hMix - 1061 * wMix) / (0.240 + 0.444 * wMix);
  return {
    tdb: tMix,
    twb: wetBulbFromW(tMix, wMix, pAtm),
    rh:  rhFromW(tMix, wMix, pAtm),
    w:   wMix,
    h:   hMix,
    dp:  wMix > 0 ? dewPoint(wMix, pAtm) : tMix,
    gr:  wMix * 7000
  };
}

/* ─── Coil process (RA → SA) ────────────────────────────────────────────────
   Per-unit-mass deltas across the coil (sensible, latent, total). If CFM is
   given, also computes BTU/h capacity using the common field shortcuts:
     q_sens  = 1.08 · CFM · ΔT      [BTU/h]  (≈ 0.240 · 60 · 0.075)
     q_lat   = 4840 · CFM · ΔW      [BTU/h]  (≈ 1061 · 60 · 0.075)
             = 0.68 · CFM · Δgr     [BTU/h]  (≈ 4840 / 7000)
     q_total = 4.5  · CFM · Δh      [BTU/h]  (≈ 60 · 0.075)
   The constants assume standard dry-air density 0.075 lb/cf at 70°F, sea level.
   For altitude / non-standard conditions, scale by (ρ_actual / 0.075).
   Sensible Heat Ratio: SHR = q_sens / q_total (dimensionless). */
export function coilProcess(stateRA, stateSA, cfm, pAtm) {
  if (stateRA == null || stateSA == null) return null;
  const dT  = stateRA.tdb - stateSA.tdb;  // + = cooling
  const dW  = stateRA.w   - stateSA.w;    // + = dehumidifying
  const dGr = dW * 7000;
  const dH  = stateRA.h   - stateSA.h;    // + = total cooling

  const result = { dT, dW, dGr, dH };
  result.shr = dH > 0 ? (0.240 * dT) / dH : null;

  if (Number.isFinite(cfm) && cfm > 0) {
    /* Altitude-corrected density factor: ρ(p) ≈ ρ₀ · (p / p₀) at constant T */
    const densityFactor = Number.isFinite(pAtm) ? pAtm / STD_P_ATM : 1;
    result.qSensibleBtuh = 1.08 * cfm * dT  * densityFactor;
    result.qLatentBtuh   = 4840 * cfm * dW  * densityFactor;
    result.qTotalBtuh    = 4.5  * cfm * dH  * densityFactor;
    result.capacityTons  = result.qTotalBtuh / 12000;
    result.densityFactor = densityFactor;
  }
  return result;
}

/* ─── Apparatus Dew Point (ADP) ─────────────────────────────────────────────
   ASHRAE Ch. 23 (Air Heating and Cooling Equipment):
     The coil process line from RA to SA extended forward intersects the
     saturation curve at the apparatus dew point. ADP is the effective average
     coil surface temperature; if all air contacted the coil, it would leave
     saturated at ADP.
   Line: W(T) = m·T + b,  m = (W_SA − W_RA)/(T_SA − T_RA),  b = W_RA − m·T_RA
   Solve f(T) = W_line(T) − Ws(T) = 0  by binary search.
   For a well-conditioned cooling process, f is negative at T_SA (air is below
   saturation) and positive at sufficiently low T (line above saturation curve);
   zero crossing is the ADP. */
export function apparatusDewPoint(stateRA, stateSA, pAtm) {
  if (stateRA == null || stateSA == null) return null;

  /* Guard against non-cooling processes: ADP only defined when the coil is
     removing sensible AND (non-negative) latent heat, i.e. T_RA > T_SA and
     W_RA ≥ W_SA. Reject humidification / reheat inputs. */
  const dT = stateRA.tdb - stateSA.tdb;  // positive for cooling
  const dW = stateRA.w   - stateSA.w;    // non-negative for cooling
  if (dT < 0.01) return null;
  if (dW < -1e-6) return null;

  /* Process line: W_line(T) = m·T + b, with m ≥ 0 for cooling. */
  const m = (stateSA.w - stateRA.w) / (stateSA.tdb - stateRA.tdb);
  const b = stateRA.w - m * stateRA.tdb;
  const fLine = (T) => (m * T + b) - satHumidityRatio(T, pAtm);

  /* At T_SA, SA is below saturation → fLine < 0. March downward in 1°F steps
     until fLine > 0 (line has crossed above the saturation curve — past ADP).
     First zero crossing while walking down is the physically meaningful ADP;
     a secondary crossing at very cold T (where W_line approaches 0) is
     non-physical and never reached because we stop at the first sign change. */
  let hi = stateSA.tdb;
  let fHi = fLine(hi);
  if (fHi >= 0) return null;  // SA at/above saturation — no extrapolation needed

  let lo = hi - 1;
  let fLo = fLine(lo);
  const minLo = stateSA.tdb - 80;  // hard limit: ADP > T_SA - 80°F
  while (fLo <= 0 && lo > minLo) {
    hi = lo; fHi = fLo;
    lo -= 1;
    fLo = fLine(lo);
  }
  if (fLo <= 0) return null;  // no crossing within 80°F — unexpected for real coils

  /* Binary search the bracket [lo (f>0), hi (f<0)] for ADP. */
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const f = fLine(mid);
    if (f <= 0) hi = mid;
    else        lo = mid;
  }
  return (lo + hi) / 2;
}

/* ─── Bypass Factor ─────────────────────────────────────────────────────────
   ASHRAE Ch. 23:  BF = (T_SA − T_ADP) / (T_RA − T_ADP)
   Fraction of air that passes through the coil "as if" bypassing the surface.
   Lower = better coil performance. Typical ranges:
     0.05–0.10  high-performance deep-slab coils
     0.10–0.20  typical residential / light commercial
     0.20–0.30  shallow or fouled coils */
export function bypassFactor(stateRA, stateSA, tADP) {
  if (stateRA == null || stateSA == null || !Number.isFinite(tADP)) return null;
  const denom = stateRA.tdb - tADP;
  if (Math.abs(denom) < 0.01) return null;
  const bf = (stateSA.tdb - tADP) / denom;
  return Math.max(0, Math.min(1, bf));
}

/* ─── Economizer evaluation ─────────────────────────────────────────────────
   Two common changeover strategies:
     Differential enthalpy:  use OA whenever h_OA < h_RA       (best)
     Differential dry-bulb:  use OA whenever T_OA < T_RA       (simpler, less accurate)
   ASHRAE 90.1 requires an upper-bound cutoff (high-limit lockout) regardless:
     typical: h_OA > 28 BTU/lb  or  T_OA > ~75°F forces minimum OA only.           */
export function economizerStatus(stateOA, stateRA) {
  if (stateOA == null || stateRA == null) return null;
  return {
    enthalpyFavorable: stateOA.h < stateRA.h,
    dryBulbFavorable:  stateOA.tdb < stateRA.tdb,
    highLimitOk:       stateOA.h <= 28,   // ASHRAE 90.1 typical high-limit
    savings:           Math.max(0, stateRA.h - stateOA.h) // BTU/lb if OA free cooling
  };
}

/* ─── ASHRAE Standard 55-2020 comfort zones ─────────────────────────────────
   Simplified polygons (tdb, rh) on the psychrometric chart. Actual standard
   is PMV/PPD based with clo + met + air speed inputs; these are the typical
   bounds at 0.5 clo summer / 1.0 clo winter, 1.1 met, still air.
   Upper-RH edge rolls off because wet-bulb comfort limit is ~68°F.          */
export const COMFORT_ZONES = {
  cooling: {
    label: 'Cooling (summer) — 0.5 clo',
    points: [
      { tdb: 73.0, rh: 30 },
      { tdb: 79.0, rh: 30 },
      { tdb: 79.0, rh: 55 },
      { tdb: 75.5, rh: 65 },
      { tdb: 73.0, rh: 70 }
    ]
  },
  heating: {
    label: 'Heating (winter) — 1.0 clo',
    points: [
      { tdb: 67.0, rh: 30 },
      { tdb: 76.0, rh: 30 },
      { tdb: 76.0, rh: 55 },
      { tdb: 72.5, rh: 65 },
      { tdb: 67.0, rh: 70 }
    ]
  }
};
