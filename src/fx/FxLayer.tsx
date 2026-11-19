import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParticlePool } from './ParticlePool'
import { fxBus } from './fxBus'
import { emitSandPuff } from './SandPuff'
import { emitBubbles, emitSparkles } from './BubbleBurst'
import { SplashRipple } from './SplashRipple'
import { useQuality } from '../utils/quality'

/** Single listener for all FX events; owns the pooled particle systems. */
export function FxLayer() {
  const tier = useQuality((s) => s.tier)
  const { soft, add } = useMemo(
    () => ({ soft: new ParticlePool(tier === 0 ? 700 : 1400, false), add: new ParticlePool(300, true) }),
    [tier],
  )

  useEffect(() => {
    const offs = [
      fxBus.on('sandPuff', (e) => emitSandPuff(soft, e.position, e.strength, tier === 0)),
      fxBus.on('bubbleBurst', (e) => emitBubbles(soft, e.position, e.count, e.spread)),
      fxBus.on('sparkle', (e) => {
        const col = e.color ? new THREE.Color(e.color) : undefined
        emitSparkles(add, e.position, e.strength, col ? [col.r, col.g, col.b] : undefined)
      }),
    ]
    return () => offs.forEach((o) => o())
  }, [soft, add, tier])

  useFrame(({ gl, camera }, dt) => {
    const d = Math.min(dt, 0.05)
    const viewH = gl.domElement.height / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360))
    soft.update(d, viewH)
    add.update(d, viewH)
  })

  return (
    <>
      <primitive object={soft.points} />
      <primitive object={add.points} />
      <SplashRipple />
    </>
  )
}
