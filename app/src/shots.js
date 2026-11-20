// The ?shot= scenes: deterministic states for screenshots (cover, editor, sheet, export) and the
// helpers that tell the headless browser when the page is ready to capture.
//
// Query params: shot, size, layout, palette, photos=a,b,c, title, subtitle, quote, roles=a|b|c.

import { PALETTES, SIZES, paletteById, layoutById } from './state.js';
import { SAMPLES, loadShotPhotos } from './photos.js';
import { formatBytes } from './exporter.js';

const MODES = new Set(['cover', 'editor', 'sheet', 'export']);

/** Parse ?shot=… into { mode, query }. */
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

/** State overrides for a scene: its post size, layout, palette, caption and role labels. */
export function sceneOverrides(mode, query) {
  const overrides = {};
  const pixels = parseSize(query);
  if (pixels) {
    overrides.width = pixels.width;
    overrides.height = pixels.height;
    const known = SIZES.find((size) => size.width === pixels.width && size.height === pixels.height);
    if (known) overrides.sizeId = known.id;
  }
  const layout = (query.get('layout') ?? '').toLowerCase();
  if (layoutById(layout).id === layout) overrides.layout = layout;
  const preset = (query.get('palette') ?? query.get('preset') ?? '').toLowerCase();
  if (PALETTES[preset]) overrides.palette = preset;
  const title = query.get('title');
  if (title) overrides.title = title.toUpperCase();
  const subtitle = query.get('subtitle');
  if (subtitle) overrides.subtitle = subtitle;
  const quote = query.get('quote');
  if (quote) overrides.quote = quote.toUpperCase();
  const volume = query.get('volume');
  if (volume) overrides.volume = volume.toUpperCase();
  const tagline = query.get('tagline');
  if (tagline) overrides.tagline = tagline.toUpperCase();
  const roles = (query.get('roles') ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  if (roles.length) overrides.roles = roles.map((role) => role.toUpperCase());
  if (mode === 'editor' || mode === 'export') overrides.selectedPanel = 1;
  if (mode === 'cover' || mode === 'sheet') overrides.selectedPanel = -1;
  return overrides;
}

const DEFAULT_PHOTOS = {
  cover: ['solstice', 'neon', 'boss', 'causeway', 'rider', 'car'],
  editor: ['solstice', 'neon', 'boss'],
  export: ['solstice', 'neon', 'boss'],
  sheet: ['car', 'rider', 'causeway'],
};

/** The photos a scene asks for (`photos=street,neon`) or a sensible set for that scene. */
export async function scenePhotos(mode, query) {
  return loadShotPhotos(query, DEFAULT_PHOTOS[mode] ?? DEFAULT_PHOTOS.editor);
}

/** Body classes the stylesheet keys off: shot scenes hide all the editor chrome. */
export function applySceneClass(mode, body = document.body) {
  body.classList.add('has-shot');
  body.classList.add(`shot-${mode}`);
  body.dataset.scene = mode;
}

/**
 * Resolve the fonts the canvas measures with before the first render. A font that fails still
 * leaves the poster drawable through the fallbacks, but it is logged so the shot run shows it.
 */
export async function waitForFonts(doc = document) {
  if (!doc.fonts) return [];
  const specs = ['100px Anton', '100px Pacifico', '100px "Archivo Black"', '600 100px "Barlow Condensed"'];
  const failed = [];
  for (const spec of specs) {
    try {
      const faces = await doc.fonts.load(spec);
      if (!faces || !faces.length) failed.push(spec);
    } catch (error) {
      failed.push(spec);
      console.warn(`font failed to load: ${spec}`, error);
    }
  }
  await doc.fonts.ready;
  for (const spec of failed) console.warn(`font not available, using fallback: ${spec}`);
  return failed;
}

/** Two animation frames: enough for the canvas paint to be on screen when the shot is taken. */
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
  console.error(error);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** The export dialog (shot=export) or a full-bleed gallery of the finished PNG (shot=sheet). */
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
    meta.append(
      el('strong', null, result.name),
      el('span', null, `${result.width} × ${result.height} PNG · ${formatBytes(result.bytes)}`),
    );
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
  const credit = el('p', 'gallery-credit', 'SOLARIS VICE · offline cover art · PNG export');
  gallery.append(figure, credit);
  layer.append(gallery);
}

export { SAMPLES, formatBytes };
