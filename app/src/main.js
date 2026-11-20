import {
  LAYOUTS,
  LAYOUT_ORDER,
  SIZES,
  createState,
  getState,
  patchTransform,
  setSize,
  subscribe,
  update
} from './state.js';
import { PALETTES, PALETTE_ORDER } from './palette.js';
import { applyShot } from './shots.js';
import { renderCover } from './render.js';
import { coverFit, defaultFocus, focusForDrag, layoutPanels, panelAt } from './panels.js';
import { loadImageFromFile, loadSample, loadSamples, photoForPanel, releasePhotos } from './photos.js';
import { downloadExport, exportCover, formatBytes } from './exporter.js';

const $ = (id) => document.getElementById(id);

if (!document.querySelector('link[rel="icon"]')) {
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23ff2e88"/></svg>';
  document.head.appendChild(icon);
}

const MAX_THUMBS = 8;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const FONT_SPECS = [
  '100px Anton',
  '100px Pacifico',
  '100px "Archivo Black"',
  '100px "Barlow Condensed"'
];

let state = createState();
let canvas = null;
let raf = 0;
let chromeKey = '';
let thumbKey = '';
let lastExportNote = '';
let toastTimer = 0;
let exporting = false;
let drag = null;
const cycleCursor = new Map();

function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, n));
}

function panelsNow(s) {
  return layoutPanels(s.layoutId, s.width, s.height);
}

function selectedIndex(s, panels) {
  if (!panels.length) return 0;
  return Math.min(Math.max(0, s.selected || 0), panels.length - 1);
}

async function waitForFonts() {
  if (!document.fonts) return;
  const jobs = [document.fonts.ready];
  for (const spec of FONT_SPECS) {
    try {
      jobs.push(document.fonts.load(spec));
    } catch {
      jobs.push(Promise.resolve(null));
    }
  }
  await Promise.all(jobs.map((job) => Promise.resolve(job).catch(() => null)));
}

async function hydratePhotos() {
  const missing = state.photos.filter((photo) => !photo.image);
  if (!missing.length) return;
  const loaded = await Promise.all(
    missing.map((photo) =>
      loadSample(photo.id).catch(() => photo)
    )
  );
  const byId = new Map(loaded.map((photo) => [photo.id, photo]));
  state.photos = state.photos.map((photo) => (photo.image ? photo : byId.get(photo.id) || photo));
}

function showShot(mode) {
  document.body.classList.add(mode === 'sheet' ? 'shot-sheet' : 'shot-cover');
  const layer = $('shot-layer');
  if (!layer) return;
  layer.hidden = false;
  let shotCanvas = layer.querySelector('canvas');
  if (!shotCanvas) {
    shotCanvas = document.createElement('canvas');
    layer.appendChild(shotCanvas);
  }
  renderCover(shotCanvas, getState());
}

function defaultNote(s) {
  return `saves solaris-vice-${s.width}x${s.height}.png · nothing leaves this machine`;
}

function toast(text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

function draw() {
  if (!canvas) return;
  renderCover(canvas, getState());
  syncChrome();
}

function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw();
  });
}

function setPressed(container, key, value) {
  if (!container) return;
  container.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset[key] === value ? 'true' : 'false');
  });
}

function drawLayoutDiagram(diagram, layoutId, color) {
  const layout = LAYOUTS[layoutId];
  if (!layout) return;
  const ctx = diagram.getContext('2d');
  const rects = Array.isArray(layout.panels) ? layout.panels : layout.panels.portrait;
  const pad = 2;
  const w = diagram.width - pad * 2;
  const h = diagram.height - pad * 2;
  ctx.clearRect(0, 0, diagram.width, diagram.height);
  ctx.fillStyle = color || 'currentColor';
  ctx.globalAlpha = 0.82;
  for (const r of rects) {
    ctx.fillRect(
      pad + r[0] * w,
      pad + r[1] * h,
      Math.max(1, r[2] * w - 1),
      Math.max(1, r[3] * h - 1)
    );
  }
  ctx.globalAlpha = 1;
}

