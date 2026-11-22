import * as THREE from 'three'

interface Label {
  key: string
  text: string
  bg: string
  fg: string
  logo?: string
  logoImg?: HTMLImageElement
  texture: THREE.CanvasTexture
  material: THREE.MeshBasicMaterial
}

const labels: Label[] = []

function paint(entry: Label): void {
  const canvas = entry.texture.image as HTMLCanvasElement
  const g = canvas.getContext('2d')
  if (!g) return
  const w = canvas.width
  const h = canvas.height
  g.clearRect(0, 0, w, h)
  g.fillStyle = entry.bg
  roundRect(g, 4, 4, w - 8, h - 8, Math.min(18, h * 0.12))
  g.fill()

  const words = entry.text.trim().split(/\s+/)
  const twoLines = words.length >= 2 && entry.text.length > 12
  const lines = twoLines
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [entry.text]

  const hasLogo = !!entry.logoImg
  const left = hasLogo ? w * 0.22 : 0
  const cx = left + (w - left) / 2
  if (hasLogo && entry.logoImg) {
    const box = Math.min(h * 0.62, w * 0.16)
    const lx = 18
    const ly = (h - box) / 2
    g.drawImage(entry.logoImg, lx, ly, box, box)
  }

  g.fillStyle = entry.fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const fontSize = twoLines ? Math.floor(h * 0.3) : Math.floor(h * (entry.text.length > 10 ? 0.36 : 0.46))
  g.font = `800 ${fontSize}px Nunito, "Trebuchet MS", sans-serif`
  if (twoLines) {
    g.fillText(lines[0], cx, h * 0.38)
    g.fillText(lines[1], cx, h * 0.68)
  } else {
    g.fillText(lines[0], cx, h / 2 + 2)
  }
  entry.texture.needsUpdate = true
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function labelMaterial(
  text: string,
  bg: string,
  fg: string,
  options?: { logo?: string },
): THREE.MeshBasicMaterial {
  const logo = options?.logo
  const key = `${text}|${bg}|${fg}|${logo ?? ''}`
  const found = labels.find((l) => l.key === key)
  if (found) return found.material
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  const entry: Label = { key, text, bg, fg, logo, texture, material }
  labels.push(entry)
  paint(entry)
  if (logo && typeof Image !== 'undefined') {
    const img = new Image()
    img.onload = () => {
      entry.logoImg = img
      paint(entry)
    }
    img.src = logo
  }
  return material
}

export function refreshLabels(): void {
  for (const entry of labels) paint(entry)
}

if (typeof document !== 'undefined' && document.fonts?.ready) {
  void document.fonts.ready.then(() => refreshLabels())
}
