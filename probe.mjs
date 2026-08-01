import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const order = () => page.evaluate(() => {
  const p = [...document.querySelectorAll('.dumb-board-panel')].find((x) => x.textContent.includes('Продажи'))
  return [...p.querySelectorAll('.dumb-board-block')].map((b) => ({ o: Number(b.style.order), n: b.textContent.match(/Блок (\d+)/)?.[1] }))
    .sort((a, b) => a.o - b.o).map((v) => v.n).join(',')
})
const at = (k) => page.evaluate((i) => {
  const p = [...document.querySelectorAll('.dumb-board-panel')].find((x) => x.textContent.includes('Продажи'))
  const l = [...p.querySelectorAll('.dumb-board-block')]
    .map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + 40, y: r.y + 16, top: r.y, left: r.x, n: e.textContent.match(/Блок (\d+)/)?.[1] } })
    .sort((a, b) => a.top - b.top || a.left - b.left)
  return l[i]
}, k)
const drag = async (from, to) => {
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.waitForTimeout(250)
  for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12, { steps: 1 }); await page.waitForTimeout(75) }
  await page.mouse.up(); await page.waitForTimeout(700)
}
for (const [i, j, label] of [[1, 2, 'сосед вперёд'], [2, 1, 'сосед назад'], [0, 1, 'первый на второй'], [4, 3, 'из второго ряда в первый']]) {
  await page.goto('http://localhost:4199/solid-dumb-kit/#board2', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const before = await order()
  const a = await at(i), b = await at(j)
  await drag(a, b)
  console.log(`  ${label.padEnd(26)} ${a.n}→место ${b.n}:  ${before}  →  ${await order()}`)
}
await browser.close()
