// renderCover: the whole poster, top to bottom, on one canvas at export resolution.
//
// Order matters and is fixed: ink page → backdrop → per-panel photo + local grade → shared finish
// → title block → top strip → role chips → bottom strip → cream hairline. The same state always
// gives the same pixels (every "random" element is seeded).

import { paletteById } from './state.js';
import { coverFit, layoutPanels, panelFocus, posterGeometry } from './panels.js';
import { photoForPanel } from './photos.js';
import { applyGrade, rgba, seeded } from './grade.js';
import { drawBackdrop } from './backdrop.js';
import {
  drawBottomStrip,
  drawDarkeningRail,
  drawRoleChip,
  drawTitleGlyphs,
  drawTopStrip,
  layoutTitleBlock,
} from './lettering.js';

/* ------------------------------------------------------------------ halftone tile */

let halftoneCache = null;

/**
 * An 8 × 8 dot tile: one ink dot per cell, growing towards the corner. Tiled over a panel with
 * 'overlay' at 9% it reads as a printed screen, not as texture noise.
 */
function halftonePattern(ctx) {
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
  return ctx.createPattern(halftoneCache, 'repeat');
}

/* ------------------------------------------------------------------ one panel */

/**
 * A panel is a photograph pushed through the poster's grade: cover fit, gradient map, halftone,
 * vignette, edge lines and (on a couple of seeded panels) a diagonal light streak.
 */
function drawPanel(ctx, panel, photo, transform, index, state, palette, streakPanels) {
  const { x, y, w, h } = panel;
  const H = state.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Base: a slice of the palette's shadow, so an empty panel still belongs to the poster.
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x, y, w, h);

  if (photo) {
    const focus = panelFocus(panel, transform);
    const fit = coverFit(panel, photo.image, transform.zoom, focus);
    // Hue jitter of ±4° per panel makes the collage read as many separate shots.
    const hue = ((index % 5) - 2) * 2;
    ctx.save();
    ctx.filter = `saturate(1.32) contrast(1.20) brightness(0.94) hue-rotate(${hue}deg)`;
    ctx.drawImage(photo.image, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.restore();

    // ---- gradient map: shadow (TL) → clear → highlight (BR), then crush and lift.
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
  }

  // ---- halftone print screen.
  const dots = halftonePattern(ctx);
  if (dots) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = dots;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // ---- vignette inside the panel.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.hypot(w, h) / 2;
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  vignette.addColorStop(0, rgba(palette.ink, 0));
  vignette.addColorStop(1, rgba(palette.ink, 0.3));
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, w, h);

  // ---- diagonal light streak on the seeded panels.
  if (streakPanels.has(index)) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((18 * Math.PI) / 180);
    const bandW = w * 0.12;
    const streak = ctx.createLinearGradient(-bandW, 0, bandW, 0);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.restore();
  }

  // ---- inner cream edge + bottom shadow.
  ctx.lineWidth = Math.max(1, 0.0014 * Math.min(w, h));
  ctx.strokeStyle = rgba(palette.cream, 0.3);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  const bottomShadow = ctx.createLinearGradient(0, y + h * 0.82, 0, y + h);
  bottomShadow.addColorStop(0, rgba(palette.ink, 0));
  bottomShadow.addColorStop(1, rgba(palette.ink, 0.4));
  ctx.fillStyle = bottomShadow;
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  ctx.restore();

  // ---- frame: 2px cream, then a 1px ink keyline just inside it. Two strokes, both crisp.
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(palette.cream, 0.9);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.ink, 0.85);
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  ctx.restore();
}

/* ------------------------------------------------------------------ the cover */

/** Draw the finished cover into `canvas` from `state`. Returns the geometry it used. */
export function renderCover(canvas, state) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const palette = paletteById(state.palette);
  const H = height;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // ---- ink page.
  ctx.fillStyle = palette.ink;
  ctx.fillRect(0, 0, width, height);

  // ---- the sunset world, mostly hidden but visible in every gutter and gap.
  drawBackdrop(ctx, width, height, palette);

  // ---- panel field.
  const layout = layoutPanels(state.layout, width, height);
  const geometry = posterGeometry(width, height, state.layout);

  // Which panels get a light streak: seeded from the title, one or two panels per cover.
  const random = seeded(hashSeed(state.title + state.layout));
  const streakPanels = new Set();
  const total = layout.panels.length;
  if (total > 0) {
    streakPanels.add(Math.floor(random() * total));
    if (total > 3 && random() > 0.45) streakPanels.add(Math.floor(random() * total));
  }

  for (const panel of layout.panels) {
    const photo = photoForPanel(state, panel.index);
    const transform = state.transforms[panel.index] ?? { zoom: 1 };
    drawPanel(ctx, panel, photo, transform, panel.index, state, palette, streakPanels);
  }

  // ---- the darkening rail, then the role chips, then the lettering: the rail sinks the lower
  // panels into shadow, the chips print crisp on top of it, and the title wins where they meet.
  drawDarkeningRail(ctx, geometry, palette, H);

  // Measure the title once up front: the chips need to know where not to sit.
  const block = layoutTitleBlock(ctx, state, geometry);
  const roleCount = state.layout === 'solo' ? 1 : layout.panels.length;
  for (let i = 0; i < roleCount; i += 1) {
    const panel = layout.panels[i];
    if (panel) drawRoleChip(ctx, panel, state.roles[i] ?? '', state, palette, block.box);
  }
  drawTitleGlyphs(ctx, geometry, state, palette, block);

  // ---- strips.
  drawTopStrip(ctx, geometry, state, palette);
  drawBottomStrip(ctx, geometry, state, palette);

  // ---- shared finish LAST, over the lettering too: split tone, bloom, grain and vignette are
  // what make the whole thing read as one print run. Grain is hard-capped at 6% in grade.js so
  // the title's whites never go grey.
  applyGrade(ctx, { x: 0, y: 0, w: width, h: height }, palette, state.grade, state.grain, state.bloom);

  // ---- the poster's cream hairline, inset from the ink margin.
  ctx.save();
  ctx.strokeStyle = rgba(palette.cream, 0.45);
  ctx.lineWidth = 2;
  const inner = geometry.inner;
  ctx.strokeRect(inner.x + 1, inner.y + 1, inner.w - 2, inner.h - 2);
  ctx.restore();

  ctx.restore();
  return { layout, geometry, palette, block };
}

function hashSeed(text) {
  let h = 2166136261 >>> 0;
  const value = String(text ?? '');
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
