import * as THREE from 'three'
import { BODY_FRACTION, PECTORAL, type LionfishParams } from '../params'
import type { BodyFrame } from './body'
import { PAINT, RIG, steps, taperedTube, type Bucket, type Part } from './builder'
import type { LodSpec } from './lod'

/**
 * FINS — every fin is a list of rays (spines or soft rays) plus a membrane
 * stretched between neighbouring rays.
 *
 * A ray leaves the body at `base`, points along `dir` (rest pose) for `len`,
 * and is covered by membrane up to `memLen`. Anything past `memLen` stands free
 * (the needle-like dorsal spines, the white pectoral filaments).
 *
 * The rest pose is the fully erect / fully flared pose. The vertex shader folds
 * fins from it, rotating each vertex about `pivot` by an angle that depends on
 * `s` (0..1 across the fin), so membranes fold smoothly with their rays.
 */
export interface FinRay {
  base: THREE.Vector3
  dir: THREE.Vector3
  len: number
  memLen: number
  pivot: THREE.Vector3
  s: number
  radius: number
}

interface FinStyle {
  name: string
  rig: number
  /** 1 = bend with the body wave at each vertex's own x (caudal fin) */
  bend: number
  radial: number
  segs: number
  /** red/white bands per unit length along each ray */
  bandsPerUnit: number
  /** colour of free ray tips past the membrane */
  filament?: THREE.Color
  /** slight backward curl at the ray tip, as a fraction of length */
  curl?: number
  spots: number
  /** membrane colour from root (q=0) to edge (q=1) */
  memRoot: THREE.Color
  memEdge: THREE.Color
  /** depth of the notch between rays, as a fraction of membrane length */
  notch: number
  cols: number
  rows: number
  /** membrane starts this far up each ray (fraction of memLen) */
  q0?: number
  /** push the membrane off the ray plane along this vector to avoid z-fighting */
  offset?: THREE.Vector3
}

const WHITE = new THREE.Color(1, 1, 1)
const c = (hex: string) => new THREE.Color(hex)

/** Opaque tubes for each ray. */
function buildRays(part: Part, rays: FinRay[], st: FinStyle) {
  const tip = new THREE.Vector3(), mid = new THREE.Vector3()
  for (const ray of rays) {
    tip.copy(ray.base).addScaledVector(ray.dir, ray.len)
    if (st.curl) tip.x -= ray.len * st.curl
    mid.copy(ray.base).addScaledVector(ray.dir, ray.len * 0.55)
    const curve = new THREE.QuadraticBezierCurve3(ray.base.clone(), mid.clone(), tip.clone())
    const memT = ray.memLen / ray.len
    // put a ring exactly where the membrane ends so the filament colour starts cleanly
    const ts =
      memT < 0.98
        ? [...steps(st.segs).map((t) => t * memT), ...steps(Math.max(2, st.segs >> 1)).slice(1).map((t) => memT + t * (1 - memT))]
        : steps(st.segs)
    taperedTube(part, curve, ts, ray.radius, ray.radius * 0.18, st.radial, (t, dist) => {
      const free = st.filament && t > memT + 1e-3
      return {
        pivot: ray.pivot,
        rig: [st.rig, ray.s, dist, st.bend],
        paint: free ? [PAINT.COLOR, dist, 0] : [PAINT.RAY, dist, st.bandsPerUnit],
        color: free ? st.filament! : WHITE,
      }
    })
  }
}

/**
 * Translucent membrane between neighbouring rays, a strip per gap.
 * Its free edge dips between rays (`notch`), giving the deeply incised look.
 */
function buildMembrane(part: Part, rays: FinRay[], st: FinStyle) {
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), pv = new THREE.Vector3()
  const col = new THREE.Color()
  const q0 = st.q0 ?? 0
  for (let i = 0; i < rays.length - 1; i++) {
    const r1 = rays[i], r2 = rays[i + 1]
    const start = part.count
    for (let ci = 0; ci <= st.cols; ci++) {
      const f = ci / st.cols
      const edge = 1 - st.notch * Math.sin(Math.PI * f)
      const s = THREE.MathUtils.lerp(r1.s, r2.s, f)
      pv.lerpVectors(r1.pivot, r2.pivot, f)
      for (let ri = 0; ri <= st.rows; ri++) {
        const q = q0 + (edge - q0) * (ri / st.rows)
        A.copy(r1.base).addScaledVector(r1.dir, r1.memLen * q)
        B.copy(r2.base).addScaledVector(r2.dir, r2.memLen * q)
        P.lerpVectors(A, B, f)
        if (st.offset) P.add(st.offset)
        const dist = q * THREE.MathUtils.lerp(r1.memLen, r2.memLen, f)
        col.lerpColors(st.memRoot, st.memEdge, q)
        part.vert(P, pv, [st.rig, s, dist, st.bend], [st.spots, i + f, dist], col, [s, q])
      }
    }
    const R = st.rows + 1
    for (let ci = 0; ci < st.cols; ci++) {
      for (let ri = 0; ri < st.rows; ri++) {
        const a = start + ci * R + ri
        part.quad(a, a + R, a + R + 1, a + 1)
      }
    }
  }
}

