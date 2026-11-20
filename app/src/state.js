import { SAMPLES } from './photos.js';

export const SIZES = [
  { id: '1:1', width: 1080, height: 1080, label: '1080 × 1080' },
  { id: '4:5', width: 1080, height: 1350, label: '1080 × 1350' },
  { id: '16:9', width: 1920, height: 1080, label: '1920 × 1080' }
];

export const LAYOUTS = {
  poster: {
    label: 'Poster',
    panels: {
      portrait: [
        [0, 0, 0.34, 0.5],
        [0.345, 0, 0.325, 0.5],
        [0.675, 0, 0.325, 0.5],
        [0, 0.505, 0.25, 0.495],
        [0.255, 0.505, 0.3, 0.495],
        [0.56, 0.505, 0.44, 0.495]
      ],
      landscape: [
        [0, 0, 0.34, 0.46],
        [0.345, 0, 0.325, 0.46],
        [0.675, 0, 0.325, 0.46],
        [0, 0.465, 0.25, 0.535],
        [0.255, 0.465, 0.3, 0.535],
        [0.56, 0.465, 0.44, 0.535]
      ]
    }
  },
  collage: {
    label: 'Collage',
    panels: [
      [0, 0, 0.3, 0.34],
      [0.305, 0, 0.29, 0.34],
      [0.6, 0, 0.4, 0.34],
      [0, 0.345, 0.44, 0.655],
      [0.445, 0.345, 0.25, 0.655],
      [0.7, 0.345, 0.3, 0.655]
    ]
  },
  triptych: {
    label: 'Triptych',
    panels: [
      [0, 0, 0.326, 1],
      [0.337, 0, 0.326, 1],
      [0.674, 0, 0.326, 1]
    ]
  },
  hero: {
    label: 'Hero',
    panels: [
      [0.34, 0, 0.66, 1],
      [0, 0, 0.33, 0.326],
      [0, 0.337, 0.33, 0.326],
      [0, 0.674, 0.33, 0.326]
    ]
  },
  solo: {
    label: 'Solo',
    panels: [[0, 0, 1, 1]]
  },
  nine: {
    label: 'Nine',
    panels: [
      [0, 0, 0.33, 0.33],
      [0.335, 0, 0.33, 0.33],
      [0.67, 0, 0.33, 0.33],
      [0, 0.335, 0.33, 0.33],
      [0.335, 0.335, 0.33, 0.33],
      [0.67, 0.335, 0.33, 0.33],
      [0, 0.67, 0.33, 0.33],
      [0.335, 0.67, 0.33, 0.33],
      [0.67, 0.67, 0.33, 0.33]
    ]
  }
};

export const LAYOUT_ORDER = ['poster', 'collage', 'triptych', 'hero', 'solo', 'nine'];

export const DEFAULT_CAPTION = {
  title: 'SOLARIS VICE',
  subtitle: "summer of '86",
  quote: 'THE HOTTEST SUMMER IN AMERICA',
  volume: 'VOL. 02',
  tagline: 'SIX STRANGERS · ONE COAST · NO WAY BACK',
  credit: 'A SOLARIS VICE PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED IN YOUR BROWSER',
  roles: ['THE DRIVER', 'THE BOSS', 'THE INSIDER', 'THE RIDER', 'THE COURIER', 'THE LAWYER']
};

const DEFAULT_TRANSFORMS = {
  solstice: { focus: { x: 0.52, y: 0.38 }, zoom: 1.06 },
  neon: { focus: { x: 0.52, y: 0.36 }, zoom: 1.08 },
  boss: { focus: { x: 0.58, y: 0.34 }, zoom: 1.05 },
  causeway: { focus: { x: 0.38, y: 0.32 }, zoom: 1.1 },
  rider: { focus: { x: 0.55, y: 0.34 }, zoom: 1.06 },
  car: { focus: { x: 0.5, y: 0.55 }, zoom: 1.02 },
  street: { focus: { x: 0.5, y: 0.4 }, zoom: 1.0 },
  beach: { focus: { x: 0.5, y: 0.4 }, zoom: 1.0 },
  rooftop: { focus: { x: 0.5, y: 0.35 }, zoom: 1.0 },
  drive: { focus: { x: 0.5, y: 0.5 }, zoom: 1.0 }
};

const PHOTO_ORDER = [
  'solstice',
  'neon',
  'boss',
  'causeway',
  'rider',
  'car',
  'street',
  'beach',
  'rooftop',
  'drive'
];

function sampleFor(id) {
  return SAMPLES.find((s) => s.id === id) || { id, file: `samples/photo-${id}.jpg`, url: `samples/photo-${id}.jpg`, label: id };
}

