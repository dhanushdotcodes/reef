import * as THREE from 'three'

export function createFishRig() {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const trackGeo = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry)
    return geometry
  }

  const standard = (params: THREE.MeshStandardMaterialParameters) => {
    const material = new THREE.MeshStandardMaterial(params)
    materials.push(material)
    return material
  }

  const add = (
    mesh: THREE.Mesh,
    parent: THREE.Object3D = rig,
    shadow = true,
  ) => {
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  const body = (points: Array<[number, number]>, height: number, thickness: number) => {
    const geometry = trackGeo(
      new THREE.LatheGeometry(
        points.map(([along, radius]) => new THREE.Vector2(radius, along)),
        24,
      ),
    )
    geometry.rotateZ(-Math.PI / 2)
    geometry.scale(1, height, thickness)
    return geometry
  }

  const fin = (shape: THREE.Shape, depth = 0.03) => {
    const geometry = trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 10,
      }),
    )
    geometry.translate(0, 0, -depth / 2)
    return geometry
  }

  const pivot = (x: number, y = 0, z = 0, parent: THREE.Object3D = rig) => {
    const node = new THREE.Group()
    node.position.set(x, y, z)
    parent.add(node)
    return node
  }

  return { group, rig, geometries, materials, standard, add, body, fin, pivot, trackGeo }
}
