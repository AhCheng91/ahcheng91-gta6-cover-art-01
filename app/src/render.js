// renderCover: background → photo panels → grade → lettering, all on one canvas at the export resolution.

import { layoutById, paletteById } from './state.js';
import { coverFit, layoutPanels, panelFocus } from './panels.js';
import { photoForPanel } from './photos.js';
import { applyGrade } from './grade.js';
import {
  drawBadges,
  drawCredit,
  drawSubtitle,
  drawTitle,
  layoutLettering,
  letteringBox,
} from './lettering.js';

const HORIZON = 0.63;

function horizonOf(height) {
  return Math.round(height * HORIZON);
}

/** Full-bleed Vice City sunset: gradient sky, sun, skyline, palms, cloud streaks, stars, water with reflections. */
export function drawBackdrop(ctx, width, height) {
  const horizon = horizonOf(height);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#150a2e');
  sky.addColorStop(0.3, '#4a1a63');
  sky.addColorStop(0.58, '#a5246a');
  sky.addColorStop(0.78, '#e0316e');
  sky.addColorStop(0.92, '#ff7a3c');
  sky.addColorStop(1, '#ffd6a5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);

  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, '#3d1236');
  water.addColorStop(0.35, '#250a2b');
  water.addColorStop(1, '#0e0619');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);

  drawStars(ctx, width, height);
  drawSun(ctx, width, height, horizon);
  drawClouds(ctx, width, height, horizon);
  drawSkyline(ctx, width, height, horizon);
  drawReflections(ctx, width, height, horizon);
  drawWaveLines(ctx, width, height, horizon);
  drawPalm(ctx, width * 0.045, height, Math.min(width, height) * 0.52, 1);
  drawPalm(ctx, width * 0.955, height * 0.995, Math.min(width, height) * 0.46, -1);
}