function buildFin(fins: Bucket, membranes: Bucket, rays: FinRay[], st: FinStyle) {
  buildRays(fins.part(st.name + 'Rays'), rays, st)
  buildMembrane(membranes.part(st.name + 'Membrane'), rays, st)
}

/** Unit direction in the XY plane, `lean` radians back from straight up (or down). */
const lean = (a: number, down = false) => new THREE.Vector3(-Math.sin(a), down ? -Math.cos(a) : Math.cos(a), 0)

/**
 * DORSAL FIN, SPINY PART — 13 long venomous spines along the ridge, tallest in
 * the middle (~1.1× body depth), leaning back more toward the tail. Membrane
 * covers only the lower ~40% so the upper spines stand free like needles.
 */
export function buildDorsalSpines(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec) {
  const n = Math.max(3, Math.round(p.spineCount))
  const k = p.length / 2
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const u = THREE.MathUtils.lerp(0.2, 0.56, t)
    const sec = frame.at(u)
    const base = frame.surface(u, 0).addScaledVector(sec.up, -0.012)
    const h = 0.42 + 0.58 * Math.pow(Math.sin((Math.PI * (i + 1)) / (n + 1)), 0.7)
    const len = p.spineHeight * frame.depth * h
    rays.push({ base, dir: lean(THREE.MathUtils.lerp(0.1, 0.62, t)), len, memLen: len * p.membraneCoverage, pivot: base, s: t, radius: 0.02 * k })
  }
  const maxLen = Math.max(...rays.map((r) => r.len))
  buildFin(fins, membranes, rays, {
    name: 'dorsalSpines', rig: RIG.DORSAL, bend: 0, radial: lod.spineRadial, segs: lod.spineSegs,
    bandsPerUnit: 6.5 / maxLen, curl: 0.06, spots: PAINT.SPOTS_SMALL,
    memRoot: c('#b85a44'), memEdge: c('#f0ddd0'), notch: 0.55, cols: lod.memCols + 1, rows: lod.memRows,
  })
}

/** SOFT DORSAL — a rounded fan of thin rays with a full membrane, behind the spines. */
export function buildSoftDorsal(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec) {
  const n = lod.softRays
  const k = p.length / 2
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const u = THREE.MathUtils.lerp(0.6, 0.86, t)
    const base = frame.surface(u, 0).addScaledVector(frame.at(u).up, -0.01)
    const len = frame.depth * 0.5 * (0.55 + 0.45 * Math.sin(Math.PI * (0.18 + 0.75 * t)))
    rays.push({ base, dir: lean(THREE.MathUtils.lerp(0.75, 1.3, t)), len, memLen: len * 0.95, pivot: base, s: t, radius: 0.007 * k })
  }
  buildFin(fins, membranes, rays, {
    name: 'softDorsal', rig: RIG.FLUTTER, bend: 0, radial: lod.rayRadial, segs: lod.raySegs,
    bandsPerUnit: 14, spots: PAINT.SPOTS_SMALL, memRoot: c('#c98a74'), memEdge: c('#f6ece4'),
    notch: 0.08, cols: lod.memCols, rows: lod.memRows,
  })
}

/** ANAL FIN — 3 short stout spines at the front, then rounded soft rays. */
export function buildAnal(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec) {
  const k = p.length / 2
  const nSoft = lod.analRays
  const n = 3 + nSoft
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const u = THREE.MathUtils.lerp(0.58, 0.82, t)
    const base = frame.surface(u, Math.PI).addScaledVector(frame.at(u).up, 0.01)
    const spine = i < 3
    const len = spine
      ? frame.depth * (0.2 + 0.07 * i)
      : frame.depth * 0.46 * (0.6 + 0.4 * Math.sin(Math.PI * (0.2 + 0.7 * ((i - 3) / Math.max(1, nSoft - 1)))))
    rays.push({ base, dir: lean(THREE.MathUtils.lerp(0.35, 1.15, t), true), len, memLen: len * (spine ? 0.85 : 0.95), pivot: base, s: t, radius: (spine ? 0.012 : 0.007) * k })
  }
  buildFin(fins, membranes, rays, {
    name: 'anal', rig: RIG.FLUTTER, bend: 0, radial: lod.rayRadial, segs: lod.raySegs,
    bandsPerUnit: 14, spots: PAINT.SPOTS_SMALL, memRoot: c('#c98a74'), memEdge: c('#f6ece4'),
    notch: 0.08, cols: lod.memCols, rows: lod.memRows,
  })
}

