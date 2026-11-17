import { smoothstep } from 'three/src/math/MathUtils.js'
import type { System } from './types.ts'

/** Each beam drifts in and out on two slow, unrelated sine waves, fully fading out at times. */
export const updateRays: System = ({ state }, _dt, time) => {
  for (const ray of state.rays) {
    const wave =
      0.5 +
      0.25 * Math.sin(time * ray.speed[0] + ray.phase[0]) +
      0.25 * Math.sin(time * ray.speed[1] + ray.phase[1])
    ray.material.opacity = ray.maxOpacity * smoothstep(wave, 0.3, 0.85)
    ray.group.rotation.z = ray.tilt + Math.sin(time * 0.05 + ray.phase[0]) * 0.03
  }
}
