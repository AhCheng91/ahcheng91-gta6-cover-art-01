// Page logic for VICE GRID: builds the inspector from the state store, wires every control, keeps one canvas in sync
// with the state through render.js, exports through exporter.js and runs the ?shot= scenes from shots.js.

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
const sizeChips2 = $('size-chips-2');
const exportBtn = $('export-btn');
const exportBtn2 = $('export-btn-2');
const exportNote = $('export-note');
const cardExport = $('card-export');
const stepper = $('stepper');

const sampleStrip = $('sample-strip');
const photoList = $('photo-list');
const photoCount = $('photo-count');
const photoInput = $('photo-input');
const addPhotosBtn = $('add-photos');
const clearPhotosBtn = $('clear-photos');

const layoutGrid = $('layout-grid');
const paletteRow = $('palette-row');

const panelLabel = $('panel-label');
const panelPhoto = $('panel-photo');
const panelZoom = $('panel-zoom');
const zoomValue = $('zoom-value');
const resetFocus = $('reset-focus');
const panelNote = $('panel-note');

const titleInput = $('caption-title');
const subtitleInput = $('caption-subtitle');
const badgeInputs = [0, 1, 2].map((i) => $(`badge-${i}`));

const gradeInput = $('grade');
const gradeValue = $('grade-value');
const grainInput = $('grain');
const grainValue = $('grain-value');
const bloomInput = $('bloom');
const bloomValue = $('bloom-value');

let samplePhotos = [];
let photoSig = '';
let selectSig = '';
let rafId = 0;
let firstDrawn = false;
let exporting = false;
let drag = null;
let toastTimer = 0;
let dragDepth = 0;

const isShot = Boolean(shot.mode);

/* ---------------------------------------------------------------- small DOM helpers */

