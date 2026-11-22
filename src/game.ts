import * as THREE from 'three'
import { AudioBus } from './audio'
import { boardById, type BoardId, type Perk } from './boards'
import { Input, type Action } from './input'
import {
  makeBanner,
  makeBarrel,
  makeCloud,
  makeCoin,
  makeCop,
  makeCrate,
  makeKeke,
  makeMagnet,
  makeMult,
  makeRunner,
  makeSegment,
  makeSun,
  makeTaxi,
  type CopParts,
  type RunnerParts,
} from './models'
import { loadSave, writeSave } from './save'

export type Phase = 'menu' | 'playing' | 'paused' | 'over'

export interface Snapshot {
  phase: Phase
  score: number
  best: number
  newBest: boolean
  chasingRecord: boolean
  caurisRun: number
  wallet: number
  multiplier: number
  danger: boolean
  shield: boolean
  boardActive: boolean
  boardUsed: boolean
  equipped: BoardId
  owned: BoardId[]
  muted: boolean
  line: string
  hint: string
  toast: string
  cause: 'head' | 'second' | ''
  lane: number
  playerX: number
  jumping: boolean
  sliding: boolean
  speed: number
  distance: number
}

const LANES = [-1.42, 0, 1.42]
const GRAVITY = 34
const JUMP_V = 8.9
const PLAYER_H = 1.48
const SLIDE_H = 0.56
const SEG = 20
const SEG_COUNT = 5

const WARN = [
  'Je te vois, Aïcha !',
  'Un faux pas de plus et je siffle !',
  'Doucement près des étals !',
  'Le marché n’est pas une piste !',
]

const OVER_TAXI = [
  'De plein fouet dans le taxi ! Même le lagon n’amortit pas ça.',
  'Aïcha Dossou, ce taxi-brousse ne se traverse pas.',
  'Jaune et vert, et toi au milieu. Sifflet !',
]

const OVER_KEKE = [
  'Mon keke était juste devant. Priorité à l’inspecteur !',
  'Tu as foncé dans le tricycle. Cotonou te dit stop.',
  'Même une pirogue contourne un keke, Aïcha.',
]

const OVER_SECOND = [
  'Deux fautes, et c’est la fin de la course !',
  'Je t’avais prévenue. On range la planche.',
  'Tes cauris ne paient pas deux entorses au règlement.',
  'Tenace et toujours en service : aujourd’hui, c’est moi qui gagne.',
]

type Kind = 'crate' | 'barrel' | 'taxi' | 'keke' | 'banner' | 'banner3' | 'coin' | 'magnet' | 'mult'

interface Spec {
  y0: number
  y1: number
  hw: number
  hd: number
}

const SPECS: Record<Kind, Spec> = {
  crate: { y0: 0, y1: 0.92, hw: 0.5, hd: 0.5 },
  barrel: { y0: 0, y1: 0.82, hw: 0.36, hd: 0.36 },
  taxi: { y0: 0, y1: 1.72, hw: 0.58, hd: 0.96 },
  keke: { y0: 0, y1: 1.88, hw: 0.52, hd: 0.72 },
  banner: { y0: 1.22, y1: 2.05, hw: 0.58, hd: 0.26 },
  banner3: { y0: 1.22, y1: 2.05, hw: 2.25, hd: 0.26 },
  coin: { y0: 0, y1: 0, hw: 0.3, hd: 0.3 },
  magnet: { y0: 0, y1: 0, hw: 0.4, hd: 0.4 },
  mult: { y0: 0, y1: 0, hw: 0.4, hd: 0.4 },
}

interface Ent {
  kind: Kind
  mesh: THREE.Object3D
  active: boolean
  lane: number
  x: number
  y: number
  z: number
  y0: number
  y1: number
  hw: number
  hd: number
  value: number
  spin: number
}

interface Spark {
  mesh: THREE.Mesh
  life: number
  vx: number
  vy: number
  vz: number
}

