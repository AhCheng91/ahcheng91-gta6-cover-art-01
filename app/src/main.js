import {
  state,
  subscribe,
  update,
  SIZES,
  PALETTES,
  LAYOUTS,
  ROLES,
  DEFAULT_CAPTION,
  DEFAULT_PHOTOS
} from './state.js';
import { SAMPLES, loadSample, loadImageFromFile, ensureFonts } from './photos.js';
import { renderCover } from './render.js';
import { exportCover } from './exporter.js';
import { layoutPanels } from './panels.js';
import { setupShot } from './shots.js';

const CREAM = '#FF3E86';

function $(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function sampleLabel(id) {
  for (let i = 0; i < SAMPLES.length; i++) {
    if (SAMPLES[i].id === id) return SAMPLES[i].label;
  }
  return String(id || 'Photo');
}

function currentSize() {
  for (let i = 0; i < SIZES.length; i++) {
    if (SIZES[i].id === state.sizeId) return SIZES[i];
  }
  return SIZES[1] || SIZES[0] || { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350' };
}

function panelRects() {
  const size = currentSize();
  return layoutPanels(state.layout || 'poster', size.w, size.h).panels;
}

function panelCount() {
  return panelRects().length;
}

function clampIndex(value, total) {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(total - 1, value | 0));
}

function photoAt(index) {
  return Array.isArray(state.photos) ? state.photos[index] || null : null;
}

function loadedIndexes() {
  const out = [];
  const photos = Array.isArray(state.photos) ? state.photos : [];
  for (let i = 0; i < photos.length; i++) {
    if (photos[i] && photos[i].img) out.push(i);
  }
  return out;
}

/* ---------------------------------------------------------------- drawing */

let rafId = 0;
let needsDraw = false;

function scheduleDraw() {
  needsDraw = true;
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (!needsDraw) return;
    needsDraw = false;
    draw();
  });
}

