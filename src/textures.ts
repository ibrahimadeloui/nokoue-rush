import * as THREE from 'three'

interface Label {
  key: string
  text: string
  bg: string
  fg: string
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
  roundRect(g, 4, 4, w - 8, h - 8, 18)
  g.fill()
  g.fillStyle = entry.fg
  g.font = `800 ${Math.floor(h * 0.46)}px Nunito, "Trebuchet MS", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(entry.text, w / 2, h / 2 + 2)
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

export function labelMaterial(text: string, bg: string, fg: string): THREE.MeshBasicMaterial {
  const key = `${text}|${bg}|${fg}`
  const found = labels.find((l) => l.key === key)
  if (found) return found.material
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  const entry: Label = { key, text, bg, fg, texture, material }
  labels.push(entry)
  paint(entry)
  return material
}

export function refreshLabels(): void {
  for (const entry of labels) paint(entry)
}

if (typeof document !== 'undefined' && document.fonts?.ready) {
  void document.fonts.ready.then(() => refreshLabels())
}
