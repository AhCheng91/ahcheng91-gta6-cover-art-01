// All cover lettering, drawn on the canvas so it exports with the PNG: the tracked Anton title (gradient fill,
// outline, hard shadow, neon underglow), the wide-tracked subtitle, the three badges and a small credit.

const TITLE_FONT = '"Anton", "Archivo Black", system-ui, sans-serif';
const CONDENSED_FONT = '"Barlow Condensed", "Archivo Black", system-ui, sans-serif';
const HEAVY_FONT = '"Archivo Black", "Anton", system-ui, sans-serif';

function font(size, family) {
  return `${Math.max(1, Math.round(size))}px ${family}`;
}

function charAdvances(ctx, chars) {
  return chars.map((char) => ctx.measureText(char).width);
}

/** Width of `text` with per-character tracking in em units (negative tightens). */
export function trackedWidth(ctx, text, trackingEm, size) {
  const chars = [...text];
  if (!chars.length) return 0;
  const advances = charAdvances(ctx, chars);
  const total = advances.reduce((sum, value) => sum + value, 0);
  return total + trackingEm * size * (chars.length - 1);
}

/** Draws `text` character by character from `x`, adding `trackingEm * size` between glyphs. */
function drawTracked(ctx, text, x, y, trackingEm, size, mode) {
  const chars = [...text];
  let cursor = x;
  for (let i = 0; i < chars.length; i += 1) {
    if (mode === 'stroke') ctx.strokeText(chars[i], cursor, y);
    else ctx.fillText(chars[i], cursor, y);
    cursor += ctx.measureText(chars[i]).width + trackingEm * size;
  }
}

/** One line, or two balanced lines, with the largest font size that fits the width and height budgets. */
export function fitTitleSize(ctx, text, options) {
  const { maxWidth, maxHeight, maxSize = 320, minSize = 40 } = options;
  const words = String(text ?? '')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return { size: minSize, lines: [], lineHeight: 0, tracking: -0.02 };
  const tracking = -0.022;
  const lineFactor = 0.92;

  const singleAt = (size) => {
    ctx.font = font(size, TITLE_FONT);
    const line = words.join(' ');
    const width = trackedWidth(ctx, line, tracking, size);
    if (width > maxWidth && words.length > 1) return null;
    return { size, lines: [line], tracking, lineHeight: size * lineFactor, width };
  };

  const twoAt = (size) => {
    if (words.length < 2) return null;
    ctx.font = font(size, TITLE_FONT);
    let best = null;
    for (let split = 1; split < words.length; split += 1) {
      const first = words.slice(0, split).join(' ');
      const second = words.slice(split).join(' ');
      const w1 = trackedWidth(ctx, first, tracking, size);
      const w2 = trackedWidth(ctx, second, tracking, size);
      const width = Math.max(w1, w2);
      if (width > maxWidth) continue;
      const balance = Math.abs(w1 - w2) + (Math.min(w1, w2) / width) * size * 0.18;
      if (!best || balance < best.balance) best = { balance, lines: [first, second], width };
    }
    if (!best) return null;
    return { size, lines: best.lines, tracking, lineHeight: size * lineFactor, width: best.width };
  };

  const fits = (candidate) => Boolean(candidate) && candidate.lines.length * candidate.lineHeight <= maxHeight;

  const largest = (make) => {
    let low = minSize;
    let high = Math.max(minSize, maxSize);
    let best = null;
    for (let step = 0; step < 20; step += 1) {
      const mid = (low + high) / 2;
      const candidate = make(mid);
      if (fits(candidate)) {
        best = candidate;
        low = mid;
      } else {
        high = mid;
      }
    }
    return best;
  };

  const single = largest(singleAt);
  const two = largest(twoAt);
  const longSingle = Boolean(single) && single.width >= maxWidth * 0.62;
  let best;
  if (two && words.length >= 3 && (!single || longSingle || two.size >= single.size * 0.82)) best = two;
  else best = single || two;

  if (!best) {
    ctx.font = font(minSize, TITLE_FONT);
    const joined = words.join(' ');
    const width = trackedWidth(ctx, joined, tracking, minSize);
    const size = width > maxWidth ? Math.max(8, (minSize * maxWidth) / width) : minSize;
    best = { size, lines: [joined], tracking, lineHeight: size * lineFactor, width: Math.min(width, maxWidth) };
  }
  return best;
}

