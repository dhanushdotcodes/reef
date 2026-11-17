import * as THREE from 'three'
import { REEF } from '../config.ts'
import { angleDelta, clamp, damp } from '../core/math.ts'
import { nearestFood } from '../game/selectors.ts'
import type { System } from './types.ts'

const target = new THREE.Vector3()

/** Hunger, steering toward food (or the cruise lane), and syncing the fish meshes. */
export const updateSwimmers: System = ({ state, bounds }, dt, time) => {
  for (const swimmer of state.swimmers) {
    swimmer.fed = Math.max(0, swimmer.fed - REEF.fedDecayPerSecond * dt)

    const angle = time * swimmer.speed + swimmer.phase
    const food =
      swimmer.fed < REEF.hungerThreshold ? nearestFood(state, swimmer.position) : undefined

    if (food) {
      target.copy(food.object.position)
    } else {
      target.set(
        Math.sin(angle) * bounds.swimHalf,
        swimmer.height + Math.sin(time * 1.5 + swimmer.phase) * swimmer.bob,
        0,
      )
    }
    target.x = clamp(target.x, -bounds.swimHalf - 0.4, bounds.swimHalf + 0.4)
    target.y = clamp(target.y, bounds.floor, bounds.waterTop)

    const dx = target.x - swimmer.position.x
    const cruiseYaw = Math.cos(angle) >= 0 ? 0 : Math.PI
    const desiredYaw = food && Math.abs(dx) > 0.04 ? (dx > 0 ? 0 : Math.PI) : cruiseYaw
    swimmer.yaw += angleDelta(swimmer.yaw, desiredYaw) * damp(8, dt)

    swimmer.position.lerp(target, damp(food ? 3.2 : 2.4, dt))
    swimmer.position.z = 0

    swimmer.species.update(time)
    swimmer.species.group.position.copy(swimmer.position)
    swimmer.species.group.rotation.set(0, swimmer.yaw, 0)
  }
}
