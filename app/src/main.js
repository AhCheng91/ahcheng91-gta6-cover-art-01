// Page logic for SOLARIS VICE: builds the controls from the store, renders one canvas at export
// resolution (the same canvas is the preview, scaled by CSS), exports through exporter.js and
// runs the ?shot= scenes from shots.js.

import {
  LAYOUTS,
  LAYOUT_ORDER,
  MAX_PANELS,
  PALETTES,
  PALETTE_ORDER,
  SIZES,
  createState,
  getState,
  layoutById,
  patchTransform,
  setPanelPhoto,
  setRole,
  setSize,
  subscribe,
  update,
} from './state.js';
import { coverFit, focusForDrag, layoutPanels, panelAt, panelFocus } from './panels.js';
import {
  SAMPLES,
  addPhotos,
  loadImageFromFile,
  loadSample,
  loadSamples,
  photoForPanel,
  releasePhotos,
} from './photos.js';
import { renderCover } from './render.js';
import { downloadExport, exportCover } from './exporter.js';
import {
  afterPaint,
  applySceneClass,
  markError,
  markReady,
  readShot,
  sceneOverrides,
  scenePhotos,
  showResult,
  waitForFonts,
} from './shots.js';

const shot = readShot(location.search);
let state = createState(shot.mode ? sceneOverrides(shot.mode, shot.query) : {});
const isShot = Boolean(shot.mode);

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const stage = $('stage');
const stageInner = $('stage-inner');
const ring = $('panel-ring');
const tag = $('panel-tag');
const dropOverlay = $('drop-overlay');
const toastEl = $('toast');
const shotLayer = $('shot-layer');

const sizeChips = $('size-chips');
const sizeStack = $('size-stack');
const exportBtn = $('export-btn');
const exportBtn2 = $('export-btn-2');
const exportNote = $('export-note');

const layoutGrid = $('layout-grid');
const paletteRow = $('palette-row');
const panelCountPill = $('panel-count');

const photoStrip = $('photo-strip');
const photoCount = $('photo-count');
const photoMore = $('photo-more');
const photoInput = $('photo-input');
const addPhotosBtn = $('add-photos');
const clearPhotosBtn = $('clear-photos');
const panelNote = $('panel-note');

const panelLabel = $('panel-label');
const panelPhoto = $('panel-photo');
const panelZoom = $('panel-zoom');
const zoomValue = $('zoom-value');
const resetFocus = $('reset-focus');

const rolesWrap = $('roles');
const inputs = {
  title: $('cap-title'),
  subtitle: $('cap-subtitle'),
  quote: $('cap-quote'),
  volume: $('cap-volume'),
  tagline: $('cap-tagline'),
};
const sliders = {
  grade: $('grade'),
  grain: $('grain'),
  bloom: $('bloom'),
};
const sliderValues = {
  grade: $('grade-value'),
  grain: $('grain-value'),
  bloom: $('bloom-value'),
};

let samplePhotos = [];
let photoSig = '';
let selectSig = '';
let rafId = 0;
let firstDrawn = false;
let exporting = false;
let drag = null;
let toastTimer = 0;
let dragDepth = 0;

/* ------------------------------------------------------------------ DOM helpers */

function el(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setTextValue(input, value) {
  if (input && document.activeElement !== input) input.value = value;
}

function panelCount() {
  return layoutById(state.layout).panels.length;
}

function clampPanelSelection(index) {
  if (index < 0) return -1;
  return Math.max(0, Math.min(panelCount() - 1, index));
}

/* ------------------------------------------------------------------ static controls */

function buildSizeChips(container) {
  if (!container) return;
  container.replaceChildren();
  for (const size of SIZES) {
    const button = el('button', null, size.label);
    button.type = 'button';
    button.dataset.sizeId = size.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => update(setSize(state, size.id)));
    container.append(button);
  }
}

