// Место, где показываются вопросы из шины `modal`.
//
// Ставится ОДИН раз рядом с корнем приложения — как тостер. Дальше любой код
// зовёт `modal.confirm('…')` и получает обещание, не зная ни про разметку, ни
// про то, куда её монтировать.
//
// Само окно рисует `DumbModal`, поэтому всё его поведение здесь бесплатно:
// top layer, ловушка фокуса, возврат фокуса назад, Esc и клик по подложке.

import { For, createSignal, onCleanup } from 'solid-js'
import { onMounted } from '@solid-dumb-kit/shared'
import { DumbModal } from './DumbModal'
import { modal as globalBus, type ModalBus } from './modalBus'

export type DumbModalHostProps = {
  /** своя шина; не задана — общая */
  bus?: ModalBus
  class?: string
}

/** класс кнопки: главное действие заметно, опасное красное */
const actionClass = (kind?: string) =>
  kind === 'primary' ? 'btn btn-sm btn-neutral' : kind === 'danger' ? 'btn btn-sm btn-error' : 'btn btn-sm'

export function DumbModalHost(props: DumbModalHostProps) {
  const bus = () => props.bus ?? globalBus
  // шина живёт вне реактивности — «будильник» и есть мост до разметки
  const [tick, bump] = createSignal(0, { equals: false })

  onMounted(() => {
    const off = bus().subscribe(() => bump(0))
    onCleanup(off)
  })

  const cur = () => (tick(), bus().current())

  /**
   * Окно ОДНО и живёт всегда, а меняется только то, что в нём написано.
   *
   * Соблазн был обернуть его в `<Show>` и пересоздавать на каждый вопрос — но
   * тогда `DumbModal` читает пропсы уже после того, как `Show` убрал значение,
   * и Solid справедливо ругается на «stale value». Заодно два вопроса подряд
   * теперь не моргают: второй просто заменяет текст в открытом окне.
   */
  const ask = () => cur()
  const answer = (value: unknown) => {
    const q = ask()
    if (q) bus().answer(q.id, value)
  }

  return (
    <DumbModal
      open={() => ask() !== null}
      onClose={() => {
        const q = ask()
        if (q) bus().dismiss(q.id)
      }}
      title={ask()?.title}
      width={ask()?.width}
      // вопрос без безопасного умолчания закрыть молча нельзя: ответ на него —
      // осознанное нажатие, а не Esc наугад
      keepOnEsc={ask() ? !ask()!.dismissible : false}
      keepOnBackdrop={ask() ? !ask()!.dismissible : false}
      class={props.class}
      footer={
        <div class="flex flex-wrap justify-end gap-2">
          <For each={ask()?.actions ?? []}>
            {(a) => (
              <button
                type="button"
                class={actionClass(a.kind)}
                data-kind={a.kind}
                onClick={() => answer(a.value)}
              >
                {a.label}
              </button>
            )}
          </For>
        </div>
      }
    >
      <p class="dumb-modal-ask text-sm">{ask()?.text}</p>
    </DumbModal>
  )
}
