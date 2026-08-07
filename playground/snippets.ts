// Подсветка сниппетов доки — ЗАРАНЕЕ, на сборке, и ни байта в браузер.
//
// Shiki честно раскрашивает по TextMate-грамматикам, но в рантайме это движок
// Oniguruma (WASM), грамматика на каждый язык и тема — сотни килобайт ради
// десятка коротких блоков. Здесь он работает в Node: плагин выполняет файл
// `*.snippets.ts`, прогоняет каждую строку через `codeToHtml` и отдаёт в модуль
// уже готовую разметку. В бандл витрины уезжает HTML, самого Shiki там нет.
//
// Разметка — на КЛАССАХ, а не на инлайновых стилях. По умолчанию Shiki пишет
// каждому токену `style="--shiki-light:#D73A49;--shiki-dark:#F97583"`, и на
// строку кода выходит вчетверо больше стилей, чем самого кода.
// `transformerStyleToClass` сводит каждую пару цветов к одному классу, а сами
// правила отдаёт одним куском CSS — он приезжает виртуальным модулем и уходит
// в общий CSS-бандл, а не в JS.
//
// Цена — правило для таких файлов: `*.snippets.ts` содержит ТОЛЬКО строки
// (можно `[...].join('\n')`), никаких импортов и вызовов чужого кода. Он и
// правда выполняется здесь, в конфиге сборки.
//
// TS-транспиляция берётся у Vite (`transformWithOxc`), а не импортом `esbuild`
// напрямую: в pnpm-воркспейсе esbuild лежит транзитивно, и такой импорт из
// корня не резолвится — конфиг падает вместе с дев-сервером. `esbuild`-версия
// того же API в Vite 8 объявлена устаревшей.
import { transformWithOxc, type Plugin } from 'vite'
import { codeToHtml } from 'shiki'
import { transformerStyleToClass } from '@shikijs/transformers'

const FILE = /\.snippets\.ts$/

/** Пара тем: витрина светлая (nord, scifi·день) и тёмная (dark, scifi). */
const THEMES = { light: 'github-light', dark: 'github-dark' } as const

// Виртуальный CSS, свой на каждый файл сниппетов. Имя обязано оканчиваться на
// `.css`: по расширению Vite и понимает, что модуль — стиль, а не JS. Внутри
// сборщика id живёт с `\0` — так помечают то, чего нет на диске.
const CSS_ID = 'dumb-snippets-css:'
const cssIdOf = (file: string) => `${CSS_ID}${file}.css`

/** Что вернётся в модуль вместо строки. */
export type Snippet = { code: string; html: string }

/**
 * Склеить соседние токены одного цвета. Shiki режет строку по грамматике, и
 * `export`, ` default`, ` function` приезжают тремя спанами с одинаковым
 * классом — а это три открывающих тега на пустом месте. Гоняем, пока склеивать
 * нечего: за проход схлопывается одна пара.
 */
const merge = (html: string): string => {
  const pair = /<span class="([\w-]+)">([^<]*)<\/span><span class="\1">/g
  let prev: string
  let out = html
  do {
    prev = out
    out = out.replace(pair, '<span class="$1">$2')
  } while (out !== prev)
  return out
}

export function snippets(): Plugin {
  // CSS каждого файла сниппетов: собран при его трансформе, отдаётся по импорту
  // виртуального модуля, который туда же и дописан.
  const css = new Map<string, string>()

  return {
    name: 'dumb-snippets',
    enforce: 'pre',

    resolveId(id) {
      return id.startsWith(CSS_ID) ? `\0${id}` : null
    },

    load(id) {
      if (!id.startsWith(`\0${CSS_ID}`)) return null
      const file = id.slice(CSS_ID.length + 1, -'.css'.length)
      return css.get(file) ?? ''
    },

    async transform(src, id) {
      const file = id.split('?')[0]
      if (!FILE.test(file)) return null

      // TS → JS и выполняем прямо здесь: сниппеты — константы, импортов и
      // побочных эффектов в таком файле нет. Модуль подсовывается через
      // data-URL: содержимое меняется — меняется и URL, поэтому правка
      // сниппета не залипает в кеше загрузчика.
      const { code: js } = await transformWithOxc(src, id)
      const mod = await import(
        `data:text/javascript;base64,${Buffer.from(js, 'utf8').toString('base64')}`
      )

      const dict = (mod.default ?? {}) as Record<string, string>
      // язык по имени сниппета; не указан — tsx (в примерах это девять из десяти)
      const langs = (mod.langs ?? {}) as Record<string, string>

      // Свой инстанс на файл: классы нумеруются внутри него, и CSS получается
      // ровно тот, что нужен этому набору сниппетов.
      const toClass = transformerStyleToClass({ classPrefix: 'sk-' })

      const out: Record<string, Snippet> = {}
      for (const [name, code] of Object.entries(dict)) {
        const html = await codeToHtml(code, {
          lang: langs[name] ?? 'tsx',
          themes: THEMES,
          // обе палитры уходят в CSS-переменные `--shiki-light`/`--shiki-dark`,
          // а какую взять — решает `data-theme` на <html> (см. app.css)
          defaultColor: false,
          transformers: [toClass],
        })
        out[name] = { code, html: merge(html) }
      }

      css.set(file, toClass.getCSS())

      // Импорт виртуального CSS первой строкой: Vite подхватит его как обычный
      // стиль — в деве вставит тегом, в сборке сольёт в общий CSS-файл.
      return {
        code: `import ${JSON.stringify(cssIdOf(file))}\nexport default ${JSON.stringify(out)}`,
        map: null,
      }
    },
  }
}
