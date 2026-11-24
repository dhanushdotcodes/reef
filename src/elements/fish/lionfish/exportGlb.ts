import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { PartRange } from './geometry/builder'
import type { LionfishAssets } from './lionfish'
import type { LionfishUniforms } from './shaders/materials'

/*
 * GLB export: LOD0 in its rest pose (fins flared, spines erect) with the
 * procedural bands and spots baked into vertex colours. Each anatomy part is a
 * named mesh, so the file is easy to refine in Blender.
 * The baking mirrors shaders/banding.glsl.ts and spots.glsl.ts on the CPU.
 */

const fract = (x: number) => x - Math.floor(x)
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  let fx = x - ix, fy = y - iy
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy
}

function bake(g: THREE.BufferGeometry, u: LionfishUniforms): Float32Array {
  const pos = g.attributes.position, paint = g.attributes.aPaint, col = g.attributes.color
  const out = new Float32Array(pos.count * 4)
  const red = u.uBandRed.value, white = u.uBandWhite.value, spotC = u.uSpotColor.value, tint = u.uFinTint.value
  const c = new THREE.Color(), tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const mode = Math.round(paint.getX(i)), pa = paint.getY(i), pb = paint.getZ(i)
    const y = pos.getY(i)
    let alpha = 1
    if (mode === 0) {
      const x = pa + 0.6 * pa * pa
      const wob = u.uBandWobble.value * ((noise(y * 5, pa * 9) - 0.5) * 0.9 + Math.sin(y * 7 + pa * 11) * 0.25)
      const f = fract((x * u.uBandCount.value) / 1.6 + wob * 0.5)
      const d = Math.abs(f - 0.5)
      c.copy(red)
      if (0.5 - d < 0.035) c.multiplyScalar(0.55)
      if (d < 0.12) c.copy(white)
      c.lerp(tmp.copy(white).multiplyScalar(0.96), smooth(-0.12, -0.36, y) * 0.45)
    } else if (mode === 1) {
      c.copy(fract(pa * pb) > 0.5 ? white : red)
    } else if (mode >= 3) {
      const big = mode === 3
      const rowStep = big ? 0.12 : 0.05
      const cx = big ? pa : pa * 2, cy = pb / rowStep
      const ix = Math.floor(cx), iy = Math.floor(cy)
      const jx = (hash(ix, iy) - 0.5) * 0.22, jy = (hash(ix + 17, iy + 17) - 0.5) * 0.22
      const rad = (big ? 0.3 : 0.26) * (0.75 + 0.5 * hash(ix + 3.1, iy + 3.1))
      const d = Math.hypot(fract(cx) - 0.5 - jx, fract(cy) - 0.5 - jy)
      const spot = d < rad && pb > 0.04
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).multiply(tint)
      if (spot) c.copy(spotC)
      alpha = spot ? 0.93 : 0.6
    } else {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i))
    }
    out.set([c.r, c.g, c.b, alpha], i * 4)
  }
  return out
}

/** Copy one part (index range) into a compact standalone geometry. */
function extract(g: THREE.BufferGeometry, colors: Float32Array, part: PartRange) {
  const index = g.index!
  const remap = new Map<number, number>()
  const idx: number[] = []
  for (let i = part.start; i < part.start + part.count; i++) {
    const v = index.getX(i)
    if (!remap.has(v)) remap.set(v, remap.size)
    idx.push(remap.get(v)!)
  }
  const n = remap.size
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 4)
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv
  for (const [src, dst] of remap) {
    pos.set([P.getX(src), P.getY(src), P.getZ(src)], dst * 3)
    nrm.set([N.getX(src), N.getY(src), N.getZ(src)], dst * 3)
    uv.set([U.getX(src), U.getY(src)], dst * 2)
    col.set(colors.subarray(src * 4, src * 4 + 4), dst * 4)
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setAttribute('color', new THREE.BufferAttribute(col, 4))
  out.setIndex(idx)
  return out
}

export async function exportLionfishGlb(assets: LionfishAssets, filename = 'spotfin-lionfish.glb') {
  const lod = assets.lods[0]
  const root = new THREE.Group()
  root.name = 'SpotfinLionfish'
  const mats = {
    body: new THREE.MeshPhysicalMaterial({ name: 'body', vertexColors: true, roughness: 0.48, clearcoat: 0.7, clearcoatRoughness: 0.28 }),
    fins: new THREE.MeshStandardMaterial({ name: 'finRays', vertexColors: true, roughness: 0.55 }),
    membranes: new THREE.MeshStandardMaterial({ name: 'finMembrane', vertexColors: true, roughness: 0.7, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  }
  const made: THREE.BufferGeometry[] = []
  for (const key of ['body', 'fins', 'membranes'] as const) {
    const g = lod[key]
    const colors = bake(g, assets.uniforms)
    const bucket = new THREE.Group()
    bucket.name = key
    for (const part of g.userData.parts as PartRange[]) {
      const sub = extract(g, colors, part)
      made.push(sub)
      const mesh = new THREE.Mesh(sub, mats[key])
      mesh.name = part.name
      bucket.add(mesh)
    }
    root.add(bucket)
  }
  try {
    const glb = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer
    const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } finally {
    made.forEach((g) => g.dispose())
    Object.values(mats).forEach((m) => m.dispose())
  }
}
