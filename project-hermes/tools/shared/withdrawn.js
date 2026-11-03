/*
  tools/shared/withdrawn.js — "Withdrawn — under review" banner.

  Included (one line, right after <body>) by every calculator that is hidden
  from the Hermes catalog pending the release gate in CALCULATORS.md:

    <script src="../shared/withdrawn.js" data-reason="…"></script>

  The banner is for anyone who reaches the page by a direct link or an old
  bookmark. It cannot be dismissed. Remove the line when the tool passes the
  gate (engineering review + UX review + owner sign-off).
*/
(function () {
  var me = document.currentScript;
  var reason = (me && me.getAttribute('data-reason')) || '';
  var home = me ? new URL('../../index.html', me.src).href : '/project-hermes/';

  var css = document.createElement('style');
  css.textContent =
    '.hermes-withdrawn{position:sticky;top:0;z-index:2147483000;margin:0;padding:12px 16px 14px;' +
    'background:#3a0d0d;color:#ffe9e4;border-bottom:3px solid #e0483a;font:500 15px/1.45 system-ui,-apple-system,sans-serif}' +
    '.hermes-withdrawn strong{display:block;font-size:16px;letter-spacing:.06em;text-transform:uppercase;color:#ffb4a8}' +
    '.hermes-withdrawn p{margin:4px 0 0}' +
    '.hermes-withdrawn a{color:#fff;font-weight:700}' +
    '[data-theme="light"] .hermes-withdrawn{background:#fde8e5;color:#4a0f0a;border-bottom-color:#b3261e}' +
    '[data-theme="light"] .hermes-withdrawn strong{color:#8f1a12}' +
    '[data-theme="light"] .hermes-withdrawn a{color:#4a0f0a}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.className = 'hermes-withdrawn';
  box.setAttribute('role', 'alert');
  box.innerHTML =
    '<strong>Withdrawn — under review</strong>' +
    '<p>This calculator failed an engineering review (Nov 2026) and can give wrong or unsafe results. ' +
    'Do not use it for sizing, installation, charging or safety decisions.</p>' +
    (reason ? '<p class="hermes-withdrawn-reason"></p>' : '') +
    '<p><a href="' + home + '">Back to Hermes</a></p>';
  if (reason) box.querySelector('.hermes-withdrawn-reason').textContent = 'Known problem: ' + reason + '.';

  function place() { document.body.insertBefore(box, document.body.firstChild); }
  if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
})();
