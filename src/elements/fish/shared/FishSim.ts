import * as THREE from 'three'
import { FISH_BOUNDS } from '../../../config'
import { sandHeight } from '../../../utils/terrain'
import { mulberry32 } from '../../../utils/random'
import type { FishEnv, Prop } from './obstacles'
import { distanceToPointer, pointerThreat } from './pointerThreat'

/**
 * Species-agnostic fish brain. Each species supplies a BehaviourConfig and turns
 * the agent's `pose` hint into its own body language (a lionfish flares its
 * fins, a damselfish would just dart).
 *
 * Modes:
 *   wander  - cruise along a slowly turning heading
 *   pause   - hover in place for a while
 *   visit   - swim to a nearby non-fish element
 *   linger  - interact with that element (kind-specific, see `lingerAt`)
 *   defend  - the cursor is near: face it and hold ground (or flee, per species)
 *   flee    - burst away from a fast/close cursor
 */

export type FishMode = 'wander' | 'pause' | 'visit' | 'linger' | 'defend' | 'flee'
/** What the body should look like; species map this to their own poses. */
export type PoseHint = 'swim' | 'hover' | 'idle' | 'hunt' | 'defend' | 'forage' | 'flee'

export interface BehaviourConfig {
  /** body length in scene units at scale 1 (for clearances) */
  length: number
  cruiseSpeed: number
  maxSpeed: number
  fleeSpeed: number
  /** how quickly velocity follows the desired velocity (1/s) */
  accel: number
  /** max yaw rate (rad/s) */
  turnRate: number
  /** personal space between fish of this species */
  separation: number
  /** cursor distance that triggers a reaction */
  threatRadius: number
  /** cursor distance that always triggers flight */
  fleeRadius: number
  /** 'display' holds ground and shows off (lionfish); 'flee' just darts away */
  threatResponse: 'display' | 'flee'
  /** how far a fish will look for an element to visit */
  interestRadius: number
  interactEvery: [number, number]
  lingerTime: [number, number]
  /** chance that a wander leg ends in a hover pause */
  pauseChance: number
  preferredY: [number, number]
}

export type FishEvent = { type: 'bubbles' | 'sand'; position: [number, number, number] }

const TAU = Math.PI * 2
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const desired = new THREE.Vector3()
const force = new THREE.Vector3()

export class FishAgent {
  readonly id: string
  readonly rng: () => number
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  yaw = 0
  pitch = 0
  roll = 0
  /** extra pitch requested by the current behaviour (negative = head down) */
  posePitch = 0
  pose: PoseHint = 'swim'

  mode: FishMode = 'wander'
  modeT = 0
  modeDur = 0
  wanderYaw = 0
  cruiseY = 2
  nextInteract = 0
  target: Prop | null = null
  anchor = new THREE.Vector3()
  face: THREE.Vector3 | null = null
  readonly faceVec = new THREE.Vector3()
  orbit = 0
  orbitDir = 1
  strikeAt = 0
  boost = 0

  threat = new THREE.Vector3()
  /** seconds since the cursor was last within threatRadius */
  threatAge = 99
  /** threat direction in the fish's local frame (x fwd, z right), for spine tilt */
  threatLocal = new THREE.Vector3()

  /** cosmetic per-individual randomness: size ±15%, hue shift, animation phase */
  readonly sizeJitter: number
  readonly hue: number
  readonly phase: number
  scale: number
  createdAt: number

  constructor(id: string, seed: number, x: number, y: number, z: number, scale: number, createdAt: number, t: number, cfg: BehaviourConfig) {
    this.id = id
    this.rng = mulberry32(seed ^ 0x9e3779b9)
    const r = this.rng
    this.sizeJitter = 1 + (r() - 0.5) * 0.3
    this.hue = (r() - 0.5) * 0.09
    this.phase = r() * 100
    this.scale = scale * this.sizeJitter
    this.createdAt = createdAt
    this.pos.set(x, y, z)
    // random spawn: random heading, a little startled dart, random first plan
    this.yaw = r() * TAU
    this.wanderYaw = this.yaw
    const sp = cfg.cruiseSpeed * (1.5 + r() * 2)
    this.vel.set(Math.cos(this.yaw) * sp, (r() - 0.3) * sp * 0.4, -Math.sin(this.yaw) * sp)
    this.boost = 1
    this.cruiseY = THREE.MathUtils.clamp(y, cfg.preferredY[0], cfg.preferredY[1])
    this.modeDur = 2 + r() * 4
    this.nextInteract = t + 1.5 + r() * 6
  }

