// The Vice sunset backdrop. The panels hide most of it, but the ink gutters, the 2px frame lines
// and the strips must read as one continuous sunset world, so this is drawn full-bleed first and
// every other layer sits on top of it.
//
// Everything here is procedural and seeded: the same palette gives the same poster every time.

import { rgba, seeded } from './grade.js';

const HORIZON = 0.62;

function horizonOf(height) {
  return Math.round(height * HORIZON);
}

/** Sky, sun, skyline, palms, clouds, stars and water — one call, full bleed. */
export function drawBackdrop(ctx, width, height, palette) {
  const horizon = horizonOf(height);

  drawSky(ctx, width, horizon, palette);
  drawStars(ctx, width, horizon);
  drawSun(ctx, width, height, horizon, palette);
  drawClouds(ctx, width, height, horizon);
  drawWater(ctx, width, height, horizon, palette);
  drawSkyline(ctx, width, height, horizon);
  drawReflections(ctx, width, height, horizon);
  drawWaveLines(ctx, width, height, horizon);
  drawPalms(ctx, width, height);
}

/* ------------------------------------------------------------------ sky */

function drawSky(ctx, width, horizon, palette) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(0.34, palette.skyMid);
  sky.addColorStop(0.66, palette.skyHot);
  sky.addColorStop(0.9, palette.orange);
  sky.addColorStop(1, palette.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);

  // A banded haze right above the water so the horizon has a pulse to it.
  const haze = ctx.createLinearGradient(0, horizon * 0.72, 0, horizon);
  haze.addColorStop(0, rgba(palette.magenta, 0));
  haze.addColorStop(0.6, rgba(palette.accent, 0.16));
  haze.addColorStop(1, rgba(palette.skyLow, 0.4));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon * 0.72, width, horizon * 0.28);
}

function drawStars(ctx, width, horizon) {
  const limit = horizon * 0.44;
  const random = seeded(0x57a12);
  ctx.save();
  for (let i = 0; i < 60; i += 1) {
    const x = random() * width;
    const y = random() * limit;
    const r = 0.6 + random() * 1.6;
    ctx.globalAlpha = 0.12 + random() * 0.5;
    ctx.fillStyle = i % 7 === 0 ? '#ffd9a8' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(ctx, width, height, horizon, palette) {
  const cx = width * 0.5;
  const cy = horizon - height * 0.014;
  const radius = Math.min(width, height) * 0.2;

  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.4);
  glow.addColorStop(0, rgba(palette.highlight, 0.5));
  glow.addColorStop(0.4, rgba(palette.orange, 0.26));
  glow.addColorStop(1, rgba(palette.orange, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizon + height * 0.04);

  // The disc is a plain ball softened at the rim, with the light pulled slightly high.
  const disc = ctx.createRadialGradient(cx, cy - radius * 0.28, radius * 0.06, cx, cy, radius);
  disc.addColorStop(0, '#fffbe8');
  disc.addColorStop(0.4, palette.highlight);
  disc.addColorStop(0.84, palette.orange);
  disc.addColorStop(1, rgba(palette.orange, 0));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Retro sci-fi sun bands: three thin horizontal cuts in the lower third of the disc.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i += 1) {
    const t = i / 4;
    const y = cy + radius * (0.18 + t * 0.62);
    const thickness = radius * (0.012 + t * 0.03);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - radius, y, radius * 2, thickness);
  }
  ctx.restore();
}