function buildSizeStack(container) {
  if (!container) return;
  container.replaceChildren();
  for (const size of SIZES) {
    const button = el('button', 'size-btn');
    button.type = 'button';
    button.dataset.sizeId = size.id;
    button.setAttribute('aria-pressed', 'false');
    const name = el('span', 'size-name', size.name);
    const label = el('span', 'size-label', size.label);
    button.append(name, label);
    button.addEventListener('click', () => update(setSize(state, size.id)));
    container.append(button);
  }
}

/** A tiny SVG diagram of a layout, drawn from its own field fractions. */
function layoutDiagram(layout) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const solo = layout.id === 'solo';
  const inset = solo ? 0 : 3;
  const fieldTop = solo ? 0 : 10;
  const fieldH = solo ? 100 : 78;
  if (!solo) {
    const strip = document.createElementNS(NS, 'rect');
    strip.setAttribute('x', '0');
    strip.setAttribute('y', '0');
    strip.setAttribute('width', '100');
    strip.setAttribute('height', '7');
    strip.setAttribute('rx', '1');
    strip.setAttribute('class', 'diagram-strip');
    svg.append(strip);
    const foot = document.createElementNS(NS, 'rect');
    foot.setAttribute('x', '0');
    foot.setAttribute('y', '92');
    foot.setAttribute('width', '100');
    foot.setAttribute('height', '7');
    foot.setAttribute('rx', '1');
    foot.setAttribute('class', 'diagram-strip');
    svg.append(foot);
  }
  for (const [fx, fy, fw, fh] of layout.panels) {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', (fx * 100 + inset * 0.5).toFixed(2));
    rect.setAttribute('y', (fieldTop + fy * fieldH + inset * 0.5).toFixed(2));
    rect.setAttribute('width', Math.max(2, fw * 100 - inset).toFixed(2));
    rect.setAttribute('height', Math.max(2, fh * fieldH - inset).toFixed(2));
    rect.setAttribute('rx', '1');
    svg.append(rect);
  }
  return svg;
}

function buildLayoutGrid() {
  layoutGrid.replaceChildren();
  for (const id of LAYOUT_ORDER) {
    const layout = LAYOUTS[id];
    const button = el('button', 'layout-btn');
    button.type = 'button';
    button.dataset.layoutId = id;
    button.setAttribute('aria-pressed', 'false');
    button.title = `${layout.label} — ${layout.panels.length} panel${layout.panels.length === 1 ? '' : 's'}`;
    button.append(layoutDiagram(layout), el('span', null, layout.label));
    button.addEventListener('click', () => selectLayout(id));
    layoutGrid.append(button);
  }
}

function buildPaletteRow() {
  paletteRow.replaceChildren();
  for (const id of PALETTE_ORDER) {
    const palette = PALETTES[id];
    const button = el('button', 'palette');
    button.type = 'button';
    button.dataset.paletteId = id;
    button.setAttribute('aria-pressed', 'false');
    button.title = palette.label;
    const swatch = el('i');
    swatch.style.background = `linear-gradient(135deg, ${palette.shadow}, ${palette.mid} 42%, ${palette.accent} 72%, ${palette.highlight})`;
    button.append(swatch, el('span', null, palette.label));
    button.addEventListener('click', () => update({ palette: id }));
    paletteRow.append(button);
  }
}

function buildRoleInputs() {
  rolesWrap.replaceChildren();
  const count = Math.max(6, panelCount());
  for (let i = 0; i < count; i += 1) {
    const wrap = el('div', 'field role-field');
    const label = el('label', null, `Panel ${i + 1}`);
    label.htmlFor = `role-${i}`;
    const input = el('input');
    input.id = `role-${i}`;
    input.type = 'text';
    input.maxLength = 18;
    input.value = state.roles[i] ?? '';
    input.dataset.roleIndex = String(i);
    input.addEventListener('input', () => setRole(i, input.value.toUpperCase()));
    wrap.append(label, input);
    rolesWrap.append(wrap);
  }
}

function buildPhotoStrip() {
  photoStrip.replaceChildren();
  for (const meta of SAMPLES) {
    const photo = samplePhotos.find((item) => item.id === meta.id);
    if (!photo) continue;
    const button = el('button', 'thumb');
    button.type = 'button';
    button.dataset.sampleId = meta.id;
    button.setAttribute('aria-pressed', 'false');
    button.title = meta.alt;
    const image = new Image();
    image.src = photo.url;
    image.alt = '';
    image.decoding = 'async';
    button.append(image, el('span', null, meta.label));
    button.addEventListener('click', () => useSample(meta.id));
    photoStrip.append(button);
  }
}

