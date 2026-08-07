// ResizableGrid — 3 resizable columns + a resizable second row.
// Drag the gaps between panels; sizes persist to localStorage (reload to see).
// NOTE: the grid fills its parent — give the PARENT a height.
import { For } from 'solid-js'
import { ResizableGrid } from '@solid-dumb-kit/resizable-grid'
import { Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './ResizableGrid.snippets'

const GRID_PROPS = [
  { name: 'cols', type: 'GridPanel[]', about: 'Колонки первого ряда — две или три.' },
  { name: 'rows', type: 'GridPanel[]', about: 'Второй ряд, до трёх панелей. Между рядами появляется горизонтальная ручка.' },
  { name: 'rowInitial / row2Initial', type: 'number', def: '1', about: 'Высоты рядов во fr.' },
  { name: 'rowMin', type: 'number', about: 'Минимальная высота ряда, px.' },
  {
    name: 'storageKey',
    type: 'string',
    about: 'Ключ localStorage. Размеры хранятся во fr, поэтому смена ширины окна сохраняет пропорции.',
  },
  { name: 'class', type: 'string', about: 'Класс на контейнер сетки.' },
]

const PANEL_PROPS = [
  { name: 'id', type: 'string', about: 'Ключ панели.' },
  { name: 'content', type: '() => JSX.Element', about: 'Содержимое — render prop.' },
  { name: 'min', type: 'number', def: '100', about: 'Минимальный размер, px: дальше ручка не пойдёт.' },
  { name: 'initial', type: 'number', def: '1', about: 'Начальная доля во fr — до первой правки пользователем.' },
]

// цвета приходят пропсами — единственное, что остаётся инлайном; по умолчанию
// берём токены темы, иначе панель светится белым в тёмной
const Panel = (p: { title: string; bg?: string; fg?: string; children?: any }) => (
  <div
    class="box-border h-full overflow-auto px-3.5 py-3"
    style={{ background: p.bg ?? 'var(--color-base-100)', color: p.fg ?? 'var(--color-base-content)' }}
  >
    <div class="mb-2 text-xs uppercase tracking-wide opacity-60">{p.title}</div>
    {p.children}
  </div>
)

const list = (n: number, label: string) => (
  <For each={Array.from({ length: n }, (_, i) => i)}>
    {(i) => <div class="rounded px-1.5 py-1 text-[13px]" classList={{ 'bg-base-content/10': i % 2 === 0 }}>{label} {i + 1}</div>}
  </For>
)

export default function ResizableGridExample() {
  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">ResizableGrid</h3>
      <p class="mb-2.5 text-[13px] text-base-content">
        Drag the gaps ↔ between columns and ↕ between rows. Sizes are saved to <code>localStorage</code> — reload and they stick.
      </p>

      {/* грид растягивается на родителя — высоту задаём ЕМУ */}
      <div class="h-[70vh] overflow-hidden rounded-xl border border-base-300">
        <ResizableGrid
          storageKey="example:resizable-grid"
          rowInitial={2}
          row2Initial={1}
          rowMin={120}
          cols={[
            { id: 'tree', min: 160, initial: 1, content: () => <Panel title="Sidebar" bg="var(--color-base-200)">{list(20, 'Item')}</Panel> },
            { id: 'main', min: 320, initial: 3, content: () => (
              <Panel title="Editor">
                <p class="mb-2">Main panel — grab a divider and drag.</p>
                {list(12, 'Line')}
              </Panel>
            ) },
            { id: 'aside', min: 180, initial: 1, content: () => <Panel title="Outline" bg="var(--color-base-200)">{list(14, 'Heading')}</Panel> },
          ]}
          rows={[
            { id: 'console', min: 140, initial: 2, content: () => <Panel title="Console" bg="var(--color-neutral)" fg="var(--color-neutral-content)">{list(10, 'log')}</Panel> },
            { id: 'inspect', min: 140, initial: 1, content: () => <Panel title="Inspector" bg="color-mix(in oklch, var(--color-neutral) 85%, var(--color-base-100))" fg="var(--color-neutral-content)">{list(8, 'prop')}</Panel> },
          ]}
        />
      </div>


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Колонки">
        <p>
          Панели описываются списком: содержимое, минимальный размер и стартовая доля. Ручка стоит
          между соседями и двигает только их — соседние пропорции не пересчитываются каскадом,
          поэтому перетаскивание предсказуемо.
        </p>
      </Doc>
      <Code title="Три колонки" code={SNIP.basic} />

      <Doc title="Второй ряд">
        <p>
          Кроме колонок бывает нижний ряд — журнал, график, консоль. У него своя высота и своя
          горизонтальная ручка, а внутри ряда панели делятся так же, как колонки.
        </p>
      </Doc>
      <Code title="Колонки и ряд" code={SNIP.rows} />

      <Doc title="Что попадает в хранилище">
        <p>
          Размеры пишутся во <code>fr</code>, а не в пикселях: окно поменяло ширину — пропорции
          остались. Устаревшие данные (панелей стало больше или меньше) проверяются схемой и молча
          заменяются умолчаниями, вместо того чтобы сломать раскладку.
        </p>
      </Doc>
      <Code title="localStorage" code={SNIP.storage} />

      <h4 class="mt-6 text-lg font-semibold">ResizableGrid</h4>
      <Props rows={GRID_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">GridPanel</h4>
      <Props rows={PANEL_PROPS} />

    </div>
  )
}
