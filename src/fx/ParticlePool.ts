import * as THREE from 'three'

const vert = /* glsl */ `
attribute vec4 aColor; attribute float aSize; attribute float aKind;
uniform float uViewH;
varying vec4 vColor; varying float vKind;
void main() {
  vColor = aColor; vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uViewH / -mv.z;
}`
const frag = /* glsl */ `
varying vec4 vColor; varying float vKind;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a;
  if (vKind > 0.5 && vKind < 1.5) {          // bubble: rim + highlight
    a = smoothstep(0.7, 0.95, d) * 0.8 + 0.12;
    a = min(1.0, a + smoothstep(0.28, 0.0, length(c - vec2(-0.14, -0.14))) * 0.7);
  } else if (vKind > 1.5) {                  // sparkle: 4-point star
    float s = max(0.0, 1.0 - abs(c.x) * 9.0) * (1.0 - d) + max(0.0, 1.0 - abs(c.y) * 9.0) * (1.0 - d);
    a = clamp(s * 0.8 + smoothstep(0.3, 0.0, d) * 0.5, 0.0, 1.0);
  } else {                                   // soft puff
    a = smoothstep(1.0, 0.0, d); a *= a;
  }
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`

export const KIND_SOFT = 0
export const KIND_BUBBLE = 1
export const KIND_SPARK = 2

export interface EmitSpec {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  r: number; g: number; b: number; a: number
  size: number
  life: number
  drag: number // per-frame (60fps) velocity multiplier
  gravity: number
  grow: number // size multiplier gained over lifetime
  kind: number
  floorY?: number // clamp (sand)
  wobble?: number
}

/** Fixed-capacity ring-buffer particle system: nothing is allocated during play. One draw call. */
export class ParticlePool {
  readonly points: THREE.Points
  private cap: number
  private head = 0
  private alive = 0
  private pos: Float32Array
  private vel: Float32Array
  private col: Float32Array
  private size: Float32Array
  private kind: Float32Array
  private age: Float32Array
  private life: Float32Array
  private drag: Float32Array
  private grav: Float32Array
  private grow: Float32Array
  private baseA: Float32Array
  private baseSize: Float32Array
  private floor: Float32Array
  private wob: Float32Array
  private geo: THREE.BufferGeometry
  private mat: THREE.ShaderMaterial
  private dirty = false

  constructor(cap: number, additive: boolean) {
    this.cap = cap
    this.pos = new Float32Array(cap * 3)
    this.vel = new Float32Array(cap * 3)
    this.col = new Float32Array(cap * 4)
    this.size = new Float32Array(cap)
    this.kind = new Float32Array(cap)
    this.age = new Float32Array(cap).fill(1e9)
    this.life = new Float32Array(cap).fill(1)
    this.drag = new Float32Array(cap)
    this.grav = new Float32Array(cap)
    this.grow = new Float32Array(cap)
    this.baseA = new Float32Array(cap)
    this.baseSize = new Float32Array(cap)
    this.floor = new Float32Array(cap).fill(-1e9)
    this.wob = new Float32Array(cap)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uViewH: { value: 800 } },
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 8
  }

  emit(s: EmitSpec) {
    const i = this.head
    this.head = (this.head + 1) % this.cap
    this.pos[i * 3] = s.x; this.pos[i * 3 + 1] = s.y; this.pos[i * 3 + 2] = s.z
    this.vel[i * 3] = s.vx; this.vel[i * 3 + 1] = s.vy; this.vel[i * 3 + 2] = s.vz
    this.col[i * 4] = s.r; this.col[i * 4 + 1] = s.g; this.col[i * 4 + 2] = s.b; this.col[i * 4 + 3] = s.a
    this.baseA[i] = s.a
    this.baseSize[i] = s.size
    this.size[i] = s.size
    this.kind[i] = s.kind
    this.age[i] = 0
    this.life[i] = s.life
    this.drag[i] = s.drag
    this.grav[i] = s.gravity
    this.grow[i] = s.grow
    this.floor[i] = s.floorY ?? -1e9
    this.wob[i] = s.wobble ?? 0
    this.alive++
    this.dirty = true
  }

  update(dt: number, viewH: number) {
    this.mat.uniforms.uViewH.value = viewH
    if (!this.alive && !this.dirty) return
    const f60 = dt * 60
    let alive = 0
    for (let i = 0; i < this.cap; i++) {
      const age = this.age[i]
      if (age >= this.life[i]) {
        if (this.size[i] !== 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0 }
        continue
      }
      alive++
      const a = age + dt
      this.age[i] = a
      const u = Math.min(1, a / this.life[i])
      const k = Math.pow(this.drag[i], f60)
      const i3 = i * 3
      this.vel[i3] *= k; this.vel[i3 + 1] *= k; this.vel[i3 + 2] *= k
      this.vel[i3 + 1] += this.grav[i] * dt
      if (this.wob[i]) {
        this.vel[i3] += Math.sin(a * 9 + i) * this.wob[i] * dt
        this.vel[i3 + 2] += Math.cos(a * 8 + i * 1.7) * this.wob[i] * dt
      }
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
      if (this.pos[i3 + 1] < this.floor[i]) { this.pos[i3 + 1] = this.floor[i]; this.vel[i3 + 1] = 0 }
      const fade = this.kind[i] === KIND_SPARK ? (1 - u) * (0.6 + 0.4 * Math.sin(a * 24 + i)) : Math.pow(1 - u, 1.5)
      const alpha = this.baseA[i] * Math.max(0, fade) * Math.min(1, a * 14)
      this.col[i * 4 + 3] = u >= 1 ? 0 : alpha
      this.size[i] = u >= 1 ? 0 : Math.max(0, this.baseSize[i] * (1 + this.grow[i] * u))
    }
    this.alive = alive
    this.dirty = alive > 0
    const g = this.geo.attributes
    g.position.needsUpdate = true
    g.aColor.needsUpdate = true
    g.aSize.needsUpdate = true
    g.aKind.needsUpdate = true
  }
}
