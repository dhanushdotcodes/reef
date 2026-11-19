import { useMemo } from 'react'
import * as THREE from 'three'
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js'
import type { PlacedElement } from '../types'
import { memo } from '../utils/cache'
import { applyCaustics } from '../shaders/caustics.glsl'
import { SpawnGroup } from './SpawnGroup'

function shellGeometry(variant: number, seed: number) {
  return memo(`shell:${variant}:${variant === 0 ? 0 : seed % 64}`, () => {
    let g: THREE.BufferGeometry
    if (variant === 0) {
      // classic spiral seashell
      const a = 0.4, b = 0.9, c = 0.1, n = 2.6
      g = new ParametricGeometry(
        (u, v, t) => {
          const uu = u * Math.PI * 2, vv = v * Math.PI * 2
          const k = 1 - vv / (Math.PI * 2)
          t.set(
            a * k * Math.cos(n * vv) * (1 + Math.cos(uu)) + c * Math.cos(n * vv),
            a * k * Math.sin(n * vv) * (1 + Math.cos(uu)) + c * Math.sin(n * vv),
            (b * vv) / (Math.PI * 2) + a * k * Math.sin(uu),
          )
        },
        48,
        20,
      )
      g.scale(0.32, 0.32, 0.32)
      g.rotateX(-Math.PI / 2 + 1.15)
    } else {
      // scallop: ribbed wedge dome
      g = new THREE.SphereGeometry(0.5, 32, 12, Math.PI * 0.1, Math.PI * 0.8, 0, Math.PI / 2)
      const p = g.attributes.position as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i)
        const phi = Math.atan2(v.z, v.x)
        const rib = 1 + 0.07 * Math.sin(phi * 18)
        p.setXYZ(i, v.x * rib, v.y * 0.4, v.z * rib)
      }
      g.scale(0.6, 0.6, 0.6)
      g.computeVertexNormals()
      g.rotateZ(0.12)
    }
    g.computeBoundingBox()
    g.translate(0, -g.boundingBox!.min.y - 0.01, 0)
    g.computeVertexNormals()
    const pos = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    const c1 = new THREE.Color('#ffd9e6'), c2 = new THREE.Color('#fff7f0'), c = new THREE.Color()
    const h = g.boundingBox!.max.y - g.boundingBox!.min.y
    for (let i = 0; i < pos.count; i++) {
      c.copy(c1).lerp(c2, Math.min(1, Math.max(0, pos.getY(i) / (h || 1))))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  })
}

const material = memo('shellMat', () => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.15, side: THREE.DoubleSide })
  applyCaustics(m, { intensity: 0.3 })
  return m
})

export function Shell({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  const geometry = useMemo(() => shellGeometry(el.variant, el.seed), [el.variant, el.seed])
  return (
    <SpawnGroup el={el} profile="flip" ghost={ghost}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </SpawnGroup>
  )
}
