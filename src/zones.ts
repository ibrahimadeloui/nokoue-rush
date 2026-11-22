export type ZoneId = 'marche' | 'lagune' | 'porto' | 'plage'

export interface ZoneDef {
  id: ZoneId
  name: string
  city: string
  length: number
  skyTop: string
  skyMid: string
  horizon: string
  fog: number
  fogNear: number
  fogFar: number
}

export const ZONES: ZoneDef[] = [
  {
    id: 'marche',
    name: 'Marché Dantokpa',
    city: 'Cotonou',
    length: 260,
    skyTop: '#6ec4ee',
    skyMid: '#ffd7ae',
    horizon: '#f3b56a',
    fog: 0xf6c898,
    fogNear: 18,
    fogFar: 56,
  },
  {
    id: 'lagune',
    name: 'Lac Nokoué',
    city: 'Ganvié',
    length: 260,
    skyTop: '#79c7e4',
    skyMid: '#b7e4d8',
    horizon: '#8ec8c2',
    fog: 0x9fd4d4,
    fogNear: 16,
    fogFar: 52,
  },
  {
    id: 'porto',
    name: 'Quartier du patrimoine',
    city: 'Porto-Novo',
    length: 260,
    skyTop: '#f0b07a',
    skyMid: '#f6d7b0',
    horizon: '#e7b48a',
    fog: 0xf0c8a4,
    fogNear: 17,
    fogFar: 54,
  },
  {
    id: 'plage',
    name: 'Route de Fidjrosse',
    city: 'Cotonou',
    length: 240,
    skyTop: '#5eb4ea',
    skyMid: '#ffe3b8',
    horizon: '#f6d7a2',
    fog: 0xf3d7ae,
    fogNear: 18,
    fogFar: 58,
  },
]

export function zoneAt(distance: number): ZoneDef {
  let left = Math.max(0, distance)
  for (let guard = 0; guard < 48; guard++) {
    const zone = ZONES[guard % ZONES.length]
    if (left < zone.length) return zone
    left -= zone.length
  }
  return ZONES[0]
}

export function zoneById(id: string): ZoneDef {
  return ZONES.find((zone) => zone.id === id) ?? ZONES[0]
}
