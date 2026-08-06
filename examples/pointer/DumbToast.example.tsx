// DumbToaster — очередь сообщений и вопрос вместо `confirm()`.
//
// Шина живёт в модуле, а не в компоненте: `toast.error(...)` зовётся откуда
// угодно, в том числе из кода, который про разметку не знает. Компонент только
// рисует то, что в очереди, — поэтому в примере кнопки просто зовут шину.
//
// Три вещи, которые видно только вживую:
//
// 1. одинаковые сообщения схлопываются в одно со счётчиком (жми «Ошибка»
//    подряд);
// 2. таймер стоит, пока курсор на плашке, — текст не уезжает из-под чтения;
// 3. вопрос ждёт ответа сколько угодно и не гаснет сам, а спросить можно прямо
//    у курсора (`at: 'pointer'`).
import { createSignal } from 'solid-js'
import { DumbToaster, toast } from '@solid-dumb-kit/toast'
import { Bar, Btn, Note, Pick } from '../_controls'

const CORNERS = [
  { value: 'bottom-right', label: 'снизу справа' },
  { value: 'bottom-center', label: 'снизу по центру' },
  { value: 'top-right', label: 'сверху справа' },
  { value: 'top-center', label: 'сверху по центру' },
  { value: 'top-left', label: 'сверху слева' },
  { value: 'bottom-left', label: 'снизу слева' },
] as const

export default function DumbToastExample() {
  const [at, setAt] = createSignal<(typeof CORNERS)[number]['value']>('bottom-right')
  const [answer, setAnswer] = createSignal<string | null>(null)
  const [files, setFiles] = createSignal(0)

  /** «залить файл»: сообщение с прогрессом заменяется итогом */
  const upload = () => {
    const n = files() + 1
    setFiles(n)
    const id = toast.info(`Файл ${n}: заливается…`, { ttl: 0 })
    setTimeout(() => {
      toast.dismiss(id)
      toast.success(`Файл ${n} залит`)
    }, 1600)
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
      <h3 class="mb-1 text-lg font-semibold">DumbToast — сообщения и вопросы</h3>
      <p class="mb-3 max-w-[92ch] text-sm">
        Плашки лежат в top layer (Popover API), поэтому они над модалками и меню без единого{' '}
        <code>z-index</code>. Ошибка сама не гаснет: её читают и на неё реагируют.
      </p>

      <Bar>
        <Btn onClick={() => toast.info('Просто сообщение')}>Сообщение</Btn>
        <Btn onClick={() => toast.success('Готово')}>Успех</Btn>
        <Btn onClick={() => toast.error('Не залилось: нет места в хранилище')}>Ошибка</Btn>
        <Btn onClick={upload}>Залить файл</Btn>
        <Pick
          label="угол"
          value={at()}
          options={CORNERS.map((c) => ({ value: c.value, label: c.label }))}
          onChange={(v) => setAt(v as (typeof CORNERS)[number]['value'])}
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
        <Btn onClick={() => toast.clear()}>Убрать все</Btn>
        <span class="text-sm">
          последний ответ: <b>{answer() ?? '—'}</b>
        </span>
      </Bar>

      <Note>
        Жми «Ошибка» несколько раз подряд — плашка останется одна, со счётчиком. Двадцать
        неудачных файлов — это одно сообщение, а не двадцать плашек до потолка. Наведи на плашку
        курсор: обратный отсчёт остановится.
      </Note>

      <DumbToaster position={at()} />
    </div>
  )
}
