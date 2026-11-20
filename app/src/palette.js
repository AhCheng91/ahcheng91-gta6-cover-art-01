// The five poster palettes. A palette is more than a colour set: it carries the poster's ink and
// cream, its printing accents, and the four "poles" (shadow, mid, accent, highlight) that the
// gradient map, the sky and the panels are built from. Everything that colours the cover reads
// from one of these objects, so switching palette repaints the whole world at once.

const BASE = {
  ink: '#0b0616',
  cream: '#fff3e0',
  gold: '#ffd27a',
  magenta: '#ff2e88',
  orange: '#ff7a3c',
  cyan: '#22d3ee',
};

// Sky columns are tuned per palette so the backdrop belongs to the same world as the panels:
// skyTop is the deep night overhead, skyMid the mid-sky, skyHot the burning horizon band and
// skyLow the thin peach strip right above the water.
export const PALETTES = {
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    ...BASE,
    shadow: '#2a0a3d',
    mid: '#8e1c66',
    accent: '#ff2e88',
    highlight: '#ffd27a',
    skyTop: '#150a2e',
    skyMid: '#4a1a63',
    skyHot: '#ff2e88',
    skyLow: '#ffd6a5',
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    ...BASE,
    shadow: '#071a33',
    mid: '#0b6e8a',
    accent: '#22d3ee',
    highlight: '#ff8ad6',
    skyTop: '#04101f',
    skyMid: '#0b2d52',
    skyHot: '#0e7f9e',
    skyLow: '#ffb3e6',
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    ...BASE,
    shadow: '#1d1206',
    mid: '#7a4a12',
    accent: '#e8a33c',
    highlight: '#ffe7b0',
    skyTop: '#1a0f05',
    skyMid: '#5c3310',
    skyHot: '#c9752a',
    skyLow: '#ffe7b0',
  },
  chrome: {
    id: 'chrome',
    label: 'Chrome',
    ...BASE,
    shadow: '#06101f',
    mid: '#39536e',
    accent: '#cfe6ff',
    highlight: '#ffffff',
    skyTop: '#060c17',
    skyMid: '#1d3247',
    skyHot: '#7fa8c9',
    skyLow: '#eaf5ff',
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    ...BASE,
    shadow: '#08060a',
    mid: '#3a0a12',
    accent: '#d92b3a',
    highlight: '#f2c9a0',
    skyTop: '#050406',
    skyMid: '#20060c',
    skyHot: '#7d1420',
    skyLow: '#f2c9a0',
  },
};

export const PALETTE_ORDER = ['sunset', 'neon', 'gold', 'chrome', 'noir'];

export function paletteById(id) {
  return PALETTES[id] ?? PALETTES.sunset;
}
