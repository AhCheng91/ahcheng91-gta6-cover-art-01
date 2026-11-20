// Photos in, photos out: the bundled sample manifest, decoding from samples or user files, and the
// rule that fills panels from the loaded list (panel n gets photo n, cycling).

export const SAMPLES = [
  { id: 'street', file: 'photo-street.jpg', label: 'Boulevard', alt: 'Woman leaning on a cream convertible on a palm-lined street' },
  { id: 'beach', file: 'photo-beach.jpg', label: 'Beach', alt: 'Man in a floral shirt on a sunset boardwalk' },
  { id: 'rooftop', file: 'photo-rooftop.jpg', label: 'Rooftop', alt: 'Woman in a red dress on a neon rooftop at dusk' },
  { id: 'drive', file: 'photo-drive.jpg', label: 'Night Drive', alt: 'Muscle car on an empty highway toward a sunset' },
  { id: 'solstice', file: 'photo-solstice.jpg', label: 'Solstice', alt: 'Woman with sunglasses beside a red convertible at sunset' },
  { id: 'neon', file: 'photo-neon.jpg', label: 'Neon', alt: 'Man in a white suit on a rain-soaked neon street' },
  { id: 'causeway', file: 'photo-causeway.jpg', label: 'Causeway', alt: 'Woman on a motorcycle on a causeway at golden hour' },
  { id: 'boss', file: 'photo-boss.jpg', label: 'The Boss', alt: 'Older man in a white suit outside an art deco hotel' },
  { id: 'rider', file: 'photo-rider.jpg', label: 'The Rider', alt: 'Man in a floral shirt against a graffiti wall at sunset' },
  { id: 'car', file: 'photo-car.jpg', label: 'The Car', alt: 'Red sports car on a wet neon street at night' },
];

let counter = 0;

function nextId(prefix) {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Decode an <img> from a URL (object URL or a relative app path). */
export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

/** Read a File from the input or a drop, keeping its object URL for the canvas and previews. */
export async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(url);
    return {
      id: nextId('file'),
      name: file.name.replace(/\.[^.]+$/, ''),
      url,
      image,
      source: 'file',
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Load one bundled sample by id or file name. */
export async function loadSample(id) {
  const key = String(id ?? '')
    .replace(/^samples\//, '')
    .replace(/^photo-/, '')
    .replace(/\.jpe?g$/i, '');
  const sample =
    SAMPLES.find((item) => item.id === key) ?? SAMPLES.find((item) => item.file === `photo-${key}.jpg`) ?? SAMPLES[0];
  const url = new URL(`../samples/${sample.file}`, import.meta.url).href;
  const image = await loadImageFromUrl(url);
  return { id: sample.id, name: sample.label, url, image, source: 'sample' };
}

/** Load every bundled sample, in manifest order. */
export function loadSamples() {
  return Promise.all(SAMPLES.map((sample) => loadSample(sample.id)));
}

/** Load the photos named in ?photos=a,b,c (unknown names are skipped silently). */
export async function loadShotPhotos(query, fallback = DEFAULT_SAMPLES_FALLBACK) {
  const listed = (query.get('photos') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const names = listed.length ? listed : fallback;
  const photos = [];
  for (const name of names) {
    try {
      photos.push(await loadSample(name));
    } catch {
      /* a bad name in the query just leaves that slot out */
    }
  }
  return photos;
}

const DEFAULT_SAMPLES_FALLBACK = ['solstice', 'neon', 'boss'];

/**
 * Which loaded photo fills each panel: an explicit panelPhotos entry wins, otherwise the loaded
 * list is dealt out in order and cycles when there are fewer photos than panels.
 */
export function photoForPanel(state, index) {
  if (!state.photos.length) return null;
  const explicit = state.panelPhotos[index];
  if (explicit) {
    const found = state.photos.find((photo) => photo.id === explicit);
    if (found) return found;
  }
  return state.photos[index % state.photos.length];
}

/** Append photos, skipping duplicates by url. Returns the new list plus the ones that were added. */
export function addPhotos(state, photos) {
  const known = new Set(state.photos.map((photo) => photo.url));
  const added = photos.filter((photo) => !known.has(photo.url));
  return { photos: [...state.photos, ...added], added };
}

/** Free object URLs for files the user loaded (sample URLs stay valid and harmless to skip). */
export function releasePhotos(photos) {
  for (const photo of photos) {
    if (photo.source === 'file') URL.revokeObjectURL(photo.url);
  }
}
