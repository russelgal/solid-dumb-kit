import { chromium } from 'playwright'

// Можно ли не знать N — задать строки через repeat(auto-fill/auto-fit, ...)?
// Проверяем: (1) валидность minmax с auto/max-content внутри auto-repeat,
//            (2) сколько репетиций даёт auto-fill при height:auto / min-height / height:fixed,
//            (3) переживают ли высокие блоки фиксированный шаг строки,
//            (4) покрывает ли оверлей-subgrid такие строки.
const HTML = `<!doctype html><meta charset=utf-8><style>
  body { margin: 0; font: 12px system-ui }
  .zone { display: grid; gap: 8px; align-content: start;
          grid-template-columns: repeat(3, 1fr); width: 600px; position: relative;
          outline: 1px solid #0a0 }
  .b { background: #dbeafe; border: 1px solid #60a5fa; align-self: start }
  .ov { display: grid; grid-template-columns: subgrid; grid-template-rows: subgrid;
        gap: 8px; pointer-events: none; grid-column: 1 / -1; grid-row: 1 / -1 }
  .ov > i { outline: 1px dashed #f0f; display: block }
</style>
<div id=out></div>
<script>
  const H = [60, 90, 40, 120, 55, 80]
  const W = [1, 2, 1, 1, 1, 2]
  const PLACE = []
  { let col = 0, row = 0
    H.forEach((h, i) => {
      if (col + W[i] > 3) { row++; col = 0 }
      PLACE.push({ row: row + 1, col: col + 1 }); col += W[i]
    }) }
  const ROWS = Math.max(...PLACE.map((p) => p.row))

  globalThis.CASES = [
    { name: 'repeat(auto-fill, minmax(76px, auto))', rows: 'repeat(auto-fill, minmax(76px, auto))' },
    { name: 'repeat(auto-fill, minmax(76px, max-content))', rows: 'repeat(auto-fill, minmax(76px, max-content))' },
    { name: 'repeat(auto-fit, minmax(76px, auto))', rows: 'repeat(auto-fit, minmax(76px, auto))' },
    { name: 'repeat(auto-fill, 76px), height:auto', rows: 'repeat(auto-fill, 76px)' },
    { name: 'repeat(auto-fill, 76px), min-height:88px', rows: 'repeat(auto-fill, 76px)', minH: '88px' },
    { name: 'repeat(auto-fill, 76px), min-height:400px', rows: 'repeat(auto-fill, 76px)', minH: '400px' },
    { name: 'repeat(auto-fill, 76px), height:400px', rows: 'repeat(auto-fill, 76px)', h: '400px' },
    { name: 'repeat(auto-fill, minmax(76px, 1fr)), height:400px', rows: 'repeat(auto-fill, minmax(76px, 1fr))', h: '400px' },
    { name: 'repeat(' + ROWS + ', auto) — эталон', rows: 'repeat(' + ROWS + ', auto)' },
  ]

  const out = document.getElementById('out')
  globalThis.CASES.forEach((c, ci) => {
    const zone = document.createElement('div')
    zone.className = 'zone'; zone.id = 'z' + ci
    zone.style.gridTemplateRows = c.rows
    if (c.minH) zone.style.minHeight = c.minH
    if (c.h) zone.style.height = c.h
    const ov = document.createElement('div')
    ov.className = 'ov'
    for (let i = 0; i < 3 * 6; i++) ov.appendChild(document.createElement('i'))
    zone.appendChild(ov)
    H.forEach((h, i) => {
      const b = document.createElement('div')
      b.className = 'b'; b.dataset.i = i; b.textContent = 'блок ' + i
      b.style.height = h + 'px'
      b.style.gridRow = PLACE[i].row + ' / span 1'
      b.style.gridColumn = PLACE[i].col + ' / span ' + W[i]
      zone.appendChild(b)
    })
    const cap = document.createElement('div'); cap.textContent = c.name
    out.appendChild(cap); out.appendChild(zone)
    out.appendChild(document.createElement('hr'))
  })
</script>`

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
await page.setContent(HTML)
await page.waitForTimeout(300)

const cases = await page.evaluate(() => globalThis.CASES.map((c) => c.name))
for (let i = 0; i < cases.length; i++) {
  const r = await page.evaluate((ci) => {
    const zone = document.getElementById('z' + ci)
    const zr = zone.getBoundingClientRect()
    const cs = getComputedStyle(zone)
    const ov = zone.querySelector('.ov')
    const or = ov.getBoundingClientRect()
    const blocks = [...zone.querySelectorAll('.b')].map((e) => {
      const b = e.getBoundingClientRect()
      return `${e.dataset.i}@(${Math.round(b.x - zr.x)},${Math.round(b.y - zr.y)})h${Math.round(b.height)}`
    })
    const rows = [...new Set([...ov.children].map((e) => {
      const c = e.getBoundingClientRect()
      return `y${Math.round(c.y - zr.y)}h${Math.round(c.height)}`
    }))]
    return {
      applied: cs.gridTemplateRows,            // '' / none => объявление отброшено
      inline: zone.style.gridTemplateRows,
      zoneH: Math.round(zr.height), ovH: Math.round(or.height),
      rows, blocks,
    }
  }, i)
  const dropped = !r.inline
  console.log(cases[i])
  console.log('   принято браузером:', dropped ? 'НЕТ — объявление отброшено' : 'да')
  console.log('   вычисленные строки:', r.applied)
  console.log('   зона', r.zoneH + 'px | оверлей', r.ovH + 'px | ряды оверлея:', r.rows.join(' '))
  console.log('   блоки:', r.blocks.join(' '))
  console.log()
}

await page.screenshot({ path: 'probe31.png', fullPage: true })
await browser.close()