  setMode(mode: FishMode, dur: number) {
    this.mode = mode
    this.modeT = 0
    this.modeDur = dur
  }
}

/** One school per species. Plain objects, no allocation per frame. */
export class FishSim {
  readonly cfg: BehaviourConfig
  agents: FishAgent[] = []
  private index = new Map<string, FishAgent>()
  events: FishEvent[] = []

  constructor(cfg: BehaviourConfig) {
    this.cfg = cfg
  }

  get(id: string) { return this.index.get(id) }

  add(agent: FishAgent) {
    if (this.index.has(agent.id)) return
    this.agents.push(agent)
    this.index.set(agent.id, agent)
  }

  remove(id: string) {
    const a = this.index.get(id)
    if (!a) return
    this.index.delete(id)
    this.agents.splice(this.agents.indexOf(a), 1)
  }

  step(dt: number, t: number, env: FishEnv) {
    for (const a of this.agents) this.stepAgent(a, dt, t, env)
  }

  private rand(a: FishAgent, [lo, hi]: [number, number]) {
    return lo + (hi - lo) * a.rng()
  }

  private stepAgent(a: FishAgent, dt: number, t: number, env: FishEnv) {
    const cfg = this.cfg
    const r = a.rng
    a.modeT += dt
    a.threatAge += dt
    a.face = null
    a.posePitch = 0

    // --- 1. senses: the cursor -------------------------------------------------
    if (pointerThreat.active) {
      const d = distanceToPointer(a.pos, tmp)
      const reach = cfg.threatRadius * Math.max(0.8, a.scale)
      if (d < reach) {
        a.threatAge = 0
        // The threat sits on the cursor ray, pulled back toward the camera, so a
        // cursor resting right on a fish reads as "someone in front of me" and the
        // fish turns to face the viewer instead of an undefined point inside itself.
        a.threat.copy(tmp).addScaledVector(pointerThreat.ray.direction, -reach * 0.6)
        // only a swipe startles; a slow approach gets the display (or flight, per species)
        const sp = pointerThreat.speed
        const startled = (sp > 2.5 && d < reach * 0.6) || (sp > 1.2 && d < cfg.fleeRadius)
        if ((cfg.threatResponse === 'flee' || startled) && a.mode !== 'flee') {
          a.setMode('flee', 0.9 + r() * 0.6)
          a.boost = 1
        } else if (a.mode !== 'flee' && a.mode !== 'defend') {
          a.setMode('defend', 0)
        }
      }
    }

    // --- 2. behaviour -> desired velocity ---------------------------------------
    desired.set(0, 0, 0)
    let speedCap = cfg.maxSpeed
    let ignore: Prop | null = null

    switch (a.mode) {
      case 'wander': {
        a.pose = 'swim'
        a.wanderYaw += (Math.sin(t * 0.31 + a.phase) * 0.5 + (r() - 0.5) * 0.6) * dt
        desired.set(Math.cos(a.wanderYaw), 0, -Math.sin(a.wanderYaw)).multiplyScalar(cfg.cruiseSpeed)
        desired.y = THREE.MathUtils.clamp((a.cruiseY - a.pos.y) * 0.6, -0.3, 0.3)
        if (a.modeT > a.modeDur) {
          if (r() < cfg.pauseChance) a.setMode('pause', 2.5 + r() * 5)
          else a.setMode('wander', 3 + r() * 5)
          a.cruiseY = this.rand(a, cfg.preferredY)
        }
        if (t > a.nextInteract) this.pickTarget(a, t, env)
        break
      }
      case 'pause': {
        a.pose = 'hover'
        desired.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw)).multiplyScalar(0.03)
        if (a.modeT > a.modeDur) {
          a.wanderYaw = a.yaw + (r() - 0.5) * 2.5
          a.setMode('wander', 3 + r() * 5)
        }
        if (t > a.nextInteract) this.pickTarget(a, t, env)
        break
      }
      case 'visit': {
        a.pose = 'swim'
        const p = a.target && env.byId.get(a.target.id)
        if (!p) { this.release(a, t); break }
        a.target = p
        ignore = p
        this.planAnchor(a, p, 0)
        this.arrive(a, a.anchor, cfg.cruiseSpeed * 1.4, desired)
        if (a.pos.distanceTo(a.anchor) < 0.3 + 0.2 * a.scale) {
          a.setMode('linger', this.rand(a, cfg.lingerTime) * (p.kind === 'bubbles' ? 1.4 : 1))
          a.strikeAt = 1 + r() * 2.5
          if (p.kind === 'shell') this.events.push({ type: 'sand', position: [p.x, p.y + 0.05, p.z] })
        } else if (a.modeT > 14) this.release(a, t)
        break
      }
      case 'linger': {
        const p = a.target && env.byId.get(a.target.id)
        if (!p) { this.release(a, t); break }
        a.target = p
        ignore = p
        speedCap = this.lingerAt(a, p, dt, desired)
        if (a.modeT > a.modeDur) this.release(a, t)
        break
      }
      case 'defend': {
        // Hold ground facing the threat, backing off slowly. A lionfish points its
        // spines at whatever bothers it rather than running.
        a.pose = 'defend'
        a.face = a.faceVec.copy(a.threat)
        tmp.subVectors(a.pos, a.threat)
        tmp.y *= 0.3
        desired.copy(tmp.normalize()).multiplyScalar(cfg.cruiseSpeed * 0.35)
        a.posePitch = -0.3
        if (a.threatAge > 1.4) {
          a.setMode('pause', 1.5 + r() * 2)
          a.nextInteract = Math.max(a.nextInteract, t + 2)
        }
        break
      }
      case 'flee': {
        a.pose = 'flee'
        tmp.subVectors(a.pos, a.threat)
        tmp.y = Math.abs(tmp.y) * 0.3 + 0.15
        desired.copy(tmp.normalize()).multiplyScalar(cfg.fleeSpeed)
        speedCap = cfg.fleeSpeed
        if (a.modeT > a.modeDur) {
          a.wanderYaw = Math.atan2(-a.vel.z, a.vel.x)
          a.setMode(a.threatAge < 0.5 ? 'defend' : 'pause', 2 + r() * 2)
        }
        break
      }
    }

    // --- 3. steering forces ----------------------------------------------------
    force.set(0, 0, 0)
    const B = FISH_BOUNDS.xz - 1.5
    const { x, y, z } = a.pos
    if (x > B) force.x -= (x - B) * 1.5; else if (x < -B) force.x -= (x + B) * 1.5
    if (z > B) force.z -= (z - B) * 1.5; else if (z < -B) force.z -= (z + B) * 1.5
    if (y > FISH_BOUNDS.yMax) force.y -= (y - FISH_BOUNDS.yMax) * 2
    const floor = Math.max(FISH_BOUNDS.yMin, sandHeight(x, z) + 0.35 * a.scale)
    if (y < floor) force.y += (floor - y) * 8

    for (const o of env.props) {
      if (o === ignore || y > o.top + 0.5) continue
      const dx = x - o.x, dz = z - o.z
      const rr = o.r + 0.4 + cfg.length * 0.5 * a.scale
      const d2 = dx * dx + dz * dz
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.01
        const push = (1 - d / rr) * 6
        force.x += (dx / d) * push
        force.z += (dz / d) * push
        if (y < o.top) force.y += push * 0.3
      }
    }

    const sep = cfg.separation
    for (const b of this.agents) {
      if (b === a) continue
      tmp.subVectors(a.pos, b.pos)
      const d2 = tmp.lengthSq()
      if (d2 > sep * sep || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      force.addScaledVector(tmp, ((1 - d / sep) * 1.5) / d)
    }

    // --- 4. integrate ------------------------------------------------------------
    a.boost = Math.max(0, a.boost - dt * 0.9)
    const k = Math.min(1, cfg.accel * (1 + a.boost * 2) * dt)
    a.vel.lerp(desired, k).addScaledVector(force, dt)
    const max = speedCap * (1 + a.boost * 0.8)
    const s = a.vel.length()
    if (s > max) a.vel.multiplyScalar(max / s)
    a.pos.addScaledVector(a.vel, dt)

    // --- 5. orientation ------------------------------------------------------------
    const hs = Math.hypot(a.vel.x, a.vel.z)
    let wantYaw = a.yaw
    if (a.face) wantYaw = Math.atan2(-(a.face.z - a.pos.z), a.face.x - a.pos.x)
    else if (hs > 0.05) wantYaw = Math.atan2(-a.vel.z, a.vel.x)
    const dy = wrapAngle(wantYaw - a.yaw)
    const turn = cfg.turnRate * (1 + a.boost * 2) * dt
    const step = THREE.MathUtils.clamp(dy, -turn, turn)
    a.yaw = wrapAngle(a.yaw + step)
    const yawRate = step / Math.max(dt, 1e-4)
    a.roll += (THREE.MathUtils.clamp(-yawRate * 0.25, -0.35, 0.35) - a.roll) * Math.min(1, dt * 3)
    const travelPitch = hs + Math.abs(a.vel.y) > 0.08 ? THREE.MathUtils.clamp(Math.atan2(a.vel.y, hs) * 0.8, -0.45, 0.45) : 0
    a.pitch += (travelPitch + a.posePitch - a.pitch) * Math.min(1, dt * 2.5)

    // threat in local space (+x head, +z right side) for spine tilt
    tmp2.subVectors(a.threat, a.pos)
    const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw)
    a.threatLocal.set(tmp2.x * cy - tmp2.z * sy, tmp2.y, tmp2.x * sy + tmp2.z * cy).normalize()
  }

  /** Pick a random nearby non-fish element to go and interact with. */
  private pickTarget(a: FishAgent, t: number, env: FishEnv) {
    const cfg = this.cfg
    a.nextInteract = t + this.rand(a, cfg.interactEvery)
    let pick: Prop | null = null
    let wsum = 0
    for (const p of env.props) {
      const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z)
      if (d > cfg.interestRadius) continue
      // closer things are more interesting; reservoir-sample by weight
      // prefer spots no other fish is already visiting
      const taken = this.agents.some((b) => b !== a && b.target?.id === p.id)
      const w = (taken ? 0.15 : 1) / (0.5 + d)
      wsum += w
      if (a.rng() * wsum < w) pick = p
    }
    if (!pick) return
    a.target = pick
    a.orbit = Math.atan2(a.pos.z - pick.z, a.pos.x - pick.x)
    a.orbitDir = a.rng() < 0.5 ? -1 : 1
    a.setMode('visit', 0)
  }

  private release(a: FishAgent, t: number) {
    a.target = null
    a.wanderYaw = a.yaw + (a.rng() - 0.5) * 2
    a.nextInteract = t + this.rand(a, this.cfg.interactEvery)
    a.setMode('wander', 2 + a.rng() * 4)
  }

  /** Where to be relative to a prop. `phase` animates orbits / rising. */
  private planAnchor(a: FishAgent, p: Prop, phase: number) {
    const standoff = p.r + 0.35 + this.cfg.length * 0.45 * a.scale
    const ox = Math.cos(a.orbit), oz = Math.sin(a.orbit)
    const h = p.top - p.y
    switch (p.kind) {
      case 'coral': // hover just above the coral head, looking down into it
        a.anchor.set(p.x + ox * p.r * 0.6, p.top + 0.35 * a.scale, p.z + oz * p.r * 0.6)
        break
      case 'shell': // nose down at the sand next to the shell
        a.anchor.set(p.x + ox * (0.35 + 0.3 * a.scale), p.y + 0.3 * a.scale, p.z + oz * (0.35 + 0.3 * a.scale))
        break
      case 'chest': // hover at the lid, peeking in
        a.anchor.set(p.x + ox * standoff * 0.8, p.top + 0.15, p.z + oz * standoff * 0.8)
        break
      case 'bubbles': // ride the bubble column up
        a.anchor.set(p.x, p.top + 0.3 + phase, p.z)
        break
      case 'kelp':
        a.anchor.set(p.x + ox * standoff, p.y + h * (0.3 + 0.25 * Math.sin(a.phase)), p.z + oz * standoff)
        break
      default: // rock / wall: patrol its flank at mid height (lionfish herd prey against rock)
        a.anchor.set(p.x + ox * standoff, p.y + Math.min(h * 0.55, 2.5), p.z + oz * standoff)
    }
    const floor = sandHeight(a.anchor.x, a.anchor.z) + 0.3 * a.scale
    if (a.anchor.y < floor) a.anchor.y = floor
  }

  /** Kind-specific interaction. Writes desired velocity, returns a speed cap. */
  private lingerAt(a: FishAgent, p: Prop, dt: number, out: THREE.Vector3): number {
    const cfg = this.cfg
    const T = a.modeT
    a.face = a.faceVec.set(p.x, (p.y + p.top) * 0.5, p.z)
    switch (p.kind) {
      case 'kelp': {
        // slow weave around the stalk
        a.face = null
        a.pose = 'swim'
        a.orbit += a.orbitDir * dt * (0.25 + 0.15 / Math.max(0.6, p.scale))
        this.planAnchor(a, p, 0)
        this.arrive(a, a.anchor, cfg.cruiseSpeed, out)
        return cfg.cruiseSpeed * 1.2
      }
      case 'bubbles': {
        // drift up with the bubbles, spinning lazily, then swim off
        a.face = null
        a.pose = 'idle'
        this.planAnchor(a, p, T * 0.45)
        this.arrive(a, a.anchor, 0.6, out)
        out.x += Math.sin(T * 2.3 + a.phase) * 0.12
        out.z += Math.cos(T * 1.9 + a.phase) * 0.12
        a.yaw += dt * 0.5 * a.orbitDir
        if (a.anchor.y > FISH_BOUNDS.yMax - 0.5) a.modeT = a.modeDur
        return 0.7
      }
      case 'shell':
        a.pose = 'forage'
        a.posePitch = -0.55
        a.face = a.faceVec.set(p.x, p.y, p.z)
        break
      case 'coral':
        a.pose = 'hover'
        a.posePitch = -0.3
        break
      case 'chest':
        a.pose = 'hover'
        a.posePitch = -0.25
        break
      default:
        a.pose = 'hunt'
    }
    // hold station with a little drift; now and then strike at "prey"
    this.planAnchor(a, p, 0)
    this.arrive(a, a.anchor, 0.25, out)
    out.y += Math.sin(T * 0.9 + a.phase) * 0.04
    if (T > a.strikeAt && p.kind !== 'shell') {
      a.strikeAt = T + 2.5 + a.rng() * 4
      tmp.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw))
      a.vel.addScaledVector(tmp, 0.9)
      a.boost = 0.5
      const s = a.scale * this.cfg.length * 0.5
      this.events.push({ type: 'bubbles', position: [a.pos.x + tmp.x * s, a.pos.y + 0.05, a.pos.z + tmp.z * s] })
    }
    return 0.5
  }

  private arrive(a: FishAgent, target: THREE.Vector3, speed: number, out: THREE.Vector3) {
    out.subVectors(target, a.pos)
    const d = out.length()
    if (d < 1e-4) return out.set(0, 0, 0)
    return out.multiplyScalar((Math.min(speed, d * 0.8) / d))
  }
}
