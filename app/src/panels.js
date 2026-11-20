// Poster and panel geometry. One place decides where the strips, the panel field and every panel
// rectangle sit, so render.js, lettering.js and the editor's hit-testing all agree to the pixel.
//
// Layout fractions are fractions of the PANEL FIELD (the area between the two strips), and the
// gutter between panels is *ink*, not background: each interior edge is inset by half the gutter
// so the panels read as separate prints on a black page.

/** Panel layouts, in field fractions. All six fill their field with no empty cell. */
export const LAYOUTS = {
  poster: {
    id: 'poster',
    label: 'Poster',
    diagram: 'mosaic',
    panels: [
      [0.0, 0.0, 0.34, 0.5],
      [0.345, 0.0, 0.325, 0.5],
      [0.675, 0.0, 0.325, 0.5],
      [0.0, 0.505, 0.25, 0.495],
      [0.255, 0.505, 0.3, 0.495],
      [0.56, 0.505, 0.44, 0.495],
    ],
  },
  collage: {
    id: 'collage',
    label: 'Collage',
    diagram: 'mosaic',
    panels: [
      [0.0, 0.0, 0.3, 0.34],
      [0.305, 0.0, 0.29, 0.34],
      [0.6, 0.0, 0.4, 0.34],
      [0.0, 0.345, 0.44, 0.655],
      [0.445, 0.345, 0.25, 0.655],
      [0.7, 0.345, 0.3, 0.655],
    ],
  },
  triptych: {
    id: 'triptych',
    label: 'Triptych',
    diagram: 'triple',
    panels: [
      [0.0, 0.0, 0.326, 1.0],
      [0.337, 0.0, 0.326, 1.0],
      [0.674, 0.0, 0.326, 1.0],
    ],
  },
  hero: {
    id: 'hero',
    label: 'Hero',
    diagram: 'hero',
    panels: [
      [0.34, 0.0, 0.66, 1.0],
      [0.0, 0.0, 0.33, 0.326],
      [0.0, 0.337, 0.33, 0.326],
      [0.0, 0.674, 0.33, 0.326],
    ],
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    diagram: 'solo',
    panels: [[0.0, 0.0, 1.0, 1.0]],
  },
  nine: {
    id: 'nine',
    label: 'Nine',
    diagram: 'grid',
    panels: [
      [0.0, 0.0, 0.328, 0.328],
      [0.336, 0.0, 0.328, 0.328],
      [0.672, 0.0, 0.328, 0.328],
      [0.0, 0.336, 0.328, 0.328],
      [0.336, 0.336, 0.328, 0.328],
      [0.672, 0.336, 0.328, 0.328],
      [0.0, 0.672, 0.328, 0.328],
      [0.336, 0.672, 0.328, 0.328],
      [0.672, 0.672, 0.328, 0.328],
    ],
  },
};

// Landscape poster: a shallower top row and a wide bottom row so more photograph shows behind
// the single-line title.
const POSTER_WIDE = [
  [0.0, 0.0, 0.34, 0.46],
  [0.345, 0.0, 0.325, 0.46],
  [0.675, 0.0, 0.325, 0.46],
  [0.0, 0.465, 0.25, 0.535],
  [0.255, 0.465, 0.3, 0.535],
  [0.56, 0.465, 0.44, 0.535],
];

export const LAYOUT_ORDER = ['poster', 'collage', 'triptych', 'hero', 'solo', 'nine'];

/** The panel fractions a layout uses at this aspect: `poster` is wider than it is tall in landscape. */
export function panelsFor(layoutId, width, height) {
  if (layoutId === 'poster' && width > height) return POSTER_WIDE;
  return (LAYOUTS[layoutId] ?? LAYOUTS.poster).panels;
}

/**
 * The poster's frame: ink margin, the inner rect, both strips and the panel field, in pixels.
 * `solo` has no strips, so its field is the whole inner rect and the lettering sits on the photo.
 */
