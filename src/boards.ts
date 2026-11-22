export type BoardId = 'pirogue' | 'wax' | 'taxi' | 'palais'
export type Perk = 'jump' | 'mult' | 'speed' | 'magnet'

export interface BoardDef {
  id: BoardId
  name: string
  tagline: string
  description: string
  price: number
  perk: Perk
  glow: string
  glowHex: number
}

export const BOARDS: BoardDef[] = [
  {
    id: 'pirogue',
    name: 'Pirogue Bleue',
    tagline: 'Esprit du lagon',
    description: 'Fluide et légère. Les sauts montent plus haut tant que la planche encaisse le choc.',
    price: 0,
    perk: 'jump',
    glow: '#2e8bc7',
    glowHex: 0x2e8bc7,
  },
  {
    id: 'wax',
    name: 'Wax Rouge',
    tagline: 'Audace et fierté',
    description: 'Le multiplicateur gagne +1 pendant que la planche est active.',
    price: 90,
    perk: 'mult',
    glow: '#e23b32',
    glowHex: 0xe23b32,
  },
  {
    id: 'taxi',
    name: 'Taxi-Brousse',
    tagline: 'Partout pour tous',
    description: 'Bruyante et rapide. La course accélère tant que la planche tient.',
    price: 220,
    perk: 'speed',
    glow: '#f0c430',
    glowHex: 0xf0c430,
  },
  {
    id: 'palais',
    name: 'Palais',
    tagline: 'Héritage de Porto-Novo',
    description: 'Noble et majestueuse. Elle aimante les cauris, et l’aimant reste après le choc.',
    price: 460,
    perk: 'magnet',
    glow: '#14988f',
    glowHex: 0x14988f,
  },
]

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]))

export function boardById(id: BoardId): BoardDef {
  return BY_ID.get(id) ?? BOARDS[0]
}

export function formatCauris(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString('fr-FR')
}
