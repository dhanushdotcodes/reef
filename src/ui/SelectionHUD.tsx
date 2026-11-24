import { Html } from '@react-three/drei'
import { useReefStore } from '../store/useReefStore'
import { OBSTACLE_HEIGHT } from '../elements/fish/shared/obstacles'
import { requestDelete } from '../scene/EditController'
import { playSound } from '../audio/audioEngine'
import s from './styles.module.css'

const STEP = Math.PI / 8

/** Floating rotate / delete controls above the selected element. */
export function SelectionHUD() {
  const el = useReefStore((st) => st.elements.find((e) => e.id === st.selectedId))
  const moving = useReefStore((st) => !!st.moving)
  const rotate = useReefStore((st) => st.rotateElement)
  if (!el || moving) return null
  const h = (OBSTACLE_HEIGHT[el.kind] ?? 1) * el.scale + 0.5
  const stop = (e: React.PointerEvent) => e.stopPropagation()
  return (
    <Html position={[el.position[0], el.position[1] + h, el.position[2]]} center zIndexRange={[5, 0]}>
      <div className={s.hud} data-ui onPointerDown={stop}>
        <button className={s.hudBtn} aria-label="Rotate left" onClick={() => { playSound('tick'); rotate(el.id, -STEP) }}>⟲</button>
        <button className={s.hudBtn} aria-label="Rotate right" onClick={() => { playSound('tick'); rotate(el.id, STEP) }}>⟳</button>
        <button className={`${s.hudBtn} ${s.hudDel}`} aria-label="Delete" onClick={() => requestDelete(el.id)}>🗑</button>
      </div>
    </Html>
  )
}
