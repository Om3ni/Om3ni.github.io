/*
  tools/shared/recommend.js — "Recommended tools" card for Hermes tool pages.

  Each page loads this once, near the end of <body>, naming itself:
    <script src="../shared/recommend.js" data-tool="refrigeration"></script>
  The card is appended to the page's <main> (or <body>).

  Edit the lists below to change what each tool recommends. Links go to a
  TruTech Tools search for the instrument rather than a single product, so
  they keep working when models are discontinued. Searches were checked to
  return the right kind of instrument (Nov 2026).
*/
(function () {
  var TT = 'https://trutechtools.com/search.php?search_query=';
  var L = {
    manifold:   { label: 'Digital refrigerant manifolds', q: 'digital refrigerant manifold' },
    clamp_t:    { label: 'Pipe clamp thermometers',       q: 'pipe clamp thermometer' },
    vacuum:     { label: 'Micron vacuum gauges',          q: 'vacuum gauge' },
    static_p:   { label: 'Static pressure kits',          q: 'static pressure' },
    manometer:  { label: 'Manometers',                    q: 'manometer' },
    anemometer: { label: 'Anemometers',                   q: 'anemometer' },
    flowhood:   { label: 'Flow hoods',                    q: 'flow hood' },
    psychro:    { label: 'Psychrometers',                 q: 'psychrometer' },
    ir:         { label: 'Infrared thermometers',         q: 'infrared thermometer' },
    thermo:     { label: 'Thermometers',                  q: 'thermometer' },
    clamp:      { label: 'Clamp meters',                  q: 'clamp meter' },
    dmm:        { label: 'Multimeters',                   q: 'multimeter' },
    cap:        { label: 'Meters that measure capacitance', q: 'capacitance' },
    megger:     { label: 'Insulation resistance testers', q: 'insulation tester' },
    combustion: { label: 'Combustion analyzers',          q: 'combustion analyzer' },
    hydronic:   { label: 'Hydronic manometers',           q: 'hydronic manometer' }
  };
  var BY_TOOL = {
    'refrigeration':          ['manifold', 'clamp_t', 'vacuum'],
    'charge-troubleshooting': ['manifold', 'clamp_t', 'static_p'],
    'airflow':                ['static_p', 'anemometer', 'psychro'],
    'psychrometric':          ['psychro', 'thermo'],
    'cfm-per-ton':            ['static_p', 'flowhood', 'anemometer'],
    'duct-sizing':            ['anemometer', 'flowhood', 'static_p'],
    'load-calc':              ['psychro', 'ir'],
    'electrical':             ['clamp', 'dmm'],
    'mca-mocp':               ['clamp', 'dmm'],
    'wire-sizing':            ['clamp', 'dmm'],
    'capacitor-sizing':       ['cap', 'clamp'],
    'ohms-law':               ['dmm', 'clamp'],
    'electrical-cost':        ['clamp'],
    'motors':                 ['megger', 'clamp', 'cap'],
    'heat':                   ['combustion', 'manometer', 'thermo'],
    'gas-pipe':               ['manometer'],
    'system-head':            ['hydronic', 'clamp_t'],
    'temp-convert':           ['thermo', 'ir'],
    'pressure-convert':       ['manometer', 'manifold'],
    'motor-convert':          ['clamp']
  };

  var me = document.currentScript;
  var tool = me && me.getAttribute('data-tool');
  var keys = BY_TOOL[tool];
  if (!keys || !keys.length) return;

  var css = document.createElement('style');
  css.textContent =
    '.h-rec{max-width:640px;margin:22px auto 8px;padding:12px 14px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-sizing:border-box}' +
    '.h-rec h2{margin:0 0 6px;font-family:var(--ui);font-size:.82rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)}' +
    '.h-rec a{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 2px;border-top:1px solid var(--border);color:var(--text);text-decoration:none;font-family:var(--ui);font-size:1rem;font-weight:600}' +
    '.h-rec a:first-of-type{border-top:0}' +
    '.h-rec a span{flex:1}' +
    '.h-rec a small{font-family:var(--mono);font-size:.72rem;font-weight:400;color:var(--text-mute)}' +
    '.h-rec p{margin:6px 2px 0;font-size:.8rem;line-height:1.4;color:var(--text-mute)}';
  document.head.appendChild(css);

  var box = document.createElement('section');
  box.className = 'h-rec';
  box.setAttribute('aria-label', 'Recommended tools');
  var h = document.createElement('h2'); h.textContent = 'Recommended tools'; box.appendChild(h);
  keys.forEach(function (k) {
    var it = L[k]; if (!it) return;
    var a = document.createElement('a');
    a.href = TT + encodeURIComponent(it.q).replace(/%20/g, '+');
    a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = '<span></span><small>TruTech Tools ↗</small>';
    a.firstChild.textContent = it.label;
    box.appendChild(a);
  });
  var p = document.createElement('p');
  p.textContent = 'The right instrument for the readings this tool uses. Opens TruTech Tools in a new tab.';
  box.appendChild(p);

  function place() {
    var host = document.querySelector('main') || document.body;
    if (host === document.body) box.style.margin = '22px 16px 8px';
    // A page can mark an element the card must come before (e.g. a sticky bottom bar).
    var before = host.querySelector('[data-rec-before]');
    if (before) host.insertBefore(box, before); else host.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
})();
