import { panelsFor } from './state.js';
import { rgba } from './grade.js';

export const FONT_TITLE = "'Anton', 'Archivo Black', system-ui, sans-serif";
export const FONT_SCRIPT = "'Pacifico', 'Brush Script MT', cursive";
export const FONT_HEAVY = "'Archivo Black', 'Anton', system-ui, sans-serif";
export const FONT_CONDENSED = "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif";

const FONT_MAP = {
  title: FONT_TITLE,
  script: FONT_SCRIPT,
  heavy: FONT_HEAVY,
  condensed: FONT_CONDENSED
};

export const TITLE_GRADIENT = [
  [0, '#fff7e2'],
  [0.32, '#ffd27a'],
  [0.55, '#ff9a4d'],
  [0.8, '#ff2e88'],
  [1, '#a1118a']
];

const CAP_RATIO = { title: 0.73, heavy: 0.72, condensed: 0.71, script: 0.68 };

export function fontFor(family = 'title') {
  return FONT_MAP[family] || FONT_TITLE;
}

export function capRatioOf(family = 'title') {
  return CAP_RATIO[family] || CAP_RATIO.title;
}

const scratchPool = [];

export function scratchFor(width, height) {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  let canvas = scratchPool.find((c) => c.width === w && c.height === h && !c.__busy);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    scratchPool.push(canvas);
    if (scratchPool.length > 6) {
      const idx = scratchPool.findIndex((c) => !c.__busy);
      if (idx >= 0) scratchPool.splice(idx, 1);
    }
  }
  canvas.__busy = true;
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.shadowBlur = 0;
  g.shadowColor = 'transparent';
  g.clearRect(0, 0, w, h);
  return canvas;
}

function releaseScratch(canvas) {
  if (canvas) canvas.__busy = false;
}

export function trackedWidth(ctx, text, size, trackingEm = 0, family = 'title') {
  const s = String(text == null ? '' : text);
  if (!s) return 0;
  ctx.save();
  ctx.font = `${size}px ${fontFor(family)}`;
  const chars = Array.from(s);
  let total = 0;
  for (let i = 0; i < chars.length; i += 1) total += ctx.measureText(chars[i]).width;
  ctx.restore();
  return total + trackingEm * size * Math.max(0, chars.length - 1);
}

