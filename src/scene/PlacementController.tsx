import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useReefStore, isValidSpot } from '../store/useReefStore'
import { REGISTRY } from '../elements/registry'
import { ElementView } from '../elements/ElementView'
import { COLORS, TERRAIN } from '../config'
import { intersectTerrain, sandHeight } from '../utils/terrain'
import { placement } from './placementState'
import { triggerPlacement, triggerMove } from '../elements/placeEffects'
import type { PlacedElement, Vec3 } from '../types'

const ghostMaterial = new THREE.MeshBasicMaterial({
  color: COLORS.ghost,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  toneMapped: false,
})

const tmpOrigin = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const hit: Vec3 = [0, 0, 0]
const FISH_HEIGHT = 2.5

export const isOverUI = (x: number, y: number) =>
  !!(document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-ui]')

/** Ray from the pointer into the heightfield. Returns false if it misses or leaves the seabed. */
export function pointerToSand(
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  out: Vec3,
): boolean {
  const r = canvas.getBoundingClientRect()
  const nx = ((clientX - r.left) / r.width) * 2 - 1
  const ny = -((clientY - r.top) / r.height) * 2 + 1
  tmpOrigin.setFromMatrixPosition(camera.matrixWorld)
  tmpDir.set(nx, ny, 0.5).unproject(camera).sub(tmpOrigin).normalize()
  if (!intersectTerrain(tmpOrigin.x, tmpOrigin.y, tmpOrigin.z, tmpDir.x, tmpDir.y, tmpDir.z, out)) return false
  return Math.abs(out[0]) <= TERRAIN.size / 2 && Math.abs(out[2]) <= TERRAIN.size / 2
}

function Ring({ radius, valid }: { radius: number; valid: boolean }) {
  const N = 72
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3))
    const idx: number[] = []
    for (let i = 0; i < N; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    g.setIndex(idx)
    const m = new THREE.MeshBasicMaterial({
      color: COLORS.ghost,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
    return { geometry: g, material: m }
  }, [])
  const mesh = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    m.visible = placement.hasPoint && !placement.overUI
    if (!m.visible) return
    const t = clock.elapsedTime
    const pulse = 1 + Math.sin(t * 6) * 0.05
    const [cx, , cz] = placement.point
    const pos = geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const c = Math.cos(a), s = Math.sin(a)
      const ro = radius * pulse, ri = ro - 0.09
      const xo = cx + c * ro, zo = cz + s * ro
      const xi = cx + c * ri, zi = cz + s * ri
      pos.setXYZ(i * 2, xo, sandHeight(xo, zo) + 0.04, zo)
      pos.setXYZ(i * 2 + 1, xi, sandHeight(xi, zi) + 0.04, zi)
    }
    pos.needsUpdate = true
    material.color.set(placement.valid ? COLORS.ghost : COLORS.invalid)
    material.opacity = 0.55 + Math.sin(t * 6) * 0.2
  })
  void valid
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={20} />
}

function Ghost({ kind, moving }: { kind: PlacedElement['kind']; moving: PlacedElement | null }) {
  const group = useRef<THREE.Group>(null)
  const def = REGISTRY[kind]
  const synthetic = useMemo<PlacedElement>(
    () =>
      moving
        ? { ...moving, position: [0, 0, 0], createdAt: 0 }
        : {
            id: 'ghost',
            kind,
            position: [0, 0, 0],
            rotationY: 0,
            scale: 1,
            variant: 0,
            seed: 7,
            color: COLORS.coral[0],
            createdAt: 0,
          },
    [kind, moving],
  )

  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.material = ghostMaterial
        mesh.castShadow = false
        mesh.receiveShadow = false
      }
    })
  }, [synthetic])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.visible = placement.hasPoint && !placement.overUI
    if (!g.visible) return
    const [x, y, z] = placement.point
    const bob = Math.sin(clock.elapsedTime * 4) * 0.06
    g.position.set(x, (def.grounded ? y + 0.12 : y + FISH_HEIGHT) + bob, z)
  })
  return (
    <group ref={group} visible={false}>
      <ElementView el={synthetic} ghost />
    </group>
  )
}

/** Raycasts the pointer into the seabed, draws ghost + ring, and finalises drops. */
export function PlacementController() {
  const { camera, gl } = useThree()
  const dragging = useReefStore((s) => s.dragging)
  const movingId = useReefStore((s) => s.moving)
  const moving = useReefStore((s) => (s.moving ? (s.elements.find((e) => e.id === s.moving) ?? null) : null))

  useEffect(() => {
    const track = (e: PointerEvent) => {
      placement.clientX = e.clientX
      placement.clientY = e.clientY
      placement.pointerType = e.pointerType
      placement.overUI = isOverUI(e.clientX, e.clientY)
    }
    const finish = (e: PointerEvent) => {
      track(e)
      const st = useReefStore.getState()
      if (st.dragging) {
        const kind = st.dragging.kind
        const def = REGISTRY[kind]
        if (placement.hasPoint && !placement.overUI && placement.valid) {
          const [x, y, z] = placement.point
          const pos: Vec3 = def.grounded ? [x, y, z] : [x, y + FISH_HEIGHT, z]
          const id = st.addElement(kind, pos)
          if (id) {
            const el = useReefStore.getState().elements.find((o) => o.id === id)
            if (el) triggerPlacement(el)
          }
        }
        st.endDrag()
      }
      if (st.moving) {
        const id = st.moving
        const el = st.elements.find((o) => o.id === id)
        if (el && placement.hasPoint && !placement.overUI && placement.valid) {
          const def = REGISTRY[el.kind]
          const [x, y, z] = placement.point
          st.moveElement(id, def.grounded ? [x, y, z] : [x, y + FISH_HEIGHT, z])
          const moved = useReefStore.getState().elements.find((o) => o.id === id)
          if (moved) triggerMove(moved)
        }
        st.startMove(null)
      }
      placement.hasPoint = false
    }
    const cancel = () => {
      useReefStore.getState().endDrag()
      useReefStore.getState().startMove(null)
      placement.hasPoint = false
    }
    window.addEventListener('pointermove', track)
    window.addEventListener('pointerdown', track)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerdown', track)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [])

  const activeKind = dragging?.kind ?? moving?.kind ?? null

  useFrame(() => {
    if (!activeKind) {
      placement.hasPoint = false
      return
    }
    // lift the aim point above a touch so the finger doesn't hide the ghost
    const lift = placement.pointerType === 'touch' ? 56 : 0
    const ok = pointerToSand(camera, gl.domElement, placement.clientX, placement.clientY - lift, hit)
    placement.hasPoint = ok
    if (!ok) return
    placement.point[0] = hit[0]
    placement.point[1] = hit[1]
    placement.point[2] = hit[2]
    placement.valid = isValidSpot(activeKind, hit, movingId)
  })

  if (!activeKind) return null
  const def = REGISTRY[activeKind]
  return (
    <>
      <Ghost kind={activeKind} moving={moving} />
      <Ring radius={Math.max(0.4, def.footprint * 0.9)} valid />
    </>
  )
}
