import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const OUT = '/tmp/nokoue-shots'
const URL = 'http://127.0.0.1:47321/?debug=1'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const logs = []
page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`))
page.on('pageerror', (err) => logs.push(`pageerror: ${err.message}`))

await mkdir(OUT, { recursive: true })
await page.goto(URL, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__nokoue && window.__nokoue.state)
await page.waitForFunction(() => document.fonts.ready.then(() => true))
await new Promise((r) => setTimeout(r, 600))

const report = []
const assert = (name, cond, extra) => {
  report.push({ name, ok: Boolean(cond), extra: extra ?? null })
  if (!cond) console.error('FAIL', name, extra ?? '')
}

const state = () => page.evaluate(() => window.__nokoue.state())
const call = (fn) => page.evaluate(fn)

await page.screenshot({ path: `${OUT}/title.png` })
let s = await state()
assert('menu', s.phase === 'menu', s.phase)
assert('pirogue owned', s.owned.includes('pirogue') && s.equipped === 'pirogue')

await page.click('#open-shop')
await page.waitForSelector('#shop-list .board')
await new Promise((r) => setTimeout(r, 200))
await page.screenshot({ path: `${OUT}/shop.png` })
const shopText = await page.$eval('#shop', (el) => el.innerText)
assert('shop boards', ['Pirogue Bleue', 'Wax Rouge', 'Taxi-Brousse', 'Palais'].every((n) => shopText.includes(n)), shopText.slice(0, 180))
await page.click('#shop-back')

await page.click('#play')
await new Promise((r) => setTimeout(r, 250))
s = await state()
assert('playing after start', s.phase === 'playing', s.phase)
await call(() => {
  window.__nokoue.debugClear()
  window.__nokoue.debugSpawn('crate', 0)
  window.__nokoue.debugSpawn('coin', 1)
  window.__nokoue.debugSpawn('taxi', 2)
})
await new Promise((r) => setTimeout(r, 220))
await page.screenshot({ path: `${OUT}/gameplay.png` })
await call(() => window.__nokoue.debugClear())

await page.keyboard.press('ArrowLeft')
await new Promise((r) => setTimeout(r, 180))
s = await state()
assert('arrow left lane', s.lane === 0, s.lane)
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
await new Promise((r) => setTimeout(r, 180))
s = await state()
assert('arrow right lane', s.lane === 2, s.lane)
await page.keyboard.press('KeyA')
await new Promise((r) => setTimeout(r, 120))
s = await state()
assert('key a left', s.lane === 1, s.lane)
await page.keyboard.down('ArrowUp')
await page.keyboard.up('ArrowUp')
await new Promise((r) => setTimeout(r, 80))
s = await state()
assert('jump', s.jumping === true, s)
await page.keyboard.press('ArrowDown')
await new Promise((r) => setTimeout(r, 80))

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
const before = (await state()).wallet
await call(() => window.__nokoue.debugSpawn('coin', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('coin collected', s.wallet === before + 1 && s.caurisRun === 1, s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await call(() => window.__nokoue.debugVault('crate', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('jump clears crate', s.phase === 'playing' && s.danger === false, s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await page.keyboard.press('ArrowDown')
await call(() => window.__nokoue.debugSpawn('banner', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('slide under banner', s.phase === 'playing' && s.danger === false, s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await call(() => window.__nokoue.debugSpawn('banner', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('banner trips without slide', s.phase === 'playing' && s.danger === true, s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await call(() => window.__nokoue.debugSpawn('crate', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('first crate is a stumble', s.phase === 'playing' && s.danger === true, s)
await new Promise((r) => setTimeout(r, 700))
await call(() => window.__nokoue.debugSpawn('barrel', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('second stumble ends run', s.phase === 'over' && s.cause === 'second', s)
await page.screenshot({ path: `${OUT}/gameover.png` })
const best = s.best
const wallet = s.wallet
assert('best saved in state', best > 0, s)

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nokoue-rush-v1')))
assert('localStorage best', stored.best === best && stored.cauris === wallet, stored)

await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__nokoue)
s = await state()
assert('persist after reload', s.best === best && s.wallet === wallet && s.phase === 'menu', s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await call(() => window.__nokoue.debugSpawn('taxi', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('taxi is head-on', s.phase === 'over' && s.cause === 'head' && s.line.length > 12, s)

await call(() => window.__nokoue.play())
await call(() => window.__nokoue.debugClear())
await call(() => window.__nokoue.activate())
s = await state()
assert('shield on', s.shield === true && s.boardActive === true, s)
await call(() => window.__nokoue.debugSpawn('taxi', 1))
await new Promise((r) => setTimeout(r, 900))
s = await state()
assert('shield saves taxi', s.phase === 'playing' && s.shield === false, s)

await call(() => window.__nokoue.debugWallet(500))
await page.evaluate(() => window.__nokoue.menu())
await page.click('#open-shop')
await page.waitForSelector('.board')
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.board')].find((node) => node.textContent.includes('Wax Rouge'))
  card.querySelector('button').click()
})
await new Promise((r) => setTimeout(r, 150))
s = await state()
assert('bought wax', s.owned.includes('wax') && s.equipped === 'wax' && s.wallet === 410, s)

await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__nokoue)
s = await state()
assert('board persists', s.equipped === 'wax' && s.owned.includes('wax') && s.wallet === 410, s)

await page.evaluate(() => {
  const canvas = document.querySelector('#view')
  const rect = canvas.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height * 0.55
  const fire = (type, cx, cy) =>
    canvas.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, bubbles: true, pointerId: 1, pointerType: 'touch' }))
  window.__nokoue.play()
  window.__nokoue.debugClear()
  fire('pointerdown', x, y)
  fire('pointerup', x - 90, y)
})
await new Promise((r) => setTimeout(r, 200))
s = await state()
assert('swipe left', s.phase === 'playing' && s.lane === 0, s)

await page.evaluate(() => {
  const canvas = document.querySelector('#view')
  const rect = canvas.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height * 0.45
  const tap = () => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }))
  }
  window.__nokoue.play()
  tap()
  tap()
})
await new Promise((r) => setTimeout(r, 100))
s = await state()
assert('double tap board', s.shield === true, s)

const failed = report.filter((item) => !item.ok)
console.log(JSON.stringify({ failed: failed.length, report, logs: logs.slice(0, 40) }, null, 2))
await browser.close()
process.exit(failed.length ? 1 : 0)