function renderThumbs() {
  const strip = $('photo-strip');
  if (!strip) return;
  const s = getState();
  const photos = s.photos || [];
  const shown = photos.slice(0, MAX_THUMBS);
  const panels = panelsNow(s);
  const active = photos.length ? selectedIndex(s, panels) % photos.length : -1;
  const count = $('photo-count');
  const extra = Math.max(0, photos.length - MAX_THUMBS);
  if (count) {
    count.textContent = `${shown.length} of ${photos.length} photos${extra ? ` · +${extra} more` : ''}`;
  }
  const key = `${active}|${shown.map((photo) => `${photo.id}:${photo.image && photo.image.src}`).join(',')}`;
  if (key === thumbKey) return;
  thumbKey = key;
  strip.innerHTML = '';
  shown.forEach((photo, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = index === active ? 'thumb is-active' : 'thumb';
    thumb.setAttribute('aria-pressed', index === active ? 'true' : 'false');
    const src = photo.image && photo.image.src ? photo.image.src : photo.url;
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = photo.label || photo.id;
      img.decoding = 'async';
      img.loading = 'lazy';
      thumb.appendChild(img);
    }
    const label = document.createElement('span');
    label.textContent = photo.label || photo.id;
    thumb.appendChild(label);
    thumb.addEventListener('click', () => assignPhoto(photo));
    strip.appendChild(thumb);
  });
}

function syncChrome() {
  const s = getState();
  const panels = panelsNow(s);
  const index = selectedIndex(s, panels);
  const transform = s.transforms[index] || { focus: { x: 0.5, y: 0.5 }, zoom: 1 };
  const zoom = clampZoom(transform.zoom);
  const photoKey = s.photos
    .map((photo) => `${photo.id}:${photo.image && photo.image.__objectUrl ? 'u' : 's'}`)
    .join(',');
  const key = [
    s.sizeId,
    s.layoutId,
    s.paletteId,
    index,
    s.width,
    s.height,
    s.grade,
    s.grain,
    s.bloom,
    zoom.toFixed(3),
    photoKey
  ].join('|');
  if (key === chromeKey) return;
  chromeKey = key;

  setPressed($('size-chips'), 'size', s.sizeId);
  setPressed($('export-sizes'), 'size', s.sizeId);
  setPressed($('layout-grid'), 'layout', s.layoutId);
  setPressed($('palette-row'), 'palette', s.paletteId);

  const grid = $('layout-grid');
  if (grid) {
    grid.querySelectorAll('button').forEach((button) => {
      const diagram = button.querySelector('canvas');
      if (diagram) drawLayoutDiagram(diagram, button.dataset.layout, getComputedStyle(button).color);
    });
  }

  for (const slider of ['grade', 'grain', 'bloom']) {
    const input = $(slider);
    const out = $(`${slider}-value`);
    const value = s[slider];
    if (input && input.value !== String(value)) input.value = String(value);
    if (out) out.textContent = String(value);
  }

  const pill = $('selected-panel');
  if (pill) pill.textContent = `Panel ${index + 1}`;
  const zoomInput = $('zoom');
  if (zoomInput) {
    zoomInput.max = String(MAX_ZOOM);
    if (zoomInput.value !== String(zoom)) zoomInput.value = String(zoom);
  }
  const zoomValue = $('zoom-value');
  if (zoomValue) zoomValue.textContent = `${zoom.toFixed(2)}×`;
  const countPill = $('panel-count');
  if (countPill) countPill.textContent = `${panels.length} panel${panels.length === 1 ? '' : 's'}`;
  const note = $('export-note');
  if (note) note.textContent = lastExportNote || defaultNote(s);

  renderThumbs();
}

function chooseSize(id) {
  lastExportNote = '';
  const next = setSize(getState(), id);
  update({ sizeId: next.sizeId, width: next.width, height: next.height });
  const note = $('export-note');
  if (note) note.textContent = defaultNote(next);
}

