import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useReefStore } from '../../store/useReefStore'
import { fxBus } from '../../fx/fxBus'
import { playSound } from '../../audio/audioEngine'
import type { PlacedElement } from '../../types'
import { buildFishEnv } from './shared/obstacles'
import { pointerThreat } from './shared/pointerThreat'
import { liveSims } from './shared/liveFish'
import { FISH_SPECIES } from './species'
import { FISH_SPECIES_IDS, speciesIdOf, type FishSpeciesId } from './speciesIds'

const LionfishLab = lazy(() => import('./lionfish/LionfishLab'))
const labEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lab')

/**
 * All fish in the sandbox. Splits placed fish by species and hands each species'
 * School its fish plus the shared world (props to avoid/visit) and the cursor.
 */
export function FishLayer() {
  const elements = useReefStore((s) => s.elements)
  const env = useRef(buildFishEnv([]))
  const bySpecies = useMemo(() => {
    const out = Object.fromEntries(FISH_SPECIES_IDS.map((id) => [id, [] as PlacedElement[]])) as Record<FishSpeciesId, PlacedElement[]>
    for (const e of elements) if (e.kind === 'fish') out[speciesIdOf(e.variant)].push(e)
    return out
  }, [elements])
  useEffect(() => {
    env.current = buildFishEnv(elements)
  }, [elements])

  usePointerThreat()
  useRightClickRemoval()

  return (
    <>
      {FISH_SPECIES_IDS.map((id) => {
        const { School } = FISH_SPECIES[id]
        return <School key={id} fish={bySpecies[id]} env={env} />
      })}
      {labEnabled && (
        <Suspense fallback={null}>
          <LionfishLab />
        </Suspense>
      )}
    </>
  )
}

/** Keep the shared cursor ray up to date (runs before the schools each frame). */
function usePointerThreat() {
  const gl = useThree((s) => s.gl)
  const last = useRef({ moved: -1e9, inside: false, x: 0, y: 0 })
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const el = gl.domElement
    const move = () => { last.current.moved = performance.now(); last.current.inside = true }
    const leave = () => { last.current.inside = false }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [gl])

  useFrame(({ pointer, camera }, dt) => {
    const l = last.current
    const speed = Math.hypot(pointer.x - l.x, pointer.y - l.y) / Math.max(dt, 1e-3)
    pointerThreat.speed += (speed - pointerThreat.speed) * Math.min(1, dt * 10)
    l.x = pointer.x
    l.y = pointer.y
    pointerThreat.active = l.inside && performance.now() - l.moved < 3000
    raycaster.setFromCamera(pointer, camera)
    pointerThreat.ray.copy(raycaster.ray)
  }, -1)
}

/** Right-click (or long-press on touch) removes the fish nearest the pointer. */
function useRightClickRemoval() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    const v = new THREE.Vector3()
    const removeNear = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      let best: string | null = null
      let bd = 70 * 70
      let at: [number, number, number] = [0, 0, 0]
      for (const sim of liveSims) {
        for (const a of sim.agents) {
          v.copy(a.pos).project(camera)
          if (v.z > 1) continue
          const sx = ((v.x + 1) / 2) * r.width + r.left, sy = ((1 - v.y) / 2) * r.height + r.top
          const d = (sx - cx) ** 2 + (sy - cy) ** 2
          if (d < bd) { bd = d; best = a.id; at = [a.pos.x, a.pos.y, a.pos.z] }
        }
      }
      if (best) {
        useReefStore.getState().removeElement(best)
        playSound('blup', 0.7)
        fxBus.emit('bubbleBurst', { position: at, count: 6 })
      }
    }
    const onCtx = (e: MouseEvent) => { e.preventDefault(); removeNear(e.clientX, e.clientY) }
    let timer = 0, sx = 0, sy = 0
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      sx = e.clientX; sy = e.clientY
      timer = window.setTimeout(() => removeNear(sx, sy), 600)
    }
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer) }
    const up = () => clearTimeout(timer)
    el.addEventListener('contextmenu', onCtx)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('contextmenu', onCtx)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [camera, gl])
}
