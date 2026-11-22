export interface ScoreInput {
  name: string
  score: number
  cauris: number
  zone: string
  duration: number
  distance: number
}

export interface ScoreRow {
  name: string
  score: number
  cauris: number
  zone: string
  at: number
}

export interface SubmitResult {
  ok: boolean
  reason: string
}

export interface LeaderboardAdapter {
  readonly mode: 'local' | 'supabase'
  submit(input: ScoreInput): Promise<SubmitResult>
  top(limit?: number): Promise<ScoreRow[]>
  personal(name: string): Promise<ScoreRow | null>
}

const LOCAL_KEY = 'nokoue-rush-board'

export function checkScore(input: ScoreInput): string | null {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 16) return 'Pseudo de 2 à 16 caractères.'
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return 'Caractères non permis dans le pseudo.'
  if (input.score < 0 || input.cauris < 0 || input.distance < 0) return 'Valeurs invalides.'
  if (input.duration < 3) return 'Course trop courte pour le classement.'
  if (input.duration < input.distance / 48 - 0.5) return 'Temps incohérent avec la distance.'
  if (input.score > input.duration * 900 + 80) return 'Score trop élevé pour la durée.'
  if (input.cauris > input.duration * 12 + 8) return 'Trop de cauris pour la durée.'
  return null
}

function readLocal(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as ScoreRow[]
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row.score === 'number' && typeof row.name === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(rows: ScoreRow[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 50)))
  } catch {
    /* mémoire locale indisponible */
  }
}

export class LocalLeaderboard implements LeaderboardAdapter {
  readonly mode = 'local' as const

  async submit(input: ScoreInput): Promise<SubmitResult> {
    const reason = checkScore(input)
    if (reason) return { ok: false, reason }
    const rows = readLocal()
    rows.push({
      name: input.name.trim(),
      score: Math.floor(input.score),
      cauris: Math.floor(input.cauris),
      zone: input.zone,
      at: Date.now(),
    })
    rows.sort((a, b) => b.score - a.score)
    writeLocal(rows)
    return { ok: true, reason: 'Enregistré sur cet appareil.' }
  }

  async top(limit = 50): Promise<ScoreRow[]> {
    return readLocal()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async personal(name: string): Promise<ScoreRow | null> {
    const needle = name.trim().toLowerCase()
    return (
      readLocal()
        .filter((row) => row.name.toLowerCase() === needle)
        .sort((a, b) => b.score - a.score)[0] ?? null
    )
  }
}

export class SupabaseLeaderboard implements LeaderboardAdapter {
  readonly mode = 'supabase' as const
  private readonly local = new LocalLeaderboard()

  constructor(
    private readonly url: string,
    private readonly key: string,
  ) {}

  async submit(input: ScoreInput): Promise<SubmitResult> {
    const reason = checkScore(input)
    if (reason) return { ok: false, reason }
    try {
      const response = await fetch(`${this.url}/rest/v1/scores`, {
        method: 'POST',
        cache: 'no-store',
        headers: this.headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          name: input.name.trim(),
          score: Math.floor(input.score),
          cauris: Math.floor(input.cauris),
          zone: input.zone,
          duration: input.duration,
          distance: input.distance,
        }),
      })
      if (!response.ok) return { ok: false, reason: 'Le classement en ligne a refusé le score.' }
      return { ok: true, reason: 'Score publié.' }
    } catch {
      const local = await this.local.submit(input)
      if (!local.ok) return local
      return { ok: true, reason: 'Hors ligne : score enregistré sur cet appareil.' }
    }
  }

  async top(limit = 50): Promise<ScoreRow[]> {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/scores?select=name,score,cauris,zone,created_at&order=score.desc&limit=${limit}`,
        { cache: 'no-store', headers: this.headers() },
      )
      if (!response.ok) return this.local.top(limit)
      const rows = (await response.json()) as Array<Record<string, unknown>>
      return rows.map(mapRow)
    } catch {
      return this.local.top(limit)
    }
  }

  async personal(name: string): Promise<ScoreRow | null> {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/scores?select=name,score,cauris,zone,created_at&name=eq.${encodeURIComponent(name.trim())}&order=score.desc&limit=1`,
        { cache: 'no-store', headers: this.headers() },
      )
      if (!response.ok) return this.local.personal(name)
      const rows = (await response.json()) as Array<Record<string, unknown>>
      return rows[0] ? mapRow(rows[0]) : this.local.personal(name)
    } catch {
      return this.local.personal(name)
    }
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...extra,
    }
  }
}

function mapRow(row: Record<string, unknown>): ScoreRow {
  return {
    name: String(row.name ?? ''),
    score: Number(row.score ?? 0),
    cauris: Number(row.cauris ?? 0),
    zone: String(row.zone ?? ''),
    at: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
  }
}

export function createLeaderboard(): LeaderboardAdapter {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (url && key) return new SupabaseLeaderboard(url.replace(/\/$/, ''), key)
  return new LocalLeaderboard()
}
