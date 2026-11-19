import type { Vec3 } from '../types'

/** Mutable per-frame pointer/placement state. Kept outside React: it changes every frame. */
export const placement = {
  clientX: 0,
  clientY: 0,
  pointerType: 'mouse',
  overUI: false,
  hasPoint: false,
  point: [0, 0, 0] as Vec3,
  valid: false,
}
