import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { PlacedElement } from '../types'
import { mulberry32 } from '../utils/random'
import { memo } from '../utils/cache'
import { applyCaustics } from '../shaders/caustics.glsl'
import { easeInQuad, easeOutElastic, clamp01 } from '../utils/easing'
import { spawnAge } from './useSpawnAnimation'

interface Block { p: THREE.Vector3; r: THREE.Euler; level: number }
const BW = 0.7, BH = 0.38, BD = 0.5
const STAGGER = 0.06, FALL = 0.28, SETTLE = 0.45

function layout(seed: number, variant: number): Block[] {
  const rnd = mulberry32(seed)
  const out: Block[] = []
  const add = (x: number, z: number, level: number, yaw: number, topTilt: boolean) => {
    const tilt = topTilt ? 0.12 + rnd() * 0.2 : 0.03
    out.push({
      p: new THREE.Vector3(x + (rnd() - 0.5) * 0.06, level * BH + BH / 2 - 0.06, z + (rnd() - 0.5) * 0.06),
      r: new THREE.Euler((rnd() - 0.5) * tilt, yaw + (rnd() - 0.5) * 0.12, (rnd() - 0.5) * tilt),
      level,
    })
  }
  if (variant === 0) {
    // row of pillars of uneven height
    const cols = 4 + Math.floor(rnd() * 2)
    for (let c = 0; c < cols; c++) {
      const h = 1 + Math.floor(rnd() * 4)
      for (let l = 0; l < h; l++) {
        if (l > 1 && rnd() < 0.18) continue
        add((c - (cols - 1) / 2) * 0.8, (rnd() - 0.5) * 0.12, l, 0, l === h - 1 && h > 2)
      }
    }
  } else if (variant === 1) {
    // brick wall segment, running bond, broken top
    const cols = 4, rows = 3 + Math.floor(rnd() * 2)
    for (let l = 0; l < rows; l++)
      for (let c = 0; c < cols; c++) {
        if (l >= rows - 2 && rnd() < 0.3) continue
        add((c - (cols - 1) / 2) * BW * 1.02 + (l % 2) * 0.35 - 0.17, 0, l, 0, l === rows - 1)
      }
  } else {
    // ring of pillars with a fallen lintel
    const n = 5
    for (let c = 0; c < n; c++) {
      const a = (c / n) * Math.PI * 2
      const h = 2 + Math.floor(rnd() * 3)
      for (let l = 0; l < h; l++) {
        if (l > 1 && rnd() < 0.2) continue
        add(Math.cos(a) * 1.1, Math.sin(a) * 1.1, l, -a, l === h - 1)
      }
    }
  }
  out.sort((a, b) => a.level - b.level)
  return out
}

function blockGeometry() {
  return memo('wallBlock', () => {
    const g = new THREE.BoxGeometry(BW, BH, BD).toNonIndexed()
    g.computeVertexNormals()
    const n = g.attributes.normal as THREE.BufferAttribute
    const col = new Float32Array(n.count * 3)
    const stone = new THREE.Color('#e6d2a2'), moss = new THREE.Color('#7f9c55'), c = new THREE.Color()
    for (let i = 0; i < n.count; i++) {
      c.copy(stone)
      if (n.getY(i) > 0.5) c.lerp(moss, 0.55)
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  })
}
const material = memo('wallMat', () => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true })
  applyCaustics(m)
  return m
})

const dummy = new THREE.Object3D()

export function Wall({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const blocks = useMemo(() => layout(el.seed, el.variant), [el.seed, el.variant])
  const mesh = useRef<THREE.InstancedMesh>(null)
  const end = (blocks.length - 1) * STAGGER + FALL + SETTLE
  const done = useRef(ghost || spawnAge(el.createdAt) >= end)

  const apply = (age: number) => {
    const m = mesh.current
    if (!m) return
    blocks.forEach((b, i) => {
      const t = age - i * STAGGER
      let sx = 1, sy = 1, y = 0
      if (t < 0) sx = sy = 0.0001
      else if (t < FALL) y = 2.8 * (1 - easeInQuad(t / FALL))
      else if (t < FALL + SETTLE) {
        const k = 1 - easeOutElastic(clamp01((t - FALL) / SETTLE))
        sy = 1 - 0.18 * k
        sx = 1 + 0.12 * k
      }
      dummy.position.set(b.p.x, b.p.y + y - (1 - sy) * BH * 0.5, b.p.z)
      dummy.rotation.copy(b.r)
      dummy.scale.set(sx, sy, sx)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    const rnd = mulberry32(el.seed)
    blocks.forEach((_, i) => m.setColorAt(i, c.setScalar(0.8 + rnd() * 0.3)))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    apply(done.current ? 99 : spawnAge(el.createdAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  useFrame(() => {
    if (done.current) return
    const age = spawnAge(el.createdAt)
    apply(age)
    if (age >= end) done.current = true
  })

  return (
    <group position={el.position} rotation-y={el.rotationY} scale={el.scale}>
      <instancedMesh
        ref={mesh}
        args={[blockGeometry(), material, blocks.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}
