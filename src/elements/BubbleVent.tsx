import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createNoise3D } from 'simplex-noise'
import type { PlacedElement } from '../types'
import { memo } from '../utils/cache'
import { mulberry32 } from '../utils/random'
import { applyCaustics } from '../shaders/caustics.glsl'
import { fxBus } from '../fx/fxBus'
import { playSound } from '../audio/audioEngine'
import { SpawnGroup } from './SpawnGroup'
import { spawnAge } from './useSpawnAnimation'
import { isLowPower } from '../utils/quality'

const START = 0.9

function ventGeometry(seed: number) {
  return memo(`vent:${seed % 256}`, () => {
    const noise = createNoise3D(mulberry32(seed % 256))
    const g = new THREE.LatheGeometry(
      [[0.01, 0.0], [0.62, 0.0], [0.56, 0.2], [0.4, 0.42], [0.24, 0.5], [0.16, 0.4], [0.12, 0.2], [0.01, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)),
      14,
    )
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const d = 1 + noise(x * 2.5, y * 2.5, z * 2.5) * 0.12
      p.setXYZ(i, x * d, y, z * d)
    }
    g.computeVertexNormals()
    return g
  })
}

const material = memo('ventMat', () => {
  const m = new THREE.MeshStandardMaterial({ color: '#6f6a64', roughness: 0.95, flatShading: true })
  applyCaustics(m)
  return m
})

export function BubbleVent({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const geometry = useMemo(() => ventGeometry(el.seed), [el.seed])
  const acc = useRef(Math.random())
  const pos = useRef<[number, number, number]>([0, 0, 0])
  useFrame((_, dt) => {
    if (ghost || spawnAge(el.createdAt) < START) return
    acc.current += Math.min(dt, 0.1)
    const interval = isLowPower ? 0.22 : 0.13
    if (acc.current < interval) return
    acc.current = 0
    pos.current[0] = el.position[0]
    pos.current[1] = el.position[1] + 0.5 * el.scale
    pos.current[2] = el.position[2]
    fxBus.emit('bubbleBurst', { position: pos.current, count: 1, spread: 0.1 })
    if (Math.random() < 0.18) playSound('bubble', 0.35)
  })
  return (
    <SpawnGroup el={el} profile="drop" ghost={ghost}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </SpawnGroup>
  )
}