function pick(list: string[]): string {
  return list[(Math.random() * list.length) | 0]
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly input: Input
  private readonly audio = new AudioBus()
  private readonly runner: RunnerParts
  private readonly cop: CopParts
  private readonly ents: Ent[] = []
  private readonly segments: THREE.Object3D[] = []
  private readonly clouds: THREE.Object3D[] = []
  private readonly sparks: Spark[] = []

  private phase: Phase = 'menu'
  private wallet: number
  private best: number
  private owned: BoardId[]
  private equipped: BoardId
  private muted: boolean
  private perk: Perk

  private score = 0
  private caurisRun = 0
  private distance = 0
  private multiplier = 1
  private streak = 0
  private lastCoin = -10
  private decay = 0
  private magnetT = 0
  private multT = 0
  private linger = 0
  private danger = false
  private dangerT = 0
  private stumbleT = 0
  private iframe = 0
  private shield = false
  private boardActive = false
  private boardUsed = false
  private lane = 1
  private playerX = 0
  private py = 0
  private vy = 0
  private grounded = true
  private sliding = false
  private slideT = 0
  private spawnCool = 0
  private menuCool = 0.4
  private time = 0
  private runPhase = 0
  private shake = 0
  private camX = 0
  private line = ''
  private toast = ''
  private toastT = 0
  private cause: 'head' | 'second' | '' = ''
  private newBest = false
  private dirty = false
  private saveWait = 0
  private copScale = 0.8
  private last = performance.now()
  private raf = 0

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onFrame: (snapshot: Snapshot) => void,
  ) {
    const save = loadSave()
    this.wallet = save.cauris
    this.best = save.best
    this.owned = save.owned
    this.equipped = save.equipped
    this.muted = save.muted
    this.perk = boardById(this.equipped).perk
    this.audio.setMuted(this.muted)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: (window.devicePixelRatio || 1) <= 1.5,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x8ecff0, 1)
    this.scene.background = new THREE.Color(0x8ecff0)
    this.scene.fog = new THREE.Fog(0xc5e4f5, 16, 54)

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 140)
    this.input = new Input(canvas)

    const hemi = new THREE.HemisphereLight(0xfff4dd, 0xc48b62, 1.25)
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.45)
    sun.position.set(2.5, 12, 10)
    const rim = new THREE.DirectionalLight(0x9ad7ff, 0.4)
    rim.position.set(-5, 6, -12)
    this.scene.add(hemi, sun, rim)

    const sunMesh = makeSun()
    sunMesh.position.set(-2.4, 7.2, -16)
    this.scene.add(sunMesh)

    for (let i = 0; i < SEG_COUNT; i++) {
      const segment = makeSegment(i)
      segment.position.z = 10 - i * SEG
      this.segments.push(segment)
      this.scene.add(segment)
    }

    for (let i = 0; i < 4; i++) {
      const cloud = makeCloud()
      cloud.position.set(-2.2 + (i % 3) * 2.1, 5.6 + (i % 2) * 0.45, -6 - i * 14)
      cloud.scale.setScalar(1.15)
      this.clouds.push(cloud)
      this.scene.add(cloud)
    }

    this.runner = makeRunner()
    this.scene.add(this.runner.root)
    this.runner.boards[this.equipped].visible = true
    for (const id of Object.keys(this.runner.boards) as BoardId[]) {
      this.runner.boards[id].visible = id === this.equipped
    }

    this.cop = makeCop()
    this.cop.root.position.set(-1.1, 0, 2)
    this.cop.root.scale.setScalar(0.8)
    this.scene.add(this.cop.root)

    this.pool('crate', makeCrate(), 8)
    this.pool('barrel', makeBarrel(), 8)
    this.pool('taxi', makeTaxi(), 6)
    this.pool('keke', makeKeke(), 6)
    this.pool('banner', makeBanner('TISSUS', false), 6)
    this.pool('banner3', makeBanner('GLISSE', true), 3)
    this.pool('coin', makeCoin(), 56)
    this.pool('magnet', makeMagnet(), 3)
    this.pool('mult', makeMult(), 3)

    const sparkGeo = new THREE.SphereGeometry(0.07, 6, 4)
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xf5c542 }))
      mesh.visible = false
      this.scene.add(mesh)
      this.sparks.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 })
    }

    this.onResize()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onHide)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.emit()
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onHide)
    this.input.dispose()
    this.renderer.dispose()
  }

  play(): void {
    this.audio.unlock()
    this.clearEnts()
    this.phase = 'playing'
    this.score = 0
    this.caurisRun = 0
    this.distance = 0
    this.multiplier = 1
    this.streak = 0
    this.lastCoin = -10
    this.decay = 0
    this.magnetT = 0
    this.multT = 0
    this.linger = 0
    this.danger = false
    this.dangerT = 0
    this.stumbleT = 0
    this.iframe = 0
    this.shield = false
    this.boardActive = false
    this.boardUsed = false
    this.lane = 1
    this.playerX = 0
    this.py = 0
    this.vy = 0
    this.grounded = true
    this.sliding = false
    this.slideT = 0
    this.spawnCool = 2.3
    this.line = ''
    this.toast = ''
    this.toastT = 0
    this.cause = ''
    this.newBest = false
    this.perk = boardById(this.equipped).perk
    this.shake = 0
    for (let k = 0; k < 6; k++) this.spawnCoin(1, -12 - k * 1.7, 0.95, 1)
    this.audio.click()
    this.emit()
  }

  pause(): void {
    if (this.phase !== 'playing') return
    this.phase = 'paused'
    this.persist()
    this.emit()
  }

  resume(): void {
    if (this.phase !== 'paused') return
    this.audio.unlock()
    this.phase = 'playing'
    this.emit()
  }

  menu(): void {
    this.clearEnts()
    this.phase = 'menu'
    this.shield = false
    this.boardActive = false
    this.danger = false
    this.line = ''
    this.cause = ''
    this.newBest = false
    this.score = 0
    this.distance = 0
    this.sliding = false
    this.py = 0
    this.vy = 0
    this.lane = 1
    this.line = ''
    this.toast = ''
    this.persist()
    this.emit()
  }

  toggleMute(): void {
    this.muted = !this.muted
    this.audio.setMuted(this.muted)
    if (!this.muted) this.audio.unlock()
    this.persist()
    this.emit()
  }

  buy(id: BoardId): boolean {
    if (this.owned.includes(id)) return false
    const board = boardById(id)
    if (this.wallet < board.price) return false
    this.wallet -= board.price
    this.owned.push(id)
    this.equipped = id
    this.perk = board.perk
    this.audio.buy()
    this.persist()
    this.emit()
    return true
  }

  equip(id: BoardId): void {
    if (!this.owned.includes(id)) return
    this.equipped = id
    this.perk = boardById(id).perk
    this.audio.click()
    this.persist()
    this.emit()
  }

  activate(): boolean {
    if (this.phase !== 'playing' || this.boardUsed || this.boardActive) return false
    this.boardActive = true
    this.boardUsed = true
    this.shield = true
    this.perk = boardById(this.equipped).perk
    const board = boardById(this.equipped)
    this.toast = `${board.name} — ${board.tagline}`
    this.toastT = 1.7
    this.audio.board()
    return true
  }

  debugSpawn(kind: string, lane: number): void {
    const safeLane = clamp(lane | 0, 0, 2)
    this.spawnCool = Math.max(this.spawnCool, 4)
    const z = -5.4
    if (kind === 'coin' || kind === 'coin5') this.spawnCoin(safeLane, z, kind === 'coin5' ? 1.7 : 0.95, kind === 'coin5' ? 5 : 1)
    else if (kind === 'magnet' || kind === 'mult') this.spawnPower(kind, safeLane, z)
    else if (kind in SPECS) this.spawnObstacle(kind as Kind, safeLane, z)
  }

  /** Saute dans la même frame qu’un obstacle proche, pour un timing juste. */
  debugVault(kind: string, lane: number): void {
    const safeLane = clamp(lane | 0, 0, 2)
    this.spawnCool = Math.max(this.spawnCool, 4)
    this.sliding = false
    this.slideT = 0
    this.grounded = false
    this.py = 0
    this.vy = JUMP_V * (this.boardActive && this.perk === 'jump' ? 1.12 : 1)
    if (kind in SPECS) this.spawnObstacle(kind as Kind, safeLane, -4.4)
  }

  debugClear(): void {
    this.clearEnts()
    this.spawnCool = 8
  }

  debugWallet(amount: number): void {
    this.wallet = Math.max(0, Math.floor(amount))
    this.persist()
    this.emit()
  }

  snapshot(): Snapshot {
    const score = Math.floor(this.score)
    return {
      phase: this.phase,
      score,
      best: this.best,
      newBest: this.newBest,
      chasingRecord: this.phase === 'playing' && this.best > 0 && score > this.best,
      caurisRun: this.caurisRun,
      wallet: this.wallet,
      multiplier: this.multNow(),
      danger: this.danger && this.phase !== 'menu',
      shield: this.shield,
      boardActive: this.boardActive,
      boardUsed: this.boardUsed,
      equipped: this.equipped,
      owned: [...this.owned],
      muted: this.muted,
      line: this.line,
      hint: this.hint(),
      toast: this.toastT > 0 ? this.toast : '',
      cause: this.cause,
      lane: this.lane,
      playerX: this.playerX,
      jumping: this.py > 0.08,
      sliding: this.sliding,
      speed: this.speedNow(),
      distance: this.distance,
    }
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    let dt = (now - this.last) / 1000
    this.last = now
    if (dt > 0.05) dt = 0.05
    if (dt < 0) dt = 0
    if (document.hidden) return
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number): void {
    this.time += dt
    this.consume()
    const speed = this.speedNow()
    if (this.phase !== 'paused') this.scroll(speed, dt)

    if (this.phase === 'playing') {
      this.distance += speed * dt
      this.score += speed * dt * 2.55 * this.multNow()
      this.physics(dt)
      this.movePlayer(dt)
      this.spawnCool -= dt
      if (this.spawnCool <= 0) {
        this.spawnPattern()
        const diff = clamp(this.distance / 1400, 0, 1)
        const gap = 28 - diff * 10
        this.spawnCool = gap / Math.max(12, speed)
      }
      this.moveEnts(speed, dt)
      this.collide()
      this.tickTimers(dt)
      this.saveWait -= dt
      if (this.dirty && this.saveWait <= 0) {
        this.persist()
        this.saveWait = 1.2
      }
    } else if (this.phase === 'menu') {
      this.movePlayer(dt)
      this.moveEnts(speed, dt)
      this.menuCool -= dt
      if (this.menuCool <= 0) {
        this.spawnCoin((Math.random() * 3) | 0, -40, 0.9 + Math.random() * 0.5, 1)
        this.menuCool = 0.5
      }
      this.py = 0
    }

    this.animate(dt)
    this.updateCop(dt)
    this.updateSparks(dt)
    this.updateCamera(dt)
    this.audio.tick()
    this.emit()
  }

  private consume(): void {
    for (const action of this.input.drain()) this.act(action)
  }

  private act(action: Action): void {
    if (action === 'pause') {
      if (this.phase === 'playing') this.pause()
      else if (this.phase === 'paused') this.resume()
      return
    }
    if (action === 'mute') {
      this.toggleMute()
      return
    }
    if (this.phase !== 'playing') return
    if (action === 'left') this.lane = Math.max(0, this.lane - 1)
    else if (action === 'right') this.lane = Math.min(2, this.lane + 1)
    else if (action === 'up') this.tryJump()
    else if (action === 'down') this.trySlide()
    else if (action === 'board') this.activate()
  }

  private tryJump(): void {
    if (this.py > 0.12) return
    this.sliding = false
    this.slideT = 0
    this.grounded = false
    const boost = this.boardActive && this.perk === 'jump' ? 1.12 : 1
    this.vy = JUMP_V * boost
    this.audio.jump()
  }

  private trySlide(): void {
    if (this.py > 0.12) {
      this.vy = Math.min(this.vy, -18)
      return
    }
    if (this.sliding) {
      this.slideT = 0.7
      return
    }
    this.sliding = true
    this.slideT = 0.7
    this.audio.slide()
  }

  private physics(dt: number): void {
    if (!this.grounded) {
      this.vy -= GRAVITY * dt
      this.py += this.vy * dt
      if (this.py <= 0) {
        this.py = 0
        this.vy = 0
        this.grounded = true
      }
    }
    if (this.sliding) {
      this.slideT -= dt
      if (this.slideT <= 0) this.sliding = false
    }
  }

  private movePlayer(dt: number): void {
    const target = LANES[this.lane]
    const diff = target - this.playerX
    const step = Math.sign(diff) * Math.min(Math.abs(diff), 12 * dt)
    this.playerX += step
  }

  private speedNow(): number {
    if (this.phase === 'menu') return 7.2
    if (this.phase !== 'playing') return 0
    let speed = 15.5 + Math.min(20, this.distance * 0.011)
    if (this.boardActive && this.perk === 'speed') speed *= 1.2
    if (this.stumbleT > 0 && this.stumbleT < 10) speed *= 0.52
    return speed
  }

  private multNow(): number {
    let value = this.multiplier
    if (this.multT > 0) value *= 2
    if (this.boardActive && this.perk === 'mult') value += 1
    return value
  }

  private magnetRadius(): number {
    if (this.phase !== 'playing') return 0
    if (this.magnetT > 0) return 6.2
    if (this.boardActive && this.perk === 'magnet') return 6.2
    if (this.linger > 0) return 5.2
    return 0
  }

  private tickTimers(dt: number): void {
    if (this.danger && this.phase === 'playing') {
      this.dangerT -= dt
      if (this.dangerT <= 0) {
        this.danger = false
        this.line = ''
        this.audio.escape()
      }
    }
    if (this.stumbleT > 0 && this.stumbleT < 10) this.stumbleT -= dt
    if (this.iframe > 0) this.iframe -= dt
    if (this.linger > 0) this.linger -= dt
    if (this.magnetT > 0) this.magnetT -= dt
    if (this.multT > 0) this.multT -= dt
    if (this.toastT > 0) {
      this.toastT -= dt
      if (this.toastT <= 0) this.toast = ''
    }
    if (this.time - this.lastCoin > 2.5 && this.multiplier > 1) {
      this.decay += dt
      if (this.decay > 1.15) {
        this.multiplier -= 1
        this.decay = 0
      }
    } else {
      this.decay = 0
    }
  }

  private scroll(speed: number, dt: number): void {
    const dz = speed * dt
    for (const segment of this.segments) {
      segment.position.z += dz
      if (segment.position.z > 16) segment.position.z -= SEG * SEG_COUNT
    }
    for (const cloud of this.clouds) {
      cloud.position.z += dz * 0.28
      if (cloud.position.z > 14) cloud.position.z -= 64
    }
  }

  private spawnPattern(): void {
    const diff = clamp(this.distance / 1400, 0, 1)
    const roll = Math.random()
    if (roll < 0.16) {
      this.patternCoins()
      return
    }
    if (roll < 0.2 && this.distance > 80) {
      this.patternPower()
      return
    }
    if (roll < 0.24 && this.distance > 40) {
      for (const lane of [0, 1, 2]) this.spawnCoin(lane, -44, 1, 1)
      return
    }
    if (roll < 0.42) {
      this.patternBanner()
      return
    }
    if (roll < 0.5 && this.distance > 260) {
      this.spawnObstacle('banner3', 1, -44)
      return
    }
    this.patternBlocks(diff)
  }

  private patternCoins(): void {
    const lane = (Math.random() * 3) | 0
    if (this.distance > 70 && Math.random() < 0.32) {
      const base = -44
      this.spawnObstacle(Math.random() < 0.5 ? 'barrel' : 'crate', lane, base - 3.1)
      const heights = [1.05, 1.4, 1.72, 1.4, 1.05]
      for (let k = 0; k < 5; k++) this.spawnCoin(lane, base - k * 1.55, heights[k], 1)
      return
    }
    for (let k = 0; k < 8; k++) {
      const value = k === 7 && Math.random() < 0.45 ? 5 : 1
      this.spawnCoin(lane, -42 - k * 1.65, 0.95, value)
    }
  }

  private patternPower(): void {
    const lane = (Math.random() * 3) | 0
    this.spawnPower(Math.random() < 0.5 ? 'magnet' : 'mult', lane, -44)
    if (Math.random() < 0.7) this.spawnObstacle('barrel', (lane + 1) % 3, -44)
  }

  private patternBanner(): void {
    const lane = (Math.random() * 3) | 0
    this.spawnObstacle('banner', lane, -44)
    if (Math.random() < 0.7) {
      const options = [0, 1, 2].filter((item) => item !== lane)
      const other = options[(Math.random() * options.length) | 0]
      this.spawnObstacle(Math.random() < 0.55 ? 'crate' : 'barrel', other, -44)
    }
  }

  private patternBlocks(diff: number): void {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
    const two = Math.random() < 0.2 + diff * 0.42
    const count = two ? 2 : 1
    for (let i = 0; i < count; i++) {
      const vehicle = this.distance > 160 && Math.random() < 0.16 + diff * 0.48
      const kind: Kind = vehicle
        ? Math.random() < 0.55
          ? 'taxi'
          : 'keke'
        : Math.random() < 0.62
          ? 'crate'
          : 'barrel'
      this.spawnObstacle(kind, lanes[i], -44)
    }
    const free = lanes[count === 2 ? 2 : 1]
    if (Math.random() < 0.8) {
      for (let k = 0; k < 4; k++) this.spawnCoin(free, -42 - k * 1.7, 0.95, 1)
    }
  }

  private moveEnts(speed: number, dt: number): void {
    const magnet = this.magnetRadius()
    for (const ent of this.ents) {
      if (!ent.active) continue
      if (magnet > 0 && ent.kind === 'coin') {
        const dx = this.playerX - ent.x
        const dz = -ent.z
        const dist = Math.hypot(dx, dz)
        if (dist < magnet && dist > 0.02 && ent.z < 3) {
          const k = Math.min(1, dt * 10)
          ent.x += dx * k
          ent.z += dz * k
          ent.y += (this.py + 0.9 - ent.y) * Math.min(1, dt * 8)
        }
      }
      ent.z += speed * dt
      if (ent.kind === 'coin' || ent.kind === 'magnet' || ent.kind === 'mult') {
        ent.mesh.rotation.y += dt * (ent.kind === 'coin' ? 2.4 : 3.2)
        const bob = Math.sin(this.time * 4 + ent.spin) * 0.08
        ent.mesh.position.set(ent.x, ent.y + bob, ent.z)
      } else {
        if (ent.kind === 'barrel') ent.mesh.rotation.y += dt * 1.8
        ent.mesh.position.set(ent.x, 0, ent.z)
      }
      if (ent.z > 4) this.deactivate(ent)
    }
  }

  private collide(): void {
    if (this.iframe > 0) {
      this.collectOnly()
      return
    }
    const height = this.sliding ? SLIDE_H : PLAYER_H
    const feet = this.py
    const head = this.py + height
    for (const ent of this.ents) {
      if (!ent.active) continue
      if (ent.kind === 'coin') {
        if (this.near(ent, 0.64, 0.68)) this.takeCoin(ent)
        continue
      }
      if (ent.kind === 'magnet' || ent.kind === 'mult') {
        if (this.near(ent, 0.78, 0.9)) this.takePower(ent)
        continue
      }
      if (Math.abs(this.playerX - ent.x) > 0.32 + ent.hw) continue
      if (Math.abs(ent.z) > 0.34 + ent.hd) continue
      if (head < ent.y0 + 0.02) continue
      if (feet > ent.y1 - 0.1) continue
      this.onHit(ent)
      return
    }
  }

  private collectOnly(): void {
    for (const ent of this.ents) {
      if (!ent.active) continue
      if (ent.kind === 'coin' && this.near(ent, 0.64, 0.68)) this.takeCoin(ent)
      else if ((ent.kind === 'magnet' || ent.kind === 'mult') && this.near(ent, 0.78, 0.9)) this.takePower(ent)
    }
  }

  private near(ent: Ent, radius: number, yRadius: number): boolean {
    const dx = ent.x - this.playerX
    const chest = this.py + (this.sliding ? 0.35 : 0.95)
    const dy = ent.y - chest
    return dx * dx + ent.z * ent.z < radius * radius && Math.abs(dy) < yRadius
  }

  private onHit(ent: Ent): void {
    const headOn = ent.kind === 'taxi' || ent.kind === 'keke'
    if (this.shield) {
      this.deactivate(ent)
      this.shield = false
      this.boardActive = false
      if (this.perk === 'magnet') this.linger = 5
      this.iframe = 0.45
      this.shake = 0.4
      this.toast = 'La planche encaisse le choc !'
      this.toastT = 1.4
      this.audio.board()
      this.burst(this.playerX, 1, 0, boardById(this.equipped).glowHex, 10)
      return
    }
    if (headOn || this.danger) {
      ent.active = false
      this.finish(headOn || ent.kind === 'taxi' || ent.kind === 'keke' ? 'head' : 'second', ent.kind)
      return
    }
    this.deactivate(ent)
    this.danger = true
    this.dangerT = 7
    this.stumbleT = 0.95
    this.iframe = 0.55
    this.multiplier = 1
    this.streak = 0
    this.shake = 0.5
    this.line = pick(WARN)
    this.audio.hit()
    this.audio.whistle()
    this.burst(this.playerX, 0.5, 0, 0xc4a574, 8)
    if (navigator.vibrate) navigator.vibrate(28)
  }

  private finish(cause: 'head' | 'second', kind: Kind): void {
    this.phase = 'over'
    this.cause = cause === 'head' && kind !== 'taxi' && kind !== 'keke' ? 'second' : cause
    if (kind === 'taxi') this.line = pick(OVER_TAXI)
    else if (kind === 'keke') this.line = pick(OVER_KEKE)
    else this.line = pick(OVER_SECOND)
    this.danger = true
    this.shield = false
    this.boardActive = false
    this.stumbleT = 99
    this.shake = 0.85
    const score = Math.floor(this.score)
    this.newBest = score > this.best
    if (this.newBest) this.best = score
    this.audio.over(this.newBest)
    this.persist()
    if (navigator.vibrate) navigator.vibrate([40, 30, 70])
  }

  private takeCoin(ent: Ent): void {
    const value = ent.value
    const x = ent.x
    const y = ent.y
    const z = ent.z
    this.deactivate(ent)
    this.wallet += value
    this.caurisRun += value
    this.streak += value
    this.lastCoin = this.time
    this.score += 14 * value * this.multNow()
    if (this.streak >= 8) {
      this.streak = 0
      this.multiplier = Math.min(8, this.multiplier + 1)
      this.audio.power()
    } else {
      this.audio.coin(this.multiplier)
    }
    this.burst(x, y, z, value >= 5 ? 0xff8a4a : 0xf5c542, value >= 5 ? 8 : 4)
    this.dirty = true
  }

  private takePower(ent: Ent): void {
    if (ent.kind === 'magnet') {
      this.magnetT = 8
      this.toast = 'Aimant à cauris !'
    } else {
      this.multT = 8
      this.toast = 'Multiplicateur ×2 !'
    }
    this.toastT = 1.5
    this.deactivate(ent)
    this.audio.power()
    this.burst(this.playerX, 1.1, 0, ent.kind === 'magnet' ? 0x2ee0d0 : 0xf5c542, 8)
  }

  private animate(dt: number): void {
    const speed = this.phase === 'playing' ? this.speedNow() : 8
    this.runPhase += dt * (7.5 + speed * 0.22)
    const swing = Math.sin(this.runPhase)
    const air = this.py > 0.08
    const slide = this.sliding
    const stumble = this.stumbleT > 0

    if (air) {
      this.runner.legL.rotation.x = -0.45
      this.runner.legR.rotation.x = 0.25
      this.runner.kneeL.rotation.x = 1.05
      this.runner.kneeR.rotation.x = 0.7
      this.runner.armL.rotation.x = -0.9
      this.runner.armR.rotation.x = -0.35
    } else if (slide) {
      this.runner.legL.rotation.x = 0.35
      this.runner.legR.rotation.x = 0.2
      this.runner.kneeL.rotation.x = 1.35
      this.runner.kneeR.rotation.x = 1.45
      this.runner.armL.rotation.x = 0.5
      this.runner.armR.rotation.x = 0.35
    } else {
      this.runner.legL.rotation.x = swing * 0.8
      this.runner.legR.rotation.x = -swing * 0.8
      this.runner.kneeL.rotation.x = Math.max(0, -swing) * 1.2
      this.runner.kneeR.rotation.x = Math.max(0, swing) * 1.2
      this.runner.armL.rotation.x = -swing * 0.75
      this.runner.armR.rotation.x = swing * 0.75
    }

    this.runner.bob.rotation.x = (slide ? -1.15 : 0) + (stumble ? 0.4 : 0)
    this.runner.bob.rotation.z = stumble ? Math.sin(this.time * 28) * 0.16 : 0
    this.runner.bob.position.y = (slide ? -0.12 : 0) + (air || slide ? 0 : Math.abs(Math.sin(this.runPhase * 2)) * 0.045)
    this.runner.bob.position.z = slide ? 0.2 : 0
    this.runner.root.position.set(this.playerX, this.py, 0)
    this.runner.shadow.position.y = -this.py + 0.035
    const shadowScale = 1 - Math.min(0.55, this.py * 0.32)
    this.runner.shadow.scale.setScalar(shadowScale)

    const showBoard = this.boardActive || this.phase === 'menu'
    for (const id of Object.keys(this.runner.boards) as BoardId[]) {
      const board = this.runner.boards[id]
      board.visible = showBoard && id === this.equipped
      if (board.visible) {
        board.position.y = 0.06 + Math.sin(this.time * 6) * 0.035
      }
    }
    this.runner.shield.visible = this.shield
    if (this.shield) {
      const material = this.runner.shield.material as THREE.MeshBasicMaterial
      material.color.setHex(boardById(this.equipped).glowHex)
      const pulse = 1 + Math.sin(this.time * 8) * 0.04
      this.runner.shield.scale.setScalar(pulse)
    }
  }

  private updateCop(dt: number): void {
    let relX = -1.2
    let z = 1.35
    let scale = 0.95
    if (this.phase === 'over') {
      relX = -0.78
      z = 0.85
      scale = 1.05
    } else if (this.danger) {
      relX = -0.88
      z = 0.95
      scale = 1.02
    } else if (this.phase === 'menu') {
      relX = -1.28
      z = 1.05
      scale = 1
    }
    const targetX = this.playerX + relX
    const position = this.cop.root.position
    position.x += (targetX - position.x) * Math.min(1, dt * 4)
    position.z += (z - position.z) * Math.min(1, dt * (this.danger || this.phase === 'over' ? 3.5 : 1.8))
    position.y = Math.abs(Math.sin(this.time * 12)) * 0.03
    this.copScale += (scale - this.copScale) * Math.min(1, dt * 3)
    this.cop.root.scale.setScalar(this.copScale)
    const spin = (this.phase === 'playing' ? this.speedNow() : 7) * dt * 2.2
    for (const wheel of this.cop.wheels) wheel.rotation.y += spin
  }

  private updateCamera(dt: number): void {
    const portrait = this.camera.aspect < 0.85
    const menu = this.phase === 'menu'
    const camZ = menu ? (portrait ? 5.7 : 6.6) : portrait ? 4.85 : 6.5
    const camY = menu ? (portrait ? 1.72 : 2.3) : portrait ? 2.42 : 3.25
    const targetX = this.playerX * (portrait ? 0.86 : 0.5)
    this.camX += (targetX - this.camX) * Math.min(1, dt * 6)
    let sx = 0
    let sy = 0
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt)
      sx = (Math.random() - 0.5) * this.shake * 0.28
      sy = (Math.random() - 0.5) * this.shake * 0.16
    }
    if (menu) sx += Math.sin(this.time * 0.32) * 0.1
    this.camera.position.set(this.camX + sx, camY + sy, camZ)
    this.camera.lookAt(this.camX * 0.25, menu ? 0.42 : 1.02, menu ? -5.5 : -6.2)
  }

  private updateSparks(dt: number): void {
    for (const spark of this.sparks) {
      if (spark.life <= 0) continue
      spark.life -= dt
      spark.vy -= 14 * dt
      spark.mesh.position.x += spark.vx * dt
      spark.mesh.position.y += spark.vy * dt
      spark.mesh.position.z += spark.vz * dt
      if (spark.life <= 0) spark.mesh.visible = false
    }
  }

  private burst(x: number, y: number, z: number, color: number, count: number): void {
    let left = count
    for (const spark of this.sparks) {
      if (left <= 0) break
      if (spark.life > 0) continue
      spark.life = 0.35 + Math.random() * 0.15
      spark.mesh.visible = true
      spark.mesh.position.set(x, y, z)
      ;(spark.mesh.material as THREE.MeshBasicMaterial).color.setHex(color)
      spark.vx = (Math.random() - 0.5) * 4.5
      spark.vy = 1.5 + Math.random() * 3.5
      spark.vz = (Math.random() - 0.5) * 3
      left--
    }
  }

  private hint(): string {
    if (this.phase !== 'playing' || this.best > 700) return ''
    if (this.distance < 40) return 'Balaye ← → pour changer de voie'
    if (this.distance < 85) return 'Balaye ↑ pour sauter les caisses'
    if (this.distance < 140) return 'Balaye ↓ pour glisser sous les banderoles'
    if (this.distance < 200 && !this.boardUsed) return 'Double tape, ou F, pour la planche'
    return ''
  }

  private pool(kind: Kind, proto: THREE.Object3D, count: number): void {
    const spec = SPECS[kind]
    for (let i = 0; i < count; i++) {
      const mesh = i === 0 ? proto : proto.clone(true)
      mesh.visible = false
      this.scene.add(mesh)
      this.ents.push({
        kind,
        mesh,
        active: false,
        lane: 1,
        x: 0,
        y: 0,
        z: 0,
        y0: spec.y0,
        y1: spec.y1,
        hw: spec.hw,
        hd: spec.hd,
        value: 1,
        spin: Math.random() * 6,
      })
    }
  }

  private spawnObstacle(kind: Kind, lane: number, z: number): void {
    const ent = this.ents.find((item) => !item.active && item.kind === kind)
    if (!ent) return
    ent.active = true
    ent.lane = lane
    ent.x = kind === 'banner3' ? 0 : LANES[lane]
    ent.y = 0
    ent.z = z
    ent.mesh.visible = true
    ent.mesh.position.set(ent.x, 0, ent.z)
    ent.mesh.rotation.set(0, kind === 'taxi' || kind === 'keke' ? 0 : 0, 0)
  }

  private spawnCoin(lane: number, z: number, y: number, value: number): void {
    const ent = this.ents.find((item) => !item.active && item.kind === 'coin')
    if (!ent) return
    ent.active = true
    ent.lane = lane
    ent.x = LANES[lane]
    ent.y = y
    ent.z = z
    ent.value = value
    ent.mesh.visible = true
    ent.mesh.scale.setScalar(value >= 5 ? 1.55 : 1)
    ent.mesh.position.set(ent.x, y, z)
  }

  private spawnPower(kind: 'magnet' | 'mult', lane: number, z: number): void {
    const ent = this.ents.find((item) => !item.active && item.kind === kind)
    if (!ent) return
    ent.active = true
    ent.lane = lane
    ent.x = LANES[lane]
    ent.y = 1.05
    ent.z = z
    ent.mesh.visible = true
    ent.mesh.position.set(ent.x, ent.y, z)
  }

  private deactivate(ent: Ent): void {
    ent.active = false
    ent.mesh.visible = false
  }

  private clearEnts(): void {
    for (const ent of this.ents) this.deactivate(ent)
  }

  private persist(): void {
    writeSave({
      best: this.best,
      cauris: this.wallet,
      owned: this.owned,
      equipped: this.equipped,
      muted: this.muted,
    })
    this.dirty = false
  }

  private emit(): void {
    this.onFrame(this.snapshot())
  }

  private onResize = (): void => {
    const width = window.innerWidth
    const height = Math.max(1, window.innerHeight)
    const aspect = width / height
    const portrait = aspect < 0.85
    const hfov = ((portrait ? 46 : 60) * Math.PI) / 180
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect)
    this.camera.fov = (vfov * 180) / Math.PI
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    const cap = width < 720 ? 1.35 : 1.6
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
    this.renderer.setSize(width, height, false)
  }

  private onHide = (): void => {
    if (document.hidden && this.phase === 'playing') this.pause()
  }
}
