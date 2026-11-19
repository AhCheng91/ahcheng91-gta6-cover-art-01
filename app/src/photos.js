// Photos in, photos out: the sample manifest, image decoding from files or sample names, and the rule that fills
// panels from the loaded list (panel n gets photo n, cycling).

export const SAMPLES = [
  { id: 'street', file: 'photo-street.jpg', label: 'Convertible', alt: 'Woman leaning on a convertible at sunset' },
  { id: 'drive', file: 'photo-drive.jpg', label: 'Causeway', alt: 'Purple car on a causeway at sunset' },
  { id: 'rooftop', file: 'photo-rooftop.jpg', label: 'Rooftop', alt: 'Woman on a rooftop at dusk' },
  { id: 'beach', file: 'photo-beach.jpg', label: 'Boardwalk', alt: 'Man on a boardwalk at sunset' },
];

let counter = 0;

function nextId(prefix) {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Decodes an <img> from a URL (object URL or a relative app path). */
export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

/** Reads a File from the input or a drop, keeping its object URL for the canvas and for previews. */
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

/** Loads one of the bundled samples by id or file name. */
export async function loadSample(id) {
  const key = String(id ?? '')
    .replace(/^samples\//, '')
    .replace(/\.jpg$/i, '');
  const sample = SAMPLES.find((item) => item.id === key || item.file === `${key}.jpg`) ?? SAMPLES[0];
  const url = new URL(`../samples/${sample.file}`, import.meta.url).href;
  const image = await loadImageFromUrl(url);
  return { id: sample.id, name: sample.label, url, image, source: 'sample' };
}

/** Loads every bundled sample, in manifest order. */
export function loadSamples() {
  return Promise.all(SAMPLES.map((sample) => loadSample(sample.id)));
}

/** Loads the photos named in a ?photos= hash (or scans the hash for known sample names). */
export async function loadShotPhotos(query, fallback = ['street', 'drive', 'rooftop']) {
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

/**
 * Resolves which loaded photo fills each panel: an explicit panelPhotos entry wins, otherwise the loaded list is
 * dealt out in order and cycles when there are fewer photos than panels.
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

/** Appends photos, skipping duplicates by url, and returns the new list plus the ones that were added. */
export function addPhotos(state, photos) {
  const known = new Set(state.photos.map((photo) => photo.url));
  const added = photos.filter((photo) => !known.has(photo.url));
  return { photos: [...state.photos, ...added], added };
}

/** Frees object URLs for files the user loaded (sample URLs stay valid and harmless to skip). */
export function releasePhotos(photos) {
  for (const photo of photos) {
    if (photo.source === 'file') URL.revokeObjectURL(photo.url);
  }
}
