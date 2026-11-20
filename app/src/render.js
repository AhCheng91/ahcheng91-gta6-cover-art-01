import { panelsFor } from './state.js';
import { paletteById } from './palette.js';
import { coverFit, panelFocus } from './panels.js';
import { photoForPanel } from './photos.js';
import { applyGrade, hashString, rgba, seeded, vignette } from './grade.js';
import { drawBackdrop } from './backdrop.js';
import {
  drawBottomStrip,
  drawDarkeningRail,
  drawRoleChip,
  drawScriptLine,
  drawTitleGlyphs,
  drawTopStrip,
  layoutTitleBlock,
  titlePaintedBox
} from './lettering.js';

export function posterGeometry(width, height, layoutId = 'poster') {
  const W = width;
  const H = height;
  const m = 0.016 * Math.min(W, H);
  const inner = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  if (layoutId === 'solo') {
    return {
      width: W,
      height: H,
      margin: m,
      inner,
      topStrip: null,
      field: { x: inner.x, y: inner.y, w: inner.w, h: inner.h },
      bottomStrip: null
    };
  }
  const topH = 0.062 * inner.h;
  const bottomH = 0.098 * inner.h;
  const topStrip = { x: inner.x, y: inner.y, w: inner.w, h: topH };
  const bottomStrip = { x: inner.x, y: inner.y + inner.h - bottomH, w: inner.w, h: bottomH };
  const field = { x: inner.x, y: inner.y + topH, w: inner.w, h: inner.h - topH - bottomH };
  return { width: W, height: H, margin: m, inner, topStrip, field, bottomStrip };
}

let halftoneCache = null;

function halftoneTile() {
  if (!halftoneCache) {
    const tile = document.createElement('canvas');
    tile.width = 8;
    tile.height = 8;
    const tctx = tile.getContext('2d');
    tctx.fillStyle = 'rgba(11,6,22,1)';
    tctx.beginPath();
    tctx.arc(4, 4, 1.5, 0, Math.PI * 2);
    tctx.fill();
    halftoneCache = tile;
  }
  return halftoneCache;
}

function paintPanel(ctx, panel, photo, transform, index, state, palette, streak) {
  const { x, y, w, h } = panel;
  const W = state.width;
  const H = state.height;
  const unit = Math.min(W, H) / 1080;
  const zoom = transform && transform.zoom > 0 ? transform.zoom : 1;
  const focus = panelFocus(panel, transform);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x, y, w, h);

  if (photo && photo.image) {
    const fit = coverFit(panel, photo.image, zoom, focus);
    const hue = (seeded(hashString(`panel-${index}`))() * 2 - 1) * 4;
    ctx.save();
    ctx.filter = `saturate(1.32) contrast(1.20) brightness(0.94) hue-rotate(${hue.toFixed(2)}deg)`;
    ctx.drawImage(photo.image, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.4;
  const map = ctx.createLinearGradient(x, y, x + w, y + h);
  map.addColorStop(0, palette.shadow);
  map.addColorStop(0.5, rgba(palette.shadow, 0));
  map.addColorStop(1, palette.highlight);
  ctx.fillStyle = map;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.58;
  const crush = ctx.createLinearGradient(0, y + h * 0.2, 0, y + h);
  crush.addColorStop(0, rgba(palette.shadow, 0));
  crush.addColorStop(1, palette.shadow);
  ctx.fillStyle = crush;
  ctx.fillRect(x, y + h * 0.2, w, h * 0.8);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.3;
  const lift = ctx.createLinearGradient(0, y, 0, y + h * 0.32);
  lift.addColorStop(0, palette.highlight);
  lift.addColorStop(1, rgba(palette.highlight, 0));
  ctx.fillStyle = lift;
  ctx.fillRect(x, y, w, h * 0.32);
  ctx.restore();

  const corner = seeded(hashString(`corner-${index}`));
  const brightX = x + (corner() < 0.5 ? 0.22 : 0.78) * w;
  const brightY = y + 0.18 * h;
  ctx.save();
  ctx.globalCompositeOperation = 'color-dodge';
  const glow = ctx.createRadialGradient(brightX, brightY, 0, brightX, brightY, Math.hypot(w, h) * 0.8);
  glow.addColorStop(0, rgba(palette.highlight, 0.08));
  glow.addColorStop(1, rgba(palette.highlight, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const dots = ctx.createPattern(halftoneTile(), 'repeat');
  if (dots) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = dots;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  const cx = x + w / 2;
  const cy = y + h / 2;
  const inside = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.2, cx, cy, Math.hypot(w, h) * 0.62);
  inside.addColorStop(0, rgba(palette.ink, 0));
  inside.addColorStop(0.62, rgba(palette.ink, 0.14));
  inside.addColorStop(1, rgba(palette.ink, 0.42));
  ctx.fillStyle = inside;
  ctx.fillRect(x, y, w, h);

  const edge = Math.max(1, 1.5 * unit);
  ctx.lineWidth = edge;
  ctx.strokeStyle = rgba(palette.cream, 0.3);
  ctx.strokeRect(x + edge / 2, y + edge / 2, w - edge, h - edge);

  const bottomShadow = ctx.createLinearGradient(0, y + h * 0.82, 0, y + h);
  bottomShadow.addColorStop(0, rgba(palette.ink, 0));
  bottomShadow.addColorStop(1, rgba(palette.ink, 0.4));
  ctx.fillStyle = bottomShadow;
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);

  if (streak) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((18 * Math.PI) / 180);
    const band = w * 0.12;
    const light = ctx.createLinearGradient(-band, 0, band, 0);
    light.addColorStop(0, 'rgba(255,255,255,0)');
    light.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    light.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = light;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.restore();
  }

  ctx.restore();

  const frame = Math.max(2, 3 * unit);
  ctx.save();
  ctx.lineWidth = frame;
  ctx.strokeStyle = rgba(palette.accent, 0.88);
  ctx.strokeRect(x + frame / 2, y + frame / 2, w - frame, h - frame);
  ctx.lineWidth = Math.max(1, unit);
  ctx.strokeStyle = rgba(palette.ink, 1);
  ctx.strokeRect(x + frame + 0.5, y + frame + 0.5, w - 2 * frame - 1, h - 2 * frame - 1);
  ctx.restore();
}

