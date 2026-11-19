import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useReefStore } from '../../store/useReefStore'
import { REGISTRY } from '../registry'
import { SPECIES, fishGeometry } from './fishGeometry'
import { Flock, OBSTACLE_HEIGHT, type Obstacle } from './boids'
import { chainBeforeCompile, sharedTime } from '../../shaders/caustics.glsl'
import { easeOutElastic, clamp01 } from '../../utils/easing'
import { spawnAge } from '../useSpawnAnimation'
import { mulberry32 } from '../../utils/random'
import { fxBus } from '../../fx/fxBus'
import { playSound } from '../../audio/audioEngine'
import type { PlacedElement } from '../../types'

export const fishMaterial = (() => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide })
  chainBeforeCompile(m, (shader) => {
    shader.uniforms.uTime = sharedTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.x += sin(uTime * 10.0 + float(gl_InstanceID) * 1.7) * pow(max(0.0, -transformed.z), 2.0) * 0.3;`,
      )
  })
  m.customProgramCacheKey = () => 'fish'
  return m
})()

/** Exposed for removal picking: world position of a fish by id. */
export const fishLookup = new Map<string, { flock: Flock; species: number }>()

const dummy = new THREE.Object3D()
const target = new THREE.Vector3()
const tmpColor = new THREE.Color()

export function FishSchool() {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const flocks = useMemo(() => SPECIES.map((s) => new Flock(REGISTRY.fish.maxCount, s)), [])
  const meta = useRef(new Map<string, PlacedElement>())
  const obstacles = useRef<Obstacle[]>([])
  const seenVersion = useRef([-1, -1, -1])
  const elements = useReefStore((s) => s.elements)
  const { camera, gl } = useThree()

  // keep boids + obstacles in sync with the store
  useEffect(() => {
    const live = new Set<string>()
    const obs: Obstacle[] = []
    meta.current.clear()
    for (const e of elements) {
      if (e.kind === 'fish') {
        live.add(e.id)
        meta.current.set(e.id, e)
        const f = flocks[e.variant % 3]
        if (!f.has(e.id)) f.add(e.id, e.position[0], e.position[1], e.position[2])
        fishLookup.set(e.id, { flock: f, species: e.variant % 3 })
      } else if (REGISTRY[e.kind].grounded) {
        obs.push({ x: e.position[0], z: e.position[2], r: REGISTRY[e.kind].footprint * e.scale * 0.85, top: e.position[1] + (OBSTACLE_HEIGHT[e.kind] ?? 1) * e.scale })
      }
    }
    obstacles.current = obs
    for (const f of flocks) for (const id of [...f.ids]) if (!live.has(id)) { f.remove(id); fishLookup.delete(id) }
  }, [elements, flocks])

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    flocks.forEach((f, si) => {
      const mesh = meshes.current[si]
      if (!mesh) return
      f.step(dt, t, obstacles.current)
      const sp = SPECIES[si]
      if (seenVersion.current[si] !== f.version) {
        seenVersion.current[si] = f.version
        mesh.count = f.count
        for (let i = 0; i < f.count; i++) {
          const e = meta.current.get(f.ids[i])
          const r = mulberry32(e?.seed ?? i)
          tmpColor.set(sp.palette[Math.floor(r() * sp.palette.length)])
          tmpColor.offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.08)
          mesh.setColorAt(i, tmpColor)
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      for (let i = 0; i < f.count; i++) {
        const e = meta.current.get(f.ids[i])
        const age = e ? spawnAge(e.createdAt) : 9
        // pop in: 0 -> 1.2 -> 1 with a little spin
        const k = clamp01(age / 0.9)
        const pop = age < 0 ? 0.0001 : age >= 0.9 ? 1 : Math.max(0.0001, easeOutElastic(k) * (k < 0.25 ? k / 0.25 : 1))
        dummy.position.set(f.px[i], f.py[i], f.pz[i])
        target.set(f.px[i] + f.vx[i], f.py[i] + f.vy[i], f.pz[i] + f.vz[i])
        dummy.lookAt(target)
        if (age >= 0 && age < 0.9) dummy.rotateZ((1 - k) * (1 - k) * Math.PI * 2)
        const s = sp.length * (e?.scale ?? 1) * pop
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    })
  })

  // right-click / long-press removes the nearest fish to the pointer
  useEffect(() => {
    const el = gl.domElement
    const v = new THREE.Vector3()
    const removeNear = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      let best: string | null = null
      let bd = 60 * 60
      let at: [number, number, number] = [0, 0, 0]
      for (const f of flocks) {
        for (let i = 0; i < f.count; i++) {
          v.set(f.px[i], f.py[i], f.pz[i]).project(camera)
          if (v.z > 1) continue
          const sx = ((v.x + 1) / 2) * r.width + r.left, sy = ((1 - v.y) / 2) * r.height + r.top
          const d = (sx - cx) ** 2 + (sy - cy) ** 2
          if (d < bd) { bd = d; best = f.ids[i]; at = [f.px[i], f.py[i], f.pz[i]] }
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
  }, [camera, gl, flocks])

  return (
    <>
      {SPECIES.map((_, i) => (
        <instancedMesh
          key={i}
          ref={(m) => { meshes.current[i] = m }}
          args={[fishGeometry(i), fishMaterial, REGISTRY.fish.maxCount]}
          count={0}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

/** Single non-instanced fish used by the drag ghost. */
export function FishGhost({ el }: { el: PlacedElement }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 1.5
  })
  const sp = SPECIES[el.variant % 3]
  return <mesh ref={ref} geometry={fishGeometry(el.variant % 3)} material={fishMaterial} scale={sp.length * 1.4} />
}
