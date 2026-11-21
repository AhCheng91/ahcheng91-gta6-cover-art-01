export const SAMPLES = [
  { id: 'boss', file: 'photo-boss.jpg', label: 'The Boss' },
  { id: 'street', file: 'photo-street.jpg', label: 'The Street' },
  { id: 'beach', file: 'photo-beach.jpg', label: 'The Beach' },
  { id: 'neon', file: 'photo-neon.jpg', label: 'The Neon' },
  { id: 'car', file: 'photo-car.jpg', label: 'The Car' },
  { id: 'causeway', file: 'photo-causeway.jpg', label: 'The Causeway' },
  { id: 'drive', file: 'photo-drive.jpg', label: 'The Drive' },
  { id: 'rider', file: 'photo-rider.jpg', label: 'The Rider' },
  { id: 'rooftop', file: 'photo-rooftop.jpg', label: 'The Rooftop' },
  { id: 'solstice', file: 'photo-solstice.jpg', label: 'The Solstice' }
];

const BY_ID = new Map(SAMPLES.map((s) => [s.id, s]));

export function sampleById(id) {
  return BY_ID.get(id) || SAMPLES[0];
}

export function sampleUrl(id) {
  return new URL('../samples/' + sampleById(id).file, import.meta.url).href;
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out loading image: ' + url));
    }, 6000);
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
      if (img.decode) {
        try {
          img.decode().catch(() => {});
        } catch (err) {}
      }
    };
    img.decoding = 'async';
    img.onload = finish;
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Could not load image: ' + url));
    };
    img.src = url;
  });
}

export function loadSample(id) {
  return loadImageFromUrl(sampleUrl(id));
}

export function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return loadImageFromUrl(url).then(
    (img) => {
      img.objectUrl = url;
      return img;
    },
    (err) => {
      URL.revokeObjectURL(url);
      throw err;
    }
  );
}

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('60px Anton'),
    document.fonts.load('24px Barlow Condensed'),
    document.fonts.load('40px "Archivo Black"'),
    document.fonts.load('40px Pacifico')
  ]);
  await document.fonts.ready;
}