function badgeLabels(badges) {
  return (badges ?? [])
    .map((badge) => String(badge ?? '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Explicit three-row layout for the band: subtitle line, then the title block, then the badge row, each with a clear
 * gap and even margins. Returns the measured rows so the draw calls cannot drift into each other.
 */
export function layoutLettering(ctx, { title, subtitle, badges, box, height }) {
  const labels = badgeLabels(badges);
  const padTop = box.h * 0.05;
  const padBottom = box.h * 0.05;
  const gap = box.h * 0.075;

  const hasSubtitle = Boolean(String(subtitle ?? '').trim());
  const subtitleSize = hasSubtitle ? Math.max(11, Math.min(box.h * 0.052, height * 0.024)) : 0;
  const subtitleBlock = hasSubtitle ? subtitleSize * 1.75 : 0;
  const subtitleGap = hasSubtitle ? gap : 0;

  const badgeHeight = labels.length ? Math.max(16, Math.min(box.h * 0.19, height * 0.036)) : 0;
  const badgeGap = labels.length ? gap : 0;

  const titleTop = box.y + padTop + subtitleBlock + subtitleGap;
  const badgesY = box.y + box.h - padBottom - badgeHeight;
  const titleBottom = badgesY - badgeGap;
  const titleHeight = Math.max(1, titleBottom - titleTop);

  const layout = fitTitleSize(ctx, title, {
    maxWidth: box.w * 0.88,
    maxHeight: titleHeight,
    maxSize: Math.max(30, Math.min(box.w * 0.36, box.h * 1.02, titleHeight)),
    minSize: 30,
  });

  const blockHeight = layout.lines.length * layout.lineHeight;
  const startY = titleTop + Math.max(0, (titleHeight - blockHeight) / 2);

  return {
    box,
    height,
    subtitle: {
      size: subtitleSize,
      top: box.y + padTop,
      bottom: box.y + padTop + subtitleBlock,
      height: subtitleBlock,
    },
    title: { layout, top: titleTop, bottom: titleBottom, height: titleHeight, startY, blockHeight },
    badges: { y: badgesY, h: badgeHeight, labels },
  };
}

/** Draws the title block measured by layoutLettering. */
export function drawTitle(ctx, text, metrics, palette) {
  const { layout, startY } = metrics.title;
  if (!layout.lines.length) return metrics.title;

  const blockHeight = layout.blockHeight ?? layout.lines.length * layout.lineHeight;
  const centerX = metrics.box.x + metrics.box.w / 2;
  const outline = Math.max(2, layout.size * 0.045);
  const gradient = ctx.createLinearGradient(0, startY, 0, startY + blockHeight);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.62, '#fff4e0');
  gradient.addColorStop(1, '#ffe6c7');

  ctx.save();
  ctx.font = font(layout.size, TITLE_FONT);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  layout.lines.forEach((line, index) => {
    const width = trackedWidth(ctx, line, layout.tracking, layout.size);
    const x = Math.round(centerX - width / 2);
    const y = Math.round(startY + layout.lineHeight * (index + 0.78));
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = palette.accent;
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = layout.size * 0.34;
    drawTracked(ctx, line, x, y, layout.tracking, layout.size, 'fill');
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    drawTracked(ctx, line, x + layout.size * 0.035, y + layout.size * 0.045, layout.tracking, layout.size, 'fill');
    ctx.restore();

    ctx.strokeStyle = '#16021f';
    ctx.lineWidth = outline;
    drawTracked(ctx, line, x, y, layout.tracking, layout.size, 'stroke');

    ctx.fillStyle = gradient;
    drawTracked(ctx, line, x, y, layout.tracking, layout.size, 'fill');
  });
  ctx.restore();
  return metrics.title;
}

/** The wide-tracked line above the title. */
export function drawSubtitle(ctx, text, metrics, palette) {
  const clean = String(text ?? '').trim().toUpperCase();
  if (!clean || !metrics.subtitle.size) return;
  const size = metrics.subtitle.size;
  const tracking = 0.34;
  ctx.save();
  ctx.font = font(size, CONDENSED_FONT);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let width = trackedWidth(ctx, clean, tracking, size);
  const maxWidth = metrics.box.w * 0.86;
  let drawSize = size;
  if (width > maxWidth) {
    drawSize = size * (maxWidth / width);
    ctx.font = font(drawSize, CONDENSED_FONT);
    width = trackedWidth(ctx, clean, tracking, drawSize);
  }
  const x = Math.round(metrics.box.x + metrics.box.w / 2 - width / 2);
  const y = Math.round(metrics.subtitle.top + drawSize * 1.05);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = palette.accent;
  drawTracked(ctx, clean, x, y, tracking, drawSize, 'fill');
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(
    Math.round(metrics.box.x + metrics.box.w / 2 - metrics.box.w * 0.07),
    Math.round(metrics.subtitle.top + drawSize * 1.5),
    Math.round(metrics.box.w * 0.14),
    Math.max(1, Math.round(drawSize * 0.06)),
  );
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Three small pill badges, evenly spaced and centred on the measured badge row. */
export function drawBadges(ctx, badges, metrics, palette, height) {
  const labels = metrics.badges.labels;
  if (!labels.length) return;
  const badgeHeight = metrics.badges.h;
  const size = badgeHeight * 0.42;
  const vertical = 0.14;
  const padding = badgeHeight * 0.72;
  const gaps = badgeHeight * 0.55;
  const box = metrics.box;
  ctx.save();
  ctx.font = font(size, CONDENSED_FONT);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const widths = labels.map((label) => trackedWidth(ctx, label, vertical, size) + padding * 2);
  const totalWidth = widths.reduce((sum, value) => sum + value, 0) + gaps * (labels.length - 1);
  const maxWidth = box.w * 0.9;
  const scale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
  const rowWidth = totalWidth * scale;
  let x = box.x + box.w / 2 - rowWidth / 2;
  const y = metrics.badges.y;
  labels.forEach((label, index) => {
    const w = widths[index] * scale;
    ctx.save();
    ctx.globalAlpha = 0.9;
    roundRect(ctx, x, y, w, badgeHeight, badgeHeight * 0.3);
    ctx.fillStyle = 'rgba(21,3,32,0.42)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, height * 0.0012);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    const textWidth = trackedWidth(ctx, label, vertical, size * scale);
    drawTracked(ctx, label, x + (w - textWidth) / 2, y + badgeHeight / 2 + size * scale * 0.02, vertical, size * scale, 'fill');
    ctx.restore();
    x += w + gaps * scale;
  });
  ctx.restore();
}

/** Tiny maker's mark in the bottom-right corner. */
export function drawCredit(ctx, text, box, height) {
  const clean = String(text ?? '').trim().toUpperCase();
  if (!clean) return;
  const size = Math.max(8, height * 0.0125);
  ctx.save();
  ctx.font = font(size, CONDENSED_FONT);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffe9d2';
  const tracking = 0.22;
  const width = trackedWidth(ctx, clean, tracking, size);
  drawTracked(ctx, clean, box.x + box.w - width, box.y + box.h - size * 0.7, tracking, size, 'fill');
  ctx.restore();
}

/** Lettering block inside the title band, or over the lower photo for solo. */
export function letteringBox(layoutId, width, height, band) {
  if (layoutId === 'solo') {
    return { x: width * 0.06, y: height * 0.56, w: width * 0.88, h: height * 0.36 };
  }
  const inset = width * 0.06;
  return { x: inset, y: band.y + band.h * 0.08, w: width - inset * 2, h: band.h * 0.84 };
}

export { font, HEAVY_FONT, TITLE_FONT, CONDENSED_FONT };
