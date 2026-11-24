import type { ComponentType } from 'react'
import type { PlacedElement } from '../../../types'
import type { FishEnv } from './obstacles'
import type { FishSpeciesId } from '../speciesIds'

export interface SchoolProps {
  /** placed fish of this species */
  fish: PlacedElement[]
  /** world as fish see it (props to avoid/visit); updated in place by FishLayer */
  env: { current: FishEnv }
}

export interface FishSpecies {
  id: FishSpeciesId
  label: string
  /** renders and simulates every fish of this species */
  School: ComponentType<SchoolProps>
  /** single fish shown while dragging from the toolbar */
  Ghost: ComponentType<{ el: PlacedElement }>
}