function el(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setTextValue(input, value) {
  if (document.activeElement !== input) input.value = value;
}

function panelCount() {
  return layoutById(state.layout).panels.length;
}

function clampPanelSelection(index) {
  if (index < 0) return -1;
  return Math.max(0, Math.min(panelCount() - 1, index));
}

/* ---------------------------------------------------------------- static inspector */

function buildSizeChips(container) {
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

function layoutDiagram(layout) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const band = layout.band;
  for (const [fx, fy, fw, fh] of layout.panels) {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', (fx * 100 + 1).toFixed(2));
    rect.setAttribute('y', (fy * (1 - band) * 100 + 1).toFixed(2));
    rect.setAttribute('width', Math.max(1.5, fw * 100 - 2).toFixed(2));
    rect.setAttribute('height', Math.max(1.5, fh * (1 - band) * 100 - 2).toFixed(2));
    rect.setAttribute('rx', '1.5');
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
    const swatch = el('i');
    swatch.style.background = `linear-gradient(135deg, ${palette.warm}, ${palette.cool})`;
    button.append(swatch, el('span', null, palette.label));
    button.addEventListener('click', () => update({ palette: id }));
    paletteRow.append(button);
  }
}

function buildSampleStrip() {
  sampleStrip.replaceChildren();
  for (const meta of SAMPLES) {
    const photo = samplePhotos.find((item) => item.id === meta.id);
    if (!photo) continue;
    const button = el('button', 'sample');
    button.type = 'button';
    button.dataset.sampleId = meta.id;
    button.setAttribute('aria-pressed', 'false');
    button.title = meta.alt;
    const image = new Image();
    image.src = photo.url;
    image.alt = meta.alt;
    image.decoding = 'async';
    button.append(image, el('span', null, meta.label));
    button.addEventListener('click', () => useSample(meta.id));
    sampleStrip.append(button);
  }
}

function selectLayout(id) {
  update({ layout: id, selectedPanel: clampPanelSelection(state.selectedPanel) });
}

/* ---------------------------------------------------------------- photos */

async function useSample(id) {
  try {
    const photo = samplePhotos.find((item) => item.id === id) ?? (await loadSample(id));
    const merged = addPhotos(state, [photo]);
    const panelPhotos = [...state.panelPhotos];
    if (state.selectedPanel >= 0) panelPhotos[state.selectedPanel] = photo.id;
    update({ photos: merged.photos, panelPhotos });
  } catch (error) {
    toast(`Could not load that sample`);
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

/* ---------------------------------------------------------------- export + toast */

function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2600);
}

function flashExportCard() {
  if (!cardExport) return;
  cardExport.classList.remove('is-flash');
  void cardExport.offsetWidth;
  cardExport.classList.add('is-flash');
  setTimeout(() => cardExport.classList.remove('is-flash'), 800);
}

async function doExport({ download = true } = {}) {
  if (exporting) return null;
  exporting = true;
  try {
    drawNow();
    const result = await exportCover(canvas, state);
    update({ lastExport: result });
    if (download) downloadExport(result);
    if (!isShot) {
      toast(`Saved ${result.name}`);
      flashExportCard();
    }
    return result;
  } catch (error) {
    markError(error);
    toast('Export failed — see the console');
    return null;
  } finally {
    exporting = false;
  }
}

/* ---------------------------------------------------------------- drawing */

function sizeCanvas() {
  if (canvas.width !== state.width || canvas.height !== state.height) {
    canvas.width = state.width;
    canvas.height = state.height;
  }
}

function fitStage() {
  const styles = getComputedStyle(stage);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availableW = Math.max(60, stage.clientWidth - padX);
  const availableH = Math.max(60, stage.clientHeight - padY);
  if (document.body.classList.contains('shot-cover')) {
    const viewportW = stage.clientWidth;
    const viewportH = stage.clientHeight;
    const scale = Math.min(viewportW / state.width, viewportH / state.height);
    stageInner.style.width = '100%';
    stageInner.style.height = '100%';
    canvas.style.width = `${Math.round(state.width * scale)}px`;
    canvas.style.height = `${Math.round(state.height * scale)}px`;
    return;
  }
  canvas.style.width = '';
  canvas.style.height = '';
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
  if (!panel) {
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
    tag.style.marginTop = '0';
  } else {
    tag.style.top = `${top}px`;
    tag.style.transform = 'translateY(-100%)';
    tag.style.marginTop = '-6px';
  }
  tag.hidden = false;
}

/* ---------------------------------------------------------------- inspector sync */

function syncControls() {
  const pressedSize = state.sizeId;
  for (const container of [sizeChips, sizeChips2]) {
    if (!container) continue;
    for (const button of container.children) {
      button.setAttribute('aria-pressed', String(button.dataset.sizeId === pressedSize));
    }
  }

  if (layoutGrid) {
    for (const button of layoutGrid.children) {
      button.setAttribute('aria-pressed', String(button.dataset.layoutId === state.layout));
    }
  }

  if (paletteRow) {
    for (const button of paletteRow.children) {
      button.setAttribute('aria-pressed', String(button.dataset.paletteId === state.palette));
    }
  }

  if (photoCount) photoCount.textContent = `${state.photos.length} loaded`;
  if (sampleStrip) {
    const loaded = new Set(state.photos.map((photo) => photo.id));
    for (const button of sampleStrip.children) {
      button.setAttribute('aria-pressed', String(loaded.has(button.dataset.sampleId)));
    }
  }

  syncPhotoList();
  syncPanelCard();
  syncCaption();
  syncLook();
  syncStepper();

  if (exportNote) {
    exportNote.textContent = `Saves vice-grid-${state.width}x${state.height}.png · nothing leaves this machine`;
  }
}

function syncPhotoList() {
  if (!photoList) return;
  const signature = state.photos.map((photo) => `${photo.id}:${photo.name}`).join('|');
  if (signature !== photoSig) {
    photoList.replaceChildren();
    for (const photo of state.photos) {
      const item = el('li');
      item.dataset.photoId = photo.id;
      const image = new Image();
      image.src = photo.url;
      image.alt = '';
      image.decoding = 'async';
      item.append(image, el('span', 'name', photo.name), el('span', 'tag', photo.source === 'sample' ? 'Sample' : 'File'));
      item.addEventListener('click', () => {
        if (state.selectedPanel >= 0) setPanelPhoto(state.selectedPanel, photo.id);
      });
      photoList.append(item);
    }
    photoSig = signature;
  }
  const active = state.selectedPanel >= 0 ? photoForPanel(state, state.selectedPanel) : null;
  for (const item of photoList.children) {
    item.classList.toggle('is-active', Boolean(active) && item.dataset.photoId === active.id);
  }
}

function syncPanelCard() {
  const index = state.selectedPanel;
  const disabled = index < 0;

  if (panelLabel) {
    panelLabel.textContent = disabled ? 'Pick a panel' : `Panel ${index + 1} / ${panelCount()}`;
  }

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
  if (zoomValue) {
    const zoom = transform ? transform.zoom : 1;
    zoomValue.textContent = `${zoom.toFixed(2).replace(/0$/, '')}×`;
  }
  if (resetFocus) resetFocus.disabled = disabled;

  if (panelNote) {
    if (disabled) panelNote.textContent = 'Click a panel on the cover to edit it.';
    else if (!state.photos.length) panelNote.textContent = 'Add a photo to fill this panel.';
    else panelNote.textContent = 'Drag on the panel to pan it. Scroll to zoom.';
  }
}

function syncCaption() {
  setTextValue(titleInput, state.title);
  setTextValue(subtitleInput, state.subtitle);
  badgeInputs.forEach((input, i) => setTextValue(input, state.badges[i] ?? ''));
}

function syncLook() {
  if (gradeInput) gradeInput.value = String(state.grade);
  if (gradeValue) gradeValue.textContent = String(state.grade);
  if (grainInput) grainInput.value = String(state.grain);
  if (grainValue) grainValue.textContent = String(state.grain);
  if (bloomInput) bloomInput.value = String(state.bloom);
  if (bloomValue) bloomValue.textContent = String(state.bloom);
}

function syncStepper() {
  if (!stepper) return;
  const step = state.lastExport ? 3 : state.photos.length ? 2 : 1;
  for (const node of stepper.querySelectorAll('.step')) {
    const n = Number(node.dataset.step);
    node.classList.toggle('is-active', n === step);
    node.classList.toggle('is-done', n < step);
  }
}

/* ---------------------------------------------------------------- interactions */

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
    const panelPhotos = [...state.panelPhotos];
    panelPhotos[state.selectedPanel] = panelPhoto.value || null;
    update({ panelPhotos });
  });

  panelZoom?.addEventListener('input', () => {
    if (state.selectedPanel < 0) return;
    patchTransform(state.selectedPanel, { zoom: Number(panelZoom.value) });
  });

  resetFocus?.addEventListener('click', () => {
    if (state.selectedPanel < 0) return;
    patchTransform(state.selectedPanel, { zoom: 1, focusX: null, focusY: null });
  });

  titleInput?.addEventListener('input', () => update({ title: titleInput.value }));
  subtitleInput?.addEventListener('input', () => update({ subtitle: subtitleInput.value }));
  badgeInputs.forEach((input, i) => {
    input?.addEventListener('input', () => {
      const badges = [...state.badges];
      badges[i] = input.value;
      update({ badges });
    });
  });

  gradeInput?.addEventListener('input', () => update({ grade: Number(gradeInput.value) }));
  grainInput?.addEventListener('input', () => update({ grain: Number(grainInput.value) }));
  bloomInput?.addEventListener('input', () => update({ bloom: Number(bloomInput.value) }));

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
  const step = event.deltaY < 0 ? 0.08 : -0.08;
  const zoom = Math.max(1, Math.min(2.5, transform.zoom + step));
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
  if (event.key >= '1' && event.key <= '5') {
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

/* ---------------------------------------------------------------- boot */

subscribe(() => {
  state = getState();
  syncControls();
  scheduleDraw();
});

buildSizeChips(sizeChips);
buildSizeChips(sizeChips2);
buildLayoutGrid();
buildPaletteRow();
wireControls();

async function boot() {
  document.body.dataset.ready = '0';
  document.body.dataset.error = '';

  try {
    samplePhotos = await loadSamples();
    buildSampleStrip();
    await waitForFonts();

    if (shot.mode) {
      applySceneClass(shot.mode);
      const photos = await scenePhotos(shot.mode, shot.query);
      update({ photos });
      syncControls();
      drawNow();

      if (shot.mode === 'export' || shot.mode === 'sheet') {
        const result = await exportCover(canvas, state);
        update({ lastExport: result });
        syncControls();
        showResult(shot.mode, { result, caption: result.name });
      }

      await afterPaint(2);
      markReady();
      return;
    }

    update({ photos: samplePhotos });
    syncControls();
    drawNow();
  } catch (error) {
    markError(error);
    console.error(error);
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
