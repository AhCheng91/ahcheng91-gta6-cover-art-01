import { roundRectPath, polyPath, rngFor, clamp, hexToRgba } from './util.js';
import { FONT_CONDENSED } from './lettering.js';

const CREAM = '#FFF3DC';
const SEAL_INK = '#4A2A06';
const BARCODE_INK = '#1b0728';
const FOOTER_BG = '#1B0728';
const SEAL_TEETH = 28;
const SEAL_INNER = 0.93;
const BARCOUNT = 42;

function captionOf(value) {
  if (!value) return {};
  if (value.caption && typeof value.caption === 'object') return value.caption;
  return value;
}

function drawTracked(ctx, text, x, y, size, track) {
  const chars = Array.from(String(text));
  let cx = x;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += ctx.measureText(chars[i]).width;
    if (i < chars.length - 1) cx += track * size;
  }
  return cx;
}

function sealPath(ctx, cx, cy, r) {
  const inner = r * SEAL_INNER;
  ctx.beginPath();
  for (let i = 0; i < SEAL_TEETH * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / SEAL_TEETH;
    const rad = i % 2 === 0 ? r : inner;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sealTextHeight(ctx, size) {
  const m = ctx.measureText('H');
  const a = m && m.actualBoundingBoxAscent;
  return a && a > 0 ? a : size * 0.72;
}

function sealLines(ctx, cx, cy, r) {
  const lines = [
    { text: 'ORIGINAL', size: r * 0.30, weight: '' },
    { text: 'COVER ART', size: r * 0.34, weight: 'bold ' },
    { text: '★ BEST CAST ★', size: r * 0.24, weight: '' }
  ];
  const gap = r * 0.06;
  let blockH = gap * (lines.length - 1);
  for (let i = 0; i < lines.length; i++) {
    ctx.font = lines[i].weight + lines[i].size + 'px ' + FONT_CONDENSED;
    lines[i].cap = sealTextHeight(ctx, lines[i].size);
    blockH += lines[i].cap;
  }

  const maxWidth = Math.max(1, r * 1.1);
  let top = cy - blockH / 2;
  ctx.fillStyle = SEAL_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const baseline = top + line.cap;
    ctx.font = line.weight + line.size + 'px ' + FONT_CONDENSED;
    ctx.fillText(line.text, cx, baseline, maxWidth);
    top = baseline + gap;
  }
}

export function drawSeal(ctx, geom, palette) {
  const seal = geom && geom.seal;
  if (!ctx || !seal || !(seal.r > 0)) return;
  const { cx, cy, r } = seal;

  ctx.save();
  const gradient = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r * 1.05);
  gradient.addColorStop(0, '#FFE08A');
  gradient.addColorStop(0.55, '#F5B72E');
  gradient.addColorStop(1, '#C98A12');

  ctx.shadowColor = 'rgba(42,11,51,0.62)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur = Math.max(1.5, r * 0.06);
  ctx.fillStyle = gradient;
  sealPath(ctx, cx, cy, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  sealLines(ctx, cx, cy, r);
  ctx.restore();
}

function barPlan(seed) {
  const rng = rngFor(seed);
  const bars = [];
  for (let i = 0; i < BARCOUNT; i++) {
    bars.push({ w: 2, gap: i < BARCOUNT - 1 ? 2 : 0 });
  }
  const tone = [];
  for (let i = 0; i < BARCOUNT; i++) tone.push(rng.next() < 0.5 ? 0 : 1);
  return { bars, tone };
}

export function drawBarcode(ctx, geom, palette) {
  const box = geom && geom.barcode;
  if (!ctx || !box || !(box.w > 0) || !(box.h > 0)) return;

  const x = box.x;
  const y = box.y;
  const w = box.w;
  const h = box.h;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.strokeStyle = 'rgba(43,13,63,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const { bars, tone } = barPlan(1986 + 7281);
  const startX = x + 7;
  const barH = Math.max(1, h - 15 - 15);
  const bottom = y + h - 15;
  const avail = Math.max(1, w - 7 - 8);
  const nominal = BARCOUNT * 2 + (BARCOUNT - 1) * 2;
  const pitch = nominal <= avail ? 4 : avail / BARCOUNT;
  const barW = Math.max(1, pitch * 0.5);
  const gapW = Math.max(0.5, pitch - barW);

  ctx.fillStyle = BARCODE_INK;
  let cursor = startX;
  for (let i = 0; i < bars.length; i++) {
    if (tone[i]) ctx.fillRect(cursor, bottom - barH, barW, barH);
    cursor += barW + gapW;
  }

  const digitSize = 9;
  ctx.font = digitSize + 'px ' + FONT_CONDENSED;
  ctx.fillStyle = BARCODE_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('72815877', startX + (cursor - gapW - startX) / 2, y + h - 5, Math.max(1, w - 10));
  ctx.restore();
}

function fitCreditLines(ctx, lines, size, maxWidth) {
  let px = size;
  for (let k = 0; k < 8; k++) {
    let widest = 0;
    ctx.font = px + 'px ' + FONT_CONDENSED;
    for (let i = 0; i < lines.length; i++) {
      widest = Math.max(widest, ctx.measureText(lines[i]).width);
    }
    if (widest <= maxWidth || px <= 8) return px;
    px *= 0.94;
  }
  return px;
}

export function drawFooter(ctx, geom, captionArg, palette) {
  const band = geom && geom.footer;
  if (!ctx || !band) return;

  const caption = captionOf(captionArg);
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const top = band.y;
  const bandH = Math.max(1, H - top);

  ctx.save();
  ctx.fillStyle = FOOTER_BG;
  ctx.fillRect(0, top, W, bandH);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, top, W, 2);

  const leftSize = 0.026 * H;
  const track = 0.22;
  const leftX = 0.018 * W;
  ctx.font = leftSize + 'px ' + FONT_CONDENSED;
  ctx.fillStyle = '#FF8A4C';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const endX = drawTracked(ctx, 'COMING SOON', leftX, top + bandH / 2, leftSize, track);

  const dr = leftSize * 0.24;
  const dx = endX + 0.012 * W;
  const dy = top + bandH / 2;
  polyPath(ctx, [
    [dx, dy - dr],
    [dx + dr * 0.66, dy],
    [dx, dy + dr],
    [dx - dr * 0.66, dy]
  ]);
  ctx.fillStyle = CREAM;
  ctx.fill();

  const credits = Array.isArray(caption.credits) ? caption.credits.slice(0, 3) : [];
  const creditSize = 0.0135 * H;
  const creditMax = Math.max(
    40,
    Math.min(
      W * 0.5,
      (geom.barcode ? geom.barcode.x : 0.86 * W) - W / 2 - 0.02 * W
    )
  );
  const px = fitCreditLines(ctx, credits, creditSize, creditMax);
  const lineGap = 4;
  const step = px + lineGap;
  const mid = top + bandH / 2;
  const first = mid - (step * (credits.length - 1)) / 2;

  ctx.font = px + 'px ' + FONT_CONDENSED;
  ctx.fillStyle = hexToRgba(CREAM, 0.72);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < credits.length; i++) {
    ctx.fillText(credits[i], W / 2, first + i * step, creditMax);
  }

  drawBarcode(ctx, geom, palette);
  ctx.restore();
}

export function drawVolumeChip(ctx, geom, captionArg, palette) {
  const chip = geom && geom.volume;
  if (!ctx || !chip || !(chip.w > 0) || !(chip.h > 0)) return;

  const caption = captionOf(captionArg);
  const text = String(caption.volume || 'VOL. 02').trim().toUpperCase() || 'VOL. 02';
  const size = chip.h * 0.42;

  ctx.save();
  roundRectPath(ctx, chip.x, chip.y, chip.w, chip.h, chip.h * 0.42);
  ctx.fillStyle = 'rgba(16,5,24,0.72)';
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = size + 'px ' + FONT_CONDENSED;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, chip.x + chip.w / 2, chip.y + chip.h / 2 + 1, chip.w - 8);
  ctx.restore();
}
