import { useFrame } from '@react-three/fiber'
import { sharedTime } from '../shaders/caustics.glsl'

/** Writes the one shared time uniform used by all patched materials. */
export function TimeDriver() {
  useFrame((s) => {
    sharedTime.value = s.clock.elapsedTime
  })
  return null
}
