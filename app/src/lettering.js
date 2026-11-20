// Every lettering element on the poster, drawn straight on the canvas so it exports with the PNG.
//
// Reads top to bottom: the top strip (stars, pull quote, attribution, volume pill), the per-panel
// role chips, the title block (darkening rail, extruded Anton title, Pacifico script, swash), and
// the bottom strip (tagline, rule, barcode, credit line, round seal). The tagline lives only in
// the bottom strip: nothing prints over the field except the role chips.
//
// All sizes are fractions of the canvas, so the same code sets a 1080 square and a 1920 wide.
// Every draw sets its own ctx.font first: canvas font state is sticky, and letting a measurement
// call's font leak into a draw is the classic way to get a poster full of the wrong typeface.

import { rgba } from './grade.js';
import { layoutPanels } from './panels.js';

/* ------------------------------------------------------------------ fonts */

const FONT_TITLE = '"Anton", "Archivo Black", sans-serif';
const FONT_SCRIPT = '"Pacifico", cursive';
const FONT_HEAVY = '"Archivo Black", "Anton", sans-serif';
const FONT_CONDENSED = '"Barlow Condensed", "Archivo Black", sans-serif';

/** One place that builds a font string, keyed by a short family name. */
function fontFor(family, size) {
  const px = Math.max(1, size);
  switch (family) {
    case 'script':
      return `${px}px ${FONT_SCRIPT}`;
    case 'heavy':
      return `${px}px ${FONT_HEAVY}`;
    case 'condensed':
      return `600 ${px}px ${FONT_CONDENSED}`;
    case 'barlow':
      return `${px}px ${FONT_CONDENSED}`;
    default:
      return `${px}px ${FONT_TITLE}`;
  }
}

const UPPER = (value) => String(value ?? '').toUpperCase();

/** Width of `text` at `size` with `trackingEm` between glyphs (em-based, so it scales linearly). */
export function trackedWidth(ctx, text, size, trackingEm, family = 'title') {
  const chars = [...String(text ?? '')];
  if (!chars.length) return 0;
  ctx.font = fontFor(family, size);
  let total = 0;
  for (const char of chars) total += ctx.measureText(char).width;
  return total + trackingEm * size * (chars.length - 1);
}

/** Draw `text` glyph by glyph from x (baseline y), adding tracking between glyphs. */
function drawTracked(ctx, text, x, y, size, trackingEm, family, mode = 'fill') {
  const chars = [...String(text ?? '')];
  ctx.font = fontFor(family, size);
  let cursor = x;
  for (const char of chars) {
    if (mode === 'stroke') ctx.strokeText(char, cursor, y);
    else ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + trackingEm * size;
  }
}

/** Draw a tracked line aligned centre / left / right at a baseline; returns its width. */
function drawTrackedAligned(ctx, text, anchorX, baseline, size, trackingEm, family, align = 'center', mode = 'fill') {
  const width = trackedWidth(ctx, text, size, trackingEm, family);
  let start = anchorX;
  if (align === 'center') start = anchorX - width / 2;
  else if (align === 'right') start = anchorX - width;
  drawTracked(ctx, text, start, baseline, size, trackingEm, family, mode);
  return width;
}

/** Shrink `size` until `text` fits `maxWidth` (never below `minFactor` of the size). */
function fitSize(ctx, text, size, trackingEm, maxWidth, family = 'condensed', minFactor = 0.55) {
  const width = trackedWidth(ctx, text, size, trackingEm, family);
  if (width <= maxWidth || width <= 0) return size;
  return Math.max(size * minFactor, (size * maxWidth) / width);
}

/** Last resort: cut `text` with an ellipsis until it fits. */
function ellipsize(ctx, text, size, trackingEm, maxWidth, family = 'condensed') {
  let value = String(text ?? '');
  while (value.length > 1 && trackedWidth(ctx, value, size, trackingEm, family) > maxWidth) {
    value = value.slice(0, -2);
  }
  return `${value.trim()}…`;
}

/* ------------------------------------------------------------------ shapes */

