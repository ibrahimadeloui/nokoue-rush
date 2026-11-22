import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BoardId } from './boards'
import { labelMaterial } from './textures'

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLow: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 9),
  torus: new THREE.TorusGeometry(1, 0.28, 6, 12),
}

const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
const basicVC = new THREE.MeshBasicMaterial({ vertexColors: true })

const colorMats = new Map<string, THREE.MeshLambertMaterial>()

function lambert(hex: number, flat = true): THREE.MeshLambertMaterial {
  const key = `${hex}:${flat ? 1 : 0}`
  let material = colorMats.get(key)
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color: hex, flatShading: flat })
    colorMats.set(key, material)
  }
  return material
}

class Baker {
  private parts: THREE.BufferGeometry[] = []

  put(
    src: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ): void {
    const geometry = src.clone()
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
    geometry.applyMatrix4(
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(sx, sy, sz)),
    )
    const c = new THREE.Color(color)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.parts.push(geometry)
  }

  mesh(material: THREE.Material): THREE.Mesh {
    const merged = mergeGeometries(this.parts, false)
    for (const part of this.parts) part.dispose()
    this.parts = []
    if (!merged) throw new Error('Fusion de géométrie impossible')
    return new THREE.Mesh(merged, material)
  }
}

function box(w: number, h: number, d: number, color: number, flat = true): THREE.Mesh {
  const mesh = new THREE.Mesh(GEO.box, lambert(color, flat))
  mesh.scale.set(w, h, d)
  return mesh
}

function sphere(sx: number, sy: number, sz: number, color: number, flat = false): THREE.Mesh {
  const mesh = new THREE.Mesh(GEO.sphere, lambert(color, flat))
  mesh.scale.set(sx, sy, sz)
  return mesh
}

export interface RunnerParts {
  root: THREE.Group
  bob: THREE.Group
  shadow: THREE.Mesh
  legL: THREE.Group
  legR: THREE.Group
  kneeL: THREE.Group
  kneeR: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  boards: Record<BoardId, THREE.Group>
  shield: THREE.Mesh
}

export interface CopParts {
  root: THREE.Group
  wheels: THREE.Mesh[]
}

export function makeRunner(): RunnerParts {
  const root = new THREE.Group()
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.03
  root.add(shadow)

  const boards = makeBoards()
  for (const board of Object.values(boards)) root.add(board)

  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x7af0e4,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  })
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), shieldMat)
  shield.position.y = 1.05
  shield.visible = false
  root.add(shield)

  const bob = new THREE.Group()
  root.add(bob)

  const skin = 0x6d3b24
  const { hip: legL, knee: kneeL } = makeLeg(-0.14, 0x128f96)
  const { hip: legR, knee: kneeR } = makeLeg(0.14, 0xff6b57)
  bob.add(legL, legR)

  const shorts = box(0.5, 0.3, 0.32, 0xff6b57)
  shorts.position.y = 0.96
  const sideL = box(0.08, 0.28, 0.3, 0x3c4d96)
  sideL.position.set(-0.24, 0.96, 0)
  const sideR = box(0.08, 0.28, 0.3, 0x3c4d96)
  sideR.position.set(0.24, 0.96, 0)
  bob.add(shorts, sideL, sideR)

  const mid = box(0.36, 0.14, 0.22, skin, false)
  mid.position.y = 1.16
  bob.add(mid)

  const top = box(0.5, 0.36, 0.3, 0x14988f)
  top.position.y = 1.4
  const hem = box(0.52, 0.07, 0.32, 0xf0c430)
  hem.position.y = 1.24
  const waxA = box(0.12, 0.12, 0.04, 0xf0c430)
  waxA.position.set(-0.1, 1.42, 0.16)
  waxA.rotation.z = Math.PI / 4
  const waxB = box(0.1, 0.1, 0.04, 0xff6b57)
  waxB.position.set(0.1, 1.4, 0.16)
  waxB.rotation.z = 0.4
  bob.add(top, hem, waxA, waxB)

  const bag = box(0.24, 0.28, 0.1, 0x8d5a34)
  bag.position.set(0.18, 1.08, 0.18)
  const flap = box(0.22, 0.08, 0.05, 0xc4784a)
  flap.position.set(0.18, 1.2, 0.2)
  const buckle = box(0.08, 0.06, 0.04, 0xf0c430)
  buckle.position.set(0.18, 1.18, 0.23)
  const strap = box(0.05, 0.48, 0.05, 0x6b4228)
  strap.position.set(0.2, 1.38, 0.12)
  strap.rotation.z = 0.45
  strap.rotation.x = 0.35
  bob.add(bag, flap, buckle, strap)

  const armL = makeArm(-0.34)
  const armR = makeArm(0.34)
  bob.add(armL, armR)

  const head = new THREE.Group()
  head.position.y = 1.74
  const skull = sphere(0.2, 0.22, 0.2, skin, false)
  const afro = sphere(0.33, 0.3, 0.32, 0x1a120e, false)
  afro.position.y = 0.12
  const puff = sphere(0.24, 0.2, 0.22, 0x140e0c, false)
  puff.position.set(0, 0.06, 0.12)
  head.add(skull, afro, puff)

  for (const side of [-1, 1]) {
    const hoop = new THREE.Mesh(GEO.torus, lambert(0xf0c430, true))
    hoop.scale.setScalar(0.075)
    hoop.position.set(side * 0.2, -0.02, 0)
    hoop.rotation.y = Math.PI / 2
    head.add(hoop)
    const eye = sphere(0.045, 0.05, 0.035, 0xfffaf3, false)
    eye.position.set(side * 0.07, 0.03, -0.16)
    const pupil = sphere(0.022, 0.026, 0.02, 0x1a120e, false)
    pupil.position.set(side * 0.07, 0.02, -0.19)
    head.add(eye, pupil)
  }
  bob.add(head)

  return { root, bob, shadow, legL, legR, kneeL, kneeR, armL, armR, boards, shield }
}

