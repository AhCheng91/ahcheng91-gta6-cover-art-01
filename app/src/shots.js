import { LAYOUTS, SIZES } from './state.js';
import { PALETTES } from './palette.js';
import { loadShotPhotos, SAMPLES } from './photos.js';

const MODES = new Set(['cover', 'editor', 'sheet']);

function parseSize(raw) {
  const value = String(raw || '').toLowerCase().replace(/\s+/g, '');
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(value);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const known = SIZES.find((s) => s.width === width && s.height === height);
  if (known) return known;
  if (width < 64 || height < 64 || width > 4096 || height > 4096) return null;
  return { id: `${width}x${height}`, width, height, label: `${width} × ${height}` };
}

export async function applyShot(state, search) {
  const query = new URLSearchParams(String(search == null ? '' : search));
  const shot = String(query.get('shot') || '').toLowerCase();
  const mode = MODES.has(shot) ? shot : 'editor';
  const next = { ...state, caption: { ...(state.caption || {}) }, roles: [...(state.roles || [])] };

  const size = parseSize(query.get('size'));
  if (size) {
    const known = SIZES.find((s) => s.id === size.id);
    const resolved = known || size;
    next.sizeId = resolved.id;
    next.width = resolved.width;
    next.height = resolved.height;
  }

  const layout = String(query.get('layout') || '').toLowerCase();
  if (LAYOUTS[layout]) next.layoutId = layout;

  const palette = String(query.get('palette') || '').toLowerCase();
  if (PALETTES[palette]) next.paletteId = palette;

  const photos = query.get('photos');
  if (photos != null && photos.trim()) {
    const ids = photos
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => SAMPLES.some((s) => s.id === id));
    if (ids.length) {
      const loaded = await loadShotPhotos(ids);
      if (loaded.length) {
        next.photos = loaded;
        next.transforms = loaded.map((photo) => {
          const at = (state.photos || []).findIndex((p) => p.id === photo.id);
          if (at >= 0 && state.transforms && state.transforms[at]) return state.transforms[at];
          return { focus: { x: 0.5, y: 0.4 }, zoom: 1.04 };
        });
      }
    }
  }

  const fields = ['title', 'subtitle', 'quote', 'tagline', 'volume', 'credit'];
  for (const field of fields) {
    const value = query.get(field);
    if (value != null) next.caption[field] = value;
  }

  const roles = query.get('roles');
  if (roles != null) {
    const list = roles
      .split('|')
      .map((role) => role.trim())
      .filter(Boolean);
    if (list.length) {
      next.roles = list;
      next.caption.roles = [...list];
    }
  }

  Object.assign(state, next);
  return mode;
}
