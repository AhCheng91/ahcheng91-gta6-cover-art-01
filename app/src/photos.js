const SAMPLE_DEFS = [
  { id: 'solstice', label: 'Solstice' },
  { id: 'neon', label: 'Neon' },
  { id: 'boss', label: 'Boss' },
  { id: 'causeway', label: 'Causeway' },
  { id: 'rider', label: 'Rider' },
  { id: 'car', label: 'Car' },
  { id: 'street', label: 'Street' },
  { id: 'beach', label: 'Beach' },
  { id: 'rooftop', label: 'Rooftop' },
  { id: 'drive', label: 'Drive' }
];

export const SAMPLES = SAMPLE_DEFS.map(({ id, label }) => ({
  id,
  file: `samples/photo-${id}.jpg`,
  url: `samples/photo-${id}.jpg`,
  label
}));

const imageCache = new Map();

export function loadImageFromUrl(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

export function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return loadImageFromUrl(url).then((img) => {
    img.__objectUrl = url;
    img.__fileName = file.name;
    return img;
  });
}

export function loadSample(id) {
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) return Promise.reject(new Error(`Unknown sample: ${id}`));
  return loadImageFromUrl(sample.url).then((image) => ({
    id: sample.id,
    url: sample.url,
    image,
    label: sample.label
  }));
}

export function loadSamples() {
  return Promise.all(SAMPLES.map((s) => loadSample(s.id)));
}

export function loadShotPhotos(ids) {
  const list = (ids || []).filter(Boolean);
  return Promise.all(
    list.map((id) => {
      const sample = SAMPLES.find((s) => s.id === id);
      if (!sample) {
        return Promise.resolve({ id, url: `samples/photo-${id}.jpg`, image: null, label: id });
      }
      return loadSample(id).catch(() => ({ ...sample, image: null }));
    })
  );
}

export function photoForPanel(state, index) {
  const photos = state.photos || [];
  if (!photos.length) return null;
  return photos[index % photos.length];
}

export function addPhotos(state, photos) {
  const incoming = (photos || []).filter(Boolean);
  if (!incoming.length) return state;
  return { ...state, photos: [...state.photos, ...incoming] };
}

export function releasePhotos(photos) {
  (photos || []).forEach((photo) => {
    const img = photo && photo.image;
    if (!img) return;
    const url = img.__objectUrl;
    if (url) {
      URL.revokeObjectURL(url);
      imageCache.delete(url);
      img.__objectUrl = null;
    }
  });
}
