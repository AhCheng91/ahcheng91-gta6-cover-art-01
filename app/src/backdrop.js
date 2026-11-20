function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pick(seed, min, max) {
  return min + noise(seed) * (max - min);
}

function drawSky(ctx, width, height, palette, horizon) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(0.42, palette.skyMid);
  sky.addColorStop(0.76, palette.skyHot);
  sky.addColorStop(1, palette.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 1);
}

function drawStars(ctx, width, height, palette) {
  const limit = height * 0.42;
  ctx.save();
  for (let i = 0; i < 46; i += 1) {
    const x = pick(i * 3.1 + 1.7, 0, width);
    const y = pick(i * 5.7 + 9.3, 0, limit);
    const r = pick(i * 2.3 + 4.1, 0.5, 1.9);
    const a = pick(i * 7.9 + 2.2, 0.08, 0.42) * (1 - y / limit) + 0.05;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = hexA(palette.cream, a);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(ctx, width, height, palette, horizon) {
  const cx = width * 0.5;
  const cy = horizon - height * 0.045;
  const r = height * 0.155;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 3.2);
  halo.addColorStop(0, hexA(palette.skyLow, 0.5));
  halo.addColorStop(0.35, hexA(palette.skyHot, 0.26));
  halo.addColorStop(1, hexA(palette.skyHot, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);

  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, palette.skyLow);
  disc.addColorStop(0.55, hexA(palette.highlight, 0.96));
  disc.addColorStop(1, hexA(palette.skyHot, 0.92));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = hexA(palette.skyHot, 0.22);
  for (let i = 0; i < 5; i += 1) {
    const bandY = cy - r * 0.1 + i * r * 0.26;
    const bandH = r * (0.035 + i * 0.014);
    ctx.fillRect(cx - r, bandY, r * 2, bandH);
  }
  ctx.restore();
}

function drawClouds(ctx, width, height, palette, horizon) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    const y = pick(i * 4.7 + 12.1, height * 0.1, horizon * 0.62);
    const x = pick(i * 6.3 + 3.9, -width * 0.05, width * 0.55);
    const w = pick(i * 8.1 + 5.5, width * 0.22, width * 0.46);
    const t = pick(i * 2.9 + 7.7, 1.5, 4.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + w * 0.3, y - t * 2, x + w * 0.7, y + t * 2, x + w, y - t);
    ctx.strokeStyle = hexA(i % 2 ? palette.skyLow : palette.highlight, 0.16);
    ctx.lineWidth = t;
    ctx.stroke();
  }
  ctx.restore();
}

function skylineLayer(ctx, width, height, palette, horizon, baseY, seedBase, color, alpha, maxH) {
  ctx.save();
  ctx.fillStyle = hexA(color, alpha);
  let x = -width * 0.02;
  let i = 0;
  while (x < width + width * 0.05) {
    const w = pick(seedBase + i * 3.7, width * 0.03, width * 0.09);
    const h = pick(seedBase + i * 5.1 + 2.3, maxH * 0.3, maxH);
    const top = baseY - h;
    ctx.fillRect(x, top, w + 1, horizon - top + height * 0.02);
    if (noise(seedBase + i * 9.3 + 4.4) > 0.55) {
      const ax = x + w * 0.5;
      const ah = pick(seedBase + i * 2.1 + 6.6, h * 0.18, h * 0.55);
      ctx.fillRect(ax, top - ah, Math.max(1, width * 0.0016), ah);
    }
    if (noise(seedBase + i * 6.9 + 8.8) > 0.72) {
      const bx = x + w * 0.22;
      ctx.fillRect(bx, top - h * 0.22, Math.max(1, width * 0.0012), h * 0.22);
    }
    x += w + pick(seedBase + i * 1.3, width * 0.004, width * 0.02);
    i += 1;
  }
  ctx.restore();
}

