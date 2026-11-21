import { state, update, SIZES, PALETTES, DEFAULT_PHOTOS } from './state.js';
import { SAMPLES, loadSample } from './photos.js';
import { layoutPanels } from './panels.js';
import { renderCover } from './render.js';
import { exportCover } from './exporter.js';

function $(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function params() {
  try {
    return new URLSearchParams(location.search);
  } catch (err) {
    return new URLSearchParams('');
  }
}

function decode(value) {
  const raw = String(value == null ? '' : value);
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (err) {
    return raw;
  }
}

function hide(element) {
  if (element) element.hidden = true;
}

function hideChrome(mode) {
  hide($('toast'));
  if (mode === 'cover' || mode === 'sheet') {
    hide($('inspector'));
    hide($('stepper'));
    hide($('exportTop'));
    hide(document.querySelector('.topbar'));
    hide(document.querySelector('.hint'));
    hide($('panelTag'));
    hide($('exportSheet'));
  }
  if (mode === 'sheet') {
    hide(document.querySelector('.workspace'));
    hide($('thumbs'));
  }
}

function pickSize(id) {
  const wanted = String(id || '').trim().toLowerCase().replace(/[×*]/g, 'x');
  if (!wanted) return null;
  for (let i = 0; i < SIZES.length; i++) {
    if (SIZES[i].id.toLowerCase() === wanted) return SIZES[i];
  }
  for (let i = 0; i < SIZES.length; i++) {
    if (wanted === SIZES[i].w + 'x' + SIZES[i].h) return SIZES[i];
  }
  return null;
}

function validSample(id) {
  for (let i = 0; i < SAMPLES.length; i++) {
    if (SAMPLES[i].id === id) return id;
  }
  return null;
}

function sampleLabel(id) {
  for (let i = 0; i < SAMPLES.length; i++) {
    if (SAMPLES[i].id === id) return SAMPLES[i].label;
  }
  return String(id || 'Photo');
}

function photoIds(query) {
  const raw = query.get('photos');
  if (!raw) return null;
  const ids = [];
  const parts = raw.split(',');
  for (let i = 0; i < parts.length; i++) {
    const id = validSample(decode(parts[i]).trim());
    if (id) ids.push(id);
  }
  return ids.length ? ids : null;
}

function buildPhotosSync(ids, layout, size, existing) {
  const panels = layoutPanels(layout, size.w, size.h).panels;
  const count = Math.max(1, panels.length);
  const pool = ids && ids.length ? ids : (DEFAULT_PHOTOS.length ? DEFAULT_PHOTOS : ['boss']);
  const photos = [];

  for (let i = 0; i < count; i++) {
    const sampleId = pool[i % pool.length];
    const prior = Array.isArray(existing) ? existing[i] : null;
    const keep = prior && prior.sampleId === sampleId;
    photos.push({
      sampleId,
      file: null,
      img: keep && prior.img ? prior.img : null,
      imgPromise: keep && prior.imgPromise ? prior.imgPromise : null,
      label: (keep && prior.label) || sampleLabel(sampleId),
      zoom: keep && Number.isFinite(prior.zoom) ? prior.zoom : 1,
      focusX: keep && Number.isFinite(prior.focusX) ? prior.focusX : 0.5,
      focusY: keep && Number.isFinite(prior.focusY) ? prior.focusY : 0.42,
      role: panels[i] && panels[i].role ? panels[i].role : (keep && prior.role) || 'THE DRIVER'
    });
  }
  return photos;
}

let readyDone = false;
let readyResolve = null;
const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

function signalReady() {
  if (readyDone) return;
  readyDone = true;
  window.__shotReady = true;
  if (readyResolve) readyResolve();
}

function redrawIfImages() {
  const photos = Array.isArray(state.photos) ? state.photos : [];
  let has = false;
  for (let i = 0; i < photos.length; i++) {
    if (photos[i] && photos[i].img) {
      has = true;
      break;
    }
  }
  if (!has) return;
  const canvas = $('cover');
  if (canvas) {
    try {
      renderCover(canvas, state);
    } catch (err) {
      console.error(err);
    }
  }
  signalReady();
}

function startSceneImages(photos) {
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (!photo || !photo.sampleId || photo.img) continue;
    const index = i;
    const sampleId = photo.sampleId;
    const job = loadSample(sampleId)
      .then((img) => {
        if (!img) return null;
        const current = state.photos;
        if (!current || !current[index] || current[index].sampleId !== sampleId) return null;
        if (current[index].img === img) return img;
        const next = current.slice();
        next[index] = Object.assign({}, next[index], { img });
        update({ photos: next });
        redrawIfImages();
        return img;
      })
      .catch(() => null);
    photos[index] = Object.assign({}, photo, { imgPromise: job });
  }
}