function makeLeg(x: number, shoeColor: number): { hip: THREE.Group; knee: THREE.Group } {
  const hip = new THREE.Group()
  hip.position.set(x, 0.84, 0)
  const thigh = box(0.15, 0.34, 0.16, 0x6d3b24, false)
  thigh.position.y = -0.17
  hip.add(thigh)
  const knee = new THREE.Group()
  knee.position.y = -0.34
  hip.add(knee)
  const shin = box(0.13, 0.3, 0.14, 0x6d3b24, false)
  shin.position.y = -0.15
  const shoe = box(0.16, 0.1, 0.28, shoeColor)
  shoe.position.set(0, -0.32, 0.04)
  const sole = box(0.17, 0.04, 0.3, 0xf4efe4)
  sole.position.set(0, -0.38, 0.04)
  const lace = box(0.06, 0.03, 0.1, 0xf0c430)
  lace.position.set(0, -0.26, -0.02)
  knee.add(shin, shoe, sole, lace)
  return { hip, knee }
}

function makeArm(x: number): THREE.Group {
  const arm = new THREE.Group()
  arm.position.set(x, 1.5, 0)
  const upper = box(0.11, 0.3, 0.12, 0x6d3b24, false)
  upper.position.y = -0.16
  const hand = sphere(0.07, 0.08, 0.07, 0x6d3b24, false)
  hand.position.y = -0.34
  const band = box(0.13, 0.06, 0.14, x < 0 ? 0xff6b57 : 0xf0c430)
  band.position.y = -0.02
  arm.add(upper, hand, band)
  return arm
}

function makeBoards(): Record<BoardId, THREE.Group> {
  return {
    pirogue: boardPirogue(),
    wax: boardWax(),
    taxi: boardTaxi(),
    palais: boardPalais(),
  }
}

function glowPlane(color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 1.45),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.02
  return mesh
}

