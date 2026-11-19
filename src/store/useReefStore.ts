import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ElementKind, PlacedElement, Vec3 } from '../types'
import { REGISTRY } from '../elements/registry'
import { sandHeight } from '../utils/terrain'
import { randSeed } from '../utils/random'
import { COLORS, TERRAIN } from '../config'

interface ReefState {
  elements: PlacedElement[]
  selectedId: string | null
  dragging: { kind: ElementKind } | null
  moving: string | null
  muted: boolean
  hintSeen: boolean

  addElement(kind: ElementKind, pos: Vec3, opts?: Partial<PlacedElement>): string
  setElements(els: PlacedElement[]): void
  moveElement(id: string, pos: Vec3): void
  rotateElement(id: string, delta: number): void
  removeElement(id: string): void
  clearAll(): void
  select(id: string | null): void
  startDrag(kind: ElementKind): void
  endDrag(): void
  startMove(id: string | null): void
  toggleMute(): void
  markHintSeen(): void
  // NEXT SESSION: serialize()/deserialize() for share links. State is JSON-safe.
}

export const useReefStore = create<ReefState>()(
  persist(
    (set, get) => ({
      elements: [],
      selectedId: null,
      dragging: null,
      moving: null,
      muted: false,
      hintSeen: false,

      addElement(kind, pos, opts = {}) {
        const def = REGISTRY[kind]
        if (countOf(get().elements, kind) >= def.maxCount) return ''
        const x = clampBound(pos[0])
        const z = clampBound(pos[2])
        const y = def.grounded ? sandHeight(x, z) : pos[1]
        const el: PlacedElement = {
          id: nanoid(8),
          kind,
          position: [x, y, z],
          rotationY: Math.random() * Math.PI * 2,
          scale: 0.8 + Math.random() * 0.4,
          variant: Math.floor(Math.random() * def.variants),
          seed: randSeed(),
          color: COLORS.coral[Math.floor(Math.random() * COLORS.coral.length)],
          createdAt: Date.now(),
          ...opts,
        }
        set((s) => ({ elements: [...s.elements, el], hintSeen: true }))
        return el.id
      },
      setElements: (elements) => set({ elements, selectedId: null }),
      moveElement(id, pos) {
        set((s) => ({
          elements: s.elements.map((e) => {
            if (e.id !== id) return e
            const def = REGISTRY[e.kind]
            const x = clampBound(pos[0])
            const z = clampBound(pos[2])
            return { ...e, position: [x, def.grounded ? sandHeight(x, z) : pos[1], z] as Vec3 }
          }),
        }))
      },
      rotateElement(id, delta) {
        set((s) => ({
          elements: s.elements.map((e) => (e.id === id ? { ...e, rotationY: e.rotationY + delta } : e)),
        }))
      },
      removeElement(id) {
        set((s) => ({
          elements: s.elements.filter((e) => e.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }))
      },
      clearAll: () => set({ elements: [], selectedId: null, moving: null }),
      select: (selectedId) => set({ selectedId }),
      startDrag: (kind) => set({ dragging: { kind }, selectedId: null }),
      endDrag: () => set({ dragging: null }),
      startMove: (moving) => set({ moving }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      markHintSeen: () => set({ hintSeen: true }),
    }),
    {
      name: 'reef-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ elements: s.elements, muted: s.muted, hintSeen: s.hintSeen }),
    },
  ),
)

export const clampBound = (v: number) => Math.max(-TERRAIN.bound, Math.min(TERRAIN.bound, v))

export function countOf(els: PlacedElement[], kind: ElementKind) {
  let n = 0
  for (const e of els) if (e.kind === kind) n++
  return n
}

/** Placement validity: under the cap, in bounds, and not overlapping another footprint. */
export function isValidSpot(kind: ElementKind, pos: Vec3, ignoreId?: string | null): boolean {
  const def = REGISTRY[kind]
  const els = useReefStore.getState().elements
  if (!ignoreId && countOf(els, kind) >= def.maxCount) return false
  if (Math.abs(pos[0]) > TERRAIN.bound || Math.abs(pos[2]) > TERRAIN.bound) return false
  if (!def.grounded) return true
  for (const e of els) {
    if (e.id === ignoreId) continue
    const o = REGISTRY[e.kind]
    if (!o.grounded) continue
    const d = Math.hypot(e.position[0] - pos[0], e.position[2] - pos[2])
    if (d < (def.footprint + o.footprint) * 0.75) return false
  }
  return true
}
