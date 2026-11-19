import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CAMERA, TERRAIN } from '../config'
import { useReefStore } from '../store/useReefStore'
import { prefersReducedMotion } from '../utils/quality'
import { shakeState } from '../fx/fxBus'

export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)
  const lastInput = useRef(performance.now())
  const idleBase = useRef(0.4)
  const busy = useReefStore((s) => !!s.dragging || !!s.moving)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const touch = () => (lastInput.current = performance.now())
    const el = gl.domElement
    el.addEventListener('pointerdown', touch)
    el.addEventListener('wheel', touch, { passive: true })
    window.addEventListener('keydown', touch)
    return () => {
      el.removeEventListener('pointerdown', touch)
      el.removeEventListener('wheel', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [gl])

  const shakeOff = useRef(new Vector3())

  // runs before OrbitControls' update (-1): undo last frame's shake offset
  useFrame(({ camera }) => {
    camera.position.sub(shakeOff.current)
    shakeOff.current.set(0, 0, 0)
  }, -3)

  // runs after controls update, before render: pan limits, idle drift, shake
  useFrame(({ camera, clock }, dt) => {
    const c = ref.current
    if (!c) return
    // pan limits
    const lim = TERRAIN.bound * 0.7
    const tx = Math.max(-lim, Math.min(lim, c.target.x))
    const tz = Math.max(-lim, Math.min(lim, c.target.z))
    const ty = Math.max(0, Math.min(3, c.target.y))
    camera.position.x += tx - c.target.x
    camera.position.z += tz - c.target.z
    camera.position.y += ty - c.target.y
    c.target.set(tx, ty, tz)

    // idle drift
    const idle =
      !prefersReducedMotion &&
      !busy &&
      performance.now() - lastInput.current > CAMERA.idleSeconds * 1000
    c.autoRotate = idle
    c.autoRotateSpeed = 0.35
    if (idle) {
      const bob = idleBase.current + Math.sin(clock.elapsedTime * 0.35) * 0.25
      c.target.y += (bob - c.target.y) * Math.min(1, dt * 0.8)
    }

    // landing shake (offset applied after controls update, decays)
    if (shakeState.until > performance.now()) {
      const k = (shakeState.until - performance.now()) / shakeState.duration
      const a = shakeState.amp * k
      shakeOff.current.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0)
      camera.position.add(shakeOff.current)
    }
  })

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enabled={!busy}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={CAMERA.minPolar}
      maxPolarAngle={CAMERA.maxPolar}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      screenSpacePanning={false}
      rotateSpeed={0.6}
    />
  )
}
