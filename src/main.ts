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
  private overlay: 'none' | 'shop' | 'missions' | 'board' = 'none'
  private shopFrom: 'menu' | 'over' = 'menu'
  private game: Game | null = null
  private built = ''
  private missionBuilt = ''

  private readonly title = must('#title')
  private readonly shopEl = must('#shop')
  private readonly missionsEl = must('#missions')
  private readonly boardEl = must('#board')
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
    on('#shop-back', () => this.closeOverlay())
    on('#open-missions', () => this.openMissions())
    on('#missions-back', () => this.closeOverlay())
    on('#open-board', () => void this.openBoard())
    on('#board-back', () => this.closeOverlay())
    on('#pause-btn', () => game.pause())
    on('#resume', () => game.resume())
    on('#abandon', () => {
      this.overlay = 'none'
      game.menu()
    })
    on('#home', () => {
      this.overlay = 'none'
      game.menu()
    })
    on('#mute-title', () => game.toggleMute())
    on('#mute-pause', () => game.toggleMute())
    on('#mute-hud', () => game.toggleMute())
    on('#board-btn', () => game.activate())
    on('#publish', () => {
      game.setPseudo(must<HTMLInputElement>('#pseudo').value)
      game.publishNow()
    })
    on('#daily-claim', () => game.claim('daily'))
    must<HTMLInputElement>('#pseudo').addEventListener('change', () => {
      game.setPseudo(must<HTMLInputElement>('#pseudo').value)
    })
    must<HTMLInputElement>('#board-pseudo').addEventListener('change', () => {
      game.setPseudo(must<HTMLInputElement>('#board-pseudo').value)
      void this.openBoard()
    })
    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.code !== 'Enter') return
      if (event.target instanceof HTMLInputElement) return
      const phase = document.body.dataset.phase
      if (this.overlay !== 'none') return
      if (phase === 'menu' || phase === 'over') this.start()
    })
  }

  sync(snapshot: Snapshot): void {
    document.body.dataset.phase = snapshot.phase
    const showTitle = snapshot.phase === 'menu' && this.overlay === 'none'
    const showOver = snapshot.phase === 'over' && this.overlay === 'none'
    const showPause = snapshot.phase === 'paused'
    const showHud = snapshot.phase === 'playing' || snapshot.phase === 'paused'
    this.title.classList.toggle('hidden', !showTitle)
    this.shopEl.classList.toggle('hidden', this.overlay !== 'shop')
    this.missionsEl.classList.toggle('hidden', this.overlay !== 'missions')
    this.boardEl.classList.toggle('hidden', this.overlay !== 'board')
    this.hud.classList.toggle('hidden', !showHud)
    this.pause.classList.toggle('hidden', !showPause)
    this.over.classList.toggle('hidden', !showOver)
    this.vignette.classList.toggle('on', snapshot.danger && snapshot.phase !== 'menu')

    text('#best', formatCauris(snapshot.best))
    text('#purse', formatCauris(snapshot.wallet))
    text('#equipped', `Planche · ${nameOf(snapshot.equipped)}`)
    text('#rank', `Rang ${snapshot.rankLevel} · ${snapshot.rankName}`)
    text('#shop-purse', formatCauris(snapshot.wallet))
    text('#run-cauris', formatCauris(snapshot.caurisRun))
    text('#score', formatCauris(snapshot.score))
    text('#mult', `×${snapshot.multiplier}`)
    text('#zone-label', `${snapshot.zoneName} · ${snapshot.zoneCity}`)
    must('#score').classList.toggle('hot', snapshot.chasingRecord || snapshot.multiplier >= 3)
    text('#hint', snapshot.hint)
    text('#cop-line', snapshot.line || 'La course s’arrête ici.')
    text('#over-score', formatCauris(snapshot.score))
    text('#over-best', formatCauris(snapshot.best))
    text('#over-run', formatCauris(snapshot.caurisRun))
    text('#over-wallet', formatCauris(snapshot.wallet))
    text('#board-note', snapshot.boardNote)
    text('#mission-rank', `Rang ${snapshot.rankLevel} · ${snapshot.rankName} · ${formatCauris(snapshot.xp)} xp`)
    text('#streak', String(snapshot.streak))
    text('#daily-label', snapshot.dailyLabel)
    text('#daily-meter', `${formatCauris(snapshot.dailyProgress)} / ${formatCauris(snapshot.dailyTarget)}`)
    const dailyBtn = must<HTMLButtonElement>('#daily-claim')
    dailyBtn.disabled = snapshot.dailyClaimed || snapshot.dailyProgress < snapshot.dailyTarget
    dailyBtn.textContent = snapshot.dailyClaimed ? 'Récupéré' : 'Récupérer'
    must('#new-best').classList.toggle('hidden', !snapshot.newBest)
    must('#danger').classList.toggle('hidden', !(snapshot.danger && snapshot.phase === 'playing'))
    this.keepPseudo('#pseudo', snapshot.pseudo)
    this.keepPseudo('#board-pseudo', snapshot.pseudo)

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
    must('#mute-hud').classList.toggle('muted', snapshot.muted)
    must('#mute-hud').setAttribute('aria-label', muteLabel)
    text('#mute-pause', muteLabel)
    text('#board-mode', snapshot.boardMode === 'supabase' ? 'Classement en ligne' : 'Classement sur cet appareil')

    if (this.overlay === 'shop') this.renderShop(snapshot)
    if (this.overlay === 'missions') this.renderMissions(snapshot)
  }

  private start(): void {
    this.overlay = 'none'
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    this.game?.play()
  }

  private openShop(from: 'menu' | 'over'): void {
    this.shopFrom = from
    this.overlay = 'shop'
    this.built = ''
    if (this.game) this.renderShop(this.game.snapshot())
  }

  private openMissions(): void {
    this.overlay = 'missions'
    this.missionBuilt = ''
    if (this.game) this.sync(this.game.snapshot())
  }

  private async openBoard(): Promise<void> {
    this.overlay = 'board'
    if (!this.game) return
    this.sync(this.game.snapshot())
    const data = await this.game.scores()
    text('#board-mode', data.mode === 'supabase' ? 'Classement en ligne · top 50' : 'Classement sur cet appareil · top 50')
    text(
      '#personal',
      data.personal ? `Ton record : ${formatCauris(data.personal.score)} · ${data.personal.zone}` : 'Pas encore de score pour ce pseudo.',
    )
    const list = must('#board-list')
    list.replaceChildren()
    data.top.forEach((row, index) => {
      const item = document.createElement('li')
      const place = document.createElement('b')
      place.textContent = String(index + 1)
      const who = document.createElement('div')
      who.textContent = row.name
      const meta = document.createElement('span')
      meta.textContent = row.zone
      who.append(document.createElement('br'), meta)
      const score = document.createElement('strong')
      score.textContent = formatCauris(row.score)
      item.append(place, who, score)
      list.append(item)
    })
    if (data.top.length === 0) {
      const item = document.createElement('li')
      item.textContent = 'Aucun score pour le moment.'
      list.append(item)
    }
  }

  private closeOverlay(): void {
    this.overlay = 'none'
    if (this.game) this.sync(this.game.snapshot())
  }

  private keepPseudo(selector: string, value: string): void {
    const input = must<HTMLInputElement>(selector)
    if (document.activeElement !== input && input.value !== value) input.value = value
  }

  private renderMissions(snapshot: Snapshot): void {
    const signature = snapshot.missions.map((mission) => `${mission.id}:${mission.progress}:${mission.claimed}`).join('|')
    if (signature === this.missionBuilt) return
    this.missionBuilt = signature
    const list = must('#mission-list')
    list.replaceChildren()
    for (const mission of snapshot.missions) {
      const card = document.createElement('article')
      card.className = 'mission'
      const copy = document.createElement('div')
      const title = document.createElement('h3')
      title.textContent = mission.label
      const meter = document.createElement('p')
      meter.className = 'meter'
      meter.textContent = `${formatCauris(mission.progress)} / ${formatCauris(mission.target)} · ${formatCauris(mission.reward)} cauris`
      copy.append(title, meter)
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'btn small'
      const ready = mission.progress >= mission.target && !mission.claimed
      button.disabled = !ready
      button.textContent = mission.claimed ? 'Fait' : ready ? 'Récupérer' : 'En cours'
      button.addEventListener('click', () => {
        this.missionBuilt = ''
        this.game?.claim(mission.id)
      })
      card.append(copy, button)
      list.append(card)
    }
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
    debugZone: (id: string) => game.debugZone(id),
    debugSubmit: (score: number, duration: number, distance: number, cauris: number) =>
      game.debugSubmit(score, duration, distance, cauris),
    setPseudo: (name: string) => game.setPseudo(name),
    claim: (id: string) => game.claim(id),
    openShop: () => {
      must('#open-shop').click()
    },
    openMissions: () => {
      must('#open-missions').click()
    },
    openBoard: () => {
      must('#open-board').click()
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
      debugZone: (id: string) => void
      debugSubmit: (score: number, duration: number, distance: number, cauris: number) => Promise<{ ok: boolean; reason: string }>
      setPseudo: (name: string) => void
      claim: (id: string) => boolean
      openShop: () => void
      openMissions: () => void
      openBoard: () => void
    }
  }
}
