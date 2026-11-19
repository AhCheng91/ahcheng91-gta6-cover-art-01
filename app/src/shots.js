// The ?shot= scenes: deterministic states for screenshots (cover, editor, export, sheet) and the helpers that
// report readiness back to the headless browser.

import { PALETTES, SIZES } from './state.js';
import { loadShotPhotos } from './photos.js';
import { formatBytes } from './exporter.js';

const MODES = new Set(['cover', 'editor', 'export', 'sheet']);

export function readShot(search) {
  const query = new URLSearchParams(search);
  const mode = (query.get('shot') ?? '').toLowerCase();
  return { mode: MODES.has(mode) ? mode : null, query };
}

function parseSize(query) {
  const raw = (query.get('size') ?? '').toLowerCase().replace(/\s+/g, '');
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(raw);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** State overrides for a scene: its post size, palette, caption and selected panel. */
export function sceneOverrides(mode, query) {
  const overrides = {};
  const pixels = parseSize(query);
  if (pixels) {
    overrides.width = pixels.width;
    overrides.height = pixels.height;
    const known = SIZES.find((size) => size.width === pixels.width && size.height === pixels.height);
    if (known) overrides.sizeId = known.id;
  }
  const preset = (query.get('preset') ?? '').toLowerCase();
  if (PALETTES[preset]) overrides.palette = preset;
  const title = query.get('title') ?? query.get('caption');
  if (title) overrides.title = title.toUpperCase();
  const subtitle = query.get('subtitle');
  if (subtitle) overrides.subtitle = subtitle.toUpperCase();
  if (mode === 'editor' || mode === 'export') overrides.selectedPanel = 1;
  if (mode === 'cover' || mode === 'sheet') overrides.selectedPanel = -1;
  return overrides;
}

const DEFAULT_PHOTOS = {
  cover: ['street', 'beach', 'drive'],
  editor: ['street', 'rooftop', 'beach'],
  export: ['street', 'drive', 'rooftop'],
  sheet: ['drive', 'street', 'rooftop'],
};

/** The photos a scene asks for (`photos=street,beach`) or a sensible set for that scene. */
export async function scenePhotos(mode, query) {
  return loadShotPhotos(query, DEFAULT_PHOTOS[mode] ?? DEFAULT_PHOTOS.editor);
}

/** Body classes the stylesheet keys off: cover hides all chrome, sheet hides the workspace behind a gallery. */
export function applySceneClass(mode, body = document.body) {
  body.classList.add('has-shot');
  body.classList.add(`shot-${mode}`);
}

/** Resolves once the web fonts the canvas measures with are actually available. */
export async function waitForFonts(doc = document) {
  if (!doc.fonts) return;
  try {
    await Promise.all([
      doc.fonts.load('64px "Anton"'),
      doc.fonts.load('16px "Barlow Condensed"'),
      doc.fonts.load('16px "Archivo Black"'),
    ]);
    await doc.fonts.ready;
  } catch {
    /* a font that fails still leaves the canvas drawable with fallbacks */
  }
}

/** Two animation frames: enough for the canvas paint to be on screen when the screenshot is taken. */
export function afterPaint(frames = 2) {
  return new Promise((resolve) => {
    let left = frames;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function markReady(doc = document) {
  doc.body.dataset.ready = '1';
  doc.body.dataset.error = '';
  window.__shotReady = true;
}

export function markError(error, doc = document) {
  const message = error && error.message ? error.message : String(error);
  doc.body.dataset.ready = '0';
  doc.body.dataset.error = message;
  window.__shotReady = true;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Renders a result sheet (export modal) or the gallery view (sheet) from an exported PNG. */
export function showResult(mode, { result, caption }, layer = document.getElementById('shot-layer')) {
  if (!layer || !result) return;
  layer.replaceChildren();
  layer.hidden = false;

  if (mode === 'export') {
    const sheet = el('div', 'result-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Exported cover');
    const card = el('div', 'result-card');
    const image = el('img', 'result-image');
    image.src = result.url;
    image.alt = 'The exported cover';
    const meta = el('div', 'result-meta');
    meta.append(el('strong', null, result.name), el('span', null, `${result.width} × ${result.height} PNG · ${formatBytes(result.bytes)}`));
    const actions = el('div', 'result-actions');
    const close = el('button', 'btn btn-primary', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => {
      layer.replaceChildren();
      layer.hidden = true;
    });
    actions.append(close);
    card.append(image, meta, actions);
    sheet.append(card);
    layer.append(sheet);
    close.focus({ preventScroll: true });
    return;
  }

  const gallery = el('div', 'gallery');
  const figure = el('figure', 'gallery-figure');
  const image = el('img', 'gallery-image');
  image.src = result.url;
  image.alt = 'The exported cover';
  const figcaption = el('figcaption', 'gallery-caption');
  figcaption.append(
    el('strong', null, result.name),
    el('span', null, caption ?? `${result.width} × ${result.height} PNG · ${formatBytes(result.bytes)}`),
  );
  figure.append(image, figcaption);
  const credit = el('p', 'gallery-credit', 'VICE GRID · offline cover art · PNG export');
  gallery.append(figure, credit);
  layer.append(gallery);
}

export { formatBytes };
