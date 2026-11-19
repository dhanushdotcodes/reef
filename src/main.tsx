import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  void Promise.all([import('./fx/fxBus'), import('./store/useReefStore'), import('./elements/placeEffects')]).then(
    ([fx, store, pe]) => {
      ;(window as unknown as Record<string, unknown>).__reef = { ...fx, ...store, ...pe }
    },
  )
}
