import * as THREE from 'three'
import { COLORS } from '../config.ts'
import type { Disposables } from '../core/disposables.ts'
import { rand } from '../core/math.ts'
import type { Viewport } from '../core/viewport.ts'
import type { Ray } from '../game/types.ts'

/** Soft-edged beam texture: gaussian across, fading out toward the bottom. */
function createBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')

  for (let x = 0; x < canvas.width; x++) {
    const d = (x / (canvas.width - 1) - 0.5) / 0.2
    ctx.fillStyle = `rgba(255,255,255,${Math.exp(-d * d)})`
    ctx.fillRect(x, 0, 1, canvas.height)
  }
  ctx.globalCompositeOperation = 'destination-in'
  const fade = ctx.createLinearGradient(0, 0, 0, canvas.height)
  fade.addColorStop(0, 'rgba(255,255,255,1)')
  fade.addColorStop(0.6, 'rgba(255,255,255,0.35)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createRays(
  scene: THREE.Scene,
  disposables: Disposables,
  viewport: Viewport,
  count = 7,
): Ray[] {
  const texture = createBeamTexture()
  const geometry = disposables.geometry(new THREE.PlaneGeometry(1, 1))
  geometry.translate(0, -0.5, 0) // anchor at the top edge so tilting swings the beam from the surface

  const rays: Ray[] = Array.from({ length: count }, (_, i) => {
    const material = disposables.material(
      new THREE.MeshBasicMaterial({
        map: texture,
        color: COLORS.water.foam,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = -1
    const group = new THREE.Group()
    group.position.z = -5
    group.add(mesh)
    scene.add(group)

    return {
      group,
      material,
      xFrac: (i + rand(0.1, 0.9)) / count - 0.5,
      tilt: rand(-0.32, -0.08), // all lean the same way, like one sun
      maxOpacity: rand(0.16, 0.34),
      phase: [rand(0, 6.28), rand(0, 6.28)],
      speed: [rand(0.08, 0.2), rand(0.17, 0.4)],
    }
  })

  // widths are per-ray, so remember them for resize
  const widths = rays.map(() => rand(1.4, 3.2))

  viewport.onResize((bounds) => {
    rays.forEach((ray, i) => {
      const width = widths[i] ?? 2
      ray.group.position.x = ray.xFrac * bounds.viewWidth
      ray.group.position.y = bounds.viewHeight + 0.6
      ray.group.rotation.z = ray.tilt
      ray.group.scale.set(width, bounds.viewHeight * 1.5, 1)
    })
  })

  const originalDispose = geometry.dispose.bind(geometry)
  geometry.dispose = () => {
    texture.dispose()
    originalDispose()
  }

  return rays
}
