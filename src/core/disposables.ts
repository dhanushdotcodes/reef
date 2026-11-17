import type * as THREE from 'three'

/** Tracks GPU resources so the whole game can be torn down in one call. */
export type Disposables = {
  geometry: <T extends THREE.BufferGeometry>(geometry: T) => T
  material: <T extends THREE.Material>(material: T) => T
  adopt: (geometries: THREE.BufferGeometry[], materials: THREE.Material[]) => void
  disposeAll: () => void
}

export function createDisposables(): Disposables {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  return {
    geometry(geometry) {
      geometries.push(geometry)
      return geometry
    },
    material(material) {
      materials.push(material)
      return material
    },
    adopt(newGeometries, newMaterials) {
      geometries.push(...newGeometries)
      materials.push(...newMaterials)
    },
    disposeAll() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      geometries.length = 0
      materials.length = 0
    },
  }
}