function selectLayout(id) {
  update({ layout: id, selectedPanel: clampPanelSelection(state.selectedPanel) });
}

/* ------------------------------------------------------------------ photos */

async function useSample(id) {
  try {
    const photo = samplePhotos.find((item) => item.id === id) ?? (await loadSample(id));
    const merged = addPhotos(state, [photo]);
    const panelPhotos = [...state.panelPhotos];
    if (state.selectedPanel >= 0) panelPhotos[state.selectedPanel] = photo.id;
    update({ photos: merged.photos, panelPhotos });
  } catch (error) {
    toast('Could not load that sample');
    console.error(error);
  }
}

async function useFiles(files) {
  const list = [...files].filter((file) => file.type.startsWith('image/'));
  if (!list.length) return;
  const loaded = [];
  for (const file of list) {
    try {
      loaded.push(await loadImageFromFile(file));
    } catch (error) {
      console.error(error);
    }
  }
  if (!loaded.length) {
    toast('Those files could not be read');
    return;
  }
  const merged = addPhotos(state, loaded);
  const panelPhotos = [...state.panelPhotos];
  if (state.selectedPanel >= 0) {
    const anchor = state.selectedPanel;
    merged.added.forEach((photo, i) => {
      const index = anchor + i;
      if (index < MAX_PANELS) panelPhotos[index] = photo.id;
    });
  }
  update({ photos: merged.photos, panelPhotos });
  toast(merged.added.length === 1 ? 'Added 1 photo' : `Added ${merged.added.length} photos`);
}

function clearPhotos() {
  releasePhotos(state.photos);
  update({ photos: [], panelPhotos: Array(MAX_PANELS).fill(null) });
}

/* ------------------------------------------------------------------ export + toast */

function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2600);
}

async function doExport({ download = true } = {}) {
  if (exporting) return null;
  exporting = true;
  try {
    drawNow();
    const result = await exportCover(canvas, state);
    update({ lastExport: result });
    if (download) downloadExport(result);
    if (!isShot) toast(`Saved ${result.name}`);
    return result;
  } catch (error) {
    markError(error);
    toast('Export failed — see the console');
    return null;
  } finally {
    exporting = false;
  }
}

/* ------------------------------------------------------------------ drawing */

function sizeCanvas() {
  if (canvas.width !== state.width || canvas.height !== state.height) {
    canvas.width = state.width;
    canvas.height = state.height;
  }
}

function fitStage() {
  if (document.body.classList.contains('shot-cover') || document.body.classList.contains('shot-sheet')) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    stageInner.style.width = '100%';
    stageInner.style.height = '100%';
    return;
  }
  canvas.style.objectFit = '';
  const styles = getComputedStyle(stage);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availableW = Math.max(80, stage.clientWidth - padX);
  const availableH = Math.max(80, stage.clientHeight - padY);
  const ratio = state.width / state.height;
  let width = availableW;
  let height = width / ratio;
  if (height > availableH) {
    height = availableH;
    width = height * ratio;
  }
  stageInner.style.width = `${Math.round(width)}px`;
  stageInner.style.height = `${Math.round(height)}px`;
}

function draw() {
  rafId = 0;
  state = getState();
  sizeCanvas();
  fitStage();
  renderCover(canvas, state);
  drawPanelOverlay();
  if (!firstDrawn) {
    firstDrawn = true;
    if (!isShot) document.body.dataset.ready = '1';
  }
}

function drawNow() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  draw();
}

function scheduleDraw() {
  if (!rafId) rafId = requestAnimationFrame(draw);
}

