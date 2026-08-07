// SelectionArea — Finder-style rubber-band selection.
// Two setups on purpose: a scrolling container, and a long grid with no
// overflow at all (the page scrolls). The engine handles both — in the second
// case the band is clamped to the container and auto-scroll drives the window.
import { createSignal, For, type JSX } from 'solid-js'
import { SelectionArea } from '@solid-dumb-kit/selection'
import { Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './SelectionArea.snippets'

const AREA_PROPS = [
  { name: 'selectables', type: 'string', about: 'CSS-селектор того, что выделяется. Всё остальное внутри области рамка не трогает.' },
  { name: 'selected', type: '() => Set<string>', about: 'Текущее выделение. Состояние держит потребитель — кит его не хранит.' },
  { name: 'onChange', type: '(sel: Set<string>) => void', about: 'Выделение изменилось; зовётся в кадре, пока тянут рамку.' },
  { name: 'onStop', type: '(sel: Set<string>) => void', about: 'Жест завершён — сюда вешают сохранение: один вызов вместо десятков.' },
  {
    name: 'onBeforeStart',
    type: '(ev: PointerEvent) => boolean | void',
    about: 'Вернули false — рамка не начнётся. Так отдают жест ручке драга, кнопке или полю ввода.',
  },
  { name: 'keyAttr', type: 'string', def: 'data-key', about: 'Из какого атрибута брать ключ элемента.' },
  {
    name: 'intersect',
    type: "'touch' | 'cover' | 'center'",
    def: "'touch'",
    about: 'Что считать попаданием: касание рамкой, полное накрытие или накрытый центр.',
  },
  { name: 'threshold', type: 'number', def: '10', about: 'Сколько пикселей пройти до появления рамки — чтобы клик оставался кликом.' },
  { name: 'areaClass', type: 'string', about: 'Класс на прямоугольник рамки.' },
  {
    name: 'style',
    type: 'JSX.CSSProperties',
    about: 'Стили контейнера. Если список прокручивается, overflow вешается сюда — автопрокрутку кит подхватит.',
  },
]

const ICONS = ['🗂️', '🖼️', '🎵', '🎬', '📄', '📦', '🧩', '🗒️']
const files = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `file-${String(i + 1).padStart(3, '0')}`,
    icon: ICONS[i % ICONS.length],
  }))

const SCROLLING = files(100, 's')
const LONG = files(240, 'l')

function Board(props: {
  title: string
  hint: JSX.Element
  items: { id: string; name: string; icon: string }[]
  /** контейнер прокручивается сам; иначе скроллится страница */
  scroll?: boolean
}) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [items, setItems] = createSignal(props.items)

  const removeSelected = () => {
    const kill = selected()
    if (!kill.size) return
    setItems((prev) => prev.filter((f) => !kill.has(f.id)))
    setSelected(new Set())
  }

  return (
    <section class="mb-7">
      <div class="mb-2 flex flex-wrap items-center gap-3 [&_h3]:text-[15px]">
        <h3>{props.title}</h3>
        <span class="text-[13px] text-base-content">{props.hint}</span>
        <span class="ml-auto text-sm">выделено <b>{selected().size}</b> / {items().length}</span>
        <button class="btn btn-sm" onClick={() => setSelected(new Set())} disabled={!selected().size}>
          сбросить
        </button>
        <button class="btn btn-sm btn-error" onClick={removeSelected} disabled={!selected().size}>
          удалить выделенное
        </button>
      </div>

      <SelectionArea
        // Прокрутка вешается на САМ контейнер выделения — иначе рамка не
        // поедет вместе со списком. Классом, а не `classList`: компонент
        // принимает только `class` и `style`, остальное до элемента не дойдёт.
        // `surface-scroll` — метка без стилей, за неё держится смоук-тест.
        class={
          'surface rounded-xl border border-base-300 bg-base-200 p-3' +
          (props.scroll ? ' surface-scroll max-h-[60vh] overflow-x-hidden overflow-y-auto' : '')
        }
        selectables=".card"
        selected={selected}
        onChange={setSelected}
      >
        <div class="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
          <For each={items()}>
            {(f) => (
              <div
                class="card flex cursor-default flex-col items-center gap-1 rounded-box bg-base-100 px-1.5 py-3 ring-1 ring-base-300 transition-colors select-none"
                classList={{ 'bg-primary/15 ring-2 ring-primary': selected().has(f.id) }}
                data-key={f.id}
              >
                <span class="text-[26px]">{f.icon}</span>
                <span class="text-[11px] text-base-content">{f.name}</span>
              </div>
            )}
          </For>
        </div>
      </SelectionArea>
    </section>
  )
}