function boardPirogue(): THREE.Group {
  const group = new THREE.Group()
  group.add(glowPlane(0x2e8bc7))
  const baker = new Baker()
  baker.put(GEO.sphereLow, 0x1d6fa8, 0, 0.1, 0, 0.42, 0.09, 0.82)
  baker.put(GEO.sphereLow, 0x3aa0dc, 0, 0.15, 0, 0.3, 0.06, 0.62)
  baker.put(GEO.box, 0xf7fbff, 0, 0.19, 0.15, 0.46, 0.02, 0.1)
  baker.put(GEO.box, 0xf7fbff, 0, 0.19, -0.22, 0.32, 0.02, 0.08)
  baker.put(GEO.cone, 0x1d6fa8, 0, 0.12, -0.78, 0.16, 0.22, 0.28, Math.PI / 2, 0, 0)
  group.add(baker.mesh(vcMat))
  group.position.y = 0.05
  return group
}

function boardWax(): THREE.Group {
  const group = new THREE.Group()
  group.add(glowPlane(0xe23b32))
  const baker = new Baker()
  baker.put(GEO.box, 0xc0392b, 0, 0.1, 0, 0.62, 0.08, 1.45)
  baker.put(GEO.box, 0x1a1a1a, 0, 0.15, 0, 0.26, 0.025, 0.26, 0, Math.PI / 4, 0)
  baker.put(GEO.box, 0xf0c430, 0, 0.17, 0, 0.12, 0.025, 0.12, 0, Math.PI / 4, 0)
  baker.put(GEO.box, 0xf0c430, -0.2, 0.15, 0.42, 0.12, 0.02, 0.12, 0, Math.PI / 4, 0)
  baker.put(GEO.box, 0x111111, 0.2, 0.15, -0.42, 0.12, 0.02, 0.12, 0, Math.PI / 4, 0)
  group.add(baker.mesh(vcMat))
  group.position.y = 0.05
  return group
}

function boardTaxi(): THREE.Group {
  const group = new THREE.Group()
  group.add(glowPlane(0xf0c430))
  const baker = new Baker()
  baker.put(GEO.box, 0xf0c430, 0, 0.1, 0, 0.66, 0.08, 1.5)
  baker.put(GEO.box, 0x1f8a4c, 0, 0.15, 0, 0.66, 0.03, 0.24)
  for (let i = 0; i < 6; i++) {
    baker.put(GEO.box, i % 2 ? 0x111111 : 0xf7f7f7, -0.24 + i * 0.1, 0.16, 0.42, 0.08, 0.02, 0.16)
  }
  group.add(baker.mesh(vcMat))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), labelMaterial('PORTO-NOVO', '#173024', '#f0c430'))
  sign.position.set(0, 0.36, 0.35)
  group.add(sign)
  group.position.y = 0.05
  return group
}

function boardPalais(): THREE.Group {
  const group = new THREE.Group()
  group.add(glowPlane(0x14988f))
  const baker = new Baker()
  baker.put(GEO.box, 0xc4785a, 0, 0.1, 0, 0.66, 0.09, 1.5)
  baker.put(GEO.box, 0x0f766e, 0, 0.16, 0, 0.22, 0.03, 0.22)
  baker.put(GEO.box, 0xf0c430, 0, 0.155, 0.48, 0.5, 0.025, 0.08)
  baker.put(GEO.box, 0xf0c430, 0, 0.155, -0.48, 0.5, 0.025, 0.08)
  baker.put(GEO.cyl, 0x14988f, -0.18, 0.16, 0.05, 0.07, 0.05, 0.07)
  baker.put(GEO.cyl, 0x14988f, 0.18, 0.16, 0.05, 0.07, 0.05, 0.07)
  baker.put(GEO.box, 0xf0c430, 0, 0.18, 0, 0.08, 0.03, 0.08)
  group.add(baker.mesh(vcMat))
  group.position.y = 0.05
  return group
}

