import type { PlacedElement, SoundName } from '../types'
import { REGISTRY } from './registry'
import { fxBus, shake } from '../fx/fxBus'
import { playSound } from '../audio/audioEngine'
import { prefersReducedMotion } from '../utils/quality'

/** Extra sounds layered on top of def.onPlaceSound: [sound, delaySeconds, gain] */
const EXTRA: Partial<Record<string, [SoundName, number, number][]>> = {
  rock: [['splash', 0.02, 0.8]],
  wall: [['crunch', 0.04, 0.9]],
  chest: [['shimmer', 0.45, 0.8]],
}

/** Fires sound + FX at the moment the element visually lands. */
export function triggerPlacement(el: PlacedElement) {
  if (el.silent) return
  const def = REGISTRY[el.kind]
  const at = () => {
    playSound(def.onPlaceSound)
    for (const [name, delay, gain] of EXTRA[el.kind] ?? []) playSound(name, gain, delay)
    const strength = el.kind === 'wall' ? 1.6 : el.kind === 'rock' ? 1 : el.kind === 'chest' ? 0.9 : 0.5
    for (const fx of def.onPlaceFx) {
      if (fx === 'sandPuff') fxBus.emit('sandPuff', { position: el.position, strength })
      else if (fx === 'dustRing') fxBus.emit('dustRing', { position: el.position, strength: el.kind === 'wall' ? 1.5 : 1 })
      else if (fx === 'bubbleBurst') fxBus.emit('bubbleBurst', { position: el.position, count: 6 + Math.floor(Math.random() * 5) })
      else if (fx === 'sparkle') fxBus.emit('sparkle', { position: el.position, strength: 1, color: el.kind === 'coral' ? el.color : undefined })
      else if (fx === 'shake' && !prefersReducedMotion) shake(el.kind === 'wall' ? 0.09 : 0.05, 150)
    }
  }
  const ms = def.landTime * 1000
  if (ms > 0) setTimeout(at, ms)
  else at()
}

export function triggerMove(el: PlacedElement) {
  playSound('thud', 0.5)
  fxBus.emit('sandPuff', { position: el.position, strength: 0.5 })
}

export function triggerDelete(el: PlacedElement) {
  playSound('whoomp')
  fxBus.emit('sandPuff', { position: el.position, strength: 0.6 })
}
