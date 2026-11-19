import type { SoundName } from '../types'
import { AUDIO } from '../config'
import { SOUNDS, type Bus } from './sounds'
import { useReefStore } from '../store/useReefStore'

let ctx: AudioContext | null = null
let bus: Bus | null = null
let master: GainNode | null = null
let ambient: GainNode | null = null
const lastPlayed = new Map<string, number>()

function brownNoise(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = last * 3.5
  }
  return buf
}

function build(): void {
  if (ctx) return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  const c = ctx

  // master gain -> lowpass (underwater muffling) -> compressor -> destination
  master = c.createGain()
  master.gain.value = useReefStore.getState().muted ? 0 : AUDIO.master
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = AUDIO.lowpass
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 6
  master.connect(lp).connect(comp).connect(c.destination)

  // reverb-ish feedback delay send
  const verb = c.createGain()
  const delay = c.createDelay(1)
  delay.delayTime.value = 0.17
  const fb = c.createGain()
  fb.gain.value = 0.38
  const damp = c.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 2200
  const wet = c.createGain()
  wet.gain.value = 0.6
  verb.connect(master)
  verb.connect(delay)
  delay.connect(damp).connect(fb).connect(delay)
  damp.connect(wet).connect(master)

  const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  bus = { ctx: c, out: master, verb, noise: noiseBuf }

  // ambient bed: very quiet brown noise through a slowly modulated lowpass
  const src = c.createBufferSource()
  src.buffer = brownNoise(c, 6)
  src.loop = true
  const bf = c.createBiquadFilter()
  bf.type = 'lowpass'
  bf.frequency.value = 380
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.07
  const lfoGain = c.createGain()
  lfoGain.gain.value = 140
  lfo.connect(lfoGain).connect(bf.frequency)
  ambient = c.createGain()
  ambient.gain.value = 0.05
  src.connect(bf).connect(ambient).connect(master)
  src.start()
  lfo.start()
}

/** Create + resume on the first user gesture (browsers block audio until then). */
export function unlockAudio() {
  build()
  if (ctx && ctx.state !== 'running') void ctx.resume()
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio()
    if (ctx?.state === 'running') {
      window.removeEventListener('pointerdown', once)
      window.removeEventListener('keydown', once)
    }
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
  useReefStore.subscribe((s, prev) => {
    if (s.muted !== prev.muted && master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(s.muted ? 0 : AUDIO.master, ctx.currentTime, 0.05)
    }
  })
}

/** Play a synthesized sound with randomized pitch (±12%) and gain (±2 dB); throttled per name. */
export function playSound(name: SoundName, gain = 1, delaySeconds = 0) {
  if (useReefStore.getState().muted || !ctx || !bus || ctx.state !== 'running') return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -1e9) < AUDIO.throttleMs) return
  lastPlayed.set(name, now)
  const pitch = 1 + (Math.random() * 2 - 1) * 0.12
  const db = (Math.random() * 2 - 1) * 2
  const g = gain * Math.pow(10, db / 20)
  if (g === 1) {
    SOUNDS[name](bus, pitch, delaySeconds)
  } else {
    // scale by routing through a one-off trim node
    const trim = bus.ctx.createGain()
    trim.gain.value = g
    trim.connect(bus.out)
    const verbTrim = bus.ctx.createGain()
    verbTrim.gain.value = g
    verbTrim.connect(bus.verb)
    SOUNDS[name]({ ...bus, out: trim, verb: verbTrim }, pitch, delaySeconds)
    setTimeout(() => {
      trim.disconnect()
      verbTrim.disconnect()
    }, 2500 + delaySeconds * 1000)
  }
}
