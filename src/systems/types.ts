import type { World } from '../game/world.ts'

/** A system advances one aspect of the world each frame. */
export type System = (world: World, dt: number, time: number) => void