function drawPanelOverlay() {
  if (!ring || !tag) return;
  const index = state.selectedPanel;
  const { panels } = layoutPanels(state.layout, state.width, state.height);
  const panel = index >= 0 ? panels[index] : null;
  if (!panel || isShot) {
    ring.hidden = true;
    tag.hidden = true;
    return;
  }
  const coverRect = canvas.getBoundingClientRect();
  const innerRect = stageInner.getBoundingClientRect();
  if (!coverRect.width || !coverRect.height) {
    ring.hidden = true;
    tag.hidden = true;
    return;
  }
  const scale = coverRect.width / state.width;
  const left = coverRect.left - innerRect.left + panel.x * scale;
  const top = coverRect.top - innerRect.top + panel.y * scale;
  const width = panel.w * scale;
  const height = panel.h * scale;

  ring.style.left = `${left}px`;
  ring.style.top = `${top}px`;
  ring.style.width = `${width}px`;
  ring.style.height = `${height}px`;
  ring.hidden = false;

  tag.textContent = `Panel ${index + 1} / ${panels.length}`;
  tag.style.left = `${left}px`;
  if (top < 26) {
    tag.style.top = `${top + 5}px`;
    tag.style.transform = 'translateY(0)';
  } else {
    tag.style.top = `${top}px`;
    tag.style.transform = 'translateY(-100%)';
  }
  tag.hidden = false;
}

/* ------------------------------------------------------------------ control sync */

function syncControls() {
  for (const container of [sizeChips, sizeStack]) {
    if (!container) continue;
    for (const button of container.children) {
      button.setAttribute('aria-pressed', String(button.dataset.sizeId === state.sizeId));
    }
  }

  for (const button of layoutGrid.children) {
    button.setAttribute('aria-pressed', String(button.dataset.layoutId === state.layout));
  }

  for (const button of paletteRow.children) {
    button.setAttribute('aria-pressed', String(button.dataset.paletteId === state.palette));
  }

  if (panelCountPill) panelCountPill.textContent = `${panelCount()} panel${panelCount() === 1 ? '' : 's'}`;
  if (photoCount) photoCount.textContent = `${state.photos.length} loaded`;
  if (photoMore) {
    const total = photoStrip ? photoStrip.children.length : 0;
    const extra = total - 8;
    photoMore.hidden = extra <= 0;
    if (extra > 0) photoMore.textContent = `8 of ${total} photos · +${extra} more`;
  }

  const loaded = new Set(state.photos.map((photo) => photo.id));
  for (const button of photoStrip.children) {
    button.setAttribute('aria-pressed', String(loaded.has(button.dataset.sampleId)));
  }

  syncPhotoList();
  syncPanelCard();
  syncCaption();
  syncRoles();
  syncLook();

  if (exportNote) {
    exportNote.textContent = `Saves solaris-vice-${state.width}x${state.height}.png · nothing leaves this machine`;
  }
}

function syncPhotoList() {
  if (!photoStrip) return;
  const signature = state.photos.map((photo) => `${photo.id}:${photo.name}`).join('|');
  if (signature !== photoSig) {
    const samples = new Set(SAMPLES.map((sample) => sample.id));
    for (const photo of state.photos) {
      if (samples.has(photo.id)) continue;
      const button = el('button', 'thumb is-file');
      button.type = 'button';
      button.dataset.photoId = photo.id;
      button.title = photo.name;
      const image = new Image();
      image.src = photo.url;
      image.alt = '';
      image.decoding = 'async';
      button.append(image, el('span', null, photo.name));
      button.addEventListener('click', () => {
        if (state.selectedPanel >= 0) setPanelPhoto(state.selectedPanel, photo.id);
      });
      photoStrip.append(button);
    }
    photoSig = signature;
  }
  const active = state.selectedPanel >= 0 ? photoForPanel(state, state.selectedPanel) : null;
  for (const button of photoStrip.querySelectorAll('.is-file')) {
    button.classList.toggle('is-active', Boolean(active) && button.dataset.photoId === active.id);
  }
}

