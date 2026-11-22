import type { BoardId } from './boards'

const KEY = 'nokoue-rush-v1'
const IDS: BoardId[] = ['pirogue', 'wax', 'taxi', 'palais']

export interface SaveData {
  best: number
  cauris: number
  owned: BoardId[]
  equipped: BoardId
  muted: boolean
}

function isBoard(v: unknown): v is BoardId {
  return typeof v === 'string' && IDS.includes(v as BoardId)
}

export function defaultSave(): SaveData {
  return {
    best: 0,
    cauris: 0,
    owned: ['pirogue'],
    equipped: 'pirogue',
    muted: false,
  }
}

export function loadSave(): SaveData {
  const base = defaultSave()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const data = JSON.parse(raw) as Partial<SaveData>
    const owned = Array.isArray(data.owned) ? data.owned.filter(isBoard) : base.owned
    if (!owned.includes('pirogue')) owned.unshift('pirogue')
    const equipped = isBoard(data.equipped) && owned.includes(data.equipped) ? data.equipped : 'pirogue'
    return {
      best: typeof data.best === 'number' && data.best > 0 ? Math.floor(data.best) : 0,
      cauris: typeof data.cauris === 'number' && data.cauris > 0 ? Math.floor(data.cauris) : 0,
      owned,
      equipped,
      muted: Boolean(data.muted),
    }
  } catch {
    return base
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* navigation privée : la partie continue sans mémoire */
  }
}