function drawSelection(canvas) {
  const shot = document.body && document.body.dataset ? document.body.dataset.shot : '';
  if (shot === 'cover' || shot === 'sheet') return;

  const W = canvas.width;
  const H = canvas.height;
  if (!(W > 0) || !(H > 0)) return;

  const panels = layoutPanels(state.layout || 'poster', W, H).panels;
  if (!panels.length) return;

  const index = clampIndex(state.selected, panels.length);
  const panel = panels[index];
  if (!panel || !(panel.w > 0) || !(panel.h > 0)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const inset = 1.5;
  const x = panel.x + inset;
  const y = panel.y + inset;
  const w = Math.max(1, panel.w - inset * 2);
  const h = Math.max(1, panel.h - inset * 2);
  const cut = Math.max(0, Math.min((panel.cut || 0) - inset, Math.min(w, h)));

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.shadowColor = CREAM;
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const label = 'Panel ' + (index + 1) + ' / ' + panels.length;
  const fontSize = Math.max(11, Math.min(20, 0.012 * W));
  const padX = fontSize * 0.62;
  const padY = fontSize * 0.44;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '600 ' + fontSize + 'px "Barlow Condensed", sans-serif';
  const textW = ctx.measureText(label).width;
  const chipW = Math.min(panel.w - 8, textW + padX * 2);
  const chipH = fontSize + padY * 2;
  const chipX = Math.max(panel.x + 4, Math.min(panel.x + 10, panel.x + panel.w - chipW - 4));
  const chipY = Math.max(panel.y + 4, Math.min(panel.y + 10, panel.y + panel.h - chipH - 4));

  ctx.fillStyle = 'rgba(16,5,24,0.86)';
  ctx.fillRect(chipX, chipY, chipW, chipH);
  ctx.strokeStyle = 'rgba(255,243,220,0.92)';
  ctx.lineWidth = 1;
  ctx.strokeRect(chipX + 0.5, chipY + 0.5, Math.max(0, chipW - 1), Math.max(0, chipH - 1));
  ctx.fillStyle = '#FFF3DC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, chipX + chipW / 2, chipY + chipH / 2 + 0.5, Math.max(0, chipW - 8));
  ctx.restore();
}

let firstPaint = false;

function draw() {
  const canvas = $('cover');
  if (!canvas) return;
  try {
    renderCover(canvas, state);
  } catch (err) {
    console.error('render failed', err);
    return;
  }
  if (!firstPaint) {
    firstPaint = true;
    if (document.body && document.body.dataset) document.body.dataset.ready = '1';
  }
  drawSelection(canvas);

  const tag = $('panelTag');
  if (tag) {
    const total = panelCount();
    const index = clampIndex(state.selected, total);
    tag.textContent = 'Panel ' + (index + 1) + ' / ' + Math.max(1, total);
  }
}

/* -------------------------------------------------------------- inspector */

let thumbKey = '';
let selectKey = '';
let lastStep = 1;

function syncSizeChips() {
  const buttons = document.querySelectorAll('[data-size]');
  for (let i = 0; i < buttons.length; i++) {
    const on = buttons[i].dataset.size === state.sizeId;
    buttons[i].classList.toggle('on', on);
    buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function syncLayoutButtons() {
  const buttons = document.querySelectorAll('[data-layout]');
  for (let i = 0; i < buttons.length; i++) {
    const on = buttons[i].dataset.layout === state.layout;
    buttons[i].classList.toggle('on', on);
    buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function syncPaletteChips() {
  const buttons = document.querySelectorAll('[data-palette]');
  for (let i = 0; i < buttons.length; i++) {
    const on = buttons[i].dataset.palette === state.palette;
    buttons[i].classList.toggle('on', on);
    buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function syncRanges() {
  const grade = $('gradeRange');
  const gradeVal = $('gradeVal');
  if (grade && document.activeElement !== grade) grade.value = String(state.grade);
  if (gradeVal) gradeVal.textContent = String(Math.round(state.grade));

  const grain = $('grainRange');
  const grainVal = $('grainVal');
  if (grain && document.activeElement !== grain) grain.value = String(state.grain);
  if (grainVal) grainVal.textContent = String(Math.round(state.grain));

  const bloom = $('bloomRange');
  const bloomVal = $('bloomVal');
  if (bloom && document.activeElement !== bloom) bloom.value = String(state.bloom);
  if (bloomVal) bloomVal.textContent = String(Math.round(state.bloom));
}

function syncCaption() {
  const caption = state.caption || DEFAULT_CAPTION;
  const inputs = document.querySelectorAll('[data-bind]');
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const key = el.dataset.bind;
    const value = caption[key] == null ? '' : String(caption[key]);
    if (document.activeElement !== el && el.value !== value) el.value = value;
  }
}

function syncPhotoCount() {
  const count = $('photoCount');
  if (count) count.textContent = String(Array.isArray(state.photos) ? state.photos.length : 0);
}

function syncThumbs() {
  const box = $('thumbs');
  if (!box) return;

  const indexes = loadedIndexes();
  let key = '';
  for (let i = 0; i < indexes.length; i++) {
    const photo = state.photos[indexes[i]];
    key += indexes[i] + ':' + (photo.sampleId || '') + ':' + (photo.img && (photo.img.currentSrc || photo.img.src) ? '1' : '0') + '|';
  }

  if (key !== thumbKey) {
    thumbKey = key;
    box.innerHTML = '';
    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      const photo = state.photos[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.dataset.index = String(index);
      button.title = photo.label || sampleLabel(photo.sampleId);
      button.setAttribute('aria-label', button.title);

      const img = document.createElement('img');
      img.className = 'thumbImg';
      img.alt = '';
      img.decoding = 'async';
      img.src = photo.img.currentSrc || photo.img.src;
      button.appendChild(img);

      button.addEventListener('click', () => selectPanel(index));
      box.appendChild(button);
    }
  }

  const selected = clampIndex(state.selected, Math.max(1, panelCount()));
  const children = box.children;
  for (let i = 0; i < children.length; i++) {
    const on = Number(children[i].dataset.index) === selected;
    children[i].classList.toggle('on', on);
    children[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function syncPanelCard() {
  const total = panelCount();
  const index = clampIndex(state.selected, total);
  const photo = photoAt(index);

  const info = $('panelInfo');
  if (info) info.textContent = 'Panel ' + (index + 1) + ' of ' + Math.max(1, total);

  const zoom = $('panelZoom');
  if (zoom) {
    const value = photo && Number.isFinite(photo.zoom) ? photo.zoom : 1;
    if (document.activeElement !== zoom) zoom.value = String(value);
    zoom.setAttribute('aria-valuetext', value.toFixed(2) + '×');
    zoom.title = 'Zoom ' + value.toFixed(2) + '×';
  }

  const select = $('panelPhoto');
  if (select) {
    const indexes = loadedIndexes();
    let key = '';
    for (let i = 0; i < indexes.length; i++) {
      const p = state.photos[indexes[i]];
      key += indexes[i] + ':' + (p.label || p.sampleId || '') + '|';
    }
    if (key !== selectKey) {
      selectKey = key;
      select.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = indexes.length ? 'Choose a photo' : 'Photos load on start';
      select.appendChild(empty);
      for (let i = 0; i < indexes.length; i++) {
        const slot = indexes[i];
        const p = state.photos[slot];
        const option = document.createElement('option');
        option.value = String(slot);
        option.textContent = p.label || sampleLabel(p.sampleId);
        select.appendChild(option);
      }
    }
    select.value = indexes.indexOf(index) >= 0 ? String(index) : '';
  }
}

function syncStepper() {
  const stepper = $('stepper');
  if (!stepper) return;
  const steps = stepper.querySelectorAll('[data-step]');
  for (let i = 0; i < steps.length; i++) {
    const on = Number(steps[i].dataset.step) === lastStep;
    steps[i].classList.toggle('on', on);
    if (on) steps[i].setAttribute('aria-current', 'step');
    else steps[i].removeAttribute('aria-current');
  }
}

function setStep(step) {
  lastStep = step | 0;
  syncStepper();
}

function syncAll() {
  syncSizeChips();
  syncLayoutButtons();
  syncPaletteChips();
  syncRanges();
  syncCaption();
  syncPhotoCount();
  syncThumbs();
  syncPanelCard();
  syncStepper();
}

function buildInspector() {
  if (typeof document === 'undefined') return;
  syncAll();
}

/* ------------------------------------------------------------ interactions */

function selectPanel(index) {
  const total = panelCount();
  update({ selected: clampIndex(index, total) });
  setStep(1);
}

function setLayout(id) {
  const size = currentSize();
  const panels = layoutPanels(id, size.w, size.h).panels;
  const selected = clampIndex(state.selected, panels.length);
  update({ layout: id, selected });
  setStep(1);
}

function setCaption(key, value) {
  const caption = state.caption || DEFAULT_CAPTION;
  if (caption[key] === value) return;
  update({ caption: Object.assign({}, caption, { [key]: value }) });
  setStep(2);
}

function updatePhoto(index, patch) {
  if (!Array.isArray(state.photos) || !state.photos[index]) return;
  const next = state.photos.slice();
  next[index] = Object.assign({}, next[index], patch);
  update({ photos: next });
}

async function addFiles(fileList) {
  const files = Array.prototype.slice.call(fileList || []).filter((file) => {
    return file && /^image\//i.test(file.type || '');
  });
  if (!files.length) return;

  const added = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const img = await loadImageFromFile(files[i]);
      added.push({
        sampleId: null,
        file: files[i],
        img,
        label: files[i].name,
        zoom: 1,
        focusX: 0.5,
        focusY: 0.42,
        role: ROLES[(state.photos.length + added.length) % ROLES.length]
      });
    } catch (err) {
      console.error(err);
    }
  }
  if (!added.length) return;
  update({ photos: state.photos.concat(added) });
  setStep(1);
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
    scaleX: canvas.width / rect.width,
    scaleY: canvas.height / rect.height
  };
}

function hitPanel(x, y) {
  const canvas = $('cover');
  if (!canvas || !(canvas.width > 0)) return -1;
  const panels = layoutPanels(state.layout || 'poster', canvas.width, canvas.height).panels;
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;

function bindStage() {
  const stage = $('stage');
  const canvas = $('cover');
  if (!stage) return;

  stage.addEventListener('pointerdown', (event) => {
    if (!canvas || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const shot = document.body && document.body.dataset ? document.body.dataset.shot : '';
    if (shot === 'cover' || shot === 'sheet') return;

    const point = canvasPoint(event, canvas);
    if (!point) return;

    const hit = hitPanel(point.x, point.y);
    if (hit >= 0) selectPanel(hit);

    const total = panelCount();
    const index = clampIndex(state.selected, total);
    const panels = layoutPanels(state.layout || 'poster', canvas.width, canvas.height).panels;
    const panel = panels[index];
    if (!panel) return;

    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scaleX: point.scaleX,
      scaleY: point.scaleY,
      w: panel.w,
      h: panel.h,
      index
    };
    if (stage.setPointerCapture) {
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (err) {
        console.error(err);
      }
    }
    event.preventDefault();
  });

  stage.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const photo = photoAt(drag.index);
    if (!photo) return;

    const dx = (event.clientX - drag.x) * drag.scaleX;
    const dy = (event.clientY - drag.y) * drag.scaleY;
    const focusX = Math.max(0, Math.min(1, (Number.isFinite(photo.focusX) ? photo.focusX : 0.5) + dx / drag.w));
    const focusY = Math.max(0, Math.min(1, (Number.isFinite(photo.focusY) ? photo.focusY : 0.42) + dy / drag.h));

    updatePhoto(drag.index, { focusX, focusY });
    drag.x = event.clientX;
    drag.y = event.clientY;
    event.preventDefault();
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    if (stage.releasePointerCapture) {
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (err) {
        console.error(err);
      }
    }
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener(
    'wheel',
    (event) => {
      if (!canvas) return;
      const shot = document.body && document.body.dataset ? document.body.dataset.shot : '';
      if (shot === 'cover' || shot === 'sheet') return;
      event.preventDefault();

      const index = clampIndex(state.selected, panelCount());
      const photo = photoAt(index);
      if (!photo) return;
      const current = Number.isFinite(photo.zoom) ? photo.zoom : 1;
      const next = Math.max(1, Math.min(2.5, current + (event.deltaY < 0 ? 0.08 : -0.08)));
      updatePhoto(index, { zoom: next });
    },
    { passive: false }
  );

  const overlay = $('dropOverlay');
  const hasFiles = (event) => {
    const types = event.dataTransfer && event.dataTransfer.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'Files') return true;
    }
    return false;
  };

  stage.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (overlay) overlay.classList.add('on');
  });
  stage.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (overlay) overlay.classList.add('on');
  });
  stage.addEventListener('dragleave', (event) => {
    if (event.target !== stage) return;
    if (overlay) overlay.classList.remove('on');
  });
  stage.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (overlay) overlay.classList.remove('on');
    addFiles(event.dataTransfer.files);
  });
}

