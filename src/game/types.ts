import type * as THREE from 'three'
import type { Species } from '../entities/fish/types.ts'
import type { FishKind } from './species.ts'

export type Swimmer = {
  kind: FishKind
  species: Species
  phase: number
  height: number
  speed: number
  bob: number
  position: THREE.Vector3
  yaw: number
  /** 0 = starving, 1 = full. Fish only earn while fed. */
  fed: number
}

export type Food = { object: THREE.Mesh; age: number }

export type CoralPlot = { group: THREE.Group }

export type GameState = {
  swimmers: Swimmer[]
  food: Food[]
  coral: CoralPlot[]
  foodCooldown: number
}
