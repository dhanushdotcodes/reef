import { useRef } from 'react'
import type { ElementDef } from '../types'
import { useReefStore, countOf } from '../store/useReefStore'
import { playSound } from '../audio/audioEngine'
import s from './styles.module.css'

export function ToolbarItem({ def }: { def: ElementDef }) {
  const full = useReefStore((st) => countOf(st.elements, def.kind) >= def.maxCount)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)

  const begin = () => {
    playSound('tick')
    useReefStore.getState().startDrag(def.kind)
  }

  return (
    <button
      className={s.item}
      disabled={full}
      aria-label={`Drag ${def.label} onto the seabed`}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') {
          // touch: only begin on a vertical drag so the bar still scrolls sideways
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
        } else {
          e.preventDefault()
          begin()
        }
      }}
      onPointerMove={(e) => {
        const st = start.current
        if (!st || st.id !== e.pointerId) return
        const dx = e.clientX - st.x, dy = e.clientY - st.y
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.2) {
          start.current = null
          begin()
        }
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && playSound('tick', 0.5)}
    >
      <span className={s.icon}>{def.icon}</span>
      {def.label}
    </button>
  )
}
