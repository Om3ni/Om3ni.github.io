/* ═══════════════════════════════════════════════════════════════════════════
   Project Hermes — Native OCR capture utility
   Phase 1: minimal capture-and-extract flow.

   Two modes:
     'scratchpad' — extracted lines saved to localStorage[scratchpadKey] and
                    rendered with Copy buttons. Used by the global header 📷.
     'scoped'     — extracted lines presented with per-field "→ Field" buttons
                    that write the value (numerically sanitized when the field
                    declares type:'number') into matching input IDs.
                    Used by per-module 📷 buttons.

   No external dependencies. Native browser APIs only:
     - <input type="file" accept="image/*" capture="environment"> for camera
     - window.TextDetector (Android Chrome / Samsung Internet) for OCR
     - Paste-fallback textarea for iOS Safari + browsers without TextDetector
   ═══════════════════════════════════════════════════════════════════════════ */

const SCRATCHPAD_MAX = 50;

let activeModal = null;

export function hasNativeOCR() {
  return typeof window !== 'undefined' && 'TextDetector' in window;
}

/* ─── Public entry point ────────────────────────────────────────────────── */
export function openCaptureModal(opts = {}) {
  /* opts:
       mode:           'scratchpad' | 'scoped'
       fields:         [{ id, label, type? }]   (scoped mode)
       scratchpadKey:  localStorage key         (scratchpad mode)
       title:          string (modal header)
       onLines:        fn(lines) optional
       onCopy:         fn(line)  optional (scratchpad mode)
  */
  const mode = opts.mode || 'scratchpad';
  const fields = opts.fields || (mode === 'scoped' && window.HVAC_CAPTURE
                  ? window.HVAC_CAPTURE.fields : []);
  const scratchpadKey = opts.scratchpadKey || 'hermes_scratchpad';
  const title = opts.title || (mode === 'scoped' ? 'Capture & Fill Fields' : 'Capture Nameplate');

  closeCaptureModal();

  const modal = buildModal(title, mode, fields);
  document.body.appendChild(modal.root);
  /* Force reflow so the .open transition (if any) runs cleanly */
  // eslint-disable-next-line no-unused-expressions
  modal.root.offsetHeight;
  modal.root.classList.add('open');
  activeModal = modal;

  modal.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await processCapture(file, modal, { mode, fields, scratchpadKey, onLines: opts.onLines, onCopy: opts.onCopy });
  });

  modal.takeBtn.addEventListener('click', () => modal.fileInput.click());
  modal.closeBtn.addEventListener('click', closeCaptureModal);
  modal.doneBtn.addEventListener('click', closeCaptureModal);
  modal.root.addEventListener('click', (e) => {
    if (e.target === modal.root) closeCaptureModal();
  });

  return modal;
}

export function closeCaptureModal() {
  if (!activeModal) return;
  if (activeModal.cleanup) activeModal.cleanup();
  activeModal.root.remove();
  activeModal = null;
}