function chooseLayout(id) {
  if (!LAYOUTS[id]) return;
  update({ layoutId: id, selected: 0 });
}

function assignPhoto(photo) {
  const s = getState();
  const total = s.photos.length;
  if (!photo || !total) return;
  const slot = (s.selected || 0) % total;
  const photos = s.photos.slice();
  photos[slot] = photo;
  update({ photos });
}

function cyclePhoto() {
  const s = getState();
  const total = s.photos.length;
  if (total < 2) return;
  const slot = (s.selected || 0) % total;
  const used = new Set(s.photos.filter((_, i) => i !== slot).map((photo) => photo.id));
  const fresh = [];
  const shared = [];
  s.photos.forEach((photo, i) => {
    if (i === slot) return;
    (used.has(photo.id) ? shared : fresh).push(i);
  });
  const order = fresh.concat(shared);
  if (!order.length) return;
  let cursor = cycleCursor.get(slot);
  if (cursor == null || cursor >= order.length) cursor = 0;
  const photos = s.photos.slice();
  photos[slot] = s.photos[order[cursor]];
  cycleCursor.set(slot, (cursor + 1) % order.length);
  update({ photos });
}

function resetCrop() {
  const s = getState();
  const panels = panelsNow(s);
  const index = selectedIndex(s, panels);
  const panel = panels[index];
  if (!panel) return;
  const focus = defaultFocus(panel);
  update({ transforms: patchTransform(s, index, { focus, zoom: 1 }).transforms });
}

function setSelectedZoom(value) {
  const s = getState();
  const panels = panelsNow(s);
  const index = selectedIndex(s, panels);
  update({ transforms: patchTransform(s, index, { zoom: clampZoom(value) }).transforms });
}

async function applyUploads(loaded) {
  if (!loaded.length) return;
  const s = getState();
  const photos = s.photos.slice();
  const replaced = [];
  for (let i = 0; i < loaded.length; i += 1) {
    if (i < photos.length) {
      replaced.push(photos[i]);
      photos[i] = loaded[i];
    } else {
      photos.push(loaded[i]);
    }
  }
  const keep = new Set(photos);
  releasePhotos(replaced.filter((photo) => !keep.has(photo)));
  const transforms = photos.map((photo, i) => {
    const t = s.transforms[i];
    if (t) return { focus: { ...t.focus }, zoom: t.zoom };
    return { focus: { x: 0.5, y: 0.45 }, zoom: 1.04 };
  });
  cycleCursor.clear();
  update({ photos, transforms });
}

async function clearPhotos() {
  const s = getState();
  let samples = [];
  try {
    samples = await loadSamples();
  } catch {
    samples = [];
  }
  if (!samples.length) return;
  const keep = new Set(samples);
  releasePhotos(s.photos.filter((photo) => photo.image && photo.image.__objectUrl && !keep.has(photo)));
  const transforms = samples.map((photo, i) => {
    const t = s.transforms[i];
    return t ? { focus: { ...t.focus }, zoom: t.zoom } : { focus: { x: 0.5, y: 0.4 }, zoom: 1.04 };
  });
  cycleCursor.clear();
  update({ photos: samples, transforms });
}

async function doExport() {
  if (exporting || !canvas) return;
  exporting = true;
  try {
    const result = await exportCover(canvas, getState());
    downloadExport(result);
    lastExportNote = `${result.filename} · ${formatBytes(result.bytes)}`;
    const note = $('export-note');
    if (note) note.textContent = lastExportNote;
    toast(`${result.filename} · ${formatBytes(result.bytes)}`);
  } catch {
    toast('EXPORT FAILED');
  }
  exporting = false;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width ? canvas.width / rect.width : 1;
  const sy = rect.height ? canvas.height / rect.height : 1;
  return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
}