export function posterGeometry(width, height, layoutId) {
  const m = Math.round(0.016 * Math.min(width, height));
  const inner = { x: m, y: m, w: width - 2 * m, h: height - 2 * m };
  if (layoutId === 'solo') {
    return {
      margin: m,
      inner,
      topStrip: { x: inner.x, y: inner.y, w: inner.w, h: 0 },
      bottomStrip: { x: inner.x, y: inner.y + inner.h, w: inner.w, h: 0 },
      field: inner,
    };
  }
  const topH = Math.round(0.062 * inner.h);
  // The foot carries two rows (tagline + rule, then barcode/credit/seal), so it is deeper.
  const bottomH = Math.round(0.098 * (height - 2 * m));
  return {
    margin: m,
    inner,
    topStrip: { x: inner.x, y: inner.y, w: inner.w, h: topH },
    bottomStrip: { x: inner.x, y: inner.y + inner.h - bottomH, w: inner.w, h: bottomH },
    field: { x: inner.x, y: inner.y + topH, w: inner.w, h: inner.h - topH - bottomH },
  };
}

function interior(edge) {
  return edge > 0.001 && edge < 0.999;
}

/**
 * Layout id + pixels → the panel rects in cover space, plus the geometry they were built in.
 * Interior edges lose half the gutter so the ink shows through between neighbours.
 */
export function layoutPanels(layoutId, width, height) {
  const geometry = posterGeometry(width, height, layoutId);
  const field = geometry.field;
  const gutter = Math.round(0.0055 * Math.min(width, height));
  const half = gutter / 2;
  const rows = panelsFor(layoutId, width, height);

  const panels = rows.map(([fx, fy, fw, fh], index) => {
    let x = field.x + fx * field.w;
    let y = field.y + fy * field.h;
    let w = fw * field.w;
    let h = fh * field.h;
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

  return { panels, field, geometry, gutter };
}

/** Where a panel starts looking: wide panels look slightly high so heads survive the crop. */
export function defaultFocus(rect) {
  const aspect = rect.w / Math.max(1, rect.h);
  return { x: 0.5, y: aspect > 1.25 ? 0.3 : 0.36 };
}

/** The focus a panel is actually drawn with: the user's pan when set, the shape default otherwise. */
export function panelFocus(rect, transform = {}) {
  const fallback = defaultFocus(rect);
  return {
    x: Number.isFinite(transform?.focusX) ? transform.focusX : fallback.x,
    y: Number.isFinite(transform?.focusY) ? transform.focusY : fallback.y,
  };
}

/**
 * Cover-fit `image` into `rect`, panned by `focus` and scaled by `zoom`. Returns the source crop,
 * the destination rect and the free travel on each axis (needed to turn a drag into a focus).
 */
export function coverFit(rect, image, zoom = 1, focus = { x: 0.5, y: 0.5 }) {
  const iw = image?.naturalWidth || image?.width || 1;
  const ih = image?.naturalHeight || image?.height || 1;
  const safeZoom = Math.max(1, Math.min(4, Number.isFinite(zoom) ? zoom : 1));
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * safeZoom;
  const sw = Math.min(iw, rect.w / scale);
  const sh = Math.min(ih, rect.h / scale);
  const freeX = Math.max(0, iw - sw);
  const freeY = Math.max(0, ih - sh);
  const fx = Math.max(0, Math.min(1, Number.isFinite(focus?.x) ? focus.x : 0.5));
  const fy = Math.max(0, Math.min(1, Number.isFinite(focus?.y) ? focus.y : 0.5));
  return {
    sx: freeX * fx,
    sy: freeY * fy,
    sw,
    sh,
    dx: rect.x,
    dy: rect.y,
    dw: rect.w,
    dh: rect.h,
    iw,
    ih,
    freeX,
    freeY,
    scale,
  };
}

/** The topmost panel under a cover-space point, or -1. */
export function panelAt(panels, x, y) {
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

/**
 * A drag of (dx, dy) cover pixels → the new focus at the current zoom. Dragging the photo right
 * slides the crop window left, so the focus moves the other way along the free travel.
 */
export function focusForDrag(fit, dx, dy, focus) {
  const next = { x: Number.isFinite(focus?.x) ? focus.x : 0.5, y: Number.isFinite(focus?.y) ? focus.y : 0.5 };
  const scale = fit.scale || 1;
  if (fit.freeX > 0) next.x = Math.max(0, Math.min(1, next.x - dx / scale / fit.freeX));
  if (fit.freeY > 0) next.y = Math.max(0, Math.min(1, next.y - dy / scale / fit.freeY));
  return next;
}