function streakPanelsFor(state, total) {
  const set = new Set();
  if (!total) return set;
  const title = state.caption && state.caption.title ? state.caption.title : '';
  const rand = seeded(hashString(`${title}|${state.layoutId || 'poster'}`));
  set.add(Math.floor(rand() * total));
  if (total > 3 && rand() > 0.45) set.add(Math.floor(rand() * total));
  return set;
}

export function drawPanels(ctx, state, palette, geometry) {
  const W = state.width;
  const H = state.height;
  const layoutId = state.layoutId || 'poster';
  const panels = panelsFor(layoutId, W, H);
  const transforms = state.transforms || [];
  const streak = streakPanelsFor(state, panels.length);
  for (const panel of panels) {
    const photo = photoForPanel(state, panel.index);
    paintPanel(ctx, panel, photo, transforms[panel.index], panel.index, state, palette, streak.has(panel.index));
  }
  return { panels, geometry };
}

export function drawPoster(ctx, state, palette, geometry) {
  const W = state.width;
  const H = state.height;
  const { panels } = drawPanels(ctx, state, palette, geometry);

  applyGrade(ctx, geometry.field, palette, state.grade, state.grain, state.bloom);

  drawDarkeningRail(ctx, geometry, palette, H);

  const block = layoutTitleBlock(ctx, state, geometry);
  const titleBox = titlePaintedBox(ctx, geometry, state, block);
  const roles = Array.isArray(state.roles) ? state.roles : state.caption && Array.isArray(state.caption.roles) ? state.caption.roles : [];

  drawTopStrip(ctx, geometry, state, palette);
  drawTitleGlyphs(ctx, geometry, state, palette, block);
  drawScriptLine(ctx, geometry, state, palette, block);

  const chips = [];
  for (let i = 0; i < panels.length; i += 1) {
    chips.push(drawRoleChip(ctx, panels[i], roles[i], state, palette, titleBox));
  }

  drawBottomStrip(ctx, geometry, state, palette);

  const inner = geometry.inner;
  ctx.save();
  ctx.strokeStyle = rgba(palette.cream, 0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(inner.x + 1, inner.y + 1, inner.w - 2, inner.h - 2);
  ctx.restore();

  vignette(ctx, { x: 0, y: 0, w: W, h: H }, palette, 0.4);

  return { panels, geometry, palette, block };
}

export function renderCover(canvas, state) {
  const W = Math.max(1, Math.round(state.width || canvas.width || 1080));
  const H = Math.max(1, Math.round(state.height || canvas.height || 1080));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const palette = paletteById(state.paletteId);
  const geometry = posterGeometry(W, H, state.layoutId || 'poster');

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';

  ctx.fillStyle = palette.ink;
  ctx.fillRect(0, 0, W, H);

  drawBackdrop(ctx, W, H, palette);

  const result = drawPoster(ctx, state, palette, geometry);

  ctx.restore();
  return result;
}