function syncPanelCard() {
  const index = state.selectedPanel;
  const disabled = index < 0;

  if (panelLabel) panelLabel.textContent = disabled ? 'Pick a panel' : `Panel ${index + 1}`;

  if (panelPhoto) {
    const signature = state.photos.map((photo) => photo.id).join('|');
    if (signature !== selectSig) {
      panelPhoto.replaceChildren();
      const cycle = el('option', null, state.photos.length ? 'Cycle from photos' : 'No photos loaded');
      cycle.value = '';
      panelPhoto.append(cycle);
      for (const photo of state.photos) {
        const option = el('option', null, photo.name);
        option.value = photo.id;
        panelPhoto.append(option);
      }
      selectSig = signature;
    }
    panelPhoto.disabled = disabled || !state.photos.length;
    panelPhoto.value = disabled ? '' : state.panelPhotos[index] ?? '';
  }

  const transform = !disabled ? state.transforms[index] : null;
  if (panelZoom) {
    panelZoom.disabled = disabled;
    panelZoom.value = String(transform ? transform.zoom : 1);
  }
  if (zoomValue) zoomValue.textContent = `${(transform ? transform.zoom : 1).toFixed(2)}×`;
  if (resetFocus) resetFocus.disabled = disabled;

  if (panelNote) {
    if (disabled) panelNote.textContent = 'Click a panel on the cover to edit it.';
    else if (!state.photos.length) panelNote.textContent = 'Add a photo to fill this panel.';
    else panelNote.textContent = `Panel ${index + 1} selected — drag to pan, scroll to zoom.`;
  }
}

function syncCaption() {
  setTextValue(inputs.title, state.title);
  setTextValue(inputs.subtitle, state.subtitle);
  setTextValue(inputs.quote, state.quote);
  setTextValue(inputs.volume, state.volume);
  setTextValue(inputs.tagline, state.tagline);
}

function syncRoles() {
  for (const input of rolesWrap.querySelectorAll('input[data-role-index]')) {
    const i = Number(input.dataset.roleIndex);
    if (document.activeElement !== input) input.value = state.roles[i] ?? '';
  }
}

function syncLook() {
  for (const key of ['grade', 'grain', 'bloom']) {
    const input = sliders[key];
    if (input) input.value = String(state[key]);
    if (sliderValues[key]) sliderValues[key].textContent = String(state[key]);
  }
}

/* ------------------------------------------------------------------ interactions */

function wireControls() {
  addPhotosBtn?.addEventListener('click', () => photoInput?.click());
  clearPhotosBtn?.addEventListener('click', clearPhotos);

  photoInput?.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files && files.length) await useFiles(files);
    event.target.value = '';
  });

  panelPhoto?.addEventListener('change', () => {
    if (state.selectedPanel < 0) return;
    setPanelPhoto(state.selectedPanel, panelPhoto.value || null);
  });

  panelZoom?.addEventListener('input', () => {
    if (state.selectedPanel < 0) return;
    patchTransform(state.selectedPanel, { zoom: Number(panelZoom.value) });
  });

  resetFocus?.addEventListener('click', () => {
    if (state.selectedPanel < 0) return;
    patchTransform(state.selectedPanel, { zoom: 1, focusX: null, focusY: null });
  });

  inputs.title?.addEventListener('input', () => update({ title: inputs.title.value.toUpperCase() }));
  inputs.subtitle?.addEventListener('input', () => update({ subtitle: inputs.subtitle.value }));
  inputs.quote?.addEventListener('input', () => update({ quote: inputs.quote.value.toUpperCase() }));
  inputs.volume?.addEventListener('input', () => update({ volume: inputs.volume.value.toUpperCase() }));
  inputs.tagline?.addEventListener('input', () => update({ tagline: inputs.tagline.value.toUpperCase() }));

  for (const key of ['grade', 'grain', 'bloom']) {
    sliders[key]?.addEventListener('input', () => update({ [key]: Number(sliders[key].value) }));
  }

  exportBtn?.addEventListener('click', () => doExport());
  exportBtn2?.addEventListener('click', () => doExport());

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('wheel', onWheel, { passive: false });

  stage.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.hidden = false;
  });
  stage.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dropOverlay.hidden = false;
  });
  stage.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.hidden = true;
  });
  stage.addEventListener('drop', async (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    const files = event.dataTransfer?.files;
    if (files && files.length) await useFiles(files);
  });

  document.addEventListener('keydown', onKeyDown);

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      if (!rafId) requestAnimationFrame(drawPanelOverlay);
    });
    observer.observe(stage);
    observer.observe(canvas);
  }
  window.addEventListener('resize', () => requestAnimationFrame(drawPanelOverlay));
}

