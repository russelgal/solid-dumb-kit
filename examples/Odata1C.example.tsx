// Odata1C — what the 1C OData client actually puts on the wire.
//
// The URL builder runs offline, so the whole left half of this page works with
// no 1C anywhere: type a resource and a filter, watch the request take shape.
// The request panel on the right only fires when you press the button — nothing
// touches the network on mount (the smoke test mounts this file too).
import { createSignal, For, Show } from 'solid-js'
import { createOdataClient, odataString, toBase64, OdataError } from 'solid-dumb-kit'

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
    <div class="od-example">
      {/* ── подключение ── */}
      <section class="card">
        <h3>Подключение</h3>
        <p class="note">
          Прямой адрес базы (<code>https://host/base/odata/standard.odata</code>) либо относительный путь
          прокси (<code>/odata</code>) — платформа 1С не отдаёт CORS-заголовки, поэтому из браузера ходят
          через свой прокси.
        </p>
        <label>baseUrl<input value={baseUrl()} onInput={(e) => setBaseUrl(e.currentTarget.value)} /></label>
        <div class="controls">
          <label>логин<input value={login()} onInput={(e) => setLogin(e.currentTarget.value)} /></label>
          <label>пароль<input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} /></label>
        </div>
        <table>
          <tbody>
            <tr>
              <td class="call"><code>Authorization</code></td>
              <td class="val">Basic {toBase64(`${login()}:${password()}`)}</td>
            </tr>
          </tbody>
        </table>
        <p class="note">
          base64 считается по UTF-8, поэтому кириллица в логине 1С не ломает Basic-заголовок.
        </p>
      </section>

      {/* ── запрос ── */}
      <section class="card">
        <h3>Запрос</h3>
        <div class="tabs">
          <For each={PRESETS}>
            {(p, i) => (
              <button classList={{ active: preset() === i() }} onClick={() => usePreset(i())}>
                {p.label}
              </button>
            )}
          </For>
        </div>
        <label>ресурс<input value={resource()} onInput={(e) => setResource(e.currentTarget.value)} /></label>
        <label>$filter<input value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} placeholder="без отбора" /></label>
        <p class="note">{PRESETS[preset()]!.note}</p>
      </section>

      {/* ── что уходит в 1С ── */}
      <section class="card wide">
        <h3>URL, который уйдёт в 1С</h3>

        <div class="url-head">
          <span class="url-label">как уйдёт по проводу</span>
          <button class="btn" onClick={() => copy(url(), 'raw')}>
            {copied() === 'raw' ? 'скопировано' : 'копировать'}
          </button>
        </div>
        <code class="out">{url()}</code>
        <p class="note">
          <code>$format=application/json;odata=nometadata</code> клиент добавляет сам: без него в ответе
          светится внутренний адрес сервера 1С, а заголовок <code>Accept</code> платформа игнорирует.
        </p>

        <div class="url-head">
          <span class="url-label">читаемый (декодированный)</span>
          <button class="btn" onClick={() => copy(readableUrl(), 'readable')}>
            {copied() === 'readable' ? 'скопировано' : 'копировать'}
          </button>
        </div>
        <code class="out muted-out">{readableUrl()}</code>
        <p class="note">
          Кириллица тут видна как есть — так проще сверять фильтр глазами. Отправлять нужно
          верхний вариант: 1С ждёт percent-encoding, а пробелы именно как <code>%20</code>,
          не <code>+</code>.
        </p>
      </section>

      {/* ── живой запрос ── */}
      <section class="card wide">
        <h3>Живой запрос</h3>
        <p class="note">
          Уйдёт по-настоящему — по нажатию и только на тот адрес, что указан выше. С демо на GitHub Pages
          сработает лишь если ваша 1С (или прокси перед ней) доступна из браузера.
        </p>
        <button class="primary" disabled={busy()} onClick={run}>
          {busy() ? 'Запрос…' : 'Выполнить list()'}
        </button>
        <Show when={result()}>
          <code class="out" classList={{ error: failed() }}>{result()}</code>
        </Show>
      </section>

      {/* ── экранирование ── */}
      <section class="card wide">
        <h3>odataString — апострофы в значениях</h3>
        <table>
          <tbody>
            <For each={['Скотч', "Д'Артаньян", "ООО 'Рассвет'"]}>
              {(s) => (
                <tr>
                  <td class="call"><code>odataString({JSON.stringify(s)})</code></td>
                  <td class="val"><code>{odataString(s)}</code></td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <p class="note">Апостроф внутри строки удваивается — иначе фильтр разъедется на полуслове.</p>
      </section>

      <style>{`
        .od-example { padding: 16px 20px; color: #0f172a;
                      display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) }
        .od-example .card { padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff }
        .od-example .card.wide { grid-column: 1 / -1 }
        .od-example h3 { margin: 0 0 4px; font-size: 14px }
        .od-example .note { margin: 8px 0 0; font-size: 12px; color: #64748b }
        .od-example code { font-size: 12px }

        .od-example label { display: block; margin-top: 8px; font-size: 12px; color: #64748b }
        .od-example input {
          width: 100%; padding: 7px 10px; margin-top: 3px; border-radius: 8px; border: 1px solid #cbd5e1;
          font: inherit; font-size: 13px; box-sizing: border-box; color: #0f172a }
        .od-example .controls { display: flex; gap: 8px }

        .od-example .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px }
        .od-example .tabs button {
          padding: 5px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff;
          font: inherit; font-size: 12px; cursor: pointer; color: #0f172a }
        .od-example .tabs button.active { border-color: #3b82f6; background: #3b82f6; color: #fff }

        .od-example button.primary {
          padding: 7px 14px; border-radius: 8px; border: none; background: #3b82f6; color: #fff;
          font: inherit; font-size: 13px; cursor: pointer }
        .od-example button.primary:disabled { background: #94a3b8; cursor: default }

        .od-example table { border-collapse: collapse; margin-top: 10px; width: 100% }
        .od-example td { padding: 3px 8px 3px 0; font-size: 13px; vertical-align: top }
        .od-example td.call { color: #7c3aed; white-space: nowrap }
        .od-example td.val { overflow-wrap: anywhere }

        .od-example .url-head { display: flex; align-items: center; gap: 8px; margin-top: 12px }
        .od-example .url-label { font-size: 11px; text-transform: uppercase;
                                 letter-spacing: .04em; color: #94a3b8 }
        .od-example .btn { margin-left: auto; padding: 2px 9px; border-radius: 6px;
                           border: 1px solid #cbd5e1; background: #fff; color: inherit;
                           font: inherit; font-size: 11px; cursor: pointer }
        .od-example .btn:hover { border-color: #94a3b8 }
        .od-example .out { display: block; margin-top: 10px; padding: 8px 10px; border-radius: 8px;
                           background: #0f172a; color: #e2e8f0; overflow-wrap: anywhere;
                           white-space: pre-wrap }
        .od-example .out.muted-out { background: #f1f5f9; color: #334155 }
        .od-example .out.error { background: #7f1d1d; color: #fee2e2 }
      `}</style>
    </div>
  )
}
