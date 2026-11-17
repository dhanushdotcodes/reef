/** Tunable constants. Pure data: imports nothing. */

export const COLORS = {
  /** Blue Water palette, surface to deep. */
  water: {
    foam: '#D6F4FB',
    shallow: '#4DCAEA',
    mid: '#149BC6',
    deep: '#115B80',
    abyss: '#061F32',
  },
  rock: '#1b4a66',
  coral: ['#ff6b6b', '#ff8c5a', '#f25ca2', '#f4a259', '#ef6c8a'],
} as const

export const VIEW = {
  minWidth: 16,
  minHeight: 8,
  cameraZ: 16,
  swimMargin: 1.5,
  topMargin: 0.8,
  floor: 0.85,
} as const

/** X positions of the coral clusters. */
export const CORAL_PLOTS = [-6.4, -3.8, -1.3, 1.2, 3.9, 6.3] as const

export const REEF = {
  // feeding
  maxFood: 6,
  foodCooldown: 0.25,
  foodLifetime: 25,
  foodSinkSpeed: 0.7,
  foodFeed: 0.4,
  eatRadius: 0.55,
  fedDecayPerSecond: 1 / 70,
  hungerThreshold: 0.85,
  startingFed: 0.7,
} as const