function applyQuery(query) {
  const patch = {};
  const size = pickSize(query.get('size'));
  if (size) patch.sizeId = size.id;

  const layoutId = String(query.get('layout') || '').trim().toLowerCase();
  if (layoutId && ['poster', 'collage', 'triptych', 'hero', 'solo', 'nine'].indexOf(layoutId) >= 0) {
    patch.layout = layoutId;
  }

  const paletteId = String(query.get('palette') || '').trim().toLowerCase();
  if (paletteId && PALETTES[paletteId]) patch.palette = paletteId;

  const captionFields = ['title', 'subtitle', 'quote', 'tagline'];
  const caption = Object.assign({}, state.caption || {});
  let touched = false;
  for (let i = 0; i < captionFields.length; i++) {
    const key = captionFields[i];
    if (!query.has(key)) continue;
    caption[key] = decode(query.get(key));
    touched = true;
  }
  if (touched) patch.caption = caption;

  const resolvedSize =
    pickSize(patch.sizeId) || pickSize(state.sizeId) || SIZES[1] || SIZES[0] || { w: 1080, h: 1350 };
  const resolvedLayout = patch.layout || state.layout || 'poster';
  const ids = photoIds(query);

  let images = Promise.resolve();
  if (ids) {
    const photos = buildPhotosSync(ids, resolvedLayout, resolvedSize, state.photos);
    startSceneImages(photos);
    images = readyPromise;
    patch.photos = photos;
  }

  if (Object.keys(patch).length) update(patch);
  return images;
}

function styleCoverCanvas() {
  if (typeof document === 'undefined') return;
  document.body.classList.add('shot-cover');
  document.body.style.background = '#0b0611';
  const stage = $('stage');
  if (stage) {
    stage.style.position = 'fixed';
    stage.style.inset = '0';
    stage.style.padding = '0';
    stage.style.display = 'grid';
    stage.style.placeItems = 'center';
    stage.style.background = '#0b0611';
  }
  const inner = $('stageInner');
  if (inner) {
    inner.style.width = '100vw';
    inner.style.height = '100vh';
    inner.style.display = 'grid';
    inner.style.placeItems = 'center';
  }
}

function offscreenRender() {
  const canvas = document.createElement('canvas');
  renderCover(canvas, state);
  return canvas;
}

function hideSheet() {
  const sheet = $('exportSheet');
  if (sheet) sheet.hidden = true;
}

async function openExportSheet() {
  const canvas = offscreenRender();
  const result = await exportCover(canvas, state);
  update({ lastExport: result });

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
  const sheet = $('exportSheet');
  if (sheet) sheet.hidden = false;
  return result;
}

