import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BoardId } from './boards'
import { SPONSORS, stallSponsor, sponsorHex, sponsorMaterial } from './sponsors'
import { labelMaterial } from './textures'
import type { ZoneId } from './zones'

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLow: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 9),
  torus: new THREE.TorusGeometry(1, 0.28, 6, 12),
}

const vcMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 14, specular: 0x3a2a16 })
const basicVC = new THREE.MeshBasicMaterial({ vertexColors: true })

const colorMats = new Map<string, THREE.MeshPhongMaterial>()

function lambert(hex: number, flat = true): THREE.MeshPhongMaterial {
  const key = `${hex}:${flat ? 1 : 0}`
  let material = colorMats.get(key)
  if (!material) {
    material = new THREE.MeshPhongMaterial({
      color: hex,
      flatShading: flat,
      shininess: 22,
      specular: 0x4a3820,
    })
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
  afro: THREE.Object3D
}

export interface CopParts {
  root: THREE.Group
  wheels: THREE.Mesh[]
}

export function makeRunner(): RunnerParts {
  const root = new THREE.Group()
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 14),
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
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), shieldMat)
  shield.position.y = 0.98
  shield.visible = false
  root.add(shield)

  const bob = new THREE.Group()
  root.add(bob)

  const skin = 0x6d3b24
  const { hip: legL, knee: kneeL } = makeLeg(-0.14, 0xf4efe4)
  const { hip: legR, knee: kneeR } = makeLeg(0.14, 0xf4efe4)
  bob.add(legL, legR)

  const shorts = box(0.5, 0.3, 0.32, 0x6b4228)
  shorts.position.y = 0.96
  const shortHem = box(0.52, 0.06, 0.33, 0x4e2f1c)
  shortHem.position.y = 0.84
  const sideL = box(0.07, 0.26, 0.3, 0x5a3820)
  sideL.position.set(-0.24, 0.96, 0)
  const sideR = box(0.07, 0.26, 0.3, 0x5a3820)
  sideR.position.set(0.24, 0.96, 0)
  bob.add(shorts, shortHem, sideL, sideR)

  const mid = box(0.34, 0.12, 0.22, skin, false)
  mid.position.y = 1.14
  bob.add(mid)

  const brand = SPONSORS.board
  const top = box(0.5, 0.34, 0.3, sponsorHex(brand.color))
  top.position.y = 1.36
  const hem = box(0.52, 0.07, 0.32, 0xf0c430)
  hem.position.y = 1.21
  bob.add(top, hem)
  const kit = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.22), sponsorMaterial(brand))
  kit.position.set(0.02, 1.48, 0.22)
  kit.renderOrder = 4
  bob.add(kit)
  const motifs: Array<[number, number, number, number]> = [
    [-0.12, 1.4, 0.16, 0xf0c430],
    [0.12, 1.38, 0.16, 0xff6b57],
    [0, 1.48, 0.16, 0x3c4d96],
    [-0.12, 1.4, -0.16, 0xf0c430],
    [0.12, 1.38, -0.16, 0xff6b57],
  ]
  for (const [x, y, z, color] of motifs) {
    const patch = box(0.11, 0.11, 0.035, color)
    patch.position.set(x, y, z)
    patch.rotation.z = Math.PI / 4
    bob.add(patch)
  }

  const bag = box(0.3, 0.34, 0.14, 0x6b3e23)
  bag.position.set(0.02, 1.22, 0.24)
  const flap = box(0.28, 0.1, 0.06, 0x8d5a34)
  flap.position.set(0.02, 1.38, 0.28)
  const buckle = box(0.08, 0.06, 0.04, 0xf0c430)
  buckle.position.set(0.02, 1.34, 0.32)
  const strap = box(0.05, 0.62, 0.05, 0x4e2f1c)
  strap.position.set(-0.16, 1.4, 0.1)
  strap.rotation.z = -0.55
  strap.rotation.x = 0.45
  const strapB = box(0.05, 0.36, 0.05, 0x4e2f1c)
  strapB.position.set(0.16, 1.42, 0.16)
  strapB.rotation.z = 0.35
  strapB.rotation.x = 0.3
  bob.add(bag, flap, buckle, strap, strapB)

  const armL = makeArm(-0.34)
  const armR = makeArm(0.34)
  bob.add(armL, armR)

  const head = new THREE.Group()
  head.position.y = 1.64
  const skull = sphere(0.11, 0.115, 0.11, skin, false)
  const afro = new THREE.Group()
  const curls: Array<[number, number, number, number]> = [
    [0, 0.08, 0.02, 0.09],
    [0.07, 0.06, 0.05, 0.075],
    [-0.07, 0.06, 0.05, 0.075],
    [0.07, 0.05, -0.04, 0.07],
    [-0.07, 0.05, -0.04, 0.07],
    [0, 0.04, 0.1, 0.08],
    [0.06, 0.02, 0.09, 0.065],
    [-0.06, 0.02, 0.09, 0.065],
    [0, 0.07, -0.05, 0.07],
    [0.05, 0.08, 0, 0.06],
    [-0.05, 0.08, 0, 0.06],
  ]
  for (const [x, y, z, r] of curls) {
    const curl = sphere(r, r * 0.85, r, 0x1a120e, false)
    curl.position.set(x, y, z)
    afro.add(curl)
  }
  head.add(skull, afro)

  for (const side of [-1, 1]) {
    const hoop = new THREE.Mesh(GEO.torus, lambert(0xf0c430, true))
    hoop.scale.setScalar(0.045)
    hoop.position.set(side * 0.115, -0.02, 0.01)
    hoop.rotation.y = Math.PI / 2
    head.add(hoop)
    const eye = sphere(0.03, 0.032, 0.024, 0xfffaf3, false)
    eye.position.set(side * 0.04, 0.015, -0.1)
    const pupil = sphere(0.014, 0.016, 0.012, 0x1a120e, false)
    pupil.position.set(side * 0.04, 0.01, -0.12)
    head.add(eye, pupil)
  }
  bob.add(head)

  return { root, bob, shadow, legL, legR, kneeL, kneeR, armL, armR, boards, shield, afro }
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
  const sole = box(0.17, 0.04, 0.3, 0x3a2a1c)
  sole.position.set(0, -0.38, 0.04)
  const stripe = box(0.17, 0.04, 0.08, 0x14988f)
  stripe.position.set(0, -0.3, 0.12)
  const lace = box(0.06, 0.03, 0.1, 0xf0c430)
  lace.position.set(0, -0.26, -0.02)
  knee.add(shin, shoe, sole, stripe, lace)
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