function wirePreview() {
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    const point = canvasPoint(event);
    const s = getState();
    const panels = panelsNow(s);
    const hit = panelAt(panels, point.x, point.y);
    if (!hit) return;
    if (hit.index !== s.selected) update({ selected: hit.index });
    const live = getState();
    const transform = live.transforms[hit.index] || { focus: { x: 0.5, y: 0.5 }, zoom: 1 };
    const photo = photoForPanel(live, hit.index);
    const fit = photo && photo.image ? coverFit(hit, photo.image, clampZoom(transform.zoom), transform.focus) : null;
    drag = { index: hit.index, fit, last: point, id: event.pointerId };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const point = canvasPoint(event);
    const dx = point.x - drag.last.x;
    const dy = point.y - drag.last.y;
    drag.last = point;
    if (!dx && !dy) return;
    const s = getState();
    const transform = s.transforms[drag.index] || { focus: { x: 0.5, y: 0.5 }, zoom: 1 };
    const focus = focusForDrag(drag.fit, dx, dy, transform.focus);
    update({ transforms: patchTransform(s, drag.index, { focus }).transforms });
  });

  const endDrag = (event) => {
    if (!drag) return;
    if (event && event.pointerId != null && event.pointerId !== drag.id) return;
    try {
      canvas.releasePointerCapture(drag.id);
    } catch {
      /* ignore */
    }
    drag = null;
    canvas.style.cursor = 'grab';
  };

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', (event) => {
    if (drag && !event.buttons) endDrag(event);
  });
  window.addEventListener('blur', () => endDrag());

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const s = getState();
      const panels = panelsNow(s);
      const index = selectedIndex(s, panels);
      const transform = s.transforms[index] || { focus: { x: 0.5, y: 0.5 }, zoom: 1 };
      const step = event.deltaY < 0 ? 1.09 : 1 / 1.09;
      const zoom = clampZoom((transform.zoom || 1) * step);
      if (Math.abs(zoom - (transform.zoom || 1)) < 0.0001) return;
      update({ transforms: patchTransform(s, index, { zoom }).transforms });
    },
    { passive: false }
  );

  const zoomInput = $('zoom');
  if (zoomInput) {
    zoomInput.addEventListener('input', () => setSelectedZoom(zoomInput.value));
  }

  const reset = $('reset-crop');
  if (reset) reset.addEventListener('click', resetCrop);
  const cycle = $('cycle-photo');
  if (cycle) cycle.addEventListener('click', cyclePhoto);
}

function buildSizes() {
  const chips = $('size-chips');
  const stack = $('export-sizes');
  if (chips) chips.innerHTML = '';
  if (stack) stack.innerHTML = '';
  for (const size of SIZES) {
    if (chips) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.size = size.id;
      chip.textContent = size.label;
      chip.addEventListener('click', () => chooseSize(size.id));
      chips.appendChild(chip);
    }
    if (stack) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.size = size.id;
      const name = document.createElement('span');
      name.className = 'size-name';
      name.textContent = size.id;
      const label = document.createElement('span');
      label.className = 'size-label';
      label.textContent = size.label;
      button.append(name, label);
      button.addEventListener('click', () => chooseSize(size.id));
      stack.appendChild(button);
    }
  }
}

function buildLayouts() {
  const grid = $('layout-grid');
  if (!grid) return;
  grid.innerHTML = '';
  LAYOUT_ORDER.forEach((id, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.layout = id;
    button.title = `${LAYOUTS[id].label} (${index + 1})`;
    const diagram = document.createElement('canvas');
    diagram.width = 32;
    diagram.height = 16;
    diagram.style.width = '16px';
    diagram.style.height = '8px';
    diagram.style.display = 'block';
    const label = document.createElement('span');
    label.textContent = LAYOUTS[id].label;
    button.append(diagram, label);
    button.addEventListener('click', () => chooseLayout(id));
    grid.appendChild(button);
  });
}

