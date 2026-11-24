import * as THREE from 'three'
import type { LionfishParams } from '../params'
import type { BodyFrame } from './body'
import { PAINT, RIG, type Bucket, type Part } from './builder'
import type { LodSpec } from './lod'
import { buildTab, buildTentacle } from './tentacle'

/** Ellipsoid into `part`, with a per-vertex colour from its local unit direction. */
function ellipsoid(
  part: Part,
  center: THREE.Vector3,
  basis: THREE.Matrix4,
  radii: THREE.Vector3,
  [w, h]: [number, number],
  pivot: THREE.Vector3,
  rig: [number, number, number, number],
  color: (d: THREE.Vector3) => THREE.Color,
) {
  const g = new THREE.SphereGeometry(1, w, h)
  const pos = g.attributes.position as THREE.BufferAttribute
  const start = part.count
  const d = new THREE.Vector3(), p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i)
    p.copy(d).multiply(radii).applyMatrix4(basis).add(center)
    part.vert(p, pivot, rig, [PAINT.COLOR, 0, 0], color(d))
  }
  const idx = g.index!
  for (let i = 0; i < idx.count; i += 3) part.tri(start + idx.getX(i), start + idx.getX(i + 1), start + idx.getX(i + 2))
  g.dispose()
}

const PUPIL = new THREE.Color('#0b0706')
const IRIS = new THREE.Color('#d4481c')
const IRIS_RIM = new THREE.Color('#f0a43c')
const EYE_BAND = new THREE.Color('#4a1a10')
const JAW = new THREE.Color('#e9c9b4')
const MOUTH = new THREE.Color('#1c0b0a')

/**
 * HEAD DETAILS
 *  - Eyes: set high on the head; dark pupil, red-orange iris ring, glossy (the
 *    body material's clearcoat). The rest of the eyeball carries the dark band
 *    that runs through a lionfish's eye.
 *  - Lower jaw: separate mesh hinged behind the mouth, slightly downturned; the
 *    shader opens it a little with each breath.
 *  - Mouth interior: a dark blob that shows when the jaw opens.
 *  - Supraorbital tentacles above each eye, plus fleshy tabs on jaw and cheek.
 */
export function buildHead(body: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec) {
  const k = p.length / 2

  // --- eyes -------------------------------------------------------------------
  const eyes = body.part('eyes')
  const tentacles = body.part('tentacles')
  const eyeR = 0.075 * k
  const uEye = 0.1
  for (const side of [1, -1] as const) {
    const theta = side * 0.68
    const n = frame.normal(uEye, theta)
    const center = frame.surface(uEye, theta).addScaledVector(n, -eyeR * 0.45)
    // eye-local frame: +Y looks out along the surface normal
    const basis = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n))
    ellipsoid(eyes, center, basis, new THREE.Vector3(eyeR, eyeR, eyeR), lod.eye, center, [RIG.RIGID, 0, 0, 0], (d) => {
      if (d.y > 0.82) return PUPIL
      if (d.y > 0.56) return IRIS
      if (d.y > 0.48) return IRIS_RIM
      return EYE_BAND
    })
    const tBase = center.clone().add(new THREE.Vector3(0.01 * k, eyeR * 0.85, 0))
    buildTentacle(tentacles, tBase, side, k, lod.tentRadial, lod.tentSegs)
  }

  // --- lower jaw + mouth --------------------------------------------------------
  const snout = frame.at(0.05)
  const jawLen = 0.13 * k
  const jawC = new THREE.Vector3(frame.x0 - jawLen * 0.55, snout.center.y - snout.halfH * 0.8, 0)
  const hinge = new THREE.Vector3(frame.x0 - jawLen * 1.35, jawC.y + 0.02 * k, 0)
  const downturn = new THREE.Matrix4().makeRotationZ(-0.14)
  ellipsoid(body.part('jaw'), jawC, downturn, new THREE.Vector3(jawLen, 0.034 * k, 0.075 * k), [10, 6], hinge, [RIG.JAW, 0, 0, 0], (d) =>
    d.y > 0.3 ? MOUTH : JAW,
  )
  if (lod.tabs) {
    ellipsoid(
      body.part('mouth'),
      new THREE.Vector3(frame.x0 - 0.06 * k, jawC.y + 0.045 * k, 0),
      new THREE.Matrix4(),
      new THREE.Vector3(0.045 * k, 0.025 * k, 0.05 * k),
      [8, 5],
      jawC,
      [RIG.RIGID, 0, 0, 0],
      () => MOUTH,
    )
  }

  // --- fleshy tabs on jaw and cheek ----------------------------------------------
  if (lod.tabs) {
    const tabs = body.part('tabs')
    for (const side of [1, -1] as const) {
      for (const [u, th, size] of [[0.05, 2.35, 0.03], [0.12, 2.2, 0.036], [0.19, 2.05, 0.028], [0.15, 1.45, 0.024]] as const) {
        const theta = side * th
        const at = frame.surface(u, theta)
        const out = frame.normal(u, theta).add(new THREE.Vector3(-0.3, -0.4, 0)).normalize()
        buildTab(tabs, at, out, size * k)
      }
    }
  }
}
