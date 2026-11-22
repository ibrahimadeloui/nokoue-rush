export type MissionKind = 'cauris' | 'taxis' | 'slides' | 'jumps' | 'distance' | 'zones'

export interface MissionState {
  id: string
  kind: MissionKind
  target: number
  progress: number
  reward: number
  label: string
  claimed: boolean
}

export interface DailyState {
  day: string
  kind: MissionKind
  target: number
  progress: number
  reward: number
  label: string
  claimed: boolean
}

export interface ProgressSave {
  xp: number
  missions: MissionState[]
  daily: DailyState
  streak: number
  lastDailyClaim: string
  pseudo: string
}

const RANKS: Array<[number, string]> = [
  [0, 'Coursier'],
  [80, 'Éclaireur'],
  [200, 'Pilote du lagon'],
  [400, 'Gardien du marché'],
  [700, 'Voix de Ganvié'],
  [1100, 'Héritier de Porto-Novo'],
  [1600, 'Légende de Nokoué'],
]

const TEMPLATES: Array<Omit<MissionState, 'id' | 'progress' | 'claimed'>> = [
  { kind: 'cauris', target: 300, reward: 120, label: 'Ramasse 300 cauris' },
  { kind: 'taxis', target: 10, reward: 80, label: 'Esquive 10 taxis' },
  { kind: 'slides', target: 5, reward: 50, label: 'Glisse sous 5 banderoles' },
  { kind: 'cauris', target: 80, reward: 40, label: 'Ramasse 80 cauris' },
  { kind: 'taxis', target: 4, reward: 35, label: 'Esquive 4 taxis' },
  { kind: 'slides', target: 8, reward: 45, label: 'Glisse sous 8 banderoles' },
  { kind: 'jumps', target: 25, reward: 30, label: 'Saute 25 fois' },
  { kind: 'distance', target: 900, reward: 55, label: 'Parcours 900 mètres' },
  { kind: 'zones', target: 3, reward: 60, label: 'Traverse 3 quartiers' },
  { kind: 'cauris', target: 150, reward: 70, label: 'Ramasse 150 cauris' },
]

const DAILIES: Array<Omit<DailyState, 'day' | 'progress' | 'claimed'>> = [
  { kind: 'cauris', target: 40, reward: 40, label: 'Aujourd’hui : 40 cauris' },
  { kind: 'taxis', target: 3, reward: 45, label: 'Aujourd’hui : esquive 3 taxis' },
  { kind: 'slides', target: 3, reward: 40, label: 'Aujourd’hui : 3 glissades' },
  { kind: 'distance', target: 800, reward: 50, label: 'Aujourd’hui : 800 mètres' },
  { kind: 'jumps', target: 15, reward: 35, label: 'Aujourd’hui : 15 sauts' },
  { kind: 'zones', target: 2, reward: 55, label: 'Aujourd’hui : 2 quartiers' },
]

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}

function freshMission(template: (typeof TEMPLATES)[number], salt: string): MissionState {
  return { ...template, id: `${template.kind}-${template.target}-${salt}`, progress: 0, claimed: false }
}

export function starterMissions(): MissionState[] {
  return TEMPLATES.slice(0, 3).map((template, index) => freshMission(template, `start-${index}`))
}

export function refillMissions(current: MissionState[]): MissionState[] {
  const used = new Set(current.filter((mission) => !mission.claimed).map((mission) => mission.label))
  const next: MissionState[] = current.filter((mission) => !mission.claimed)
  let salt = 0
  while (next.length < 3) {
    const template = TEMPLATES[(current.length + salt) % TEMPLATES.length]
    salt++
    if (used.has(template.label)) continue
    used.add(template.label)
    next.push(freshMission(template, `${todayKey()}-${salt}-${next.length}`))
    if (salt > 20) {
      next.push(freshMission(TEMPLATES[salt % TEMPLATES.length], `extra-${salt}`))
    }
  }
  return next.slice(0, 3)
}

export function makeDaily(day = todayKey()): DailyState {
  const index = Number(day.replaceAll('-', '')) % DAILIES.length
  const template = DAILIES[index]
  return { ...template, day, progress: 0, claimed: false }
}