function buildPalettes() {
  const row = $('palette-row');
  if (!row) return;
  row.innerHTML = '';
  PALETTE_ORDER.forEach((id) => {
    const palette = PALETTES[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.palette = id;
    button.title = palette.label;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = `linear-gradient(135deg, ${palette.skyTop} 0%, ${palette.skyMid} 34%, ${palette.skyHot} 66%, ${palette.skyLow} 100%)`;
    const label = document.createElement('span');
    label.textContent = palette.label;
    button.append(swatch, label);
    button.addEventListener('click', () => update({ paletteId: id }));
    row.appendChild(button);
  });
}

function buildSlider(id) {
  const input = $(id);
  if (!input) return;
  const out = $(`${id}-value`);
  const value = getState()[id];
  input.value = String(value);
  if (out) out.textContent = String(value);
  input.addEventListener('input', () => {
    const next = Number(input.value);
    if (out) out.textContent = String(next);
    update({ [id]: next });
  });
}

function buildCaption() {
  const fields = [
    ['caption-title', 'title'],
    ['caption-subtitle', 'subtitle'],
    ['caption-quote', 'quote'],
    ['caption-volume', 'volume'],
    ['caption-tagline', 'tagline']
  ];
  const s = getState();
  for (const [id, key] of fields) {
    const input = $(id);
    if (!input) continue;
    input.value = s.caption[key] || '';
    input.addEventListener('input', () => update({ caption: { [key]: input.value } }));
  }
}

function buildRoles() {
  const wrap = $('role-inputs');
  if (!wrap) return;
  wrap.innerHTML = '';
  const s = getState();
  for (let i = 0; i < 6; i += 1) {
    const field = document.createElement('div');
    field.className = 'field';
    const id = `role-${i}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = `Role ${i + 1}`;
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.maxLength = 22;
    input.autocomplete = 'off';
    input.placeholder = 'THE ...';
    input.value = s.roles[i] || '';
    input.addEventListener('input', () => {
      const current = getState();
      const roles = [...current.roles];
      while (roles.length < 6) roles.push('');
      roles[i] = input.value;
      update({ roles, caption: { roles } });
    });
    field.append(label, input);
    wrap.appendChild(field);
  }
}

function buildPhotos() {
  const input = $('add-photos');
  if (input) {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'));
      input.value = '';
      if (!files.length) return;
      const loaded = [];
      for (const file of files) {
        try {
          const image = await loadImageFromFile(file);
          loaded.push({
            id: `upload-${Date.now()}-${loaded.length}`,
            url: image.__objectUrl || image.src,
            image,
            label: file.name.replace(/\.[^.]+$/, '') || 'Photo'
          });
        } catch {
          /* skip unreadable file */
        }
      }
      await applyUploads(loaded);
    });
  }
  const clear = $('clear-photos');
  if (clear) clear.addEventListener('click', clearPhotos);
}

function wireKeys() {
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (event.key >= '1' && event.key <= '6') {
      const id = LAYOUT_ORDER[Number(event.key) - 1];
      if (id) {
        event.preventDefault();
        chooseLayout(id);
      }
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      doExport();
    }
  });
}

function buildEditor() {
  canvas = $('preview');
  buildSizes();
  buildLayouts();
  buildPalettes();
  buildSlider('grade');
  buildSlider('grain');
  buildSlider('bloom');
  buildCaption();
  buildRoles();
  buildPhotos();
  wirePreview();
  wireKeys();
  for (const id of ['download', 'download-2']) {
    const button = $(id);
    if (button) button.addEventListener('click', doExport);
  }
  const note = $('export-note');
  if (note) note.textContent = defaultNote(getState());
  subscribe(scheduleRender);
  draw();
}

async function boot() {
  await waitForFonts();
  const mode = await applyShot(state, window.location.search);
  await hydratePhotos();
  state = update(state);
  if (mode !== 'editor') {
    showShot(mode);
    return;
  }
  buildEditor();
}

boot().catch(() => {
  const el = $('toast');
  if (el) {
    el.textContent = 'COULD NOT START THE STUDIO';
    el.hidden = false;
  }
});
