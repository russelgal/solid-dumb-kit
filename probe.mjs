import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
await page.goto('http://localhost:4199/solid-dumb-kit/#sortdnd', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log('  контейнер списка:', await page.evaluate(() => {
  const l = document.querySelector('.list'); const cs = getComputedStyle(l)
  return `${cs.display}/${cs.flexDirection} | строк: ${l.querySelectorAll('.list-row').length}` }))
const shown = () => page.evaluate(() => [...document.querySelectorAll('.list-row')]
  .map((e) => ({ y: e.getBoundingClientRect().y, t: e.querySelector('.sd-title').textContent.replace('Track ','') }))
  .sort((a, b) => a.y - b.y).slice(0, 6).map((v) => v.t).join(','))
const dom = () => page.evaluate(() => [...document.querySelectorAll('.list-row')].slice(0, 6).map((e) => e.dataset.sortDndId).join(','))
console.log('  разметка :', await dom(), '| на экране:', await shown())
await page.evaluate(() => { window.__m = 0
  new MutationObserver((r) => { for (const x of r) window.__m += x.addedNodes.length + x.removedNodes.length })
    .observe(document.querySelector('.list'), { childList: true, subtree: true }) })
const at = (i) => page.evaluate((k) => [...document.querySelectorAll('.list-row')]
  .map((e) => { const r = e.getBoundingClientRect(); const g = e.querySelector('.sd-handle').getBoundingClientRect()
    return { y: r.y, gx: g.x + g.width/2, gy: g.y + g.height/2, cx: r.x + r.width/2, ty: r.y + r.height/2 } }).sort((a,b)=>a.y-b.y)[k], i)
const p = await at(0), q = await at(4)
await page.mouse.move(p.gx, p.gy); await page.mouse.down(); await page.waitForTimeout(300)
for (let i = 1; i <= 24; i++) { await page.mouse.move(p.gx + ((q.cx - p.gx) * i) / 24, p.gy + ((q.ty - p.gy) * i) / 24, { steps: 1 }); await page.waitForTimeout(70) }
await page.mouse.up(); await page.waitForTimeout(900)
console.log('  после жеста — разметка:', await dom(), '| на экране:', await shown(), '| мутаций:', await page.evaluate(() => window.__m))
console.log('  ошибки:', errs.length ? errs : 'нет')
await page.screenshot({ path: '/tmp/shot-list.png', clip: { x: 250, y: 180, width: 620, height: 420 } })
await browser.close()
