import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { PlacedElement } from '../types'
import { memo } from '../utils/cache'
import { mulberry32 } from '../utils/random'
import { applyCaustics } from '../shaders/caustics.glsl'
import { clamp01, easeOutBack } from '../utils/easing'
import { SpawnGroup } from './SpawnGroup'
import { spawnAge } from './useSpawnAnimation'

const OPEN_AT = 0.8 // seconds after spawn (landing is ~0.4s, lid opens 0.4s later)
const OPEN_ANGLE = 0.5

const wood = memo('chestWood', () => {
  const m = new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 0.85 })
  applyCaustics(m)
  return m
})
const gold = memo('chestGold', () => {
  const m = new THREE.MeshStandardMaterial({ color: '#e8b94a', roughness: 0.35, metalness: 0.4, emissive: '#5a3c00', emissiveIntensity: 0.5 })
  applyCaustics(m, { intensity: 0.2 })
  return m
})
const glow = memo('chestGlow', () => {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc94d').multiplyScalar(2.6), toneMapped: false })
  return m
})

const bodyGeo = memo('chestBody', () => new THREE.BoxGeometry(1, 0.5, 0.68).translate(0, 0.25, 0))
const lidGeo = memo('chestLid', () => {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 1.0, 20, 1, false, 0, Math.PI)
  g.rotateZ(Math.PI / 2)
  g.rotateX(Math.PI / 2) // arch up, long axis along x
  g.translate(0, 0, 0.34)
  return g
})
const bandGeo = memo('chestBand', () => new THREE.BoxGeometry(0.12, 0.54, 0.72).translate(0, 0.25, 0))
const lidBandGeo = memo('chestLidBand', () => {
  const g = new THREE.CylinderGeometry(0.355, 0.355, 0.12, 20, 1, true, 0, Math.PI)
  g.rotateZ(Math.PI / 2)
  g.rotateX(Math.PI / 2)
  g.translate(0, 0, 0.34)
  return g
})
const coinGeo = memo('chestCoin', () => new THREE.SphereGeometry(0.1, 8, 6).scale(1, 0.45, 1))

export function Chest({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const lid = useRef<THREE.Group>(null)
  const done = useRef(!!ghost)
  const coins = useMemo(() => {
    const r = mulberry32(el.seed)
    return Array.from({ length: 7 }, () => [(r() - 0.5) * 0.7, 0.5 + r() * 0.04, (r() - 0.5) * 0.4, r() * 3] as const)
  }, [el.seed])

  useLayoutEffect(() => {
    if (!lid.current) return
    const open = !ghost && spawnAge(el.createdAt) >= OPEN_AT + 0.4
    lid.current.rotation.x = open ? -OPEN_ANGLE : 0
    done.current = !!ghost || open
  }, [el.createdAt, ghost])

  useFrame(() => {
    if (done.current || !lid.current) return
    const k = clamp01((spawnAge(el.createdAt) - OPEN_AT) / 0.4)
    lid.current.rotation.x = -OPEN_ANGLE * easeOutBack(k)
    if (k >= 1) done.current = true
  })

  return (
    <SpawnGroup el={el} profile="drop" ghost={ghost}>
      <group scale={0.85}>
        <mesh geometry={bodyGeo} material={wood} castShadow receiveShadow />
        <mesh geometry={bandGeo} material={gold} position={[-0.32, 0, 0]} />
        <mesh geometry={bandGeo} material={gold} position={[0.32, 0, 0]} />
        {coins.map((c, i) => (
          <mesh key={i} geometry={coinGeo} material={glow} position={[c[0], c[1], c[2]]} rotation={[0, c[3], 0]} />
        ))}
        <group ref={lid} position={[0, 0.5, -0.34]}>
          <mesh geometry={lidGeo} material={wood} castShadow />
          <mesh geometry={lidBandGeo} material={gold} position={[-0.32, 0, 0]} />
          <mesh geometry={lidBandGeo} material={gold} position={[0.32, 0, 0]} />
          <mesh material={gold} position={[0, 0.04, 0.72]}>
            <boxGeometry args={[0.14, 0.16, 0.05]} />
          </mesh>
        </group>
      </group>
    </SpawnGroup>
  )
}