function boardBrand(group: THREE.Group): void {
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.18), sponsorMaterial(SPONSORS.board))
  plate.rotation.x = -Math.PI / 2
  plate.position.set(0, 0.21, 0.12)
  plate.renderOrder = 4
  group.add(plate)
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
  boardBrand(group)
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
  boardBrand(group)
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
  boardBrand(group)
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
  boardBrand(group)
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
  const torso = box(0.6, 0.52, 0.4, khaki)
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

const SIGNS: Record<ZoneId, Array<[string, string, string]>> = {
  marche: [
    ['DANTOKPA', '#c4784a', '#fff6e8'],
    ['TISSUS', '#ff6b4a', '#fff6e8'],
    ['AGON', '#3c4d96', '#fff6e8'],
  ],
  lagune: [
    ['GANVIÉ', '#0f766e', '#fff6e8'],
    ['PIROGUES', '#1d6fa8', '#fff6e8'],
  ],
  porto: [
    ['PORTO-NOVO', '#173024', '#f0c430'],
    ['PALAIS', '#7c2d12', '#fff6e8'],
  ],
  plage: [
    ['FIDJROSSE', '#1d4e89', '#fff6e8'],
    ['PLAGE', '#0f766e', '#fff6e8'],
  ],
}

const AWNINGS = [0xff6b4a, 0x14b8a6, 0xf0c430, 0x3c4d96, 0xe23b32, 0x1f8a4c]

export function makeSegment(zone: ZoneId, variant = 0): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  if (zone === 'lagune') buildLagune(baker, variant)
  else if (zone === 'porto') buildPorto(baker, variant)
  else if (zone === 'plage') buildPlage(baker, variant)
  else buildMarche(baker, variant)
  group.add(baker.mesh(vcMat))
  const signs = SIGNS[zone]
  const [text, bg, fg] = signs[variant % signs.length]
  const [textB, bgB, fgB] = signs[(variant + 1) % signs.length]
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.46), labelMaterial(text, bg, fg))
  sign.position.set(zone === 'plage' ? -3.2 : -3.15, 2.15, -5.2)
  sign.rotation.y = 0.5
  const signB = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.46), labelMaterial(textB, bgB, fgB))
  signB.position.set(3.2, 2.15, 5.2)
  signB.rotation.y = -0.5
  group.add(sign, signB)
  if (zone === 'marche') addStallSigns(group)
  return group
}