export function makeCop(): CopParts {
  const root = new THREE.Group()
  const wheels: THREE.Mesh[] = []
  const khaki = 0xd8c48a

  const bike = new Baker()
  bike.put(GEO.box, 0x1f8a4c, 0, 0.4, 0.02, 0.46, 0.32, 1.35)
  bike.put(GEO.box, 0xf0c430, 0, 0.58, 0.02, 0.5, 0.08, 1.2)
  bike.put(GEO.box, 0x173024, 0, 0.7, 0.12, 0.34, 0.08, 0.36)
  bike.put(GEO.box, 0xc4784a, 0, 0.78, -0.58, 0.52, 0.05, 0.05)
  bike.put(GEO.cyl, 0xc4784a, -0.22, 0.62, -0.5, 0.035, 0.34, 0.035)
  bike.put(GEO.cyl, 0xc4784a, 0.22, 0.62, -0.5, 0.035, 0.34, 0.035)
  root.add(bike.mesh(vcMat))

  const places: Array<[number, number, number, number]> = [
    [0, 0.28, -0.5, 0.26],
    [-0.24, 0.26, 0.42, 0.24],
    [0.24, 0.26, 0.42, 0.24],
  ]
  for (const [x, y, z, radius] of places) {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, z)
    pivot.rotation.z = Math.PI / 2
    const mesh = new THREE.Mesh(GEO.cyl, lambert(0x222222))
    mesh.scale.set(radius, 0.12, radius)
    pivot.add(mesh)
    const hub = new THREE.Mesh(GEO.sphere, lambert(0xf0c430))
    hub.scale.setScalar(0.08)
    pivot.add(hub)
    root.add(pivot)
    wheels.push(mesh)
  }

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.22), labelMaterial('INSPECTEUR', '#f0c430', '#173024'))
  sign.position.set(0, 0.86, 0.36)
  root.add(sign)

  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(GEO.cyl, lambert(0x6b4228))
    pole.scale.set(0.03, 1.15, 0.03)
    pole.position.set(side * 0.32, 1.25, 0.15)
    root.add(pole)
    const colors = [0x008751, 0xfcd116, 0xe8112d]
    colors.forEach((color, index) => {
      const flag = box(0.2, 0.1, 0.025, color)
      flag.position.set(side * 0.44, 1.72 - index * 0.11, 0.15)
      root.add(flag)
    })
  }

  const rider = new THREE.Group()
  rider.position.set(0, 1.02, 0.02)
  const torso = box(0.52, 0.5, 0.36, khaki)
  torso.position.y = 0.32
  const belt = box(0.54, 0.07, 0.38, 0x6b4228)
  belt.position.y = 0.08
  const badge = sphere(0.06, 0.06, 0.03, 0xf0c430, false)
  badge.position.set(0, 0.42, -0.18)
  rider.add(torso, belt, badge)

  const head = new THREE.Group()
  head.position.y = 0.72
  head.add(sphere(0.2, 0.21, 0.2, 0x6d3b24, false))
  const cap = new THREE.Mesh(GEO.cyl, lambert(khaki))
  cap.scale.set(0.23, 0.14, 0.23)
  cap.position.y = 0.16
  const brim = box(0.3, 0.035, 0.18, khaki)
  brim.position.set(0, 0.1, -0.12)
  const capBadge = sphere(0.05, 0.05, 0.03, 0xe23b32, false)
  capBadge.position.set(0, 0.18, -0.18)
  head.add(cap, brim, capBadge)
  const mustache = box(0.3, 0.07, 0.1, 0x1a120e)
  mustache.position.set(0, -0.04, -0.16)
  const curlL = sphere(0.08, 0.09, 0.07, 0x1a120e, false)
  curlL.position.set(-0.18, -0.08, -0.04)
  const curlR = sphere(0.08, 0.09, 0.07, 0x1a120e, false)
  curlR.position.set(0.18, -0.08, -0.04)
  head.add(mustache, curlL, curlR)
  rider.add(head)

  const whistle = sphere(0.045, 0.045, 0.045, 0xd9dde2, false)
  whistle.position.set(0.12, 0.28, -0.16)
  const armL = box(0.1, 0.32, 0.1, khaki)
  armL.position.set(-0.28, 0.28, -0.08)
  armL.rotation.x = 0.7
  const armR = box(0.1, 0.32, 0.1, khaki)
  armR.position.set(0.28, 0.28, -0.08)
  armR.rotation.x = 0.7
  rider.add(whistle, armL, armR)
  root.add(rider)
  root.rotation.y = 0.65
  return { root, wheels }
}

