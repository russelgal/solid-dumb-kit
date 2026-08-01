import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1500, height: 980 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))
const boards = () => page.evaluate(() => [...document.querySelectorAll('.board')].map((b, i) =>
  `доска${i+1}: ` + [...b.querySelectorAll('.wtitle')].map((t) => t.textContent).join(',')))
const at = (b, i) => page.evaluate(([bb, ii]) => {
  const el = document.querySelectorAll('.board')[bb].querySelectorAll('[data-dnd-block]')[ii]
  const r = el.getBoundingClientRect(); return { x: r.x + 60, y: r.y + 18 } }, [b, i])
await page.goto('http://localhost:4199/solid-dumb-kit/#dnd', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
console.log('до:'); (await boards()).forEach((x) => console.log('  ' + x))
// БЫСТРЫЙ жест — тот, на котором раньше терялся drop
const a = await at(0, 0), b = await at(0, 3)
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(250)
for (let i = 1; i <= 14; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / 14, a.y + ((b.y - a.y) * i) / 14, { steps: 1 }); await page.waitForTimeout(60) }
await page.mouse.up(); await page.waitForTimeout(800)
console.log('после (быстрый жест, внутри доски):'); (await boards()).forEach((x) => console.log('  ' + x))
const c = await at(0, 0), d = await at(1, 0)
await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(250)
for (let i = 1; i <= 16; i++) { await page.mouse.move(c.x + ((d.x - c.x) * i) / 16, c.y + ((d.y - c.y) * i) / 16, { steps: 1 }); await page.waitForTimeout(60) }
await page.mouse.up(); await page.waitForTimeout(800)
console.log('после (быстрый, между досками):'); (await boards()).forEach((x) => console.log('  ' + x))
console.log('ошибки:', errors.length ? errors : 'нет')
await browser.close()
