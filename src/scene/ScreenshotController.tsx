import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

// EffectComposer renders at priority 1; we read the canvas right after it in the
// same frame, so the drawing buffer is still intact (no preserveDrawingBuffer needed).
const CAPTURE_PRIORITY = 2

let pending: ((blob: Blob | null) => void)[] = []

/** Capture the current 3D view as a PNG blob on the next rendered frame. */
export function captureScreenshot(): Promise<Blob | null> {
  return new Promise((resolve) => pending.push(resolve))
}

/** Capture the current view and download it as a PNG file. */
export async function downloadScreenshot() {
  const blob = await captureScreenshot()
  if (!blob) return false
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reef-${stamp}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export function ScreenshotController() {
  useFrame(({ gl }) => {
    if (!pending.length) return
    const waiters = pending
    pending = []
    // toBlob snapshots the bitmap synchronously; encoding happens async.
    gl.domElement.toBlob((blob) => waiters.forEach((w) => w(blob)), 'image/png')
  }, CAPTURE_PRIORITY)

  // "P" shortcut (ignored while typing or with modifiers held)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'p' || e.key === 'P') void downloadScreenshot()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
