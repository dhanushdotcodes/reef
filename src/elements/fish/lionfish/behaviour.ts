import type { BehaviourConfig } from '../shared/FishSim'
import { SCENE_LENGTH } from './params'

/**
 * Lionfish temperament: slow, solitary hoverers that patrol rock and coral,
 * herd prey against structure with fins fanned out, and stand their ground
 * (spines toward the threat) instead of fleeing. They only bolt when the cursor
 * almost touches them or swipes past fast.
 */
export const LIONFISH_BEHAVIOUR: BehaviourConfig = {
  length: SCENE_LENGTH,
  cruiseSpeed: 0.38,
  maxSpeed: 0.85,
  fleeSpeed: 2.4,
  accel: 1.3,
  turnRate: 1.5,
  separation: 1.5,
  threatRadius: 1.7,
  fleeRadius: 0.5,
  threatResponse: 'display',
  interestRadius: 7,
  interactEvery: [3, 10],
  lingerTime: [4, 9],
  pauseChance: 0.55,
  preferredY: [1.2, 4.5],
}
