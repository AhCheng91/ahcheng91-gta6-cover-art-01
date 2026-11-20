// The store: one subscribable object holds everything the cover and the editor need. Layouts and
// palettes are re-exported here so the rest of the app has a single import for "the poster's
// vocabulary"; the geometry itself lives in panels.js and the colour sets in palette.js.

import { LAYOUTS, LAYOUT_ORDER } from './panels.js';
import { PALETTES, PALETTE_ORDER, paletteById } from './palette.js';

export { LAYOUTS, LAYOUT_ORDER, PALETTES, PALETTE_ORDER, paletteById };

export const SIZES = [
  { id: 'square', label: '1080 × 1080', name: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: '1080 × 1350', name: '4:5', width: 1080, height: 1350 },
  { id: 'wide', label: '1920 × 1080', name: '16:9', width: 1920, height: 1080 },
];

export const MAX_PANELS = 9;

export const DEFAULT_ROLES = ['THE DRIVER', 'THE BOSS', 'THE INSIDER', 'THE RIDER', 'THE COURIER', 'THE LAWYER'];

export const DEFAULT_CAPTION = {
  title: 'SOLARIS VICE',
  subtitle: "summer of '86",
  quote: 'THE HOTTEST SUMMER IN AMERICA',
  volume: 'VOL. 02',
  tagline: 'SIX STRANGERS · ONE COAST · NO WAY BACK',
  roles: [...DEFAULT_ROLES],
  credit: 'A SOLARIS VICE PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED IN YOUR BROWSER',
};

export const DEFAULT_SAMPLES = ['solstice', 'neon', 'boss', 'causeway', 'rider', 'car'];

function makeTransforms() {
  return Array.from({ length: MAX_PANELS }, () => ({ zoom: 1, focusX: null, focusY: null }));
}

let current = null;
const listeners = new Set();

/** Creates the one store. Overrides merge over good-looking defaults. */
export function createState(overrides = {}) {
  const size = SIZES.find((item) => item.id === overrides.sizeId) ?? SIZES[0];
  const base = {
    sizeId: size.id,
    width: overrides.width ?? size.width,
    height: overrides.height ?? size.height,
    layout: 'poster',
    palette: 'sunset',
    grade: 100,
    grain: 55,
    bloom: 60,
    title: DEFAULT_CAPTION.title,
    subtitle: DEFAULT_CAPTION.subtitle,
    quote: DEFAULT_CAPTION.quote,
    volume: DEFAULT_CAPTION.volume,
    tagline: DEFAULT_CAPTION.tagline,
    roles: [...DEFAULT_CAPTION.roles],
    credit: DEFAULT_CAPTION.credit,
    photos: [],
    panelPhotos: Array(MAX_PANELS).fill(null),
    transforms: makeTransforms(),
    selectedPanel: 0,
    lastExport: null,
  };
  const merged = { ...base, ...overrides };
  merged.roles = [...(overrides.roles ?? base.roles)];
  merged.photos = [...(overrides.photos ?? base.photos)];
  merged.panelPhotos = [...(overrides.panelPhotos ?? base.panelPhotos)];
  merged.transforms = (overrides.transforms ?? base.transforms).map((t) => ({ ...t }));
  current = merged;
  return current;
}

export function getState() {
  return current;
}

/** Subscribe to every change. Returns an unsubscribe function. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shallow-merge a patch (or a function returning one) into the store and notify. */
export function update(patch) {
  if (!current) return current;
  const next = typeof patch === 'function' ? patch(current) : patch;
  if (!next) return current;
  current = { ...current, ...next };
  for (const listener of listeners) listener(current);
  return current;
}

export function sizeById(id) {
  return SIZES.find((item) => item.id === id) ?? SIZES[0];
}

export function layoutById(id) {
  return LAYOUTS[id] ?? LAYOUTS.poster;
}

/** The patch that switches post size. */
export function setSize(state, id) {
  const size = sizeById(id);
  return { sizeId: size.id, width: size.width, height: size.height };
}

/** Replace one panel's transform without mutating the array in place. */
export function patchTransform(index, patch) {
  const state = getState();
  if (!state || index < 0) return;
  const transforms = state.transforms.map((t, i) => (i === index ? { ...t, ...patch } : t));
  update({ transforms });
}

/** Point one panel at a photo id (or null to fall back to cycling). */
export function setPanelPhoto(index, photoId) {
  const state = getState();
  if (!state || index < 0) return;
  const panelPhotos = [...state.panelPhotos];
  panelPhotos[index] = photoId;
  update({ panelPhotos });
}

/** Replace one role label without mutating the array in place. */
export function setRole(index, label) {
  const state = getState();
  if (!state) return;
  const roles = [...state.roles];
  roles[index] = label;
  update({ roles });
}
