import * as THREE from 'three'
import { createFishRig } from './parts.ts'
import type { Species } from './types.ts'

const profile: Array<[number, number]> = [
  [-0.36, 0.045],
  [-0.2, 0.14],
  [0.02, 0.2],
  [0.18, 0.17],
  [0.32, 0.09],
  [0.4, 0],
]

const heightScale = 1.08
const thicknessScale = 0.8

export function createClownfish(): Species {
  const { group, rig, geometries, materials, standard, add, body, fin, pivot, trackGeo } =
    createFishRig()
  group.name = 'clownfish'

  const orange = standard({ color: '#ff6a12', roughness: 0.4, metalness: 0.04 })
  const white = standard({
    color: '#f6f7f4',
    roughness: 0.32,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const black = standard({ color: '#161616', roughness: 0.5 })
  const finMaterial = standard({
    color: '#ff7d2e',
    roughness: 0.45,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const finEdge = standard({ color: '#141414', roughness: 0.5, side: THREE.DoubleSide })

  add(new THREE.Mesh(body(profile, heightScale, thicknessScale), orange))

  const whiteRing = trackGeo(new THREE.TorusGeometry(1, 0.1, 12, 36))
  const blackRing = trackGeo(new THREE.TorusGeometry(1, 0.18, 12, 36))
  for (const x of [0.16, -0.02, -0.22]) stripe(x)

  group.scale.setScalar(1.25)

  const tail = pivot(-0.3)
  const fan = fanShape()
  const tailEdge = add(new THREE.Mesh(fin(fan, 0.02), finEdge), tail, false)
  tailEdge.scale.set(1.12, 1.12, 1)
  add(new THREE.Mesh(fin(fan, 0.028), finMaterial), tail, false)

  const dorsal = pivot(-0.02, 0.16)
  const dorsalEdge = add(new THREE.Mesh(fin(dorsalShape(), 0.018), finEdge), dorsal, false)
  dorsalEdge.scale.set(1.08, 1.08, 1)
  add(new THREE.Mesh(fin(dorsalShape(), 0.024), finMaterial), dorsal, false)

  const pectoralGeometry = fin(pectoralShape(), 0.016)
  for (const side of [-1, 1]) {
    const pec = pivot(0.08, -0.02, 0.12 * side)
    const mesh = add(new THREE.Mesh(pectoralGeometry, finMaterial), pec, false)
    mesh.rotation.y = side * 0.8
  }

  for (const side of [-1, 1]) {
    const eye = add(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 16, 12)), black))
    eye.position.set(0.26, 0.05, 0.11 * side)
    const glint = add(
      new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 10, 8)), white),
      rig,
      false,
    )
    glint.position.set(0.28, 0.062, 0.125 * side)
  }

  return {
    group,
    geometries,
    materials,
    update(time) {
      rig.rotation.z = Math.sin(time * 2.2) * 0.05
      tail.rotation.y = Math.sin(time * 7) * 0.38
      dorsal.rotation.z = Math.sin(time * 5) * 0.08
    },
  }

  function stripe(x: number) {
    const { ry, rz } = slice(x)
    const depth = (ry + rz) * 0.5
    const outline = add(new THREE.Mesh(blackRing, black))
    outline.rotation.y = Math.PI / 2
    outline.scale.set(rz, ry, depth)
    outline.position.x = x

    const band = add(new THREE.Mesh(whiteRing, white))
    band.rotation.y = Math.PI / 2
    band.scale.set(rz * 0.97, ry * 0.97, depth)
    band.position.x = x
  }
}

function slice(x: number) {
  let radius = profile[0][1]
  for (let i = 0; i < profile.length - 1; i++) {
    const [x0, r0] = profile[i]
    const [x1, r1] = profile[i + 1]
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0)
      radius = r0 + (r1 - r0) * t
      break
    }
  }
  return { ry: radius * heightScale, rz: radius * thicknessScale }
}

function fanShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-0.06, 0.16, -0.22, 0.2, -0.28, 0.06)
  shape.quadraticCurveTo(-0.2, 0, -0.28, -0.06)
  shape.bezierCurveTo(-0.22, -0.2, -0.06, -0.16, 0, 0)
  return shape
}

function dorsalShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.12, 0)
  shape.quadraticCurveTo(0.04, 0.12, -0.12, 0.08)
  shape.quadraticCurveTo(-0.02, 0.02, 0.1, 0)
  return shape
}

function pectoralShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(0.08, 0.07, 0.14, 0.01)
  shape.quadraticCurveTo(0.07, -0.05, 0, 0)
  return shape
}
