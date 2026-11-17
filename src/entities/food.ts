import * as THREE from 'three'
import type { Disposables } from '../core/disposables.ts'
import type { Food } from '../game/types.ts'

export function createFoodFactory(scene: THREE.Scene, disposables: Disposables) {
  const geometry = disposables.geometry(new THREE.SphereGeometry(0.09, 10, 8))
  const material = disposables.material(
    new THREE.MeshStandardMaterial({ color: '#d98a3d', emissive: '#6b3b10', roughness: 0.6 }),
  )

  return (x: number, y: number): Food => {
    const object = new THREE.Mesh(geometry, material)
    object.position.set(x, y, 0.05)
    scene.add(object)
    return { object, age: 0 }
  }
}