function addStallSigns(group: THREE.Group): void {
  const places: Array<[number, number, number]> = [
    [-1, -5.2, 1],
    [-1, 4.8, 0],
    [1, -4.2, 3],
    [1, 5.4, 2],
  ]
  for (const [side, z, index] of places) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.48), sponsorMaterial(stallSponsor(index)))
    sign.position.set(side * 3.15, 1.72, z + 0.58)
    sign.renderOrder = 3
    group.add(sign)
  }
}

function roadMarks(baker: Baker, color = 0xf8f4ea): void {
  for (let k = -5; k <= 5; k++) {
    const z = k * 1.85
    if (k % 2 === 0) continue
    baker.put(GEO.box, color, -0.71, 0.185, z, 0.09, 0.035, 0.95)
    baker.put(GEO.box, color, 0.71, 0.185, z, 0.09, 0.035, 0.95)
  }
}

function roadCurb(baker: Baker): void {
  baker.put(GEO.box, 0xd4c4a4, -2.38, 0.2, 0, 0.14, 0.1, 20)
  baker.put(GEO.box, 0xd4c4a4, 2.38, 0.2, 0, 0.14, 0.1, 20)
  baker.put(GEO.box, 0xf6f1e4, -2.22, 0.188, 0, 0.07, 0.025, 20)
  baker.put(GEO.box, 0xf6f1e4, 2.22, 0.188, 0, 0.07, 0.025, 20)
}

function bunting(baker: Baker, z = 0.4): void {
  const flags = [0x008751, 0xfcd116, 0xe8112d]
  for (let k = 0; k < 9; k++) baker.put(GEO.box, flags[k % 3], -2 + k * 0.5, 4.45, z, 0.22, 0.36, 0.04)
  baker.put(GEO.box, 0x6b4228, 0, 4.66, z, 4.6, 0.05, 0.04)
}

function arch(baker: Baker, z = -9.2): void {
  baker.put(GEO.box, 0xc0392b, -2.2, 2.15, z, 0.26, 4.1, 0.28)
  baker.put(GEO.box, 0xc0392b, 2.2, 2.15, z, 0.26, 4.1, 0.28)
  baker.put(GEO.box, 0xc0392b, 0, 4.25, z, 4.7, 0.36, 0.34)
  baker.put(GEO.box, 0xf0c430, 0, 3.98, z, 4.3, 0.08, 0.38)
}

function buildMarche(baker: Baker, variant: number): void {
  baker.put(GEO.box, 0xe8d5a6, 0.4, -0.08, 0, 16, 0.12, 20)
  baker.put(GEO.box, 0x2a86b8, -6.4, 0.02, 0, 4.4, 0.1, 20)
  baker.put(GEO.box, 0x49b4d6, -6.6, 0.09, 0, 2.2, 0.04, 20)
  baker.put(GEO.box, 0x7d6c55, 0, 0.08, 0, 4.8, 0.16, 20)
  baker.put(GEO.box, 0x8b7a62, 0, 0.155, 0, 4.55, 0.02, 20)
  roadCurb(baker)
  roadMarks(baker)
  const a = AWNINGS[variant % AWNINGS.length]
  const b = AWNINGS[(variant + 3) % AWNINGS.length]
  stall(baker, -1, -5.2, a)
  stall(baker, -1, 4.8, b)
  stall(baker, 1, -4.2, b)
  stall(baker, 1, 5.4, a)
  fabrics(baker, -3.15, -5.2)
  fabrics(baker, 3.15, 5.4)
  palm(baker, -4.15, 0.2)
  palm(baker, 4.25, -1.4)
  if (variant % 2 === 0) {
    arch(baker)
    palm(baker, 4.4, 7)
  } else {
    bunting(baker)
    palm(baker, -4.3, -8)
  }
  baker.put(GEO.box, 0xf0c430, 3.55, 0.38, 6.5, 0.42, 0.55, 0.42)
  baker.put(GEO.box, 0xc4844a, -3.5, 0.32, -7.2, 0.55, 0.5, 0.55)
}

