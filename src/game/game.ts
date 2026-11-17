import { createDisposables } from '../core/disposables.ts'
import { startLoop } from '../core/loop.ts'
import { createScene, createViewport } from '../core/viewport.ts'
import { createEnvironment } from '../entities/environment.ts'
import { createRays } from '../entities/rays.ts'
import { createSpawners } from '../entities/spawners.ts'
import { runSystems } from '../systems/index.ts'
import { createState } from './state.ts'
import type { World } from './world.ts'

export type Game = { dispose: () => void }

/** Composition root: builds every layer once and connects them. */
export function createGame(canvas: HTMLCanvasElement): Game {
  const disposables = createDisposables()
  const viewport = createViewport(canvas)
  const scene = createScene()
  const state = createState()

  const world: World = {
    scene,
    bounds: viewport.bounds,
    state,
    spawn: createSpawners(scene, disposables),
  }

  state.rays = createRays(scene, disposables, viewport)
  const environment = createEnvironment(scene, disposables, viewport)

  const stopLoop = startLoop((dt, time) => {
    runSystems(world, dt, time)
    environment.update(time)
    viewport.render(scene)
  })

  return {
    dispose() {
      stopLoop()
      disposables.disposeAll()
      viewport.dispose()
    },
  }
}