function starPath(ctx, cx, cy, radius, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.382;
    const angle = rotation + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStar(ctx, cx, cy, radius, color) {
  ctx.save();
  ctx.fillStyle = color;
  starPath(ctx, cx, cy, radius);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, cx, cy, radius, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx + radius, cy);
  ctx.lineTo(cx, cy + radius);
  ctx.lineTo(cx - radius, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ top strip */

/**
 * The masthead row. Left: five gold stars, the pull quote, an em dash and the attribution in
 * magenta. Right: a gold-outlined ink pill with the volume. A cream rule closes the strip.
 *
 * The quote group shrinks before it ever collides with the pill; only past that does it ellipsize.
 */
export function drawTopStrip(ctx, geometry, state, palette) {
  const strip = geometry.topStrip;
  if (strip.h <= 0) return;
  const H = state.height;
  const W = state.width;
  const pad = 0.012 * W;
  const midY = strip.y + strip.h / 2;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Volume pill, measured first so the quote knows how much room is left.
  const pillText = UPPER(state.volume || 'VOL. 02');
  const pillSize = 0.024 * H;
  const pillPad = 0.015 * W;
  ctx.font = fontFor('heavy', pillSize);
  const pillTextW = trackedWidth(ctx, pillText, pillSize, 0.06, 'heavy');
  const pillW = pillTextW + pillPad * 2;
  const pillH = 0.04 * H;
  const pillX = strip.x + strip.w - pad - pillW;
  const pillY = midY - pillH / 2;

  // Five stars: size 0.026H, 0.008W apart, the fifth at 55%.
  const starR = (0.026 * H) / 2;
  const starGap = 0.008 * W;
  let cursor = strip.x + pad;
  for (const scale of [1, 1, 1, 1, 0.55]) {
    const r = starR * scale;
    drawStar(ctx, cursor + r, midY, r, palette.gold);
    cursor += r * 2 + starGap;
  }
  cursor += 0.012 * W;

  // Quote + attribution, scaled to the space between the stars and the pill.
  const quoteText = UPPER(state.quote).trim();
  const attribText = '— SOLARIS WEEKLY';
  const available = Math.max(40, pillX - 0.02 * W - cursor);
  const quoteTracking = 0.01;
  const attribTracking = 0.12;
  const gap = 0.016 * W;
  let quoteSize = 0.028 * H;
  let attribSize = 0.024 * H;

  const totalWidth = () =>
    trackedWidth(ctx, quoteText, quoteSize, quoteTracking, 'heavy') +
    gap +
    trackedWidth(ctx, attribText, attribSize, attribTracking, 'condensed');

  if (totalWidth() > available) {
    // 0.985 leaves a hair of slack so the per-character tracking fallback below never bites.
    const scale = (available / totalWidth()) * 0.985;
    quoteSize *= scale;
    attribSize *= scale;
  }

  const attribW = trackedWidth(ctx, attribText, attribSize, attribTracking, 'condensed');
  // If the line still overflows after scaling, tighten the tracking before cutting any words.
  let quote = quoteText;
  let quoteTrack = quoteTracking;
  const quoteBudget = available - attribW - gap;
  const quoteAt = (value, track) => trackedWidth(ctx, value, quoteSize, track, 'heavy');
  if (quoteAt(quote, quoteTrack) > quoteBudget * 0.999) {
    for (const track of [0.004, 0, -0.006]) {
      if (quoteAt(quote, track) <= quoteBudget * 0.999) {
        quoteTrack = track;
        break;
      }
    }
  }
  if (quoteAt(quote, quoteTrack) > quoteBudget * 0.999) {
    quote = ellipsize(ctx, quote, quoteSize, quoteTrack, Math.max(20, quoteBudget), 'heavy');
  }

  const quoteW = trackedWidth(ctx, quote, quoteSize, quoteTrack, 'heavy');
  ctx.fillStyle = palette.cream;
  drawTracked(ctx, quote, cursor, midY, quoteSize, quoteTrack, 'heavy', 'fill');

  ctx.fillStyle = palette.magenta;
  drawTracked(ctx, attribText, cursor + quoteW + gap, midY, attribSize, attribTracking, 'condensed', 'fill');

  // Volume pill.
  ctx.save();
  ctx.beginPath();
  const radius = pillH / 2;
  ctx.moveTo(pillX + radius, pillY);
  ctx.lineTo(pillX + pillW - radius, pillY);
  ctx.arc(pillX + pillW - radius, pillY + radius, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(pillX + radius, pillY + pillH);
  ctx.arc(pillX + radius, pillY + radius, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = palette.ink;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 0.0019 * H);
  ctx.strokeStyle = palette.gold;
  ctx.stroke();

  ctx.fillStyle = palette.gold;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawTracked(ctx, pillText, pillX + (pillW - pillTextW) / 2, midY + pillSize * 0.04, pillSize, 0.06, 'heavy', 'fill');
  ctx.restore();

  // Separator rule under the strip.
  ctx.fillStyle = rgba(palette.cream, 0.3);
  ctx.fillRect(strip.x, strip.y + strip.h - 1, strip.w, 1);
  ctx.restore();
}

/* ------------------------------------------------------------------ role chips */

/**
 * One chip per panel: ink plate, accent bar on the left, cream capitals. Drawn after the
 * darkening rail so a chip stays legible over a sunk panel.
 *
 * Placement: bottom-left of the panel (top-left if the title block would swallow it). The title
 * owns the middle of the poster, so a chip that would vanish under it moves to the panel's top
 * edge instead of being half-covered — every role stays readable.
 */
export function drawRoleChip(ctx, panel, role, state, palette, titleBox = null) {
  const label = UPPER(role).trim();
  if (!label) return;
  const H = state.height;
  const W = state.width;
  const size = 0.021 * H;
  const tracking = 0.1;
  const padX = 0.008 * W;
  const height = 0.03 * H;

  const textW = trackedWidth(ctx, label, size, tracking, 'condensed');
  const width = Math.min(panel.w - 0.012 * W, textW + padX * 2 + 0.003 * W);
  if (width < 0.06 * W) return;
  const x = panel.x + 0.01 * W;
  const bottomY = panel.y + panel.h - height - 0.012 * H;
  const topY = panel.y + 0.012 * H;
  const y = titleBox && overlaps(x, bottomY, width, height, titleBox) ? topY : bottomY;

  ctx.save();
  ctx.fillStyle = rgba(palette.ink, 0.92);
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x, y, Math.max(2, 0.003 * W), height);

  const maxText = width - padX * 2 - 0.003 * W;
  const drawSize = Math.min(size, size * (maxText / Math.max(1, textW)));
  ctx.fillStyle = palette.cream;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawTracked(ctx, label, x + padX, y + height / 2 + drawSize * 0.04, drawSize, tracking, 'condensed', 'fill');
  ctx.restore();
}

/** Rect intersection test used to keep role chips out from under the title. */
function overlaps(x, y, w, h, box) {
  return x < box.x + box.w && x + w > box.x && y < box.y + box.h && y + h > box.y;
}

/* ------------------------------------------------------------------ title block */

const TITLE_GRADIENT = [
  [0, '#fff7e2'],
  [0.32, '#ffd27a'],
  [0.55, '#ff9a4d'],
  [0.8, '#ff2e88'],
  [1, '#a1118a'],
];

function capRatioOf(ctx) {
  ctx.font = fontFor('title', 200);
  const metrics = ctx.measureText('H');
  const ascent = metrics.actualBoundingBoxAscent || 144;
  return Math.max(0.6, ascent / 200);
}

function splitBalanced(ctx, words, size) {
  let best = null;
  for (let split = 1; split < words.length; split += 1) {
    const first = words.slice(0, split).join(' ');
    const second = words.slice(split).join(' ');
    const w1 = trackedWidth(ctx, first, size, -0.005);
    const w2 = trackedWidth(ctx, second, size, -0.005);
    const widest = Math.max(w1, w2);
    const balance = Math.abs(w1 - w2);
    if (!best || balance < best.balance) best = { balance, lines: [first, second], widest };
  }
  return best;
}

/**
 * The top edge of the layout's bottom panel row, in pixels. Derived from the real panel geometry so
 * the guard holds for poster, collage and nine: a row is the set of panels whose top is nearest the
 * field's foot, and its top edge is the highest top among the panels in that row.
 */
function bottomRowTop(state) {
  const { panels, field } = layoutPanels(state.layout, state.width, state.height);
  if (!panels.length) return null;
  const lowest = Math.max(...panels.map((panel) => panel.y));
  const row = panels.filter((panel) => Math.abs(panel.y - lowest) < field.h * 0.02);
  return Math.min(...row.map((panel) => panel.y));
}

/**
 * Measure the title block: the line split, the font size, the baselines, and where the script
 * goes. One line fills 0.93 of the inner width; two lines when the layout is portrait or when one
 * line would be so small it stops being a poster title.
 */
export function layoutTitleBlock(ctx, state, geometry) {
  const H = state.height;
  const inner = geometry.inner;
  const field = geometry.field;
  const centerX = field.x + field.w / 2;
  const portrait = state.height > state.width;
  const targetWidth = (portrait ? 0.88 : 0.8) * inner.w;
  const words = UPPER(state.title)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const capRatio = capRatioOf(ctx);
  const maxCap = (state.height > state.width ? 0.22 : 0.18) * H;
  const maxSize = maxCap / capRatio;
  const tracking = -0.005;

  if (!words.length) return { lines: [], size: 0, baselines: [], centerX, titleBottom: field.y + field.h };

  const joined = words.join(' ');
  const joinedAt100 = trackedWidth(ctx, joined, 100, tracking);
  const oneLineSize = Math.min((targetWidth * 100) / Math.max(1, joinedAt100), maxSize);
  // Two lines when the post is portrait, or when the title cannot fit on one line near full size.
  const twoLine = words.length >= 2 && (portrait || oneLineSize < maxSize * 0.72);

  let lines = [joined];
  let size = oneLineSize;

  if (twoLine) {
    const balanced = splitBalanced(ctx, words, 100);
    if (balanced) {
      lines = balanced.lines;
      const widest = balanced.widest;
      size = Math.min((targetWidth * 100) / Math.max(1, widest), maxSize);
    }
  }

  // A title may not eat the field: on a portrait or square post two caps of 0.28H would cover the
  // role chips and the upper panels, so clamp the whole block to a share of the field height.
  const maxBlock = (lines.length > 1 ? 0.46 : 0.52) * field.h;
  if (lines.length * size * 0.92 > maxBlock) size = maxBlock / (lines.length * 0.92);

  size = Math.max(0.035 * H, size);
  let lineHeight = size * 0.92;
  let capH = size * capRatio;

  // Sit the block on the field's foot, held 0.09H clear of it so the script subtitle keeps its own
  // band between the title and the bottom strip.
  const titleBottom = field.y + field.h - 0.09 * H;

  // The role chips of the bottom row must never be covered: it is the painted top edge that has to
  // stay 0.055H below that row's top, not just the cap line, because the cream keyline rides half
  // its 0.036H width above the cap. The row's top comes from the panels themselves, so this holds
  // for poster, collage and nine alike.
  const rowTop = bottomRowTop(state);
  const keylineTop = 0.018 * H;
  const minTop = rowTop != null ? rowTop + 0.055 * H + keylineTop : null;
  const perLine = (lines.length - 1) * 0.92 + capRatio;
  const roomForSize = minTop != null ? (titleBottom - minTop) / perLine : Infinity;
  if (size > roomForSize) size = Math.max(0.03 * H, roomForSize);

  lineHeight = size * 0.92;
  capH = size * capRatio;
  const blockHeight = lines.length * lineHeight;
  const baselines = lines.map((_, i) => titleBottom - (lines.length - 1 - i) * lineHeight);

  return {
    lines,
    size,
    capH,
    lineHeight,
    blockHeight,
    tracking,
    baselines,
    centerX,
    titleBottom,
    blockTop: baselines[0] - capH,
    width: Math.max(...lines.map((line) => trackedWidth(ctx, line, size, tracking))),
    box: {
      x: centerX - 0.45 * inner.w,
      y: baselines[0] - capH,
      w: 0.9 * inner.w,
      h: lines.length * lineHeight + 0.075 * H,
    },
  };
}

/* --- scratch canvas: lets the specular band and rim stay inside the glyphs (no text clip in canvas) */

let titleScratch = null;

function scratchFor(width, height) {
  if (!titleScratch) titleScratch = document.createElement('canvas');
  const w = Math.max(2, Math.ceil(width));
  const h = Math.max(2, Math.ceil(height));
  if (titleScratch.width !== w || titleScratch.height !== h) {
    titleScratch.width = w;
    titleScratch.height = h;
  }
  const sctx = titleScratch.getContext('2d');
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, w, h);
  sctx.globalCompositeOperation = 'source-over';
  sctx.globalAlpha = 1;
  sctx.filter = 'none';
  return { canvas: titleScratch, ctx: sctx, w, h };
}

/**
 * One title line in layers: a 1px magenta hairline, seven-step extrusion, dark outline, gradient
 * fill, a specular band clipped to the glyphs, and a thin cream top rim.
 */
function drawTitleLine(ctx, block, line, index, palette) {
  const H = palette.__height;
  const { size, centerX, tracking, capH } = block;
  const baseline = block.baselines[index];
  const glyphTop = baseline - capH;
  const glyphBottom = baseline + size * 0.1;
  const glyphH = glyphBottom - glyphTop;

  const width = trackedWidth(ctx, line, size, tracking);
  const startX = centerX - width / 2;

  ctx.save();
  ctx.font = fontFor('title', size);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // (a0) the outermost stroke: a hairline of magenta at 15%, no glow — a 1px edge, not a smear.
  ctx.strokeStyle = 'rgba(255,46,136,0.15)';
  ctx.lineWidth = 1;
  drawTracked(ctx, line, startX, baseline, size, tracking, 'title', 'stroke');

  // (a) extrusion: seven hard offsets into the magenta-black.
  ctx.fillStyle = '#1a0a2a';
  const step = 0.0045 * H;
  for (let i = 1; i <= 7; i += 1) {
    drawTracked(ctx, line, startX + step * i, baseline + step * i, size, tracking, 'title', 'fill');
  }

  // (b) cream keyline then ink ring, outside in.
  ctx.strokeStyle = '#fff3e0';
  ctx.lineWidth = 0.036 * H;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawTracked(ctx, line, startX, baseline, size, tracking, 'title', 'stroke');
  ctx.strokeStyle = '#0c0316';
  ctx.lineWidth = 0.024 * H;
  drawTracked(ctx, line, startX, baseline, size, tracking, 'title', 'stroke');

  // (c–e) fill, specular, rim on a scratch of the glyph box.
  const pad = Math.ceil(size * 0.06) + 4;
  const layer = scratchFor(width + pad * 2, glyphH + pad * 2);
  const sctx = layer.ctx;
  const sx = pad;
  const sy = pad + capH;

  sctx.font = fontFor('title', size);
  sctx.textBaseline = 'alphabetic';
  sctx.textAlign = 'left';
  sctx.lineJoin = 'round';

  const gradient = sctx.createLinearGradient(0, pad, 0, pad + glyphH);
  for (const [stop, color] of TITLE_GRADIENT) gradient.addColorStop(stop, color);
  sctx.fillStyle = gradient;
  drawTracked(sctx, line, sx, sy, size, tracking, 'title', 'fill');

  // Specular band: white 32% → 0 across the top 38% of the glyph box, only where glyphs are.
  sctx.globalCompositeOperation = 'source-atop';
  const specular = sctx.createLinearGradient(0, pad, 0, pad + glyphH * 0.38);
  specular.addColorStop(0, 'rgba(255,255,255,0.32)');
  specular.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = specular;
  sctx.fillRect(0, pad, layer.w, glyphH * 0.38);

  // Cream top rim, inside the same clip.
  sctx.globalCompositeOperation = 'source-atop';
  sctx.strokeStyle = 'rgba(255,247,226,0.55)';
  sctx.lineWidth = Math.max(1, 0.0022 * H);
  drawTracked(sctx, line, sx, sy, size, tracking, 'title', 'stroke');

  ctx.drawImage(
    layer.canvas,
    0,
    0,
    layer.w,
    layer.h,
    Math.round(startX - pad),
    Math.round(glyphTop - pad),
    layer.w,
    layer.h,
  );
  ctx.restore();
}

/**
 * The global darkening rail: the full panel-field width, from the field's foot up 0.30H, with no
 * vertical edges — one vertical gradient from shadow 96% at the foot to 0% at its top, plus a
 * second, wider gradient that starts 0.10H above that top so the fade into the photos is soft.
 */
export function drawDarkeningRail(ctx, geometry, palette, H) {
  const field = geometry.field;
  const bottom = field.y + field.h;
  const railH = 0.30 * H;
  const top = bottom - railH;
  const softTop = top - 0.10 * H;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // The rail itself: opaque at the foot, clear at its top edge.
  const rail = ctx.createLinearGradient(0, top, 0, bottom);
  rail.addColorStop(0, rgba(palette.shadow, 0));
  rail.addColorStop(1, rgba(palette.shadow, 0.96));
  ctx.fillStyle = rail;
  ctx.fillRect(field.x, top, field.w, railH);

  // The wider fade: begins 0.10H above the rail's top edge and continues down into it with no
  // seam, so the photos melt into the rail over a span of more than 0.12H.
  const fadeSpan = bottom - softTop;
  const fade = ctx.createLinearGradient(0, softTop, 0, bottom);
  fade.addColorStop(0, rgba(palette.shadow, 0));
  fade.addColorStop((0.10 * H) / fadeSpan, rgba(palette.shadow, 0.02));
  fade.addColorStop(1, rgba(palette.shadow, 0.1));
  ctx.fillStyle = fade;
  ctx.fillRect(field.x, softTop, field.w, fadeSpan);
  ctx.restore();
}

/** Where the script subtitle sits, measured once so the title can keep clear of it. */
function scriptLayout(ctx, state, geometry, block) {
  const H = state.height;
  const inner = geometry.inner;
  const text = String(state.subtitle ?? '').trim();
  if (!text) return null;
  const size = 0.085 * H;
  const maxWidth = 0.78 * inner.w;

  ctx.save();
  ctx.font = fontFor('script', size);
  const natural = ctx.measureText(text).width;
  const drawSize = natural > 0 ? Math.min(size, (size * maxWidth) / natural) : size;
  ctx.font = fontFor('script', drawSize);
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || drawSize * 0.8;
  ctx.restore();

  const lastIndex = block.lines.length - 1;
  if (lastIndex < 0) return null;
  let baseline = block.baselines[lastIndex] + 0.032 * H;
  baseline = Math.min(baseline, geometry.field.y + geometry.field.h - 0.055 * H);
  const lastLineWidth = trackedWidth(ctx, block.lines[lastIndex], block.size, block.tracking);
  let rightX = block.centerX + lastLineWidth / 2 + 0.015 * inner.w;
  rightX = Math.min(rightX, geometry.inner.x + geometry.inner.w - 0.02 * inner.w);
  return { text, drawSize, width, maxWidth, baseline, rightX, top: baseline - ascent - 0.008 * H };
}

/**
 * The script subtitle: Pacifico in warm cream with a magenta bloom, rotated -3.5°, riding just
 * above the title's cap line and sitting clear of the field's foot so its descenders never reach
 * the bottom strip. A tapering quadratic swash is drawn under it.
 */
function drawScriptLine(ctx, state, geometry, block, palette) {
  const H = state.height;
  const inner = geometry.inner;
  const script = scriptLayout(ctx, state, geometry, block);
  if (!script) return;
  const { text, drawSize, width, rightX, baseline } = script;

  // Draw the script as one string (per-character tracking would break Pacifico's connections).
  ctx.save();
  ctx.font = fontFor('script', drawSize);

  ctx.translate(rightX, baseline);
  ctx.rotate((-3.5 * Math.PI) / 180);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(10,3,20,0.95)';
  ctx.shadowBlur = 0.024 * H;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0.008 * H;
  ctx.fillStyle = '#2a0718';
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = 'rgba(255,46,136,0.95)';
  ctx.shadowBlur = 0.02 * H;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffe6f2';
  ctx.fillText(text, 0, 0);
  ctx.restore();

  // Swash: a shallow quadratic below the script, tapering to nothing at both ends.
  const left = -width + 0.02 * inner.w;
  const right = 0.01 * inner.w;
  const sag = drawSize * 0.2;
  const segments = 30;
  ctx.save();
  ctx.translate(rightX, baseline + 0.012 * H);
  ctx.rotate((-3.5 * Math.PI) / 180);
  ctx.strokeStyle = rgba(palette.magenta, 0.8);
  ctx.lineCap = 'round';
  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const p0 = quadPoint(left, right, drawSize * 0.06, sag, t0);
    const p1 = quadPoint(left, right, drawSize * 0.06, sag, t1);
    const taper = Math.sin(Math.PI * ((t0 + t1) / 2));
    ctx.globalAlpha = 0.8 * (0.25 + 0.75 * taper);
    ctx.lineWidth = Math.max(0.6, 0.0028 * H * taper);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

function quadPoint(x0, x1, y, sag, t) {
  const cx = (x0 + x1) / 2;
  const cy = y + sag * 2;
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    y: mt * mt * y + 2 * mt * t * cy + t * t * y,
  };
}

/**
 * The tagline, in the bottom strip only: cream capitals at 90%, wide tracking, a small gold
 * diamond either side. Fitted to the strip width and never ellipsized.
 */
function drawTagline(ctx, state, cx, baseline, maxWidth, palette) {
  const H = state.height;
  const text = UPPER(state.tagline).trim();
  if (!text) return;
  const size = 0.022 * H;
  const tracking = 0.22;
  const drawSize = fitSize(ctx, text, size, tracking, maxWidth, 'condensed', 0.4);
  const width = trackedWidth(ctx, text, drawSize, tracking, 'condensed');
  const x = cx - width / 2;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(palette.cream, 0.9);
  drawTracked(ctx, text, x, baseline, drawSize, tracking, 'condensed', 'fill');
  const diamond = 0.005 * H;
  const gap = 0.012 * H;
  drawDiamond(ctx, x - gap - diamond, baseline, diamond, palette.gold);
  drawDiamond(ctx, x + width + gap + diamond, baseline, diamond, palette.gold);
  ctx.restore();
}

/**
 * The title glyphs and script — everything except the rail. Exported separately so render.js can
 * slot the role chips between the rail and the lettering: the rail sinks the panels, the chips
 * stay crisp on top of it, and the title then wins wherever they overlap. Nothing prints over
 * the field beyond the glyphs, the script and the chips; the tagline lives in the bottom strip.
 */
export function drawTitleGlyphs(ctx, geometry, state, palette, measured = null) {
  const block = measured ?? layoutTitleBlock(ctx, state, geometry);
  if (!block.lines.length) return block;
  const scoped = { ...palette, __height: state.height };
  ctx.save();
  ctx.beginPath();
  ctx.rect(geometry.field.x, geometry.field.y, geometry.field.w, geometry.field.h);
  ctx.clip();
  block.lines.forEach((line, index) => drawTitleLine(ctx, block, line, index, scoped));
  drawScriptLine(ctx, state, geometry, block, palette);
  ctx.restore();
  return block;
}

/** Rail + glyphs, in one call, for callers that do not need to interleave anything. */
export function drawTitleBlock(ctx, geometry, state, palette) {
  drawDarkeningRail(ctx, geometry, palette, state.height);
  return drawTitleGlyphs(ctx, geometry, state, palette);
}

/* ------------------------------------------------------------------ bottom strip */

/** Barcode bands seeded from the caption title: same title, same code, every render. */
function drawBarcode(ctx, x, y, maxWidth, barHeight, digitsSize, seedText, palette) {
  let seed = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const bars = [];
  let total = 0;
  while (bars.length < 40) {
    const w = 1 + Math.floor(random() * 4);
    const gap = 1 + Math.floor(random() * 3);
    if (total + w > maxWidth) break;
    bars.push({ x: total, w });
    total += w + gap;
    if (bars.length >= 28 && random() > 0.35) break;
  }

  ctx.save();
  ctx.fillStyle = rgba(palette.cream, 0.8);
  for (const bar of bars) ctx.fillRect(Math.round(x + bar.x), Math.round(y), bar.w, Math.round(barHeight));

  // Digits under the bars, in two tight groups so they read as a printed code, never wider than
  // the bars themselves.
  const digits = '7 4 8 2 9 0 1 6';
  const tracking = 0.1;
  const size = fitSize(ctx, digits, digitsSize, tracking, total, 'barlow', 0.5);
  ctx.fillStyle = rgba(palette.cream, 0.55);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  drawTracked(ctx, digits, x, y + barHeight + digitsSize * 1.15, size, tracking, 'barlow', 'fill');
  ctx.restore();
  return total;
}

/**
 * The round seal: one 2px gold ring on ink, ORIGINAL over three 3px stars over COVER ART,
 * rotated -9°. The type is fitted to the chord of the ring at its own height, so it can never
 * run into the ring however small the canvas is.
 */
function drawSeal(ctx, cx, cy, radius, H, palette) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-9 * Math.PI) / 180);

  ctx.beginPath();
  ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
  ctx.fillStyle = palette.ink;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.gold;
  ctx.stroke();

  const innerR = radius - 3;
  ctx.fillStyle = palette.gold;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Chord width available at a given |y| inside the ring.
  const chord = (y, margin) => 2 * Math.sqrt(Math.max(0, (innerR - margin) ** 2 - y ** 2));

  const fitLine = (text, baseSize, y, tracking) => {
    const max = chord(y, 2);
    let size = baseSize;
    let width = trackedWidth(ctx, text, size, tracking, 'condensed');
    if (width > max && width > 0) {
      size *= max / width;
      width = trackedWidth(ctx, text, size, tracking, 'condensed');
    }
    return { size, width };
  };

  const topY = -radius * 0.36;
  const top = fitLine('ORIGINAL', 0.0075 * H, topY, 0.05);
  drawTracked(ctx, 'ORIGINAL', -top.width / 2, topY, top.size, 0.05, 'condensed', 'fill');

  for (let i = -1; i <= 1; i += 1) drawStar(ctx, i * radius * 0.21, 0, 3, palette.gold);

  const bottomY = radius * 0.38;
  const bottom = fitLine('COVER ART', 0.0075 * H, bottomY, 0.05);
  drawTracked(ctx, 'COVER ART', -bottom.width / 2, bottomY, bottom.size, 0.05, 'condensed', 'fill');
  ctx.restore();
}