export function normalizeProgress(raw: Partial<ProgressSave> | undefined): ProgressSave {
  const day = todayKey()
  const missions = Array.isArray(raw?.missions) && raw.missions.length === 3 ? raw.missions.map(cleanMission) : starterMissions()
  let daily = raw?.daily && raw.daily.day === day ? cleanDaily(raw.daily) : makeDaily(day)
  let streak = typeof raw?.streak === 'number' ? Math.max(0, Math.floor(raw.streak)) : 0
  const lastDailyClaim = typeof raw?.lastDailyClaim === 'string' ? raw.lastDailyClaim : ''
  if (raw?.daily && raw.daily.day !== day && lastDailyClaim && lastDailyClaim !== shiftDay(day, -1) && lastDailyClaim !== day) {
    streak = 0
  }
  if (!daily || daily.day !== day) daily = makeDaily(day)
  return {
    xp: typeof raw?.xp === 'number' && raw.xp > 0 ? Math.floor(raw.xp) : 0,
    missions,
    daily,
    streak,
    lastDailyClaim,
    pseudo: sanitizePseudo(raw?.pseudo ?? ''),
  }
}

function cleanMission(value: MissionState): MissionState {
  return {
    id: String(value.id || 'mission'),
    kind: value.kind,
    target: Math.max(1, Math.floor(value.target || 1)),
    progress: Math.max(0, Math.floor(value.progress || 0)),
    reward: Math.max(0, Math.floor(value.reward || 0)),
    label: String(value.label || 'Mission'),
    claimed: Boolean(value.claimed),
  }
}

function cleanDaily(value: DailyState): DailyState {
  return {
    day: value.day,
    kind: value.kind,
    target: Math.max(1, Math.floor(value.target || 1)),
    progress: Math.max(0, Math.floor(value.progress || 0)),
    reward: Math.max(0, Math.floor(value.reward || 0)),
    label: String(value.label || 'Défi du jour'),
    claimed: Boolean(value.claimed),
  }
}

export function sanitizePseudo(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 16)
}

export function addProgress(save: ProgressSave, kind: MissionKind, amount: number): void {
  const gain = Math.max(0, amount)
  if (gain === 0) return
  for (const mission of save.missions) {
    if (!mission.claimed && mission.kind === kind) {
      mission.progress = Math.min(mission.target, mission.progress + (kind === 'distance' ? gain : Math.round(gain)))
    }
  }
  if (!save.daily.claimed && save.daily.kind === kind && save.daily.day === todayKey()) {
    save.daily.progress = Math.min(save.daily.target, save.daily.progress + (kind === 'distance' ? gain : Math.round(gain)))
  }
}

export function claimMission(save: ProgressSave, id: string): number {
  const mission = save.missions.find((item) => item.id === id)
  if (!mission || mission.claimed || mission.progress < mission.target) return 0
  mission.claimed = true
  save.xp += mission.reward
  const reward = mission.reward
  if (save.missions.every((item) => item.claimed)) save.missions = refillMissions(save.missions)
  return reward
}

export function claimDaily(save: ProgressSave): number {
  const day = todayKey()
  if (save.daily.day !== day) save.daily = makeDaily(day)
  if (save.daily.claimed || save.daily.progress < save.daily.target) return 0
  save.daily.claimed = true
  const continued = save.lastDailyClaim === shiftDay(day, -1)
  save.streak = continued ? save.streak + 1 : 1
  save.lastDailyClaim = day
  const bonus = Math.min(120, (save.streak - 1) * 15)
  const reward = save.daily.reward + bonus
  save.xp += reward
  return reward
}

export function rankFor(xp: number): { level: number; name: string; next: number } {
  let level = 1
  let name = RANKS[0][1]
  let next = RANKS[1]?.[0] ?? RANKS[0][0]
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i][0]) {
      level = i + 1
      name = RANKS[i][1]
      next = RANKS[i + 1]?.[0] ?? RANKS[i][0]
    }
  }
  return { level, name, next }
}
