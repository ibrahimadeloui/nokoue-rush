import '@fontsource/lilita-one'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './style.css'
import { BOARDS, formatCauris, type BoardId } from './boards'
import { Game, type Snapshot } from './game'

const ART: Record<BoardId, string> = {
  pirogue: `<svg viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" rx="16" fill="#d7eef8"/><path d="M14 58c10-22 28-30 46-30s36 8 46 30c-16 6-30 6-46 0-14 8-28 8-46 0z" fill="#1d6fa8"/><path d="M28 54c12-4 24-4 36 0" stroke="#f7fbff" stroke-width="3" fill="none"/><path d="M36 48c8-3 16-3 24 0" stroke="#f7fbff" stroke-width="3" fill="none"/><ellipse cx="60" cy="62" rx="28" ry="5" fill="#7af0e4" opacity=".7"/></svg>`,
  wax: `<svg viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" rx="16" fill="#fde2dc"/><rect x="18" y="34" width="84" height="24" rx="8" fill="#c0392b"/><path d="M48 36l12 12-12 12-12-12z" fill="#111"/><path d="M60 40l8 8-8 8-8-8z" fill="#f0c430"/><path d="M34 42l6 6-6 6-6-6z" fill="#f0c430"/><path d="M86 42l6 6-6 6-6-6z" fill="#111"/><ellipse cx="60" cy="66" rx="30" ry="5" fill="#e23b32" opacity=".45"/></svg>`,
  taxi: `<svg viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" rx="16" fill="#fff4cc"/><rect x="16" y="36" width="88" height="22" rx="7" fill="#f0c430"/><rect x="16" y="46" width="88" height="6" fill="#1f8a4c"/><g fill="#111"><rect x="24" y="40" width="8" height="8"/><rect x="40" y="40" width="8" height="8"/><rect x="56" y="40" width="8" height="8"/><rect x="72" y="40" width="8" height="8"/><rect x="88" y="40" width="8" height="8"/></g><rect x="36" y="18" width="48" height="16" rx="3" fill="#173024"/><text x="60" y="30" text-anchor="middle" font-size="8" fill="#f0c430" font-family="Nunito,sans-serif">PORTO-NOVO</text></svg>`,
  palais: `<svg viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" rx="16" fill="#f6e4d4"/><rect x="16" y="34" width="88" height="24" rx="6" fill="#c4785a"/><rect x="48" y="38" width="24" height="16" fill="#0f766e"/><circle cx="40" cy="46" r="5" fill="#14988f"/><circle cx="80" cy="46" r="5" fill="#14988f"/><rect x="28" y="40" width="10" height="4" fill="#f0c430"/><rect x="82" y="48" width="10" height="4" fill="#f0c430"/><path d="M60 30l4 6h-8z" fill="#f0c430"/></svg>`,
}

class Ui {
  private shop = false
  private shopFrom: 'menu' | 'over' = 'menu'
  private game: Game | null = null
  private built = ''

  private readonly title = must('#title')
  private readonly shopEl = must('#shop')
  private readonly hud = must('#hud')
  private readonly pause = must('#pause')
  private readonly over = must('#over')
  private readonly toast = must('#toast')
  private readonly vignette = must('#vignette')

