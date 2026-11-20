const GRAIN_SIZE = 160;
const scratchPool = [];

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function scratchFor(width, height) {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  let canvas = scratchPool.find((c) => c.width === w && c.height === h);
  if (!canvas) {
    canvas = makeCanvas(w, h);
    scratchPool.push(canvas);
    if (scratchPool.length > 6) scratchPool.shift();
  }
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.clearRect(0, 0, w, h);
  return canvas;
}

export function rgba(hex, alpha = 1) {
  const raw = String(hex || '#000000').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hashString(text) {
  const s = String(text == null ? '' : text);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seeded(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : Math.floor(seed || 0)) >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainCache = null;

export function grainTile() {
  if (grainCache) return grainCache;
  const canvas = makeCanvas(GRAIN_SIZE, GRAIN_SIZE);
  const g = canvas.getContext('2d');
  const image = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  const rand = seeded(0x51a7c0de);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 128 + (rand() * 2 - 1) * 46;
    const n = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  grainCache = canvas;
  return canvas;
}

const bloomSmall = makeCanvas(2, 2);
const bloomBlurred = makeCanvas(2, 2);

function sizeBloom(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.clearRect(0, 0, width, height);
  }
  return canvas;
}

export function bloomPass(ctx, rect, amount = 0.16) {
  if (!ctx || !rect || rect.w < 4 || rect.h < 4 || amount <= 0) return;
  const src = ctx.canvas;
  if (!src) return;
  const scale = 0.2;
  const w = Math.max(2, Math.round(rect.w * scale));
  const h = Math.max(2, Math.round(rect.h * scale));
  const small = sizeBloom(bloomSmall, w, h);
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);

  const blurred = sizeBloom(bloomBlurred, w, h);
  const bctx = blurred.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.filter = `blur(${Math.max(1, Math.round(w * 0.05))}px)`;
  bctx.drawImage(small, 0, 0);
  bctx.filter = 'none';

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blurred, 0, 0, w, h, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export function vignette(ctx, rect, palette, strength = 1) {
  const a = Math.max(0, Math.min(1, strength));
  if (!ctx || !rect || rect.w < 2 || rect.h < 2 || a <= 0) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const outer = 0.74 * Math.hypot(rect.w / 2, rect.h / 2);
  const g = ctx.createRadialGradient(cx, cy, outer * 0.36, cx, cy, outer);
  g.addColorStop(0, rgba(palette.ink, 0));
  g.addColorStop(0.58, rgba(palette.ink, a * 0.22));
  g.addColorStop(0.86, rgba(palette.ink, a * 0.62));
  g.addColorStop(1, rgba(palette.ink, a));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export function applyGrade(ctx, rect, palette, strength = 100, grain = 55, bloom = 60) {
  if (!ctx || !rect || rect.w <= 0 || rect.h <= 0) return;
  const k = Math.max(0, Math.min(1.5, strength / 100));
  if (k <= 0) return;

  ctx.save();
  const lowTop = rect.y + rect.h * 0.55;
  const low = ctx.createLinearGradient(0, lowTop, 0, rect.y + rect.h);
  low.addColorStop(0, rgba(palette.shadow, 0));
  low.addColorStop(1, rgba(palette.shadow, 0.22 * k));
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = low;
  ctx.fillRect(rect.x, lowTop, rect.w, rect.h * 0.45);

  const topH = rect.h * 0.40;
  const top = ctx.createLinearGradient(0, rect.y, 0, rect.y + topH);
  top.addColorStop(0, rgba(palette.orange, 0.06 * k));
  top.addColorStop(1, rgba(palette.orange, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = top;
  ctx.fillRect(rect.x, rect.y, rect.w, topH);
  ctx.restore();

  bloomPass(ctx, rect, 0.16 * (bloom / 60) * k);

  const grainAlpha = Math.max(0, Math.min(0.12, 0.045 * (grain / 55) * k));
  if (grainAlpha > 0.0005) {
    const pattern = ctx.createPattern(grainTile(), 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = grainAlpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  vignette(ctx, rect, palette, 0.42 * k);
}
