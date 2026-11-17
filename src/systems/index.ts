import type { World } from '../game/world.ts'
import { updateFood } from './food.ts'
import { updateRays } from './rays.ts'
import { updateSwimmers } from './swimmers.ts'
import type { System } from './types.ts'

/** Order matters: food is eaten after fish move. */
const pipeline: System[] = [
  updateSwimmers,
  updateFood,
  updateRays,
]

export function runSystems(world: World, dt: number, time: number): void {
  for (const system of pipeline) system(world, dt, time)
}
