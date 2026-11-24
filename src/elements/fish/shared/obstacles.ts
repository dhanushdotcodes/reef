import { REGISTRY } from '../../registry'
import type { ElementKind, PlacedElement } from '../../../types'

/** Approximate heights of grounded elements (at scale 1), used for avoidance and visits. */
export const OBSTACLE_HEIGHT: Record<string, number> = { rock: 1.0, coral: 1.8, kelp: 3.5, wall: 2.2, shell: 0.3, chest: 0.8, bubbles: 0.7 }

/**
 * A non-fish element as fish see it: a vertical cylinder they avoid, and a
 * point of interest they may visit.
 */
export interface Prop {
  id: string
  kind: ElementKind
  x: number
  y: number
  z: number
  /** avoidance radius */
  r: number
  /** world y of the top */
  top: number
  scale: number
}

/** Everything a school needs to know about the world besides its own fish. */
export interface FishEnv {
  props: Prop[]
  byId: Map<string, Prop>
}

export function buildFishEnv(elements: PlacedElement[]): FishEnv {
  const props: Prop[] = []
  for (const e of elements) {
    if (e.kind === 'fish' || !REGISTRY[e.kind].grounded) continue
    props.push({
      id: e.id,
      kind: e.kind,
      x: e.position[0],
      y: e.position[1],
      z: e.position[2],
      r: REGISTRY[e.kind].footprint * e.scale * 0.85,
      top: e.position[1] + (OBSTACLE_HEIGHT[e.kind] ?? 1) * e.scale,
      scale: e.scale,
    })
  }
  return { props, byId: new Map(props.map((p) => [p.id, p])) }
}
