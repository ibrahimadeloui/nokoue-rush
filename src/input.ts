export type Action = 'left' | 'right' | 'up' | 'down' | 'pause' | 'board' | 'mute'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  KeyQ: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  KeyZ: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'up',
  KeyF: 'board',
  ShiftLeft: 'board',
  ShiftRight: 'board',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
}

export class Input {
  private queue: Action[] = []
  private start: { x: number; y: number; t: number } | null = null
  private lastTap = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKey)
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onCancel)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
  }

  drain(): Action[] {
    const batch = this.queue
    this.queue = []
    return batch
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onCancel)
  }

  private push(action: Action): void {
    if (this.queue.length > 6) this.queue.shift()
    this.queue.push(action)
  }

  private onKey = (event: KeyboardEvent): void => {
    if (event.repeat) return
    const action = KEYS[event.code]
    if (!action) return
    event.preventDefault()
    this.push(action)
  }

  private onDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    this.start = { x: event.clientX, y: event.clientY, t: performance.now() }
  }

  private onCancel = (): void => {
    this.start = null
  }

  private onUp = (event: PointerEvent): void => {
    if (!this.start) return
    const dx = event.clientX - this.start.x
    const dy = event.clientY - this.start.y
    const dt = performance.now() - this.start.t
    this.start = null
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx < 22 && ady < 22 && dt < 320) {
      const now = performance.now()
      if (now - this.lastTap < 340) {
        this.push('board')
        this.lastTap = 0
      } else {
        this.lastTap = now
      }
      return
    }
    if (Math.max(adx, ady) < 28) return
    if (adx > ady * 1.15) this.push(dx > 0 ? 'right' : 'left')
    else this.push(dy > 0 ? 'down' : 'up')
  }
}