function drawWater(ctx, width, height, palette, horizon) {
  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, hexA(palette.shadow, 0.9));
  water.addColorStop(0.55, hexA(palette.shadow, 0.98));
  water.addColorStop(1, hexA(palette.ink, 1));
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);

  const cx = width * 0.5;
  ctx.save();
  for (let i = 0; i < 22; i += 1) {
    const t = i / 21;
    const y = horizon + t * (height - horizon);
    const spread = width * (0.02 + t * 0.16);
    const w = pick(i * 4.3 + 1.1, width * 0.004, width * 0.03);
    const x = cx + pick(i * 7.1 + 3.3, -spread, spread) - w * 0.5;
    ctx.fillStyle = hexA(i % 3 === 0 ? palette.skyHot : palette.highlight, 0.1 + (1 - t) * 0.2);
    ctx.fillRect(x, y, w, Math.max(1, height * 0.0022));
  }
  ctx.restore();

  ctx.save();
  ctx.lineWidth = Math.max(1, height * 0.0018);
  for (let i = 0; i < 5; i += 1) {
    const y = horizon + (i + 1) * ((height - horizon) / 6.2);
    ctx.beginPath();
    const amp = height * 0.0035 * (i + 1);
    ctx.moveTo(width * 0.04, y);
    for (let s = 1; s <= 8; s += 1) {
      const x = width * 0.04 + (width * 0.92 * s) / 8;
      ctx.quadraticCurveTo(x - width * 0.05, y - amp, x, y);
    }
    ctx.strokeStyle = hexA(palette.highlight, 0.12 - i * 0.012);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPalm(ctx, x, baseY, scale, flip, palette, seed) {
  const color = palette.ink;
  const lean = flip * scale * 0.28;
  const topX = x + lean;
  const topY = baseY - scale;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x - scale * 0.035, baseY);
  ctx.bezierCurveTo(
    x - scale * 0.02 + lean * 0.3,
    baseY - scale * 0.45,
    x + lean * 0.55,
    baseY - scale * 0.72,
    topX,
    topY
  );
  ctx.lineTo(topX + scale * 0.045, topY + scale * 0.02);
  ctx.bezierCurveTo(
    x + lean * 0.6 + scale * 0.04,
    baseY - scale * 0.7,
    x + scale * 0.02 + lean * 0.3,
    baseY - scale * 0.44,
    x + scale * 0.045,
    baseY
  );
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 7; i += 1) {
    const spread = (i / 6 - 0.5) * 2;
    const len = scale * (0.42 + 0.22 * (1 - Math.abs(spread)));
    const ang = spread * 1.15 - 0.12 + pick(seed + i * 3.3, -0.08, 0.08);
    const ex = topX + Math.sin(ang) * len;
    const ey = topY - Math.cos(ang) * len * 0.62;
    const mx = topX + Math.sin(ang) * len * 0.5;
    const my = topY - Math.cos(ang) * len * 0.62 - len * 0.18;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, scale * (0.028 - Math.abs(spread) * 0.012));
    ctx.stroke();
    for (let f = 1; f <= 3; f += 1) {
      const t = f / 4;
      const fx = topX + (ex - topX) * t;
      const fy = topY + (ey - topY) * t - len * 0.06 * Math.sin(t * Math.PI);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.sin(ang + 0.7) * scale * 0.09, fy + scale * 0.1);
      ctx.lineWidth = Math.max(0.6, scale * 0.009);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBackdrop(ctx, width, height, palette) {
  const horizon = height * 0.62;
  ctx.save();
  drawSky(ctx, width, height, palette, horizon);
  drawStars(ctx, width, height, palette);
  drawSun(ctx, width, height, palette, horizon);
  drawClouds(ctx, width, height, palette, horizon);

  skylineLayer(ctx, width, height, palette, horizon, horizon + height * 0.004, 11, palette.mid, 0.5, height * 0.1);
  skylineLayer(ctx, width, height, palette, horizon, horizon + height * 0.01, 47, palette.shadow, 0.92, height * 0.075);

  drawWater(ctx, width, height, palette, horizon);
  drawPalm(ctx, width * 0.075, height * 1.005, height * 0.62, 1, palette, 3.7);
  drawPalm(ctx, width * 0.93, height * 1.005, height * 0.56, -1, palette, 8.1);
  ctx.restore();
}
