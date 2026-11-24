import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import GUI from 'lil-gui'
import Stats from 'three/addons/libs/stats.module.js'
import { useReefStore } from '../../../store/useReefStore'
import { REGISTRY } from '../../registry'
import { FISH_BOUNDS } from '../../../config'
import { sandHeight } from '../../../utils/terrain'
import { FISH_SPECIES_IDS } from '../speciesIds'
import { exportLionfishGlb } from './exportGlb'
import { lionfishTuning, sharedLionfishAssets } from './lionfish'
import { lionfishStats, useLionfishAssetsVersion } from './LionfishSchool'
import { syncUniforms } from './shaders/materials'

const VARIANT = FISH_SPECIES_IDS.indexOf('lionfish')

/** Drop `n` lionfish at random spots with randomized size (the sim adds hue/phase/±15% size). */
export function spawnLionfish(n: number) {
  const st = useReefStore.getState()
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 2 * (FISH_BOUNDS.xz - 4)
    const z = (Math.random() - 0.5) * 2 * (FISH_BOUNDS.xz - 4)
    const y = Math.max(sandHeight(x, z) + 1, 1.2 + Math.random() * 3)
    st.addElement('fish', [x, y, z], { variant: VARIANT, createdAt: now + i * 120, silent: true, scale: 0.85 + Math.random() * 0.3 })
  }
}

/**
 * Live tuning panel. Open the app with `?lab` in the URL.
 * Geometry params rebuild the meshes on release; everything else is a uniform
 * or a pose override and updates instantly.
 */
export default function LionfishLab() {
  const stats = useRef<Stats | null>(null)
  const info = useRef({ triangles: '', drawCalls: 0, fish: 0 })

  useEffect(() => {
    const t = lionfishTuning
    const u = t.uniforms
    const gui = new GUI({ title: 'Spotfin Lionfish' })
    const bump = () => {
      useLionfishAssetsVersion.getState().bump()
      refreshTris()
    }
    const refreshTris = () => {
      const a = sharedLionfishAssets()
      info.current.triangles = a.lods.map((l, i) => `L${i} ${(l.triangles / 1000).toFixed(1)}k`).join(' · ')
    }
    refreshTris()

    const geo = gui.addFolder('Anatomy (rebuilds)')
    geo.add(t.params, 'length', 1.4, 2.8, 0.05).onFinishChange(bump)
    geo.add(t.params, 'bodyHeightRatio', 0.3, 0.75, 0.01).onFinishChange(bump)
    geo.add(t.params, 'bodyWidthRatio', 0.12, 0.45, 0.01).onFinishChange(bump)
    geo.add(t.params, 'spineCount', 7, 17, 1).onFinishChange(bump)
    geo.add(t.params, 'spineHeight', 0.5, 1.8, 0.01).onFinishChange(bump)
    geo.add(t.params, 'membraneCoverage', 0.1, 1, 0.01).onFinishChange(bump)
    geo.add(t.params, 'pectoralSpan', 0.4, 1.3, 0.01).onFinishChange(bump)

    const look = gui.addFolder('Pattern & colour')
    const sync = () => syncUniforms(u, t.params)
    look.add(t.params, 'bandCount', 6, 36, 1).onChange(sync)
    look.add(t.params, 'bandWobble', 0, 1.5, 0.01).onChange(sync)
    look.addColor(t.colors, 'bandRed').onChange((v: string) => u.uBandRed.value.set(v))
    look.addColor(t.colors, 'bandWhite').onChange((v: string) => u.uBandWhite.value.set(v))
    look.addColor(t.colors, 'spotColor').onChange((v: string) => u.uSpotColor.value.set(v))
    look.addColor(t.colors, 'finTint').onChange((v: string) => u.uFinTint.value.set(v))
    look.add(u.uGlow, 'value', 0, 1, 0.01).name('glow')

    const motion = gui.addFolder('Motion')
    motion.add(t.params, 'swimSpeed', 0, 3, 0.01).onChange(sync)
    motion.add(t.params, 'swimAmplitude', 0, 3, 0.01).onChange(sync)
    motion.add(t, 'pectoralFlare', -1, 1, 0.01).name('pectoralFlare (-1 auto)')
    motion.add(t, 'state', ['auto', 'idle', 'hover', 'swim', 'hunt', 'forage', 'defend'])
    motion.add(t, 'lod', { auto: -1, 'LOD0 (~15k)': 0, 'LOD1 (~4k)': 1 }).name('LOD')

    const actions = {
      spawn20: () => spawnLionfish(20),
      clearFish: () => {
        const st = useReefStore.getState()
        st.setElements(st.elements.filter((e) => e.kind !== 'fish'))
      },
      exportGlb: () => exportLionfishGlb(sharedLionfishAssets()),
    }
    gui.add(actions, 'spawn20').name(`Spawn 20 lionfish (max ${REGISTRY.fish.maxCount})`)
    gui.add(actions, 'clearFish').name('Remove all fish')
    gui.add(actions, 'exportGlb').name('Export GLB')

    const infoF = gui.addFolder('Info')
    infoF.add(info.current, 'triangles').name('tris / fish').listen().disable()
    infoF.add(info.current, 'fish').name('lionfish').listen().disable()
    infoF.add(info.current, 'drawCalls').name('fish draw calls').listen().disable()

    const s = new Stats()
    s.dom.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100'
    document.body.appendChild(s.dom)
    stats.current = s
    return () => {
      gui.destroy()
      s.dom.remove()
      stats.current = null
    }
  }, [])

  useFrame(() => {
    stats.current?.update()
    info.current.drawCalls = lionfishStats.drawCalls
    info.current.fish = lionfishStats.count
  })
  return null
}
