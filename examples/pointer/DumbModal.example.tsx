// DumbModal — нативный `<dialog>` со всем, что браузер отдаёт даром.
//
// Смотреть тут надо не на разметку, а на три вещи, которых у самодельной
// модалки на `<div>` не бывает бесплатно:
//
// 1. окно в top layer — его не режет `overflow: hidden` предка (проверяется
//    кнопкой «Открыть из обрезанного блока»);
// 2. Tab ходит по кругу внутри окна, Esc закрывает, страница под ним не едет;
// 3. закрытие можно ОСПОРИТЬ — переключатель «есть несохранённое» превращает
//    Esc и клик мимо в вопрос, а не в потерю правки.
import { createSignal } from 'solid-js'
import { DumbModal } from '@solid-dumb-kit/modal'
import { DumbToaster, toast } from '@solid-dumb-kit/toast'
import { Bar, Btn, Check, Code, Doc, Note, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbModal.snippets'

const MODAL_PROPS = [
  { name: 'open', type: '() => boolean', about: 'Открыто ли окно. Состояние держит потребитель — своего у кита нет.' },
  { name: 'onClose', type: '() => void', about: 'Закрыли: крестиком, Esc, кликом по подложке или кнопкой в футере.' },
  { name: 'title', type: 'JSX.Element', about: 'Шапка. Не задан — шапки нет вовсе.' },
  { name: 'footer', type: 'JSX.Element', about: 'Низ окна: кнопки.' },
  {
    name: 'onBeforeClose',
    type: '() => boolean | Promise<boolean>',
    about: 'Спросить перед закрытием. Вернул false — окно остаётся. Сюда вешают «есть несохранённое».',
  },
  { name: 'keepOnBackdrop', type: 'boolean', def: 'false', about: 'Не закрывать по клику на подложку.' },
  { name: 'keepOnEsc', type: 'boolean', def: 'false', about: 'Не закрывать по Esc.' },
  { name: 'width', type: 'string', def: 'min(560px, 92vw)', about: 'Ширина окна, css.' },
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
    about: 'Появление окна. Не задан — анимируем, но молча выключаемся при prefers-reduced-motion.',
  },
]

const BUS_API = [
  {
    name: 'confirm',
    type: '(text, opts?) => Promise<boolean>',
    about: 'Да или нет. Закрыли не ответив — false. В opts: title, yes, no, danger, width, dismissible.',
  },
  {
    name: 'ask',
    type: '(text, actions, opts?) => Promise<T>',
    about: 'Несколько ответов. Возвращает value нажатой кнопки, при закрытии — opts.dismiss.',
  },
  { name: 'alert', type: '(text, opts?) => Promise<void>', about: 'Сообщение с одной кнопкой — замена alert(), не вешающая вкладку.' },
  { name: 'current / pending', type: '() => ModalQuestion | null / () => number', about: 'Что сейчас на экране и сколько ждёт очереди: вопросы не перебивают друг друга.' },
  { name: 'createModalBus', type: '() => ModalBus', about: 'Своя шина — нужна в тестах и когда областей две.' },
]

