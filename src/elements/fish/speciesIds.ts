/**
 * Fish species ids, in variant order: a placed fish's `variant` indexes this list.
 * Kept free of imports so the element registry can read the species count without
 * pulling in React components (which would create an import cycle via the store).
 *
 * To add a species: add its id here, create `fish/<id>/` with a School + Ghost
 * component, and register it in `species.ts`.
 */
export const FISH_SPECIES_IDS = ['lionfish'] as const
export type FishSpeciesId = (typeof FISH_SPECIES_IDS)[number]

export const speciesIdOf = (variant: number): FishSpeciesId =>
  FISH_SPECIES_IDS[((variant % FISH_SPECIES_IDS.length) + FISH_SPECIES_IDS.length) % FISH_SPECIES_IDS.length]
