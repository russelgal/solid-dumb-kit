import { chromium } from 'playwright'
const TABS = 'selection sortable kanban grid dashboard board dnd sortdnd board2 tree table odata1c utils rawdnd cssorder flipbench orderkanban orderboard ordertable ordertree'.split(' ')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const rows = []
for (const theme of ['nord', 'dark']) {
  for (const tab of TABS) {
    const errs = []
    const onErr = (e) => errs.push(e.message.split('\n')[0])
    page.on('pageerror', onErr)
    await page.goto(`http://localhost:4199/solid-dumb-kit/#${tab}`, { waitUntil: 'networkidle' })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const root = document.querySelector('main') ?? document.body
      const els = [...root.querySelectorAll('*')]
      // сколько текста реально нарисовано и не схлопнулся ли контент
      const painted = els.filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 }).length
      // элементы, у которых цвет текста в точности равен фону — верный признак
      // того, что токен подставлен не тот
      let invisible = 0, sample = ''
      const bgOf = (el) => { let e = el
        while (e) { const b = getComputedStyle(e).backgroundColor
          if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; e = e.parentElement }
        return null }
      for (const e of els) {
        if (!e.textContent?.trim() || e.children.length) continue
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue
        const bg = bgOf(e)
        if (bg && bg === cs.color) { invisible++; if (!sample) sample = e.textContent.trim().slice(0, 30) }
      }
      return { painted, invisible, sample, text: root.innerText.trim().length }
    })
    page.off('pageerror', onErr)
    rows.push({ theme, tab, ...r, errs: errs.length })
  }
}
const bad = rows.filter((r) => r.invisible > 0 || r.errs > 0 || r.painted < 10 || r.text < 50)
console.log(`  проверено ${rows.length} страниц (20 вкладок × 2 темы)`)
console.log(`  проблемных: ${bad.length}`)
for (const b of bad) console.log(`    ${b.theme}/${b.tab}: невидимого текста ${b.invisible}${b.sample ? ` («${b.sample}»)` : ''}, ошибок ${b.errs}, нарисовано узлов ${b.painted}, текста ${b.text}`)
await browser.close()
