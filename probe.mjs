import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))
await page.goto('http://localhost:5173/solid-dumb-kit/', { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800)
const groups = await page.evaluate(() => [...document.querySelectorAll('.pg-group')].map((g) => ({
  title: g.querySelector('.pg-group-title')?.textContent,
  note: g.querySelector('.pg-group-title')?.title,
  items: [...g.querySelectorAll('.pg-link')].map((a) => a.querySelector('.pg-label')?.textContent),
})))
for (const g of groups) {
  console.log(`  ${g.title}  — ${g.note ?? ''}`)
  console.log('    ' + g.items.join(', '))
}
console.log('  пакетов подписано:', await page.locator('.pg-pkg').count())
console.log('\n═══ открываю каждую вкладку ═══')
const ids = await page.evaluate(() => [...document.querySelectorAll('.pg-link')].map((a) => a.getAttribute('href').slice(1)))
let bad = 0
for (const id of ids) {
  await page.goto(`http://localhost:5173/solid-dumb-kit/#${id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const ok = await page.evaluate(() => (document.querySelector('.pg-main')?.textContent ?? '').trim().length > 40)
  if (!ok) { console.log(`  ✗ ${id} — пусто`); bad++ }
}
console.log(bad ? `  пустых: ${bad}` : `  все ${ids.length} отрисовались ✓`)
console.log('ошибки:', errors.length ? [...new Set(errors)].slice(0, 3) : 'нет')
await browser.close()