function bindControls() {
  const sizeButtons = document.querySelectorAll('[data-size]');
  for (let i = 0; i < sizeButtons.length; i++) {
    sizeButtons[i].addEventListener('click', () => {
      const id = sizeButtons[i].dataset.size;
      if (!id || id === state.sizeId) return;
      update({ sizeId: id });
    });
  }

  const layoutButtons = document.querySelectorAll('[data-layout]');
  for (let i = 0; i < layoutButtons.length; i++) {
    layoutButtons[i].addEventListener('click', () => {
      const id = layoutButtons[i].dataset.layout;
      if (!id || id === state.layout) return;
      setLayout(id);
    });
  }

  const paletteButtons = document.querySelectorAll('[data-palette]');
  for (let i = 0; i < paletteButtons.length; i++) {
    paletteButtons[i].addEventListener('click', () => {
      const id = paletteButtons[i].dataset.palette;
      if (!id || !PALETTES[id] || id === state.palette) return;
      update({ palette: id });
    });
  }

  bindRange('gradeRange', 'grade', 'gradeVal');
  bindRange('grainRange', 'grain', 'grainVal');
  bindRange('bloomRange', 'bloom', 'bloomVal');

  const captionInputs = document.querySelectorAll('[data-bind]');
  for (let i = 0; i < captionInputs.length; i++) {
    const input = captionInputs[i];
    input.addEventListener('input', () => setCaption(input.dataset.bind, input.value));
  }

  const panelZoom = $('panelZoom');
  if (panelZoom) {
    panelZoom.addEventListener('input', () => {
      const index = clampIndex(state.selected, panelCount());
      const value = Math.max(1, Math.min(2.5, Number(panelZoom.value) || 1));
      updatePhoto(index, { zoom: value });
      panelZoom.setAttribute('aria-valuetext', value.toFixed(2) + '×');
    });
  }

  const reset = $('resetFocus');
  if (reset) {
    reset.addEventListener('click', () => {
      const index = clampIndex(state.selected, panelCount());
      updatePhoto(index, { focusX: 0.5, focusY: 0.42, zoom: 1 });
      setStep(1);
    });
  }

  const panelPhoto = $('panelPhoto');
  if (panelPhoto) {
    panelPhoto.addEventListener('change', () => {
      const chosen = Number(panelPhoto.value);
      if (!Number.isFinite(chosen) || !state.photos[chosen]) return;
      const index = clampIndex(state.selected, panelCount());
      const current = state.photos[index];
      if (!current) return;
      const next = state.photos.slice();
      next[index] = Object.assign({}, state.photos[chosen], { role: current.role });
      update({ photos: next });
      setStep(1);
    });
  }

  const add = $('addPhotos');
  const fileInput = $('fileInput');
  if (add && fileInput) {
    add.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      addFiles(fileInput.files);
      fileInput.value = '';
    });
  }

  const clear = $('clearPhotos');
  if (clear) {
    clear.addEventListener('click', () => {
      update({ photos: [], selected: 0 });
      setStep(1);
    });
  }

  const exportTop = $('exportTop');
  if (exportTop) exportTop.addEventListener('click', () => doExport());
  const exportSide = $('exportSide');
  if (exportSide) exportSide.addEventListener('click', () => doExport());

  const closeSheet = $('closeSheet');
  if (closeSheet) closeSheet.addEventListener('click', hideSheet);

  bindStage();

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === 'Escape') {
      hideSheet();
      return;
    }
    if (event.key >= '1' && event.key <= '6') {
      const layout = LAYOUTS[Number(event.key) - 1];
      if (layout) {
        event.preventDefault();
        setLayout(layout.id);
      }
      return;
    }
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      doExport();
    }
  });

  subscribe(() => {
    syncAll();
    scheduleDraw();
  });
}

