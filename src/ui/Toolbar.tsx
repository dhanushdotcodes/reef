import { KINDS, REGISTRY } from '../elements/registry'
import { ENABLED_KINDS } from '../elements/ElementView'
import { useReefStore } from '../store/useReefStore'
import { ToolbarItem } from './ToolbarItem'
import s from './styles.module.css'

export function Toolbar() {
  const hintSeen = useReefStore((st) => st.hintSeen)
  const dragging = useReefStore((st) => !!st.dragging)
  return (
    <div className={s.toolbarWrap}>
      <div className={`${s.hint} ${hintSeen || dragging ? s.hintHidden : ''}`}>Drag items onto the seabed ↓</div>
      <div className={s.toolbar} data-ui>
        {KINDS.filter((k) => ENABLED_KINDS.has(k)).map((k) => (
          <ToolbarItem key={k} def={REGISTRY[k]} />
        ))}
      </div>
    </div>
  )
}
