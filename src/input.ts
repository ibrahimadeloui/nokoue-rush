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
  private fired = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKey)
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onCancel)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('touchstart', this.blockScroll, { passive: false })
    canvas.addEventListener('touchmove', this.blockScroll, { passive: false })
    window.addEventListener('gesturestart', this.blockScroll, { capture: true })
    window.addEventListener('wheel', this.blockScroll, { passive: false, capture: true })
  }

  drain(): Action[] {
    const batch = this.queue
    this.queue = []
    return batch
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onCancel)
    this.canvas.removeEventListener('touchstart', this.blockScroll)
    this.canvas.removeEventListener('touchmove', this.blockScroll)
    window.removeEventListener('gesturestart', this.blockScroll, { capture: true } as EventListenerOptions)
    window.removeEventListener('wheel', this.blockScroll, { capture: true } as EventListenerOptions)
  }

  private push(action: Action): void {
    if (this.queue.length > 6) this.queue.shift()
    this.queue.push(action)
  }

  private threshold(): number {
    return Math.max(14, Math.min(window.innerWidth, window.innerHeight) * 0.032)
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
    this.fired = false
    try {
      this.canvas.setPointerCapture(event.pointerId)
    } catch {
      /* capture optionnelle */
    }
  }

  private onMove = (event: PointerEvent): void => {
    if (!this.start || this.fired) return
    this.maybeSwipe(event.clientX - this.start.x, event.clientY - this.start.y)
  }

  private onCancel = (): void => {
    this.start = null
    this.fired = false
  }

  private onUp = (event: PointerEvent): void => {
    if (!this.start) return
    const dx = event.clientX - this.start.x
    const dy = event.clientY - this.start.y
    const dt = performance.now() - this.start.t
    this.start = null
    if (this.fired) return
    if (this.maybeSwipe(dx, dy)) return
    if (dt < 420) this.onTap()
  }

  private maybeSwipe(dx: number, dy: number): boolean {
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const need = this.threshold()
    if (Math.max(adx, ady) < need) return false
    this.fired = true
    this.lastTap = 0
    if (adx > ady * 1.05) this.push(dx > 0 ? 'right' : 'left')
    else this.push(dy > 0 ? 'down' : 'up')
    return true
  }

  private onTap(): void {
    const now = performance.now()
    if (now - this.lastTap < 300) {
      this.push('board')
      this.lastTap = 0
      return
    }
    this.lastTap = now
    this.push('up')
  }

  private blockScroll = (event: Event): void => {
    event.preventDefault()
  }
}
