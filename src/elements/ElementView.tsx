import { memo } from 'react'
import type { PlacedElement } from '../types'
import { Rock } from './Rock'
import { Coral } from './Coral'
import { Kelp } from './Kelp'
import { Wall } from './Wall'
import { Shell } from './Shell'
import { Chest } from './Chest'
import { BubbleVent } from './BubbleVent'

export const ENABLED_KINDS = new Set(['rock', 'coral', 'kelp', 'wall', 'shell', 'chest', 'bubbles'])

/** Maps an element to its procedural component. Swap any of these for a GLTF later. */
export const ElementView = memo(function ElementView({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  switch (el.kind) {
    case 'rock': return <Rock el={el} ghost={ghost} />
    case 'coral': return <Coral el={el} ghost={ghost} />
    case 'kelp': return <Kelp el={el} ghost={ghost} />
    case 'wall': return <Wall el={el} ghost={ghost} />
    case 'shell': return <Shell el={el} ghost={ghost} />
    case 'chest': return <Chest el={el} ghost={ghost} />
    case 'bubbles': return <BubbleVent el={el} ghost={ghost} />
    default: return null
  }
})
