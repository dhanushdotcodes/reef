import './style.css'
import { createGame } from './game/game.ts'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app')

const canvas = document.createElement('canvas')
root.append(canvas)

const game = createGame(canvas)

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose())
}
