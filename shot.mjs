import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const [tab, theme] of JSON.parse(process.argv[2])) {
  await page.goto(`http://localhost:4199/solid-dumb-kit/#${tab}`, { waitUntil: 'networkidle' })
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `/tmp/s-${tab}-${theme}.png` })
}
await browser.close()
