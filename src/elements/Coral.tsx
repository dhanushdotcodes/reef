import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { PlacedElement } from '../types'
import { COLORS, SPAWN } from '../config'
import { memo } from '../utils/cache'
import { applyCaustics } from '../shaders/caustics.glsl'
import { applyCoralShader, type GrowUniform } from '../shaders/coralGrow.glsl'
import { coralGeometry, fanAlphaMap, CORAL_HEIGHT } from './coralGeometry'
import { SpawnGroup } from './SpawnGroup'
import { spawnAge } from './useSpawnAnimation'
import { clamp01, easeOutCubic } from '../utils/easing'

function makeMaterial(color: string, variant: number): { material: THREE.MeshStandardMaterial; uGrow: GrowUniform } {
  const m = new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    side: variant === 2 ? THREE.DoubleSide : THREE.FrontSide,
  })
  if (variant === 2) {
    m.alphaMap = fanAlphaMap()
    m.alphaTest = 0.5
  }
  const uGrow = applyCoralShader(m, CORAL_HEIGHT[variant])
  applyCaustics(m, { intensity: 0.28 })
  const base = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => base() + variant
  return { material: m, uGrow }
}

const sharedMaterial = (color: string, variant: number) =>
  memo(`coralMat:${variant}:${color}`, () => makeMaterial(color, variant).material)

export function Coral({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const color = el.color ?? COLORS.coral[0]
  const geometry = useMemo(() => coralGeometry(el.variant, el.seed), [el.variant, el.seed])
  const shared = sharedMaterial(color, el.variant)
  const mesh = useRef<THREE.Mesh>(null)
  // Growth runs on a throwaway material so the shared one is never touched.
  const grow = useMemo(
    () => {
      if (ghost || spawnAge(el.createdAt) >= SPAWN.duration) return null
      const g = makeMaterial(color, el.variant)
      g.uGrow.value = 0
      return g
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => () => grow?.material.dispose(), [grow])

  useFrame(() => {
    if (!grow || !mesh.current || mesh.current.material === shared) return
    const t = spawnAge(el.createdAt)
    if (t >= SPAWN.duration) {
      mesh.current.material = shared
      return
    }
    // reveal front climbs bottom -> top over 1.1s
    grow.uGrow.value = easeOutCubic(clamp01(t / 1.1)) * 1.02 + 0.0
  })

  return (
    <SpawnGroup el={el} profile="grow" ghost={ghost}>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={grow?.material ?? shared}
        castShadow
        receiveShadow
        scale={[1.6, 1.1, 1.2][el.variant % 3]}
      />
    </SpawnGroup>
  )
}
