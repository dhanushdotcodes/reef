import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rockGeometry } from '../elements/Rock'
import { applyCaustics } from '../shaders/caustics.glsl'
import { mulberry32 } from '../utils/random'

/**
 * 2.5D background: rock cliffs stacked along the left, right and back of the
 * board. Fog fades each layer into the water so they read as receding planes,
 * leaving open blue water in the middle like a canyon. Purely decorative —
 * not part of the reef store, never pickable.
 */

type Rock = { p: [number, number, number]; s: [number, number, number]; r: number }

function layout(): Rock[][] {
  const rnd = mulberry32(4242)
  const byVariant: Rock[][] = [[], [], []]
  const add = (x: number, y: number, z: number, size: number) => {
    const v = Math.floor(rnd() * 3)
    byVariant[v].push({
      p: [x, y, z],
      s: [size * (0.9 + rnd() * 0.4), size * (0.8 + rnd() * 0.5), size * (0.9 + rnd() * 0.4)],
      r: rnd() * Math.PI * 2,
    })
  }
  // side walls: columns of stacked boulders, taller toward the back
  for (const side of [-1, 1]) {
    for (let z = 24; z >= -24; z -= 2.6 + rnd() * 1.2) {
      const back = THREE.MathUtils.smoothstep(-z, -10, 22) // 0 near, 1 far
      const x0 = side * (15.5 + rnd() * 2.5)
      const levels = 1 + Math.floor(back * 3 + rnd() * 1.5)
      for (let k = 0; k < levels; k++) {
        const size = 2.6 + rnd() * 1.6 - k * 0.3
        add(x0 + side * k * 0.8 + (rnd() - 0.5), k * 2.4 + rnd() * 0.6, z + (rnd() - 0.5) * 1.5, size)
      }
      // outer layer behind, further into the fog
      add(x0 + side * 5, 1 + rnd() * 3, z + rnd() * 2, 4 + rnd() * 2)
    }
  }
  // back: low mounds with a gap in the middle so open water shows through
  for (let x = -20; x <= 20; x += 3 + rnd() * 1.5) {
    const gap = THREE.MathUtils.smoothstep(Math.abs(x), 3, 12)
    add(x, -0.5 + gap * 1.5, -21 - rnd() * 3, 2 + gap * 2.5 + rnd())
  }
  return byVariant
}

const material = (() => {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: '#7f9096',
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })
  applyCaustics(m, { intensity: 0.25 })
  return m
})()

function CliffVariant({ variant, rocks }: { variant: number; rocks: Rock[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => rockGeometry(900 + variant * 17, variant), [variant])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    rocks.forEach((r, i) => {
      o.position.set(...r.p)
      o.scale.set(...r.s)
      o.rotation.set(0, r.r, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [rocks])
  return <instancedMesh ref={ref} args={[geometry, material, rocks.length]} receiveShadow raycast={() => null} />
}

export function Cliffs() {
  const groups = useMemo(layout, [])
  return (
    <group name="cliffs">
      {groups.map((rocks, v) => (
        <CliffVariant key={v} variant={v} rocks={rocks} />
      ))}
    </group>
  )
}
