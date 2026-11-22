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
    skyTop: '#7ec8f0',
    skyMid: '#ffd3a0',
    horizon: '#f4b56a',
    fog: 0xf3c090,
    fogNear: 22,
    fogFar: 68,
  },
  {
    id: 'lagune',
    name: 'Lac Nokoué',
    city: 'Ganvié',
    length: 260,
    skyTop: '#87cfe8',
    skyMid: '#c5eadc',
    horizon: '#9fd4c8',
    fog: 0xa8d8d0,
    fogNear: 20,
    fogFar: 64,
  },
  {
    id: 'porto',
    name: 'Quartier du patrimoine',
    city: 'Porto-Novo',
    length: 260,
    skyTop: '#f2b47c',
    skyMid: '#f8d8b0',
    horizon: '#eab48a',
    fog: 0xf2c6a0,
    fogNear: 21,
    fogFar: 66,
  },
  {
    id: 'plage',
    name: 'Route de Fidjrosse',
    city: 'Cotonou',
    length: 240,
    skyTop: '#6ab8ec',
    skyMid: '#ffe4b4',
    horizon: '#f6d09a',
    fog: 0xf4d0a6,
    fogNear: 22,
    fogFar: 70,
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