const SIGNS = [
  ['MARCHÉ', '#0f766e', '#fff6e8'],
  ['TISSUS', '#ff6b4a', '#fff6e8'],
  ['AGON', '#3c4d96', '#fff6e8'],
  ['LAGUNE', '#1d6fa8', '#fff6e8'],
  ['GANHI', '#008751', '#fff6e8'],
  ['DANTOKPA', '#c4784a', '#fff6e8'],
  ['PORTO-NOVO', '#173024', '#f0c430'],
  ['COTONOU', '#f0c430', '#173024'],
] as const

const AWNINGS = [0xff6b4a, 0x14b8a6, 0xf0c430, 0x3c4d96, 0xe23b32, 0x1f8a4c]

export function makeSegment(index: number): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0xe7d3a4, 0.4, -0.08, 0, 16, 0.12, 20)
  baker.put(GEO.box, 0x2a86b8, -6.4, 0.02, 0, 4.4, 0.1, 20)
  baker.put(GEO.box, 0x49b4d6, -6.6, 0.09, 0, 2.2, 0.04, 20)
  baker.put(GEO.box, 0xd7b57a, 0, 0.08, 0, 4.7, 0.16, 20)
  baker.put(GEO.box, 0xc49a62, -2.32, 0.17, 0, 0.08, 0.03, 20)
  baker.put(GEO.box, 0xc49a62, 2.32, 0.17, 0, 0.08, 0.03, 20)
  for (let k = -4; k <= 4; k++) {
    if (Math.abs(k) % 2 === 0) continue
    const z = k * 2
    baker.put(GEO.box, 0xf7edd4, -0.71, 0.17, z, 0.08, 0.03, 0.85)
    baker.put(GEO.box, 0xf7edd4, 0.71, 0.17, z, 0.08, 0.03, 0.85)
  }

  const awning = AWNINGS[index % AWNINGS.length]
  const awningB = AWNINGS[(index + 3) % AWNINGS.length]
  stall(baker, -1, -5.2, awning)
  stall(baker, -1, 4.6, awningB)
  stall(baker, 1, -4.4, awningB)
  stall(baker, 1, 5.4, awning)
  palm(baker, -4.15, 0.2)
  palm(baker, 4.25, -1.4)
  if (index % 2 === 0) palm(baker, 4.4, 7)
  else palm(baker, -4.3, -8)

  baker.put(GEO.box, 0xf0c430, 3.55, 0.38, 6.5, 0.42, 0.55, 0.42)
  baker.put(GEO.box, 0xc4844a, -3.5, 0.32, -7.2, 0.55, 0.5, 0.55)

  if (index % 2 === 0) {
    baker.put(GEO.box, 0xc0392b, -2.2, 1.65, -9.2, 0.26, 3.1, 0.28)
    baker.put(GEO.box, 0xc0392b, 2.2, 1.65, -9.2, 0.26, 3.1, 0.28)
    baker.put(GEO.box, 0xc0392b, 0, 3.25, -9.2, 4.7, 0.36, 0.34)
    baker.put(GEO.box, 0xf0c430, 0, 2.98, -9.2, 4.3, 0.08, 0.38)
  } else {
    const flags = [0x008751, 0xfcd116, 0xe8112d]
    for (let k = 0; k < 9; k++) {
      baker.put(GEO.box, flags[k % 3], -2 + k * 0.5, 3.02, 0.4, 0.22, 0.28, 0.04)
    }
    baker.put(GEO.box, 0x6b4228, 0, 3.2, 0.4, 4.6, 0.04, 0.04)
  }

  group.add(baker.mesh(vcMat))
  const [text, bg, fg] = SIGNS[index % SIGNS.length]
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.46), labelMaterial(text, bg, fg))
  sign.position.set(-3.15, 2.05, -5.2)
  sign.rotation.y = 0.5
  const [textB, bgB, fgB] = SIGNS[(index + 3) % SIGNS.length]
  const signB = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.46), labelMaterial(textB, bgB, fgB))
  signB.position.set(3.2, 2.05, 5.4)
  signB.rotation.y = -0.5
  group.add(sign, signB)
  return group
}

