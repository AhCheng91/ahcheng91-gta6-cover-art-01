import {
  clamp,
  canvas2d,
  tintMask,
  dilateMask,
  maskPaint,
  roundRectPath,
  polyPath
} from './util.js';
import { rolePlateRect } from './panels.js';

export const FONT_TITLE = "'Anton', 'Archivo Black', system-ui, sans-serif";
export const FONT_SCRIPT = "'Pacifico', cursive";
export const FONT_CONDENSED = "'Barlow Condensed', 'Arial Narrow', sans-serif";
export const FONT_HEAVY = "'Archivo Black', sans-serif";

const CREAM = '#FFF3DC';
const PLUM = '#2B0D3F';
const OUTER = '#2A0B33';
const TITLE_TRACK = -0.012;
const STRIPES = [
  [0.0, '#FFF6E2'],
  [0.14, '#FFD98A'],
  [0.32, '#FF9A3C'],
  [0.54, '#FF3E86'],
  [0.74, '#C42A78'],
  [1.0, '#6B1F6E']
];

function captionOf(value) {
  if (!value) return {};
  if (value.caption && typeof value.caption === 'object') return value.caption;
  return value;
}

function readArgs(captionArg, paletteArg, measuredArg) {
  const caption = captionOf(captionArg);
  const measured = measuredArg || (paletteArg && paletteArg.lines ? paletteArg : null);
  return { caption, measured };
}

function canvasSize(ctx) {
  const w = (ctx && ctx.canvas && ctx.canvas.width) || 1080;
  const h = (ctx && ctx.canvas && ctx.canvas.height) || 1080;
  return { W: w, H: h };
}

function capHeightFor(ctx, size) {
  const m = ctx.measureText('H');
  const a = m && m.actualBoundingBoxAscent;
  if (a && a > 0) return a;
  return size * 0.72;
}

export function lineWidth(ctx, text, size, track = 0) {
  const chars = Array.from(String(text));
  const em = (Number(track) || 0) * size;
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    w += ctx.measureText(chars[i]).width;
    if (i < chars.length - 1) w += em;
  }
  return w;
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

