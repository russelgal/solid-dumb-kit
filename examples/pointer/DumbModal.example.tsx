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
import { Bar, Btn, Check, Note } from '../_controls'

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

      <DumbToaster />
    </div>
  )
}
