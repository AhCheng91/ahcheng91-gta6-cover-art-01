export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: '1920 × 1080' }
];

export const PALETTES = {
  sunset: { id: 'sunset', name: 'Sunset', warm: '#ff7a3c', cool: '#00c8b4', accent: '#ff3e86', ink: '#150a26', paper: '#fff3dc' },
  neon: { id: 'neon', name: 'Neon', warm: '#ff2d95', cool: '#22e0ff', accent: '#ff3e86', ink: '#150a26', paper: '#fff3dc' },
  midnight: { id: 'midnight', name: 'Midnight', warm: '#ff8a3d', cool: '#2a2a8f', accent: '#ff5aa0', ink: '#150a26', paper: '#fff3dc' },
  gold: { id: 'gold', name: 'Gold', warm: '#ffc24a', cool: '#7a4a12', accent: '#f5c542', ink: '#150a26', paper: '#fff3dc' },
  chrome: { id: 'chrome', name: 'Chrome', warm: '#e8e8ff', cool: '#3b5bff', accent: '#9fc7ff', ink: '#150a26', paper: '#fff3dc' }
};

export const LAYOUTS = [
  { id: 'poster', name: 'Poster', blurb: 'Hero centre, six framed supporting faces' },
  { id: 'collage', name: 'Collage', blurb: 'Two wide frames over four smaller cuts' },
  { id: 'triptych', name: 'Triptych', blurb: 'Three even columns, full height' },
  { id: 'hero', name: 'Hero', blurb: 'One big frame with a stacked right rail' },
  { id: 'solo', name: 'Solo', blurb: 'A single full-bleed portrait' },
  { id: 'nine', name: 'Nine', blurb: 'A three by three contact sheet' }
];

export const ROLES = [
  'THE DRIVER',
  'THE BOSS',
  'THE INSIDER',
  'THE RIDER',
  'THE COURIER',
  'THE LAWYER',
  'THE MECHANIC'
];

export const DEFAULT_CAPTION = {
  title: 'SOLARIS VICE',
  subtitle: "summer of '86",
  quote: 'THE HOTTEST SUMMER IN AMERICA',
  quoteSource: 'SOLARIS WEEKLY',
  tagline: 'SIX STRANGERS · ONE COAST · NO WAY BACK',
  volume: 'VOL. 02',
  credits: [
    'A SUNSET PICTURES PRODUCTION · STARRING YOU',
    'SHOT ON YOUR OWN CAMERA · GRADED IN YOUR BROWSER'
  ]
};

export const DEFAULT_PHOTOS = ['boss', 'street', 'beach', 'neon', 'car', 'causeway', 'drive'];

const SAMPLE_LABELS = {
  boss: 'The Boss',
  street: 'The Street',
  beach: 'The Beach',
  neon: 'The Neon',
  car: 'The Car',
  causeway: 'The Causeway',
  drive: 'The Drive',
  rider: 'The Rider',
  rooftop: 'The Rooftop',
  solstice: 'The Solstice'
};

function labelForSample(id) {
  return SAMPLE_LABELS[id] || String(id || 'Photo');
}

export function createState() {
  return {
    sizeId: '1920x1080',
    layout: 'poster',
    palette: 'sunset',
    caption: { ...DEFAULT_CAPTION, credits: [...DEFAULT_CAPTION.credits] },
    photos: DEFAULT_PHOTOS.map((id, i) => ({
      sampleId: id,
      file: null,
      img: null,
      label: labelForSample(id),
      zoom: 1,
      focusX: 0.5,
      focusY: 0.42,
      role: ROLES[i % ROLES.length]
    })),
    selected: 0,
    grade: 100,
    grain: 55,
    bloom: 60,
    lastExport: null,
    toast: null
  };
}

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(patchOrFn) {
  const prev = state;
  const next = typeof patchOrFn === 'function' ? patchOrFn(prev) || prev : { ...prev, ...patchOrFn };
  state = next;
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (err) {
      console.error(err);
    }
  });
  return state;
}

export let state = createState();