function hasFiles(event) {
  const types = event.dataTransfer?.types;
  return Boolean(types && [...types].includes('Files'));
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((event.clientX - rect.left) / rect.width) * state.width;
  const y = ((event.clientY - rect.top) / rect.height) * state.height;
  const { panels } = layoutPanels(state.layout, state.width, state.height);
  const index = panelAt(panels, x, y);
  if (index < 0) return;
  update({ selectedPanel: index });
  drag = { index, lastX: event.clientX, lastY: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
  stage.classList.add('is-dragging');
}

function onPointerMove(event) {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dx = ((event.clientX - drag.lastX) / rect.width) * state.width;
  const dy = ((event.clientY - drag.lastY) / rect.height) * state.height;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;

  const index = drag.index;
  const photo = photoForPanel(state, index);
  const transform = state.transforms[index];
  if (!photo || !transform) return;
  const { panels } = layoutPanels(state.layout, state.width, state.height);
  const panel = panels[index];
  if (!panel) return;
  const focus = panelFocus(panel, transform);
  const fit = coverFit(panel, photo.image, transform.zoom, focus);
  const next = focusForDrag(fit, dx, dy, focus);
  patchTransform(index, { focusX: next.x, focusY: next.y });
}

function onPointerUp() {
  if (!drag) return;
  drag = null;
  stage.classList.remove('is-dragging');
}

function onWheel(event) {
  const index = state.selectedPanel;
  if (index < 0) return;
  event.preventDefault();
  const transform = state.transforms[index];
  if (!transform) return;
  const step = event.deltaY < 0 ? 0.06 : -0.06;
  const zoom = Math.max(1, Math.min(3, transform.zoom + step));
  if (Math.abs(zoom - transform.zoom) > 0.001) patchTransform(index, { zoom });
}

function onKeyDown(event) {
  const target = event.target;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
  ) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key >= '1' && event.key <= String(LAYOUT_ORDER.length)) {
    const layout = LAYOUT_ORDER[Number(event.key) - 1];
    if (layout) {
      event.preventDefault();
      selectLayout(layout);
    }
    return;
  }
  if (event.key === 'e' || event.key === 'E') {
    event.preventDefault();
    doExport();
  }
}

/* ------------------------------------------------------------------ boot */

subscribe(() => {
  state = getState();
  syncControls();
  scheduleDraw();
});

buildSizeChips(sizeChips);
buildSizeStack(sizeStack);
buildLayoutGrid();
buildPaletteRow();
buildRoleInputs();
wireControls();

async function boot() {
  document.body.dataset.ready = '0';
  document.body.dataset.error = '';

  try {
    if (shot.mode) applySceneClass(shot.mode);

    // Fonts first: the title fit measures Anton, so it must be real before the first render.
    const failedFonts = await waitForFonts();
    document.body.dataset.fonts = failedFonts.length ? 'fallback' : 'ready';

    samplePhotos = await loadSamples();
    buildPhotoStrip();
    state = createState({
      ...(shot.mode ? sceneOverrides(shot.mode, shot.query) : {}),
      photos: shot.mode ? await scenePhotos(shot.mode, shot.query) : samplePhotos,
    });
    syncControls();
    drawNow();

    if (shot.mode === 'export' || shot.mode === 'sheet') {
      const result = await exportCover(canvas, state);
      update({ lastExport: result });
      syncControls();
      showResult(shot.mode, { result });
    }

    if (shot.mode) {
      await afterPaint(2);
      markReady();
    } else {
      document.body.dataset.ready = '1';
    }
  } catch (error) {
    markError(error);
  }
}

window.addEventListener('error', (event) => {
  if (document.body.dataset.error) return;
  if (event.error) markError(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  if (document.body.dataset.error) return;
  if (event.reason) markError(event.reason);
});

boot();
