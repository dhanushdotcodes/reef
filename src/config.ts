/** All tunable numbers live here. */

export const COLORS = {
  bgBottom: '#02233a',
  bgMid: '#064a63',
  bgTop: '#0a6b8a',
  fog: '#064a63',
  sand: '#d9c7a0',
  causticTint: '#bff6ff',
  hemiSky: '#9fe8ff',
  hemiGround: '#2b3a2f',
  sun: '#bff4ff',
  coral: ['#ff6f61', '#ff9ecd', '#ffb347', '#b57edc', '#4fd1c5'],
  ghost: '#5fe9ff',
  invalid: '#ff4d5e',
} as const

export const TERRAIN = {
  size: 40,
  segments: 200,
  flatRadius: 12,
  /** placement/pan bound (half-extent) */
  bound: 15,
} as const

export const CAMERA = {
  fov: 45,
  start: [0, 6, 14] as const,
  minPolar: 0.35,
  maxPolar: 1.35,
  minDistance: 6,
  maxDistance: 24,
  idleSeconds: 5,
} as const

export const WATER = {
  fogDensity: 0.045,
  rays: 7,
}

export const CAUSTICS = { intensity: 0.35, scale: 0.16 }

export const PARTICLES = { count: 600, countLow: 250 }

export const EFFECTS = {
  bloomThreshold: 0.7,
  bloomIntensity: 0.6,
  vignetteDarkness: 0.6,
  chromatic: 0.0006,
}

export const SPAWN = { duration: 1.2 }

export const AUDIO = {
  master: 0.7,
  lowpass: 3500,
  throttleMs: 60,
}

export const FISH_BOUNDS = { xz: 15, yMin: 0.5, yMax: 7 }
export const STARTER_SEED = 20251
