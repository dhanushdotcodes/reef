import { useMemo } from 'react'
import * as THREE from 'three'
import { TERRAIN, COLORS } from '../config'
import { sandHeight } from '../utils/terrain'
import { applyCaustics } from '../shaders/caustics.glsl'
import { applySand } from '../shaders/sand.glsl'
import { useQuality } from '../utils/quality'

export const SEABED_NAME = 'seabed'

export function Seabed() {
  const tier = useQuality((s) => s.tier)
  const geometry = useMemo(() => {
    const seg = tier === 0 ? 120 : TERRAIN.segments
    const g = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setY(i, sandHeight(pos.getX(i), pos.getZ(i)))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [tier])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 0.95, metalness: 0 })
    applySand(m)
    applyCaustics(m, { intensity: 0.45 })
    return m
  }, [])

  return (
    <mesh name={SEABED_NAME} geometry={geometry} material={material} receiveShadow />
  )
}