/* ─── Scratchpad helpers (also exported for header UI) ──────────────────── */
export function readScratchpad(key = 'hermes_scratchpad') {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

export function writeScratchpad(key, lines) {
  try { localStorage.setItem(key, JSON.stringify(lines.slice(0, SCRATCHPAD_MAX))); }
  catch { /* quota — ignore */ }
}

export function clearScratchpad(key = 'hermes_scratchpad') {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/* ─── Modal construction ────────────────────────────────────────────────── */
function buildModal(title, mode, fields) {
  const root = document.createElement('div');
  root.className = 'modal-overlay cap-overlay';
  root.innerHTML = `
    <div class="modal cap-modal">
      <div class="modal-hdr">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button class="modal-close cap-close" type="button" aria-label="Close">&#10005;</button>
      </div>
      <div class="modal-body cap-body">
        <input class="cap-file" type="file" accept="image/*" capture="environment" hidden>
        <button class="btn btn-primary cap-take" type="button">📷 Take Photo or Choose Image</button>
        <div class="cap-platform-note"></div>
        <img class="cap-preview" alt="Captured nameplate">
        <div class="cap-status"></div>
        <div class="cap-lines"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost cap-done" type="button">Done</button>
      </div>
    </div>
  `;

  const note = root.querySelector('.cap-platform-note');
  if (!hasNativeOCR()) {
    note.textContent = 'On this device, after taking the photo, long-press it to use Live Text, then paste below.';
    note.classList.add('shown');
  }

  /* Scoped header — show available target fields */
  if (mode === 'scoped' && fields && fields.length) {
    const hdr = document.createElement('div');
    hdr.className = 'cap-fields-hdr';
    hdr.textContent = 'Target fields: ' + fields.map(f => f.label).join(' · ');
    root.querySelector('.cap-body').insertBefore(hdr, root.querySelector('.cap-take').nextSibling);
  }

  return {
    root,
    closeBtn: root.querySelector('.cap-close'),
    doneBtn: root.querySelector('.cap-done'),
    takeBtn: root.querySelector('.cap-take'),
    fileInput: root.querySelector('.cap-file'),
    preview: root.querySelector('.cap-preview'),
    status: root.querySelector('.cap-status'),
    linesContainer: root.querySelector('.cap-lines'),
    cleanup: null
  };
}

/* ─── Capture processing ────────────────────────────────────────────────── */
async function processCapture(file, modal, opts) {
  const url = URL.createObjectURL(file);
  modal.preview.src = url;
  modal.preview.classList.add('shown');

  /* Replace any prior cleanup */
  const prevCleanup = modal.cleanup;
  modal.cleanup = () => { try { URL.revokeObjectURL(url); } catch {} if (prevCleanup) prevCleanup(); };

  /* Reset previous lines */
  modal.linesContainer.innerHTML = '';

  if (hasNativeOCR()) {
    modal.status.textContent = 'Reading text…';
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.TextDetector();
      const detections = await detector.detect(bitmap);
      const lines = (detections || [])
        .map(d => (d.rawValue || '').trim())
        .filter(Boolean);
      if (lines.length) {
        modal.status.textContent = `Detected ${lines.length} text line${lines.length === 1 ? '' : 's'}.`;
        renderLines(lines, modal, opts);
      } else {
        modal.status.textContent = 'No text detected. Try a closer photo, or paste manually:';
        showPasteFallback(modal, opts);
      }
    } catch (err) {
      console.warn('TextDetector failed:', err);
      modal.status.textContent = 'OCR error — paste extracted text below:';
      showPasteFallback(modal, opts);
    }
  } else {
    modal.status.textContent = 'Long-press the photo above, choose Live Text or Copy, then paste below:';
    showPasteFallback(modal, opts);
  }
}

/* ─── Paste fallback (iOS / no TextDetector) ────────────────────────────── */
function showPasteFallback(modal, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'cap-fallback';
  const ta = document.createElement('textarea');
  ta.className = 'cap-paste';
  ta.placeholder = 'Paste extracted text here (one item per line is best)…';
  ta.rows = 4;
  wrap.appendChild(ta);
  modal.linesContainer.appendChild(wrap);

  ta.addEventListener('input', () => {
    const lines = ta.value
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    /* Remove any prior render */
    const prior = modal.linesContainer.querySelector('.cap-lines-list');
    if (prior) prior.remove();
    if (lines.length) renderLines(lines, modal, opts, /* skipResetCleanup */ true);
  });

  ta.focus();
}

/* ─── Line rendering ────────────────────────────────────────────────────── */
function renderLines(lines, modal, opts, skipResetCleanup) {
  /* Remove any prior list (paste-fallback may re-render) */
  const prior = modal.linesContainer.querySelector('.cap-lines-list');
  if (prior) prior.remove();

  const list = document.createElement('div');
  list.className = 'cap-lines-list';

  if (opts.mode === 'scratchpad') {
    /* Save to scratchpad (newest first) */
    if (opts.scratchpadKey) {
      const existing = readScratchpad(opts.scratchpadKey);
      const seen = new Set();
      const merged = [...lines, ...existing].filter(l => {
        if (seen.has(l)) return false;
        seen.add(l);
        return true;
      });
      writeScratchpad(opts.scratchpadKey, merged);
    }
    for (const line of lines) list.appendChild(makeCopyRow(line, opts));
  } else if (opts.mode === 'scoped') {
    for (const line of lines) list.appendChild(makeScopedRow(line, opts));
  }

  modal.linesContainer.appendChild(list);
  if (typeof opts.onLines === 'function') opts.onLines(lines);
}

function makeCopyRow(line, opts) {
  const row = document.createElement('div');
  row.className = 'cap-line';

  const text = document.createElement('span');
  text.className = 'cap-line-text';
  text.textContent = line;

  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost cap-line-btn';
  btn.type = 'button';
  btn.textContent = 'Copy';
  btn.addEventListener('click', () => {
    copyToClipboard(line);
    flashDone(btn, 'Copy');
    if (typeof opts.onCopy === 'function') opts.onCopy(line);
  });

  row.appendChild(text);
  row.appendChild(btn);
  return row;
}

function makeScopedRow(line, opts) {
  const row = document.createElement('div');
  row.className = 'cap-line cap-line-scoped';

  const text = document.createElement('div');
  text.className = 'cap-line-text';
  text.textContent = line;
  row.appendChild(text);

  if (opts.fields && opts.fields.length) {
    const btnRow = document.createElement('div');
    btnRow.className = 'cap-field-btns';
    for (const f of opts.fields) {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost cap-field-btn';
      b.type = 'button';
      b.textContent = '→ ' + f.label;
      b.addEventListener('click', () => {
        const ok = fillField(f, line);
        if (ok) flashDone(b, '→ ' + f.label, '✓ ' + f.label);
      });
      btnRow.appendChild(b);
    }
    row.appendChild(btnRow);
  }
  return row;
}

/* ─── Field fill ────────────────────────────────────────────────────────── */
function fillField(fieldDef, value) {
  const el = document.getElementById(fieldDef.id);
  if (!el) return false;
  let v = String(value).trim();
  if (fieldDef.type === 'number') {
    const m = v.match(/-?\d+(?:[.,]\d+)?/);
    v = m ? m[0].replace(',', '.') : '';
  }
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/* ─── Misc helpers ──────────────────────────────────────────────────────── */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

function flashDone(btn, original, doneLabel) {
  const label = doneLabel || '✓';
  btn.classList.add('done');
  btn.textContent = label;
  setTimeout(() => {
    btn.classList.remove('done');
    btn.textContent = original;
  }, 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
