import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { create } from 'zustand'
import { REGISTRY } from '../../registry'
import { spawnAge } from '../../useSpawnAnimation'
import { clamp01, easeOutElastic } from '../../../utils/easing'
import { fxBus } from '../../../fx/fxBus'
import { FishAgent, FishSim } from '../shared/FishSim'
import { liveSims } from '../shared/liveFish'
import type { SchoolProps } from '../shared/types'
import type { PlacedElement } from '../../../types'
import { LIONFISH_BEHAVIOUR } from './behaviour'
import { LOD1_DISTANCE } from './geometry/lod'
import { LionfishInstances, createLionfish, lionfishTuning, sharedLionfishAssets } from './lionfish'
import { SCENE_LENGTH } from './params'
import { LionfishPose, hintToState } from './pose'

/** Bumped by the lab when geometry params change, so schools rebuild their meshes. */
export const useLionfishAssetsVersion = create<{ v: number; bump(): void }>((set) => ({
  v: 0,
  bump: () => set((s) => ({ v: s.v + 1 })),
}))

/** Read by the lab's info panel. */
export const lionfishStats = { drawCalls: 0, count: 0 }

const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler(0, 0, 0, 'YZX')
const p = new THREE.Vector3()
const sc = new THREE.Vector3()
const a1 = new THREE.Vector4()
const a2 = new THREE.Vector4()
const camLocal = new THREE.Vector3()

/** Every lionfish in the sandbox: behaviour sim -> springs -> 3-6 instanced draw calls. */
export function LionfishSchool({ fish, env }: SchoolProps) {
  const version = useLionfishAssetsVersion((s) => s.v)
  // `version` changes when the lab edits geometry params; the getter then rebuilds
  const assets = useMemo(() => {
    void version
    return sharedLionfishAssets()
  }, [version])
  const inst = useMemo(() => new LionfishInstances(assets, REGISTRY.fish.maxCount), [assets])
  useEffect(() => () => inst.dispose(), [inst])

  const sim = useMemo(() => new FishSim(LIONFISH_BEHAVIOUR), [])
  const poses = useRef(new Map<string, LionfishPose>())
  const order = useRef<{ a: FishAgent; d: number }[]>([])
  const pending = useRef<PlacedElement[]>([])

  useEffect(() => {
    liveSims.add(sim)
    return () => { liveSims.delete(sim) }
  }, [sim])

  // keep agents in sync with placed fish (agents are created in useFrame, which knows the clock)
  useEffect(() => {
    const live = new Set(fish.map((f) => f.id))
    for (const a of [...sim.agents]) {
      if (!live.has(a.id)) {
        sim.remove(a.id)
        poses.current.delete(a.id)
      }
    }
    pending.current = fish.filter((f) => !sim.get(f.id))
  }, [fish, sim])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    for (const f of pending.current) {
      if (sim.get(f.id)) continue
      sim.add(new FishAgent(f.id, f.seed, f.position[0], f.position[1], f.position[2], f.scale, f.createdAt, t, LIONFISH_BEHAVIOUR))
      poses.current.set(f.id, new LionfishPose())
    }
    pending.current = []

    sim.step(dt, t, env.current)
    for (const ev of sim.events) {
      if (ev.type === 'bubbles') fxBus.emit('bubbleBurst', { position: ev.position, count: 3, spread: 0.12 })
      else fxBus.emit('sandPuff', { position: ev.position, strength: 0.35 })
    }
    sim.events.length = 0

    // far -> near, so translucent membranes blend in the right order
    const cam = state.camera.position
    const list = order.current
    list.length = 0
    for (const a of sim.agents) list.push({ a, d: a.pos.distanceToSquared(cam) })
    list.sort((x, y) => y.d - x.d)

    const tune = lionfishTuning
    const base = SCENE_LENGTH / tune.params.length
    const flareOverride = tune.pectoralFlare >= 0 ? tune.pectoralFlare : undefined
    inst.begin()
    for (const { a, d } of list) {
      const pose = poses.current.get(a.id)!
      // spawn pop: 0 -> overshoot -> 1 with a spin
      const age = spawnAge(a.createdAt)
      const k = clamp01(age / 0.9)
      const pop = age < 0 ? 0 : age >= 0.9 ? 1 : Math.max(0.0001, easeOutElastic(k) * (k < 0.25 ? k / 0.25 : 1))
      if (pop === 0) continue

      let threat: THREE.Vector3 | undefined = a.threatAge < 1.5 ? a.threatLocal : undefined
      const forced = tune.state !== 'auto' ? tune.state : null
      if (forced === 'defend' && !threat) {
        // lab override with no cursor: display toward the camera
        camLocal.subVectors(cam, a.pos)
        const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw)
        threat = camLocal.set(camLocal.x * cy - camLocal.z * sy, camLocal.y, camLocal.x * sy + camLocal.z * cy).normalize()
      }
      pose.setState(forced ?? hintToState(a.pose), threat, flareOverride)
      pose.step(dt)

      const s = base * a.scale * pop
      const bob = Math.sin(t * 0.9 + a.phase) * 0.05 * (1 - pose.swim.x * 0.7)
      const spin = age < 0.9 ? (1 - k) * (1 - k) * Math.PI * 2 : 0
      p.set(a.pos.x, a.pos.y + bob, a.pos.z)
      q.setFromEuler(e.set(a.roll, a.yaw + spin, a.pitch + (forced ? pose.pitch.x : 0)))
      m.compose(p, q, sc.setScalar(s))
      a1.set(a.phase, pose.flare.x, pose.erect.x, pose.swim.x)
      a2.set(a.hue, pose.tiltSide.x, pose.tiltFwd.x, pose.gape.x)
      const lod = tune.lod >= 0 ? tune.lod : d > LOD1_DISTANCE * LOD1_DISTANCE ? 1 : 0
      inst.add(lod, m, a1, a2)
    }
    inst.end()
    lionfishStats.drawCalls = inst.drawCalls
    lionfishStats.count = sim.agents.length
  })

  return <primitive object={inst.group} />
}

/** Rotating, hovering lionfish shown while dragging from the toolbar. */
export function LionfishGhost({ el }: { el: PlacedElement }) {
  const fish = useMemo(() => createLionfish({ shared: true, phase: el.seed % 100 }), [el.seed])
  useEffect(() => () => fish.dispose(), [fish])
  useEffect(() => fish.setState('hover'), [fish])
  useFrame(({ clock }, dt) => {
    fish.group.rotation.y = clock.elapsedTime * 1.2
    fish.update(Math.min(dt, 0.05), clock.elapsedTime)
  })
  return <primitive object={fish.group} scale={(SCENE_LENGTH / lionfishTuning.params.length) * 1.3} />
}