export default function SelectionAreaExample() {
  return (
    <div class="p-5 text-base-content">
      <p class="mb-4 text-[13px] text-base-content">
        Тяни рамку по пустому месту. <kbd>Shift</kbd>/<kbd>⌘</kbd> — добавить к выделению
        (по уже выделенному рамка не гасит). Клик выделяет один элемент, с модификатором —
        переключает, клик мимо — сбрасывает. Позиции снимаются один раз за жест, в кадре
        только арифметика — ноль reflow даже на сотнях плиток.
      </p>

      <Board
        title="Прокручиваемый контейнер"
        hint={<>у контейнера <code>overflow: auto</code> — скроллится он сам</>}
        items={SCROLLING}
        scroll
      />

      <Board
        title="Длинный грид без overflow"
        hint={<>контейнер не обрезан — скроллится страница, автоскролл ведёт окно</>}
        items={LONG}
      />

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Рамка на списке">
        <p>
          Компонент оборачивает контейнер и ловит указатель, а что выделять — говорит селектор.
          Ключ берётся из <code>data-key</code>, так что в <code>Set</code> приходят те же
          идентификаторы, что и в данных. Выделение хранит потребитель: кит его не дублирует и не
          «теряет» при перерисовке.
        </p>
      </Doc>
      <Code title="Список с рамкой" code={SNIP.basic} />

      <Doc title="Ни одного замера за жест">
        <p>
          Позиции элементов снимаются ОДИН раз на старте — через IntersectionObserver, который
          считает прямоугольники вне главного потока. Дальше в кадре только арифметика: никаких{' '}
          <code>getBoundingClientRect</code> по сотням карточек. Ровно из-за обратного из репы
          выкинут <code>@viselect/vanilla</code>: он мерил каждый элемент на каждое движение.
        </p>
      </Doc>
      <Code title="Режим попадания и порог" code={SNIP.intersect} />

      <Doc title="Когда рамку начинать нельзя">
        <p>
          В одном контейнере часто живут и рамка, и драг, и кнопки. <code>onBeforeStart</code>{' '}
          решает спор: вернули <code>false</code> — жест не стартует и событие достаётся тому, кто
          под курсором. А <code>onStop</code> отделяет «пока тянут» от «дотянули»: сохранять надо
          во втором, иначе на каждый кадр уедет запрос.
        </p>
      </Doc>
      <Code title="Отдать жест ручке и сохранить в конце" code={SNIP.guard} />

      <Doc title="Своя разметка: обёртка и движок">
        <p>
          Компонент — тонкий слой над <code>createSelectionArea</code>: если контейнер чужой
          (виртуальный список, готовая таблица), берётся обёртка — она вешает отписки на{' '}
          <code>onCleanup</code>. Ниже неё лежит <code>createSelectionEngine</code>, который про
          Solid не знает вовсе и возвращает <code>destroy()</code>.
        </p>
      </Doc>
      <Code title="Без компонента" code={SNIP.engine} />

      <h4 class="mt-6 text-lg font-semibold">SelectionArea</h4>
      <Props rows={AREA_PROPS} />
    </div>
  )
}
