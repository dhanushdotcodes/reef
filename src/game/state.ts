import type { GameState } from './types.ts'

export function createState(): GameState {
  return {
    swimmers: [],
    food: [],
    coral: [],
    rays: [],
    foodCooldown: 0,
  }
}
