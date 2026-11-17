import * as THREE from 'three'
import { createFishRig } from './parts.ts'
import type { Species } from './types.ts'

const profile: Array<[number, number]> = [
  [-0.46, 0.02],
  [-0.28, 0.07],
  [-0.06, 0.11],
  [0.16, 0.12],
  [0.34, 0.08],
  [0.48, 0],
]

export function createFighter(): Species {
  const { group, rig, geometries, materials, standard, add, body, fin, pivot, trackGeo } =
    createFishRig()
  group.name = 'fighter'

  const bodyMaterial = standard({ color: '#d0122d', roughness: 0.38, metalness: 0.06 })
  const finMaterial = standard({
    color: '#e4304a',
    roughness: 0.46,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const rimMaterial = standard({
    color: '#243f9c',
    roughness: 0.42,
    side: THREE.DoubleSide,
  })
  const dark = standard({ color: '#1a120f', roughness: 0.4 })
  const highlight = standard({ color: '#fff4ea', roughness: 0.3 })

  const torso = add(new THREE.Mesh(body(profile, 1.12, 0.86), bodyMaterial))
  torso.scale.y = 1.08

  const tail = pivot(-0.34)
  const veil = veilShape()
  const rim = add(new THREE.Mesh(fin(veil, 0.02), rimMaterial), tail, false)
  rim.scale.set(1.08, 1.08, 1)
  add(new THREE.Mesh(fin(veil, 0.028), finMaterial), tail, false)

  const dorsal = pivot(0.02, 0.08)
  add(new THREE.Mesh(fin(dorsalShape(), 0.02), rimMaterial), dorsal, false).scale.set(1.06, 1.06, 1)
  add(new THREE.Mesh(fin(dorsalShape(), 0.026), finMaterial), dorsal, false)

  const anal = pivot(0.0, -0.07)
  add(new THREE.Mesh(fin(analShape(), 0.02), rimMaterial), anal, false).scale.set(1.06, 1.06, 1)
  add(new THREE.Mesh(fin(analShape(), 0.026), finMaterial), anal, false)

  const pelvicGeometry = fin(pelvicShape(), 0.018)
  for (const side of [-1, 1]) {
    const pelvic = pivot(0.12, -0.05, 0.05 * side)
    const mesh = add(new THREE.Mesh(pelvicGeometry, finMaterial), pelvic, false)
    mesh.rotation.y = side * 0.4
  }

  for (const side of [-1, 1]) {
    const eye = add(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 16, 12)), dark))
    eye.position.set(0.34, 0.045, 0.07 * side)
    const glint = add(
      new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 10, 8)), highlight),
      rig,
      false,
    )
    glint.position.set(0.36, 0.058, 0.082 * side)
  }

  return {
    group,
    geometries,
    materials,
    update(time) {
      const flow = Math.sin(time * 2.4)
      rig.rotation.z = Math.sin(time * 1.6) * 0.08
      tail.rotation.y = flow * 0.42
      tail.rotation.z = Math.sin(time * 1.8) * 0.06
      dorsal.rotation.z = Math.sin(time * 2.1 + 0.4) * 0.16
      anal.rotation.z = Math.sin(time * 2.1 + 1.1) * 0.14
    },
  }
}

function veilShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.05)
  shape.bezierCurveTo(-0.22, 0.42, -0.62, 0.5, -0.74, 0.1)
  shape.quadraticCurveTo(-0.52, 0, -0.72, -0.3)
  shape.bezierCurveTo(-0.56, -0.54, -0.18, -0.34, 0, -0.06)
  return shape
}

function dorsalShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.16, 0.02)
  shape.bezierCurveTo(0.08, 0.32, -0.34, 0.44, -0.58, 0.14)
  shape.quadraticCurveTo(-0.22, 0.08, 0.1, 0)
  return shape
}

function analShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.14, -0.02)
  shape.bezierCurveTo(0.04, -0.34, -0.4, -0.46, -0.62, -0.12)
  shape.quadraticCurveTo(-0.24, -0.06, 0.08, 0)
  return shape
}

function pelvicShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.04, -0.14, -0.08, -0.32, -0.02, -0.36)
  shape.bezierCurveTo(-0.12, -0.18, -0.05, -0.04, 0, 0)
  return shape
}