function drawClouds(ctx, width, height, horizon) {
  const streaks = [
    { y: 0.16, w: 0.66, x: 0.06, a: 0.08, h: 0.009 },
    { y: 0.24, w: 0.58, x: 0.3, a: 0.11, h: 0.007 },
    { y: 0.33, w: 0.74, x: -0.04, a: 0.14, h: 0.013 },
    { y: 0.42, w: 0.6, x: 0.46, a: 0.16, h: 0.009 },
    { y: 0.5, w: 0.86, x: 0.08, a: 0.19, h: 0.015 },
    { y: 0.57, w: 0.5, x: 0.58, a: 0.22, h: 0.011 },
  ];
  ctx.save();
  for (const streak of streaks) {
    const x = streak.x * width;
    const w = streak.w * width;
    const y = streak.y * horizon;
    const h = Math.max(2, streak.h * height);
    const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
    gradient.addColorStop(0, 'rgba(255,214,205,0)');
    gradient.addColorStop(0.3, `rgba(255,222,210,${streak.a})`);
    gradient.addColorStop(0.64, `rgba(255,170,190,${streak.a * 0.8})`);
    gradient.addColorStop(1, 'rgba(255,214,205,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ water */

function drawWater(ctx, width, height, horizon, palette) {
  // Shadow, not mid, at the waterline: a mid stop here leaves a magenta band across every gutter
  // and the poster's foot, which reads as pink haze over the print.
  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, palette.shadow);
  water.addColorStop(0.32, palette.shadow);
  water.addColorStop(1, palette.ink);
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);
}

function drawSkyline(ctx, width, height, horizon) {
  const random = seeded(0x5c17);
  ctx.save();
  let x = -width * 0.02;
  const span = width * 1.04;
  const count = 22;
  while (x < span) {
    const w = (span / count) * (0.5 + random() * 1.15);
    const h = height * (0.012 + random() * 0.05);
    ctx.fillStyle = 'rgba(24,6,42,0.86)';
    ctx.fillRect(x, horizon - h, Math.max(2, w), h + height * 0.01);
    if (random() > 0.7) {
      const ax = x + w * (0.3 + random() * 0.4);
      const ah = h * (0.1 + random() * 0.26);
      ctx.fillRect(ax, horizon - h - ah, Math.max(1, width * 0.0014), ah);
      if (random() > 0.45) {
        ctx.beginPath();
        ctx.arc(ax, horizon - h - ah, Math.max(1.4, width * 0.0016), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    x += w + span * 0.003 + random() * span * 0.012;
  }
  ctx.restore();
}

function drawReflections(ctx, width, height, horizon) {
  const cx = width * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const beam = ctx.createLinearGradient(cx, horizon, cx, height);
  beam.addColorStop(0, 'rgba(255,196,120,0.44)');
  beam.addColorStop(0.5, 'rgba(255,138,61,0.13)');
  beam.addColorStop(1, 'rgba(255,138,61,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  const top = width * 0.03;
  const bottom = width * 0.15;
  ctx.moveTo(cx - top, horizon);
  ctx.lineTo(cx + top, horizon);
  ctx.lineTo(cx + bottom, height);
  ctx.lineTo(cx - bottom, height);
  ctx.closePath();
  ctx.fill();

  const random = seeded(0x7ea);
  for (let i = 0; i < 90; i += 1) {
    const t = random();
    const y = horizon + (height - horizon) * t;
    const spread = (top + (bottom - top) * t) * (0.35 + random() * 0.95);
    const w = Math.max(2, width * 0.004 * (0.4 + random() * 2.4));
    const x = cx + (random() * 2 - 1) * spread;
    ctx.globalAlpha = (1 - t) * 0.5 * (0.3 + random() * 0.7);
    ctx.fillStyle = random() > 0.34 ? '#ffcf8a' : '#ff6f8f';
    ctx.fillRect(x, y, w, Math.max(1, height * 0.0024 * (0.5 + random())));
  }
  ctx.restore();
}

function drawWaveLines(ctx, width, height, horizon) {
  ctx.save();
  ctx.globalAlpha = 0.46;
  for (let i = 0; i < 22; i += 1) {
    const y = horizon + (height - horizon) * ((i + 1) / 24);
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,164,120,0.14)' : 'rgba(120,40,120,0.16)';
    const inset = width * 0.018 * (i % 3);
    ctx.fillRect(inset, y, width - inset * 2, Math.max(1, height * 0.0012));
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ palms */

/**
 * The palm pair sits in the outer margins; the panels cover most of them, but the fronds peek
 * through the gutters and the top strip, which is what sells the world.
 */
function drawPalms(ctx, width, height) {
  const size = Math.min(width, height);
  drawPalm(ctx, width * 0.038, height * 1.02, size * 0.56, 1);
  drawPalm(ctx, width * 0.962, height * 1.0, size * 0.5, -1);
}

function drawPalm(ctx, x, baseY, size, dir) {
  const lean = 0.12 * size * dir;
  const trunkTopX = x + lean * 2.6;
  const trunkTopY = baseY - size;
  ctx.save();
  ctx.strokeStyle = 'rgba(12,4,22,0.92)';
  ctx.fillStyle = 'rgba(12,4,22,0.92)';
  ctx.lineCap = 'round';

  ctx.lineWidth = size * 0.026;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.bezierCurveTo(x + lean * 0.4, baseY - size * 0.4, x + lean * 1.7, baseY - size * 0.76, trunkTopX, trunkTopY);
  ctx.stroke();

  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const spread = (i - (fronds - 1) / 2) / ((fronds - 1) / 2);
    const angle = -Math.PI / 2 + spread * 1.55;
    const length = size * (0.36 + 0.12 * (1 - Math.abs(spread)));
    const endX = trunkTopX + Math.cos(angle) * length * dir;
    const endY = trunkTopY + Math.sin(angle) * length * 0.6;
    const ctrlX = trunkTopX + Math.cos(angle) * length * 0.55 * dir;
    const ctrlY = trunkTopY + Math.sin(angle) * length * 0.15 - length * 0.18;
    ctx.lineWidth = size * (0.014 + 0.006 * (1 - Math.abs(spread)));
    ctx.beginPath();
    ctx.moveTo(trunkTopX, trunkTopY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();

    // Leaflets: short strokes down each frond so it reads as a palm, not a spider leg.
    ctx.lineWidth = size * 0.0045;
    for (let leaf = 1; leaf <= 4; leaf += 1) {
      const t = leaf / 5;
      const bx = (1 - t) * (1 - t) * trunkTopX + 2 * (1 - t) * t * ctrlX + t * t * endX;
      const by = (1 - t) * (1 - t) * trunkTopY + 2 * (1 - t) * t * ctrlY + t * t * endY;
      const tilt = angle + (leaf % 2 === 0 ? 0.62 : -0.62);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(tilt) * length * 0.2, by + Math.sin(tilt) * length * 0.2 + length * 0.07);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(trunkTopX, trunkTopY, size * 0.024, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