  attach(game: Game): void {
    this.game = game
    on('#play', () => this.start())
    on('#retry', () => this.start())
    on('#open-shop', () => this.openShop('menu'))
    on('#over-shop', () => this.openShop('over'))
    on('#shop-back', () => this.closeShop())
    on('#pause-btn', () => game.pause())
    on('#resume', () => game.resume())
    on('#abandon', () => {
      this.shop = false
      game.menu()
    })
    on('#home', () => {
      this.shop = false
      game.menu()
    })
    on('#mute-title', () => game.toggleMute())
    on('#mute-pause', () => game.toggleMute())
    on('#board-btn', () => game.activate())
    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.code !== 'Enter') return
      const phase = document.body.dataset.phase
      if (this.shop) return
      if (phase === 'menu' || phase === 'over') this.start()
    })
  }

  sync(snapshot: Snapshot): void {
    document.body.dataset.phase = snapshot.phase
    const showTitle = snapshot.phase === 'menu' && !this.shop
    const showOver = snapshot.phase === 'over' && !this.shop
    const showPause = snapshot.phase === 'paused'
    const showHud = snapshot.phase === 'playing' || snapshot.phase === 'paused'
    this.title.classList.toggle('hidden', !showTitle)
    this.shopEl.classList.toggle('hidden', !this.shop)
    this.hud.classList.toggle('hidden', !showHud)
    this.pause.classList.toggle('hidden', !showPause)
    this.over.classList.toggle('hidden', !showOver)
    this.vignette.classList.toggle('on', snapshot.danger && snapshot.phase !== 'menu')

    text('#best', formatCauris(snapshot.best))
    text('#purse', formatCauris(snapshot.wallet))
    text('#equipped', `Planche · ${nameOf(snapshot.equipped)}`)
    text('#shop-purse', formatCauris(snapshot.wallet))
    text('#run-cauris', formatCauris(snapshot.caurisRun))
    text('#score', formatCauris(snapshot.score))
    text('#mult', `×${snapshot.multiplier}`)
    must('#score').classList.toggle('hot', snapshot.chasingRecord || snapshot.multiplier >= 3)
    text('#hint', snapshot.hint)
    text('#cop-line', snapshot.line || 'La course s’arrête ici.')
    text('#over-score', formatCauris(snapshot.score))
    text('#over-best', formatCauris(snapshot.best))
    text('#over-run', formatCauris(snapshot.caurisRun))
    text('#over-wallet', formatCauris(snapshot.wallet))
    must('#new-best').classList.toggle('hidden', !snapshot.newBest)
    must('#danger').classList.toggle('hidden', !(snapshot.danger && snapshot.phase === 'playing'))

    const toast = snapshot.toast
    this.toast.classList.toggle('hidden', toast.length === 0)
    if (toast) this.toast.textContent = toast

    const boardBtn = must<HTMLButtonElement>('#board-btn')
    if (snapshot.shield) {
      boardBtn.textContent = 'Protégée'
      boardBtn.disabled = true
    } else if (snapshot.boardUsed) {
      boardBtn.textContent = 'Planche utilisée'
      boardBtn.disabled = true
    } else {
      boardBtn.textContent = 'Planche'
      boardBtn.disabled = snapshot.phase !== 'playing'
    }

    const muteLabel = snapshot.muted ? 'Remettre le son' : 'Couper le son'
    must('#mute-title').classList.toggle('muted', snapshot.muted)
    must('#mute-title').setAttribute('aria-label', muteLabel)
    text('#mute-pause', muteLabel)

    if (this.shop) this.renderShop(snapshot)
  }

  private start(): void {
    this.shop = false
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    this.game?.play()
  }

  private openShop(from: 'menu' | 'over'): void {
    this.shopFrom = from
    this.shop = true
    this.built = ''
    this.game?.snapshot && this.renderShop(this.game.snapshot())
  }

  private closeShop(): void {
    this.shop = false
    if (this.game) this.sync(this.game.snapshot())
  }

  private renderShop(snapshot: Snapshot): void {
    const signature = `${snapshot.wallet}|${snapshot.equipped}|${snapshot.owned.join(',')}`
    text('#shop-purse', formatCauris(snapshot.wallet))
    if (signature === this.built) return
    this.built = signature
    const list = must('#shop-list')
    list.replaceChildren()
    for (const board of BOARDS) {
      const owned = snapshot.owned.includes(board.id)
      const equipped = snapshot.equipped === board.id
      const card = document.createElement('article')
      card.className = `board${equipped ? ' on' : ''}`
      const art = document.createElement('div')
      art.innerHTML = ART[board.id]
      const copy = document.createElement('div')
      const title = document.createElement('h3')
      title.textContent = board.name
      const tag = document.createElement('p')
      tag.className = 'tagline'
      tag.textContent = board.tagline
      const desc = document.createElement('p')
      desc.className = 'desc'
      desc.textContent = board.description
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'btn small'
      if (equipped) {
        button.textContent = 'Équipée'
        button.disabled = true
      } else if (owned) {
        button.textContent = 'Équiper'
        button.addEventListener('click', () => this.game?.equip(board.id))
      } else if (snapshot.wallet < board.price) {
        button.textContent = `Encore ${formatCauris(board.price - snapshot.wallet)} cauris`
        button.disabled = true
      } else {
        button.textContent = `Acheter · ${formatCauris(board.price)}`
        button.classList.add('secondary')
        button.addEventListener('click', () => this.game?.buy(board.id))
      }
      copy.append(title, tag, desc, button)
      card.append(art, copy)
      list.append(card)
    }
  }
}

function must<T extends Element = HTMLElement>(selector: string): T {
  const node = document.querySelector(selector)
  if (!node) throw new Error(`Introuvable : ${selector}`)
  return node as T
}

function on(selector: string, fn: () => void): void {
  must<HTMLButtonElement>(selector).addEventListener('click', fn)
}

function text(selector: string, value: string): void {
  const node = must(selector)
  if (node.textContent !== value) node.textContent = value
}

function nameOf(id: BoardId): string {
  return BOARDS.find((board) => board.id === id)?.name ?? id
}

const canvas = must<HTMLCanvasElement>('#view')
const ui = new Ui()

try {
  const game = new Game(canvas, (snapshot) => ui.sync(snapshot))
  ui.attach(game)
  const api = {
    play: () => game.play(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    menu: () => game.menu(),
    mute: () => game.toggleMute(),
    buy: (id: BoardId) => game.buy(id),
    equip: (id: BoardId) => game.equip(id),
    activate: () => game.activate(),
    state: () => game.snapshot(),
    debugSpawn: (kind: string, lane: number) => game.debugSpawn(kind, lane),
    debugVault: (kind: string, lane: number) => game.debugVault(kind, lane),
    debugClear: () => game.debugClear(),
    debugWallet: (n: number) => game.debugWallet(n),
    openShop: () => {
      must('#open-shop').click()
    },
  }
  window.__nokoue = api
} catch (error) {
  console.error(error)
  const note = document.createElement('p')
  note.className = 'fatal'
  note.textContent = 'WebGL est nécessaire pour jouer à Nokoué Rush sur cet appareil.'
  document.body.append(note)
}

declare global {
  interface Window {
    __nokoue?: {
      play: () => void
      pause: () => void
      resume: () => void
      menu: () => void
      mute: () => void
      buy: (id: BoardId) => boolean
      equip: (id: BoardId) => void
      activate: () => boolean
      state: () => Snapshot
      debugSpawn: (kind: string, lane: number) => void
      debugVault: (kind: string, lane: number) => void
      debugClear: () => void
      debugWallet: (n: number) => void
      openShop: () => void
    }
  }
}