function stall(baker: Baker, side: number, z: number, awning: number): void {
  const x = side * 3.15
  baker.put(GEO.box, 0xa56b3c, x, 0.5, z, 1.2, 0.72, 1.05)
  baker.put(GEO.box, awning, x, 1.28, z, 1.5, 0.08, 1.3)
  baker.put(GEO.cone, awning, x, 1.62, z, 0.72, 0.48, 0.72)
  const fruits = [0xff8c32, 0xe23b32, 0xf0c430, 0x3cb364, 0xff6b8a]
  for (let i = 0; i < 4; i++) {
    baker.put(GEO.sphereLow, fruits[(i + Math.abs(z | 0)) % fruits.length], x - 0.36 + i * 0.22, 0.98, z + 0.18, 0.12, 0.12, 0.12)
  }
  baker.put(GEO.cyl, 0x3c4d96, x, 0.98, z - 0.28, 0.09, 0.36, 0.09, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0xf0c430, x, 1.06, z - 0.28, 0.08, 0.28, 0.08, 0, 0, Math.PI / 2)
  baker.put(GEO.box, awning, x + side * 0.55, 1.05, z, 0.08, 1.15, 1.15)
}

function palm(baker: Baker, x: number, z: number): void {
  baker.put(GEO.cyl, 0x8a5a32, x, 1.15, z, 0.1, 2.2, 0.1)
  baker.put(GEO.sphereLow, 0x2f8f4e, x, 2.35, z, 0.55, 0.32, 0.5)
  baker.put(GEO.sphereLow, 0x3cb364, x + 0.38, 2.15, z + 0.05, 0.36, 0.22, 0.32)
  baker.put(GEO.sphereLow, 0x257a3e, x - 0.34, 2.2, z, 0.34, 0.22, 0.3)
  baker.put(GEO.sphereLow, 0x49a85a, x, 2.1, z - 0.32, 0.28, 0.18, 0.28)
  baker.put(GEO.sphereLow, 0x6b3e23, x + 0.05, 2.02, z, 0.07, 0.08, 0.07)
}

export function makeCrate(): THREE.Mesh {
  const baker = new Baker()
  baker.put(GEO.box, 0xc4844a, 0, 0.46, 0, 1.02, 0.9, 1.02)
  baker.put(GEO.box, 0x14988f, 0, 0.55, 0.52, 0.32, 0.32, 0.04, 0, 0, Math.PI / 4)
  baker.put(GEO.box, 0xf0c430, -0.28, 0.28, 0.52, 0.16, 0.16, 0.04)
  baker.put(GEO.box, 0xe23b32, 0.26, 0.72, 0.52, 0.16, 0.16, 0.04)
  baker.put(GEO.box, 0x3c4d96, 0, 0.92, 0, 0.36, 0.04, 0.36, 0, Math.PI / 4, 0)
  baker.put(GEO.box, 0xf0c430, 0.52, 0.46, 0, 0.04, 0.14, 0.7)
  return baker.mesh(vcMat)
}

export function makeBarrel(): THREE.Mesh {
  const baker = new Baker()
  baker.put(GEO.cyl, 0xf0c430, 0, 0.4, 0, 0.34, 0.76, 0.34)
  baker.put(GEO.cyl, 0xc0392b, 0, 0.55, 0, 0.37, 0.1, 0.37)
  baker.put(GEO.cyl, 0xf7edd4, 0, 0.8, 0, 0.28, 0.06, 0.28)
  return baker.mesh(vcMat)
}

export function makeTaxi(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0xf0c430, 0, 0.62, 0, 1.12, 0.52, 1.85)
  baker.put(GEO.box, 0x1f8a4c, 0, 0.4, 0, 1.16, 0.16, 1.88)
  baker.put(GEO.box, 0x178a45, 0, 1.05, -0.08, 1.0, 0.4, 1.0)
  baker.put(GEO.box, 0x9ad7ef, 0, 1.08, 0.48, 0.7, 0.26, 0.05)
  baker.put(GEO.sphereLow, 0xe8112d, -0.38, 0.55, 0.94, 0.09, 0.07, 0.05)
  baker.put(GEO.sphereLow, 0xe8112d, 0.38, 0.55, 0.94, 0.09, 0.07, 0.05)
  for (const [x, z] of [
    [-0.52, 0.55],
    [0.52, 0.55],
    [-0.52, -0.55],
    [0.52, -0.55],
  ] as const) {
    baker.put(GEO.cyl, 0x222222, x, 0.26, z, 0.16, 0.1, 0.16, 0, 0, Math.PI / 2)
  }
  for (let i = 0; i < 6; i++) {
    baker.put(GEO.box, i % 2 ? 0x111111 : 0xf4f4f4, 0.58, 0.72, -0.7 + i * 0.28, 0.03, 0.1, 0.14)
  }
  group.add(baker.mesh(vcMat))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), labelMaterial('TAXI', '#f0c430', '#173024'))
  sign.position.set(0, 1.42, 0.1)
  group.add(sign)
  return group
}

