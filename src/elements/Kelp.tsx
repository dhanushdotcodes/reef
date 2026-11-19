import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { PlacedElement } from '../types'
import { SPAWN } from '../config'
import { mulberry32 } from '../utils/random'
import { memo } from '../utils/cache'
import { clamp01, easeOutCubic } from '../utils/easing'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { applyCaustics } from '../shaders/caustics.glsl'
import { applyKelpShader, } from '../shaders/kelpSway.glsl'
import { SpawnGroup } from './SpawnGroup'
import { spawnAge } from './useSpawnAnimation'

const BASE = new THREE.Color('#2f4a1c')
const TIP = new THREE.Color('#a5c24e')

function kelpGeometry(seed: number, variant: number) {
  return memo(`kelp:${variant}:${seed % 4096}`, () => {
    const rnd = mulberry32(seed)
    const n = 3 + Math.floor(rnd() * 4)
    const strips: THREE.BufferGeometry[] = []
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const h = 2 + rnd() * 2.2 + variant * 0.3
      const g = new THREE.PlaneGeometry(0.4 + rnd() * 0.2, h, 1, 20)
      g.translate(0, h / 2, 0)
      const pos = g.attributes.position as THREE.BufferAttribute
      const col = new Float32Array(pos.count * 3)
      const bend = (rnd() - 0.5) * 0.5
      for (let j = 0; j < pos.count; j++) {
        const y = pos.getY(j)
        pos.setZ(j, bend * (y / h) * (y / h))
        c.copy(BASE).lerp(TIP, y / h)
        col.set([c.r, c.g, c.b], j * 3)
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(pos.count).fill(rnd() * 6.28), 1))
      g.rotateY(rnd() * Math.PI)
      const a = rnd() * Math.PI * 2, r = rnd() * 0.45
      g.translate(Math.cos(a) * r, -0.05, Math.sin(a) * r)
      strips.push(g)
    }
    const m = mergeGeometries(strips, false)
    strips.forEach((s) => s.dispose())
    return m
  })
}

function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, roughness: 0.7,
  })
  const u = applyKelpShader(m)
  applyCaustics(m, { intensity: 0.25 })
  const base = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => base() + 'k'
  return { material: m, u }
}
const shared = memo('kelpMat', () => makeMaterial().material)

export function Kelp({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const geometry = useMemo(() => kelpGeometry(el.seed, el.variant), [el.seed, el.variant])
  const mesh = useRef<THREE.Mesh>(null)
  const grow = useMemo(() => {
    if (ghost || spawnAge(el.createdAt) >= SPAWN.duration) return null
    const g = makeMaterial()
    g.u.value = 0.02
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => grow?.material.dispose(), [grow])

  useFrame(() => {
    if (!grow || !mesh.current || mesh.current.material === shared) return
    const t = spawnAge(el.createdAt)
    if (t >= SPAWN.duration) {
      mesh.current.material = shared
      return
    }
    grow.u.value = Math.max(0.02, easeOutCubic(clamp01(t / 1.0)))
  })

  return (
    <SpawnGroup el={el} profile="none" ghost={ghost}>
      <mesh ref={mesh} geometry={geometry} material={grow?.material ?? shared} receiveShadow renderOrder={2} />
    </SpawnGroup>
  )
}
