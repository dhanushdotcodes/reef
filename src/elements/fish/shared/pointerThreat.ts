import * as THREE from 'three'

/**
 * The cursor as fish perceive it: a world-space ray from the camera through the
 * pointer. Fish measure their distance to this ray, so hovering "over" a fish at
 * any depth counts as being near it. Updated once per frame by FishLayer.
 */
export interface PointerThreat {
  ray: THREE.Ray
  /** pointer is over the canvas and moved recently */
  active: boolean
  /** pointer speed in NDC units / second (screen widths ≈ 2) */
  speed: number
}

export const pointerThreat: PointerThreat = { ray: new THREE.Ray(), active: false, speed: 0 }

/** Closest point on the pointer ray to `p` (written into `out`); returns the distance. */
export function distanceToPointer(p: THREE.Vector3, out: THREE.Vector3): number {
  const { ray } = pointerThreat
  const t = Math.max(0, out.subVectors(p, ray.origin).dot(ray.direction))
  out.copy(ray.direction).multiplyScalar(t).add(ray.origin)
  return out.distanceTo(p)
}
