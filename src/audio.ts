import type { ZoneId } from './zones'

export type MusicCue = 'menu' | ZoneId

interface Track {
  step: number
  count: number
  bell: number[]
  kick: number[]
  clap: number[]
  bass: number[]
  lead: number[]
  drum: number[]
  hat: number
}

const BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]
const PENTA = [73.4, 87.3, 98, 110, 130.8, 146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 392, 440]

const TRACKS: Record<MusicCue, Track> = {
  menu: {
    step: 0.21,
    count: 12,
    bell: BELL.map((hit) => hit * 0.7),
    kick: [0.25, 0, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [73.4, 0, 0, 98, 0, 0, 87.3, 0, 0, 110, 0, 0],
    lead: [392, 0, 440, 0, 349.2, 0, 392, 0, 329.6, 0, 294, 0],
    drum: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hat: 0.012,
  },
  marche: {
    step: 0.145,
    count: 12,
    bell: BELL,
    kick: [0.62, 0, 0, 0.22, 0, 0, 0.48, 0, 0.2, 0, 0, 0.28],
    clap: [0, 0, 0, 0.16, 0, 0, 0, 0, 0.18, 0, 0, 0],
    bass: [73.4, 0, 73.4, 0, 98, 0, 87.3, 0, 110, 0, 98, 73.4],
    lead: [293.7, 0, 349.2, 0, 392, 0, 440, 0, 392, 349.2, 0, 293.7],
    drum: [1, 0, 0.4, 0, 1, 0.6, 0, 0.5, 0, 1, 0, 0.3],
    hat: 0.02,
  },
  lagune: {
    step: 0.18,
    count: 12,
    bell: BELL.map((hit) => hit * 0.55),
    kick: [0.35, 0, 0, 0, 0.22, 0, 0.3, 0, 0, 0.18, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0],
    bass: [65.4, 0, 0, 87.3, 0, 98, 0, 0, 73.4, 0, 87.3, 0],
    lead: [349.2, 0, 0, 392, 0, 440, 0, 329.6, 0, 392, 0, 293.7],
    drum: [0.5, 0, 0, 0.3, 0, 0, 0.6, 0, 0, 0.4, 0, 0],
    hat: 0.028,
  },
  porto: {
    step: 0.15,
    count: 16,
    bell: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0],
    kick: [0.7, 0, 0, 0, 0, 0.28, 0.45, 0, 0, 0.22, 0.62, 0, 0, 0, 0.3, 0],
    clap: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0.22, 0, 0, 0],
    bass: [82.4, 0, 82.4, 0, 98, 0, 73.4, 0, 110, 0, 98, 0, 87.3, 0, 73.4, 0],
    lead: [329.6, 0, 392, 0, 440, 0, 392, 0, 349.2, 0, 440, 0, 392, 0, 329.6, 0],
    drum: [0.3, 0, 0.6, 0, 0, 0.4, 0, 0, 0.8, 0, 0.3, 0, 0, 0.5, 0, 0],
    hat: 0.018,
  },
  plage: {
    step: 0.135,
    count: 16,
    bell: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
    kick: [0.55, 0, 0, 0.2, 0, 0, 0.48, 0, 0, 0.24, 0.4, 0, 0, 0, 0.32, 0],
    clap: [0, 0, 0, 0, 0.16, 0, 0, 0, 0, 0, 0, 0, 0.18, 0, 0, 0.1],
    bass: [98, 0, 98, 0, 123.5, 0, 110, 0, 98, 0, 87.3, 0, 110, 0, 98, 0],
    lead: [392, 0, 494, 0, 440, 0, 523, 0, 440, 0, 392, 0, 349.2, 0, 392, 0],
    drum: [0.2, 0, 0, 0.4, 0, 0, 0.3, 0, 0.5, 0, 0, 0.3, 0, 0, 0.4, 0],
    hat: 0.026,
  },
}

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private noise: AudioBuffer | null = null
  private silent: AudioBuffer | null = null
  private muted = false
  private nextAt = 0
  private step = 0
  private cue: MusicCue = 'menu'
  private pending: MusicCue = 'menu'
  private listening = false

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04)
  }

  setZone(cue: MusicCue): void {
    this.pending = cue
  }

  attachUnlock(): void {
    if (this.listening) return
    this.listening = true
    const wake = (): void => {
      this.unlock()
    }
    window.addEventListener('pointerdown', wake, { capture: true })
    window.addEventListener('touchstart', wake, { capture: true, passive: true })
    window.addEventListener('keydown', wake, { capture: true })
  }

  unlock(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state !== 'running') void ctx.resume()
    if (this.silent) {
      try {
        const src = ctx.createBufferSource()
        src.buffer = this.silent
        src.connect(ctx.destination)
        src.start(0)
      } catch {
        /* certains navigateurs refusent un second start hors geste */
      }
    }
  }

  tick(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || this.muted || !this.music) return
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05
    const track = TRACKS[this.cue]
    while (this.nextAt < ctx.currentTime + 0.28) {
      this.playStep(track, this.step % track.count, this.nextAt)
      this.nextAt += track.step
      this.step++
      if (this.step % track.count === 0 && this.pending !== this.cue) {
        this.cue = this.pending
        this.step = 0
      }
    }
  }

  click(): void {
    if (!this.can()) return
    this.tone(640, this.ctx!.currentTime, 0.05, 'square', 0.04, this.master!)
  }

  jump(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(320, t)
    o.frequency.exponentialRampToValueAtTime(880, t + 0.11)
    g.gain.setValueAtTime(0.16, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g)
    g.connect(this.master!)
    o.start(t)
    o.stop(t + 0.2)
    this.tone(523, t + 0.05, 0.08, 'sine', 0.04, this.master!)
  }

  slide(): void {
    if (!this.can()) return
    this.noiseBurst(this.ctx!.currentTime, 700, 0.16, 0.13, 'lowpass')
  }

  coin(mult: number): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    const f = 784 + Math.min(mult, 8) * 40
    this.tone(f, t, 0.1, 'sine', 0.11, this.master!)
    this.tone(f * 1.5, t + 0.04, 0.13, 'triangle', 0.07, this.master!)
    this.tone(f * 2, t + 0.07, 0.1, 'sine', 0.04, this.master!)
  }

  power(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    ;[523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, t + index * 0.06, 0.12, 'triangle', 0.06, this.master!))
  }

  board(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.tone(392, t, 0.1, 'sine', 0.07, this.master!)
    this.tone(587, t + 0.08, 0.14, 'sine', 0.07, this.master!)
    this.tone(880, t + 0.16, 0.2, 'triangle', 0.05, this.master!)
  }

  hit(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.noiseBurst(t, 180, 0.22, 0.26, 'lowpass')
    this.tone(98, t, 0.24, 'sine', 0.16, this.master!)
    this.tone(62, t, 0.18, 'triangle', 0.08, this.master!)
  }

  whistle(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.chirp(t, 980, 1680)
    this.chirp(t + 0.22, 1100, 1520)
  }

  horn(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.beep(t, 392, 0.11, 0.08)
    this.beep(t + 0.14, 311, 0.16, 0.07)
  }

  escape(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.tone(523, t, 0.08, 'sine', 0.05, this.master!)
    this.tone(784, t + 0.07, 0.12, 'sine', 0.045, this.master!)
  }

  over(record: boolean): void {
    if (!this.can()) return
    this.whistle()
    const t = this.ctx!.currentTime + 0.18
    if (record) {
      ;[523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, t + index * 0.09, 0.18, 'triangle', 0.07, this.master!))
      return
    }
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(440, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.45)
    g.gain.setValueAtTime(0.13, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g)
    g.connect(this.master!)
    o.start(t)
    o.stop(t + 0.52)
  }

  buy(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    ;[660, 880, 990].forEach((freq, index) => this.tone(freq, t + index * 0.07, 0.1, 'square', 0.035, this.master!))
  }

  private playStep(track: Track, index: number, time: number): void {
    if (!this.music) return
    if (track.bell[index]) this.bell(time, 0.05 * track.bell[index])
    if (track.kick[index]) this.kick(time, track.kick[index])
    if (track.clap[index]) this.noiseBurst(time, 1800, 0.07, track.clap[index], 'bandpass', this.music)
    if (track.drum[index]) this.talking(time, track.drum[index])
    if (track.bass[index]) this.tone(track.bass[index], time, track.step * 0.9, 'triangle', 0.1, this.music)
    if (track.lead[index]) this.tone(track.lead[index], time, track.step * 0.8, 'sine', 0.055, this.music)
    if (track.hat > 0 && index % 2 === 0) this.hat(time, index % 4 === 2, track.hat)
    if (track.bell[index] && index % 3 === 0) this.tone(988, time + 0.03, 0.05, 'square', 0.018, this.music)
    void PENTA
  }

  private bell(time: number, gain: number): void {
    this.tone(740, time, 0.08, 'square', gain * 0.45, this.music!)
    this.tone(1480, time, 0.06, 'sine', gain * 0.28, this.music!)
  }

  private talking(time: number, amount: number): void {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(180, time)
    o.frequency.exponentialRampToValueAtTime(90 + amount * 70, time + 0.12)
    g.gain.setValueAtTime(0.08 * amount, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16)
    o.connect(g)
    g.connect(this.music)
    o.start(time)
    o.stop(time + 0.18)
  }

  private chirp(time: number, from: number, to: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(from, time)
    o.frequency.linearRampToValueAtTime(to, time + 0.08)
    o.frequency.linearRampToValueAtTime(from * 0.92, time + 0.16)
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.09, time + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2)
    o.connect(g)
    g.connect(this.master)
    o.start(time)
    o.stop(time + 0.22)
  }

  private beep(time: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sawtooth'
    o2.type = 'square'
    o.frequency.value = freq
    o2.frequency.value = freq * 1.02
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    o.connect(g)
    o2.connect(g)
    g.connect(this.master)
    o.start(time)
    o2.start(time)
    o.stop(time + dur + 0.02)
    o2.stop(time + dur + 0.02)
  }

  private can(): boolean {
    const ctx = this.ensure()
    return !!ctx && ctx.state === 'running' && !this.muted && !!this.master
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const w = window as Window & { webkitAudioContext?: typeof AudioContext }
      const AC = window.AudioContext || w.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
      this.music = this.ctx.createGain()
      this.music.gain.value = 1
      this.music.connect(this.master)
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noise = buffer
      this.silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    }
    if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  private tone(freq: number, time: number, dur: number, type: OscillatorType, gain: number, dest: GainNode): void {
    const ctx = this.ctx
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(40, freq), time)
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.03, dur))
    o.connect(g)
    g.connect(dest)
    o.start(time)
    o.stop(time + dur + 0.02)
  }

  private noiseBurst(
    time: number,
    freq: number,
    dur: number,
    gain: number,
    type: BiquadFilterType,
    dest: GainNode | null = null,
  ): void {
    const ctx = this.ctx
    const target = dest ?? this.master
    if (!ctx || !target || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, time)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(target)
    src.start(time)
    src.stop(time + dur + 0.02)
  }

  private kick(time: number, gain: number): void {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(168, time)
    o.frequency.exponentialRampToValueAtTime(52, time + 0.12)
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16)
    o.connect(g)
    g.connect(this.music)
    o.start(time)
    o.stop(time + 0.18)
  }

  private hat(time: number, open: boolean, gain: number): void {
    this.noiseBurst(time, 6500, open ? 0.12 : 0.03, open ? gain * 1.6 : gain, 'highpass', this.music)
  }
}
