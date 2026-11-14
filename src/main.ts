import './style.css'
import { createReef } from './scene.ts'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app')

const canvas = document.createElement('canvas')
root.append(canvas)

const hint = document.createElement('p')
hint.className = 'hint'
hint.textContent = 'Drag to orbit · scroll to zoom'
root.append(hint)

const reef = createReef(canvas)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    reef.dispose()
  })
}
