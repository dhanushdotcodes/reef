import type * as THREE from 'three'

export type Species = {
  group: THREE.Group
  update: (time: number) => void
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
}
