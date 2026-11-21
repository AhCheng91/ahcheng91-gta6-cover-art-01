import { coverFit, cutRectPoints } from './panels.js';
import { rngFor, clamp, polyPath, canvas2d } from './util.js';

const PLUM = '#3a1240';
const CREAM = '#fff3dc';

const grainCache = new Map();

export function grainTile(seed) {
  const key = seed >>> 0;
  if (grainCache.has(key)) return grainCache.get(key);
  const { canvas, ctx } = canvas2d(160, 160);
  const rng = rngFor(key);
  const img = ctx.createImageData(160, 160);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (rng.next() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = (rng.next() * 19) | 0;
  }
  ctx.putImageData(img, 0, 0);
  grainCache.set(key, canvas);
  return canvas;
}

function keylineWidth(ctx) {
  const w = (ctx.canvas && ctx.canvas.width) || 1000;
  return Math.max(2.5, 0.0028 * w);
}

function paintPlaceholder(sctx, w, h) {
  sctx.fillStyle = PLUM;
  sctx.fillRect(0, 0, w, h);
}

function gradeScratch(sctx, w, h, image, panel, index) {
  const hue = rngFor(1986 + index * 131).range(-3, 3).toFixed(2);
  sctx.save();
  if (image) {
    const fit = coverFit({ x: 0, y: 0, w, h }, image, panel.zoom, {
      x: panel.focusX,
      y: panel.focusY
    });
    sctx.filter = 'brightness(1.10) contrast(1.10) saturate(1.22) hue-rotate(' + hue + 'deg)';
    sctx.drawImage(image, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, w, h);
    sctx.filter = 'none';
  } else {
    paintPlaceholder(sctx, w, h);
  }

  sctx.globalCompositeOperation = 'soft-light';
  sctx.fillStyle = 'rgba(255,168,96,0.14)';
  sctx.fillRect(0, 0, w, h);
  sctx.globalCompositeOperation = 'screen';
  sctx.fillStyle = 'rgba(60,20,90,0.10)';
  sctx.fillRect(0, 0, w, h);
  sctx.globalCompositeOperation = 'source-over';

  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * 0.46;
  const outer = Math.hypot(w, h) / 2;
  const vig = sctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  vig.addColorStop(0, 'rgba(20,4,30,0)');
  vig.addColorStop(1, 'rgba(20,4,30,0.28)');
  sctx.fillStyle = vig;
  sctx.fillRect(0, 0, w, h);
  sctx.restore();
}

export function treatPanel(ctx, panel, image, palette, index = 0) {
  if (!ctx || !panel) return;
  const w = Math.max(1, Math.ceil(panel.w));
  const h = Math.max(1, Math.ceil(panel.h));
  const { canvas: scratch, ctx: sctx } = canvas2d(w, h);
  gradeScratch(sctx, w, h, image, panel, index | 0);

  const points = cutRectPoints(panel.x, panel.y, panel.w, panel.h, panel.cut);
  ctx.save();
  polyPath(ctx, points);
  ctx.clip();
  ctx.drawImage(scratch, panel.x, panel.y, panel.w, panel.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255,170,90,0.07)';
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  const k = keylineWidth(ctx);
  ctx.save();
  polyPath(ctx, points);
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = k;
  ctx.lineJoin = 'miter';
  ctx.stroke();

  const inset = 1.5;
  polyPath(ctx, cutRectPoints(panel.x + inset, panel.y + inset, panel.w - inset * 2, panel.h - inset * 2, Math.max(0, panel.cut - inset)));
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function overlayFilm(ctx, w, h, grain = 55, bloom = 60, palette) {
  if (!ctx || !(w > 0) || !(h > 0)) return;
  const tile = grainTile(1986);
  const pattern = ctx.createPattern(tile, 'repeat');
  const g = clamp(grain, 0, 100);
  const b = clamp(bloom, 0, 100);

  ctx.save();
  if (pattern) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (g / 100) * 0.07;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 1;
  const top = ctx.createLinearGradient(0, 0, 0, h / 3);
  top.addColorStop(0, 'rgba(255,190,130,' + ((b / 100) * 0.10).toFixed(3) + ')');
  top.addColorStop(1, 'rgba(255,190,130,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h / 3);

  ctx.globalCompositeOperation = 'source-over';
  const cx = w / 2;
  const cy = h / 2;
  const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.42, cx, cy, Math.hypot(w, h) / 2);
  vig.addColorStop(0, 'rgba(30,6,44,0)');
  vig.addColorStop(1, 'rgba(30,6,44,0.16)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
