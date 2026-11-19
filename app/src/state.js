// State for the studio: the three post sizes, the five layouts, the five grades, the caption defaults and a tiny
// subscribable store the rest of the app reads from.

export const SIZES = [
  { id: 'square', label: '1080 × 1080', name: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: '1080 × 1350', name: '4:5', width: 1080, height: 1350 },
  { id: 'wide', label: '1920 × 1080', name: '16:9', width: 1920, height: 1080 },
];

export const LAYOUTS = {
  collage: {
    id: 'collage',
    label: 'Collage',
    band: 0.26,
    panels: [
      [0.0, 0.0, 0.3, 0.34],
      [0.305, 0.0, 0.29, 0.34],
      [0.6, 0.0, 0.4, 0.34],
      [0.0, 0.345, 0.44, 0.655],
      [0.445, 0.345, 0.25, 0.655],
      [0.7, 0.345, 0.3, 0.655],
    ],
  },
  triptych: {
    id: 'triptych',
    label: 'Triptych',
    band: 0.22,
    panels: [
      [0.0, 0.0, 0.326, 1.0],
      [0.337, 0.0, 0.326, 1.0],
      [0.674, 0.0, 0.326, 1.0],
    ],
  },
  hero: {
    id: 'hero',
    label: 'Hero',
    band: 0.22,
    panels: [
      [0.34, 0.0, 0.66, 1.0],
      [0.0, 0.0, 0.33, 0.326],
      [0.0, 0.337, 0.33, 0.326],
      [0.0, 0.674, 0.33, 0.326],
    ],
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    band: 0.0,
    panels: [[0.0, 0.0, 1.0, 1.0]],
  },
  nine: {
    id: 'nine',
    label: 'Nine',
    band: 0.22,
    panels: [
      [0.0, 0.0, 0.328, 0.328],
      [0.336, 0.0, 0.328, 0.328],
      [0.672, 0.0, 0.328, 0.328],
      [0.0, 0.336, 0.328, 0.328],
      [0.336, 0.336, 0.328, 0.328],
      [0.672, 0.336, 0.328, 0.328],
      [0.0, 0.672, 0.328, 0.328],
      [0.336, 0.672, 0.328, 0.328],
      [0.672, 0.672, 0.328, 0.328],
    ],
  },
};

export const LAYOUT_ORDER = ['collage', 'triptych', 'hero', 'solo', 'nine'];

export const PALETTES = {
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    warm: '#ff7a3c',
    cool: '#00c8b4',
    accent: '#ffd166',
    exposure: 1,
    saturation: 1,
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    warm: '#ff2d95',
    cool: '#22e0ff',
    accent: '#35f0ff',
    exposure: 1,
    saturation: 1.04,
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    warm: '#ff8a3d',
    cool: '#2a2a8f',
    accent: '#9d8bff',
    exposure: 0.86,
    saturation: 0.96,
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    warm: '#ffc24a',
    cool: '#7a4a12',
    accent: '#ffdf9a',
    exposure: 1.02,
    saturation: 1.02,
  },
  chrome: {
    id: 'chrome',
    label: 'Chrome',
    warm: '#e8e8ff',
    cool: '#3b5bff',
    accent: '#cfe0ff',
    exposure: 1,
    saturation: 0.72,
  },
};

export const PALETTE_ORDER = ['sunset', 'neon', 'midnight', 'gold', 'chrome'];

export const DEFAULT_CAPTION = {
  title: 'SUNSET HEIST',
  subtitle: 'THE CITY NEVER SLEEPS',
  badges: ['VICE CITY', 'OPEN WORLD', '2026'],
  credit: 'MADE WITH VICE GRID',
};

export const DEFAULT_SAMPLES = ['street', 'drive', 'rooftop', 'beach'];

export const MAX_PANELS = 9;

function makeTransforms() {
  return Array.from({ length: MAX_PANELS }, () => ({ zoom: 1, focusX: null, focusY: null }));
}

let current = null;
const listeners = new Set();

/** Creates the one store this app renders from. Overrides are merged over good-looking defaults. */
export function createState(overrides = {}) {
  const size = SIZES.find((item) => item.id === overrides.sizeId) ?? SIZES[0];
  current = {
    sizeId: size.id,
    width: size.width,
    height: size.height,
    layout: 'collage',
    palette: 'sunset',
    grade: 100,
    grain: 62,
    bloom: 68,
    title: DEFAULT_CAPTION.title,
    subtitle: DEFAULT_CAPTION.subtitle,
    badges: [...DEFAULT_CAPTION.badges],
    credit: DEFAULT_CAPTION.credit,
    photos: [],
    panelPhotos: Array(MAX_PANELS).fill(null),
    transforms: makeTransforms(),
    selectedPanel: 0,
    lastExport: null,
  };
  const merged = { ...current, ...overrides };
  merged.badges = [...(overrides.badges ?? current.badges)];
  merged.panelPhotos = [...(overrides.panelPhotos ?? current.panelPhotos)];
  merged.transforms = (overrides.transforms ?? current.transforms).map((t) => ({ ...t }));
  merged.width = overrides.width ?? size.width;
  merged.height = overrides.height ?? size.height;
  current = merged;
  return current;
}

export function getState() {
  return current;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shallow-merges a patch into the store (or a function returning one) and notifies subscribers. */
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

export function paletteById(id) {
  return PALETTES[id] ?? PALETTES.sunset;
}

export function layoutById(id) {
  return LAYOUTS[id] ?? LAYOUTS.collage;
}

export function setSize(state, id) {
  const size = sizeById(id);
  return { sizeId: size.id, width: size.width, height: size.height };
}

/** Replaces one panel's transform without mutating the array in place. */
export function patchTransform(index, patch) {
  const state = getState();
  const transforms = state.transforms.map((t, i) => (i === index ? { ...t, ...patch } : t));
  update({ transforms });
}

/** Points one panel at a photo id (or null to fall back to cycling). */
export function setPanelPhoto(index, photoId) {
  const state = getState();
  const panelPhotos = [...state.panelPhotos];
  panelPhotos[index] = photoId;
  update({ panelPhotos });
}