export function makeKeke(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0x1f8a4c, 0, 0.78, 0.05, 0.95, 0.62, 1.25)
  baker.put(GEO.box, 0xf0c430, 0, 0.52, 0, 1.02, 0.1, 1.35)
  baker.put(GEO.box, 0x14988f, 0, 1.16, 0.05, 1.0, 0.08, 1.1)
  baker.put(GEO.box, 0xf0c430, 0, 1.5, 0.05, 0.08, 0.62, 0.08)
  baker.put(GEO.box, 0x1f8a4c, 0, 1.78, 0.05, 0.95, 0.08, 0.85)
  baker.put(GEO.box, 0x9ad7ef, 0, 0.9, 0.68, 0.62, 0.28, 0.04)
  baker.put(GEO.cyl, 0x222222, 0, 0.26, -0.72, 0.2, 0.1, 0.2, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0x222222, -0.4, 0.26, 0.42, 0.18, 0.1, 0.18, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0x222222, 0.4, 0.26, 0.42, 0.18, 0.1, 0.18, 0, 0, Math.PI / 2)
  group.add(baker.mesh(vcMat))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.2), labelMaterial('INSPECTEUR', '#f0c430', '#173024'))
  sign.position.set(0, 1.05, 0.66)
  group.add(sign)
  return group
}

export function makeBanner(text: string, wide: boolean): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  const half = wide ? 2.15 : 0.62
  baker.put(GEO.cyl, 0x6b3e23, -half, 1.25, 0, 0.045, 2.5, 0.045)
  baker.put(GEO.cyl, 0x6b3e23, half, 1.25, 0, 0.045, 2.5, 0.045)
  group.add(baker.mesh(vcMat))
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(wide ? 4.15 : 1.15, 0.62),
    labelMaterial(text, '#fff6e8', '#9a3412'),
  )
  cloth.position.set(0, 1.58, 0)
  group.add(cloth)
  return group
}

export function makeCoin(): THREE.Mesh {
  const baker = new Baker()
  baker.put(GEO.sphereLow, 0xf5c542, 0, 0, 0, 0.26, 0.16, 0.2)
  baker.put(GEO.sphereLow, 0xfff6d0, 0, 0, 0.06, 0.14, 0.08, 0.1)
  baker.put(GEO.box, 0xfff3c4, 0, 0, 0.1, 0.04, 0.1, 0.02)
  const mesh = baker.mesh(basicVC)
  return mesh
}

export function makeMagnet(): THREE.Group {
  const group = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.07, 8, 18),
    new THREE.MeshBasicMaterial({ color: 0x2ee0d0 }),
  )
  group.add(ring)
  const coin = makeCoin()
  coin.scale.setScalar(0.85)
  group.add(coin)
  return group
}

export function makeMult(): THREE.Group {
  const group = new THREE.Group()
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshBasicMaterial({ color: 0xf5c542 }))
  group.add(gem)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.045, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6b4a }),
  )
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  return group
}

export function makeCloud(): THREE.Mesh {
  const baker = new Baker()
  baker.put(GEO.sphereLow, 0xffffff, 0, 0, 0, 1.1, 0.5, 0.7)
  baker.put(GEO.sphereLow, 0xfffaf2, 0.8, -0.05, 0.05, 0.7, 0.42, 0.5)
  baker.put(GEO.sphereLow, 0xffffff, -0.75, -0.06, 0, 0.55, 0.36, 0.48)
  return baker.mesh(basicVC)
}

export function makeSun(): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a }))
}
