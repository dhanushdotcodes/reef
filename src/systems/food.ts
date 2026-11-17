import { REEF } from '../config.ts'
import type { System } from './types.ts'

/** Pellets sink, get eaten by hungry fish, and eventually dissolve. */
export const updateFood: System = ({ state, scene, bounds }, dt) => {
  state.foodCooldown = Math.max(0, state.foodCooldown - dt)

  for (let i = state.food.length - 1; i >= 0; i--) {
    const food = state.food[i]
    if (!food) continue
    food.age += dt
    const position = food.object.position
    position.y = Math.max(bounds.floor, position.y - REEF.foodSinkSpeed * dt)

    const eater = state.swimmers.find(
      (swimmer) =>
        swimmer.fed < REEF.hungerThreshold &&
        Math.hypot(swimmer.position.x - position.x, swimmer.position.y - position.y) <
          REEF.eatRadius,
    )

    if (eater) eater.fed = Math.min(1, eater.fed + REEF.foodFeed)

    if (eater || food.age > REEF.foodLifetime) {
      scene.remove(food.object)
      state.food.splice(i, 1)
    }
  }
}
