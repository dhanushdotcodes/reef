import { useState } from 'react'
import { useReefStore } from '../store/useReefStore'
import { playSound } from '../audio/audioEngine'
import { downloadScreenshot } from '../scene/ScreenshotController'
import { resetView } from '../scene/CameraRig'
import s from './styles.module.css'

export function TopBar() {
  const muted = useReefStore((st) => st.muted)
  const toggleMute = useReefStore((st) => st.toggleMute)
  const clearAll = useReefStore((st) => st.clearAll)
  const count = useReefStore((st) => st.elements.length)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={s.topBar}>
      <div className={s.title}>Reef</div>
      <div className={s.actions} data-ui>
        {confirming ? (
          <div className={s.confirm}>
            Clear the whole reef?
            <button
              className={`${s.pill} ${s.danger}`}
              onClick={() => {
                clearAll()
                playSound('whoomp')
                setConfirming(false)
              }}
            >
              Clear
            </button>
            <button className={s.pill} onClick={() => setConfirming(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button className={s.pill} disabled={!count} onClick={() => setConfirming(true)} style={{ opacity: count ? 1 : 0.5 }}>
            Clear reef
          </button>
        )}
        <button
          className={s.pill}
          title="Reset view (H)"
          onClick={() => {
            playSound('tick')
            resetView()
          }}
        >
          Reset view
        </button>
        <button
          className={s.pill}
          aria-label="Take screenshot"
          title="Screenshot (P)"
          onClick={() => {
            playSound('tick')
            void downloadScreenshot()
          }}
        >
          📷
        </button>
        <button className={s.pill} aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
