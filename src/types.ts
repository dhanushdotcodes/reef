export type ElementKind =
  | 'rock'
  | 'coral'
  | 'kelp'
  | 'wall'
  | 'fish'
  | 'shell'
  | 'chest'
  | 'bubbles'

export type SoundName =
  | 'thud'
  | 'splash'
  | 'blup'
  | 'chime'
  | 'crunch'
  | 'swoosh'
  | 'click'
  | 'shimmer'
  | 'whoomp'
  | 'tick'
  | 'heavyThud'

export type FxName = 'sandPuff' | 'dustRing' | 'bubbleBurst' | 'sparkle' | 'shake'

export type Vec3 = [number, number, number]

/** Plain JSON. Everything needed to rebuild a placed element deterministically. */
export interface PlacedElement {
  id: string
  kind: ElementKind
  /** y is snapped to sandHeight(x,z) for grounded items */
  position: Vec3
  rotationY: number
  scale: number
  variant: number
  seed: number
  color?: string
  /** ms epoch; drives spawn animations. May be in the future for staggered starts. */
  createdAt: number
  /** Skip sound/fx (starter reef) */
  silent?: boolean
}

export interface ElementDef {
  kind: ElementKind
  label: string
  icon: string
  grounded: boolean
  footprint: number
  maxCount: number
  variants: number
  onPlaceSound: SoundName
  onPlaceFx: FxName[]
  /** seconds until the element visually lands; sound/fx are scheduled then */
  landTime: number
}
