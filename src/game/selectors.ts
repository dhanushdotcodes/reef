import type * as THREE from 'three'
import type { Food, GameState } from './types.ts'

/** Average fullness across all fish, 0..1 (1 when there are no fish). */
export const averageFed = (state: GameState): number => {
  if (state.swimmers.length === 0) return 1
  const sum = state.swimmers.reduce((acc, swimmer) => acc + swimmer.fed, 0)
  return sum / state.swimmers.length
}

export const nearestFood = (state: GameState, from: THREE.Vector3): Food | undefined => {
  let best: Food | undefined
  let bestDistance = Infinity
  for (const food of state.food) {
    const distance = food.object.position.distanceToSquared(from)
    if (distance < bestDistance) {
      best = food
      bestDistance = distance
    }
  }
  return best
}
