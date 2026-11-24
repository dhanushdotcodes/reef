import * as THREE from 'three'
import { BODY_FRACTION, type LionfishParams } from '../params'
import { PAINT, RIG, profile, type Bucket } from './builder'

/**
 * BODY — a loft of elliptical cross-sections along a spine curve.
 *
 * The spine is a CatmullRomCurve3 running from the snout (+X) to the caudal
 * peduncle. Each section is an ellipse whose half-height and half-width come
 * from two 1D profiles over u (0 = snout, 1 = peduncle):
 *   - a big, blunt head that deepens fast,
 *   - the deepest point just behind the gill cover (u ≈ 0.36),
 *   - a long taper to a narrow caudal peduncle.
 * Lionfish are laterally compressed, so width stays ~half the height.
 */

// half-height as a fraction of max half-depth
const HEIGHT = profile([[0, 0.12], [0.04, 0.45], [0.12, 0.74], [0.24, 0.95], [0.36, 1], [0.52, 0.88], [0.7, 0.56], [0.86, 0.3], [1, 0.21]])
// half-width as a fraction of max half-width
const WIDTH = profile([[0, 0.14], [0.04, 0.5], [0.12, 0.8], [0.24, 0.98], [0.34, 1], [0.52, 0.78], [0.7, 0.45], [0.86, 0.24], [1, 0.15]])
// spine-curve height offset (fraction of half-depth): snout dips toward the mouth, back arches
const CENTER_Y = [[0, -0.22], [0.15, 0.02], [0.4, 0.06], [0.7, 0.0], [1, 0.02]] as const

export interface Section {
  u: number
  center: THREE.Vector3
  halfH: number
  halfW: number
  tangent: THREE.Vector3
  up: THREE.Vector3
  /** lateral direction (+Z) */
  side: THREE.Vector3
}

export interface BodyFrame {
  /** body loft length (snout to peduncle) */
  bodyLength: number
  depth: number
  width: number
  /** x of the snout and of the peduncle */
  x0: number
  x1: number
  spine: THREE.CatmullRomCurve3
  at(u: number): Section
  /** point on the surface; theta 0 = dorsal ridge, π/2 = +Z flank, π = belly */
  surface(u: number, theta: number, out?: THREE.Vector3): THREE.Vector3
  /** outward surface normal (ignores the slight longitudinal slope) */
  normal(u: number, theta: number, out?: THREE.Vector3): THREE.Vector3
  /** ~16 evenly spaced cross-section rings: the attachment frame for fins */
  rings: Section[]
}

export function createBodyFrame(p: LionfishParams): BodyFrame {
  const Lb = p.length * BODY_FRACTION
  const depth = p.bodyHeightRatio * Lb
  const width = p.bodyWidthRatio * Lb
  const x0 = p.length / 2
  const x1 = x0 - Lb
  const hd = depth / 2
  const spine = new THREE.CatmullRomCurve3(
    CENTER_Y.map(([u, cy]) => new THREE.Vector3(x0 - u * Lb, cy * hd, 0)),
    false,
    'centripetal',
  )
  // map u -> curve parameter (control points are not evenly spaced in u)
  const us = CENTER_Y.map(([u]) => u)
  const toT = (u: number) => {
    let i = 0
    while (i < us.length - 2 && u > us[i + 1]) i++
    return (i + (u - us[i]) / (us[i + 1] - us[i])) / (us.length - 1)
  }
  const Z = new THREE.Vector3(0, 0, 1)

  const at = (u: number): Section => {
    const t = toT(THREE.MathUtils.clamp(u, 0, 1))
    const center = spine.getPoint(t)
    center.x = x0 - u * Lb // keep x linear in u so band/bend maths can use x directly
    const tangent = spine.getTangent(t).normalize()
    const up = new THREE.Vector3().crossVectors(tangent, Z).normalize()
    return { u, center, halfH: HEIGHT(u) * hd, halfW: WIDTH(u) * (width / 2), tangent, up, side: Z.clone() }
  }

  const surface = (u: number, theta: number, out = new THREE.Vector3()) => {
    const s = at(u)
    return out.copy(s.center).addScaledVector(s.up, Math.cos(theta) * s.halfH).addScaledVector(s.side, Math.sin(theta) * s.halfW)
  }
  const normal = (u: number, theta: number, out = new THREE.Vector3()) => {
    const s = at(u)
    return out.set(0, 0, 0).addScaledVector(s.up, Math.cos(theta) / s.halfH).addScaledVector(s.side, Math.sin(theta) / s.halfW).normalize()
  }
  const rings = Array.from({ length: 16 }, (_, i) => at(i / 15))
  return { bodyLength: Lb, depth, width, x0, x1, spine, at, surface, normal, rings }
}

/** Build the body loft into `bucket`. `sections` ~24-34, `radial` ~12-28. */
export function buildBody(bucket: Bucket, frame: BodyFrame, sections: number, radial: number) {
  const part = bucket.part('body')
  const white = new THREE.Color(1, 1, 1)
  const P = new THREE.Vector3()
  const rig = (u: number): [number, number, number, number] => [RIG.BODY, 0, u, 1]
  const rings: number[] = []
  for (let i = 0; i < sections; i++) {
    // denser sections at the head where the profile changes fastest
    const u = Math.pow(i / (sections - 1), 1.15)
    rings.push(part.count)
    for (let j = 0; j < radial; j++) {
      const theta = (j / radial) * Math.PI * 2
      frame.surface(u, theta, P)
      // v runs 0 (back) -> 1 (belly) on both flanks, so there is no seam
      const v = Math.abs(((theta / Math.PI + 1) % 2) - 1)
      part.vert(P, P, rig(u), [PAINT.BODY, u, 1 - v], white, [u, 1 - v])
    }
  }
  for (let i = 0; i < sections - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial
      // ring i -> i+1 runs toward the tail; theta increases toward +Z: (a,b,c,d) faces out
      part.quad(rings[i] + j, rings[i + 1] + j, rings[i + 1] + j2, rings[i] + j2)
    }
  }
  // snout and tail caps
  const head = frame.at(0).center.clone().add(new THREE.Vector3(0.02, 0, 0))
  const tail = frame.at(1).center.clone().add(new THREE.Vector3(-0.01, 0, 0))
  const hi = part.vert(head, head, rig(0), [PAINT.BODY, 0, 0.5], white, [0, 0.5])
  const ti = part.vert(tail, tail, rig(1), [PAINT.BODY, 1, 0.5], white, [1, 0.5])
  const last = rings[sections - 1]
  for (let j = 0; j < radial; j++) {
    const j2 = (j + 1) % radial
    part.tri(hi, rings[0] + j, rings[0] + j2)
    part.tri(ti, last + j2, last + j)
  }
}
