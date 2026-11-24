/**
 * Spotfin Lionfish (Pterois antennata) tuning.
 *
 * Model space: 1 unit = 10 cm, +X = head, +Y = up, Z = width.
 * The fish is built at its real ~20 cm length (2 units) and scaled down by the
 * sandbox to SCENE_LENGTH, so every number here reads in "fish centimetres / 10".
 */
export interface LionfishParams {
  /** snout to tail tip */
  length: number
  /** max body depth / body length (body = snout to caudal peduncle, 78% of `length`) */
  bodyHeightRatio: number
  /** max body width / body length */
  bodyWidthRatio: number
  spineCount: number
  /** tallest dorsal spine / body depth */
  spineHeight: number
  /** fraction of each dorsal spine covered by membrane */
  membraneCoverage: number
  /** pectoral tip-to-tip span when flared / length */
  pectoralSpan: number
  bandCount: number
  bandWobble: number
  swimSpeed: number
  swimAmplitude: number
}

export const DEFAULT_PARAMS: LionfishParams = {
  length: 2,
  bodyHeightRatio: 0.55,
  bodyWidthRatio: 0.28,
  spineCount: 13,
  spineHeight: 1.1,
  membraneCoverage: 0.4,
  pectoralSpan: 0.9,
  bandCount: 20,
  bandWobble: 0.5,
  swimSpeed: 1,
  swimAmplitude: 1,
}

/** Fraction of `length` taken by the body loft; the caudal fin fills the rest. */
export const BODY_FRACTION = 0.78

export const DEFAULT_COLORS = {
  bandRed: '#b8361f',
  bandWhite: '#fff4e8',
  spotColor: '#2a1410',
  finTint: '#ffe6d6',
}
export type LionfishColors = typeof DEFAULT_COLORS

/** Length of a lionfish in the sandbox (scene units) at element scale 1. */
export const SCENE_LENGTH = 1.4

/** Params that change geometry (anything else is a uniform and updates live). */
export const GEOMETRY_KEYS = [
  'length', 'bodyHeightRatio', 'bodyWidthRatio', 'spineCount', 'spineHeight', 'membraneCoverage', 'pectoralSpan',
] as const satisfies readonly (keyof LionfishParams)[]

export const geometryKey = (p: LionfishParams) => GEOMETRY_KEYS.map((k) => p[k].toFixed(4)).join('|')

/**
 * Pectoral fan rig, shared by the geometry builder and the vertex shader.
 * Angles are in the fin plane, measured from +X (head); 180° points at the tail.
 * Flared (rest pose): rays spread from up-and-back to down-and-back, and the fan
 * is yawed out from the body like a wing. Folded: rays collapse into a narrow
 * bundle lying along the flank.
 */
export const PECTORAL = {
  restTop: (122 * Math.PI) / 180,
  restBottom: (248 * Math.PI) / 180,
  foldTop: (166 * Math.PI) / 180,
  foldBottom: (198 * Math.PI) / 180,
  yawFlared: 0.95,
  yawFolded: 0.1,
}
