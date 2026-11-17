import * as THREE from 'three'
import { COLORS } from '../config.ts'
import type { Disposables } from '../core/disposables.ts'
import type { Viewport } from '../core/viewport.ts'

export type Environment = { update: (time: number) => void }

/** Lights and rocks. Static except for a drifting caustic light. */
export function createEnvironment(
  scene: THREE.Scene,
  disposables: Disposables,
  viewport: Viewport,
): Environment {
  scene.add(new THREE.HemisphereLight(COLORS.water.foam, COLORS.water.deep, 1.8))

  const sun = new THREE.DirectionalLight('#fff4dc', 2.2)
  sun.position.set(2, 8, 10)
  scene.add(sun)

  const caustic = new THREE.PointLight('#7ef0d4', 18, 20, 2)
  caustic.position.set(0, 4, 6)
  scene.add(caustic)

  const rockMaterial = disposables.material(
    new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 0.95 }),
  )
  const rockGeometry = disposables.geometry(new THREE.DodecahedronGeometry(0.45, 0))
  for (const x of [-5.2, -0.2, 5.1]) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial)
    rock.position.set(x, 0.28, -0.45)
    rock.scale.y = 0.55
    scene.add(rock)
  }

  return {
    update(time) {
      caustic.position.x = Math.sin(time * 0.6) * viewport.bounds.swimHalf * 0.4
    },
  }
}
