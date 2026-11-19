// The Vice City grade applied over the finished collage: warm/cool split, a teal-orange duotone lift, bloom,
// vignette and deterministic film grain. Every effect scales from the look sliders.

let grainCache = null;
let bloomCanvas = null;

/** Small seeded PRNG (mulberry32) so the grain is identical on every render. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 256 × 256 noise tile, built once and reused as a canvas pattern. */
export function grainTile() {
  if (grainCache) return grainCache;
  const tile = document.createElement('canvas');
  tile.width = 256;
  tile.height = 256;
  const ctx = tile.getContext('2d');
  const image = ctx.createImageData(256, 256);
  const random = seeded(0x5eed6);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 72 + Math.floor(random() * 112);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainCache = tile;
  return tile;
}

function parseHex(hex) {
  const clean = String(hex ?? '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function scratchCanvas(width, height) {
  if (!bloomCanvas) bloomCanvas = document.createElement('canvas');
  if (bloomCanvas.width !== width || bloomCanvas.height !== height) {
    bloomCanvas.width = width;
    bloomCanvas.height = height;
  }
  return bloomCanvas;
}

/** Soft bloom: a blurred, downscaled copy of the canvas added back with 'screen'. */
export function bloomPass(ctx, rect, amount) {
  if (amount <= 0) return;
  const source = ctx.canvas;
  const w = Math.max(1, Math.round(rect.w * 0.35));
  const h = Math.max(1, Math.round(rect.h * 0.35));
  const scratch = scratchCanvas(w, h);
  const sctx = scratch.getContext('2d');
  sctx.clearRect(0, 0, w, h);
  sctx.filter = 'blur(8px)';
  sctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  sctx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.4, (0.18 * amount) / 100);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scratch, 0, 0, w, h, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Transparent centre to a deep violet at the corners. */
export function vignette(ctx, rect, strength = 1) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.hypot(rect.w, rect.h) / 2;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.42, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(20,4,30,0)');
  gradient.addColorStop(0.72, `rgba(20,4,30,${0.2 * strength})`);
  gradient.addColorStop(1, `rgba(20,4,30,${0.55 * strength})`);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function grainPass(ctx, rect, amount) {
  if (amount <= 0) return;
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(0.26, (0.2 * amount) / 100);
  ctx.fillStyle = pattern;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = Math.min(0.14, (0.09 * amount) / 100);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/**
 * Grades `rect` of the canvas. Strength (0–100) scales the split tone and duotone; grain and bloom are their own
 * 0–100 amounts so the Look card can isolate them.
 */
export function applyGrade(ctx, rect, palette, strength = 100, grain = 60, bloom = 60) {
  const s = Math.max(0, Math.min(100, strength)) / 100;
  if (s <= 0 && grain <= 0 && bloom <= 0) return;
  const warm = palette.warm;
  const cool = palette.cool;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (s > 0) {
    ctx.globalAlpha = 1;

    const split = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    split.addColorStop(0, rgba(warm, 0.34 * s));
    split.addColorStop(0.52, rgba('#8a3a52', 0.12 * s));
    split.addColorStop(1, rgba(cool, 0.34 * s));
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = split;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const deepen = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    deepen.addColorStop(0, rgba('#1a0a26', 0.08 * s));
    deepen.addColorStop(0.62, rgba('#0c0416', 0.26 * s));
    deepen.addColorStop(1, rgba('#05020c', 0.46 * s));
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = deepen;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const punch = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    punch.addColorStop(0, rgba(warm, 0.3 * s));
    punch.addColorStop(0.42, rgba(warm, 0.11 * s));
    punch.addColorStop(1, rgba(warm, 0));
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = punch;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const shade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    shade.addColorStop(0, rgba(cool, 0));
    shade.addColorStop(0.6, rgba(cool, 0.06 * s));
    shade.addColorStop(1, rgba(cool, 0.2 * s));
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = shade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = rgba('#ff5a28', 0.07 * s);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  const exposure = palette.exposure ?? 1;
  if (exposure < 1) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = (1 - exposure) * 1.6;
    ctx.fillStyle = '#2a1236';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (exposure > 1) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (exposure - 1) * 0.6;
    ctx.fillStyle = rgba(warm, 1);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  const saturation = palette.saturation ?? 1;
  if (saturation < 1) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = Math.min(0.8, (1 - saturation) * s * 1.2);
    ctx.fillStyle = '#808080';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (saturation > 1) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = Math.min(0.35, (saturation - 1) * s * 1.6);
    ctx.fillStyle = '#ff1a00';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  bloomPass(ctx, rect, bloom * s);
  vignette(ctx, rect, Math.max(0.45, s * 0.9));
  grainPass(ctx, rect, grain);
}