function buildLagune(baker: Baker, variant: number): void {
  baker.put(GEO.box, 0x1a6f99, 0, -0.12, 0, 18, 0.16, 20)
  baker.put(GEO.box, 0x49b4d6, 2.4, -0.02, 0, 6, 0.04, 20)
  baker.put(GEO.box, 0x8d5a32, 0, 0.1, 0, 4.5, 0.16, 20)
  baker.put(GEO.box, 0xa56b3c, 0, 0.175, 0, 4.4, 0.02, 20)
  for (let k = -4; k <= 4; k++) baker.put(GEO.box, 0x6b4228, 0, 0.19, k * 2.1, 4.4, 0.03, 0.18)
  roadMarks(baker, 0xf7ead0)
  stiltHouse(baker, -3.7, -6, variant % 2 ? 0x14988f : 0xc4784a)
  stiltHouse(baker, 3.75, -2, 0xf0c430)
  stiltHouse(baker, -3.6, 5, 0xff6b4a)
  pirogue(baker, 3.5, 4.5, 0x1d6fa8)
  pirogue(baker, -3.45, 1.2, 0x8d5a32)
  if (variant % 2 === 0) {
    stiltHouse(baker, 3.8, 7.2, 0x3c4d96)
    bunting(baker, -8)
  } else {
    pirogue(baker, 3.4, -7, 0xc4784a)
    palm(baker, -4.4, -8)
  }
  reed(baker, -2.55, 3)
  reed(baker, 2.55, -4)
}

function buildPorto(baker: Baker, variant: number): void {
  baker.put(GEO.box, 0xe8d6b4, 0, -0.06, 0, 16, 0.1, 20)
  baker.put(GEO.box, 0x7a6b56, 0, 0.08, 0, 4.7, 0.16, 20)
  baker.put(GEO.box, 0x887866, 0, 0.155, 0, 4.5, 0.02, 20)
  roadCurb(baker)
  roadMarks(baker, 0xf8f4ea)
  facade(baker, -3.7, -5.5, 0xf4efe4, 0xc4784a)
  facade(baker, 3.7, 2.5, 0xf7f1e3, 0x1f8a4c)
  palm(baker, -4.6, 6)
  palm(baker, 4.6, -6)
  if (variant % 2 === 0) {
    minaret(baker, 4.35, -2)
    bunting(baker, 8)
  } else {
    palace(baker, -3.8, 4)
    arch(baker, -9)
  }
}

function buildPlage(baker: Baker, variant: number): void {
  baker.put(GEO.box, 0xf0ddb4, 0, -0.08, 0, 16, 0.12, 20)
  baker.put(GEO.box, 0x1f7eb8, 6.2, -0.02, 0, 6.2, 0.12, 20)
  baker.put(GEO.box, 0xf7fbff, 4.2, 0.06, 0, 0.35, 0.04, 20)
  baker.put(GEO.box, 0x8a7a62, 0, 0.08, 0, 4.6, 0.14, 20)
  baker.put(GEO.box, 0x96866e, 0, 0.15, 0, 4.4, 0.02, 20)
  roadCurb(baker)
  roadMarks(baker, 0xfffaf0)
  umbrella(baker, -3.3, -5, 0xff6b4a)
  umbrella(baker, -3.5, 2, 0xf0c430)
  umbrella(baker, -3.2, 6.5, 0x14988f)
  palm(baker, -4.5, -1)
  palm(baker, 3.6, 5)
  beachHut(baker, 3.4, -4, variant % 2 ? 0x1d6fa8 : 0xc4784a)
  if (variant % 2 === 0) bunting(baker, -8)
  else baker.put(GEO.box, 0xf7fbff, 5.1, 0.08, 3, 1.2, 0.03, 3)
}

function fabrics(baker: Baker, x: number, z: number): void {
  baker.put(GEO.box, 0xff6b4a, x, 1.52, z + 0.45, 0.08, 0.7, 0.38)
  baker.put(GEO.box, 0x3c4d96, x, 1.48, z - 0.18, 0.08, 0.62, 0.3)
  baker.put(GEO.box, 0xf0c430, x, 1.46, z + 0.12, 0.06, 0.52, 0.24)
  baker.put(GEO.box, 0x14988f, x, 1.4, z + 0.3, 0.06, 0.42, 0.2)
  baker.put(GEO.box, 0xe23b32, x + 0.06, 1.36, z - 0.02, 0.05, 0.36, 0.18)
}

