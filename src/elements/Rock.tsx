import { useMemo } from 'react'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'
import type { PlacedElement } from '../types'
import { mulberry32 } from '../utils/random'
import { memo } from '../utils/cache'
import { applyCaustics } from '../shaders/caustics.glsl'
import { SpawnGroup } from './SpawnGroup'

const BASE = new THREE.Color('#98a498')
const DARK = new THREE.Color('#6b7a72')
const MOSS = new THREE.Color('#86a05a')

/** Deterministic lumpy rock. Moss tint is baked into vertex colours from face normals. */
export function rockGeometry(seed: number, variant: number): THREE.BufferGeometry {
  return memo(`rock:${variant}:${seed}`, () => {
    const rnd = mulberry32(seed)
    const noise = createNoise3D(mulberry32(seed ^ 0x9e3779b9))
    const g = new THREE.IcosahedronGeometry(1, 3)
    const squashY = [0.7, 0.9, 0.6][variant % 3] * (0.9 + rnd() * 0.2)
    const stretchX = [1, 0.75, 1.25][variant % 3]
    const freq = [1.2, 1.6, 0.9][variant % 3]
    const pos = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = noise(v.x * freq, v.y * freq, v.z * freq) * 0.28 + noise(v.x * 3.1, v.y * 3.1, v.z * 3.1) * 0.08
      v.multiplyScalar(1 + n)
      v.x *= stretchX
      v.y *= squashY
      // flatten the bottom so it sits on the sand
      if (v.y < -0.35) v.y = -0.35 - (-0.35 - v.y) * 0.25
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    const nrm = g.attributes.normal as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const ny = nrm.getY(i)
      const tone = 0.5 + 0.5 * noise(pos.getX(i) * 2, pos.getY(i) * 2, pos.getZ(i) * 2)
      c.copy(DARK).lerp(BASE, tone)
      c.lerp(MOSS, THREE.MathUtils.smoothstep(ny, 0.55, 0.92) * 0.6)
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.translate(0, 0.3, 0)
    g.computeBoundingSphere()
    return g
  })
}

export const rockMaterial = (() => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true })
  applyCaustics(m)
  return m
})()

export function Rock({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const geometry = useMemo(() => rockGeometry(el.seed, el.variant), [el.seed, el.variant])
  return (
    <SpawnGroup el={el} profile="drop" ghost={ghost}>
      <mesh geometry={geometry} material={rockMaterial} castShadow receiveShadow scale={0.85} />
    </SpawnGroup>
  )
}
