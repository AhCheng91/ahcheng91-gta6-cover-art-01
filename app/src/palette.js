const INK = '#0b0616';
const CREAM = '#fff3e0';
const GOLD = '#ffd27a';
const MAGENTA = '#ff2e88';
const ORANGE = '#ff7a3c';
const CYAN = '#22d3ee';

const base = {
  ink: INK,
  cream: CREAM,
  gold: GOLD,
  magenta: MAGENTA,
  orange: ORANGE,
  cyan: CYAN
};

export const PALETTES = {
  sunset: {
    ...base,
    label: 'Sunset',
    shadow: '#2a0a3d',
    mid: '#8e1c66',
    accent: '#ff2e88',
    highlight: '#ffd27a',
    skyTop: '#150a2e',
    skyMid: '#4a1a63',
    skyHot: '#e0316e',
    skyLow: '#ffd6a5'
  },
  neon: {
    ...base,
    label: 'Neon',
    shadow: '#071a33',
    mid: '#0b6e8a',
    accent: '#22d3ee',
    highlight: '#ff8ad6',
    skyTop: '#04101f',
    skyMid: '#0b3d5c',
    skyHot: '#0b6e8a',
    skyLow: '#7ce7ff'
  },
  gold: {
    ...base,
    label: 'Gold',
    shadow: '#1d1206',
    mid: '#7a4a12',
    accent: '#e8a33c',
    highlight: '#ffe7b0',
    skyTop: '#1a0f05',
    skyMid: '#5a2c0c',
    skyHot: '#e8a33c',
    skyLow: '#ffe7b0'
  },
  chrome: {
    ...base,
    label: 'Chrome',
    shadow: '#06101f',
    mid: '#2c4a63',
    accent: '#bfe0ff',
    highlight: '#ffffff',
    skyTop: '#06101f',
    skyMid: '#2c4a63',
    skyHot: '#7fa8c9',
    skyLow: '#eaf6ff'
  },
  noir: {
    ...base,
    label: 'Noir',
    shadow: '#08060a',
    mid: '#3a0a12',
    accent: '#d92b3a',
    highlight: '#f2c9a0',
    skyTop: '#060406',
    skyMid: '#2a0a12',
    skyHot: '#d92b3a',
    skyLow: '#f2c9a0'
  }
};

export const PALETTE_ORDER = ['sunset', 'neon', 'gold', 'chrome', 'noir'];

export function paletteById(id) {
  return PALETTES[id] || PALETTES.sunset;
}