export function drawTracked(ctx, text, x, y, size, trackingEm = 0, family = 'title', mode = 'fill') {
  const s = String(text == null ? '' : text);
  if (!s) return;
  ctx.save();
  ctx.font = `${size}px ${fontFor(family)}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const chars = Array.from(s);
  const track = trackingEm * size;
  let cursor = x;
  for (let i = 0; i < chars.length; i += 1) {
    if (mode === 'fill' || mode === 'both') ctx.fillText(chars[i], cursor, y);
    if (mode === 'stroke' || mode === 'both') ctx.strokeText(chars[i], cursor, y);
    cursor += ctx.measureText(chars[i]).width + track;
  }
  ctx.restore();
}

export function drawTrackedAligned(ctx, text, x, y, size, trackingEm = 0, family = 'title', align = 'left') {
  const width = trackedWidth(ctx, text, size, trackingEm, family);
  let left = x;
  if (align === 'center') left = x - width / 2;
  else if (align === 'right') left = x - width;
  drawTracked(ctx, text, left, y, size, trackingEm, family, 'fill');
  return width;
}

export function fitSize(ctx, text, maxWidth, baseSize, trackingEm = 0, family = 'title', minSize = 4) {
  let size = Math.max(minSize, baseSize);
  if (maxWidth <= 0) return minSize;
  let guard = 0;
  while (size > minSize && trackedWidth(ctx, text, size, trackingEm, family) > maxWidth && guard < 240) {
    size = Math.max(minSize, size * 0.965 - 0.15);
    guard += 1;
  }
  return size;
}

export function ellipsize(ctx, text, maxWidth, size, trackingEm = 0, family = 'title') {
  let s = String(text == null ? '' : text);
  if (trackedWidth(ctx, s, size, trackingEm, family) <= maxWidth) return s;
  const ell = '\u2026';
  while (s.length > 1) {
    s = s.slice(0, -1);
    const candidate = `${s.replace(/\s+$/, '')}${ell}`;
    if (trackedWidth(ctx, candidate, size, trackingEm, family) <= maxWidth) return candidate;
  }
  return ell;
}

export function starPath(ctx, cx, cy, outer, inner = outer * 0.42, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawStar(ctx, cx, cy, outer, color, alpha = 1, outline = null) {
  ctx.save();
  ctx.globalAlpha = alpha;
  starPath(ctx, cx, cy, outer, outer * 0.44);
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 1;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDiamond(ctx, cx, cy, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function quadPoint(p0, c, p1, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
  };
}

export function splitBalanced(words, lineCount = 2) {
  const list = (words || []).filter(Boolean);
  if (list.length <= 1 || lineCount < 2) return [list.join(' ')];
  if (lineCount === 2) {
    let best = 1;
    let bestCost = Infinity;
    for (let i = 1; i < list.length; i += 1) {
      const a = list.slice(0, i).join(' ');
      const b = list.slice(i).join(' ');
      const cost = Math.max(a.length, b.length) + Math.abs(a.length - b.length) * 0.6;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    return [list.slice(0, best).join(' '), list.slice(best).join(' ')];
  }
  const result = [];
  const per = Math.ceil(list.length / lineCount);
  for (let i = 0; i < list.length; i += per) result.push(list.slice(i, i + per).join(' '));
  while (result.length < lineCount) result.push('');
  return result.slice(0, lineCount);
}

export function bottomRowTop(geometry, state) {
  const field = geometry.field;
  if (!field) return geometry.inner ? geometry.inner.y : 0;
  const H = geometry.height;
  const panels = panelsFor(state.layoutId || 'poster', state.width, state.height);
  if (!panels.length) return field.y;
  let maxY = -Infinity;
  for (let i = 0; i < panels.length; i += 1) maxY = Math.max(maxY, panels[i].y);
  const tolerance = Math.max(1, H * 0.002);
  if (maxY <= field.y + tolerance) return field.y;
  let top = Infinity;
  for (let i = 0; i < panels.length; i += 1) {
    if (panels[i].y >= maxY - tolerance) top = Math.min(top, panels[i].y);
  }
  return Number.isFinite(top) ? top : field.y;
}

function titleLineWidth(ctx, text, size) {
  return trackedWidth(ctx, text, size, -0.005, 'title');
}

export function layoutTitleBlock(ctx, state, geometry) {
  const H = geometry.height;
  const W = geometry.width;
  const inner = geometry.inner;
  const field = geometry.field;
  const caption = state.caption || {};
  const raw = String(caption.title == null ? '' : caption.title).toUpperCase().replace(/\s+/g, ' ').trim();
  const words = raw ? raw.split(' ') : [];
  const portrait = W <= H;
  const capLimit = (portrait ? 0.22 : 0.18) * H;
  const targetW = (portrait ? 0.88 : 0.8) * inner.w;
  const capRatio = capRatioOf('title');
  const maxSize = capLimit / capRatio;

  const sizeFor = (lines) => {
    let widestEm = 1;
    for (let i = 0; i < lines.length; i += 1) widestEm = Math.max(widestEm, titleLineWidth(ctx, lines[i], 100) / 100);
    return Math.max(4, Math.min(maxSize, targetW / Math.max(0.01, widestEm)));
  };

  let lines;
  let size;
  if (!words.length) {
    lines = [''];
    size = Math.min(maxSize, 0.22 * H);
  } else if (portrait) {
    lines = words.length > 1 ? splitBalanced(words, 2) : [raw];
    size = sizeFor(lines);
  } else {
    lines = [raw];
    size = sizeFor(lines);
    if (words.length > 1 && size < maxSize * 0.72) {
      lines = splitBalanced(words, 2);
      size = sizeFor(lines);
    }
  }
  size = Math.max(4, Math.floor(size * 2) / 2);

  const capH = size * capRatio;
  const lineHeight = capH * 1.04;
  const centerX = field.x + field.w / 2;
  const foot = field.y + field.h - 0.09 * H;
  const span = (lines.length - 1) * lineHeight + capH;
  const rowTop = bottomRowTop(geometry, state);
  const minPaintedTop = rowTop + 0.055 * H + 0.018 * H;
  let blockTop = foot - span;
  if (blockTop < minPaintedTop) blockTop = minPaintedTop;
  if (blockTop < field.y) blockTop = field.y;

  const baselines = [];
  for (let i = 0; i < lines.length; i += 1) baselines.push(blockTop + capH + i * lineHeight);
  const titleBottom = baselines[baselines.length - 1];
  let width = 0;
  for (let i = 0; i < lines.length; i += 1) width = Math.max(width, titleLineWidth(ctx, lines[i], size));

  const box = {
    x: centerX - width / 2 - 0.015 * H,
    y: blockTop - 0.018 * H,
    w: width + 0.03 * H,
    h: titleBottom - blockTop + capH * 0.26 + 0.018 * H
  };

  return {
    lines,
    size,
    capH,
    lineHeight,
    baselines,
    centerX,
    titleBottom,
    blockTop,
    width,
    box
  };
}

export function drawDarkeningRail(ctx, geometry, palette, H = null) {
  const field = geometry.field;
  const height = H || geometry.height;
  if (!field) return;
  const top = field.y + field.h - 0.3 * height;
  const grad = ctx.createLinearGradient(0, top, 0, field.y + field.h);
  grad.addColorStop(0, rgba(palette.shadow, 0));
  grad.addColorStop(0.45, rgba(palette.shadow, 0.45));
  grad.addColorStop(0.8, rgba(palette.shadow, 0.82));
  grad.addColorStop(1, rgba(palette.shadow, 0.94));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grad;
  ctx.fillRect(field.x, top, field.w, 0.3 * height);
  ctx.restore();
}

function drawGlyphMask(ctx, canvas, text, size, pad, topPad, capH, gradient, boxTop, boxHeight, composite = 'source-over') {
  const mask = scratchFor(canvas.width, canvas.height);
  const mg = mask.getContext('2d');
  mg.globalCompositeOperation = 'source-over';
  mg.font = `${size}px ${FONT_TITLE}`;
  mg.textAlign = 'left';
  mg.textBaseline = 'alphabetic';
  mg.fillStyle = '#ffffff';
  const chars = Array.from(text);
  const track = -0.005 * size;
  let cursor = pad;
  for (let i = 0; i < chars.length; i += 1) {
    mg.fillText(chars[i], cursor, topPad + capH);
    cursor += mg.measureText(chars[i]).width + track;
  }

  const g = canvas.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  const grad = g.createLinearGradient(0, topPad, 0, topPad + boxHeight);
  for (let i = 0; i < gradient.length; i += 1) grad.addColorStop(gradient[i][0], gradient[i][1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
  releaseScratch(mask);
  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.drawImage(canvas, boxTop.x, boxTop.y);
  ctx.restore();
}

export function drawTitleGlyphs(ctx, geometry, state, palette, measured = null) {
  const m = measured || layoutTitleBlock(ctx, state, geometry);
  const H = geometry.height;
  const size = m.size;
  if (!size || !m.lines.length) return m;
  const strokeKey = 0.10 * size;
  const strokeRing = 0.055 * size;
  const pad = Math.ceil(strokeKey * 1.4 + 2);
  const topPad = Math.ceil(m.capH * 0.3);
  const canvasH = Math.ceil(m.capH * 1.72);
  const tracking = -0.005;

  for (let li = 0; li < m.lines.length; li += 1) {
    const text = m.lines[li];
    if (!text) continue;
    const lineW = titleLineWidth(ctx, text, size);
    const x = m.centerX - lineW / 2;
    const baseline = m.baselines[li];

    ctx.save();
    ctx.fillStyle = '#1a0a2a';
    for (let i = 1; i <= 5; i += 1) {
      drawTracked(ctx, text, x + 0.012 * size * i, baseline + 0.012 * size * i, size, tracking, 'title', 'fill');
    }
    ctx.restore();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff3e0';
    ctx.lineWidth = strokeKey;
    drawTracked(ctx, text, x, baseline, size, tracking, 'title', 'stroke');
    ctx.restore();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0c0316';
    ctx.lineWidth = strokeRing;
    drawTracked(ctx, text, x, baseline, size, tracking, 'title', 'stroke');
    ctx.restore();

    const gw = Math.ceil(lineW + pad * 2);
    const boxTop = { x: x - pad, y: baseline - m.capH - topPad };
    const gradCanvas = scratchFor(gw, canvasH);
    drawGlyphMask(ctx, gradCanvas, text, size, pad, topPad, m.capH, TITLE_GRADIENT, boxTop, m.capH);
    releaseScratch(gradCanvas);

    const specCanvas = scratchFor(gw, canvasH);
    drawGlyphMask(
      ctx,
      specCanvas,
      text,
      size,
      pad,
      topPad,
      m.capH,
      [
        [0, 'rgba(255,255,255,0.34)'],
        [1, 'rgba(255,255,255,0)']
      ],
      boxTop,
      m.capH * 0.32
    );
    releaseScratch(specCanvas);

    ctx.save();
    ctx.beginPath();
    ctx.rect(boxTop.x, boxTop.y, gw, m.capH * 0.36);
    ctx.clip();
    ctx.strokeStyle = rgba('#fff3e0', 0.55);
    ctx.lineWidth = Math.max(0.5, 0.004 * size);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawTracked(ctx, text, x, baseline, size, tracking, 'title', 'stroke');
    ctx.restore();
  }
  return m;
}

export function titlePaintedBox(ctx, geometry, state, measured = null) {
  const m = measured || layoutTitleBlock(ctx, state, geometry);
  const keyline = 0.10 * m.size;
  const script = scriptLayout(ctx, geometry, state, m);
  let left = m.box.x;
  let right = m.box.x + m.box.w;
  let top = m.blockTop - keyline;
  let bottom = m.titleBottom + keyline;
  if (script.text && script.width > 0) {
    const skew = Math.sin(Math.abs(script.angle)) * script.width * 1.015;
    left = Math.min(left, script.rightEnd - script.width * 1.06);
    right = Math.max(right, script.rightEnd + script.width * 0.06);
    top = Math.min(top, script.baseline - 0.95 * script.size - skew);
    bottom = Math.max(bottom, script.baseline + 0.35 * script.size);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function scriptLayout(ctx, geometry, state, measured = null) {
  const H = geometry.height;
  const inner = geometry.inner;
  const field = geometry.field;
  const m = measured || layoutTitleBlock(ctx, state, geometry);
  const caption = state.caption || {};
  const raw = String(caption.subtitle == null ? '' : caption.subtitle).trim();
  const last = m.lines[m.lines.length - 1] || '';
  const lastW = titleLineWidth(ctx, last, m.size);
  const size = 0.085 * H;
  ctx.save();
  ctx.font = `${size}px ${FONT_SCRIPT}`;
  const width = raw ? ctx.measureText(raw).width : 0;
  ctx.restore();
  const lastRight = m.centerX + lastW / 2;
  let baseline = m.titleBottom + 0.05 * m.capH + 0.62 * size;
  const maxBaseline = field.y + field.h - 0.055 * H;
  if (baseline > maxBaseline) baseline = maxBaseline;
  let rightEnd = lastRight + 0.015 * inner.w;
  const maxRight = field.x + field.w - 0.01 * geometry.width;
  if (rightEnd > maxRight) rightEnd = maxRight;
  return {
    text: raw,
    size,
    width,
    baseline,
    rightEnd,
    angle: (-3.5 * Math.PI) / 180
  };
}

export function drawScriptLine(ctx, geometry, state, palette, measured = null) {
  const layout = scriptLayout(ctx, geometry, state, measured);
  if (!layout.text) return;
  const H = geometry.height;
  const magenta = palette.magenta || '#ff2e88';
  ctx.save();
  ctx.translate(layout.rightEnd, layout.baseline);
  ctx.rotate(layout.angle);
  ctx.font = `${layout.size}px ${FONT_SCRIPT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  ctx.save();
  ctx.shadowColor = 'rgba(10,3,20,0.95)';
  ctx.shadowBlur = 0.024 * H;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0.008 * H;
  ctx.fillStyle = '#2a0718';
  ctx.fillText(layout.text, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = rgba(magenta, 0.85);
  ctx.shadowBlur = 0.016 * H;
  ctx.fillStyle = '#ffe6f2';
  ctx.fillText(layout.text, 0, 0);
  ctx.restore();

  const swashY = 0.012 * H;
  const p0 = { x: -layout.width * 1.015, y: swashY };
  const cp = { x: -layout.width * 0.48, y: swashY + 0.008 * H };
  const p1 = { x: layout.width * 0.045, y: swashY - 0.002 * H };
  ctx.save();
  ctx.strokeStyle = rgba(magenta, 0.92);
  ctx.lineCap = 'round';
  let prev = quadPoint(p0, cp, p1, 0);
  for (let i = 1; i <= 26; i += 1) {
    const t = i / 26;
    const pt = quadPoint(p0, cp, p1, t);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.lineWidth = Math.max(0.6, 3 * (1 - t * 0.86));
    ctx.stroke();
    prev = pt;
  }
  ctx.restore();
  ctx.restore();
}

export function drawTitleBlock(ctx, geometry, state, palette) {
  const measured = layoutTitleBlock(ctx, state, geometry);
  drawDarkeningRail(ctx, geometry, palette, geometry.height);
  drawTitleGlyphs(ctx, geometry, state, palette, measured);
  drawScriptLine(ctx, geometry, state, palette, measured);
  return measured;
}

function rectIntersects(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function drawRoleChip(ctx, panel, role, state, palette, titleBox = null) {
  const text = String(role == null ? '' : role).toUpperCase().trim();
  if (!text || !panel) return null;
  const H = state.height;
  const W = state.width;
  const size = 0.021 * H;
  const tracking = 0.1;
  const insetX = panel.x + 0.01 * W;
  const maxChipW = Math.max(24, panel.w - 0.02 * W);
  let chipSize = size;
  let textW = trackedWidth(ctx, text, chipSize, tracking, 'condensed');
  let padX = chipSize * 0.72;
  const padY = chipSize * 0.42;
  const bar = 3;
  if (bar + padX * 2 + textW > maxChipW) {
    const avail = maxChipW - bar;
    chipSize = fitSize(ctx, text, avail, chipSize, tracking, 'condensed', 6);
    padX = chipSize * 0.72;
    textW = trackedWidth(ctx, text, chipSize, tracking, 'condensed');
  }
  const chipW = Math.min(maxChipW, bar + padX * 2 + textW);
  const chipH = chipSize + padY * 2;

  const bottomRect = {
    x: insetX,
    y: panel.y + panel.h - 0.014 * H - chipH,
    w: chipW,
    h: chipH
  };
  const bottomClear = !(titleBox && rectIntersects(bottomRect, titleBox));

  let chip = null;
  if (bottomClear) {
    chip = bottomRect;
  } else {
    const topRect = {
      x: insetX,
      y: panel.y + 0.014 * H,
      w: chipW,
      h: chipH
    };
    const topClear = !(titleBox && rectIntersects(topRect, titleBox));
    if (topClear) chip = topRect;
  }
  if (!chip) return null;

  ctx.save();
  ctx.fillStyle = rgba(palette.ink, 0.92);
  ctx.beginPath();
  const r = 3;
  ctx.moveTo(chip.x + r, chip.y);
  ctx.lineTo(chip.x + chip.w - r, chip.y);
  ctx.quadraticCurveTo(chip.x + chip.w, chip.y, chip.x + chip.w, chip.y + r);
  ctx.lineTo(chip.x + chip.w, chip.y + chip.h - r);
  ctx.quadraticCurveTo(chip.x + chip.w, chip.y + chip.h, chip.x + chip.w - r, chip.y + chip.h);
  ctx.lineTo(chip.x + r, chip.y + chip.h);
  ctx.quadraticCurveTo(chip.x, chip.y + chip.h, chip.x, chip.y + chip.h - r);
  ctx.lineTo(chip.x, chip.y + r);
  ctx.quadraticCurveTo(chip.x, chip.y, chip.x + r, chip.y);
  ctx.closePath();
  ctx.fill();

  const accent = palette.accent || palette.orange;
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fillRect(chip.x, chip.y, bar, chip.h);

  ctx.fillStyle = palette.cream;
  ctx.textBaseline = 'alphabetic';
  drawTracked(ctx, text, chip.x + bar + padX, chip.y + chip.h / 2 + chipSize * 0.36, chipSize, tracking, 'condensed', 'fill');
  ctx.restore();
  return chip;
}

export function drawTopStrip(ctx, geometry, state, palette) {
  const strip = geometry.topStrip;
  if (!strip) return;
  const H = geometry.height;
  const W = geometry.width;
  const caption = state.caption || {};
  const quote = String(caption.quote == null ? '' : caption.quote).toUpperCase().trim();
  const volume = String(caption.volume == null ? '' : caption.volume).toUpperCase().trim();
  const attribution = 'SOLARIS WEEKLY';
  const midY = strip.y + strip.h * 0.6;
  const volSize = 0.024 * H;
  const quoteSize = 0.028 * H;
  const attrSize = 0.022 * H;

  ctx.save();
  ctx.fillStyle = palette.ink;
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);

  const pillPadX = Math.max(8, 0.009 * W);
  const pillH = Math.min(strip.h * 0.6, 0.04 * H);
  const volW = trackedWidth(ctx, volume, volSize, 0.02, 'heavy');
  const pillW = volW + pillPadX * 2;
  const pillRight = strip.x + strip.w - 0.008 * W;
  const pill = { x: pillRight - pillW, y: midY - pillH / 2, w: pillW, h: pillH };

  ctx.save();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const pr = pillH / 2;
  ctx.moveTo(pill.x + pr, pill.y);
  ctx.lineTo(pill.x + pill.w - pr, pill.y);
  ctx.arc(pill.x + pill.w - pr, pill.y + pr, pr, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(pill.x + pr, pill.y + pill.h);
  ctx.arc(pill.x + pr, pill.y + pr, pr, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = palette.gold;
  ctx.textAlign = 'left';
  drawTracked(ctx, volume, pill.x + pillPadX, pill.y + pill.h / 2 + volSize * 0.36, volSize, 0.02, 'heavy', 'fill');
  ctx.restore();

  const starOuter = 0.026 * H * 0.5;
  let sx = strip.x + 0.01 * W + starOuter;
  const starGap = starOuter * 1.35;
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, sx, midY, starOuter, palette.gold, i === 4 ? 0.55 : 1, palette.ink);
    sx += starOuter * 2 + starGap;
  }
  const quoteStart = sx + 0.006 * W;

  let attrW = trackedWidth(ctx, attribution, attrSize, 0.12, 'condensed');
  const dashW = trackedWidth(ctx, '\u2014 ', attrW * 0 + attrSize, 0, 'condensed');
  let qSize = quoteSize;
  const avail = pill.x - 0.018 * W - attrW - dashW - quoteStart;
  if (avail > 4) qSize = fitSize(ctx, quote, avail, quoteSize, 0.01, 'heavy', 0.009 * H);
  const qW = trackedWidth(ctx, quote, qSize, 0.01, 'heavy');
  ctx.fillStyle = palette.cream;
  drawTracked(ctx, quote, quoteStart, midY + qSize * 0.34, qSize, 0.01, 'heavy', 'fill');

  const dashX = quoteStart + qW + 0.01 * W;
  ctx.fillStyle = rgba(palette.cream, 0.7);
  drawTracked(ctx, '\u2014 ', dashX, midY + attrSize * 0.34, attrSize, 0, 'condensed', 'fill');
  ctx.fillStyle = palette.magenta;
  drawTracked(ctx, attribution, dashX + dashW, midY + attrSize * 0.34, attrSize, 0.12, 'condensed', 'fill');

  ctx.fillStyle = rgba(palette.cream, 0.3);
  ctx.fillRect(strip.x, strip.y + strip.h, strip.w, 1);
  ctx.restore();
}

export function drawTagline(ctx, strip, state, palette, H) {
  const caption = state.caption || {};
  const text = String(caption.tagline == null ? '' : caption.tagline).toUpperCase().trim();
  if (!text) return;
  const base = 0.022 * H;
  const tracking = 0.22;
  const maxW = strip.w * 0.82;
  const size = fitSize(ctx, text, maxW, base, tracking, 'condensed', 0.008 * H);
  const w = trackedWidth(ctx, text, size, tracking, 'condensed');
  const cx = strip.x + strip.w / 2;
  const baseline = strip.y + strip.h * 0.26 + size * 0.36;
  const diamondR = 0.01 * H * 0.55;
  const gap = 0.014 * H;
  drawDiamond(ctx, cx - w / 2 - gap, baseline - size * 0.36, diamondR, palette.gold, 0.95);
  drawDiamond(ctx, cx + w / 2 + gap, baseline - size * 0.36, diamondR, palette.gold, 0.95);
  ctx.save();
  ctx.fillStyle = rgba(palette.cream, 0.9);
  drawTrackedAligned(ctx, text, cx, baseline, size, tracking, 'condensed', 'center');
  ctx.restore();
}

export function drawBarcode(ctx, x, y, w, h, seed, palette) {
  const rand = seed;
  const count = 28 + Math.floor(rand() * 13);
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = palette.cream;
  let cursor = x;
  const span = w;
  for (let i = 0; i < count; i += 1) {
    const unit = 0.55 + rand() * 1.5;
    const barW = (span / count) * unit * 0.9;
    if (cursor + barW > x + w) break;
    ctx.fillRect(cursor, y, Math.max(1, barW), h);
    cursor += barW + (span / count) * (0.35 + rand() * 0.55);
  }
  ctx.restore();
}

export function drawSeal(ctx, cx, cy, r, palette) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-9 * Math.PI) / 180);
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const size = Math.max(5, r * 0.29);
  ctx.fillStyle = palette.gold;
  drawTrackedAligned(ctx, 'ORIGINAL', 0, -r * 0.4, size, 0.05, 'condensed', 'center');
  const starR = r * 0.15;
  for (let i = 0; i < 3; i += 1) {
    drawStar(ctx, (i - 1) * r * 0.34, 0, starR, palette.gold, 0.95);
  }
  drawTrackedAligned(ctx, 'COVER ART', 0, r * 0.52, size, 0.05, 'condensed', 'center');
  ctx.restore();
}

