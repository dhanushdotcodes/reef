import { nanoid } from 'nanoid'
import type { ElementKind, PlacedElement } from '../types'
import { REGISTRY } from '../elements/registry'
import { COLORS, STARTER_SEED } from '../config'
import { mulberry32 } from '../utils/random'
import { sandHeight } from '../utils/terrain'
import { useReefStore } from './useReefStore'

const STORAGE_KEY = 'reef-v1'

/** Seeded default reef, only when nothing has ever been saved. Silent; grow animations are staggered. */
export function seedStarterReef() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return
  } catch {
    /* storage blocked: still seed in memory */
  }
  const r = mulberry32(STARTER_SEED)
  const els: PlacedElement[] = []
  const t0 = Date.now() + 300
  let n = 0

  const place = (kind: ElementKind, area: [number, number, number, number], extra: Partial<PlacedElement> = {}) => {
    const def = REGISTRY[kind]
    for (let tries = 0; tries < 40; tries++) {
      const x = area[0] + r() * (area[1] - area[0])
      const z = area[2] + r() * (area[3] - area[2])
      const ok = els.every((e) => {
        const o = REGISTRY[e.kind]
        return !o.grounded || Math.hypot(e.position[0] - x, e.position[2] - z) > (def.footprint + o.footprint) * 0.85
      })
      if (!ok) continue
      els.push({
        id: nanoid(8), kind, position: [x, sandHeight(x, z), z], rotationY: r() * Math.PI * 2,
        scale: 0.85 + r() * 0.35, variant: Math.floor(r() * def.variants), seed: Math.floor(r() * 2 ** 31),
        color: COLORS.coral[Math.floor(r() * COLORS.coral.length)], createdAt: t0 + n++ * 170, silent: true, ...extra,
      })
      return
    }
  }

  place('wall', [-7, -4, -6, -3], { variant: 0 })
  for (let i = 0; i < 4; i++) place('rock', [-8, 8, -4, 3])
  for (let i = 0; i < 3; i++) place('coral', [-5, 5, -2, 3])
  for (let i = 0; i < 2; i++) place('kelp', [-8, 8, -5, 0])
  // lionfish are solitary hoverers: a handful reads better than a school
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 8, z = (r() - 0.5) * 6
    els.push({
      id: nanoid(8), kind: 'fish', position: [x, 2 + r() * 2.5, z], rotationY: 0, scale: 0.9 + r() * 0.3,
      variant: 0, seed: Math.floor(r() * 2 ** 31), createdAt: t0 + 1200 + i * 220, silent: true,
    })
  }
  useReefStore.getState().setElements(els)
}
