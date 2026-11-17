import type * as THREE from 'three'
import type { Disposables } from '../core/disposables.ts'
import { createCoralFactory } from './coral.ts'
import { createFoodFactory } from './food.ts'
import { createSwimmerFactory } from './swimmer.ts'

/** Everything that can be added to the scene, bundled so systems/actions take one dependency. */
export type Spawners = ReturnType<typeof createSpawners>

export function createSpawners(scene: THREE.Scene, disposables: Disposables) {
  return {
    swimmer: createSwimmerFactory(scene, disposables),
    food: createFoodFactory(scene, disposables),
    coral: createCoralFactory(scene, disposables),
  }
}