/** CAUDAL FIN — rounded fan from the peduncle, transparent with rows of small spots. */
export function buildCaudal(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec) {
  const k = p.length / 2
  const n = lod.caudalRays
  const sec = frame.at(1)
  const Lc = p.length * (1 - BODY_FRACTION) + 0.04
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1)
    const base = sec.center.clone().addScaledVector(sec.up, (0.5 - s) * 2 * sec.halfH * 0.85)
    base.x += 0.03
    const a = Math.PI - 0.72 + 1.44 * s
    const len = Lc * (0.8 + 0.2 * Math.sin(Math.PI * s))
    rays.push({ base, dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), len, memLen: len * 0.97, pivot: base, s, radius: 0.007 * k })
  }
  buildFin(fins, membranes, rays, {
    name: 'caudal', rig: RIG.FLUTTER, bend: 1, radial: lod.rayRadial, segs: lod.raySegs,
    bandsPerUnit: 14, spots: PAINT.SPOTS_SMALL, memRoot: c('#d0a08a'), memEdge: c('#f6efe8'),
    notch: 0.05, cols: lod.memCols, rows: lod.memRows,
  })
}

/**
 * PECTORAL FINS — the hero feature. Huge wing-like fans behind the gills,
 * ~14 rays each. Upper rays run past the membrane as long white filaments;
 * the membrane carries rows of large dark spots ("spotfin").
 *
 * The rest pose is fully flared. The shader folds it with one `flare` value:
 * rays rotate in the fan plane toward a narrow bundle (PECTORAL.fold*) and the
 * fan yaws back against the flank (PECTORAL.yaw*).
 */
export function buildPectoral(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec, side: 1 | -1) {
  const k = p.length / 2
  const n = lod.pecRays
  const u = 0.3
  const theta = side * 1.72
  const pivot = frame.surface(u, theta).addScaledVector(frame.normal(u, theta), 0.012)
  const yaw = new THREE.Matrix4().makeRotationY(side * PECTORAL.yawFlared)
  const span = PECTORAL.restBottom - PECTORAL.restTop
  // fan radius such that the flared tip-to-tip chord = pectoralSpan × length
  const R = (p.pectoralSpan * p.length) / (2 * Math.sin(span / 2))
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1)
    const a = PECTORAL.restTop + span * s
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyMatrix4(yaw)
    const memLen = R * (0.58 + 0.42 * Math.sin(Math.PI * (0.12 + 0.78 * s)))
    // free filaments: long on the upper rays, short tips elsewhere
    const len = memLen * (1.08 + 0.85 * Math.max(0, 1 - s / 0.45))
    const base = pivot.clone().add(new THREE.Vector3(0, (0.5 - s) * 0.06 * k, 0))
    rays.push({ base, dir, len, memLen, pivot, s, radius: 0.011 * k })
  }
  const normal = new THREE.Vector3(0, 0, side).applyMatrix4(yaw)
  buildFin(fins, membranes, rays, {
    name: side > 0 ? 'pectoralR' : 'pectoralL', rig: RIG.PECTORAL, bend: 0, radial: lod.rayRadial, segs: lod.raySegs,
    bandsPerUnit: 9, filament: c('#fbf3ea'), spots: PAINT.SPOTS_BIG,
    memRoot: c('#c4664c'), memEdge: c('#f5ebe2'), notch: 0.24, cols: lod.memCols, rows: lod.memRows + 2, q0: 0.04,
    offset: normal.multiplyScalar(-0.003),
  })
}

/** PELVIC FINS — small paired banded fans under the chest. */
export function buildPelvic(fins: Bucket, membranes: Bucket, frame: BodyFrame, p: LionfishParams, lod: LodSpec, side: 1 | -1) {
  const k = p.length / 2
  const n = lod.pelvicRays
  const u = 0.34
  const theta = side * (Math.PI - 0.5)
  const pivot = frame.surface(u, theta).addScaledVector(frame.normal(u, theta), -0.01)
  const yaw = new THREE.Matrix4().makeRotationY(side * 0.35)
  const rays: FinRay[] = []
  for (let i = 0; i < n; i++) {
    const s = i / Math.max(1, n - 1)
    const a = THREE.MathUtils.degToRad(205 + 45 * s)
    const len = frame.depth * 0.42 * (0.75 + 0.25 * Math.sin(Math.PI * s))
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyMatrix4(yaw)
    rays.push({ base: pivot.clone(), dir, len, memLen: len * 0.9, pivot, s, radius: 0.008 * k })
  }
  buildFin(fins, membranes, rays, {
    name: side > 0 ? 'pelvicR' : 'pelvicL', rig: RIG.FLUTTER, bend: 0, radial: lod.rayRadial, segs: Math.max(2, lod.raySegs - 2),
    bandsPerUnit: 16, spots: PAINT.SPOTS_SMALL, memRoot: c('#b85a44'), memEdge: c('#efd8c8'),
    notch: 0.15, cols: lod.memCols, rows: lod.memRows,
  })
}