export default function DumbModalExample() {
  const [open, setOpen] = createSignal(false)
  const [nested, setNested] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  const [keepOnEsc, setKeepOnEsc] = createSignal(false)
  const [text, setText] = createSignal('')

  /**
   * Спросить перед закрытием. Возвращаем `false` — окно остаётся; вопрос
   * задаётся тостом, а не `confirm()`: тот останавливает вкладку целиком.
   */
  const guard = async () => {
    if (!dirty()) return true
    const ok = await toast.confirm('Правка не сохранена. Закрыть?', {
      yes: 'Закрыть',
      no: 'Остаться',
      danger: true,
    })
    return ok
  }

  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">DumbModal — модалка, которой не надо z-index</h3>
      <p class="mb-3 max-w-[92ch] text-sm">
        Ловушку фокуса, <code>Esc</code>, подложку и запрет прокрутки делает сам{' '}
        <code>&lt;dialog&gt;</code>. Своими руками дописаны ровно три вещи: возврат фокуса туда,
        откуда пришли, клик по подложке и защита от закрытия с несохранённым.
      </p>

      <Bar>
        <Btn onClick={() => setOpen(true)}>Открыть окно</Btn>
        <Check checked={dirty()} onChange={setDirty}>
          есть несохранённое
        </Check>
        <Check checked={keepOnEsc()} onChange={setKeepOnEsc}>
          не закрывать по Esc
        </Check>
      </Bar>

      {/* Блок с обрезкой: кнопка внутри открывает то же окно, и оно всё равно
          показывается целиком. Модалка на div'е здесь была бы срезана. */}
      <div class="mb-3 h-24 max-w-md overflow-hidden rounded-box border border-base-300 p-3">
        <p class="mb-2 text-sm">
          У этого блока <code>overflow: hidden</code> и высота 96px.
        </p>
        <Btn onClick={() => setOpen(true)}>Открыть из обрезанного блока</Btn>
      </div>

      <Note>
        Окно в top layer: его не режет ни <code>overflow</code>, ни <code>clip-path</code>, и оно
        всегда над тостами и меню — не потому что у него больше <code>z-index</code>, а потому что
        top layer вообще вне этой иерархии.
      </Note>

      <DumbModal
        open={open}
        onClose={() => setOpen(false)}
        onBeforeClose={guard}
        keepOnEsc={keepOnEsc()}
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
                toast.success('сохранено')
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
          <p class="text-sm">
            Tab внутри окна ходит по кругу: до кнопок внизу и обратно, наружу не убегает.
          </p>
          <Btn onClick={() => setNested(true)}>Открыть окно поверх этого</Btn>
        </div>
      </DumbModal>

      {/* Вложенная модалка: top layer — это стопка, верхний всегда последний
          открытый, и порядок задаётся им, а не числами в CSS. */}
      <DumbModal open={nested} onClose={() => setNested(false)} title={<b>Второе окно</b>} width="min(380px, 92vw)">
        <p class="text-sm">
          Оно поверх первого, потому что открыто позже. Esc закроет сначала его, потом первое.
        </p>
      </DumbModal>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Окно">
        <p>
          Состояние держит потребитель: <code>open</code> — функция, <code>onClose</code> —
          обратный вызов. Внутри нативный <code>&lt;dialog&gt;</code>, поэтому ловушка фокуса,{' '}
          <code>Esc</code>, подложка и запрет прокрутки достаются даром. Своими руками дописаны
          ровно три вещи: возврат фокуса туда, откуда пришли, закрытие по клику мимо и защита от
          потери правки.
        </p>
      </Doc>
      <Code title="Окно с футером" code={SNIP.basic} />

      <Doc title="Оспорить закрытие">
        <p>
          Браузер закрывает по <code>Esc</code> молча — вместе с несохранённым.{' '}
          <code>onBeforeClose</code> получает право сказать «нет»: вернул <code>false</code> —
          окно осталось. Годится и синхронная проверка, и обещание, поэтому вопрос можно задать
          прямо оттуда.
        </p>
      </Doc>
      <Code title="Защита от потери правки" code={SNIP.guard} />

      <Doc title="Вопрос окном: DumbModalHost и шина">
        <p>
          <code>confirm()</code> из браузера останавливает вкладку целиком и не даёт написать, что
          именно случится. <code>modal.confirm</code> — то же по смыслу, но окном и обещанием.{' '}
          <code>DumbModalHost</code> ставится ОДИН раз рядом с корнем приложения, а спрашивать
          можно откуда угодно: шина живёт в модуле и про разметку не знает. Вопросы идут очередью
          и не перебивают друг друга.
        </p>
      </Doc>
      <Code title="Хост и вопрос" code={SNIP.host} />

      <Doc title="Больше двух ответов">
        <p>
          <code>modal.ask</code> отдаёт произвольные кнопки и возвращает значение нажатой. Если у
          вопроса нет безопасного умолчания — <code>dismissible: false</code>, и закрыть, не
          ответив, нельзя. <code>modal.alert</code> — сообщение с одной кнопкой.
        </p>
      </Doc>
      <Code title="ask, alert и неизбежный вопрос" code={SNIP.ask} />

      <Doc title="Почему не нужен z-index">
        <p>
          Top layer — это стопка вне обычной иерархии: верхним всегда оказывается последний
          открытый. Поэтому вложенное окно ложится над родителем, тост — над обоими, а{' '}
          <code>overflow: hidden</code> у предка ничего не режет. Числа в CSS тут не участвуют
          вовсе, спорить не с чем.
        </p>
      </Doc>
      <Code title="Окно поверх окна" code={SNIP.layer} />

      <h4 class="mt-6 text-lg font-semibold">DumbModal</h4>
      <Props rows={MODAL_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">modal — шина вопросов</h4>
      <Props rows={BUS_API} />

      <DumbToaster />
    </div>
  )
}
