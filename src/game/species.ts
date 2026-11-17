/** Fish catalog data. Pure data (no three.js). */

export type FishKind = 'clownfish' | 'pomfret' | 'fighter'

export type SpeciesSpec = {
  /** Swimming lane: average height, sweep speed, vertical bob. */
  height: number
  speed: number
  bob: number
}

export const SPECIES: Record<FishKind, SpeciesSpec> = {
  clownfish: { height: 1.7, speed: 0.55, bob: 0.18 },
  pomfret: { height: 3.1, speed: 0.32, bob: 0.08 },
  fighter: { height: 4.6, speed: 0.72, bob: 0.22 },
}

export const FISH_KINDS = Object.keys(SPECIES) as FishKind[]
