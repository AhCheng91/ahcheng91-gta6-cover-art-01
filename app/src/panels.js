import { clamp } from './util.js';
import { ROLES } from './state.js';

const POSTER_169 = [
  { role: 'THE BOSS', x0: 0.232, x1: 0.632, y0: 0.070, y1: 0.892 },
  { role: 'THE DRIVER', x0: 0.008, x1: 0.220, y0: 0.070, y1: 0.430 },
  { role: 'THE RIDER', x0: 0.008, x1: 0.220, y0: 0.446, y1: 0.892 },
  { role: 'THE INSIDER', x0: 0.644, x1: 0.815, y0: 0.070, y1: 0.430 },
  { role: 'THE COURIER', x0: 0.644, x1: 0.815, y0: 0.446, y1: 0.892 },
  { role: 'THE LAWYER', x0: 0.827, x1: 0.992, y0: 0.070, y1: 0.430 },
  { role: 'THE MECHANIC', x0: 0.827, x1: 0.992, y0: 0.446, y1: 0.892 }
];
const POSTER_169_TITLE = { x0: 0.02, x1: 0.98, y0: 0.560, y1: 0.905 };

const POSTER_45 = [
  { role: 'THE BOSS', x0: 0.012, x1: 0.988, y0: 0.070, y1: 0.420 },
  { role: 'THE DRIVER', x0: 0.012, x1: 0.330, y0: 0.436, y1: 0.660 },
  { role: 'THE COURIER', x0: 0.341, x1: 0.659, y0: 0.436, y1: 0.660 },
  { role: 'THE INSIDER', x0: 0.670, x1: 0.988, y0: 0.436, y1: 0.660 }
];
const POSTER_45_TITLE = { x0: 0.03, x1: 0.97, y0: 0.660, y1: 0.905 };

const POSTER_11 = [
  { role: 'THE BOSS', x0: 0.012, x1: 0.560, y0: 0.070, y1: 0.420 },
  { role: 'THE INSIDER', x0: 0.572, x1: 0.988, y0: 0.070, y1: 0.240 },
  { role: 'THE LAWYER', x0: 0.572, x1: 0.988, y0: 0.252, y1: 0.420 },
  { role: 'THE RIDER', x0: 0.012, x1: 0.330, y0: 0.436, y1: 0.600 },
  { role: 'THE DRIVER', x0: 0.341, x1: 0.659, y0: 0.436, y1: 0.600 },
  { role: 'THE COURIER', x0: 0.670, x1: 0.988, y0: 0.436, y1: 0.600 }
];
const POSTER_11_TITLE = { x0: 0.04, x1: 0.96, y0: 0.600, y1: 0.905 };

function cutFor(w, h) {
  return Math.min(0.09 * Math.min(w, h), 34);
}

function panelAt(i, role, x, y, w, h) {
  return {
    i,
    role,
    x,
    y,
    w,
    h,
    cut: cutFor(w, h),
    focus: { x: 0.5, y: 0.42 },
    zoom: 1
  };
}

function posterTable(width, height) {
  const ratio = width / height;
  if (ratio > 1.5) return { rows: POSTER_169, title: POSTER_169_TITLE };
  if (height / width > 1.1) return { rows: POSTER_45, title: POSTER_45_TITLE };
  return { rows: POSTER_11, title: POSTER_11_TITLE };
}

function posterPanels(width, height) {
  const { rows, title } = posterTable(width, height);
  const panels = rows.map((r, i) =>
    panelAt(
      i,
      r.role,
      Math.round(r.x0 * width * 100) / 100,
      Math.round(r.y0 * height * 100) / 100,
      Math.round((r.x1 - r.x0) * width * 100) / 100,
      Math.round((r.y1 - r.y0) * height * 100) / 100
    )
  );
  return {
    panels,
    title: {
      x: title.x0 * width,
      y: title.y0 * height,
      w: (title.x1 - title.x0) * width,
      h: (title.y1 - title.y0) * height
    }
  };
}

