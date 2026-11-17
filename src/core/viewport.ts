import * as THREE from 'three'
import { COLORS, VIEW } from '../config.ts'

/** Playable area in world units. Mutated in place when the window resizes. */
export type Bounds = {
  viewWidth: number
  viewHeight: number
  /** Fish swim between -swimHalf and +swimHalf on X. */
  swimHalf: number
  waterTop: number
  floor: number
}

export type Viewport = {
  renderer: THREE.WebGLRenderer
  camera: THREE.OrthographicCamera
  bounds: Bounds
  onResize: (listener: (bounds: Bounds) => void) => () => void
  render: (scene: THREE.Scene) => void
  dispose: () => void
}

export function createViewport(canvas: HTMLCanvasElement): Viewport {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const camera = new THREE.OrthographicCamera(-8, 8, 4, -4, 0.1, 40)
  camera.position.set(0, 4, VIEW.cameraZ)

  const bounds: Bounds = {
    viewWidth: VIEW.minWidth,
    viewHeight: VIEW.minHeight,
    swimHalf: VIEW.minWidth / 2 - VIEW.swimMargin,
    waterTop: VIEW.minHeight - VIEW.topMargin,
    floor: VIEW.floor,
  }

  const listeners = new Set<(bounds: Bounds) => void>()

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return

    // Keep at least minWidth x minHeight visible, expand the other axis.
    const aspect = width / height
    const wide = aspect > VIEW.minWidth / VIEW.minHeight
    const viewWidth = wide ? VIEW.minHeight * aspect : VIEW.minWidth
    const viewHeight = wide ? VIEW.minHeight : VIEW.minWidth / aspect

    camera.position.set(0, viewHeight / 2, VIEW.cameraZ)
    camera.lookAt(0, viewHeight / 2, 0)
    camera.left = -viewWidth / 2
    camera.right = viewWidth / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)

    bounds.viewWidth = viewWidth
    bounds.viewHeight = viewHeight
    bounds.swimHalf = viewWidth / 2 - VIEW.swimMargin
    bounds.waterTop = viewHeight - VIEW.topMargin
    for (const listener of listeners) listener(bounds)
  }

  window.addEventListener('resize', resize)
  resize()

  return {
    renderer,
    camera,
    bounds,
    onResize(listener) {
      listeners.add(listener)
      listener(bounds)
      return () => listeners.delete(listener)
    },
    render(scene) {
      renderer.render(scene, camera)
    },
    dispose() {
      window.removeEventListener('resize', resize)
      listeners.clear()
      renderer.dispose()
    },
  }
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.water.abyss)
  return scene
}