function defaultPhoto(id) {
  const sample = sampleFor(id);
  return { id, url: sample.url || sample.file, image: null, label: sample.label };
}

function defaultTransform(id) {
  const t = DEFAULT_TRANSFORMS[id] || { focus: { x: 0.5, y: 0.5 }, zoom: 1 };
  return { focus: { x: t.focus.x, y: t.focus.y }, zoom: t.zoom };
}

function fieldRect(layoutId, width, height) {
  const m = 0.016 * Math.min(width, height);
  const inner = { x: m, y: m, w: width - 2 * m, h: height - 2 * m };
  if (layoutId === 'solo') return { ...inner };
  const top = 0.062 * inner.h;
  const bottom = 0.098 * inner.h;
  return { x: inner.x, y: inner.y + top, w: inner.w, h: inner.h - top - bottom };
}

export function panelsFor(layoutId, width, height) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.poster;
  let rects = layout.panels;
  if (!Array.isArray(rects)) {
    rects = width > height ? rects.landscape : rects.portrait;
  }
  const field = fieldRect(layoutId, width, height);
  const gutter = 0.0055 * Math.min(width, height);
  const half = gutter / 2;
  return rects.map((r, index) => ({
    x: field.x + r[0] * field.w + half,
    y: field.y + r[1] * field.h + half,
    w: Math.max(1, r[2] * field.w - gutter),
    h: Math.max(1, r[3] * field.h - gutter),
    index
  }));
}

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) || SIZES[0];
}

export function layoutById(id) {
  return LAYOUTS[id] ? { id, ...LAYOUTS[id] } : { id: 'poster', ...LAYOUTS.poster };
}

export function createState(overrides = {}) {
  const size = sizeById(overrides.sizeId || '16:9');
  const caption = {
    ...DEFAULT_CAPTION,
    ...(overrides.caption || {}),
    roles: [...((overrides.caption && overrides.caption.roles) || DEFAULT_CAPTION.roles)]
  };
  const photos = overrides.photos
    ? overrides.photos.map((p) => (typeof p === 'string' ? defaultPhoto(p) : { ...p }))
    : PHOTO_ORDER.map(defaultPhoto);
  const transforms = overrides.transforms
    ? overrides.transforms.map((t) => ({
        focus: { x: t.focus.x, y: t.focus.y },
        zoom: t.zoom
      }))
    : photos.map((p) => defaultTransform(p.id));
  return {
    sizeId: size.id,
    layoutId: overrides.layoutId || 'poster',
    paletteId: overrides.paletteId || 'sunset',
    grade: overrides.grade != null ? overrides.grade : 100,
    grain: overrides.grain != null ? overrides.grain : 55,
    bloom: overrides.bloom != null ? overrides.bloom : 60,
    width: size.width,
    height: size.height,
    caption,
    roles: [...caption.roles],
    photos,
    transforms,
    selected: overrides.selected != null ? overrides.selected : 0
  };
}

let current = createState();
const subscribers = new Set();

export function getState() {
  return current;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function mergeState(state, patch) {
  const next = { ...state, ...patch };
  if (patch.caption) {
    next.caption = {
      ...state.caption,
      ...patch.caption,
      roles: [...((patch.caption.roles) || state.caption.roles)]
    };
  }
  if (patch.roles) next.roles = [...patch.roles];
  if (patch.photos) next.photos = patch.photos.map((p) => ({ ...p }));
  if (patch.transforms) {
    next.transforms = patch.transforms.map((t) => ({
      focus: { x: t.focus.x, y: t.focus.y },
      zoom: t.zoom
    }));
  }
  return next;
}

export function update(patch) {
  current = mergeState(current, patch);
  subscribers.forEach((fn) => fn(current));
  return current;
}

export function setSize(state, id) {
  const size = sizeById(id);
  return { ...state, sizeId: size.id, width: size.width, height: size.height };
}

export function patchTransform(state, index, patch) {
  const transforms = state.transforms.map((t, i) => {
    if (i !== index) return t;
    return {
      focus: { ...t.focus, ...(patch.focus || {}) },
      zoom: patch.zoom != null ? patch.zoom : t.zoom
    };
  });
  return { ...state, transforms };
}

export function setPanelPhoto(state, index, photoId) {
  const photos = state.photos.map((p, i) => {
    if (i !== index) return p;
    const sample = sampleFor(photoId);
    return { id: photoId, url: sample.url || sample.file, image: null, label: sample.label };
  });
  const transforms = state.transforms.map((t, i) => (i === index ? defaultTransform(photoId) : t));
  return { ...state, photos, transforms };
}
