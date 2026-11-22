export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private muted = false
  private nextAt = 0
  private step = 0
  private readonly stepDur = 0.27

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04)
    }
  }

  unlock(): void {
    this.ensure()
  }

  tick(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || this.muted || !this.master) return
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05
    while (this.nextAt < ctx.currentTime + 0.3) {
      this.schedule(this.step % 16, this.nextAt)
      this.nextAt += this.stepDur
      this.step = (this.step + 1) % 16
    }
  }

  click(): void {
    if (!this.can()) return
    this.tone(640, this.ctx!.currentTime, 0.05, 'square', 0.04)
  }

  jump(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(280, t)
    o.frequency.exponentialRampToValueAtTime(720, t + 0.12)
    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(this.master!)
    o.start(t)
    o.stop(t + 0.18)
  }

  slide(): void {
    if (!this.can()) return
    this.noiseBurst(this.ctx!.currentTime, 900, 0.12, 0.08)
  }

  coin(mult: number): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    const f = 720 + Math.min(mult, 8) * 55
    this.tone(f, t, 0.07, 'sine', 0.09)
    this.tone(f * 1.5, t + 0.045, 0.09, 'sine', 0.06)
  }

  power(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.06, 0.12, 'triangle', 0.07))
  }

  board(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.tone(392, t, 0.1, 'sine', 0.08)
    this.tone(587, t + 0.08, 0.14, 'sine', 0.08)
    this.tone(880, t + 0.16, 0.2, 'triangle', 0.06)
  }

  hit(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.noiseBurst(t, 240, 0.18, 0.2)
    this.tone(110, t, 0.2, 'sine', 0.12)
  }

  whistle(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(920, t)
    o.frequency.linearRampToValueAtTime(1780, t + 0.1)
    o.frequency.linearRampToValueAtTime(1040, t + 0.28)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36)
    o.connect(g)
    g.connect(this.master!)
    o.start(t)
    o.stop(t + 0.38)
  }

  escape(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    this.tone(523, t, 0.08, 'sine', 0.06)
    this.tone(784, t + 0.07, 0.12, 'sine', 0.05)
  }

  over(record: boolean): void {
    if (!this.can()) return
    this.whistle()
    const t = this.ctx!.currentTime + 0.12
    if (record) {
      ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.09, 0.18, 'triangle', 0.08))
      return
    }
    const o = this.ctx!.createOscillator()
    const g = this.ctx!.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(440, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.45)
    g.gain.setValueAtTime(0.1, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g)
    g.connect(this.master!)
    o.start(t)
    o.stop(t + 0.52)
  }

  buy(): void {
    if (!this.can()) return
    const t = this.ctx!.currentTime
    ;[660, 880, 990].forEach((f, i) => this.tone(f, t + i * 0.07, 0.1, 'square', 0.04))
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
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noise = buffer
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noiseBurst(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(freq, t)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private schedule(i: number, t: number): void {
    if (i === 0 || i === 8) this.kick(t, 0.55)
    if (i === 10) this.kick(t, 0.28)
    if (i === 4 || i === 12) this.clap(t)
    if (i % 2 === 0) this.hat(t, i === 14)
    const bass = [73.4, 0, 87.3, 0, 98, 0, 110, 0, 73.4, 0, 130.8, 0, 110, 98, 87.3, 73.4]
    if (bass[i]) this.tone(bass[i], t, 0.16, 'triangle', 0.11)
    const lead = [293.7, 0, 0, 349.2, 0, 0, 440, 0, 392, 0, 0, 349.2, 0, 0, 293.7, 0]
    if (lead[i]) this.tone(lead[i], t, 0.2, 'sine', 0.045)
  }

  private kick(t: number, gain: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(168, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.12)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.18)
  }

  private clap(t: number): void {
    this.noiseBurst(t, 1800, 0.08, 0.08)
  }

  private hat(t: number, open: boolean): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 6500
    const g = ctx.createGain()
    g.gain.setValueAtTime(open ? 0.05 : 0.028, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.14 : 0.035))
    src.connect(filter)
    filter.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + 0.16)
  }
}
