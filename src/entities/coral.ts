import * as THREE from 'three'
import { COLORS } from '../config.ts'
import type { Disposables } from '../core/disposables.ts'
import { rand } from '../core/math.ts'
import type { CoralPlot } from '../game/types.ts'

export function createCoralFactory(scene: THREE.Scene, disposables: Disposables) {
  return (x: number): CoralPlot => {
    const group = new THREE.Group()
    const colors = COLORS.coral
    const stalks = 4 + Math.floor(Math.random() * 4)

    for (let i = 0; i < stalks; i++) {
      const height = rand(0.55, 1.9)
      const stalk = new THREE.Mesh(
        disposables.geometry(new THREE.ConeGeometry(rand(0.1, 0.26), height, 6)),
        disposables.material(
          new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.72 }),
        ),
      )
      stalk.position.set(rand(-0.275, 0.275), height / 2, 0)
      stalk.rotation.z = rand(-0.125, 0.125)
      group.add(stalk)
    }

    const brain = new THREE.Mesh(
      disposables.geometry(new THREE.IcosahedronGeometry(rand(0.28, 0.46), 1)),
      disposables.material(
        new THREE.MeshStandardMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          roughness: 0.55,
        }),
      ),
    )
    brain.position.y = 0.22
    brain.scale.y = 0.65
    group.add(brain)

    group.position.set(x, 0, -0.6)
    scene.add(group)
    return { group }
  }
}
