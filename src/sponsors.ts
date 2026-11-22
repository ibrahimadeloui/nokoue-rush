import { labelMaterial } from './textures'

/**
 * Emplacements sponsors in-game — un fichier pour tout brancher.
 *
 * Quatre types d’emplacements :
 * - `stall`  : enseigne d’étal (entrée, le plus abordable)
 * - `taxi`   : portes + toit du taxi jaune-vert (le plus visible)
 * - `banner` : banderole au-dessus de la route (premium, on passe dessous)
 * - `board`  : couleurs exclusives de la planche et du haut du coureur
 *
 * Pour vendre un emplacement à une marque :
 * 1. Change `name`, `color` (fond, hex) et `textColor` (texte, hex).
 * 2. Optionnel : dépose un logo PNG/SVG dans `public/sponsors/`
 *    (ex. `public/sponsors/freeshop.png`) et renseigne `logo: 'sponsors/freeshop.png'`.
 * 3. Rebuild web / `npm run build:android` puis resynchronise l’APK.
 *
 * Les valeurs par défaut affichent « Votre marque ici ».
 * `stallExtras` ajoute un exemple réel (Freeshop Africa) sur certains étals.
 */
export type SponsorSlotId = 'stall' | 'taxi' | 'banner' | 'board'

export interface Sponsor {
  name: string
  color: string
  textColor: string
  /** Chemin relatif depuis `public/`, ex. `sponsors/ma-marque.png`. */
  logo?: string
}

export const SPONSORS: Record<SponsorSlotId, Sponsor> = {
  stall: {
    name: 'Votre marque ici',
    color: '#0f766e',
    textColor: '#fff6d0',
  },
  taxi: {
    name: 'Votre marque ici',
    color: '#1f8a4c',
    textColor: '#fff6d0',
  },
  banner: {
    name: 'Votre marque ici',
    color: '#9a3412',
    textColor: '#fff6e8',
  },
  board: {
    name: 'Votre marque ici',
    color: '#14988f',
    textColor: '#fff6d0',
  },
}

/** Marques supplémentaires cyclées sur les enseignes d’étal (exemple local). */
export const STALL_EXTRAS: Sponsor[] = [
  {
    name: 'Freeshop Africa',
    color: '#083038',
    textColor: '#f0c430',
  },
]

export function stallSponsor(index: number): Sponsor {
  const list = [SPONSORS.stall, ...STALL_EXTRAS]
  return list[Math.abs(index) % list.length]
}

export function sponsorHex(color: string): number {
  const raw = color.trim().replace('#', '')
  return Number.parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16)
}

export function sponsorMaterial(sponsor: Sponsor): ReturnType<typeof labelMaterial> {
  return labelMaterial(sponsor.name, sponsor.color, sponsor.textColor, { logo: sponsor.logo })
}
