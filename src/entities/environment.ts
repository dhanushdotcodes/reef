import * as THREE from 'three'
import { COLORS } from '../config.ts'
import type { Viewport } from '../core/viewport.ts'

export type Environment = { update: (time: number) => void }

/** Scene lighting. Static except for a drifting caustic light. */
export function createEnvironment(
  scene: THREE.Scene,
  viewport: Viewport,
): Environment {
  scene.add(new THREE.HemisphereLight(COLORS.water.foam, COLORS.water.deep, 1.8))

  const sun = new THREE.DirectionalLight('#fff4dc', 2.2)
  sun.position.set(2, 8, 10)
  scene.add(sun)

  const caustic = new THREE.PointLight('#7ef0d4', 18, 20, 2)
  caustic.position.set(0, 4, 6)
  scene.add(caustic)

  return {
    update(time) {
      caustic.position.x = Math.sin(time * 0.6) * viewport.bounds.swimHalf * 0.4
    },
  }
}
