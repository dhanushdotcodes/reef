import type { Vec3 } from '../types'

export interface FxEvents {
  sandPuff: { position: Vec3; strength?: number }
  dustRing: { position: Vec3; strength?: number }
  bubbleBurst: { position: Vec3; strength?: number }
  sparkle: { position: Vec3; strength?: number; color?: string }
}
type Handler<K extends keyof FxEvents> = (p: FxEvents[K]) => void

const handlers: Record<string, Set<Handler<never>>> = {}

export const fxBus = {
  on<K extends keyof FxEvents>(name: K, fn: Handler<K>) {
    const set = (handlers[name] ??= new Set()) as unknown as Set<Handler<K>>
    set.add(fn)
    return () => set.delete(fn)
  },
  emit<K extends keyof FxEvents>(name: K, payload: FxEvents[K]) {
    ;(handlers[name] as unknown as Set<Handler<K>> | undefined)?.forEach((h) => h(payload))
  },
}

/** Camera shake: read by CameraRig each frame. */
export const shakeState = { until: 0, duration: 150, amp: 0.05 }
export function shake(amp = 0.05, duration = 150) {
  shakeState.amp = amp
  shakeState.duration = duration
  shakeState.until = performance.now() + duration
}
