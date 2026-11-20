// Colour plumbing and the finish pass. Everything here works on the single cover canvas: the
// per-panel gradient map is the grade that gives the collage its one duotone world, and
// applyGrade() adds the shared print finish (split tone, bloom, grain, vignette) on top.

/** #rrggbb (or #rgb) + alpha → an rgba() string. Bad input degrades to black rather than throwing. */
export function rgba(hex, alpha) {
  const clean = String(hex ?? '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** mulberry32: a tiny deterministic PRNG, so grain, stars and streaks are identical every render. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, for seeding things from the caption title. */
export function hashString(text) {
  let h = 2166136261 >>> 0;
  const value = String(text ?? '');
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ film grain tile */

let grainCache = null;

/** A 256 × 256 monochrome noise tile, built once and reused. */
export function grainTile() {
  if (grainCache) return grainCache;
  const tile = document.createElement('canvas');
  tile.width = 256;
  tile.height = 256;
  const ctx = tile.getContext('2d');
  const image = ctx.createImageData(256, 256);
  const random = seeded(0x5eed6);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 74 + Math.floor(random() * 108);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainCache = tile;
  return tile;
}

/* ------------------------------------------------------------------ bloom */

let bloomScratch = null;

function scratch(width, height) {
  if (!bloomScratch) bloomScratch = document.createElement('canvas');
  if (bloomScratch.width !== width || bloomScratch.height !== height) {
    bloomScratch.width = width;
    bloomScratch.height = height;
  }
  return bloomScratch;
}

/**
 * Bloom: shrink a copy of the rect (that is the "downscale"), blur it with ctx.filter, add it
 * back with 'screen'. Only bright areas survive the screen blend, so highlights blossom while
 * shadows stay put.
 */
export function bloomPass(ctx, rect, amount) {
  if (amount <= 0) return;
  const source = ctx.canvas;
  const w = Math.max(1, Math.round(rect.w * 0.28));
  const h = Math.max(1, Math.round(rect.h * 0.28));
  const buffer = scratch(w, h);
  const bctx = buffer.getContext('2d');
  bctx.clearRect(0, 0, w, h);
  bctx.filter = 'blur(6px) contrast(1.55) brightness(0.9)';
  bctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  bctx.filter = 'none';

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.3, 0.16 * Math.min(1, amount / 60));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buffer, 0, 0, w, h, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/* ------------------------------------------------------------------ vignette + grain */

/** Poster vignette: transparent at the centre, ink at 32% in the corners. */
export function vignette(ctx, rect, palette, strength = 1) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.hypot(rect.w, rect.h) / 2;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.46, cx, cy, radius);
  gradient.addColorStop(0, rgba(palette.ink, 0));
  gradient.addColorStop(0.74, rgba(palette.ink, 0.12 * strength));
  gradient.addColorStop(1, rgba(palette.ink, 0.32 * strength));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Film grain over the rect. Hard-capped at 6% alpha so the title's whites never go grey. */
function grainPass(ctx, rect, amount) {
  if (amount <= 0) return;
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  const alpha = Math.min(0.06, (0.06 * amount) / 100);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = Math.min(0.05, (0.05 * amount) / 100);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/* ------------------------------------------------------------------ the finish */

/**
 * The shared finish, applied once over the whole poster: bloom over the bright areas, film grain
 * and a poster vignette. `strength` (0–100) scales the vignette; grain and bloom are their own
 * 0–100 amounts.
 *
 * There is deliberately no global colour wash here: the tint belongs to the panels' own grade and
 * the foot's single shadow multiply, so the print never gains a pink veil over the photographs.
 * The finish is applied over the lettering too (that is what makes it sit *in* the print); the
 * grain cap is what keeps the title's whites clean.
 */
export function applyGrade(ctx, rect, palette, strength = 100, grain = 55, bloom = 60) {
  const s = Math.max(0, Math.min(100, strength)) / 100;
  bloomPass(ctx, rect, bloom * s);
  grainPass(ctx, rect, grain);
  vignette(ctx, rect, palette, Math.max(0.5, s));
}
