// utils — a live playground for the framework-free helpers:
// fmt (ru-RU numbers/dates/sizes), genSlug, imgproxyUrl and extractImagesFromZip.
import { createSignal, For, Show, onCleanup } from 'solid-js'
import { Rub0, Rub2, Rub4, Rub0R, RubR2, fmtNum, fmtPrice, fmtDate, fmtDateTime, fmtDateTimeShort, fmtTime, fmtDateMonth, timeAgo, fmtSize, genSlug, extractImagesFromZip, imgproxyUrl, configureImgproxy } from '@solid-dumb-kit/utils'

function Row(props: { call: string; value: string }) {
  return (
    <tr>
      <td class="whitespace-nowrap text-secondary"><code>{props.call}</code></td>
      <td class="tabular-nums">{props.value || <i class="text-base-content">пусто</i>}</td>
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
    <div class="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 p-5 text-base-content [&_input]:box-border [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-base-300 [&_input]:px-2.5 [&_input]:py-1.5 [&_select]:box-border [&_select]:w-auto [&_select]:rounded-lg [&_select]:border [&_select]:border-base-300 [&_select]:px-2.5 [&_select]:py-1.5 [&_table]:mt-2.5 [&_table]:border-collapse [&_th]:pr-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_th]:text-base-content [&_td]:pr-2 [&_td]:py-0.5 [&_td]:text-[13px] [&_figure]:m-0 [&_figure]:text-center [&_figure_img]:h-22.5 [&_figure_img]:w-full [&_figure_img]:rounded-lg [&_figure_img]:bg-base-200 [&_figure_img]:object-cover [&_figcaption]:text-[11px] [&_figcaption]:text-base-content [&_figcaption]:[overflow-wrap:anywhere]">

      {/* ── numbers ── */}
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">fmt — numbers</h3>
        <p class="mb-2.5 text-xs text-base-content">Hard-wired to <code>ru-RU</code> and ₽. Group separator is a non-breaking space.</p>
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
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">fmt — dates & size</h3>
        <p class="mb-2.5 text-xs text-base-content">Anything invalid comes back empty, never <code>Invalid Date</code>.</p>
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
        <label class="mt-2.5 block text-xs text-base-content">
          fmtSize — {fmtSize(bytes())}
          <input type="range" min="0" max="26" step="1" value={Math.round(Math.log2(bytes() || 1))}
                 onInput={(e) => setBytes(2 ** Number(e.currentTarget.value))} />
        </label>
      </section>

      {/* ── slug ── */}
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">genSlug</h3>
        <p class="mb-2.5 text-xs text-base-content">
          Cyrillic transliteration + diacritics stripping. Try <code>Café Ürün</code> or <code>Сёмга слабосолёная</code>.
        </p>
        <input value={name()} onInput={(e) => setName(e.currentTarget.value)} />
        <code class="out mt-2.5 block rounded-lg bg-neutral px-2.5 py-2 text-[13px] text-neutral-content [overflow-wrap:anywhere]">{genSlug(name()) || '—'}</code>
      </section>

      {/* ── imgproxy ── */}
      <section class="rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">imgproxyUrl</h3>
        <p class="mb-2.5 text-xs text-base-content">
          Configured with <code>{'{ baseUrl: "https://img.example.com", bucket: "demo" }'}</code> — so
          <code> /media/…</code> folds into <code>s3://demo/…</code> before encoding.
        </p>
        <input value={src()} onInput={(e) => setSrc(e.currentTarget.value)} />
        <div class="mt-2 flex gap-2">
          <input class="!w-25" type="number" value={w()} min="0" step="100"
                 onInput={(e) => setW(Number(e.currentTarget.value))} />
          <select value={fmt()} onChange={(e) => setFmt(e.currentTarget.value as 'webp')}>
            <option value="webp">webp</option>
            <option value="avif">avif</option>
            <option value="jpg">jpg</option>
          </select>
        </div>
        <code class="out mt-2.5 block rounded-lg bg-neutral px-2.5 py-2 text-[13px] text-neutral-content [overflow-wrap:anywhere]">{imgproxyUrl(src(), { w: w(), fit: 'fill', q: 85, format: fmt() })}</code>
      </section>

      {/* ── zip ── */}
      <section class="col-span-full rounded-xl border border-base-300 bg-base-100 px-4 py-3.5">
        <h3 class="mb-1 text-sm">extractImagesFromZip</h3>
        <p class="mb-2.5 text-xs text-base-content">
          Drop in a <code>.zip</code> with images — you get a <code>FileList</code> ready for an
          upload input. <code>__MACOSX/</code>, dot-files and non-images are filtered out, paths are
          flattened. <code>fflate</code> only loads when you actually pick a file.
        </p>
        <input class="!border-none !p-0 text-[13px]" type="file" accept=".zip,application/zip" onChange={onZip} />
        <Show when={zipErr()}>
          <code class="out mt-2.5 block rounded-lg bg-error px-2.5 py-2 text-[13px] text-neutral-content [overflow-wrap:anywhere]">{zipErr()}</code>
        </Show>
        <Show when={files().length}>
          <div class="mb-2.5 text-xs text-base-content">{files().length} image(s) extracted</div>
          <div class="mt-2 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
            <For each={files()}>
              {(f) => (
                <figure>
                  <img src={f.url} alt={f.name} />
                  <figcaption>{f.name}<br /><span class="text-base-content">{f.type}</span></figcaption>
                </figure>
              )}
            </For>
          </div>
        </Show>
      </section>

    </div>
  )
}
