import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fxBus } from './fxBus'
import { useEffect } from 'react'
import { sandHeight } from '../utils/terrain'

const POOL = 8
const DURATION = 0.75

/** Expanding dust ring on the sand: a pool of fading rings, reused round-robin. */
export function SplashRipple() {
  const rings = useMemo(() => {
    const geo = new THREE.CircleGeometry(1, 48)
    geo.rotateX(-Math.PI / 2)
    // soft radial profile: transparent centre, bright band near the rim, feathered edge
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const cx = cv.getContext('2d')!
    const grad = cx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, '#000')
    grad.addColorStop(0.55, '#000')
    grad.addColorStop(0.85, '#fff')
    grad.addColorStop(1, '#000')
    cx.fillStyle = grad
    cx.fillRect(0, 0, 128, 128)
    const alphaMap = new THREE.CanvasTexture(cv)
    return Array.from({ length: POOL }, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: '#cdbd92', alphaMap, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        fog: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.renderOrder = 6
      return { mesh, mat, t: 1e9, strength: 1 }
    })
  }, [])
  const next = useRef(0)

  useEffect(
    () =>
      fxBus.on('dustRing', ({ position, strength = 1 }) => {
        const r = rings[next.current++ % POOL]
        r.t = 0
        r.strength = strength
        r.mesh.position.set(position[0], sandHeight(position[0], position[2]) + 0.3, position[2])
        r.mesh.visible = true
      }),
    [rings],
  )

  useFrame((_, dt) => {
    for (const r of rings) {
      if (!r.mesh.visible) continue
      r.t += dt
      const u = r.t / DURATION
      if (u >= 1) { r.mesh.visible = false; continue }
      const s = (0.4 + 2.4 * (1 - Math.pow(1 - u, 3))) * r.strength
      r.mesh.scale.set(s, 1, s)
      r.mat.opacity = 0.5 * Math.pow(1 - u, 1.4)
    }
  })

  return (
    <>
      {rings.map((r, i) => (
        <primitive key={i} object={r.mesh} />
      ))}
    </>
  )
}
