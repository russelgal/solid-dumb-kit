// utils — a live playground for the framework-free helpers:
// fmt (ru-RU numbers/dates/sizes), genSlug, imgproxyUrl and extractImagesFromZip.
import { createSignal, For, Show, onCleanup } from 'solid-js'
import { Rub0, Rub2, Rub4, Rub0R, RubR2, fmtNum, fmtPrice, fmtDate, fmtDateTime, fmtDateTimeShort, fmtTime, fmtDateMonth, timeAgo, fmtSize, genSlug, extractImagesFromZip, imgproxyUrl, configureImgproxy } from '@solid-dumb-kit/utils'

function Row(props: { call: string; value: string }) {
  return (
    <tr>
      <td class="call"><code>{props.call}</code></td>
      <td class="val">{props.value || <i class="muted">пусто</i>}</td>
    </tr>
  )
}

export default function UtilsExample() {
  // ── fmt ──
  const [num, setNum] = createSignal('1234.5')
  const [date, setDate] = createSignal('2026-02-23T16:40:22')
  const [bytes, setBytes] = createSignal(1_572_864)

  // ── slug ──
  const [name, setName] = createSignal('Пляжный отдых и бассейны')

  // ── imgproxy ──
  configureImgproxy({ baseUrl: 'https://img.example.com', bucket: 'demo' })
  const [src, setSrc] = createSignal('/media/rooms/42/photo.jpg')
  const [w, setW] = createSignal(800)
  const [fmt, setFmt] = createSignal<'webp' | 'avif' | 'jpg'>('webp')

  // ── zip ──
  const [files, setFiles] = createSignal<{ name: string; type: string; url: string }[]>([])
  const [zipErr, setZipErr] = createSignal('')
  onCleanup(() => files().forEach((f) => URL.revokeObjectURL(f.url)))

  const onZip = async (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    setZipErr('')
    try {
      const list = await extractImagesFromZip(file)
      files().forEach((f) => URL.revokeObjectURL(f.url))
      setFiles(Array.from(list).map((f) => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) })))
    } catch (err) {
      setZipErr(String(err))
    }
  }

  return (
    <div class="ut-example">

      {/* ── numbers ── */}
      <section class="card">
        <h3>fmt — numbers</h3>
        <p class="note">Hard-wired to <code>ru-RU</code> and ₽. Group separator is a non-breaking space.</p>
        <input value={num()} onInput={(e) => setNum(e.currentTarget.value)} placeholder="1234.5 · '' · abc" />
        <table>
          <thead><tr><th>call</th><th>result</th></tr></thead>
          <tbody>
            <Row call="Rub0(v)" value={Rub0(num())} />
            <Row call="Rub2(v)" value={Rub2(num())} />
            <Row call="Rub4(v)" value={Rub4(num())} />
            <Row call="Rub0R(v)" value={Rub0R(num())} />
            <Row call="RubR2(v)" value={RubR2(num())} />
            <Row call="fmtNum(v)" value={fmtNum(num())} />
            <Row call="fmtPrice(v)" value={fmtPrice(num())} />
          </tbody>
        </table>
      </section>

      {/* ── dates ── */}
      <section class="card">
        <h3>fmt — dates & size</h3>
        <p class="note">Anything invalid comes back empty, never <code>Invalid Date</code>.</p>
        <input value={date()} onInput={(e) => setDate(e.currentTarget.value)} placeholder="ISO date" />
        <table>
          <tbody>
            <Row call="fmtDate(v)" value={fmtDate(date())} />
            <Row call="fmtDateTime(v)" value={fmtDateTime(date())} />
            <Row call="fmtDateTimeShort(v)" value={fmtDateTimeShort(date())} />
            <Row call="fmtTime(v)" value={fmtTime(date())} />
            <Row call="fmtDateMonth(v)" value={fmtDateMonth(date())} />
            <Row call="timeAgo(v)" value={timeAgo(date())} />
          </tbody>
        </table>
        <label class="range">
          fmtSize — {fmtSize(bytes())}
          <input type="range" min="0" max="26" step="1" value={Math.round(Math.log2(bytes() || 1))}
                 onInput={(e) => setBytes(2 ** Number(e.currentTarget.value))} />
        </label>
      </section>

      {/* ── slug ── */}
      <section class="card">
        <h3>genSlug</h3>
        <p class="note">
          Cyrillic transliteration + diacritics stripping. Try <code>Café Ürün</code> or <code>Сёмга слабосолёная</code>.
        </p>
        <input value={name()} onInput={(e) => setName(e.currentTarget.value)} />
        <code class="out">{genSlug(name()) || '—'}</code>
      </section>

      {/* ── imgproxy ── */}
      <section class="card">
        <h3>imgproxyUrl</h3>
        <p class="note">
          Configured with <code>{'{ baseUrl: "https://img.example.com", bucket: "demo" }'}</code> — so
          <code> /media/…</code> folds into <code>s3://demo/…</code> before encoding.
        </p>
        <input value={src()} onInput={(e) => setSrc(e.currentTarget.value)} />
        <div class="controls">
          <input class="narrow" type="number" value={w()} min="0" step="100"
                 onInput={(e) => setW(Number(e.currentTarget.value))} />
          <select value={fmt()} onChange={(e) => setFmt(e.currentTarget.value as 'webp')}>
            <option value="webp">webp</option>
            <option value="avif">avif</option>
            <option value="jpg">jpg</option>
          </select>
        </div>
        <code class="out">{imgproxyUrl(src(), { w: w(), fit: 'fill', q: 85, format: fmt() })}</code>
      </section>

      {/* ── zip ── */}
      <section class="card wide">
        <h3>extractImagesFromZip</h3>
        <p class="note">
          Drop in a <code>.zip</code> with images — you get a <code>FileList</code> ready for an
          upload input. <code>__MACOSX/</code>, dot-files and non-images are filtered out, paths are
          flattened. <code>fflate</code> only loads when you actually pick a file.
        </p>
        <input class="file" type="file" accept=".zip,application/zip" onChange={onZip} />
        <Show when={zipErr()}>
          <code class="out error">{zipErr()}</code>
        </Show>
        <Show when={files().length}>
          <div class="note">{files().length} image(s) extracted</div>
          <div class="thumbs">
            <For each={files()}>
              {(f) => (
                <figure>
                  <img src={f.url} alt={f.name} />
                  <figcaption>{f.name}<br /><span class="muted">{f.type}</span></figcaption>
                </figure>
              )}
            </For>
          </div>
        </Show>
      </section>

      <style>{`
        .ut-example { padding: 16px 20px; color: var(--color-base-content);
                      display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) }
        .ut-example .card { padding: 14px 16px; border-radius: 12px; border: 1px solid var(--color-base-300); background: var(--color-base-100) }
        .ut-example .card.wide { grid-column: 1 / -1 }
        .ut-example h3 { margin: 0 0 4px; font-size: 14px }
        .ut-example .note { margin: 0 0 10px; font-size: 12px; color: var(--color-base-content) }
        .ut-example .muted { color: var(--color-base-content) }

        .ut-example input, .ut-example select {
          width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--color-base-300);
          font: inherit; box-sizing: border-box }
        .ut-example input.narrow { width: 100px }
        .ut-example input.file, .ut-example input[type=range] { border: none; padding: 0; font-size: 13px }
        .ut-example .controls { display: flex; gap: 8px; margin-top: 8px }
        .ut-example .controls select { width: auto }
        .ut-example .range { display: block; margin-top: 10px; font-size: 12px; color: var(--color-base-content) }

        .ut-example table { border-collapse: collapse; margin-top: 10px }
        .ut-example th { text-align: left; font-weight: 600; color: var(--color-base-content); padding: 4px 8px 4px 0 }
        .ut-example td { padding: 3px 8px 3px 0; font-size: 13px }
        .ut-example td.call { color: color-mix(in oklch, var(--color-secondary) 55%, var(--color-base-content)); white-space: nowrap }
        .ut-example td.val { font-variant-numeric: tabular-nums }

        .ut-example .out { display: block; margin-top: 10px; padding: 8px 10px; border-radius: 8px;
                           background: var(--color-neutral); color: var(--color-neutral-content); font-size: 13px; overflow-wrap: anywhere }
        .ut-example .out.error { background: var(--color-error) }

        .ut-example .thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                              gap: 10px; margin-top: 8px }
        .ut-example figure { margin: 0; text-align: center }
        .ut-example figure img { width: 100%; height: 90px; object-fit: cover;
                                 border-radius: 8px; background: var(--color-base-200) }
        .ut-example figcaption { font-size: 11px; color: var(--color-base-content); overflow-wrap: anywhere }
      `}</style>
    </div>
  )
}
