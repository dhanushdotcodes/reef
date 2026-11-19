import type { ElementDef, ElementKind } from '../types'

export const REGISTRY: Record<ElementKind, ElementDef> = {
  rock: {
    kind: 'rock', label: 'Rock', icon: '🪨', grounded: true, footprint: 1.0, maxCount: 60,
    variants: 3, onPlaceSound: 'thud', onPlaceFx: ['sandPuff', 'dustRing', 'shake'], landTime: 0.42,
  },
  coral: {
    kind: 'coral', label: 'Coral', icon: '🪸', grounded: true, footprint: 0.9, maxCount: 60,
    variants: 3, onPlaceSound: 'chime', onPlaceFx: ['sparkle', 'sandPuff'], landTime: 0.9,
  },
  kelp: {
    kind: 'kelp', label: 'Kelp', icon: '🌿', grounded: true, footprint: 0.6, maxCount: 40,
    variants: 3, onPlaceSound: 'swoosh', onPlaceFx: ['sandPuff'], landTime: 0.1,
  },
  wall: {
    kind: 'wall', label: 'Ruins', icon: '🏛️', grounded: true, footprint: 1.9, maxCount: 20,
    variants: 3, onPlaceSound: 'heavyThud', onPlaceFx: ['sandPuff', 'dustRing', 'shake'], landTime: 0.55,
  },
  fish: {
    kind: 'fish', label: 'Fish', icon: '🐠', grounded: false, footprint: 0.3, maxCount: 200,
    variants: 3, onPlaceSound: 'blup', onPlaceFx: ['bubbleBurst'], landTime: 0,
  },
  shell: {
    kind: 'shell', label: 'Shell', icon: '🐚', grounded: true, footprint: 0.4, maxCount: 40,
    variants: 2, onPlaceSound: 'click', onPlaceFx: ['sandPuff'], landTime: 0.35,
  },
  chest: {
    kind: 'chest', label: 'Chest', icon: '🧰', grounded: true, footprint: 1.0, maxCount: 5,
    variants: 1, onPlaceSound: 'thud', onPlaceFx: ['sandPuff', 'sparkle'], landTime: 0.4,
  },
  bubbles: {
    kind: 'bubbles', label: 'Vent', icon: '🫧', grounded: true, footprint: 0.7, maxCount: 8,
    variants: 2, onPlaceSound: 'thud', onPlaceFx: ['sandPuff'], landTime: 0.4,
  },
}

export const KINDS = Object.keys(REGISTRY) as ElementKind[]
