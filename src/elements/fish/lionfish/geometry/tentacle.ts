import * as THREE from 'three'
import { PAINT, RIG, steps, taperedTube, type Part } from './builder'

const WHITE = new THREE.Color(1, 1, 1)

/**
 * SUPRAORBITAL TENTACLE — the long, fleshy, banded antenna above each eye that
 * gives Pterois antennata its name. A tapered tube along a gentle S-curve; the
 * shader sways it with a delayed, spring-like motion that grows toward the tip
 * (rig w = 0 at the base, 1 at the tip).
 */
export function buildTentacle(part: Part, base: THREE.Vector3, side: 1 | -1, k: number, radial: number, segs: number) {
  const pts = [
    [0, 0, 0],
    [0.015, 0.1, 0.012],
    [-0.035, 0.2, 0.035],
    [0.005, 0.3, 0.05],
    [-0.02, 0.37, 0.055],
  ].map(([x, y, z]) => new THREE.Vector3(x * k, y * k, z * k * side).add(base))
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const pivot = base.clone()
  taperedTube(part, curve, steps(segs), 0.017 * k, 0.004 * k, radial, (t) => ({
    pivot,
    rig: [RIG.TENTACLE, side, t, 0],
    paint: [PAINT.RAY, t * curve.getLength(), 24 / k],
    color: WHITE,
  }))
}

/**
 * FLESHY TABS — small leaf-like flaps on the jaw and cheek. A flattened
 * ellipsoid whose long axis points along `dir`; sways a little like a tentacle.
 */
export function buildTab(part: Part, at: THREE.Vector3, dir: THREE.Vector3, size: number) {
  const g = new THREE.SphereGeometry(1, 6, 4)
  g.scale(size * 0.45, size, size * 0.18)
  g.translate(0, size * 0.8, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  g.applyQuaternion(q)
  g.translate(at.x, at.y, at.z)
  const pos = g.attributes.position as THREE.BufferAttribute
  const start = part.count
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = THREE.MathUtils.clamp(v.distanceTo(at) / (size * 1.8), 0, 1)
    part.vert(v, at, [RIG.TENTACLE, 0, t * 0.5, 0], [PAINT.RAY, t * size * 1.8, 1.3 / size], WHITE)
  }
  const idx = g.index!
  for (let i = 0; i < idx.count; i += 3) part.tri(start + idx.getX(i), start + idx.getX(i + 1), start + idx.getX(i + 2))
  g.dispose()
}