function gridPanels(layout, width, height) {
  const m = 0.008 * width;
  const g = 0.007 * width;
  const x0 = m;
  const x1 = width - m;
  const y0 = 0.062 * height + g;
  const y1 = 0.905 * height - g;
  const cw = x1 - x0;
  const ch = y1 - y0;
  const panels = [];
  const push = (role, x, y, w, h) => panels.push(panelAt(panels.length, role, x, y, w, h));

  if (layout === 'collage') {
    const topH = (ch - g) * 0.5;
    const botH = ch - g - topH;
    const topW = (cw - g) / 2;
    const botW = (cw - 3 * g) / 4;
    for (let i = 0; i < 2; i++) push(ROLES[i % ROLES.length], x0 + i * (topW + g), y0, topW, topH);
    for (let i = 0; i < 4; i++) push(ROLES[(i + 2) % ROLES.length], x0 + i * (botW + g), y0 + topH + g, botW, botH);
  } else if (layout === 'triptych') {
    const w = (cw - 2 * g) / 3;
    for (let i = 0; i < 3; i++) push(ROLES[i % ROLES.length], x0 + i * (w + g), y0, w, ch);
  } else if (layout === 'hero') {
    const leftW = (cw - g) * 0.62;
    const rightW = cw - g - leftW;
    const sh = (ch - 2 * g) / 3;
    push(ROLES[1], x0, y0, leftW, ch);
    for (let i = 0; i < 3; i++) push(ROLES[(i + 2) % ROLES.length], x0 + leftW + g, y0 + i * (sh + g), rightW, sh);
  } else if (layout === 'solo') {
    push(ROLES[1], x0, y0, cw, ch);
  } else {
    const w = (cw - 2 * g) / 3;
    const h = (ch - 2 * g) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) push(ROLES[(r * 3 + c) % ROLES.length], x0 + c * (w + g), y0 + r * (h + g), w, h);
    }
  }

  const titleH = 0.105 * height;
  return {
    panels,
    title: { x: 0.03 * width, y: y1 - titleH, w: 0.94 * width, h: titleH }
  };
}

export function layoutPanels(layout, width, height) {
  const W = width;
  const H = height;
  const built = layout === 'poster' ? posterPanels(W, H) : gridPanels(layout, W, H);

  const footer = { x: 0, y: 0.905 * H, w: W, h: 0.095 * H };
  const sealR = clamp(0.032 * W, 40, 64);

  return {
    panels: built.panels,
    title: built.title,
    quote: { x: 0, y: 0, w: W, h: 0.062 * H },
    footer,
    seal: { cx: 0.955 * W, cy: footer.y - 0.030 * H, r: sealR },
    barcode: { x: 0.812 * W, y: footer.y + 0.018 * H, w: 0.176 * W, h: 0.050 * H }
  };
}

export function coverFit(rect, image, zoom = 1, focus = { x: 0.5, y: 0.5 }) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const z = Math.max(1, zoom || 1);
  const scale = Math.max(rect.w / iw, rect.h / ih) * z;
  const sw = Math.min(iw, rect.w / scale);
  const sh = Math.min(ih, rect.h / scale);
  const fx = clamp(focus && focus.x != null ? focus.x : 0.5, 0, 1);
  const fy = clamp(focus && focus.y != null ? focus.y : 0.5, 0, 1);
  const sx = clamp((iw - sw) * fx, 0, iw - sw);
  const sy = clamp((ih - sh) * fy, 0, ih - sh);
  return { sx, sy, sw, sh, dx: rect.x, dy: rect.y, dw: rect.w, dh: rect.h };
}

export function cutRectPoints(x, y, w, h, cut) {
  const c = Math.min(Math.max(0, cut), Math.min(w, h));
  return [
    [x + c, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y + c]
  ];
}

export function rolePlateRect(panel) {
  const w = Math.min(Math.max(96, 0.42 * panel.w), panel.w);
  const h = Math.min(Math.max(22, 0.052 * panel.h), panel.h);
  const x = clamp(panel.x + 0.04 * panel.w, panel.x, panel.x + panel.w - w);
  const y = clamp(panel.y + panel.cut * 0.55, panel.y, panel.y + panel.h - h);
  return { x, y, w, h };
}