/**
 * The bottom strip, two rows and nothing else: (1) the tagline between two gold diamonds, then a
 * 1px cream rule at 18% across the full width; (2) barcode + digits at the left, the credit line
 * centred, the seal at the right.
 */
export function drawBottomStrip(ctx, geometry, state, palette) {
  const strip = geometry.bottomStrip;
  if (strip.h <= 0) return;
  const H = state.height;
  const W = state.width;
  const pad = 0.012 * W;

  ctx.save();

  // Row 1: the tagline, sole owner of the poster's tagline.
  const taglineBaseline = strip.y + 0.022 * H;
  const diamond = 0.005 * H;
  const diamondGap = 0.012 * H;
  const taglineMax = strip.w - pad * 2 - 4 * (diamond + diamondGap);
  drawTagline(ctx, state, strip.x + strip.w / 2, taglineBaseline, taglineMax, palette);
  // The rule, 0.012H under the tagline baseline, edge to edge.
  const ruleY = Math.round(taglineBaseline + 0.012 * H);
  ctx.fillStyle = rgba(palette.cream, 0.18);
  ctx.fillRect(strip.x, ruleY, strip.w, 1);

  // Row 2: barcode · credit · seal.
  const rowTop = ruleY + 1;
  const rowBottom = strip.y + strip.h;
  const rowH = Math.max(8, rowBottom - rowTop);
  const midY = rowTop + rowH / 2;

  const radius = 0.030 * H;
  const sealCx = strip.x + strip.w - pad - radius;
  drawSeal(ctx, sealCx, midY, radius, H, palette);

  const barHeight = Math.max(4, rowH * 0.46);
  const digitsSize = 0.011 * H;
  const barTop = midY - (barHeight + digitsSize * 0.9) / 2;
  const used = drawBarcode(
    ctx,
    strip.x + pad,
    barTop,
    0.075 * W,
    barHeight,
    digitsSize,
    UPPER(state.title),
    palette,
  );

  const leftEdge = strip.x + pad + used + 0.02 * W;
  const rightEdge = sealCx - radius - 0.02 * W;
  const available = Math.max(40, rightEdge - leftEdge);
  const credit = UPPER(state.credit).trim();
  if (credit) {
    // Shrink to fit — the credit is never cut. Tracking tightens first, then the size falls.
    let size = Math.max(1, 0.0135 * H);
    let tracking = 0.12;
    for (const track of [0.12, 0.08, 0.05, 0.02]) {
      tracking = track;
      if (trackedWidth(ctx, credit, size, tracking, 'condensed') <= available * 0.999) break;
    }
    const wide = trackedWidth(ctx, credit, size, tracking, 'condensed');
    if (wide > available * 0.999) {
      size = Math.max(1, (size * available) / wide * 0.999);
      tracking = 0.02;
    }
    ctx.fillStyle = rgba(palette.cream, 0.5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    drawTrackedAligned(ctx, credit, (leftEdge + rightEdge) / 2, midY, size, tracking, 'condensed', 'center', 'fill');
  }
  ctx.restore();
}