function stiltHouse(baker: Baker, x: number, z: number, color: number): void {
  for (const [dx, dz] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]] as const) {
    baker.put(GEO.cyl, 0x6b4228, x + dx, 0.55, z + dz, 0.05, 1.1, 0.05)
  }
  baker.put(GEO.box, color, x, 1.35, z, 1.15, 0.7, 0.95)
  baker.put(GEO.cone, 0xc4784a, x, 1.95, z, 0.75, 0.45, 0.7)
  baker.put(GEO.box, 0x173024, x, 1.35, z + 0.48, 0.28, 0.32, 0.04)
}

function pirogue(baker: Baker, x: number, z: number, color: number): void {
  baker.put(GEO.sphereLow, color, x, 0.22, z, 0.28, 0.1, 0.85)
  baker.put(GEO.box, 0xf7fbff, x, 0.3, z, 0.12, 0.03, 0.5)
}

function reed(baker: Baker, x: number, z: number): void {
  baker.put(GEO.cyl, 0x2f8f4e, x, 0.45, z, 0.03, 0.7, 0.03)
  baker.put(GEO.cyl, 0x3cb364, x + 0.12, 0.38, z + 0.1, 0.025, 0.55, 0.025)
}

function facade(baker: Baker, x: number, z: number, wall: number, shutter: number): void {
  baker.put(GEO.box, wall, x, 1.55, z, 1.35, 2.5, 1.5)
  baker.put(GEO.box, 0xc4784a, x, 2.9, z, 1.5, 0.22, 1.65)
  for (const wz of [-0.35, 0.35]) {
    baker.put(GEO.box, 0x173024, x, 1.9, z + wz, 0.08, 0.42, 0.28)
    baker.put(GEO.box, shutter, x - Math.sign(x) * 0.08, 1.9, z + wz, 0.06, 0.46, 0.1)
  }
  baker.put(GEO.box, 0x7c2d12, x, 0.7, z + 0.4, 0.1, 0.7, 0.32)
}

function minaret(baker: Baker, x: number, z: number): void {
  baker.put(GEO.box, 0xf7f1e3, x, 2.3, z, 0.55, 4.2, 0.55)
  baker.put(GEO.cone, 0x1f8a4c, x, 4.55, z, 0.38, 0.7, 0.38)
  baker.put(GEO.box, 0xf0c430, x, 3.6, z, 0.7, 0.08, 0.7)
}

function palace(baker: Baker, x: number, z: number): void {
  baker.put(GEO.box, 0xf3e6c8, x, 1.4, z, 1.8, 2.2, 1.4)
  baker.put(GEO.box, 0xc4784a, x, 2.6, z, 2, 0.18, 1.55)
  for (const dz of [-0.45, 0, 0.45]) baker.put(GEO.cyl, 0xf7f1e3, x + 0.7, 1.15, z + dz, 0.08, 1.8, 0.08)
  baker.put(GEO.box, 0x14988f, x, 0.85, z, 0.12, 0.9, 0.4)
}

function umbrella(baker: Baker, x: number, z: number, color: number): void {
  baker.put(GEO.cyl, 0xf7f1e3, x, 0.75, z, 0.035, 1.45, 0.035)
  baker.put(GEO.cone, color, x, 1.52, z, 0.7, 0.32, 0.7)
  baker.put(GEO.cone, 0xfff6e8, x, 1.48, z, 0.22, 0.1, 0.22)
}

function beachHut(baker: Baker, x: number, z: number, color: number): void {
  baker.put(GEO.box, 0xc4a574, x, 0.7, z, 1.2, 0.9, 1)
  baker.put(GEO.cone, color, x, 1.35, z, 0.8, 0.4, 0.75)
}

