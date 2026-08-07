// DumbPropsTable — что на самом деле пришло в пропсах.
//
// Отладочный инструмент, а не часть интерфейса. Нужен ровно тогда, когда
// компонент «не работает», а почему — непонятно: проп не пришёл, пришёл
// undefined, пришёл не тот, или пришла функция, которую никто не вызвал.
//
// Привычный способ посмотреть — `JSON.stringify(props)` — для этого не годится:
// он МОЛЧА выбрасывает функции и `undefined`. У компонентов кита почти всё
// поведение и есть функции (`onOpen`, `dayClass`, `spanClass`), и в дампе их
// просто нет — выглядит это как «проп не пришёл», хотя пришёл.
//
// Справа на этой вкладке — тот же объект глазами `JSON.stringify`. Разница
// между колонками и есть причина, по которой пакет существует.
import { createSignal, For } from 'solid-js'
import { DumbPropsTable, dumpProps } from '@solid-dumb-kit/props-table'
import { Bar, Btn, Check, Note, Pick, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbPropsTable.snippets'

const PT_PROPS = [
  { name: 'value', type: 'object', about: 'Объект пропсов — или любой другой.' },
  { name: 'title', type: 'string', about: 'Заголовок над таблицей.' },
  { name: 'depth', type: 'number', def: '1', about: 'Насколько глубоко разворачивать вложенные объекты; 0 — не разворачивать.' },
  { name: 'maxItems', type: 'number', def: '8', about: 'Сколько элементов массива показывать; остальные схлопываются в «…».' },
  { name: 'skip', type: 'string[]', about: 'Не раскрывать эти ключи верхнего уровня: rows, spans — там тысячи строк.' },
  { name: 'indent', type: 'number', about: 'Отступ на уровень вложенности, px.' },
  { name: 'headless', type: 'boolean', def: 'false', about: 'Без шапки: в узкой панели она только занимает строку.' },
  { name: 'class', type: 'string', about: 'Класс на корень — оформление на отладочной панели должно быть ваше.' },
]

const DUMP_ROW = [
  { name: 'key / path', type: 'string', about: 'Ключ на своём уровне и полный путь от корня: scale.stepMin.' },
  { name: 'depth', type: 'number', about: 'Глубина вложенности, 0 — верхний уровень.' },
  { name: 'type', type: 'string', about: 'typeof значения.' },
  { name: 'kind', type: 'DumpKind', about: 'object | array | function | primitive — по нему панель и красит строку.' },
  { name: 'value', type: 'string', about: 'Короткое человекочитаемое представление.' },
  { name: 'raw', type: 'unknown', about: 'Сырое значение — вдруг вызывающему нужно больше.' },
]

/** игрушечные пропсы: всё, что обычно и приходит компоненту */
const build = (opts: { rows: number; readonly: boolean; theme: string; withHandler: boolean }) => ({
  title: 'Шахматка на август',
  readonly: opts.readonly,
  // вложенный объект — в нём чаще всего и кроется причина
  scale: { first: '2026-08-01', days: 30, stepMin: 1440, colW: 34, checkIn: 960, checkOut: 720 },
  style: { 'max-height': '54vh', theme: opts.theme },
  rows: Array.from({ length: opts.rows }, (_, i) => ({ id: `r${i}`, title: `Номер ${101 + i}` })),
  spans: Array.from({ length: opts.rows * 3 }, (_, i) => ({ id: `s${i}`, row: `r${i % 3}` })),
  // функции: их-то JSON и теряет
  onOpen: function onOpen(span: unknown, at: unknown) { return [span, at] },
  dayClass: (at: string) => (at.endsWith('6') ? 'weekend' : ''),
  onChange: opts.withHandler ? function onChange(next: unknown) { return next } : undefined,
  // пустое место — тоже ответ: проп есть, значения нет
  summary: undefined,
  now: null,
})

export default function DumbPropsTableExample() {
  const [rows, setRows] = createSignal(3)
  const [readonly, setReadonly] = createSignal(false)
  const [theme, setTheme] = createSignal('nord')
  const [withHandler, setWithHandler] = createSignal(true)
  const [depth, setDepth] = createSignal(1)
  const [skipBig, setSkipBig] = createSignal(true)

  const props = () => build({ rows: rows(), readonly: readonly(), theme: theme(), withHandler: withHandler() })

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbPropsTable — что пришло в пропсах</h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Имя, тип и значение — <b>всё</b>, включая функции и <code>undefined</code>. Вложенные
        объекты разворачиваются и идут первыми, массивы показываются первыми элементами и
        счётчиком: дамп двух тысяч броней никому не нужен. Разметка голая (
        <code>table &gt; thead/tbody</code>), поэтому <code>table table-xs</code> из daisyUI ложится
        на неё без обёрток — как здесь.
      </p>

      <Bar>
        <Pick
          label="строк в массиве"
          value={rows()}
          options={[3, 10, 200].map((n) => ({ value: n }))}
          onChange={(v) => setRows(Number(v))}
        />
        <Pick
          label="глубина"
          value={depth()}
          options={[0, 1, 2].map((n) => ({ value: n }))}
          onChange={(v) => setDepth(Number(v))}
        />
        <Check checked={readonly()} onChange={setReadonly}>readonly</Check>
        <Check checked={withHandler()} onChange={setWithHandler}>onChange задан</Check>
        <Check checked={skipBig()} onChange={setSkipBig}>не разворачивать rows и spans</Check>
        <Btn onClick={() => console.table(dumpProps(props(), { depth: depth() }))}>
          В консоль таблицей
        </Btn>
        <Note>тема: {theme()}</Note>
      </Bar>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-box border border-base-300 p-3">
          <DumbPropsTable
            class="overflow-x-auto"
            title="DumbPropsTable"
            value={props()}
            depth={depth()}
            maxItems={4}
            skip={skipBig() ? ['rows', 'spans'] : []}
          />
        </div>

        {/* Тот же объект, но через JSON: колонка существует ради сравнения */}
        <div class="rounded-box border border-base-300 p-3">
          <div class="mb-1 font-bold">JSON.stringify — для сравнения</div>
          <pre class="overflow-x-auto text-xs leading-relaxed">
            {JSON.stringify(props(), null, 2)}
          </pre>
        </div>
      </div>

      <p class="mt-3 max-w-[92ch] text-sm text-base-content">
        Сравни колонки: справа нет <code>onOpen</code>, <code>dayClass</code>,{' '}
        <code>summary</code> и — когда галочка снята — <code>onChange</code>. Слева видно и их, и
        чем они отличаются: <code>ƒ onOpen(2)</code> — функция двух аргументов,{' '}
        <code>undefined</code> — проп есть, значения нет. Ровно этой разницы обычно и не хватает,
        когда ищешь, почему обработчик «не вызывается».
      </p>

      <p class="mt-2 max-w-[92ch] text-sm text-base-content">
        Разбор живёт отдельно от разметки: <code>dumpProps(props)</code> — обычная функция без
        Solid, годится и в тесте, и в логе. Кнопка выше кладёт её результат в{' '}
        <code>console.table</code>.
      </p>

      <div class="mt-4">
        <div class="mb-1 text-sm font-semibold">Виды значений</div>
        <div class="flex flex-wrap gap-3 text-sm">
          <For
            each={[
              ['объект', '#6d28d9', 'разворачивается, идёт первым'],
              ['массив', '#0e7490', 'первые элементы и счётчик'],
              ['функция', '#9a3412', 'имя и число аргументов'],
              ['простое', 'inherit', 'как есть'],
            ] as const}
          >
            {([kind, color, hint]) => (
              <span class="inline-flex items-center gap-1.5">
                <b style={{ color }}>{kind}</b>
                <span class="text-base-content">— {hint}</span>
              </span>
            )}
          </For>
        </div>
      </div>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Что пришло в компонент">
        <p>
          Показывается ВСЁ, включая функции: половина отладки — это выяснить, что проп вообще не
          доехал или доехал не тем. Ключи читаются с самого объекта, а Solid объявляет пропсы
          перечислимыми геттерами, так что панель видит их без всяких обёрток.
        </p>
      </Doc>
      <Code title="Панель в компоненте" code={SNIP.basic} />

      <Doc title="Что показывать">
        <p>
          Вложенные объекты разворачиваются и идут ПЕРВЫМИ: в них обычно и кроется причина «почему
          не работает». Массивы схлопываются до первых элементов и счётчика — дамп двух тысяч броней
          никому не нужен, а тяжёлые ключи проще пропустить целиком.
        </p>
      </Doc>
      <Code title="Глубина и пропуски" code={SNIP.options} />

      <Doc title="Без разметки">
        <p>
          Тот же разбор доступен функцией — она не зависит от Solid и годится в тестах и в логе:{' '}
          <code>console.table(dumpProps(props))</code> читается заметно лучше, чем развёрнутый
          объект в консоли.
        </p>
      </Doc>
      <Code title="dumpProps" code={SNIP.dump} />

      <h4 class="mt-6 text-lg font-semibold">DumbPropsTable</h4>
      <Props rows={PT_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumpRow</h4>
      <Props rows={DUMP_ROW} />

    </div>
  )
}