function drawStars(ctx, width, height) {
  const limit = horizonOf(height) * 0.42;
  ctx.save();
  for (let i = 0; i < 46; i += 1) {
    const fx = Math.sin(i * 12.9898) * 43758.5453;
    const fy = Math.sin((i + 5) * 78.233) * 12345.6789;
    const x = (fx - Math.floor(fx)) * width;
    const y = (fy - Math.floor(fy)) * limit;
    const r = 0.5 + ((i * 37) % 10) / 9;
    ctx.globalAlpha = 0.18 + ((i * 13) % 7) / 22;
    ctx.fillStyle = i % 6 === 0 ? '#ffd9a8' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(ctx, width, height, horizon) {
  const cx = width * 0.5;
  const cy = horizon - height * 0.012;
  const radius = Math.min(width, height) * 0.19;
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius * 2.2);
  glow.addColorStop(0, 'rgba(255,196,120,0.5)');
  glow.addColorStop(0.45, 'rgba(255,122,60,0.24)');
  glow.addColorStop(1, 'rgba(255,122,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizon + height * 0.06);

  const disc = ctx.createRadialGradient(cx, cy - radius * 0.25, radius * 0.08, cx, cy, radius);
  disc.addColorStop(0, '#fff8d8');
  disc.addColorStop(0.4, '#fff3c4');
  disc.addColorStop(0.82, '#ffb45a');
  disc.addColorStop(1, 'rgba(255,138,61,0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClouds(ctx, width, height, horizon) {
  const streaks = [
    { y: 0.2, h: 0.012, a: 0.1, x: 0.08, w: 0.7 },
    { y: 0.29, h: 0.009, a: 0.13, x: 0.2, w: 0.62 },
    { y: 0.37, h: 0.016, a: 0.16, x: 0.0, w: 0.55 },
    { y: 0.46, h: 0.011, a: 0.2, x: 0.42, w: 0.58 },
    { y: 0.55, h: 0.02, a: 0.24, x: 0.12, w: 0.8 },
    { y: 0.6, h: 0.014, a: 0.3, x: 0.56, w: 0.44 },
  ];
  ctx.save();
  for (const [index, streak] of streaks.entries()) {
    const y = streak.y * horizon;
    const x = streak.x * width;
    const w = streak.w * width;
    const h = Math.max(2, streak.h * height);
    const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
    gradient.addColorStop(0, 'rgba(255,214,205,0)');
    gradient.addColorStop(0.35, `rgba(255,222,210,${streak.a})`);
    gradient.addColorStop(0.62, `rgba(255,180,190,${streak.a * 0.8})`);
    gradient.addColorStop(1, 'rgba(255,214,205,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (index % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(255,240,220,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.38, y + h * 0.1, w * 0.3, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function skylineLayer(ctx, width, horizon, opts) {
  const { base, color, minH, maxH, seed, count, antennae } = opts;
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  ctx.save();
  ctx.fillStyle = color;
  let x = -width * 0.02;
  const span = width * 1.04;
  while (x < span) {
    const w = span / count * (0.45 + rand() * 1.1);
    const h = minH + rand() * (maxH - minH);
    const top = horizon - h;
    ctx.fillRect(x, top, Math.max(2, w), h + base);
    if (antennae && rand() > 0.72) {
      const ax = x + w * (0.25 + rand() * 0.5);
      const ah = h * (0.12 + rand() * 0.2);
      ctx.fillRect(ax, top - ah, Math.max(1, width * 0.0015), ah);
      if (rand() > 0.5) {
        ctx.beginPath();
        ctx.arc(ax, top - ah, Math.max(1.5, width * 0.0018), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    x += w + span * 0.004 + rand() * span * 0.01;
  }
  ctx.restore();
}

function drawSkyline(ctx, width, height, horizon) {
  skylineLayer(ctx, width, horizon, {
    base: height * 0.004,
    color: 'rgba(52,16,74,0.55)',
    minH: height * 0.02,
    maxH: height * 0.075,
    seed: 11,
    count: 26,
    antennae: false,
  });
  skylineLayer(ctx, width, horizon, {
    base: height * 0.006,
    color: 'rgba(36,10,58,0.78)',
    minH: height * 0.03,
    maxH: height * 0.115,
    seed: 4242,
    count: 17,
    antennae: true,
  });
  skylineLayer(ctx, width, horizon, {
    base: height * 0.008,
    color: 'rgba(24,6,42,0.92)',
    minH: height * 0.012,
    maxH: height * 0.055,
    seed: 909,
    count: 30,
    antennae: false,
  });
}

function drawReflections(ctx, width, height, horizon) {
  const cx = width * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const beam = ctx.createLinearGradient(cx, horizon, cx, height);
  beam.addColorStop(0, 'rgba(255,196,120,0.5)');
  beam.addColorStop(0.4, 'rgba(255,138,61,0.16)');
  beam.addColorStop(1, 'rgba(255,138,61,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  const halfTop = width * 0.035;
  const halfBottom = width * 0.14;
  ctx.moveTo(cx - halfTop, horizon);
  ctx.lineTo(cx + halfTop, horizon);
  ctx.lineTo(cx + halfBottom, height);
  ctx.lineTo(cx - halfBottom, height);
  ctx.closePath();
  ctx.fill();

  let s = 77;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = 0; i < 70; i += 1) {
    const t = rand();
    const y = horizon + (height - horizon) * t;
    const spread = (halfTop + (halfBottom - halfTop) * t) * (0.4 + rand() * 0.9);
    const w = Math.max(2, width * 0.004 * (0.4 + rand() * 2.2));
    const x = cx + (rand() * 2 - 1) * spread;
    ctx.globalAlpha = (1 - t) * 0.5 * (0.3 + rand() * 0.7);
    ctx.fillStyle = rand() > 0.3 ? '#ffcf8a' : '#ff6f8f';
    ctx.fillRect(x, y, w, Math.max(1, height * 0.0025 * (0.5 + rand())));
  }
  ctx.restore();
}

function drawWaveLines(ctx, width, height, horizon) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i += 1) {
    const y = horizon + (height - horizon) * ((i + 1) / 28);
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,164,120,0.14)' : 'rgba(120,40,120,0.16)';
    const inset = width * 0.02 * (i % 3);
    ctx.fillRect(inset, y, width - inset * 2, Math.max(1, height * 0.0012));
  }
  ctx.restore();
}

/** One dark palm: curved trunk plus curved fronds, from (x, baseY) growing up. dir mirrors it. */
function drawPalm(ctx, x, baseY, size, dir) {
  const lean = 0.12 * size * dir;
  ctx.save();
  ctx.strokeStyle = 'rgba(16,5,26,0.92)';
  ctx.fillStyle = 'rgba(16,5,26,0.92)';
  const trunkTopX = x + lean * 2.6;
  const trunkTopY = baseY - size;
  ctx.lineWidth = size * 0.028;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.bezierCurveTo(x + lean * 0.4, baseY - size * 0.4, x + lean * 1.7, baseY - size * 0.76, trunkTopX, trunkTopY);
  ctx.stroke();

  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const spread = (i - (fronds - 1) / 2) / ((fronds - 1) / 2);
    const angle = -Math.PI / 2 + spread * 1.5;
    const length = size * (0.36 + 0.12 * (1 - Math.abs(spread)));
    const endX = trunkTopX + Math.cos(angle) * length * dir;
    const endY = trunkTopY + Math.sin(angle) * length * 0.62;
    const ctrlX = trunkTopX + Math.cos(angle) * length * 0.55 * dir;
    const ctrlY = trunkTopY + Math.sin(angle) * length * 0.15 - length * 0.16;
    ctx.lineWidth = size * (0.016 + 0.006 * (1 - Math.abs(spread)));
    ctx.beginPath();
    ctx.moveTo(trunkTopX, trunkTopY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();

    ctx.lineWidth = size * 0.005;
    for (let leaf = 1; leaf <= 4; leaf += 1) {
      const t = leaf / 5;
      const bx = (1 - t) * (1 - t) * trunkTopX + 2 * (1 - t) * t * ctrlX + t * t * endX;
      const by = (1 - t) * (1 - t) * trunkTopY + 2 * (1 - t) * t * ctrlY + t * t * endY;
      const tilt = angle + (leaf % 2 === 0 ? 0.6 : -0.6);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(tilt) * length * 0.2, by + Math.sin(tilt) * length * 0.2 + length * 0.06);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(16,5,26,0.92)';
  ctx.beginPath();
  ctx.arc(trunkTopX, trunkTopY, size * 0.026, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPanelPhoto(ctx, panel, photo, transform) {
  if (!photo) {
    ctx.save();
    ctx.fillStyle = '#1a0f28';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.restore();
    return;
  }
  const fit = coverFit(panel, photo.image, transform.zoom, panelFocus(panel, transform));
  const jitter = panel.index % 5;
  const hue = (jitter - 2) * 2;
  const bright = 0.97 + (jitter % 3) * 0.02;
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.filter = `hue-rotate(${hue}deg) brightness(${bright.toFixed(3)}) saturate(1.04)`;
  ctx.drawImage(photo.image, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
  ctx.filter = 'none';

  if (panel.index % 3 === 0) {
    const streak = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
    streak.addColorStop(0.24, 'rgba(255,255,255,0)');
    streak.addColorStop(0.44, 'rgba(255,236,210,0.13)');
    streak.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  }

  const shadow = ctx.createLinearGradient(0, panel.y + panel.h * 0.55, 0, panel.y + panel.h);
  shadow.addColorStop(0, 'rgba(12,2,20,0)');
  shadow.addColorStop(1, 'rgba(12,2,20,0.42)');
  ctx.fillStyle = shadow;
  ctx.fillRect(panel.x, panel.y + panel.h * 0.55, panel.w, panel.h * 0.45);

  ctx.lineWidth = Math.max(1, Math.min(panel.w, panel.h) * 0.0038);
  ctx.strokeStyle = 'rgba(255,244,226,0.42)';
  ctx.strokeRect(panel.x + ctx.lineWidth / 2, panel.y + ctx.lineWidth / 2, panel.w - ctx.lineWidth, panel.h - ctx.lineWidth);
  ctx.restore();
}

/** Dark base under the collage: gutters read as clean layout lines instead of the sky. */
function drawPanelBase(ctx, area) {
  ctx.save();
  ctx.fillStyle = '#120a1c';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.restore();
}

/** Routes the sunset into the band: edge shade, palette glow and a low-opacity water/reflection texture. */
function drawBandTreatment(ctx, band, palette, width, height) {
  if (band.h <= 0) return;
  const accent = palette.accent;
  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();

  const water = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  water.addColorStop(0, 'rgba(58,16,54,0.55)');
  water.addColorStop(0.45, 'rgba(33,9,40,0.5)');
  water.addColorStop(1, 'rgba(14,6,25,0.62)');
  ctx.fillStyle = water;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  ctx.globalAlpha = 0.36;
  for (let i = 0; i < 16; i += 1) {
    const t = (i + 1) / 18;
    const y = band.y + band.h * t;
    const inset = width * 0.02 * ((i % 4) * 0.6);
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,170,120,0.16)' : 'rgba(120,40,130,0.2)';
    ctx.fillRect(inset, Math.round(y), width - inset * 2, Math.max(1, height * 0.0012));
  }

  ctx.globalAlpha = 0.22;
  const column = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  column.addColorStop(0, 'rgba(255,196,120,0.45)');
  column.addColorStop(1, 'rgba(255,138,61,0)');
  ctx.fillStyle = column;
  const cx = width * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.16, band.y);
  ctx.lineTo(cx + width * 0.16, band.y);
  ctx.lineTo(cx + width * 0.24, band.y + band.h);
  ctx.lineTo(cx - width * 0.24, band.y + band.h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  const edge = ctx.createLinearGradient(0, band.y, 0, band.y + band.h * 0.42);
  edge.addColorStop(0, 'rgba(8,3,16,0.88)');
  edge.addColorStop(0.55, 'rgba(10,4,18,0.42)');
  edge.addColorStop(1, 'rgba(10,4,18,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(band.x, band.y, band.w, band.h * 0.42);

  const glow = ctx.createRadialGradient(cx, band.y + band.h * 0.46, 0, cx, band.y + band.h * 0.46, Math.max(band.w * 0.46, band.h * 1.1));
  glow.addColorStop(0, rgbaHex(accent, 0.34));
  glow.addColorStop(0.5, rgbaHex(accent, 0.14));
  glow.addColorStop(1, rgbaHex(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.restore();
}

function rgbaHex(hex, alpha) {
  const clean = String(hex ?? '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  return `rgba(${parseInt(full.slice(0, 2), 16) || 0},${parseInt(full.slice(2, 4), 16) || 0},${parseInt(full.slice(4, 6), 16) || 0},${alpha})`;
}

/** The live cover. Fixed rendering order so the same state gives the same pixels. */
export function renderCover(canvas, state) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.clearRect(0, 0, width, height);

  drawBackdrop(ctx, width, height);

  const layout = layoutPanels(state.layout, width, height);
  const palette = paletteById(state.palette);
  drawPanelBase(ctx, layout.area);
  for (const panel of layout.panels) {
    const photo = photoForPanel(state, panel.index);
    const transform = state.transforms[panel.index] ?? { zoom: 1, focusX: null, focusY: null };
    drawPanelPhoto(ctx, panel, photo, transform);
  }

  applyGrade(ctx, { x: 0, y: 0, w: width, h: height }, palette, state.grade, state.grain, state.bloom);
  drawBandTreatment(ctx, layout.band, palette, width, height);

  const band = layout.band;
  const box = letteringBox(layoutById(state.layout).id, width, height, band);
  const metrics = layoutLettering(ctx, {
    title: state.title,
    subtitle: state.subtitle,
    badges: state.badges,
    box,
    height,
  });
  drawSubtitle(ctx, state.subtitle, metrics, palette);
  const titleLayout = drawTitle(ctx, state.title, metrics, palette);
  drawBadges(ctx, state.badges, metrics, palette, height);
  drawCredit(ctx, state.credit, { x: width * 0.05, y: height * 0.965, w: width * 0.9, h: height * 0.035 }, height);
  ctx.restore();

  return { layout, palette, titleLayout, box, metrics };
}