function stall(baker: Baker, side: number, z: number, awning: number): void {
  const x = side * 3.15
  for (const [dx, dz] of [[-0.5, -0.46], [0.5, -0.46], [-0.5, 0.46], [0.5, 0.46]] as const) {
    baker.put(GEO.cyl, 0x6b4228, x + dx, 0.95, z + dz, 0.04, 1.55, 0.04)
  }
  baker.put(GEO.box, 0x8a5330, x, 0.48, z, 1.22, 0.7, 1.08)
  baker.put(GEO.box, 0xc4894a, x, 0.86, z, 1.28, 0.07, 1.14)
  baker.put(GEO.box, awning, x, 1.34, z, 1.62, 0.07, 1.38)
  baker.put(GEO.cone, awning, x, 1.7, z, 0.78, 0.5, 0.78)
  baker.put(GEO.box, 0x5a3218, x, 1.38, z, 1.62, 0.03, 0.08)
  baker.put(GEO.box, awning, x, 0.42, z + 0.54, 1.18, 0.46, 0.05)
  const fruits = [0xff8c32, 0xe23b32, 0xf0c430, 0x3cb364, 0xff6b8a, 0xfff6e8]
  for (let i = 0; i < 6; i++) {
    const fx = x - 0.42 + (i % 3) * 0.22
    const fz = z + 0.22 - Math.floor(i / 3) * 0.22
    baker.put(GEO.sphereLow, fruits[(i + Math.abs(z | 0)) % fruits.length], fx, 0.98, fz, 0.1, 0.1, 0.1)
  }
  baker.put(GEO.cyl, 0x8d5a32, x + 0.32, 0.98, z + 0.12, 0.16, 0.18, 0.16)
  baker.put(GEO.sphereLow, 0xff8c32, x + 0.32, 1.08, z + 0.12, 0.1, 0.08, 0.1)
  baker.put(GEO.cyl, 0x3c4d96, x - 0.1, 1.0, z - 0.28, 0.09, 0.36, 0.09, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0xf0c430, x - 0.1, 1.08, z - 0.28, 0.08, 0.28, 0.08, 0, 0, Math.PI / 2)
  baker.put(GEO.box, 0x7a4a28, x - 0.34, 0.36, z - 0.15, 0.28, 0.28, 0.28)
  baker.put(GEO.box, awning, x + side * 0.62, 1.12, z, 0.08, 1.28, 1.2)
}

function palm(baker: Baker, x: number, z: number): void {
  baker.put(GEO.cyl, 0x6b4228, x, 0.35, z, 0.13, 0.7, 0.16)
  baker.put(GEO.cyl, 0x8a5a32, x, 1.15, z, 0.11, 1.15, 0.12)
  baker.put(GEO.cyl, 0x9a6a3c, x, 1.95, z, 0.08, 0.7, 0.09)
  baker.put(GEO.sphereLow, 0x2f8f4e, x, 2.42, z, 0.42, 0.22, 0.42)
  const fronds: Array<[number, number, number, number, number]> = [
    [0.55, 2.22, 0.05, 0x3cb364, 0],
    [-0.5, 2.26, 0.08, 0x257a3e, 0.4],
    [0.08, 2.18, -0.52, 0x49a85a, 0.8],
    [0.12, 2.2, 0.5, 0x2f8f4e, 1.2],
    [0.4, 2.32, -0.36, 0x3cb364, 1.7],
    [-0.38, 2.3, -0.3, 0x1f6b34, 2.2],
  ]
  for (const [dx, y, dz, color] of fronds) {
    baker.put(GEO.sphereLow, color, x + dx, y, z + dz, 0.38, 0.12, 0.22)
  }
  baker.put(GEO.sphereLow, 0x6b3e23, x + 0.08, 2.12, z + 0.04, 0.07, 0.08, 0.07)
  baker.put(GEO.sphereLow, 0x5a3218, x - 0.06, 2.1, z - 0.05, 0.06, 0.07, 0.06)
}

function obstacleShadow(radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.175
  mesh.renderOrder = 1
  return mesh
}

