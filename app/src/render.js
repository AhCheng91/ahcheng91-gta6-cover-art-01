import { SIZES, PALETTES } from './state.js';
import { layoutPanels, cutRectPoints } from './panels.js';
import { drawBackdrop } from './backdrop.js';
import { treatPanel, overlayFilm } from './grade.js';
import {
  measuredTitle,
  drawTitle,
  drawScript,
  drawRibbon,
  drawChips,
  drawQuoteStrip,
  titleBoxOf,
  FONT_CONDENSED
} from './lettering.js';
import { drawSeal, drawFooter } from './furniture.js';
import { polyPath, clamp, hexToRgba } from './util.js';

const CREAM = '#FFF3DC';

function sizeFor(state) {
  const id = state && state.sizeId;
  const found = SIZES.find((s) => s.id === id);
  if (found) return found;
  if (state && state.size && state.size.w > 0) return state.size;
  return SIZES[SIZES.length - 1];
}

function paletteFor(state) {
  const key = (state && state.palette) || 'sunset';
  return PALETTES[key] || PALETTES.sunset;
}

function resetContext(ctx, w, h) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if ('filter' in ctx) ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.clearRect(0, 0, w, h);
}

function imageFor(photo) {
  if (!photo) return null;
  return photo.img || photo.image || null;
}

function panelWithPhoto(panel, photo) {
  const zoom = photo && Number.isFinite(photo.zoom) ? photo.zoom : 1;
  const fx = photo && Number.isFinite(photo.focusX) ? photo.focusX : 0.5;
  const fy = photo && Number.isFinite(photo.focusY) ? photo.focusY : 0.42;
  return Object.assign({}, panel, {
    zoom: Math.max(1, zoom),
    focusX: clamp(fx, 0, 1),
    focusY: clamp(fy, 0, 1)
  });
}

export function drawPlaceholderPanels(ctx, geom, palette) {
  if (!ctx || !geom || !Array.isArray(geom.panels)) return;
  const paper = (palette && palette.paper) || CREAM;

  ctx.save();
  for (let i = 0; i < geom.panels.length; i++) {
    const panel = geom.panels[i];
    if (!panel || !(panel.w > 0) || !(panel.h > 0)) continue;
    const points = cutRectPoints(panel.x, panel.y, panel.w, panel.h, panel.cut);

    ctx.save();
    polyPath(ctx, points);
    ctx.clip();
    const g = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
    g.addColorStop(0, '#3a1240');
    g.addColorStop(0.55, '#2a0b33');
    g.addColorStop(1, '#48133f');
    ctx.fillStyle = g;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

    const size = clamp(0.026 * panel.h, 11, 20);
    ctx.font = size + 'px ' + FONT_CONDENSED;
    ctx.fillStyle = hexToRgba(paper, 0.72);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('drop a photo', panel.x + panel.w / 2, panel.y + panel.h / 2, panel.w * 0.82);
    ctx.restore();

    polyPath(ctx, points);
    ctx.strokeStyle = paper;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }
  ctx.restore();
}

export function renderCover(canvas, state) {
  if (!canvas) throw new Error('renderCover needs a canvas');
  const src = state || {};
  const size = sizeFor(src);
  const W = Math.max(1, Math.round(size.w));
  const H = Math.max(1, Math.round(size.h));
  const palette = paletteFor(src);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('No 2d context');
  resetContext(ctx, W, H);

  const geom = layoutPanels(src.layout || 'poster', W, H);
  const photos = Array.isArray(src.photos) ? src.photos : [];
  const caption = src.caption || {};

  drawBackdrop(ctx, W, H, palette);

  const panels = [];
  const missing = [];
  for (let i = 0; i < geom.panels.length; i++) {
    const photo = photos[geom.panels[i].i] || photos[i] || null;
    const panel = panelWithPhoto(geom.panels[i], photo);
    panels.push(panel);
    const image = imageFor(photo);
    if (image) treatPanel(ctx, panel, image, palette, i);
    else missing.push(panel);
  }
  if (missing.length) drawPlaceholderPanels(ctx, { panels: missing }, palette);

  const measured = measuredTitle(ctx, geom, caption);
  drawTitle(ctx, geom, caption, palette, measured);
  drawScript(ctx, geom, caption, palette, measured);
  drawRibbon(ctx, geom, caption, palette, measured);

  drawChips(ctx, geom, src, panels, titleBoxOf(measured));

  drawQuoteStrip(ctx, geom, caption, palette);
  drawFooter(ctx, geom, caption, palette);
  drawSeal(ctx, geom, palette);

  const grain = Number.isFinite(src.grain) ? src.grain : 55;
  const bloom = Number.isFinite(src.bloom) ? src.bloom : 60;
  overlayFilm(ctx, W, H, grain, bloom, palette);
  ctx.globalCompositeOperation = 'source-over';

  return { geom, measured };
}
