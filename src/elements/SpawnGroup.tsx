import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import type { PlacedElement } from '../types'
import { useSpawnAnimation, type SpawnProfile } from './useSpawnAnimation'

interface Props {
  el: PlacedElement
  profile: SpawnProfile
  ghost?: boolean
  children: ReactNode
}

/** Outer group = placement transform, inner group = spawn animation. */
export function SpawnGroup({ el, profile, ghost, children }: Props) {
  const inner = useRef<Group>(null)
  useSpawnAnimation(inner, el.createdAt, profile, !ghost)
  return (
    <group position={el.position} rotation-y={el.rotationY} scale={el.scale} userData={{ id: el.id }}>
      <group ref={inner}>{children}</group>
    </group>
  )
}
