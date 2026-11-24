import * as THREE from 'three'
import { sharedTime } from '../../../shaders/caustics.glsl'
import { buildLionfishGeometry, type LionfishGeometry } from './geometry'
import { LODS } from './geometry/lod'
import { DEFAULT_COLORS, DEFAULT_PARAMS, geometryKey, type LionfishColors, type LionfishParams } from './params'
import { LionfishPose, type LionfishState } from './pose'
import { createLionfishMaterials, createLionfishUniforms, syncUniforms, type LionfishMaterials, type LionfishUniforms } from './shaders/materials'

/* ------------------------------------------------------------------------------
 * Assets: geometry for every LOD + the three materials + their uniforms.
 * ---------------------------------------------------------------------------- */

export interface LionfishAssets {
  params: LionfishParams
  lods: LionfishGeometry[]
  materials: LionfishMaterials
  uniforms: LionfishUniforms
  dispose(): void
}

export function buildLionfishAssets(params: LionfishParams, uniforms: LionfishUniforms, ownsMaterials = true): LionfishAssets {
  const lods = LODS.map((_, i) => buildLionfishGeometry(params, i))
  const materials = createLionfishMaterials(uniforms)
  return {
    params,
    lods,
    materials,
    uniforms,
    dispose() {
      for (const l of lods) {
        l.body.dispose()
        l.fins.dispose()
        l.membranes.dispose()
      }
      if (ownsMaterials) materials.dispose()
    },
  }
}

/** Live-tunable state shared by every lionfish in the sandbox (lil-gui edits this). */
export const lionfishTuning = {
  params: { ...DEFAULT_PARAMS },
  colors: { ...DEFAULT_COLORS },
  /** 'auto' lets behaviour drive the pose */
  state: 'auto' as LionfishState | 'auto',
  /** < 0 = automatic */
  pectoralFlare: -1,
  /** -1 = by distance, else force LOD 0/1 */
  lod: -1,
  uniforms: createLionfishUniforms(DEFAULT_PARAMS, DEFAULT_COLORS, sharedTime),
}

let shared: { key: string; assets: LionfishAssets } | null = null

/** Assets for the sandbox, rebuilt (and the old ones freed) when geometry params change. */
export function sharedLionfishAssets(): LionfishAssets {
  const key = geometryKey(lionfishTuning.params)
  if (shared?.key !== key) {
    shared?.assets.dispose()
    shared = { key, assets: buildLionfishAssets({ ...lionfishTuning.params }, lionfishTuning.uniforms) }
  }
  return shared.assets
}

/* ------------------------------------------------------------------------------
 * Instanced renderer: 3 InstancedMeshes per LOD (body / fins / membranes).
 * Per-instance animation lives in iAnim / iAnim2 (see shaders/swim.glsl.ts).
 * ---------------------------------------------------------------------------- */

interface LodSet {
  meshes: THREE.InstancedMesh[]
  geometries: THREE.BufferGeometry[]
  anim: THREE.InstancedBufferAttribute
  anim2: THREE.InstancedBufferAttribute
  count: number
}

/** Wrap a shared geometry so it can carry its own instance attributes. */
function view(base: THREE.BufferGeometry, anim: THREE.InstancedBufferAttribute, anim2: THREE.InstancedBufferAttribute) {
  const g = new THREE.BufferGeometry()
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr)
  g.setIndex(base.index)
  g.setAttribute('iAnim', anim)
  g.setAttribute('iAnim2', anim2)
  g.boundingSphere = base.boundingSphere
  g.userData = base.userData
  return g
}

export class LionfishInstances {
  readonly group = new THREE.Group()
  readonly capacity: number
  private sets: LodSet[]

  constructor(assets: LionfishAssets, capacity: number) {
    this.capacity = capacity
    this.group.name = 'lionfish'
    const { materials } = assets
    this.sets = assets.lods.map((lod, li) => {
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
      const anim2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
      const geometries = [lod.body, lod.fins, lod.membranes].map((g) => view(g, anim, anim2))
      const mats = [materials.body, materials.fins, materials.membranes]
      const names = ['body', 'fins', 'membranes']
      const meshes = geometries.map((g, i) => {
        const m = new THREE.InstancedMesh(g, mats[i], capacity)
        m.name = `lionfish-${names[i]}-lod${li}`
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        m.frustumCulled = false
        m.count = 0
        // translucent fins draw after every opaque part
        m.renderOrder = i === 2 ? 2 : 0
        this.group.add(m)
        return m
      })
      return { meshes, geometries, anim, anim2, count: 0 }
    })
  }

