// Panel geometry: turns a layout definition into pixel rectangles over the panel area, and each rectangle plus an
// image into the source crop and destination rect that fill it without distortion.

import { layoutById } from './state.js';

/** The band under the panels holds the lettering; solo has none. */
export function bandHeight(layoutId, height) {
  const layout = layoutById(layoutId);
  return Math.round(layout.band * height);
}

/** The strip of the cover the panels may occupy, above the title band. */
export function panelArea(layoutId, width, height) {
  const band = bandHeight(layoutId, height);
  return { x: 0, y: 0, w: width, h: height - band, band };
}

function interior(edge) {
  return edge > 0.001 && edge < 0.999;
}

/** Layout fractions → pixel rects (plus the title band rect). Gutters between panels read as the background. */
export function layoutPanels(layoutId, width, height) {
  const layout = layoutById(layoutId);
  const area = panelArea(layoutId, width, height);
  const gutter = Math.round(Math.min(width, height) * 0.011);
  const half = gutter / 2;
  const panels = layout.panels.map(([fx, fy, fw, fh], index) => {
    let x = fx * width;
    let y = area.y + fy * area.h;
    let w = fw * width;
    let h = fh * area.h;
    if (interior(fx)) {
      x += half;
      w -= half;
    }
    if (interior(fx + fw)) w -= half;
    if (interior(fy)) {
      y += half;
      h -= half;
    }
    if (interior(fy + fh)) h -= half;
    return {
      index,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    };
  });
  return {
    panels,
    band: { x: 0, y: area.y + area.h, w: width, h: area.band },
    area,
    gutter,
  };
}

/** The focus a panel starts with, chosen from its own shape: wide panels look higher so heads survive. */
export function defaultFocus(rect) {
  return { x: 0.5, y: rect.w / rect.h > 1.3 ? 0.22 : 0.42 };
}

/** The focus to draw a panel with: the user's explicit pan when they have one, otherwise the shape's default. */
export function panelFocus(rect, transform = {}) {
  const fallback = defaultFocus(rect);
  return {
    x: transform.focusX ?? fallback.x,
    y: transform.focusY ?? fallback.y,
  };
}

/** Source crop + destination rect for a cover-fit draw of `image` into `rect`, panned by `focus` and scaled by `zoom`. */
export function coverFit(rect, image, zoom = 1, focus = { x: 0.5, y: 0.5 }) {
  const iw = image.naturalWidth || image.width || 1;
  const ih = image.naturalHeight || image.height || 1;
  const safeZoom = Math.max(1, Math.min(4, zoom || 1));
  const scale = Math.max(rect.w / iw, rect.h / ih) * safeZoom;
  const sw = Math.min(iw, rect.w / scale);
  const sh = Math.min(ih, rect.h / scale);
  const freeX = Math.max(0, iw - sw);
  const freeY = Math.max(0, ih - sh);
  const fx = Math.max(0, Math.min(1, focus.x ?? 0.5));
  const fy = Math.max(0, Math.min(1, focus.y ?? 0.5));
  return {
    sx: freeX * fx,
    sy: freeY * fy,
    sw,
    sh,
    dx: rect.x,
    dy: rect.y,
    dw: rect.w,
    dh: rect.h,
    scale,
  };
}

/** The panel under a cover-space point, or -1. */
export function panelAt(panels, x, y) {
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

/**
 * Converts a drag of (dx, dy) cover pixels into a new focus for the current zoom. Moving the photo right means the
 * crop window slides left, so the focus decreases on that axis.
 */
export function focusForDrag(fit, dx, dy, focus) {
  const freeX = fit.sw > 0 ? 1 : 0;
  const freeY = fit.sh > 0 ? 1 : 0;
  const spanX = Math.max(1, fit.sw);
  const spanY = Math.max(1, fit.sh);
  return {
    x: Math.max(0, Math.min(1, (focus.x ?? 0.5) - (dx / spanX) * freeX)),
    y: Math.max(0, Math.min(1, (focus.y ?? 0.5) - (dy / spanY) * freeY)),
  };
}
