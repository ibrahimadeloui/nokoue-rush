import * as THREE from 'three'
import { AudioBus, type MusicCue } from './audio'
import { boardById, type BoardId, type Perk } from './boards'
import { createLeaderboard, type LeaderboardAdapter, type SubmitResult } from './leaderboard'
import { Input, type Action } from './input'
import {
  addProgress,
  claimDaily,
  claimMission,
  rankFor,
  sanitizePseudo,
  type MissionKind,
  type ProgressSave,
} from './missions'
import {
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
  makeSky,
  makeSun,
  makeTaxi,
  makeZoneBanner,
  tagShadows,
  type CopParts,
  type RunnerParts,
} from './models'
import { loadSave, writeSave, type SaveData } from './save'
import { adsAvailable, initAds, showRewardedAd } from './ads'
import { zoneAt, zoneById, type ZoneId } from './zones'

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
  zoneId: ZoneId
  zoneName: string
  zoneCity: string
  rankName: string
  rankLevel: number
  xp: number
  xpNext: number
  missions: ProgressSave['missions']
  dailyLabel: string
  dailyProgress: number
  dailyTarget: number
  dailyClaimed: boolean
  streak: number
  pseudo: string
  boardMode: 'local' | 'supabase'
  boardNote: string
  adsAvailable: boolean
  canRevive: boolean
  canDoubleCauris: boolean
  adBusy: boolean
}

