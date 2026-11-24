import { Spring } from '../shared/spring'
import type { PoseHint } from '../shared/FishSim'

export type LionfishState = 'idle' | 'hover' | 'defend' | 'swim' | 'hunt' | 'forage'

interface PoseTarget {
  /** pectoral fans: 0 folded along the body .. 1 fully fanned */
  flare: number
  /** dorsal spines: 0 folded back .. 1 fully erect */
  erect: number
  /** swim effort: drives body wave + fin flutter amplitude */
  swim: number
  /** mouth gape 0..1 */
  gape: number
  /** head pitch (rad, negative = head down), for standalone use; the sim pitches in-scene fish */
  pitch: number
}

/**
 * Body language per state. Lionfish mostly hover with fins half-spread; when
 * threatened they fan everything out and point their spines at the threat.
 */
export const POSES: Record<LionfishState, PoseTarget> = {
  idle: { flare: 0.35, erect: 0.6, swim: 0.15, gape: 0, pitch: 0 },
  hover: { flare: 0.68, erect: 0.8, swim: 0.3, gape: 0, pitch: 0 },
  swim: { flare: 0.3, erect: 0.65, swim: 1, gape: 0, pitch: 0 },
  hunt: { flare: 1, erect: 0.9, swim: 0.45, gape: 0.15, pitch: -0.1 },
  forage: { flare: 0.55, erect: 0.75, swim: 0.3, gape: 0.35, pitch: -0.5 },
  defend: { flare: 1, erect: 1, swim: 0.2, gape: 0.2, pitch: -0.38 },
}

export const hintToState = (h: PoseHint): LionfishState =>
  h === 'flee' ? 'swim' : h

/**
 * Per-fish animation state. Every channel is a critically damped spring, so
 * switching states blends smoothly with no overshoot and no linear lerps.
 */
export class LionfishPose {
  state: LionfishState = 'hover'
  flare = new Spring(0.6, 3)
  erect = new Spring(0.8, 3)
  swim = new Spring(0.3, 2.5)
  gape = new Spring(0, 5)
  pitch = new Spring(0, 2.5)
  /** threat direction in fish space: side (-1..1, +right) and ahead (0..1) */
  tiltSide = new Spring(0, 3)
  tiltFwd = new Spring(0, 3)

  /**
   * @param threat optional unit vector toward the threat in fish space (+X head, +Z right)
   * @param flareOverride optional forced flare (lil-gui `pectoralFlare`)
   */
  setState(state: LionfishState, threat?: { x: number; y: number; z: number }, flareOverride?: number) {
    this.state = state
    const t = POSES[state]
    const alarmed = state === 'defend'
    // flaring up in defence is fast and dramatic; relaxing is slow
    const w = alarmed ? 7 : 2.6
    this.flare.omega = this.erect.omega = w
    this.flare.target = flareOverride ?? t.flare
    this.erect.target = t.erect
    this.swim.target = t.swim
    this.gape.target = t.gape
    this.pitch.target = t.pitch
    this.tiltSide.target = alarmed && threat ? Math.max(-1, Math.min(1, threat.z * 1.5)) : 0
    this.tiltFwd.target = alarmed && threat ? Math.max(0, threat.x) : 0
  }

  step(dt: number) {
    this.flare.step(dt)
    this.erect.step(dt)
    this.swim.step(dt)
    this.gape.step(dt)
    this.pitch.step(dt)
    this.tiltSide.step(dt)
    this.tiltFwd.step(dt)
  }
}
