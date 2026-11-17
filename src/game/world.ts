import type * as THREE from 'three'
import type { Bounds } from '../core/viewport.ts'
import type { Spawners } from '../entities/spawners.ts'
import type { GameState } from './types.ts'

/** The single dependency handed to actions and systems. */
export type World = {
  scene: THREE.Scene
  bounds: Bounds
  state: GameState
  spawn: Spawners
}
