export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (list) => list[Math.floor(next() * list.length)]
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function hexToRgba(hex, alpha = 1) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + Number(clamp(alpha, 0, 1).toFixed(3)) + ')';
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
  return ctx;
}

export function polyPath(ctx, points) {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  return ctx;
}

export function canvas2d(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return { canvas, ctx: canvas.getContext('2d') };
}

export function tintMask(mask, color, w, h) {
  const width = Math.max(1, Math.round(w || mask.width || 1));
  const height = Math.max(1, Math.round(h || mask.height || 1));
  const { canvas, ctx } = canvas2d(width, height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

export function maskPaint(mask, paint, w, h) {
  const width = Math.max(1, Math.round(w || mask.width || 1));
  const height = Math.max(1, Math.round(h || mask.height || 1));
  const { canvas, ctx } = canvas2d(width, height);
  if (typeof paint === 'function') paint(ctx, width, height);
  else {
    ctx.fillStyle = paint || '#000';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

export function dilateMask(mask, color, radius, steps = 16) {
  const { canvas, ctx } = canvas2d(mask.width, mask.height);
  const tinted = tintMask(mask, color);
  ctx.drawImage(tinted, 0, 0);
  const count = Math.max(1, Math.round(steps));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.drawImage(tinted, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return canvas;
}