export function makeCrate(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0x7a3b14, 0, 0.635, 0, 1.16, 0.95, 1.16)
  baker.put(GEO.box, 0xd9782c, 0, 0.635, 0, 1.04, 0.83, 1.04)
  baker.put(GEO.box, 0x3a1c0c, 0, 0.635, 0.58, 1.18, 0.08, 0.04)
  baker.put(GEO.box, 0x3a1c0c, 0, 0.635, -0.58, 1.18, 0.08, 0.04)
  baker.put(GEO.box, 0x14988f, 0, 0.72, 0.59, 0.36, 0.36, 0.05, 0, 0, Math.PI / 4)
  baker.put(GEO.box, 0xf0c430, -0.3, 0.42, 0.59, 0.2, 0.2, 0.05)
  baker.put(GEO.box, 0xe23b32, 0.3, 0.86, 0.59, 0.2, 0.2, 0.05)
  baker.put(GEO.box, 0xfff6e8, 0, 0.58, 0.59, 0.16, 0.16, 0.04, 0, 0, Math.PI / 4)
  baker.put(GEO.box, 0x14988f, 0, 0.72, -0.59, 0.36, 0.36, 0.05, 0, 0, Math.PI / 4)
  baker.put(GEO.box, 0xf0c430, 0.3, 0.42, -0.59, 0.2, 0.2, 0.05)
  baker.put(GEO.box, 0xe23b32, -0.3, 0.86, -0.59, 0.2, 0.2, 0.05)
  baker.put(GEO.box, 0xf0c430, 0.59, 0.635, 0, 0.05, 0.18, 0.8)
  baker.put(GEO.box, 0x3c4d96, 0, 1.12, 0, 0.4, 0.05, 0.4, 0, Math.PI / 4, 0)
  baker.put(GEO.box, 0xfff6e8, 0, 1.16, 0, 0.16, 0.04, 0.16)
  const body = baker.mesh(vcMat)
  body.renderOrder = 2
  group.add(obstacleShadow(0.72), body)
  return group
}

export function makeBarrel(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.cyl, 0xffd24a, 0, 0.605, 0, 0.42, 0.88, 0.42)
  baker.put(GEO.cyl, 0xc0392b, 0, 0.38, 0, 0.45, 0.1, 0.45)
  baker.put(GEO.cyl, 0xc0392b, 0, 0.82, 0, 0.45, 0.1, 0.45)
  baker.put(GEO.cyl, 0x3a1c0c, 0, 0.58, 0, 0.445, 0.05, 0.445)
  baker.put(GEO.cyl, 0xfff6e8, 0, 1.05, 0, 0.32, 0.08, 0.32)
  baker.put(GEO.box, 0x173024, 0, 0.7, 0.43, 0.12, 0.2, 0.04)
  const body = baker.mesh(vcMat)
  body.renderOrder = 2
  group.add(obstacleShadow(0.5), body)
  return group
}

export function makeTaxi(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0xffd24a, 0, 0.74, 0, 1.2, 0.52, 1.95)
  baker.put(GEO.box, 0x146c38, 0, 0.5, 0, 1.24, 0.16, 1.98)
  baker.put(GEO.box, 0x178a45, 0, 1.17, -0.08, 1.06, 0.42, 1.05)
  baker.put(GEO.box, 0x9ad7ef, 0, 1.2, 0.52, 0.76, 0.28, 0.05)
  baker.put(GEO.box, 0x173024, 0, 0.74, 0, 1.22, 0.06, 2.0)
  baker.put(GEO.sphereLow, 0xe8112d, -0.4, 0.67, 1.0, 0.1, 0.08, 0.06)
  baker.put(GEO.sphereLow, 0xe8112d, 0.4, 0.67, 1.0, 0.1, 0.08, 0.06)
  baker.put(GEO.sphereLow, 0xfff6e8, -0.4, 0.67, -1.0, 0.08, 0.07, 0.05)
  baker.put(GEO.sphereLow, 0xfff6e8, 0.4, 0.67, -1.0, 0.08, 0.07, 0.05)
  for (const [x, z] of [
    [-0.54, 0.58],
    [0.54, 0.58],
    [-0.54, -0.58],
    [0.54, -0.58],
  ] as const) {
    baker.put(GEO.cyl, 0x1a1a1a, x, 0.34, z, 0.18, 0.12, 0.18, 0, 0, Math.PI / 2)
  }
  for (let i = 0; i < 6; i++) {
    baker.put(GEO.box, i % 2 ? 0x111111 : 0xf4f4f4, 0.62, 0.84, -0.72 + i * 0.28, 0.04, 0.12, 0.16)
  }
  const body = baker.mesh(vcMat)
  body.renderOrder = 2
  group.add(obstacleShadow(1.05), body)
  const livery = SPONSORS.taxi
  const roof = box(1.06, 0.1, 1.08, sponsorHex(livery.color))
  roof.position.set(0, 1.4, -0.08)
  group.add(roof)
  for (const side of [-1, 1] as const) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.36), sponsorMaterial(livery))
    door.position.set(side * 0.63, 0.8, 0.06)
    door.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
    door.renderOrder = 4
    group.add(door)
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.28), sponsorMaterial(livery))
  sign.position.set(0, 1.56, 0.16)
  sign.renderOrder = 3
  group.add(sign)
  return group
}

