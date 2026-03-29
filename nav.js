/* ══════════════════════════════════════════════
   om3ni.github.io — nav.js
   Injects persistent sidebar on every page.

   Usage — add to every page <body>:
     <script src="/nav.js"></script>

   Active page detection:
     Set window.NAV_ACTIVE to the link href
     before including this script, e.g.:
     <script>window.NAV_ACTIVE = '/Grundfos/cu352/';</script>
     <script src="/nav.js"></script>

   Scroll-spy sections (optional):
     Set window.NAV_SECTIONS = true on pages
     that want in-page anchor highlighting.
   ══════════════════════════════════════════════ */

(function () {

  /* ── Nav data ────────────────────────────────
     Each group: { label, id, links[] }
     Each link:  { text, href, sub? }
  ────────────────────────────────────────────── */
  const NAV = [
    {
      label: 'Home',
      id: 'home',
      open: false,
      links: [
        { text: 'Site Hub',              href: '/' },
      ]
    },
    {
      label: 'Project Hermes',
      id: 'hvac',
      open: false,
      links: [
        { text: 'Project Hermes',        href: '/hvactooling/' },
        { text: 'Refrigeration',         href: '/hvactooling/tools/refrigeration.html', sub: true },
        { text: 'Airflow',               href: '/hvactooling/tools/airflow.html',       sub: true },
        { text: 'Heat',                  href: '/hvactooling/tools/heat.html',          sub: true },
        { text: 'Electrical',            href: '/hvactooling/tools/electrical.html',    sub: true },
        { text: 'Motors',                href: '/hvactooling/tools/motors.html',        sub: true },
        { text: '— Calculators —',       href: null, sub: true, divider: true },
        { text: 'Belt Length',           href: '/hvactooling/tools/calculators/belt-length.html',       sub: true },
        { text: 'Breaker Sizing',        href: '/hvactooling/tools/calculators/breaker-sizing.html',    sub: true },
        { text: 'Capacitor Sizing',      href: '/hvactooling/tools/calculators/capacitor-sizing.html',  sub: true },
        { text: 'CFM per Ton',           href: '/hvactooling/tools/calculators/cfm-per-ton.html',       sub: true },
        { text: 'Combustion Air',        href: '/hvactooling/tools/calculators/combustion-air.html',    sub: true },
        { text: 'Condensate Drain',      href: '/hvactooling/tools/calculators/condensate-drain.html',  sub: true },
        { text: 'Duct Sizing',           href: '/hvactooling/tools/calculators/duct-sizing.html',       sub: true },
        { text: 'Electrical Cost',       href: '/hvactooling/tools/calculators/electrical-cost.html',   sub: true },
        { text: 'Enthalpy',              href: '/hvactooling/tools/calculators/enthalpy.html',          sub: true },
        { text: 'Gas Pipe',              href: '/hvactooling/tools/calculators/gas-pipe.html',          sub: true },
        { text: 'Load Calc',             href: '/hvactooling/tools/calculators/load-calc.html',         sub: true },
        { text: 'Long Lineset',          href: '/hvactooling/tools/calculators/long-lineset.html',      sub: true },
        { text: 'MCA / MOCP',            href: '/hvactooling/tools/calculators/mca-mocp.html',          sub: true },
        { text: 'Motor Convert',         href: '/hvactooling/tools/calculators/motor-convert.html',     sub: true },
        { text: "Ohm's Law",             href: '/hvactooling/tools/calculators/ohms-law.html',          sub: true },
        { text: 'Pressure Convert',      href: '/hvactooling/tools/calculators/pressure-convert.html',  sub: true },
        { text: 'Refrigerant Charge',    href: '/hvactooling/tools/calculators/refrigerant-charge.html',sub: true },
        { text: 'Temp Convert',          href: '/hvactooling/tools/calculators/temp-convert.html',      sub: true },
        { text: 'Wire Sizing',           href: '/hvactooling/tools/calculators/wire-sizing.html',       sub: true },
      ]
    },
    {
      label: 'Samsung',
      id: 'samsung',
      open: false,
      links: [
        { text: 'DVM S2 — Compressor Ref', href: '/dvms/' },
      ]
    },
    {
      label: 'Grundfos',
      id: 'grundfos',
      open: false,
      links: [
        { text: 'Overview',              href: '/Grundfos/' },
        { text: 'CU 352 — Access Guide', href: '/Grundfos/cu352/',     sub: true },
        { text: 'CU 352 — Service Instr',href: '/Grundfos/cu352/si.html', sub: true },
        { text: 'Resources',             href: '/Grundfos/resources/', sub: true },
      ]
    },
  ];

  /* ── Build HTML ──────────────────────────────*/
  function buildNav() {
    const active = window.NAV_ACTIVE || '';

    let html = `
      <div class="nav-brand">
        <div class="nav-brand-eye">Field Reference</div>
        <div class="nav-brand-title">Om3ni<span>.</span>io</div>
        <div class="nav-brand-sub">HVAC Field Tools &amp; Reference</div>
        <button class="nav-theme-btn" id="nav-theme-btn" onclick="navToggleTheme()">
          <span id="nav-theme-icon">☀</span>
          <span id="nav-theme-lbl">Light Mode</span>
        </button>
      </div>`;

    NAV.forEach(group => {
      // Auto-open the group that contains the active page
      const groupActive = group.links.some(l => l.href && active.startsWith(l.href));
      const isOpen = groupActive || group.open;

      html += `<div class="nav-section">${group.label}</div>`;
      html += `<div class="nav-group-toggle${isOpen ? ' open' : ''}" onclick="navToggleGroup('${group.id}')">
        ${group.label}
        <span class="nav-toggle-arrow">▶</span>
      </div>`;
      html += `<div class="nav-group-items${isOpen ? ' open' : ''}" id="nav-group-${group.id}">`;

      group.links.forEach(link => {
        if (link.divider) {
          html += `<div style="font-family:var(--mono);font-size:.55rem;color:var(--text-mute);padding:6px 22px 2px;letter-spacing:.1em;opacity:.6;">${link.text}</div>`;
          return;
        }
        const isActive = link.href && (active === link.href || active.startsWith(link.href) && link.href !== '/');
        const classes = ['nav-active' ? isActive : '', link.sub ? 'nav-sub' : ''].filter(Boolean).join(' ');
        html += `<a href="${link.href}"${isActive ? ' class="nav-active' + (link.sub ? ' nav-sub' : '') + '"' : (link.sub ? ' class="nav-sub"' : '')}>${link.text}</a>`;
      });

      html += `</div>`;
    });

    html += `
      <div class="nav-footer">
        om3ni.github.io<br>
        HVAC Field Tools<br>
        Field reference — verify before use
      </div>`;

    return html;
  }

  /* ── Inject ──────────────────────────────────*/
  function inject() {
    // Create nav element
    const nav = document.createElement('nav');
    nav.id = 'site-nav';
    nav.innerHTML = buildNav();
    document.body.insertBefore(nav, document.body.firstChild);

    // Wrap existing content if not already wrapped
    if (!document.querySelector('.page-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'page-wrap';
      while (nav.nextSibling) wrap.appendChild(nav.nextSibling);
      document.body.appendChild(wrap);
    }

    // Restore theme
    const saved = localStorage.getItem('om3ni-theme') || 'dark';
    applyTheme(saved);
  }

  /* ── Theme ───────────────────────────────────*/
  window.navToggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('om3ni-theme', next);
  };

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('nav-theme-icon');
    const lbl  = document.getElementById('nav-theme-lbl');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
    if (lbl)  lbl.textContent  = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }

  /* ── Collapse toggle ─────────────────────────*/
  window.navToggleGroup = function (id) {
    const items  = document.getElementById('nav-group-' + id);
    const toggle = items && items.previousElementSibling;
    if (!items) return;
    const open = items.classList.toggle('open');
    if (toggle) toggle.classList.toggle('open', open);
  };

  /* ── Scroll-spy ──────────────────────────────*/
  function initScrollSpy() {
    if (!window.NAV_SECTIONS) return;
    const anchors = document.querySelectorAll('section[id], div[id].spy');
    const links   = document.querySelectorAll('#site-nav a[href*="#"]');
    if (!anchors.length || !links.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => {
            l.classList.remove('nav-active');
            if (l.getAttribute('href').endsWith('#' + e.target.id)) {
              l.classList.add('nav-active');
            }
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    anchors.forEach(a => obs.observe(a));
  }

  /* ── Init ────────────────────────────────────*/
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { inject(); initScrollSpy(); });
  } else {
    inject();
    initScrollSpy();
  }

})();
