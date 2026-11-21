import { rngFor } from './util.js';

const RAMP = [
  [0.0, '#150a2c'],
  [0.32, '#3d1050'],
  [0.62, '#8c1b5e'],
  [0.86, '#43104a'],
  [1.0, '#240a36']
];

const PALM = 'rgba(20,6,32,0.22)';
const CREAM = (a) => 'rgba(255,243,220,' + a.toFixed(3) + ')';

function drawRamp(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  RAMP.forEach(([stop, color]) => g.addColorStop(stop, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSun(ctx, w, h) {
  const cx = 0.60 * w;
  const cy = 0.16 * h;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.46 * w);
  glow.addColorStop(0, 'rgba(255,186,120,0.42)');
  glow.addColorStop(1, 'rgba(255,186,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.10 * w);
  core.addColorStop(0, 'rgba(255,240,196,0.55)');
  core.addColorStop(1, 'rgba(255,240,196,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawSkyline(ctx, w, h, rng) {
  ctx.save();
  ctx.fillStyle = 'rgba(24,8,40,0.55)';
  for (let layer = 0; layer < 3; layer++) {
    const base = (0.92 - (2 - layer) * 0.004) * h;
    let x = -rng.range(0, 0.02) * w;
    while (x < w) {
      const bw = rng.range(0.01, 0.03) * w;
      const bh = rng.range(0.02, 0.06) * h;
      ctx.fillRect(x, base - bh, bw, bh + 0.002 * h);
      if (rng.next() < 0.18) {
        const ax = x + bw * rng.range(0.2, 0.8);
        const ah = rng.range(0.008, 0.02) * h;
        ctx.fillRect(ax, base - bh - ah, 1, ah);
      }
      x += bw + rng.range(0.002, 0.006) * w;
    }
  }
  ctx.restore();
}

function drawStars(ctx, w, h, rng) {
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, 0.45 * h);
    if (y > 0.45 * h) continue;
    const r = rng.range(0.6, 1.6);
    ctx.fillStyle = CREAM(rng.range(0.15, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawClouds(ctx, w, h, rng) {
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cw = rng.range(0.18, 0.42) * w;
    const ch = rng.range(1.5, 3);
    const x = rng.range(-0.05 * w, w - cw * 0.55);
    const y = rng.range(0.07, 0.33) * h;
    const a = rng.range(0.05, 0.10);
    const g = ctx.createLinearGradient(x, y, x + cw, y);
    g.addColorStop(0, CREAM(0));
    g.addColorStop(0.5, CREAM(a));
    g.addColorStop(1, CREAM(0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cw, ch);
  }
  ctx.restore();
}

function drawPalm(ctx, x, baseY, height, dir, rng) {
  const lean = dir * height * 0.2;
  const topX = x + lean;
  const topY = baseY - height;

  ctx.save();
  ctx.fillStyle = PALM;
  ctx.strokeStyle = PALM;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, height * 0.035);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 1.35, baseY - height * 0.5, topX, topY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(topX, topY, height * 0.022, 0, Math.PI * 2);
  ctx.fill();

  for (let j = 0; j < 7; j++) {
    const t = (j + 0.5) / 7;
    const angle = -Math.PI + t * Math.PI * 0.92 + dir * 0.16;
    const len = height * rng.range(0.34, 0.5);
    const tipX = topX + Math.cos(angle) * len;
    const tipY = topY + Math.sin(angle) * len + len * 0.22;
    const midX = topX + Math.cos(angle) * len * 0.55;
    const midY = topY + Math.sin(angle) * len * 0.55 - len * 0.12;
    const fw = height * rng.range(0.018, 0.032);
    const px = -Math.sin(angle) * fw;
    const py = Math.cos(angle) * fw;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.bezierCurveTo(midX + px, midY + py, tipX + px * 0.35, tipY + py * 0.35, tipX, tipY);
    ctx.bezierCurveTo(tipX - px * 0.35, tipY - py * 0.35, midX - px, midY - py, topX, topY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawBackdrop(ctx, w, h, palette) {
  if (!ctx || !(w > 0) || !(h > 0)) return;
  const rng = rngFor(1986);
  ctx.save();
  drawRamp(ctx, w, h);
  drawSun(ctx, w, h);
  drawSkyline(ctx, w, h, rng);
  drawStars(ctx, w, h, rng);
  drawClouds(ctx, w, h, rng);
  drawPalm(ctx, 0.02 * w, 1.0 * h, 0.55 * h, 1, rng);
  drawPalm(ctx, 0.98 * w, 1.0 * h, 0.55 * h, -1, rng);
  ctx.restore();
}
