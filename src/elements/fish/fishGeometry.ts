import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { memo } from '../../utils/cache'

export interface Species {
  name: string
  length: number
  maxSpeed: number
  minSpeed: number
  neighbor: number
  sep: number
  stripes: boolean
  tall: number
  palette: string[]
}

export const SPECIES: Species[] = [
  { name: 'tropical', length: 0.42, maxSpeed: 2.5, minSpeed: 0.9, neighbor: 3.2, sep: 0.6, stripes: false, tall: 0.75, palette: ['#ff9f43', '#ffd93d', '#4fd1c5', '#ff6f91', '#7ad7ff'] },
  { name: 'striped', length: 0.6, maxSpeed: 1.9, minSpeed: 0.7, neighbor: 3.6, sep: 0.8, stripes: true, tall: 0.95, palette: ['#ffb347', '#ffe08a', '#ff8a65'] },
  { name: 'big', length: 1.15, maxSpeed: 1.05, minSpeed: 0.4, neighbor: 5, sep: 1.4, stripes: false, tall: 0.7, palette: ['#7aa6c9', '#98b8a8', '#a79fd0', '#8fb0d6'] },
]

/** Unit-length fish facing +z, tail toward -z. Eyes are black via vertex colour. */
export function fishGeometry(species: number): THREE.BufferGeometry {
  return memo(`fish:${species}`, () => {
    const sp = SPECIES[species]
    const parts: THREE.BufferGeometry[] = []
    const paint = (g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => number) => {
      const p = g.attributes.position as THREE.BufferAttribute
      const c = new Float32Array(p.count * 3)
      for (let i = 0; i < p.count; i++) c.fill(f(p.getX(i), p.getY(i), p.getZ(i)), i * 3, i * 3 + 3)
      g.setAttribute('color', new THREE.BufferAttribute(c, 3))
      g.deleteAttribute('uv')
      parts.push(g)
    }
    const body = new THREE.SphereGeometry(0.5, 14, 10)
    body.scale(0.5, sp.tall * 0.8, 1)
    paint(body, (_x, y, z) => {
      let v = y < 0 ? 1.1 : 0.85
      if (sp.stripes && Math.sin(z * 16) > 0.35 && z > -0.35 && z < 0.38) v = 0.18
      return v
    })
    const tail = new THREE.ConeGeometry(0.3, 0.5, 3, 1)
    tail.rotateX(Math.PI / 2)
    tail.scale(0.12, sp.tall * 1.1, 1)
    tail.translate(0, 0, -0.74)
    paint(tail, () => 1.25)
    const dorsal = new THREE.ConeGeometry(0.16, 0.3, 3, 1)
    dorsal.scale(0.1, 1, 1.4)
    dorsal.translate(0, sp.tall * 0.4 + 0.08, -0.05)
    paint(dorsal, () => 1.2)
    for (const sx of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.055, 6, 5)
      eye.translate(sx * 0.2, sp.tall * 0.12, 0.33)
      paint(eye, () => 0.02)
    }
    const g = mergeGeometries(parts, false)
    parts.forEach((p) => p.dispose())
    g.computeBoundingSphere()
    return g
  })
}