const LANES = [-1.42, 0, 1.42]
const GRAVITY = 34
const JUMP_V = 8.9
const PLAYER_H = 1.48
const SLIDE_H = 0.56
const SEG = 20
const SEG_COUNT = 5
const SPAWN_Z = -34

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
  crate: { y0: 0.16, y1: 1.11, hw: 0.58, hd: 0.58 },
  barrel: { y0: 0.16, y1: 1.05, hw: 0.42, hd: 0.42 },
  taxi: { y0: 0.16, y1: 1.84, hw: 0.62, hd: 1.0 },
  keke: { y0: 0.16, y1: 2.0, hw: 0.56, hd: 0.76 },
  banner: { y0: 1.22, y1: 2.1, hw: 0.64, hd: 0.26 },
  banner3: { y0: 1.22, y1: 2.1, hw: 2.25, hd: 0.26 },
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
  marked: boolean
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
  private progress: ProgressSave
  private readonly leaderboard: LeaderboardAdapter
  private boardNote = ''
  private pendingSettle = false
  private reviveUsed = false
  private caurisDoubled = false
  private adBusy = false
  private shownZone: ZoneId = 'marche'
  private runTime = 0
  private hornCool = 0
  private pose = { lL: 0, lR: 0, kL: 0, kR: 0, aL: 0, aR: 0, bx: 0, by: 0, bz: 0, lean: 0, yaw: 0, squish: 1 }
  private laneVel = 0
  private landT = 0
  private jumpSquash = 0
  private sunLight: THREE.DirectionalLight | null = null
  private dprCap = 1.5
  private fpsEma = 60
  private dprClock = 0
  private readonly slots: { root: THREE.Group; zone: ZoneId; variant: number }[] = []
  private readonly zoneProtos: Record<ZoneId, THREE.Group[]>
  private readonly sky: ReturnType<typeof makeSky>
  private readonly fogTarget = new THREE.Color()
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
    this.progress = save
    this.perk = boardById(this.equipped).perk
    this.audio.setMuted(this.muted)
    this.audio.setZone('menu')
    this.audio.attachUnlock()
    this.leaderboard = createLeaderboard()

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: (window.devicePixelRatio || 1) <= 1.5,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0xf3c090, 1)
    this.scene.background = new THREE.Color(0xf3c090)
    this.scene.fog = new THREE.Fog(0xf3c090, 22, 68)

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 140)
    this.input = new Input(canvas)

    const hemi = new THREE.HemisphereLight(0xffe6c0, 0xc47a42, 0.95)
    const sun = new THREE.DirectionalLight(0xffe0a8, 1.85)
    sun.position.set(7, 16, 9)
    sun.castShadow = true
    const mapSize = window.innerWidth < 720 ? 512 : 1024
    sun.shadow.mapSize.set(mapSize, mapSize)
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 42
    sun.shadow.camera.left = -11
    sun.shadow.camera.right = 11
    sun.shadow.camera.top = 14
    sun.shadow.camera.bottom = -8
    sun.shadow.bias = -0.0009
    sun.shadow.normalBias = 0.045
    sun.shadow.radius = 2.2
    const rim = new THREE.DirectionalLight(0xffc888, 0.38)
    rim.position.set(-7, 6, -8)
    const fill = new THREE.DirectionalLight(0xffb56b, 0.48)
    fill.position.set(-3, 5, 12)
    this.scene.add(hemi, sun, rim, fill)
    this.sunLight = sun

    this.sky = makeSky()
    this.scene.add(this.sky.mesh)
    const sunMesh = makeSun()
    sunMesh.position.set(-2.2, 8.4, -18)
    this.scene.add(sunMesh)

    this.zoneProtos = {
      marche: [makeSegment('marche', 0), makeSegment('marche', 1)],
      lagune: [makeSegment('lagune', 0), makeSegment('lagune', 1)],
      porto: [makeSegment('porto', 0), makeSegment('porto', 1)],
      plage: [makeSegment('plage', 0), makeSegment('plage', 1)],
    }
    for (const list of Object.values(this.zoneProtos)) {
      for (const proto of list) tagShadows(proto)
    }
    for (let i = 0; i < SEG_COUNT; i++) {
      const root = new THREE.Group()
      root.position.z = 10 - i * SEG
      const slot = { root, zone: 'marche' as ZoneId, variant: i % 2 }
      this.slots.push(slot)
      this.scene.add(root)
      this.dressSlot(slot, 'marche')
    }

    for (let i = 0; i < 4; i++) {
      const cloud = makeCloud()
      cloud.position.set(-2.2 + (i % 3) * 2.1, 5.6 + (i % 2) * 0.45, -6 - i * 14)
      cloud.scale.setScalar(1.15)
      this.clouds.push(cloud)
      this.scene.add(cloud)
    }

    this.runner = makeRunner()
    tagShadows(this.runner.root)
    this.scene.add(this.runner.root)
    this.runner.boards[this.equipped].visible = true
    for (const id of Object.keys(this.runner.boards) as BoardId[]) {
      this.runner.boards[id].visible = id === this.equipped
    }

    this.cop = makeCop()
    tagShadows(this.cop.root)
    this.cop.root.position.set(-1.1, 0, 2)
    this.cop.root.scale.setScalar(0.8)
    this.scene.add(this.cop.root)

    this.pool('crate', makeCrate(), 8)
    this.pool('barrel', makeBarrel(), 8)
    this.pool('taxi', makeTaxi(), 6)
    this.pool('keke', makeKeke(), 6)
    this.pool('banner', makeZoneBanner(false), 6)
    this.pool('banner3', makeZoneBanner(true), 3)
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
    this.settleRun()
    this.audio.unlock()
    this.clearEnts()
    this.phase = 'playing'
    this.score = 0
    this.caurisRun = 0
    this.pendingSettle = false
    this.reviveUsed = false
    this.caurisDoubled = false
    this.adBusy = false
    void initAds()
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
    this.laneVel = 0
    this.py = 0
    this.vy = 0
    this.grounded = true
    this.sliding = false
    this.slideT = 0
    this.landT = 0
    this.jumpSquash = 0
    this.spawnCool = 1.35
    this.line = ''
    this.toast = ''
    this.toastT = 0
    this.cause = ''
    this.newBest = false
    this.perk = boardById(this.equipped).perk
    this.shake = 0
    this.runTime = 0
    this.shownZone = 'marche'
    this.boardNote = ''
    for (const slot of this.slots) this.dressSlot(slot, 'marche')
    this.paintZone(zoneAt(0), 1)
    this.audio.setZone('marche')
    for (let k = 0; k < 6; k++) this.spawnCoin(1, -12 - k * 1.7, 0.95, 1)
    this.spawnObstacle('crate', 0, -18)
    this.spawnObstacle('barrel', 2, -24)
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
    this.settleRun()
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
    this.toast = ''
    this.shownZone = 'marche'
    for (const slot of this.slots) this.dressSlot(slot, 'marche')
    this.paintZone(zoneAt(0), 1)
    this.audio.setZone('menu')
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

  debugSpawn(kind: string, lane: number, z = -5.4): void {
    const safeLane = clamp(lane | 0, 0, 2)
    this.spawnCool = Math.max(this.spawnCool, 4)
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
      zoneId: this.shownZone,
      zoneName: zoneById(this.shownZone).name,
      zoneCity: zoneById(this.shownZone).city,
      rankName: rankFor(this.progress.xp).name,
      rankLevel: rankFor(this.progress.xp).level,
      xp: this.progress.xp,
      xpNext: rankFor(this.progress.xp).next,
      missions: this.progress.missions.map((mission) => ({ ...mission })),
      dailyLabel: this.progress.daily.label,
      dailyProgress: this.progress.daily.progress,
      dailyTarget: this.progress.daily.target,
      dailyClaimed: this.progress.daily.claimed,
      streak: this.progress.streak,
      pseudo: this.progress.pseudo,
      boardMode: this.leaderboard.mode,
      boardNote: this.boardNote,
      adsAvailable: adsAvailable(),
      canRevive: this.phase === 'over' && this.canOfferRevive(),
      canDoubleCauris: this.phase === 'over' && this.canOfferDouble(),
      adBusy: this.adBusy,
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
      this.runTime += dt
      this.distance += speed * dt
      this.bump('distance', speed * dt)
      this.score += speed * dt * 2.55 * this.multNow()
      this.syncZone()
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
      this.audio.setZone('menu')
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
    this.paintZone(this.zoneAhead(), dt)
    if (this.hornCool > 0) this.hornCool -= dt
    this.updateCop(dt)
    this.updateSparks(dt)
    this.updateCamera(dt)
    this.audio.tick()
    this.tickDpr(dt)
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
    if (action === 'left' || action === 'right') {
      const next = action === 'left' ? Math.max(0, this.lane - 1) : Math.min(2, this.lane + 1)
      if (next !== this.lane) {
        this.lane = next
        this.audio.swish()
      }
    } else if (action === 'up') this.tryJump()
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
    this.jumpSquash = 0.1
    this.audio.jump()
    this.bump('jumps', 1)
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
        this.landT = 0.2
      }
    }
    if (this.sliding) {
      this.slideT -= dt
      if (this.slideT <= 0) this.sliding = false
    }
  }

  private movePlayer(dt: number): void {
    const target = LANES[this.lane]
    const omega = 13.2
    const x = this.playerX - target
    const exp = Math.exp(-omega * dt)
    const next = target + (x + (this.laneVel + omega * x) * dt) * exp
    this.laneVel = dt > 1e-5 ? (next - this.playerX) / dt : 0
    this.playerX = next
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
    const ahead = this.zoneAhead().id
    for (const slot of this.slots) {
      slot.root.position.z += dz
      if (slot.root.position.z > 16) {
        slot.root.position.z -= SEG * SEG_COUNT
        this.dressSlot(slot, ahead)
      } else if (slot.root.position.z < -12 && slot.zone !== ahead) {
        this.dressSlot(slot, ahead)
      }
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
      for (const lane of [0, 1, 2]) this.spawnCoin(lane, SPAWN_Z, 1, 1)
      return
    }
    if (roll < 0.42) {
      this.patternBanner()
      return
    }
    if (roll < 0.5 && this.distance > 260) {
      this.spawnObstacle('banner3', 1, SPAWN_Z)
      return
    }
    this.patternBlocks(diff)
  }

  private patternCoins(): void {
    const lane = (Math.random() * 3) | 0
    if (this.distance > 70 && Math.random() < 0.32) {
      const base = SPAWN_Z
      this.spawnObstacle(Math.random() < 0.5 ? 'barrel' : 'crate', lane, base - 3.1)
      const heights = [1.05, 1.4, 1.72, 1.4, 1.05]
      for (let k = 0; k < 5; k++) this.spawnCoin(lane, base - k * 1.55, heights[k], 1)
      return
    }
    for (let k = 0; k < 8; k++) {
      const value = k === 7 && Math.random() < 0.45 ? 5 : 1
      this.spawnCoin(lane, SPAWN_Z + 2 - k * 1.65, 0.95, value)
    }
  }

  private patternPower(): void {
    const lane = (Math.random() * 3) | 0
    this.spawnPower(Math.random() < 0.5 ? 'magnet' : 'mult', lane, SPAWN_Z)
    if (Math.random() < 0.7) this.spawnObstacle('barrel', (lane + 1) % 3, SPAWN_Z)
  }

  private patternBanner(): void {
    const lane = (Math.random() * 3) | 0
    this.spawnObstacle('banner', lane, SPAWN_Z)
    if (Math.random() < 0.7) {
      const options = [0, 1, 2].filter((item) => item !== lane)
      const other = options[(Math.random() * options.length) | 0]
      this.spawnObstacle(Math.random() < 0.55 ? 'crate' : 'barrel', other, SPAWN_Z)
    }
  }

  private patternBlocks(diff: number): void {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
    const two = Math.random() < 0.2 + diff * 0.42
    const count = two ? 2 : 1
    for (let i = 0; i < count; i++) {
      const bias = this.zoneBias()
      const vehicle = this.distance > 160 && Math.random() < bias.vehicle + diff * 0.28
      const kind: Kind = vehicle
        ? Math.random() < bias.taxi
          ? 'taxi'
          : 'keke'
        : Math.random() < bias.crate
          ? 'crate'
          : 'barrel'
      this.spawnObstacle(kind, lanes[i], SPAWN_Z)
    }
    const free = lanes[count === 2 ? 2 : 1]
    if (Math.random() < 0.8) {
      for (let k = 0; k < 4; k++) this.spawnCoin(free, SPAWN_Z + 2 - k * 1.7, 0.95, 1)
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
        if (ent.kind === 'barrel') (ent.mesh.children[1] ?? ent.mesh).rotation.y += dt * 1.8
        ent.mesh.position.set(ent.x, 0, ent.z)
      }
      if (!ent.marked && ent.z > -0.15 && (ent.kind === 'banner' || ent.kind === 'banner3')) {
        ent.marked = true
        const aligned = ent.kind === 'banner3' || Math.abs(this.playerX - ent.x) < 0.9
        if (aligned && this.sliding && this.phase === 'playing') this.bump('slides', 1)
      }
      if (ent.z > 4) {
        if (this.phase === 'playing' && ent.kind === 'taxi') this.bump('taxis', 1)
        this.deactivate(ent)
      }
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
    this.lastRun = {
      score,
      duration: this.runTime,
      distance: this.distance,
      cauris: this.caurisRun,
      zone: zoneById(this.shownZone).name,
    }
    this.pendingSettle = true
    this.audio.over(this.newBest)
    if (!this.canOfferRevive() && !this.canOfferDouble()) this.settleRun()
    if (navigator.vibrate) navigator.vibrate([40, 30, 70])
  }

  private canOfferRevive(): boolean {
    return adsAvailable() && !this.reviveUsed
  }

  private canOfferDouble(): boolean {
    return adsAvailable() && !this.caurisDoubled && this.caurisRun > 0
  }

  private settleRun(): void {
    if (!this.pendingSettle) return
    this.pendingSettle = false
    if (this.lastRun.score > this.best) this.best = this.lastRun.score
    this.progress.xp += Math.floor(this.lastRun.distance / 25)
    this.persist()
    void this.publishScore()
  }

  async watchRevive(): Promise<boolean> {
    if (this.phase !== 'over' || !this.canOfferRevive() || this.adBusy) return false
    this.adBusy = true
    this.emit()
    const earned = await showRewardedAd()
    this.adBusy = false
    if (!earned) {
      this.emit()
      return false
    }
    this.reviveUsed = true
    this.pendingSettle = false
    this.phase = 'playing'
    this.danger = false
    this.dangerT = 0
    this.stumbleT = 0
    this.iframe = 1.8
    this.shake = 0
    this.py = 0
    this.vy = 0
    this.grounded = true
    this.sliding = false
    this.cause = ''
    this.line = 'Reprise ! Encore une chance.'
    this.toast = 'C’est reparti !'
    this.toastT = 1.6
    for (const ent of this.ents) {
      if (ent.active && ent.z > -10) this.deactivate(ent)
    }
    this.emit()
    return true
  }

  async watchDoubleCauris(): Promise<boolean> {
    if (this.phase !== 'over' || !this.canOfferDouble() || this.adBusy) return false
    this.adBusy = true
    this.emit()
    const earned = await showRewardedAd()
    this.adBusy = false
    if (!earned) {
      this.emit()
      return false
    }
    this.caurisDoubled = true
    this.wallet += this.caurisRun
    this.caurisRun *= 2
    this.lastRun.cauris = this.caurisRun
    this.toast = 'Cauris doublés !'
    this.toastT = 1.8
    this.persist()
    this.emit()
    return true
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
    this.bump('cauris', value)
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
    this.runPhase += dt * (8.2 + speed * 0.28)
    if (this.landT > 0) this.landT = Math.max(0, this.landT - dt)
    if (this.jumpSquash > 0) this.jumpSquash = Math.max(0, this.jumpSquash - dt)
    const swing = Math.sin(this.runPhase)
    const air = this.py > 0.08
    const slide = this.sliding
    const stumble = this.stumbleT > 0
    const land = this.landT / 0.2
    const takeoff = this.jumpSquash / 0.1

    let lL = swing * 1.05
    let lR = -swing * 1.05
    let kL = Math.max(0, -swing) * 1.45 + Math.max(0, swing) * 0.18
    let kR = Math.max(0, swing) * 1.45 + Math.max(0, -swing) * 0.18
    let aL = -swing * 1.05
    let aR = swing * 1.05
    let bobX = 0
    let bobZ = 0
    let bobY = Math.abs(Math.sin(this.runPhase * 2)) * 0.065
    let yaw = swing * 0.12
    let squish = 1
    if (air) {
      const rising = this.vy > 1.2
      if (rising) {
        lL = -0.55
        lR = 0.45
        kL = 0.85
        kR = 1.05
        aL = -1.25
        aR = -0.35
        bobY = 0.05
        squish = 1.08
      } else {
        lL = -0.2
        lR = 0.15
        kL = 1.15
        kR = 1.2
        aL = -0.45
        aR = 0.2
        bobY = -0.02
        squish = 1.04
      }
      yaw = 0.04
    } else if (slide) {
      lL = 0.55
      lR = 0.32
      kL = 1.55
      kR = 1.65
      aL = 0.9
      aR = 0.45
      bobX = -1.12
      bobY = -0.18
      bobZ = 0.28
      yaw = 0
      squish = 0.92
    }
    if (takeoff > 0 && !slide) {
      squish = 1 - 0.16 * takeoff
      bobY -= 0.06 * takeoff
      kL += 0.35 * takeoff
      kR += 0.35 * takeoff
    }
    if (land > 0 && !air && !slide) {
      squish = 1 - 0.14 * land
      bobY -= 0.1 * land
      kL += 0.55 * land
      kR += 0.55 * land
      aL += 0.2 * land
      aR += 0.2 * land
    }
    if (stumble) bobX += 0.4
    const leanTarget = THREE.MathUtils.clamp(-this.laneVel * 0.09, -0.42, 0.42)
    const rate = air || slide ? 11 : 18
    this.pose.lL = this.damp(this.pose.lL, lL, dt, rate)
    this.pose.lR = this.damp(this.pose.lR, lR, dt, rate)
    this.pose.kL = this.damp(this.pose.kL, kL, dt, rate)
    this.pose.kR = this.damp(this.pose.kR, kR, dt, rate)
    this.pose.aL = this.damp(this.pose.aL, aL, dt, rate)
    this.pose.aR = this.damp(this.pose.aR, aR, dt, rate)
    this.pose.bx = this.damp(this.pose.bx, bobX, dt, 11)
    this.pose.by = this.damp(this.pose.by, bobY, dt, 14)
    this.pose.bz = this.damp(this.pose.bz, bobZ, dt, 11)
    this.pose.lean = this.damp(this.pose.lean, leanTarget, dt, 10)
    this.pose.yaw = this.damp(this.pose.yaw, yaw, dt, 12)
    this.pose.squish = this.damp(this.pose.squish, squish, dt, 16)
    this.runner.legL.rotation.x = this.pose.lL
    this.runner.legR.rotation.x = this.pose.lR
    this.runner.kneeL.rotation.x = this.pose.kL
    this.runner.kneeR.rotation.x = this.pose.kR
    this.runner.armL.rotation.x = this.pose.aL
    this.runner.armR.rotation.x = this.pose.aR
    this.runner.armL.rotation.z = 0.12
    this.runner.armR.rotation.z = -0.12
    this.runner.afro.rotation.x = Math.sin(this.runPhase * 2) * 0.06
    this.runner.afro.position.y = Math.abs(Math.sin(this.runPhase)) * 0.012

    const lean = this.pose.lean + (stumble ? Math.sin(this.time * 28) * 0.16 : 0)
    this.runner.bob.rotation.x = this.pose.bx
    this.runner.bob.rotation.y = this.pose.yaw
    this.runner.bob.rotation.z = lean
    this.runner.bob.position.y = this.pose.by
    this.runner.bob.position.z = this.pose.bz
    const sq = this.pose.squish
    this.runner.bob.scale.set(1 + (1 - sq) * 0.18, sq, 1 + (1 - sq) * 0.18)
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
    const camZ = menu ? (portrait ? 5.7 : 6.6) : portrait ? 5.4 : 6.95
    const camY = menu ? (portrait ? 1.85 : 2.4) : portrait ? 3.25 : 3.65
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
    this.camera.lookAt(this.camX * 0.25, menu ? 0.48 : 1.18, menu ? -5.5 : -8.6)
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
    if (this.distance < 85) return 'Tape, ou balaye ↑, pour sauter'
    if (this.distance < 140) return 'Balaye ↓ pour glisser sous les banderoles'
    if (this.distance < 200 && !this.boardUsed) return 'Double tape, ou F, pour la planche'
    return ''
  }

  private pool(kind: Kind, proto: THREE.Object3D, count: number): void {
    const spec = SPECS[kind]
    for (let i = 0; i < count; i++) {
      const mesh = i === 0 ? proto : proto.clone(true)
      mesh.visible = false
      tagShadows(mesh)
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
        marked: false,
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
    ent.marked = false
    ent.mesh.visible = true
    ent.mesh.position.set(ent.x, 0, ent.z)
    ent.mesh.rotation.set(0, 0, 0)
    if (kind === 'banner' || kind === 'banner3') this.dressBanner(ent.mesh)
    if (kind === 'taxi' && this.phase === 'playing' && this.hornCool <= 0) {
      this.hornCool = 2.4
      this.audio.horn()
    }
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

  private lastRun = { score: 0, duration: 0, distance: 0, cauris: 0, zone: 'Marché Dantokpa' }

  publishNow(): void {
    this.settleRun()
    void this.publishScore()
  }

  async scores(): Promise<{ top: import('./leaderboard').ScoreRow[]; personal: import('./leaderboard').ScoreRow | null; mode: 'local' | 'supabase' }> {
    const name = this.progress.pseudo
    const [top, personal] = await Promise.all([
      this.leaderboard.top(50),
      name ? this.leaderboard.personal(name) : Promise.resolve(null),
    ])
    return { top, personal, mode: this.leaderboard.mode }
  }

  setPseudo(name: string): void {
    this.progress.pseudo = sanitizePseudo(name)
    this.persist()
    this.emit()
  }

  claim(id: string): boolean {
    const reward = id === 'daily' ? claimDaily(this.progress) : claimMission(this.progress, id)
    if (reward <= 0) return false
    this.wallet += reward
    this.audio.buy()
    this.persist()
    this.emit()
    return true
  }

  debugZone(id: string): void {
    const zone = zoneById(id)
    let walked = 0
    while (zoneAt(walked).id !== zone.id && walked < 5000) walked += 20
    this.distance = walked + 24
    this.phase = 'playing'
    this.clearEnts()
    this.shownZone = zone.id
    this.danger = false
    this.dangerT = 0
    this.line = ''
    this.spawnCool = 8
    for (const slot of this.slots) this.dressSlot(slot, zone.id)
    this.paintZone(zone, 1)
    this.audio.setZone(zone.id)
    this.toast = ''
    this.toastT = 0
    if (zone.id === 'lagune') {
      this.spawnObstacle('banner', 0, -14)
      this.spawnObstacle('barrel', 2, -16)
    } else if (zone.id === 'porto') {
      this.spawnObstacle('crate', 0, -13)
      this.spawnObstacle('taxi', 2, -17)
    } else if (zone.id === 'plage') {
      this.spawnObstacle('barrel', 0, -14)
      this.spawnObstacle('keke', 2, -17)
    } else {
      this.spawnObstacle('crate', 0, -13)
      this.spawnObstacle('taxi', 2, -17)
    }
    this.emit()
  }

  debugSubmit(score: number, duration: number, distance: number, cauris: number): Promise<SubmitResult> {
    return this.leaderboard.submit({
      name: this.progress.pseudo || 'Aïcha',
      score,
      duration,
      distance,
      cauris,
      zone: zoneById(this.shownZone).name,
    })
  }

  private bump(kind: MissionKind, amount: number): void {
    addProgress(this.progress, kind, amount)
    this.dirty = true
  }

  private damp(current: number, target: number, dt: number, rate: number): number {
    return current + (target - current) * Math.min(1, dt * rate)
  }

  private zoneAhead() {
    const look = this.phase === 'playing' ? this.distance + 46 : 0
    return zoneAt(look)
  }

  private zoneBias(): { vehicle: number; taxi: number; crate: number } {
    if (this.shownZone === 'lagune') return { vehicle: 0.08, taxi: 0.25, crate: 0.35 }
    if (this.shownZone === 'porto') return { vehicle: 0.22, taxi: 0.62, crate: 0.72 }
    if (this.shownZone === 'plage') return { vehicle: 0.14, taxi: 0.4, crate: 0.28 }
    return { vehicle: 0.16, taxi: 0.55, crate: 0.62 }
  }

  private syncZone(): void {
    const next = this.zoneAhead()
    if (next.id === this.shownZone) return
    this.shownZone = next.id
    this.toast = `${next.name} · ${next.city}`
    this.toastT = 2.3
    this.audio.setZone(next.id)
    this.bump('zones', 1)
  }

  private dressSlot(slot: { root: THREE.Group; zone: ZoneId; variant: number }, zone: ZoneId): void {
    slot.root.clear()
    slot.root.add(this.zoneProtos[zone][slot.variant].clone(true))
    slot.zone = zone
  }

  private dressBanner(mesh: THREE.Object3D): void {
    const zone = this.shownZone
    mesh.traverse((child) => {
      if (!child.name.startsWith('cloth-')) return
      child.visible = child.name === 'cloth-wide' || child.name === `cloth-${zone}`
    })
  }

  private paintedZone: ZoneId | '' = ''

  private paintZone(zone: ReturnType<typeof zoneAt>, dt: number): void {
    const fog = this.scene.fog as THREE.Fog
    this.fogTarget.setHex(zone.fog)
    if (dt >= 1) {
      fog.color.copy(this.fogTarget)
      fog.near = zone.fogNear
      fog.far = zone.fogFar
    } else {
      fog.color.lerp(this.fogTarget, Math.min(1, dt * 0.8))
      fog.near += (zone.fogNear - fog.near) * Math.min(1, dt * 0.8)
      fog.far += (zone.fogFar - fog.far) * Math.min(1, dt * 0.8)
    }
    this.renderer.setClearColor(fog.color, 1)
    if (this.paintedZone !== zone.id) {
      this.sky.paint(zone.skyTop, zone.skyMid, zone.horizon)
      this.paintedZone = zone.id
    }
  }

  private async publishScore(): Promise<void> {
    const run = this.lastRun
    if (!this.progress.pseudo) {
      this.boardNote = 'Ajoute un pseudo pour entrer au classement.'
      this.emit()
      return
    }
    try {
      const result = await this.leaderboard.submit({
        name: this.progress.pseudo,
        score: run.score,
        cauris: run.cauris,
        zone: run.zone,
        duration: run.duration,
        distance: run.distance,
      })
      this.boardNote = result.reason
    } catch {
      this.boardNote = 'Hors ligne : le classement en ligne est indisponible. Ton meilleur score reste enregistré ici.'
    }
    this.emit()
  }

  private persist(): void {
    const data: SaveData = {
      best: this.best,
      cauris: this.wallet,
      owned: this.owned,
      equipped: this.equipped,
      muted: this.muted,
      xp: this.progress.xp,
      missions: this.progress.missions,
      daily: this.progress.daily,
      streak: this.progress.streak,
      lastDailyClaim: this.progress.lastDailyClaim,
      pseudo: this.progress.pseudo,
    }
    writeSave(data)
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
    const hfov = ((portrait ? 52 : 62) * Math.PI) / 180
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect)
    this.camera.fov = (vfov * 180) / Math.PI
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this.applyDpr(width, height)
  }

  private tickDpr(dt: number): void {
    if (dt > 0 && dt < 0.1) this.fpsEma = this.fpsEma * 0.92 + (1 / dt) * 0.08
    this.dprClock += dt
    if (this.dprClock < 0.8) return
    this.dprClock = 0
    const width = window.innerWidth
    const maxCap = width < 720 ? 1.35 : 1.6
    let cap = this.dprCap
    if (this.fpsEma < 48) cap = Math.max(1, cap - 0.15)
    else if (this.fpsEma > 57) cap = Math.min(maxCap, cap + 0.08)
    if (Math.abs(cap - this.dprCap) < 0.04) return
    this.dprCap = cap
    this.applyDpr(width, Math.max(1, window.innerHeight))
  }

  private applyDpr(width: number, height: number): void {
    const cap = Math.min(this.dprCap, width < 720 ? 1.35 : 1.6)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
    this.renderer.setSize(width, height, false)
    if (this.sunLight) {
      const size = cap <= 1.05 || width < 720 ? 512 : 1024
      if (this.sunLight.shadow.mapSize.x !== size) {
        this.sunLight.shadow.mapSize.set(size, size)
        this.sunLight.shadow.map?.dispose()
        this.sunLight.shadow.map = null
      }
    }
  }

  private onHide = (): void => {
    if (document.hidden && this.phase === 'playing') this.pause()
    if (!document.hidden) this.audio.unlock()
  }
}