export function drawBottomStrip(ctx, geometry, state, palette) {
  const strip = geometry.bottomStrip;
  if (!strip) return;
  const H = geometry.height;
  const W = geometry.width;
  const caption = state.caption || {};

  ctx.save();
  ctx.fillStyle = palette.ink;
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.fillStyle = rgba(palette.cream, 0.3);
  ctx.fillRect(strip.x, strip.y, strip.w, 1);

  drawTagline(ctx, strip, state, palette, H);
  const ruleY = strip.y + strip.h * 0.42;
  ctx.fillStyle = rgba(palette.cream, 0.18);
  ctx.fillRect(strip.x + 0.01 * W, ruleY, strip.w - 0.02 * W, 1);

  const row2 = strip.y + strip.h * 0.42;
  const row2H = strip.y + strip.h - 0.008 * H - row2;
  const rowMid = row2 + row2H * 0.5;
  const barH = Math.max(6, row2H * 0.52);
  const barW = Math.min(0.17 * strip.w, 0.16 * W);
  const barX = strip.x + 0.012 * W;
  const barY = row2 + row2H * 0.16;
  const credit = String(caption.credit == null ? '' : caption.credit).toUpperCase().trim();
  const seed = hashSeed(`${credit}|${caption.volume || ''}|${caption.title || ''}`);
  drawBarcode(ctx, barX, barY, barW, barH, seededRandom(seed), palette);

  const digitSize = 0.016 * H;
  const rand = seededRandom(seed + 31);
  let digits = '';
  for (let i = 0; i < 9; i += 1) digits += String(Math.floor(rand() * 10));
  ctx.save();
  ctx.fillStyle = rgba(palette.cream, 0.55);
  drawTracked(ctx, digits, barX, barY + barH + digitSize * 1.35, digitSize, 0.18, 'condensed', 'fill');
  ctx.restore();

  const sealR = Math.min(0.03 * H, row2H * 0.52);
  const sealCx = strip.x + strip.w - 0.014 * W - sealR;
  drawSeal(ctx, sealCx, rowMid, sealR, palette);

  const creditSize = 0.0135 * H;
  const creditTracking = 0.02;
  const leftBound = barX + barW + 0.022 * W;
  const rightBound = sealCx - sealR - 0.022 * W;
  const availW = Math.max(10, rightBound - leftBound);
  const fit = fitSize(ctx, credit, availW, creditSize, creditTracking, 'condensed', 0.007 * H);
  const creditCx = (leftBound + rightBound) / 2;
  ctx.save();
  ctx.fillStyle = rgba(palette.cream, 0.5);
  drawTrackedAligned(ctx, credit, creditCx, rowMid + fit * 0.35, fit, creditTracking, 'condensed', 'center');
  ctx.restore();
  ctx.restore();
}

function hashSeed(text) {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