function splitMiddle(text) {
  const chars = Array.from(text);
  let best = -1;
  let bestD = Infinity;
  for (let i = 1; i < chars.length - 1; i++) {
    if (chars[i] !== ' ') continue;
    const d = Math.abs(i - (chars.length - 1) / 2);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const a = chars.slice(0, best).join('').trim();
  const b = chars.slice(best + 1).join('').trim();
  if (!a || !b) return null;
  return [a, b];
}

function ellipsize(ctx, text, size, track, maxWidth) {
  const str = String(text);
  if (lineWidth(ctx, str, size, track) <= maxWidth) return str;
  const chars = Array.from(str);
  while (chars.length > 1) {
    chars.pop();
    const head = chars.join('').replace(/[\s·.,:\-–—]+$/u, '');
    const probe = head + '…';
    if (lineWidth(ctx, probe, size, track) <= maxWidth) return probe;
  }
  return '…';
}

export function measuredTitle(ctx, geom, captionArg) {
  const caption = captionOf(captionArg);
  const { W, H } = canvasSize(ctx);
  const band = (geom && geom.title) || { x: 0, y: 0, w: W, h: 0.3 * H };
  const bandW = Math.max(1, band.w);
  const bandH = Math.max(1, band.h);

  let text = String((caption && caption.title) || 'SOLARIS VICE').trim().toUpperCase();
  if (!text) text = 'SOLARIS VICE';

  const lines = [text];
  const gap = 0;
  const track = TITLE_TRACK;
  const wide = W / H > 1.5;

  const maxW = (wide ? 0.72 : 0.94) * bandW;
  const capLimit = (wide ? 0.225 : 0.16) * H;

  let lo = 10;
  let hi = Math.max(40, 0.60 * H);
  let sizeByWidth = 10;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    ctx.font = mid + 'px ' + FONT_TITLE;
    if (lineWidth(ctx, text, mid, track) <= maxW) {
      sizeByWidth = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  ctx.font = 100 + 'px ' + FONT_TITLE;
  const capRatio = Math.max(0.1, capHeightFor(ctx, 100) / 100);
  const sizeByCap = capLimit / capRatio;
  const sizeByHeight = bandH / 1.6 / capRatio;

  let size = Math.min(sizeByWidth, sizeByCap, sizeByHeight);
  size = Math.max(10, size);

  const square = W / H < 1.1;
  const fitLimit = (square ? 0.88 : 0.9) * bandW;
  ctx.font = size + 'px ' + FONT_TITLE;
  let widest = 0;
  for (let i = 0; i < lines.length; i++) {
    widest = Math.max(widest, lineWidth(ctx, lines[i], size, track));
  }
  if (widest > fitLimit && widest > 0) {
    size = Math.max(10, size * (fitLimit / widest));
    ctx.font = size + 'px ' + FONT_TITLE;
  }

  const capH = capHeightFor(ctx, size);
  const lineHeight = capH + gap;
  const blockH = capH;
  const blockTop = band.y + 0.05 * bandH;
  const blockBottom = blockTop + blockH;

  const baselines = [blockTop + capH];

  ctx.font = size + 'px ' + FONT_TITLE;
  let paintedW = 0;
  for (let i = 0; i < lines.length; i++) {
    paintedW = Math.max(paintedW, lineWidth(ctx, lines[i], size, track));
  }

  return {
    lines,
    size,
    capH,
    track,
    lineHeight,
    baselines,
    blockTop,
    blockBottom,
    paintedW,
    box: {
      x: band.x,
      y: blockTop - 0.05 * capH,
      w: bandW,
      h: blockH + 0.1 * capH
    },
    canvasW: W,
    canvasH: H,
    band
  };
}

export function fitTitleLines(ctx, text, maxWidth, maxLines = 1, maxSize = 0) {
  const W = (ctx && ctx.canvas && ctx.canvas.width) || 1080;
  const H = (ctx && ctx.canvas && ctx.canvas.height) || 1080;
  const upper = String(text || '').toUpperCase();
  const limit = maxSize > 0 ? maxSize : 0.24 * H;
  const count = Math.max(1, Math.min(4, maxLines | 0 || 1));
  const split = count > 1 ? splitMiddle(upper) : null;
  const lines = split || [upper];
  let lo = 10;
  let hi = Math.max(10, limit);
  let best = 10;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    ctx.font = mid + 'px ' + FONT_TITLE;
    let ok = true;
    for (let i = 0; i < lines.length; i++) {
      if (lineWidth(ctx, lines[i], mid, TITLE_TRACK) > maxWidth) {
        ok = false;
        break;
      }
    }
    if (ok) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { lines, size: best, maxWidth, W };
}

function taperedDiamond(ctx, cx, cy, rx, ry) {
  const tx = rx * 0.16;
  const ty = ry * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.quadraticCurveTo(cx + tx, cy - ty, cx + rx, cy);
  ctx.quadraticCurveTo(cx + tx, cy + ty, cx, cy + ry);
  ctx.quadraticCurveTo(cx - tx, cy + ty, cx - rx, cy);
  ctx.quadraticCurveTo(cx - tx, cy - ty, cx, cy - ry);
  ctx.closePath();
}

function glint(ctx, cx, cy, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,247,230,0.55)');
  g.addColorStop(1, 'rgba(255,247,230,0)');
  ctx.fillStyle = g;
  taperedDiamond(ctx, cx, cy, r * 0.2, r);
  ctx.fill();
  taperedDiamond(ctx, cx, cy, r, r * 0.2);
  ctx.fill();
  const dr = r * 0.21;
  const dots = [
    [cx + r * 1.25, cy - r * 0.7],
    [cx - r * 0.62, cy + r * 0.95]
  ];
  for (let i = 0; i < dots.length; i++) {
    const dg = ctx.createRadialGradient(dots[i][0], dots[i][1], 0, dots[i][0], dots[i][1], dr);
    dg.addColorStop(0, 'rgba(255,255,255,0.85)');
    dg.addColorStop(1, 'rgba(255,247,230,0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(dots[i][0], dots[i][1], dr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function titleMask(text, size, track, width, capH, font) {
  const pad = Math.ceil(0.055 * size + 6);
  const mw = Math.max(1, Math.ceil(pad * 2 + width));
  const mh = Math.max(1, Math.ceil(capH * 1.9));
  const { canvas, ctx } = canvas2d(mw, mh);
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  const base = capH * 1.15;
  drawTracked(ctx, text, pad, base, size, track);
  return { canvas, pad, mw, mh, base };
}

function paintLineFill(mask, mw, mh, capH, W) {
  const top = 0.15 * capH;
  const bot = 1.15 * capH;
  const fill = maskPaint(
    mask,
    (fctx) => {
      const g = fctx.createLinearGradient(0, top, 0, bot);
      for (let i = 0; i < STRIPES.length; i++) g.addColorStop(STRIPES[i][0], STRIPES[i][1]);
      fctx.fillStyle = g;
      fctx.fillRect(0, top, mw, bot - top);

      const lw = Math.max(1, 2 * (W / 1080));
      fctx.fillStyle = 'rgba(90,20,70,0.32)';
      const cuts = [0.16, 0.32, 0.5, 0.7, 0.86, 1];
      for (let i = 0; i < cuts.length; i++) {
        const y = top + (bot - top) * cuts[i];
        fctx.fillRect(0, y - lw / 2, mw, lw);
      }

      const sgStart = top + 0.06 * capH;
      const sgEnd = top + 0.26 * capH;
      const sg = fctx.createLinearGradient(0, sgStart, 0, sgEnd);
      sg.addColorStop(0, 'rgba(255,255,255,0.16)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      fctx.fillStyle = sg;
      fctx.fillRect(0, sgStart, mw, sgEnd - sgStart);
    },
    mw,
    mh
  );
  return fill;
}

function drawTitleLine(ctx, text, cx, baseline, m) {
  const size = m.size;
  const capH = m.capH;
  const track = m.track;
  const font = size + 'px ' + FONT_TITLE;
  const W = (ctx.canvas && ctx.canvas.width) || 1080;

  ctx.save();
  ctx.font = font;
  const width = lineWidth(ctx, text, size, track);
  ctx.restore();

  const mask = titleMask(text, size, track, width, capH, font);
  const originX = cx - width / 2 - mask.pad;
  const originY = baseline - mask.base;

  const tinted = tintMask(mask.canvas, PLUM, mask.mw, mask.mh);
  for (let i = 8; i >= 1; i--) {
    const dx = (i / 8) * 0.04 * size;
    const dy = (i / 8) * 0.06 * size;
    ctx.drawImage(tinted, originX + dx, originY + dy);
  }

  const outer = dilateMask(mask.canvas, OUTER, 0.075 * size, 20);
  ctx.drawImage(outer, originX, originY);

  const ring = dilateMask(mask.canvas, CREAM, 0.055 * size, 20);
  ctx.drawImage(ring, originX, originY);

  const fill = paintLineFill(mask.canvas, mask.mw, mask.mh, capH, W);
  ctx.drawImage(fill, originX, originY);

  const gr = 0.24 * capH;
  glint(ctx, originX + mask.pad + 0.1 * size, originY + 0.22 * capH, gr);
}

export function drawTitle(ctx, geom, captionArg, paletteArg, measuredArg) {
  const { caption, measured: given } = readArgs(captionArg, paletteArg, measuredArg);
  const m = given || measuredTitle(ctx, geom, caption);
  const cx = geom.title.x + geom.title.w / 2;
  ctx.save();
  for (let i = 0; i < m.lines.length; i++) {
    drawTitleLine(ctx, m.lines[i], cx, m.baselines[i], m);
  }
  ctx.restore();
  return m;
}

function scriptPlacement(m, bandWArg) {
  const boxW = (m.box && m.box.w) || 0;
  const bandW = Math.max(1, bandWArg || boxW || 1);
  const paintedW = Number.isFinite(m.paintedW) ? m.paintedW : 0;
  if (paintedW > 0.8 * bandW) {
    const size = 0.34 * m.capH;
    return { centred: true, size, baseline: m.blockBottom + 0.55 * size };
  }
  const size = 0.42 * m.capH;
  return { centred: false, size, baseline: m.blockBottom + 0.42 * size };
}

export function drawScript(ctx, geom, captionArg, paletteArg, measuredArg) {
  const { caption, measured: given } = readArgs(captionArg, paletteArg, measuredArg);
  const m = given || measuredTitle(ctx, geom, caption);
  const text = String(caption.subtitle || '').trim();
  if (!text) return;

  const W = (ctx.canvas && ctx.canvas.width) || 1080;
  const { centred, size, baseline } = scriptPlacement(m, geom && geom.title && geom.title.w);
  const font = size + 'px ' + FONT_SCRIPT;

  ctx.save();
  ctx.font = font;
  const tw = lineWidth(ctx, text, size, 0);
  const pad = Math.ceil(0.2 * size + 6);

  const halo = canvas2d(Math.ceil(tw + pad * 2), Math.ceil(size * 2));
  halo.ctx.font = font;
  halo.ctx.textAlign = centred ? 'center' : 'left';
  halo.ctx.textBaseline = 'alphabetic';
  halo.ctx.fillStyle = '#ffffff';
  halo.ctx.fillText(text, centred ? (tw + pad * 2) / 2 : pad, size * 1.3);
  const ring = dilateMask(halo.canvas, CREAM, Math.max(1.5, 1.5 * (W / 1080)), 14);

  const half = tw / 2;
  const origin = centred
    ? clamp(W / 2, half, W - half)
    : clamp(geom.title.x + geom.title.w - 0.01 * W, tw, W);

  const haloX = centred ? -(tw / 2 + pad) : -(tw + pad);

  ctx.translate(origin, baseline);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.drawImage(ring, haloX, -size * 1.3);

  const g = centred
    ? ctx.createLinearGradient(-half, 0, half, 0)
    : ctx.createLinearGradient(-tw, 0, 0, 0);
  g.addColorStop(0, '#FFF7E6');
  g.addColorStop(0.45, '#FFC6E0');
  g.addColorStop(1, '#FF3E86');
  ctx.fillStyle = g;
  ctx.shadowColor = '#FF3E86';
  ctx.shadowBlur = 0.35 * size;
  ctx.textAlign = centred ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, centred ? 0 : -tw, 0);
  ctx.fillText(text, centred ? 0 : -tw, 0);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function rhombus(ctx, cx, cy, rx, ry) {
  polyPath(ctx, [
    [cx, cy - ry],
    [cx + rx, cy],
    [cx, cy + ry],
    [cx - rx, cy]
  ]);
}

export function drawRibbon(ctx, geom, captionArg, paletteArg, measuredArg) {
  const { caption, measured: given } = readArgs(captionArg, paletteArg, measuredArg);
  const m = given || measuredTitle(ctx, geom, caption);
  const text = String(caption.tagline || '').trim().toUpperCase();
  if (!text) return;

  const { W, H } = canvasSize(ctx);
  const bandH = 0.03 * H;
  const skew = 0.012 * W;
  const scriptSize = scriptPlacement(m, geom && geom.title && geom.title.w).size;
  const footerY = (geom && geom.footer && geom.footer.y) || H;
  let y = Math.min(
    m.blockBottom + scriptSize + 0.12 * scriptSize,
    footerY - bandH - 0.012 * H
  );
  if (y < m.blockBottom) y = m.blockBottom + 0.04 * H;
  const track = 0.18;

  ctx.save();
  const cx = geom.title.x + geom.title.w / 2;
  const maxBand = 0.80 * geom.title.w;
  const minSize = 0.011 * H;
  let size = 0.0155 * H;
  ctx.font = size + 'px ' + FONT_CONDENSED;
  let tw = lineWidth(ctx, text, size, track);
  let width = Math.min(maxBand, tw + 0.06 * W);

  const diaR = bandH * 0.24;
  const side = diaR * 2 + 0.008 * W;
  let textMax = Math.max(0, width - side * 2);

  for (let k = 0; k < 40 && tw > textMax && size > minSize; k++) {
    size = Math.max(minSize, size * 0.96);
    ctx.font = size + 'px ' + FONT_CONDENSED;
    tw = lineWidth(ctx, text, size, track);
    width = Math.min(maxBand, tw + 0.06 * W);
    textMax = Math.max(0, width - side * 2);
  }

  const label = text;

  polyPath(ctx, [
    [cx - width / 2 + skew, y],
    [cx + width / 2 + skew, y],
    [cx + width / 2 - skew, y + bandH],
    [cx - width / 2 - skew, y + bandH]
  ]);
  ctx.fillStyle = '#E0197B';
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1.5, 2 * (W / 1080));
  ctx.lineJoin = 'miter';
  ctx.stroke();

  ctx.fillStyle = CREAM;
  rhombus(ctx, cx - width / 2 + side * 0.5, y + bandH / 2, diaR * 0.62, diaR);
  ctx.fill();
  rhombus(ctx, cx + width / 2 - side * 0.5, y + bandH / 2, diaR * 0.62, diaR);
  ctx.fill();

  const lw = lineWidth(ctx, label, size, track);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawTracked(ctx, label, cx - lw / 2, y + bandH / 2 + 1, size, track);
  ctx.restore();
}

function star5(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawQuoteStrip(ctx, geom, captionArg, paletteArg) {
  const caption = captionOf(captionArg);
  const palette = paletteArg && typeof paletteArg === 'object' ? paletteArg : {};
  const band = geom && geom.quote;
  if (!band || !(band.w > 0)) return;

  const { W, H } = canvasSize(ctx);
  const accent = palette.accent || '#F5C542';
  const cxBand = band.x + band.w / 2;

  ctx.save();
  const bg = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  bg.addColorStop(0, '#2B0D3F');
  bg.addColorStop(1, '#1B0728');
  ctx.fillStyle = bg;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.fillStyle = CREAM;
  ctx.fillRect(band.x, band.y + band.h - 1, band.w, 1);

  const sr = 0.007 * W;
  const sGap = sr * 2.7;
  const starX = band.x + 0.018 * W + sr;
  const cy = band.y + band.h / 2;
  ctx.fillStyle = CREAM;
  for (let i = 0; i < 5; i++) {
    star5(ctx, starX + i * sGap, cy, sr);
    ctx.fill();
  }

  const quoteFont = 0.021 * H;
  const sourceFont = 0.016 * H;
  const quoteX = starX + 4 * sGap + sr + 0.016 * W;

  const chipSize = 0.014 * H;
  const volume = String(caption.volume || 'VOL. 02').trim().toUpperCase();
  ctx.font = chipSize + 'px ' + FONT_CONDENSED;
  const chipW = lineWidth(ctx, volume, chipSize, 0.08) + 0.03 * W;
  const chipH = 0.038 * H;
  const chipX = band.x + band.w - 0.018 * W - chipW;

  const source = String(caption.quoteSource || '').trim().toUpperCase();
  let sourceW = 0;
  if (source) {
    ctx.font = sourceFont + 'px ' + FONT_CONDENSED;
    sourceW = lineWidth(ctx, source, sourceFont, 0.06) + 0.014 * W;
  }

  const quote = String(caption.quote || '').trim().toUpperCase();
  if (quote) {
    ctx.font = quoteFont + 'px ' + FONT_TITLE;
    const avail = Math.max(0, chipX - 0.016 * W - quoteX - sourceW);
    const shown = ellipsize(ctx, quote, quoteFont, 0, avail);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawTracked(ctx, shown, quoteX, cy + 1, quoteFont, 0);
  }

  if (source) {
    ctx.font = sourceFont + 'px ' + FONT_CONDENSED;
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const sw = lineWidth(ctx, source, sourceFont, 0.06);
    drawTracked(ctx, source, chipX - 0.016 * W - sw, cy + 1, sourceFont, 0.06);
  }

  roundRectPath(ctx, chipX, cy - chipH / 2, chipW, chipH, chipH * 0.42);
  ctx.fillStyle = 'rgba(16,5,24,0.72)';
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 1.5 * (W / 1080);
  ctx.stroke();

  ctx.font = chipSize + 'px ' + FONT_CONDENSED;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(volume, chipX + chipW / 2, cy + 1);
  ctx.restore();
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function drawChips(ctx, a, b, c, d, e) {
  let panels;
  let geom;
  let titleBox;

  if (Array.isArray(a)) {
    panels = a;
    geom = b;
    titleBox = d;
  } else {
    geom = a;
    const state = b || {};
    panels = c || (state && state.panels) || [];
    titleBox = d || e;
  }

  const { W, H } = canvasSize(ctx);
  if (!Array.isArray(panels) || !panels.length) return;
  if (!geom) return;

  if (!titleBox) {
    const caption = captionOf(b);
    const boxed = caption && caption.title ? titleBoxOf(measuredTitle(ctx, geom, caption)) : null;
    titleBox = boxed;
  }
  const base = titleBox || geom.title;
  if (!base) return;
  const block = { x: base.x - 8, y: base.y - 8, w: base.w + 16, h: base.h + 16 };

  let hero = 0;
  for (let i = 1; i < panels.length; i++) {
    if (panels[i].w * panels[i].h > panels[hero].w * panels[hero].h) hero = i;
  }

  const baseSize = 0.0165 * H;
  const track = 0.12;
  const pad = 12;

  ctx.save();
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    if (!panel || !(panel.w > 0) || !(panel.h > 0)) continue;
    const role = String(panel.role || '').trim().toUpperCase();
    if (!role) continue;

    const r = rolePlateRect(panel);
    if (intersects(r, block)) continue;

    const ph = Math.min(Math.max(24, 0.045 * panel.h), panel.h);
    const slant = Math.min(panel.cut * 0.45, ph * 0.5);
    const px = clamp(r.x, panel.x + 0.01 * W, panel.x + panel.w - 0.05 * panel.w);
    const py = clamp(r.y, panel.y, panel.y + panel.h - ph);
    const avail = panel.x + panel.w - 0.012 * W - px;

    let size = baseSize;
    let tw = 0;
    let pw = 0;
    for (let k = 0; k < 8; k++) {
      ctx.font = size + 'px ' + FONT_CONDENSED;
      tw = lineWidth(ctx, role, size, track);
      pw = clamp(tw + 30, 80, 0.55 * panel.w);
      if (tw + slant + pad <= pw && pw <= avail) break;
      size *= 0.93;
    }
    if (pw > avail || tw + slant + pad > pw) continue;
    ctx.font = size + 'px ' + FONT_CONDENSED;

    if (i === hero) {
      const mid = py + ph / 2;
      if (mid > panel.y + panel.h / 3 && mid < panel.y + (2 * panel.h) / 3) continue;
    }

    polyPath(ctx, [
      [px + slant, py],
      [px + pw, py],
      [px + pw, py + ph],
      [px, py + ph]
    ]);
    ctx.fillStyle = 'rgba(16,5,24,0.86)';
    ctx.fill();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = Math.max(1.5, 2 * (W / 1080));
    ctx.lineJoin = 'miter';
    ctx.stroke();

    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawTracked(ctx, role, px + slant + pad, py + ph / 2 + 1, size, track);
  }
  ctx.restore();
}

export function titleBoxOf(measured) {
  if (!measured) return { x: 0, y: 0, w: 0, h: 0 };
  const capH = measured.capH || 0;
  const H = measured.canvasH || 1080;
  const ribbonH = 0.03 * H;
  const top = measured.box.y - 0.04 * capH;
  const placement = scriptPlacement(measured, measured.band && measured.band.w);
  const scriptBottom = placement.baseline + 0.35 * placement.size;
  const ribbonBottom = measured.blockBottom + placement.size + 0.12 * placement.size + ribbonH;
  const bottom = Math.max(scriptBottom, ribbonBottom);
  return { x: measured.box.x, y: top, w: measured.box.w, h: bottom - top };
}
