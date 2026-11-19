import type { SoundName } from '../types'

/** Shared resources handed to every synth voice. */
export interface Bus {
  ctx: AudioContext
  out: AudioNode
  /** feedback-delay "reverb-ish" send */
  verb: AudioNode
  noise: AudioBuffer
}

type Voice = (bus: Bus, pitch: number, delay?: number) => void

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function osc(bus: Bus, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, dest: AudioNode = bus.out, attack = 0.008) {
  const { ctx } = bus
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  env(g, t, peak, attack, dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + attack + dur + 0.05)
}

function noise(bus: Bus, t: number, dur: number, peak: number, filter: { type: BiquadFilterType; f0: number; f1?: number; q?: number }, dest: AudioNode = bus.out, attack = 0.005) {
  const { ctx } = bus
  const src = ctx.createBufferSource()
  src.buffer = bus.noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filter.type
  f.Q.value = filter.q ?? 0.8
  f.frequency.setValueAtTime(filter.f0, t)
  if (filter.f1) f.frequency.exponentialRampToValueAtTime(filter.f1, t + dur)
  const g = ctx.createGain()
  env(g, t, peak, attack, dur)
  src.connect(f).connect(g).connect(dest)
  src.start(t, Math.random() * 1.5)
  src.stop(t + attack + dur + 0.05)
}

const PENTA = [0, 2, 4, 7, 9]
const note = (base: number, step: number) => base * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12)

export const thud: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  osc(bus, 'sine', 70 * p, 40 * p, t, 0.28, 0.9)
  noise(bus, t, 0.12, 0.35, { type: 'lowpass', f0: 500 * p })
}
export const heavyThud: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  osc(bus, 'sine', 60 * p, 28 * p, t, 0.42, 1.0)
  osc(bus, 'triangle', 110 * p, 50 * p, t, 0.2, 0.35)
  noise(bus, t, 0.22, 0.5, { type: 'lowpass', f0: 700 * p, f1: 150 })
}
export const splash: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  noise(bus, t, 0.28, 0.22, { type: 'bandpass', f0: 1400 * p, f1: 600, q: 0.9 })
  noise(bus, t + 0.03, 0.2, 0.12, { type: 'lowpass', f0: 1800 })
}
export const blup: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  osc(bus, 'sine', 900 * p, 280 * p, t, 0.17, 0.5, bus.out, 0.01)
  osc(bus, 'sine', 1500 * p, 700 * p, t + 0.07, 0.07, 0.2)
}
export const bubble: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  const f = (500 + Math.random() * 500) * p
  osc(bus, 'sine', f, f * 1.9, t, 0.07, 0.12)
}
export const chime: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  const n = 2 + Math.floor(Math.random() * 2)
  let step = Math.floor(Math.random() * 5)
  for (let i = 0; i < n; i++) {
    const f = note(523.25 * p, step)
    osc(bus, 'sine', f, f, t + i * 0.09, 0.7, 0.26, bus.verb, 0.01)
    osc(bus, 'triangle', f * 2, f * 2, t + i * 0.09, 0.4, 0.06, bus.verb, 0.01)
    step += 1 + Math.floor(Math.random() * 2)
  }
}
export const crunch: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  for (let i = 0; i < 4; i++)
    noise(bus, t + i * 0.035 + Math.random() * 0.02, 0.07, 0.4, { type: 'bandpass', f0: (900 + Math.random() * 1500) * p, q: 1.4 }, bus.out, 0.002)
}
export const swoosh: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  noise(bus, t, 0.45, 0.3, { type: 'bandpass', f0: 250 * p, f1: 2200 * p, q: 1.2 }, bus.out, 0.12)
}
export const click: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  osc(bus, 'square', 2400 * p, 1800 * p, t, 0.025, 0.12, bus.out, 0.002)
  osc(bus, 'sine', 3300 * p, 3300 * p, t + 0.03, 0.16, 0.16, bus.verb, 0.002)
}
export const shimmer: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  for (let i = 0; i < 6; i++) {
    const f = note(659.25 * p, i)
    osc(bus, 'triangle', f, f, t + i * 0.07, 0.55, 0.16, bus.verb, 0.01)
  }
}
export const whoomp: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  noise(bus, t, 0.28, 0.5, { type: 'lowpass', f0: 600 * p, f1: 110 }, bus.out, 0.02)
  osc(bus, 'sine', 100 * p, 45 * p, t, 0.25, 0.5, bus.out, 0.015)
}
export const tick: Voice = (bus, p, d = 0) => {
  const t = bus.ctx.currentTime + d
  osc(bus, 'sine', 1800 * p, 1500 * p, t, 0.03, 0.12, bus.out, 0.002)
}

export const SOUNDS: Record<SoundName, Voice> = {
  thud, heavyThud, splash, blup, bubble, chime, crunch, swoosh, click, shimmer, whoomp, tick,
}
