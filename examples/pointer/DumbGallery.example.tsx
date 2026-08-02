// DumbGallery — выбрать картинки, посмотреть, переставить, залить.
//
// Витрина показывает оба режима. Без транспорта галерея локальная: файл виден
// сразу из `objectURL` и никуда не уходит. С транспортом каждый файл встаёт в
// очередь, на плитке едет полоса, а результат прилетает обратно в `items`.
//
// Транспорт тут ПОДДЕЛЬНЫЙ — настоящий ходит к твоему серверу за подписью, и
// показывать это в статичной витрине нечем. Как выглядит настоящий, написано
// прямо на странице.
import { createSignal, Show } from 'solid-js'
import {
  DumbGallery,
  createPresignedUploader,
  type GalleryItem,
  type Uploader,
} from '@solid-dumb-kit/gallery'
import { Bar, Switch, Check, Pick, Btn, Note } from '../_controls'

/**
 * Поддельная заливка: тянет полосу до конца за пару секунд и умеет падать.
 *
 * Отмену уважает по-настоящему — на ней и видно, что снятая плитка обрывает
 * запрос, а не досчитывает его в никуда.
 */
const fakeUploader = (opts: { failEvery: () => number; ms: number }): Uploader => {
  // счётчик живёт СНАРУЖИ обещания: пересоздай транспорт на каждой перерисовке —
  // и он обнулится, а «каждая третья» не наступит никогда
  let n = 0
  return (file, ctx) =>
    new Promise((resolve, reject) => {
      const mine = ++n
      const started = performance.now()
      let raf = 0
      const tick = () => {
        if (ctx.signal.aborted) return reject(new Error('отменено'))
        const f = Math.min(1, (performance.now() - started) / opts.ms)
        ctx.onProgress(f)
        if (f < 1) { raf = requestAnimationFrame(tick); return }
        const every = opts.failEvery()
        if (every && mine % every === 0) {
          reject(new Error('хранилище ответило 403: подпись просрочена'))
        } else {
          resolve({ url: URL.createObjectURL(file), key: `demo/${file.name}` })
        }
      }
      raf = requestAnimationFrame(tick)
      ctx.signal.addEventListener('abort', () => cancelAnimationFrame(raf), { once: true })
    })
}

export default function DumbGalleryExample() {
  const [items, setItems] = createSignal<Array<GalleryItem>>([])
  const [mode, setMode] = createSignal<'local' | 'upload'>('local')
  const [failing, setFailing] = createSignal(false)
  const [edit, setEdit] = createSignal(true)
  const [conc, setConc] = createSignal(2)

  // транспорт создаётся ОДИН раз, а режим падений читается в момент заливки
  const fake = fakeUploader({ failEvery: () => (failing() ? 3 : 0), ms: 2200 })

  /**
   * Настоящее хранилище — по адресу подписывающей ручки в строке запроса:
   * `?sign=http://localhost:8787/api/sign#gallery`.
   *
   * Именно в `search`, а не в хеше: хеш витрина разбирает как имя вкладки, и
   * параметр в нём сломал бы навигацию. Нет параметра — поддельный транспорт.
   */
  const signUrl = new URLSearchParams(location.search).get('sign')
  const real =
    signUrl &&
    createPresignedUploader({
      sign: (file) =>
        fetch(signUrl, {
          method: 'POST',
          body: JSON.stringify({ name: file.name, type: file.type }),
        }).then((r) => r.json()),
    })

  const uploader = () => (mode() === 'upload' ? real || fake : undefined)

  const done = () => items().filter((i) => i.status === 'done').length
  const bad = () => items().filter((i) => i.status === 'error').length

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbGallery — картинки: выбрать, переставить, залить</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Выбор файлов и перетаскивание их в окно — примитив{' '}
        <code>@solid-primitives/upload</code>; перестановка — <b>DumbSortable</b>, тот же
        указательный движок, что и на вкладке рядом, поэтому работает и пальцем. Картинка
        показывается <b>сразу</b>, из <code>objectURL</code>, ещё до всякой заливки.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Заливка идёт <b>очередью</b>: два-три файла разом, остальные ждут. Так и должно быть —
        браузер всё равно держит к одному хосту около шести соединений, а двадцать «идущих»
        полосок, из которых движутся шесть, просто врут. Снятая плитка <b>обрывает</b> запрос, а
        не досчитывает его в никуда.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        <b>Ключей от хранилища галерея не видит.</b> Ключ к бакету — это ключ ко всему бакету, и
        в браузере ему не место ни в каком виде. Наружу она ходит только за подписанной ссылкой,
        которую выдаёт твой сервер:
      </p>
      <pre class="mb-3 max-w-[92ch] overflow-x-auto rounded-box bg-neutral px-3 py-2.5 text-[12px] text-neutral-content">
{`const upload = createPresignedUploader({
  sign: (file) => fetch('/api/sign', {
    method: 'POST',
    body: JSON.stringify({ name: file.name, type: file.type }),
  }).then((r) => r.json()),   // → { url, headers?, key?, publicUrl? }
})

<DumbGallery items={items()} setItems={setItems} upload={upload} />`}
      </pre>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>режим правки</Switch>
        <Pick
          label="куда заливать"
          value={mode()}
          options={[
            { value: 'local', label: 'никуда — локально' },
            { value: 'upload', label: real ? 'в настоящее хранилище' : 'в поддельное хранилище' },
          ]}
          onChange={(v) => setMode(v as 'local' | 'upload')}
        />
        <Show when={mode() === 'upload'}>
          <Check checked={failing()} onChange={setFailing}>ронять каждую третью</Check>
          <Pick
            label="одновременно"
            value={conc()}
            options={[1, 2, 3, 6].map((n) => ({ value: n }))}
            onChange={(v) => setConc(Number(v))}
          />
        </Show>
        <Btn onClick={() => setItems([])}>Очистить</Btn>
        <Note>
          {items().length
            ? `${items().length} шт.${done() ? `, залито ${done()}` : ''}${bad() ? `, с ошибкой ${bad()}` : ''}`
            : 'выбери файлы или брось их сюда'}
        </Note>
      </Bar>

      <DumbGallery
        items={items()}
        setItems={setItems}
        upload={uploader()}
        concurrency={conc()}
        editable={edit()}
        tile="minmax(140px, 1fr)"
        class="max-w-[92ch] rounded-box border border-dashed border-base-300 p-3
               [&_.dumb-gallery-tile]:ring-1 [&_.dumb-gallery-tile]:ring-base-300
               [&_.dumb-gallery-tile]:cursor-grab [&_.dumb-gallery-tile]:bg-base-200
               [&_.dumb-gallery-tile>button]:btn [&_.dumb-gallery-tile>button]:btn-xs
               [&_.dumb-gallery-tile>button]:btn-circle [&_.dumb-gallery-tile>button]:absolute
               [&_.dumb-gallery-tile>button]:top-1 [&_.dumb-gallery-tile>button]:right-1
               [&>button]:btn [&>button]:btn-sm [&>button]:mt-3
               [&_[data-gallery-stats]]:ml-3 [&_[data-gallery-stats]]:text-sm"
        onOpen={(item) => item.url && window.open(item.url, '_blank', 'noopener')}
      />

      <Show when={items().some((i) => i.status === 'error')}>
        <p class="mt-3 max-w-[92ch] text-sm text-error">
          Плитки с ошибкой обведены. Настоящая галерея тут предложила бы повторить — очередь это
          умеет, достаточно позвать <code>upload</code> ещё раз для тех же файлов.
        </p>
      </Show>
    </div>
  )
}
