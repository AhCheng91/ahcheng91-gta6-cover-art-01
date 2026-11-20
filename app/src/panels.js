import { panelsFor } from './state.js';

export function layoutPanels(layoutId, width, height) {
  return panelsFor(layoutId, width, height);
}

export function panelArea(layoutId, width, height) {
  const m = 0.016 * Math.min(width, height);
  const inner = { x: m, y: m, w: width - 2 * m, h: height - 2 * m };
  if (layoutId === 'solo') return { ...inner };
  const top = 0.062 * inner.h;
  const bottom = 0.098 * inner.h;
  return { x: inner.x, y: inner.y + top, w: inner.w, h: inner.h - top - bottom };
}

function dims(image) {
  if (!image) return { w: 0, h: 0 };
  return {
    w: image.naturalWidth || image.width || 0,
    h: image.naturalHeight || image.height || 0
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function coverFit(rect, image, zoom = 1, focus = { x: 0.5, y: 0.5 }) {
  const { w: iw, h: ih } = dims(image);
  const z = zoom > 0 ? zoom : 1;
  const fx = focus ? clamp01(focus.x) : 0.5;
  const fy = focus ? clamp01(focus.y) : 0.5;
  if (!iw || !ih) {
    return {
      sx: 0,
      sy: 0,
      sw: 0,
      sh: 0,
      dx: rect.x,
      dy: rect.y,
      dw: rect.w,
      dh: rect.h,
      scale: 1,
      freeX: 0,
      freeY: 0,
      focus: { x: fx, y: fy }
    };
  }
  const scale = Math.max(rect.w / iw, rect.h / ih) * z;
  const dw = iw * scale;
  const dh = ih * scale;
  const freeX = Math.max(0, dw - rect.w);
  const freeY = Math.max(0, dh - rect.h);
  const dx = rect.x - freeX * fx;
  const dy = rect.y - freeY * fy;
  return {
    sx: 0,
    sy: 0,
    sw: iw,
    sh: ih,
    dx,
    dy,
    dw,
    dh,
    scale,
    freeX,
    freeY,
    focus: { x: fx, y: fy }
  };
}

export function defaultFocus(rect) {
  if (!rect) return { x: 0.5, y: 0.5 };
  if (rect.w > rect.h * 1.15) return { x: 0.5, y: 0.42 };
  if (rect.h > rect.w * 1.4) return { x: 0.5, y: 0.45 };
  return { x: 0.5, y: 0.5 };
}

export function panelFocus(rect, transform) {
  if (!transform || !transform.focus) return defaultFocus(rect);
  return {
    x: clamp01(transform.focus.x),
    y: clamp01(transform.focus.y)
  };
}

export function focusForDrag(fit, dx, dy, focus) {
  const base = focus || (fit && fit.focus) || { x: 0.5, y: 0.5 };
  const freeX = fit ? fit.freeX : 0;
  const freeY = fit ? fit.freeY : 0;
  const nx = freeX > 0.001 ? base.x - dx / freeX : base.x;
  const ny = freeY > 0.001 ? base.y - dy / freeY : base.y;
  return { x: clamp01(nx), y: clamp01(ny) };
}

export function panelAt(panels, x, y) {
  if (!panels) return null;
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return p;
  }
  return null;
}
