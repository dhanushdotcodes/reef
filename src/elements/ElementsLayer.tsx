import { useReefStore } from '../store/useReefStore'
import { ElementView } from './ElementView'

export const ELEMENTS_GROUP = 'elements'

export function ElementsLayer() {
  const elements = useReefStore((s) => s.elements)
  const moving = useReefStore((s) => s.moving)
  return (
    <group name={ELEMENTS_GROUP}>
      {elements.map((el) => (el.id === moving ? null : <ElementView key={el.id} el={el} />))}
    </group>
  )
}
