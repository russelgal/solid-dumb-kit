// DumbToaster — очередь сообщений и вопрос вместо `confirm()`.
//
// Шина живёт в модуле, а не в компоненте: `toast.error(...)` зовётся откуда
// угодно, в том числе из кода, который про разметку не знает. Компонент только
// рисует то, что в очереди, — поэтому в примере кнопки просто зовут шину.
//
// Четыре вещи, которые видно только вживую:
//
// 1. погасшая плашка не пропадает, а улетает к краю — в центр уведомлений, как
//    в macOS: открой колокольчик и прочитай пропущенное;
// 2. таймер стоит, пока курсор на плашке, — текст не уезжает из-под чтения;
// 3. вопрос ждёт ответа сколько угодно и не гаснет сам, а спросить можно прямо
//    у курсора (`at: 'pointer'`);
// 4. плашки и модалка живут в одном top layer, и порядок в нём решает не
//    `z-index`, а очерёдность открытия — поэтому тост, вызванный ИЗ окна,
//    ложится поверх окна, а вопрос перед закрытием заменяет `confirm()`,
//    который вешает вкладку целиком. Ради этого `DumbModal` и приехал в этот
//    пример: врозь пара не показывает главного.
import { createSignal } from 'solid-js'
import { DumbModal, DumbModalHost, modal } from '@solid-dumb-kit/modal'
import { DumbToaster, DumbToastCenter, toast } from '@solid-dumb-kit/toast'
import { Bar, Btn, Check, Code, Doc, Note, Pick, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbToast.snippets'

const CORNERS = [
  { value: 'bottom-right', label: 'снизу справа' },
  { value: 'bottom-center', label: 'снизу по центру' },
  { value: 'top-right', label: 'сверху справа' },
  { value: 'top-center', label: 'сверху по центру' },
  { value: 'top-left', label: 'сверху слева' },
  { value: 'bottom-left', label: 'снизу слева' },
] as const

/** сколько плашек держать на экране разом */
const LIMITS = ['3', '6', '10'] as const

const TOASTER_PROPS = [
  {
    name: 'position',
    type: "'bottom-right' | 'top-right' | 'bottom-left' | …",
    def: "'bottom-right'",
    about: 'Угол, в котором собирается стопка. В ту же сторону плашки и улетают.',
  },
  { name: 'max', type: 'number', def: '6', about: 'Сколько показывать разом; остальные ждут очереди.' },
  {
    name: 'closeSide',
    type: "'auto' | 'left' | 'right'",
    def: "'auto'",
    about: 'Где крестик. По умолчанию по платформе: в macOS слева, в Windows и Linux справа.',
  },
  {
    name: 'animate',
    type: 'boolean',
    def: 'системная настройка',
    about: 'Въезд, улёт и доводка соседей. Не задан — анимируем, но молча выключаемся при prefers-reduced-motion.',
  },
  { name: 'bus', type: 'ToastBus', def: 'общая', about: 'Своя шина — нужна в тестах и когда областей две.' },
  {
    name: 'children',
    type: '(t, dismiss) => JSX.Element',
    about: 'Своя плашка вместо готовой карточки.',
  },
]

const CENTER_PROPS = [
  { name: 'side', type: "'right' | 'left'", def: "'right'", about: 'У какого края висит панель.' },
  { name: 'bell', type: 'boolean', def: 'true', about: 'Кнопка-колокольчик со счётчиком непрочитанных.' },
  { name: 'title', type: 'string', def: "'Уведомления'", about: 'Заголовок панели.' },
  {
    name: 'closeSide',
    type: "'auto' | 'left' | 'right'",
    def: "'auto'",
    about: 'Сторона крестиков — по той же платформенной привычке, что у тостера.',
  },
  { name: 'animate', type: 'boolean', def: 'системная настройка', about: 'Выезд панели.' },
  {
    name: 'children',
    type: '(t, forget) => JSX.Element',
    about: 'Своя строка истории.',
  },
]

const BUS_API = [
  { name: 'info / success / error', type: '(text, opts?) => number', about: 'Показать сообщение, вернуть его id.' },
  { name: 'confirm', type: '(text, opts?) => Promise<boolean>', about: 'Вопрос «да/нет»; закрыли молча — false.' },
  { name: 'ask', type: '(text, actions, opts?) => number', about: 'Вопрос с несколькими ответами.' },
  { name: 'dismiss / clear', type: '(id) => void / () => void', about: 'Убрать одну плашку или все; обе уедут в историю.' },
  { name: 'history / unread', type: '() => Toast[] / () => number', about: 'Прочитанное и счётчик непрочитанного.' },
  { name: 'forget / clearHistory', type: '(id) => void / () => void', about: 'Убрать запись истории или очистить её.' },
  { name: 'toggleHistory', type: '() => void', about: 'Открыть или закрыть панель — из любого места приложения.' },
  { name: 'pause / resume', type: '() => void', about: 'Остановить таймеры: тостер сам делает это под курсором.' },
]

export default function DumbToastExample() {
  const [at, setAt] = createSignal<(typeof CORNERS)[number]['value']>('bottom-right')
  const [max, setMax] = createSignal(6)
  const [answer, setAnswer] = createSignal<string | null>(null)
  const [files, setFiles] = createSignal(0)

  // модалка: открыта, есть ли несохранённое и что напечатали
  const [open, setOpen] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  const [text, setText] = createSignal('')

  /**
   * Спросить перед закрытием. Возвращаем `false` — окно остаётся.
   *
   * Спрашивает ВЛОЖЕННОЕ ОКНО, а не тост. Плашка в углу — это уведомление:
   * прочитал и пошёл дальше. А тут работа встала и без ответа не продолжится,
   * причём ответ про то самое окно, что на экране, — значит и спрашивать надо
   * поверх него, а не в другом конце экрана. Top layer это даёт даром: второй
   * `<dialog>` ложится выше первого без единого `z-index`.
   *
   * Тост-вопрос остаётся там, где он к месту: «удалить ЭТУ строку?» у курсора
   * в списке, где ничего не открыто и работа не встала.
   */
  const guard = () => {
    if (!dirty()) return true
    return modal.confirm('Комментарий к брони №1042 не сохранён. Закрыть окно и потерять правку?', {
      title: 'Правка не сохранена',
      yes: 'Закрыть без сохранения',
      no: 'Остаться',
      danger: true,
      width: '420px',
    })
  }

  /** «залить файл»: сообщение с прогрессом заменяется итогом */
  const upload = () => {
    const n = files() + 1
    setFiles(n)
    const id = toast.info('заливается…', { title: `Файл ${n}`, ttl: 0 })
    setTimeout(() => {
      toast.dismiss(id)
      toast.success('готово', { title: `Файл ${n}` })
    }, 1600)
  }

  /** плашка со случайным сроком жизни: от полутора до девяти секунд */
  const randomTtl = () => {
    const ttl = 1500 + Math.round(Math.random() * 7500)
    const kinds = ['info', 'success'] as const
    const kind = kinds[Math.random() < 0.5 ? 0 : 1]
    toast[kind](`гаснет через ${(ttl / 1000).toFixed(1)} с`, {
      title: 'Случайный срок',
      ttl,
    })
  }

  const askAtPointer = async () => {
    // вопрос про конкретную строку удобнее читать рядом с ней, а не в углу
    const ok = await toast.confirm('Удалить эту строку?', {
      yes: 'Удалить',
      no: 'Оставить',
      danger: true,
      at: 'pointer',
    })
    setAnswer(ok ? 'удалили' : 'оставили')
  }

  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">DumbToast и DumbModal — сообщения, вопросы, окно</h3>
      <p class="mb-3 max-w-[92ch] text-sm">
        Плашки лежат в top layer (Popover API), окно — там же (<code>&lt;dialog&gt;</code>), поэтому
        они уживаются без единого <code>z-index</code>. Ошибка сама не гаснет: её читают и на неё
        реагируют.
      </p>

      <Bar>
        {/* заголовок и значок — как в системных уведомлениях: «что случилось»
            видно раньше подробностей. Иконки iconify даёт витрина: своих кит
            не несёт */}
        <Btn
          onClick={() =>
            toast.info('Договор №14 подписан обеими сторонами', {
              title: 'Документооборот',
              icon: 'icon-[solar--document-text-bold]',
            })
          }
        >
          Сообщение
        </Btn>
        <Btn onClick={() => toast.success('Готово', { title: 'Смета сохранена' })}>Успех</Btn>
        <Btn
          onClick={() =>
            toast.error('Не залилось: нет места в хранилище', {
              title: 'Заливка',
              icon: 'icon-[solar--cloud-upload-bold]',
            })
          }
        >
          Ошибка
        </Btn>
        <Btn onClick={upload}>Залить файл</Btn>
        {/* разный срок жизни: плашки гаснут вразнобой — так видно, что соседи
            не прыгают на освободившееся место, а доезжают до него */}
        <Btn onClick={randomTtl}>Случайный срок</Btn>
        <Pick
          label="угол"
          value={at()}
          options={CORNERS.map((c) => ({ value: c.value, label: c.label }))}
          onChange={(v) => setAt(v as (typeof CORNERS)[number]['value'])}
        />
        <Pick
          label="сразу на экране"
          value={String(max())}
          options={LIMITS.map((n) => ({ value: n, label: n }))}
          onChange={(v) => setMax(Number(v))}
        />
      </Bar>

      <Bar>
        <Btn
          onClick={() =>
            toast.info('Файл удалён', {
              ttl: 8000,
              action: { label: 'Вернуть', kind: 'primary', run: () => toast.success('вернули') },
            })
          }
        >
          С кнопкой «Вернуть»
        </Btn>
        <Btn onClick={askAtPointer}>Спросить у курсора</Btn>
        {/* тот же вопрос, но окном: работа встала, ответ обязателен */}
        <Btn
          onClick={async () => {
            const ok = await modal.confirm('Удалить бронь №1042 безвозвратно?', {
              title: 'Удаление',
              yes: 'Удалить',
              no: 'Отмена',
              danger: true,
            })
            setAnswer(ok ? 'удалили окном' : 'отменили окном')
          }}
        >
          Спросить окном
        </Btn>
        <Btn onClick={() => toast.clear()}>Убрать все</Btn>
        <Btn onClick={() => toast.toggleHistory()}>История</Btn>
        <span class="text-sm">
          последний ответ: <b>{answer() ?? '—'}</b>
        </span>
      </Bar>

      <Bar>
        <Btn onClick={() => setOpen(true)}>Открыть модалку</Btn>
        <Check checked={dirty()} onChange={setDirty}>
          есть несохранённое
        </Check>
      </Bar>

      {/* `Note` — инлайновый span, поэтому два подряд склеились бы в одну
          простыню: каждый заворачиваем в свой блок. */}
      <div class="mb-3">
        <Note>
          Жми «Ошибка» несколько раз подряд — плашек будет столько же, сколько нажатий: повторы не
        схлопываются, каждое сообщение попадает в историю своей строкой. Погасшая плашка улетает к
        краю, в центр уведомлений, — колокольчик справа сверху, там же счётчик непрочитанных.
        Наведи на плашку курсор: обратный отсчёт остановится, а на углу появится крестик. Закрыть
          можно и не целясь в него — смахни плашку вбок, как на телефоне.
        </Note>
      </div>

      <div class="mb-3">
        <Note>
          Открой модалку и позови из неё плашку: она ляжет ПОВЕРХ окна, хотя <code>z-index</code>{' '}
          не трогали ни там, ни там — в top layer порядок задаёт очерёдность открытия. Включи «есть
          несохранённое» и попробуй закрыть окно по <code>Esc</code> или кликом мимо: вместо потери
          правки придёт вопрос, и окно дождётся ответа.
        </Note>
      </div>

      <DumbModal
        open={open}
        onClose={() => setOpen(false)}
        onBeforeClose={guard}
        title={<b>Бронь №1042</b>}
        footer={
          <div class="flex justify-end gap-2">
            <button class="btn btn-sm" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button
              class="btn btn-sm btn-neutral"
              onClick={() => {
                setDirty(false)
                setOpen(false)
                toast.success('сохранено', { title: 'Бронь №1042' })
              }}
            >
              Сохранить
            </button>
          </div>
        }
      >
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 text-sm">
            Комментарий
            <input
              class="input input-sm"
              value={text()}
              placeholder="печатай — и попробуй закрыть по Esc"
              onInput={(e) => {
                setText(e.currentTarget.value)
                setDirty(true)
              }}
            />
          </label>
          <Bar>
            <Btn
              onClick={() =>
                toast.info('Плашка поверх открытого окна', {
                  title: 'Top layer',
                  icon: 'icon-[solar--layers-bold]',
                })
              }
            >
              Тост из окна
            </Btn>
          </Bar>
        </div>
      </DumbModal>


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Два компонента и шина">
        <p>
          <code>DumbToaster</code> рисует всплывающие плашки, <code>DumbToastCenter</code> —
          панель истории с колокольчиком. Оба ставятся ОДИН раз на приложение, обычно рядом с
          корнем. Сообщения кладутся в шину <code>toast</code>, которая живёт в модуле: звать её
          можно откуда угодно, в том числе из кода, который про разметку не знает.
        </p>
      </Doc>
      <Code title="Корень приложения" code={SNIP.mount} />

      <Doc title="Сообщения">
        <p>
          Три вида: <code>info</code>, <code>success</code>, <code>error</code>. Ошибка сама не
          гаснет (<code>ttl: 0</code>) — её читают и на неё реагируют. Заголовок и значок
          необязательны, но с ними «что случилось» видно раньше подробностей. Иконки кит не несёт:
          класс приходит от потребителя, любой — iconify, свой шрифт, что угодно.
        </p>
      </Doc>
      <Code title="Показать сообщение" code={SNIP.say} />

      <Doc title="Вопрос вместо confirm()">
        <p>
          <code>confirm()</code> останавливает вкладку целиком — вместе с идущей заливкой, — и
          написать в нём, что именно случится, нельзя. <code>toast.confirm</code> ничего не
          останавливает и возвращает обещание. Закрыли, не ответив (крестик, <code>Esc</code>, клик
          мимо) — это <code>false</code>, так что <code>await</code> не повиснет.
        </p>
      </Doc>
      <Code title="Спросить" code={SNIP.ask} />

      <Doc title="А когда вопрос задаёт ОКНО">
        <p>
          <code>toast.confirm</code> — для случая, когда работа продолжается: спросили про строку в
          списке, ответили, пошли дальше. Если же работа встала и ответ обязателен — закрыть окно с
          несохранённым, стереть данные, уйти со страницы, — спрашивать надо модально, поверх того,
          о чём спрашивают. Это <code>modal.confirm</code> из{' '}
          <code>@solid-dumb-kit/modal</code>: та же сигнатура, но окном. Вопросы идут очередью, а
          не перебивают друг друга, и в top layer окно-вопрос само ложится выше окна, из которого
          его позвали.
        </p>
      </Doc>
      <Code title="Вопрос окном" code={SNIP.modalAsk} />

      <Doc title="История: центр уведомлений">
        <p>
          Погасшая плашка не пропадает, а улетает в панель у края — как в macOS. Панель и её
          колокольчик живут в top layer (Popover API), поэтому они над модалками без единого{' '}
          <code>z-index</code>. Открыть можно и своей кнопкой, а колокольчик выключить.
        </p>
      </Doc>
      <Code title="Своя кнопка вместо колокольчика" code={SNIP.history} />

      <Doc title="Своя плашка">
        <p>
          Если готовая карточка не подходит, <code>children</code> отдаёт разметку целиком: кит
          оставляет за собой очередь, таймеры, стопку и улёт в историю.
        </p>
      </Doc>
      <Code title="children" code={SNIP.custom} />

      <h4 class="mt-6 text-lg font-semibold">DumbToaster</h4>
      <Props rows={TOASTER_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumbToastCenter</h4>
      <Props rows={CENTER_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">Шина toast</h4>
      <Props title="Метод" rows={BUS_API} />

      {/* Вопросы из шины modal рисуются здесь — один раз на приложение, как
          тостер. В top layer окно-вопрос ложится выше окна, из которого его
          позвали: порядок задаёт очерёдность открытия, а не z-index. */}
      <DumbModalHost />

      <DumbToaster position={at()} max={max()} />
      {/* центр уведомлений — панель в top layer у того же края */}
      <DumbToastCenter />
    </div>
  )
}
