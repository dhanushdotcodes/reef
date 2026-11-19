import { memo } from 'react'
import type { PlacedElement } from '../types'
import { Rock } from './Rock'

export const ENABLED_KINDS = new Set(['rock'])

/** Maps an element to its procedural component. Swap any of these for a GLTF later. */
export const ElementView = memo(function ElementView({ el, ghost }: { el: PlacedElement; ghost?: boolean }) {
  switch (el.kind) {
    case 'rock':
      return <Rock el={el} ghost={ghost} />
    default:
      return null
  }
})
