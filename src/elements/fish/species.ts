import type { FishSpecies } from './shared/types'
import type { FishSpeciesId } from './speciesIds'
import { speciesIdOf } from './speciesIds'
import { LionfishGhost, LionfishSchool } from './lionfish/LionfishSchool'

/** Every fish species, keyed by id. Each lives in its own folder under fish/. */
export const FISH_SPECIES: Record<FishSpeciesId, FishSpecies> = {
  lionfish: { id: 'lionfish', label: 'Spotfin Lionfish', School: LionfishSchool, Ghost: LionfishGhost },
}

export const speciesOf = (variant: number) => FISH_SPECIES[speciesIdOf(variant)]
