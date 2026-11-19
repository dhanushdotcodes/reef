import { useReefStore } from '../store/useReefStore'
import { ElementView } from './ElementView'

export function ElementsLayer() {
  const elements = useReefStore((s) => s.elements)
  return (
    <>
      {elements.map((el) => (
        <ElementView key={el.id} el={el} />
      ))}
    </>
  )
}