function buildGalleryCard(name, caption) {
  const existing = $('shotCard');
  if (existing) existing.remove();

  const card = document.createElement('div');
  card.id = 'shotCard';
  card.style.position = 'fixed';
  card.style.inset = '0';
  card.style.zIndex = '100';
  card.style.display = 'grid';
  card.style.placeItems = 'center';
  card.style.background = '#0b0611';
  card.style.padding = '24px';

  const panel = document.createElement('figure');
  panel.style.margin = '0';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.alignItems = 'center';
  panel.style.gap = '14px';
  panel.style.maxWidth = '92vw';
  panel.style.maxHeight = '92vh';
  panel.style.padding = '18px';
  panel.style.border = '1px solid rgba(255,243,220,0.9)';
  panel.style.borderRadius = '12px';
  panel.style.background = 'linear-gradient(180deg,#1d1029 0%,#150c1e 100%)';
  panel.style.boxShadow = '0 30px 80px rgba(0,0,0,0.7)';

  const img = document.createElement('img');
  img.id = 'shotImage';
  img.alt = name;
  img.style.display = 'block';
  img.style.maxWidth = '100%';
  img.style.maxHeight = '68vh';
  img.style.width = 'auto';
  img.style.height = 'auto';
  img.style.borderRadius = '4px';
  img.style.background = '#1a0d24';

  const file = document.createElement('figcaption');
  file.textContent = name;
  file.style.fontFamily = "'Barlow Condensed', sans-serif";
  file.style.fontSize = '12px';
  file.style.letterSpacing = '0.12em';
  file.style.textTransform = 'uppercase';
  file.style.color = '#a897ad';
  file.style.textAlign = 'center';

  const line = document.createElement('p');
  line.textContent = caption;
  line.style.margin = '0';
  line.style.fontFamily = "'Barlow Condensed', sans-serif";
  line.style.fontSize = '13px';
  line.style.letterSpacing = '0.08em';
  line.style.color = '#fff3dc';
  line.style.textAlign = 'center';

  panel.appendChild(img);
  panel.appendChild(line);
  panel.appendChild(file);
  card.appendChild(panel);
  document.body.appendChild(card);
  return img;
}

/* ------------------------------------------------------------ scene at import */

const QUERY = params();
const SHOT = String(QUERY.get('shot') || '').trim().toLowerCase();
const SCENE = ['cover', 'editor', 'export', 'sheet'].indexOf(SHOT) >= 0 ? SHOT : '';

let sceneImages = Promise.resolve();

if (typeof document !== 'undefined' && SCENE) {
  document.body.dataset.shot = SCENE;

  if (SCENE === 'cover') {
    document.body.classList.add('shot-cover');
    styleCoverCanvas();
    hideChrome('cover');
  } else if (SCENE === 'sheet') {
    hideChrome('sheet');
  } else if (SCENE === 'export') {
    hide($('panelTag'));
    hideSheet();
  } else if (SCENE === 'editor') {
    hideSheet();
  }

  sceneImages = applyQuery(QUERY);

  if (SCENE === 'editor') update({ selected: 1 });

  window.setTimeout(() => {
    if (readyDone) return;
    const canvas = $('cover');
    if (canvas) {
      try {
        renderCover(canvas, state);
      } catch (err) {
        console.error(err);
      }
    }
    signalReady();
  }, 6000);
}

export async function setupShot() {
  if (typeof document === 'undefined' || !SCENE) return;

  if (SCENE === 'cover') {
    document.body.classList.add('shot-cover');
    document.body.dataset.shot = 'cover';
    styleCoverCanvas();
    hideChrome('cover');
  } else if (SCENE === 'editor') {
    document.body.dataset.shot = 'editor';
    hideSheet();
    update({ selected: 1 });
  } else if (SCENE === 'export') {
    document.body.dataset.shot = 'export';
    hide($('panelTag'));
    await sceneImages;
    try {
      await openExportSheet();
    } catch (err) {
      console.error(err);
    }
  } else if (SCENE === 'sheet') {
    document.body.dataset.shot = 'sheet';
    hideChrome('sheet');
    await sceneImages;
    const canvas = offscreenRender();
    const result = await exportCover(canvas, state);
    update({ lastExport: result });
    const caption = (state.caption && state.caption.title ? state.caption.title : 'SOLARIS VICE') +
      (state.caption && state.caption.tagline ? ' — ' + state.caption.tagline : '');
    const img = buildGalleryCard(result.name, caption);
    img.src = result.url;
  } else {
    return;
  }

  await sceneImages;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  signalReady();
}