  begin() {
    for (const s of this.sets) s.count = 0
  }

  /**
   * Add one fish. Call in back-to-front order so the translucent membranes of
   * different fish blend correctly.
   */
  add(lod: number, matrix: THREE.Matrix4, anim: THREE.Vector4Like, anim2: THREE.Vector4Like) {
    const s = this.sets[Math.min(lod, this.sets.length - 1)]
    if (s.count >= this.capacity) return
    const i = s.count++
    for (const m of s.meshes) m.setMatrixAt(i, matrix)
    s.anim.setXYZW(i, anim.x, anim.y, anim.z, anim.w)
    s.anim2.setXYZW(i, anim2.x, anim2.y, anim2.z, anim2.w)
  }

  end() {
    for (const s of this.sets) {
      for (const m of s.meshes) {
        m.count = s.count
        m.instanceMatrix.needsUpdate = true
      }
      s.anim.needsUpdate = true
      s.anim2.needsUpdate = true
    }
  }

  /** Draw calls issued for all fish this frame (one per non-empty mesh). */
  get drawCalls() {
    return this.sets.reduce((n, s) => n + (s.count > 0 ? s.meshes.length : 0), 0)
  }

  /** Frees the per-renderer wrapper geometries (shared buffers are owned by the assets). */
  dispose() {
    for (const s of this.sets) {
      for (const m of s.meshes) m.dispose()
      for (const g of s.geometries) g.dispose()
    }
    this.group.clear()
  }
}

/* ------------------------------------------------------------------------------
 * createLionfish: one self-contained animated fish.
 * ---------------------------------------------------------------------------- */

export interface LionfishOptions {
  params?: Partial<LionfishParams>
  colors?: Partial<LionfishColors>
  lod?: 0 | 1
  /** hue shift in turns (±0.05 is subtle) */
  hue?: number
  /** animation phase offset (seconds-ish) */
  phase?: number
  /** use the sandbox's shared assets instead of building private ones */
  shared?: boolean
}

export interface Lionfish {
  group: THREE.Group
  pose: LionfishPose
  update(dt: number, time?: number): void
  setState(state: LionfishState, threatDir?: THREE.Vector3): void
  dispose(): void
}

/**
 * Build one lionfish. `group` is a THREE.Group in model space (+X head, 1 unit =
 * 10 cm); scale/position it as you like. Call `update(dt, time)` every frame.
 *
 *   const fish = createLionfish({ hue: 0.02 })
 *   scene.add(fish.group)
 *   fish.setState('defend', new THREE.Vector3(1, 0, 0.3).normalize())
 *   // per frame: fish.update(dt, clock.elapsedTime)
 *   // later: fish.dispose()
 */
export function createLionfish(opts: LionfishOptions = {}): Lionfish {
  const params = { ...lionfishTuning.params, ...opts.params }
  let assets: LionfishAssets
  let ownsAssets = false
  if (opts.shared) assets = sharedLionfishAssets()
  else {
    const uniforms = createLionfishUniforms(params, { ...lionfishTuning.colors, ...opts.colors }, { value: 0 })
    assets = buildLionfishAssets(params, uniforms)
    ownsAssets = true
  }
  syncUniforms(assets.uniforms, params)

  const inst = new LionfishInstances(assets, 1)
  const pose = new LionfishPose()
  const group = new THREE.Group()
  group.name = 'lionfish'
  group.add(inst.group)
  const phase = opts.phase ?? Math.random() * 100
  const hue = opts.hue ?? 0
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const pos = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const a1 = new THREE.Vector4(), a2 = new THREE.Vector4()
  let clock = 0

  return {
    group,
    pose,
    update(dt, time) {
      clock = time ?? clock + dt
      if (ownsAssets && !opts.shared) assets.uniforms.uTime.value = clock
      pose.step(dt)
      // hover: gentle bob, plus the pose's head pitch
      pos.set(0, Math.sin(clock * 0.9 + phase) * 0.04, 0)
      q.setFromEuler(e.set(0, 0, pose.pitch.x))
      m.compose(pos, q, one)
      a1.set(phase, pose.flare.x, pose.erect.x, pose.swim.x)
      a2.set(hue, pose.tiltSide.x, pose.tiltFwd.x, pose.gape.x)
      inst.begin()
      inst.add(opts.lod ?? 0, m, a1, a2)
      inst.end()
    },
    setState(state, threatDir) {
      pose.setState(state, threatDir)
    },
    dispose() {
      inst.dispose()
      if (ownsAssets) assets.dispose()
    },
  }
}
