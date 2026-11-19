import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useReefStore } from '../store/useReefStore'
import { REGISTRY } from '../elements/registry'
import { triggerDelete } from '../elements/placeEffects'
import { intersectTerrain } from '../utils/terrain'
import { easeInCubic, clamp01 } from '../utils/easing'
import type { Vec3 } from '../types'
import { ELEMENTS_GROUP } from '../elements/ElementsLayer'

const ROT_STEP = Math.PI / 8
const DELETE_MS = 300

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const tmp: Vec3 = [0, 0, 0]

/** Delete requests are animated (sink + shrink) before the element leaves the store. */
const deleting = new Map<string, { start: number; group: THREE.Object3D; y0: number; s0: number }>()
let findGroup: (id: string) => THREE.Object3D | null = () => null

export function requestDelete(id: string) {
  const st = useReefStore.getState()
  const el = st.elements.find((e) => e.id === id)
  if (!el || deleting.has(id)) return
  st.select(null)
  const g = findGroup(id)
  if (!g) {
    st.removeElement(id)
    return
  }
  deleting.set(id, { start: performance.now(), group: g, y0: g.position.y, s0: g.scale.x })
  triggerDelete(el)
}

/** Tap/click to select, drag to move, keyboard shortcuts, delete + selection animations. */
export function EditController() {
  const { scene, camera, gl } = useThree()
  const selectedId = useReefStore((s) => s.selectedId)
  const movingId = useReefStore((s) => s.moving)
  const restore = useRef<{ mesh: THREE.Mesh; orig: THREE.Material; clone: THREE.Material }[]>([])

  useEffect(() => {
    findGroup = (id) => {
      const root = scene.getObjectByName(ELEMENTS_GROUP)
      return root?.children.find((c) => c.userData.id === id) ?? null
    }
  }, [scene])

  // --- picking & moving ---
  useEffect(() => {
    const canvas = gl.domElement
    let pending: { id: string; x: number; y: number; t: number } | null = null
    let tapStart: { x: number; y: number; t: number } | null = null

    const pick = (cx: number, cy: number): string | null => {
      const r = canvas.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const root = scene.getObjectByName(ELEMENTS_GROUP)
      if (root) {
        for (const hit of raycaster.intersectObjects(root.children, true)) {
          let o: THREE.Object3D | null = hit.object
          while (o && !o.userData.id) o = o.parent
          if (o?.userData.id && !deleting.has(o.userData.id)) return o.userData.id as string
        }
      }
      // forgiving fallback: footprint proximity on the sand
      const ro = raycaster.ray.origin, rd = raycaster.ray.direction
      if (intersectTerrain(ro.x, ro.y, ro.z, rd.x, rd.y, rd.z, tmp)) {
        let best: string | null = null
        let bd = Infinity
        for (const e of useReefStore.getState().elements) {
          const def = REGISTRY[e.kind]
          if (!def.grounded || deleting.has(e.id)) continue
          const d = Math.hypot(e.position[0] - tmp[0], e.position[2] - tmp[2])
          if (d < Math.max(0.5, def.footprint * e.scale * 0.7) && d < bd) { bd = d; best = e.id }
        }
        return best
      }
      return null
    }

    const down = (e: PointerEvent) => {
      if (e.target !== canvas || e.button !== 0) return
      const st = useReefStore.getState()
      if (st.dragging) return
      const id = pick(e.clientX, e.clientY)
      if (id) {
        e.stopImmediatePropagation() // keep OrbitControls out of it
        pending = { id, x: e.clientX, y: e.clientY, t: performance.now() }
      } else {
        tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }
      }
    }
    const move = (e: PointerEvent) => {
      if (!pending) return
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 6) {
        const st = useReefStore.getState()
        st.select(pending.id)
        st.startMove(pending.id)
        pending = null
      }
    }
    const up = (e: PointerEvent) => {
      if (pending) {
        useReefStore.getState().select(pending.id)
        pending = null
      } else if (tapStart && e.target === canvas) {
        if (Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 6 && performance.now() - tapStart.t < 350)
          useReefStore.getState().select(null)
      }
      tapStart = null
    }
    // capture on window so we run before the canvas' own (OrbitControls) listeners
    window.addEventListener('pointerdown', down, { capture: true })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
        window.removeEventListener('pointerdown', down, { capture: true })
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [scene, camera, gl])

  // --- keyboard ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useReefStore.getState()
      if (e.key === 'Escape') st.select(null)
      if (!st.selectedId) return
      if (e.key === 'r' || e.key === 'R') st.rotateElement(st.selectedId, e.shiftKey ? -ROT_STEP : ROT_STEP)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        requestDelete(st.selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- selection pulse: clone materials of the selected element and pulse their emissive ---
  useEffect(() => {
    const undo = () => {
      for (const r of restore.current) {
        r.mesh.material = r.orig
        r.clone.dispose()
      }
      restore.current = []
    }
    undo()
    if (!selectedId) return
    const g = findGroup(selectedId)
    g?.traverse((o) => {
      const mesh = o as THREE.Mesh
      const m = mesh.material as THREE.MeshStandardMaterial | undefined
      if (!mesh.isMesh || !m || Array.isArray(m) || !('emissive' in m)) return
      const clone = m.clone()
      clone.onBeforeCompile = m.onBeforeCompile
      clone.customProgramCacheKey = m.customProgramCacheKey
      clone.userData = m.userData
      mesh.material = clone
      restore.current.push({ mesh, orig: m, clone })
    })
    return undo
  }, [selectedId, movingId])

  useFrame(({ clock }) => {
    const k = 0.13 + 0.1 * Math.sin(clock.elapsedTime * 5)
    for (const r of restore.current) {
      const m = r.clone as THREE.MeshStandardMaterial
      m.emissive.set('#3fe0ff')
      m.emissiveIntensity = k
    }
    const now = performance.now()
    for (const [id, d] of deleting) {
      const u = clamp01((now - d.start) / DELETE_MS)
      const e = easeInCubic(u)
      d.group.position.y = d.y0 - e * 0.6
      d.group.scale.setScalar(Math.max(0.0001, d.s0 * (1 - e)))
      if (u >= 1) {
        deleting.delete(id)
        useReefStore.getState().removeElement(id)
      }
    }
  })

  return null
}
