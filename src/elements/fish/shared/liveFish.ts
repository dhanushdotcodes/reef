import type { FishSim } from './FishSim'

/** Every mounted school registers its sim here (used for right-click removal picking). */
export const liveSims = new Set<FishSim>()
