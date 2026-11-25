import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CAMERA } from '../config'
import { useReefStore } from '../store/useReefStore'
import { shakeState } from '../fx/fxBus'

// Orbit around a point just in front of the lens, so "rotating" is really the
// camera tilting in place: dragging looks up toward the surface or down at
// the sand, left/right across the reef. Pan is disabled.
const EYE = new Vector3(...CAMERA.start)
const PIVOT: [number, number, number] = EYE.clone()
  .add(new Vector3(...CAMERA.target).sub(EYE).normalize().multiplyScalar(0.01))
  .toArray()
// polar angle of (camera - pivot): 90° is level, >90° looks up
const MIN_POLAR = MathUtils.degToRad(90 + CAMERA.minPitch)
const MAX_POLAR = MathUtils.degToRad(90 + CAMERA.maxPitch)
const MAX_AZIMUTH = MathUtils.degToRad(CAMERA.maxYaw)

// Zoom is a real dolly: the camera slides forward/back along the ground
// (height and tilt unchanged), so near things grow faster than far ones and
// the background cliffs scale with true perspective.
const HOME_DIST = CAMERA.start[2] - CAMERA.target[2]
const MIN_DIST = HOME_DIST * CAMERA.zoomIn
const MAX_DIST = HOME_DIST * CAMERA.zoomOut

// home look direction, as the spherical angles OrbitControls uses
const HOME_SPH = new Spherical().setFromVector3(EYE.clone().sub(new Vector3(...PIVOT)))

let resetRequested = false
/** Ease the camera back to the home view (straight ahead, default zoom). */
export function resetView() {
  resetRequested = true
}

const tmpOffset = new Vector3()
const tmpSph = new Spherical()

export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null)
  const busy = useReefStore((s) => !!s.dragging || !!s.moving)
  const gl = useThree((s) => s.gl)
  const shakeOff = useRef(new Vector3())
  const wantDist = useRef(HOME_DIST)
  const resetting = useRef(false)

  // wheel / trackpad pinch (arrives as ctrl+wheel) sets the desired distance
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (useReefStore.getState().dragging) return
      const step = e.ctrlKey ? 0.01 : 0.0015
      resetting.current = false
      wantDist.current = MathUtils.clamp(
        wantDist.current * Math.exp(e.deltaY * step),
        MIN_DIST,
        MAX_DIST,
      )
    }
    // any new input takes over from an in-progress reset
    const cancelReset = () => (resetting.current = false)
    // "H" shortcut (ignored while typing or with modifiers held)
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'h' || e.key === 'H') resetView()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', cancelReset)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', cancelReset)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl])

  // runs before OrbitControls' update (-1): undo last frame's shake offset
  useFrame(({ camera }) => {
    camera.position.sub(shakeOff.current)
    shakeOff.current.set(0, 0, 0)
  }, -3)

  // still before the controls update: ease look direction home on reset,
  // then ease the dolly toward the wanted distance
  useFrame(({ camera }, dt) => {
    const c = ref.current
    if (!c) return
    if (resetRequested) {
      resetRequested = false
      resetting.current = true
      wantDist.current = HOME_DIST
    }
    if (resetting.current) {
      tmpSph.setFromVector3(tmpOffset.subVectors(camera.position, c.target))
      tmpSph.theta = MathUtils.damp(tmpSph.theta, HOME_SPH.theta, 6, dt)
      tmpSph.phi = MathUtils.damp(tmpSph.phi, HOME_SPH.phi, 6, dt)
      c.target.copy(camera.position).sub(tmpOffset.setFromSpherical(tmpSph))
      const settled =
        Math.abs(tmpSph.theta - HOME_SPH.theta) < 1e-3 &&
        Math.abs(tmpSph.phi - HOME_SPH.phi) < 1e-3 &&
        Math.abs(camera.position.z - CAMERA.start[2]) < 1e-3
      if (settled) resetting.current = false
    }
    const cur = camera.position.z - CAMERA.target[2]
    const next = MathUtils.damp(cur, wantDist.current, 8, dt)
    const dz = next - cur
    if (Math.abs(dz) < 1e-5) return
    camera.position.z += dz
    c.target.z += dz
  }, -2)

  // runs after controls update, before render: landing shake (decays)
  useFrame(({ camera }) => {
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
      target={PIVOT}
      enabled={!busy}
      enableRotate
      enableZoom={false}
      enablePan={false}
      autoRotate={false}
      minAzimuthAngle={-MAX_AZIMUTH}
      maxAzimuthAngle={MAX_AZIMUTH}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
    />
  )
}
