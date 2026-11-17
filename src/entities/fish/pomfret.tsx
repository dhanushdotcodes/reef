import * as THREE from 'three'
import { createFishRig } from './parts.ts'
import type { Species } from './types.ts'

const profile: Array<[number, number]> = [
  [-0.3, 0.05],
  [-0.14, 0.26],
  [0.02, 0.36],
  [0.16, 0.3],
  [0.3, 0.12],
  [0.38, 0],
]

export function createPomfret(): Species {
  const { group, rig, geometries, materials, standard, add, body, fin, pivot, trackGeo } =
    createFishRig()
  group.name = 'pomfret'

  const silver = standard({
    color: '#d5dee6',
    roughness: 0.28,
    metalness: 0.62,
  })
  const finMaterial = standard({
    color: '#e4d2a4',
    roughness: 0.48,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  })
  const dark = standard({ color: '#1c242b', roughness: 0.35 })
  const highlight = standard({ color: '#f7fbff', roughness: 0.25 })

  add(new THREE.Mesh(body(profile, 1.22, 0.42), silver))
  group.scale.setScalar(1.45)

  const dorsal = pivot(-0.02, 0.28)
  add(new THREE.Mesh(fin(keelShape(1)), finMaterial), dorsal, false)
  const anal = pivot(-0.02, -0.28)
  add(new THREE.Mesh(fin(keelShape(-1)), finMaterial), anal, false)

  const tail = pivot(-0.24)
  add(new THREE.Mesh(fin(forkShape()), finMaterial), tail, false)

  const pectoralGeometry = fin(pectoralShape(), 0.02)
  for (const side of [-1, 1]) {
    const pec = pivot(0.12, -0.02, 0.1 * side)
    const mesh = add(new THREE.Mesh(pectoralGeometry, finMaterial), pec, false)
    mesh.rotation.y = side * 0.7
  }

  for (const side of [-1, 1]) {
    const eye = add(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 16, 12)), dark))
    eye.position.set(0.24, 0.08, 0.09 * side)
    const glint = add(
      new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.01, 10, 8)), highlight),
      rig,
      false,
    )
    glint.position.set(0.255, 0.09, 0.1 * side)
  }

  return {
    group,
    geometries,
    materials,
    update(time) {
      rig.rotation.z = Math.sin(time * 1.1) * 0.035
      tail.rotation.y = Math.sin(time * 3.2) * 0.16
      dorsal.rotation.z = Math.sin(time * 2.2) * 0.04
      anal.rotation.z = Math.sin(time * 2.2 + 0.5) * 0.04
    },
  }
}

function keelShape(sign: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0.2, 0.06 * sign)
  shape.quadraticCurveTo(0.04, 0.28 * sign, -0.2, 0.16 * sign)
  shape.quadraticCurveTo(-0.04, 0.05 * sign, 0.16, 0.02 * sign)
  return shape
}

function forkShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.04)
  shape.lineTo(-0.24, 0.2)
  shape.lineTo(-0.16, 0.03)
  shape.lineTo(-0.24, -0.2)
  shape.lineTo(0, -0.04)
  return shape
}

function pectoralShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(0.1, 0.08, 0.2, 0.01)
  shape.quadraticCurveTo(0.1, -0.06, 0, 0)
  return shape
}