export function makeKeke(): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  baker.put(GEO.box, 0x146c38, 0, 0.9, 0.05, 1.05, 0.66, 1.35)
  baker.put(GEO.box, 0xffd24a, 0, 0.62, 0, 1.12, 0.12, 1.45)
  baker.put(GEO.box, 0x14988f, 0, 1.28, 0.05, 1.08, 0.1, 1.2)
  baker.put(GEO.box, 0xffd24a, 0, 1.62, 0.05, 0.1, 0.66, 0.1)
  baker.put(GEO.box, 0x146c38, 0, 1.92, 0.05, 1.05, 0.1, 0.92)
  baker.put(GEO.box, 0x9ad7ef, 0, 1.02, 0.74, 0.7, 0.32, 0.05)
  baker.put(GEO.cyl, 0x1a1a1a, 0, 0.34, -0.76, 0.22, 0.12, 0.22, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0x1a1a1a, -0.44, 0.34, 0.46, 0.2, 0.12, 0.2, 0, 0, Math.PI / 2)
  baker.put(GEO.cyl, 0x1a1a1a, 0.44, 0.34, 0.46, 0.2, 0.12, 0.2, 0, 0, Math.PI / 2)
  const body = baker.mesh(vcMat)
  body.renderOrder = 2
  group.add(obstacleShadow(0.82), body)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.24), labelMaterial('INSPECTEUR', '#173024', '#f0c430'))
  sign.position.set(0, 1.18, 0.74)
  sign.renderOrder = 3
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
    new THREE.PlaneGeometry(wide ? 4.3 : 1.28, 0.72),
    labelMaterial(text, '#9a3412', '#fff6e8'),
  )
  cloth.position.set(0, 1.62, 0)
  cloth.renderOrder = 3
  cloth.name = wide ? 'cloth-wide' : 'cloth'
  group.add(cloth)
  return group
}

export function makeZoneBanner(wide: boolean): THREE.Group {
  const group = new THREE.Group()
  const baker = new Baker()
  const half = wide ? 2.15 : 0.62
  baker.put(GEO.cyl, 0x6b3e23, -half, 1.25, 0, 0.045, 2.5, 0.045)
  baker.put(GEO.cyl, 0x6b3e23, half, 1.25, 0, 0.045, 2.5, 0.045)
  group.add(baker.mesh(vcMat))
  if (wide) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.78), sponsorMaterial(SPONSORS.banner))
    cloth.position.set(0, 1.62, 0)
    cloth.name = 'cloth-wide'
    cloth.renderOrder = 3
    group.add(cloth)
  } else {
    const labels: Array<[string, string, string, string]> = [
      ['TISSUS', '#fff6e8', '#9a3412', 'marche'],
      ['FILET', '#e7f6f4', '#0f766e', 'lagune'],
      ['PALAIS', '#fff8ef', '#7c2d12', 'porto'],
      ['PLAGE', '#fff6e8', '#1d4e89', 'plage'],
    ]
    for (const [text, bg, fg, zone] of labels) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.62), labelMaterial(text, bg, fg))
      cloth.position.set(0, 1.58, 0)
      cloth.name = `cloth-${zone}`
      cloth.visible = zone === 'marche'
      cloth.renderOrder = 3
      group.add(cloth)
    }
  }
  return group
}

export function makeSky(): { mesh: THREE.Mesh; paint: (top: string, mid: string, horizon: string) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(78, 18, 12), material)
  const paint = (top: string, mid: string, horizon: string) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, top)
    gradient.addColorStop(0.38, mid)
    gradient.addColorStop(0.72, horizon)
    gradient.addColorStop(1, '#f6c07a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 4, 256)
    texture.needsUpdate = true
  }
  paint('#6ec4ee', '#ffd7ae', '#f3b56a')
  return { mesh, paint }
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

export function makeSun(): THREE.Group {
  const group = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false }),
  )
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffc16a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      fog: false,
    }),
  )
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(4.4, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      fog: false,
    }),
  )
  group.add(halo, glow, core)
  return group
}

export function tagShadows(root: THREE.Object3D, cast = true, receive = true): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as THREE.Material
    if (material.transparent && 'opacity' in material && (material as THREE.MeshBasicMaterial).opacity < 0.5) {
      mesh.castShadow = false
      mesh.receiveShadow = false
      return
    }
    mesh.castShadow = cast
    mesh.receiveShadow = receive
  })
}
