// DumbLightbox — просмотрщик: во весь экран, листать, зумить.
//
// Рисуется нативным `<dialog>`, то есть в top layer: над всем на странице,
// с блокировкой фокуса и Esc от браузера. Масштаб и сдвиг — только `transform`,
// layout не трогается, поэтому зум колесом идёт в кадре даже на большой
// картинке.
//
// Соседние картинки подгружаются заранее — по одной вперёд и назад. Без этого
// каждое нажатие стрелки показывает пустоту, и просмотр превращается в
// ожидание.
import { For, createSignal } from 'solid-js'
import { DumbLightbox } from '@solid-dumb-kit/lightbox'
import { Bar, Note, Btn, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbLightbox.snippets'

const LIGHTBOX_PROPS = [
  { name: 'items', type: 'LightboxItem[]', about: 'Что листать. Порядок тот же, что на экране.' },
  {
    name: 'index',
    type: '() => number | null',
    about: 'Что открыто. null — просмотрщик закрыт; открыть можно откуда угодно, просто выставив число.',
  },
  {
    name: 'onIndexChange',
    type: '(index: number | null) => void',
    about: 'Пролистали, закрыли крестиком, Esc или кликом по фону.',
  },
  {
    name: 'actions',
    type: '(item, index) => JSX.Element',
    about: 'Свои кнопки внизу: скачать, удалить, поделиться. Получают то, что сейчас открыто.',
  },
  {
    name: 'closeSide',
    type: "'auto' | 'left' | 'right'",
    def: "'auto'",
    about: 'Сторона крестика. По умолчанию по платформе: в macOS слева, иначе справа.',
  },
  {
    name: 'animate',
    type: 'boolean',
    def: 'системная настройка',
    about: 'Открытие и смена кадра. Не задан — анимируем, но молча выключаемся при prefers-reduced-motion.',
  },
]

const ITEM_PROPS = [
  { name: 'url', type: 'string', about: 'Большая картинка — то, что показывается во весь экран.' },
  { name: 'preview', type: 'string', about: 'Мелкая версия: стоит на месте большой, пока та грузится.' },
  { name: 'title', type: 'string', about: 'Подпись под картинкой.' },
]

/**
 * Картинки — с picsum.photos, по фиксированным id: так набор не меняется между
 * заходами и видно, что соседние уже в кеше.
 */
const SHOTS = [1003, 1015, 1024, 1039, 1043, 1050, 1057, 1069].map((id, i) => ({
  url: `https://picsum.photos/id/${id}/1600/1000`,
  preview: `https://picsum.photos/id/${id}/320/200`,
  title: `Снимок ${i + 1} · id ${id}`,
}))

export default function DumbLightboxExample() {
  const [shown, setShown] = createSignal<number | null>(null)

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbLightbox — просмотр во весь экран</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <b>←</b> и <b>→</b> листают по кругу, <b>+</b>/<b>−</b> и колесо — масштаб, <b>0</b>{' '}
        сбрасывает, двойной клик увеличивает и возвращает. Увеличенную картинку можно таскать.{' '}
        <b>Esc</b> и клик по фону закрывают.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Внутри — нативный <code>&lt;dialog&gt;</code>, а не свой <code>position: fixed</code> с
        большим <code>z-index</code>: элемент в <b>top layer</b> стоит над всем, включая чужие
        модалки, и его не режет <code>overflow: hidden</code> у предков.
      </p>

      <Bar>
        <Btn onClick={() => setShown(0)}>Открыть первую</Btn>
        <Btn onClick={() => setShown(SHOTS.length - 1)}>Открыть последнюю</Btn>
        <Note>{shown() === null ? 'закрыт' : `открыт снимок ${(shown() ?? 0) + 1}`}</Note>
      </Bar>

      <div class="grid max-w-[92ch] grid-cols-2 gap-3 sm:grid-cols-4">
        <For each={SHOTS}>
          {(shot, i) => (
            <button
              class="overflow-hidden rounded-box border border-base-300"
              onClick={() => setShown(i())}
              title={shot.title}
            >
              <img
                src={shot.preview}
                alt={shot.title}
                loading="lazy"
                class="aspect-[16/10] w-full object-cover"
              />
            </button>
          )}
        </For>
      </div>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Открыть и закрыть">
        <p>
          Просмотрщик управляемый: <code>index</code> говорит, что показано, <code>null</code> —
          закрыто. Никакого внутреннего «открыт/закрыт» нет, поэтому открыть кадр можно откуда
          угодно — из таблицы, из тоста, по адресу страницы. Рисуется нативным{' '}
          <code>&lt;dialog&gt;</code>, то есть в top layer: ловушку фокуса и <code>Esc</code> даёт
          браузер, а свой <code>z-index: 99999</code> всё равно проиграл бы чужой модалке.
        </p>
      </Doc>
      <Code title="Галерея с просмотром" code={SNIP.basic} />

      <Doc title="Превью и соседи">
        <p>
          <code>preview</code> — мелкая версия того же кадра: она стоит на месте большой, пока та
          грузится, и открытие не даёт пустого экрана. Соседние картинки (одну вперёд, одну назад)
          кит подгружает сам через <code>new Image()</code> — без этого каждое нажатие стрелки
          превращалось бы в ожидание.
        </p>
      </Doc>
      <Code title="Две версии кадра" code={SNIP.preview} />

      <Doc title="Свои кнопки">
        <p>
          <code>actions</code> отдаёт низ панели целиком и получает открытый кадр с его номером —
          «скачать» ведёт на конкретный файл, «удалить» знает, что удалять. Кит оставляет за собой
          листание, зум и закрытие.
        </p>
      </Doc>
      <Code title="Скачать и удалить" code={SNIP.actions} />

      <Doc title="Управление и движение">
        <p>
          Клавиши: <code>←</code> <code>→</code> листают по кругу, <code>+</code> <code>−</code> и
          колесо масштабируют, <code>0</code> сбрасывает, двойной клик увеличивает и возвращает.
          Увеличенную картинку можно таскать. Масштаб и сдвиг — только <code>transform</code>,
          layout не трогается вовсе, поэтому зум идёт в кадре и на большой картинке.
        </p>
      </Doc>
      <Code title="Открыть снаружи, выключить анимацию" code={SNIP.control} />

      <h4 class="mt-6 text-lg font-semibold">DumbLightbox</h4>
      <Props rows={LIGHTBOX_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">LightboxItem</h4>
      <Props rows={ITEM_PROPS} />

      <DumbLightbox
        items={SHOTS}
        index={shown}
        onIndexChange={setShown}
        actions={(item) => (
          <a class="btn btn-sm" href={item.url} target="_blank" rel="noopener">
            Открыть оригинал
          </a>
        )}
      />
    </div>
  )
}
