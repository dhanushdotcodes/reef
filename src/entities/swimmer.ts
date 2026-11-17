import * as THREE from 'three'
import { REEF } from '../config.ts'
import type { Disposables } from '../core/disposables.ts'
import { clamp, rand } from '../core/math.ts'
import type { Bounds } from '../core/viewport.ts'
import { SPECIES, type FishKind } from '../game/species.ts'
import type { Swimmer } from '../game/types.ts'
import { FISH_FACTORIES } from './fish/registry.ts'

export function createSwimmerFactory(scene: THREE.Scene, disposables: Disposables) {
  return (kind: FishKind, bounds: Bounds): Swimmer => {
    const spec = SPECIES[kind]
    const species = FISH_FACTORIES[kind]()
    disposables.adopt(species.geometries, species.materials)

    const phase = rand(0, Math.PI * 2)
    const height = clamp(spec.height + rand(-0.35, 0.35), bounds.floor + 0.3, bounds.waterTop - 0.3)
    const yaw = Math.cos(phase) >= 0 ? 0 : Math.PI
    const position = new THREE.Vector3(Math.sin(phase) * bounds.swimHalf, height, 0)

    species.group.position.copy(position)
    species.group.rotation.y = yaw
    scene.add(species.group)

    return {
      kind,
      species,
      phase,
      height,
      speed: spec.speed * rand(0.9, 1.1),
      bob: spec.bob,
      position,
      yaw,
      fed: REEF.startingFed,
    }
  }
}
