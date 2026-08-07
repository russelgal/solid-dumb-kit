// Odata1C — what the 1C OData client actually puts on the wire.
//
// The URL builder runs offline, so the whole left half of this page works with
// no 1C anywhere: type a resource and a filter, watch the request take shape.
// The request panel on the right only fires when you press the button — nothing
// touches the network on mount (the smoke test mounts this file too).
import { createSignal, For, Show } from 'solid-js'
import { createOdataClient, odataString, toBase64, OdataError } from '@solid-dumb-kit/odata-1c'
import { Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './Odata1C.snippets'

const CLIENT_API = [
  { name: 'createOdataClient', type: '(opts) => OdataClient', about: 'baseUrl, login/password либо готовый token, свой fetch и timeoutMs.' },
  { name: 'list', type: '(resource, params?) => Promise<OdataListResponse>', about: 'Список с $select, $filter, $top, $skip. Формат ответа — JSON без метаданных.' },
  { name: 'one', type: '(entity, refKey, select?) => Promise', about: 'Один объект по ключу.' },
  { name: 'count', type: '(resource, filter?) => Promise<number>', about: 'Сколько всего: 1С не отдаёт $count, клиент считает сам.' },
  { name: 'tailPage', type: '(resource, opts) => Promise', about: 'Последняя страница без выкачивания всего списка.' },
  { name: 'request', type: '(method, resource, opts?) => Promise', about: 'Произвольный запрос, когда готового метода не хватает.' },
  { name: 'url', type: '(resource, params?) => string', about: 'Собрать адрес: параметры кодируются вручную (%20, а не +).' },
  { name: 'odataString', type: '(s: string) => string', about: 'Экранировать строку для фильтра — апостроф удваивается.' },
  { name: 'toBase64', type: '(s: string) => string', about: 'Basic-токен из логина и пароля.' },
  { name: 'OdataError', type: 'class', about: 'Ошибка с разобранным odata.error из тела: описание 1С полезнее, чем «500».' },
]

/** Готовые запросы: показывают приёмы, ради которых клиент и написан */
const PRESETS = [
  {
    label: 'Список с фильтром',
    resource: 'Catalog_Номенклатура',
    params: { $select: 'Ref_Key,Description,Артикул', $filter: "substringof('скотч', Description)", $top: 20 },
    note: 'Пробелы уходят как %20 — с «+» 1С молча вернёт выборку без отбора.',
  },
  {
    label: 'Точечное чтение',
    resource: "Catalog_Номенклатура(guid'a1b2c3d4-0000-0000-0000-000000000001')",
    params: { $select: 'Артикул,Description' },
    note: 'Работает даже там, где $filter запрещён правами роли.',
  },
  {
    label: 'Только счётчик',
    resource: 'Document_РеализацияТоваровУслуг',
    params: { $top: 0, $inlinecount: 'allpages', $select: 'Ref_Key' },
    note: 'Столько же весит ответ, сколько заголовки: строк не просим вовсе.',
  },
  {
    label: 'Период документов',
    resource: 'Document_РеализацияТоваровУслуг',
    params: {
      $select: 'Ref_Key,Number,Date,Posted',
      $filter: "Date ge datetime'2026-04-01T00:00:00' and Date lt datetime'2026-05-01T00:00:00'",
    },
    note: 'Даты — только литералом datetime\'…\', ссылки — guid\'…\'.',
  },
] as const

export default function Odata1CExample() {
  const [baseUrl, setBaseUrl] = createSignal('/odata')
  const [login, setLogin] = createSignal('Кладовщик')
  const [password, setPassword] = createSignal('секрет')
  const [preset, setPreset] = createSignal(0)

  const [resource, setResource] = createSignal<string>(PRESETS[0].resource)
  const [filter, setFilter] = createSignal<string>(PRESETS[0].params.$filter ?? '')

  const client = () => createOdataClient({ baseUrl: baseUrl(), login: login(), password: password() })

  const usePreset = (i: number) => {
    setPreset(i)
    setResource(PRESETS[i]!.resource)
    setFilter(PRESETS[i]!.params.$filter ?? '')
  }

  /** Параметры текущего пресета с подставленным фильтром из поля */
  const params = () => {
    const p: Record<string, string | number> = { ...PRESETS[preset()]!.params }
    if (filter()) p.$filter = filter()
    else delete p.$filter
    return p
  }

  const url = () => {
    try {
      return client().url(resource(), params())
    } catch (e) {
      return String(e)
    }
  }

  /**
   * Читаемый вид: кириллица вместо %D0%9A%D0%BB…
   * decodeURIComponent бросает URIError на одиночном «%» (а он легко попадает
   * в фильтр или в текст ошибки), поэтому декодируем в try — пусть лучше
   * останется закодированным, чем развалится страница.
   */
  const readableUrl = () => {
    try {
      return decodeURIComponent(url())
    } catch {
      return url()
    }
  }

  const [copied, setCopied] = createSignal('')
  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(''), 1200)
  }

  // ── живой запрос: только по кнопке ──
  const [busy, setBusy] = createSignal(false)
  const [result, setResult] = createSignal('')
  const [failed, setFailed] = createSignal(false)

  const run = async () => {
    setBusy(true)
    setFailed(false)
    setResult('')
    try {
      const rows = await client().list(resource(), params())
      setResult(`${rows.length} строк(и)\n\n${JSON.stringify(rows.slice(0, 3), null, 2)}`)
    } catch (e) {
      setFailed(true)
      // OdataError несёт текст самой 1С; всё остальное — сеть/CORS
      setResult(e instanceof OdataError ? `OdataError${e.status ? ` ${e.status}` : ''}: ${e.message}` : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 p-5 text-base-content [&_code]:text-xs [&_label]:mt-2 [&_label]:block [&_label]:text-xs [&_label]:text-base-content [&_input]:mt-1 [&_input]:box-border [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-base-300 [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[13px] [&_table]:mt-2.5 [&_table]:w-full [&_table]:border-collapse [&_td]:pr-2 [&_td]:py-0.5 [&_td]:align-top [&_td]:text-[13px]">
      {/* ── подключение ── */}
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">Подключение</h3>
        <p class="mt-2 text-xs text-base-content">
          Прямой адрес базы (<code>https://host/base/odata/standard.odata</code>) либо относительный путь
          прокси (<code>/odata</code>) — платформа 1С не отдаёт CORS-заголовки, поэтому из браузера ходят
          через свой прокси.
        </p>
        <label>baseUrl<input value={baseUrl()} onInput={(e) => setBaseUrl(e.currentTarget.value)} /></label>
        <div class="flex gap-2">
          <label>логин<input value={login()} onInput={(e) => setLogin(e.currentTarget.value)} /></label>
          <label>пароль<input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} /></label>
        </div>
        <table>
          <tbody>
            <tr>
              <td class="whitespace-nowrap text-secondary"><code>Authorization</code></td>
              <td class="[overflow-wrap:anywhere]">Basic {toBase64(`${login()}:${password()}`)}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-base-content">
          base64 считается по UTF-8, поэтому кириллица в логине 1С не ломает Basic-заголовок.
        </p>
      </section>

      {/* ── запрос ── */}
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">Запрос</h3>
        <div class="mb-1 flex flex-wrap gap-1.5">
          <For each={PRESETS}>
            {(p, i) => (
              <button
                class="btn btn-xs"
                classList={{ 'btn-primary': preset() === i() }} onClick={() => usePreset(i())}>
                {p.label}
              </button>
            )}
          </For>
        </div>
        <label>ресурс<input value={resource()} onInput={(e) => setResource(e.currentTarget.value)} /></label>
        <label>$filter<input value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} placeholder="без отбора" /></label>
        <p class="mt-2 text-xs text-base-content">{PRESETS[preset()]!.note}</p>
      </section>

      {/* ── что уходит в 1С ── */}
      <section class="col-span-full rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">URL, который уйдёт в 1С</h3>

        <div class="mt-3 flex items-center gap-2">
          <span class="text-[11px] uppercase tracking-wide text-base-content">как уйдёт по проводу</span>
          <button class="btn btn-xs ml-auto" onClick={() => copy(url(), 'raw')}>
            {copied() === 'raw' ? 'скопировано' : 'копировать'}
          </button>
        </div>
        <code class="out mt-2.5 block rounded-lg bg-neutral px-2.5 py-2 whitespace-pre-wrap text-neutral-content [overflow-wrap:anywhere]">{url()}</code>
        <p class="mt-2 text-xs text-base-content">
          <code>$format=application/json;odata=nometadata</code> клиент добавляет сам: без него в ответе
          светится внутренний адрес сервера 1С, а заголовок <code>Accept</code> платформа игнорирует.
        </p>

        <div class="mt-3 flex items-center gap-2">
          <span class="text-[11px] uppercase tracking-wide text-base-content">читаемый (декодированный)</span>
          <button class="btn btn-xs ml-auto" onClick={() => copy(readableUrl(), 'readable')}>
            {copied() === 'readable' ? 'скопировано' : 'копировать'}
          </button>
        </div>
        <code class="out mt-2.5 block rounded-lg bg-base-200 px-2.5 py-2 whitespace-pre-wrap text-base-content [overflow-wrap:anywhere]">{readableUrl()}</code>
        <p class="mt-2 text-xs text-base-content">
          Кириллица тут видна как есть — так проще сверять фильтр глазами. Отправлять нужно
          верхний вариант: 1С ждёт percent-encoding, а пробелы именно как <code>%20</code>,
          не <code>+</code>.
        </p>
      </section>

      {/* ── живой запрос ── */}
      <section class="col-span-full rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">Живой запрос</h3>
        <p class="mt-2 text-xs text-base-content">
          Уйдёт по-настоящему — по нажатию и только на тот адрес, что указан выше. С демо на GitHub Pages
          сработает лишь если ваша 1С (или прокси перед ней) доступна из браузера.
        </p>
        <button class="btn btn-sm btn-primary" disabled={busy()} onClick={run}>
          {busy() ? 'Запрос…' : 'Выполнить list()'}
        </button>
        <Show when={result()}>
          <code
            class="out mt-2.5 block rounded-lg px-2.5 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]"
            classList={{
              'bg-neutral text-neutral-content': !failed(),
              'bg-error text-error-content': failed(),
            }}
          >{result()}</code>
        </Show>
      </section>

      {/* ── экранирование ── */}
      <section class="col-span-full rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">odataString — апострофы в значениях</h3>
        <table>
          <tbody>
            <For each={['Скотч', "Д'Артаньян", "ООО 'Рассвет'"]}>
              {(s) => (
                <tr>
                  <td class="whitespace-nowrap text-secondary"><code>odataString({JSON.stringify(s)})</code></td>
                  <td class="[overflow-wrap:anywhere]"><code>{odataString(s)}</code></td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-base-content">Апостроф внутри строки удваивается — иначе фильтр разъедется на полуслове.</p>
      </section>


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Клиент">
        <p>
          Тонкая обёртка над <code>fetch</code>: авторизация, тайм-аут, сборка адреса и разбор
          ответа. Никакой модели данных 1С кит не знает и знать не хочет — справочники и документы
          у всех свои.
        </p>
      </Doc>
      <Code title="Список" code={SNIP.basic} />

      <Doc title="Методы">
        <p>
          <code>count</code> существует потому, что 1С не отдаёт <code>$count</code> — клиент
          считает сам. <code>tailPage</code> — потому что «в конец списка» пользователи жмут чаще,
          чем кажется, а выкачивать ради этого всё нельзя.
        </p>
      </Doc>
      <Code title="one, count, tailPage" code={SNIP.methods} />

      <Doc title="Строки и ошибки">
        <p>
          Апостроф в названии («Труба 1/2&apos;») ломает запрос ровно так же, как кавычка в SQL,
          поэтому строки в фильтрах экранируются функцией, а не руками. Ошибки приходят
          типизированными: у 1С в теле лежит собственное описание, и оно куда полезнее кода ответа.
        </p>
      </Doc>
      <Code title="odataString и OdataError" code={SNIP.strings} />

      <h4 class="mt-6 text-lg font-semibold">OdataClient</h4>
      <Props rows={CLIENT_API} />

    </div>
  )
}
