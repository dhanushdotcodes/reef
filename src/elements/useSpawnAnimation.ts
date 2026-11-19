import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { SPAWN } from '../config'
import { easeInQuad, easeOutBack, easeOutCubic, easeOutElastic, clamp01 } from '../utils/easing'
import { prefersReducedMotion } from '../utils/quality'

export type SpawnProfile = 'drop' | 'heavyDrop' | 'grow' | 'pop' | 'flip' | 'none'

export interface Pose {
  sx: number
  sy: number
  sz: number
  y: number
  rotY: number
  rotZ: number
  visible: boolean
}

const speedUp = prefersReducedMotion ? 2.2 : 1

/** Seconds since spawn. Negative while waiting (staggered starter reef). */
export const spawnAge = (createdAt: number) => ((Date.now() - createdAt) / 1000) * speedUp

export function spawnPose(profile: SpawnProfile, t: number): Pose {
  const p: Pose = { sx: 1, sy: 1, sz: 1, y: 0, rotY: 0, rotZ: 0, visible: true }
  if (t < 0) {
    p.visible = false
    return p
  }
  if (profile === 'none' || t >= SPAWN.duration) return p
  switch (profile) {
    case 'drop':
    case 'heavyDrop': {
      const heavy = profile === 'heavyDrop'
      const fall = heavy ? 0.5 : 0.4
      const h = heavy ? 4 : 3
      if (t < fall) {
        const k = t / fall
        p.y = h * (1 - easeInQuad(k))
        p.rotZ = (1 - k) * 0.35
      } else {
        const u = clamp01((t - fall) / (SPAWN.duration - fall))
        const k = 1 - easeOutElastic(u)
        const amt = heavy ? 0.2 : 0.15
        p.sy = 1 - amt * k
        p.sx = p.sz = 1 + amt * 0.7 * k
      }
      break
    }
    case 'grow': {
      const k = clamp01(t / 1.1)
      const s = Math.max(0.001, easeOutBack(k))
      p.sx = p.sy = p.sz = s
      break
    }
    case 'pop': {
      const k = clamp01(t / 0.9)
      const s = Math.max(0.001, easeOutElastic(k) * (k < 0.25 ? k / 0.25 : 1))
      p.sx = p.sy = p.sz = s
      p.rotY = (1 - easeOutCubic(k)) * Math.PI * 2
      break
    }
    case 'flip': {
      const k = clamp01(t / 0.6)
      p.y = Math.sin(k * Math.PI) * 1.2
      p.rotZ = (1 - easeOutCubic(k)) * Math.PI * 2
      p.rotY = (1 - easeOutCubic(k)) * Math.PI
      const sc = 0.4 + 0.6 * easeOutBack(k)
      p.sx = p.sy = p.sz = Math.max(0.001, sc)
      break
    }
  }
  return p
}

/** Animates an inner group during the first ~1.2s after spawn, then goes static (no per-frame work). */
export function useSpawnAnimation(
  ref: RefObject<Group | null>,
  createdAt: number,
  profile: SpawnProfile,
  enabled = true,
) {
  const done = useRef(!enabled || profile === 'none' || spawnAge(createdAt) >= SPAWN.duration)
  useFrame(() => {
    if (done.current) return
    const g = ref.current
    if (!g) return
    const t = spawnAge(createdAt)
    const p = spawnPose(profile, t)
    g.visible = p.visible
    g.scale.set(p.sx, p.sy, p.sz)
    g.position.y = p.y
    g.rotation.set(0, p.rotY, p.rotZ)
    if (t >= SPAWN.duration) {
      done.current = true
      g.visible = true
      g.scale.set(1, 1, 1)
      g.position.y = 0
      g.rotation.set(0, 0, 0)
    }
  })
}