function bindRange(inputId, key, valueId) {
  const input = $(inputId);
  const value = $(valueId);
  if (!input) return;
  input.addEventListener('input', () => {
    const next = Number(input.value);
    if (!Number.isFinite(next)) return;
    update({ [key]: next });
    if (value) value.textContent = String(Math.round(next));
    setStep(1);
  });
}

/* ------------------------------------------------------------------ export */

let toastTimer = 0;

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('on');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('on');
    toastTimer = 0;
  }, 2600);
}

function hideSheet() {
  const sheet = $('exportSheet');
  if (sheet) sheet.hidden = true;
}

function download(result) {
  if (!result || !result.url) return;
  const anchor = document.createElement('a');
  anchor.href = result.url;
  anchor.download = result.name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function doExport() {
  try {
    const clean = document.createElement('canvas');
    renderCover(clean, state);
    const result = await exportCover(clean, state);
    update({ lastExport: result });

    const sheet = $('exportSheet');
    const img = $('exportImg');
    const meta = $('exportMeta');
    if (img) img.src = result.url;
    if (meta) {
      meta.textContent =
        result.name +
        ' · ' +
        result.width +
        ' × ' +
        result.height +
        ' · ' +
        Math.max(1, Math.round(result.bytes / 1024)) +
        ' KB';
    }
    if (sheet) sheet.hidden = false;

    showToast('Saved ' + result.name);
    setStep(3);
    download(result);
  } catch (err) {
    console.error(err);
    showToast('Export failed');
  }
}

/* -------------------------------------------------------------------- boot */

const sampleCache = new Map();

function getSample(id) {
  if (!sampleCache.has(id)) {
    sampleCache.set(
      id,
      loadSample(id).catch(() => null)
    );
  }
  return sampleCache.get(id);
}

function assignImage(index, sampleId, img) {
  const photos = state.photos;
  if (!Array.isArray(photos) || !photos[index] || photos[index].sampleId !== sampleId) return;
  if (photos[index].img === img) return;
  const next = photos.slice();
  next[index] = Object.assign({}, next[index], { img });
  update({ photos: next });
}

function fillPhotos() {
  const size = currentSize();
  const base = Array.isArray(state.photos) && state.photos.length
    ? state.photos.slice()
    : DEFAULT_PHOTOS.map((id, i) => ({
        sampleId: id,
        file: null,
        img: null,
        label: sampleLabel(id),
        zoom: 1,
        focusX: 0.5,
        focusY: 0.42,
        role: ROLES[i % ROLES.length]
      }));
  const slots = Math.max(base.length, layoutPanels(state.layout || 'poster', size.w, size.h).panels.length);

  const photos = [];
  for (let i = 0; i < slots; i++) {
    const source = base[i % base.length] || {};
    const sampleId = source.sampleId || DEFAULT_PHOTOS[i % DEFAULT_PHOTOS.length];
    const photo = {
      sampleId,
      file: source.file || null,
      img: source.img || null,
      imgPromise: i < base.length ? source.imgPromise || null : null,
      label: source.label || sampleLabel(sampleId),
      zoom: Number.isFinite(source.zoom) ? source.zoom : 1,
      focusX: Number.isFinite(source.focusX) ? source.focusX : 0.5,
      focusY: Number.isFinite(source.focusY) ? source.focusY : 0.42,
      role: source.role || ROLES[i % ROLES.length]
    };
    photos.push(photo);

    if (photo.img || photo.imgPromise) continue;
    const index = i;
    const job = getSample(sampleId)
      .then((img) => {
        if (!img) return null;
        assignImage(index, sampleId, img);
        scheduleDraw();
        return img;
      })
      .catch(() => null);
    photos[index].imgPromise = job;
  }

  update({ photos });
}

async function boot() {
  await Promise.race([
    ensureFonts().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);

  draw();
  buildInspector();
  bindControls();

  try {
    await setupShot();
  } catch (err) {
    console.error(err);
  }

  scheduleDraw();

  try {
    fillPhotos();
  } catch (err) {
    console.error(err);
  }

  draw();
  syncAll();

  const redraw = () => {
    syncAll();
    draw();
  };
  window.setTimeout(redraw, 400);
  window.setTimeout(redraw, 1200);
  window.setTimeout(redraw, 2500);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot();
    });
  } else {
    boot();
  }
}

export { boot, draw, doExport, scheduleDraw, syncAll, setStep };
