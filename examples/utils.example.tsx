// utils — a live playground for the framework-free helpers:
// fmt (ru-RU numbers/dates/sizes), genSlug, imgproxyUrl and extractImagesFromZip.
import { createSignal, For, Show, onCleanup } from 'solid-js'
import {
  Rub0, Rub2, Rub4, Rub0R, RubR2, fmtNum, fmtPrice,
  fmtDate, fmtDateTime, fmtDateTimeShort, fmtTime, fmtDateMonth, timeAgo, fmtSize,
  genSlug, extractImagesFromZip, imgproxyUrl, configureImgproxy,
} from 'solid-dumb-kit'

const card = {
  padding: '14px 16px', 'border-radius': '12px', border: '1px solid #e2e8f0', background: '#fff',
} as const
const input = {
  width: '100%', padding: '7px 10px', 'border-radius': '8px', border: '1px solid #cbd5e1',
  font: 'inherit', 'box-sizing': 'border-box',
} as const
const out = {
  display: 'block', padding: '8px 10px', 'border-radius': '8px', background: '#0f172a',
  color: '#e2e8f0', 'font-size': '13px', 'overflow-wrap': 'anywhere',
} as const
const th = { 'text-align': 'left', 'font-weight': '600', color: '#64748b', padding: '4px 8px 4px 0' } as const
const td = { padding: '3px 8px 3px 0', 'font-size': '13px' } as const

function Row(props: { call: string; value: string }) {
  return (
    <tr>
      <td style={{ ...td, color: '#7c3aed', 'white-space': 'nowrap' }}><code>{props.call}</code></td>
      <td style={{ ...td, 'font-variant-numeric': 'tabular-nums' }}>{props.value || <i style={{ color: '#94a3b8' }}>пусто</i>}</td>
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
    <div style={{ padding: '16px', 'max-width': '1040px', margin: '0 auto', color: '#0f172a',
                  display: 'grid', gap: '16px', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))' }}>

      {/* ── numbers ── */}
      <section style={card}>
        <h3 style={{ margin: '0 0 4px', 'font-size': '14px' }}>fmt — numbers</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '12px', color: '#64748b' }}>
          Hard-wired to <code>ru-RU</code> and ₽. Group separator is a non-breaking space.
        </p>
        <input style={input} value={num()} onInput={(e) => setNum(e.currentTarget.value)} placeholder="1234.5 · '' · abc" />
        <table style={{ 'border-collapse': 'collapse', 'margin-top': '10px' }}>
          <thead><tr><th style={th}>call</th><th style={th}>result</th></tr></thead>
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
      <section style={card}>
        <h3 style={{ margin: '0 0 4px', 'font-size': '14px' }}>fmt — dates & size</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '12px', color: '#64748b' }}>
          Anything invalid comes back empty, never <code>Invalid Date</code>.
        </p>
        <input style={input} value={date()} onInput={(e) => setDate(e.currentTarget.value)} placeholder="ISO date" />
        <table style={{ 'border-collapse': 'collapse', 'margin-top': '10px' }}>
          <tbody>
            <Row call="fmtDate(v)" value={fmtDate(date())} />
            <Row call="fmtDateTime(v)" value={fmtDateTime(date())} />
            <Row call="fmtDateTimeShort(v)" value={fmtDateTimeShort(date())} />
            <Row call="fmtTime(v)" value={fmtTime(date())} />
            <Row call="fmtDateMonth(v)" value={fmtDateMonth(date())} />
            <Row call="timeAgo(v)" value={timeAgo(date())} />
          </tbody>
        </table>
        <label style={{ display: 'block', 'margin-top': '10px', 'font-size': '12px', color: '#64748b' }}>
          fmtSize — {fmtSize(bytes())}
          <input type="range" min="0" max="26" step="1" value={Math.round(Math.log2(bytes() || 1))}
                 onInput={(e) => setBytes(2 ** Number(e.currentTarget.value))}
                 style={{ width: '100%' }} />
        </label>
      </section>

      {/* ── slug ── */}
      <section style={card}>
        <h3 style={{ margin: '0 0 4px', 'font-size': '14px' }}>genSlug</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '12px', color: '#64748b' }}>
          Cyrillic transliteration + diacritics stripping. Try <code>Café Ürün</code> or <code>Сёмга слабосолёная</code>.
        </p>
        <input style={input} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
        <code style={{ ...out, 'margin-top': '10px' }}>{genSlug(name()) || '—'}</code>
      </section>

      {/* ── imgproxy ── */}
      <section style={card}>
        <h3 style={{ margin: '0 0 4px', 'font-size': '14px' }}>imgproxyUrl</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '12px', color: '#64748b' }}>
          Configured with <code>{'{ baseUrl: "https://img.example.com", bucket: "demo" }'}</code> — so
          <code> /media/…</code> folds into <code>s3://demo/…</code> before encoding.
        </p>
        <input style={input} value={src()} onInput={(e) => setSrc(e.currentTarget.value)} />
        <div style={{ display: 'flex', gap: '8px', 'margin-top': '8px' }}>
          <input style={{ ...input, width: '100px' }} type="number" value={w()} min="0" step="100"
                 onInput={(e) => setW(Number(e.currentTarget.value))} />
          <select style={{ ...input, width: 'auto' }} value={fmt()}
                  onChange={(e) => setFmt(e.currentTarget.value as 'webp')}>
            <option value="webp">webp</option>
            <option value="avif">avif</option>
            <option value="jpg">jpg</option>
          </select>
        </div>
        <code style={{ ...out, 'margin-top': '10px' }}>
          {imgproxyUrl(src(), { w: w(), fit: 'fill', q: 85, format: fmt() })}
        </code>
      </section>

      {/* ── zip ── */}
      <section style={{ ...card, 'grid-column': '1 / -1' }}>
        <h3 style={{ margin: '0 0 4px', 'font-size': '14px' }}>extractImagesFromZip</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '12px', color: '#64748b' }}>
          Drop in a <code>.zip</code> with images — you get a <code>FileList</code> ready for an
          upload input. <code>__MACOSX/</code>, dot-files and non-images are filtered out, paths are
          flattened. <code>fflate</code> only loads when you actually pick a file.
        </p>
        <input type="file" accept=".zip,application/zip" onChange={onZip} style={{ 'font-size': '13px' }} />
        <Show when={zipErr()}>
          <code style={{ ...out, background: '#7f1d1d', 'margin-top': '10px' }}>{zipErr()}</code>
        </Show>
        <Show when={files().length}>
          <div style={{ 'margin-top': '12px', 'font-size': '13px', color: '#64748b' }}>
            {files().length} image(s) extracted
          </div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '10px', 'margin-top': '8px' }}>
            <For each={files()}>
              {(f) => (
                <figure style={{ margin: '0', 'text-align': 'center' }}>
                  <img src={f.url} alt={f.name}
                       style={{ width: '100%', height: '90px', 'object-fit': 'cover', 'border-radius': '8px',
                                background: '#f1f5f9' }} />
                  <figcaption style={{ 'font-size': '11px', color: '#64748b', 'overflow-wrap': 'anywhere' }}>
                    {f.name}<br /><span style={{ color: '#94a3b8' }}>{f.type}</span>
                  </figcaption>
                </figure>
              )}
            </For>
          </div>
        </Show>
      </section>
    </div>
  )
}
