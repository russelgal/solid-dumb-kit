import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const tab of ['flipbench', 'rawdnd']) {
  await page.goto(`http://localhost:4199/solid-dumb-kit/#${tab}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const cols = await page.evaluate(() => [...new Set([...document.querySelectorAll('.card, [data-id]')]
    .map((e) => getComputedStyle(e).borderTopColor))].slice(0, 5))
  console.log(`  ${tab}: разных цветов рамки ${cols.length} → ${cols.join(' ')}`)
}
await browser.close()
