// DumbContextMenu + DumbToaster — меню по правому клику и сообщения.
//
// Оба живут в top layer через Popover API. Проверить это можно прямо здесь:
// открой модалку и щёлкни правой кнопкой внутри неё — меню окажется НАД ней, а
// не под, и тост тоже. Со своим `z-index` так не выходит: модалка в top layer
// перекрывает любое число.
import { For, createSignal } from 'solid-js'
import { DumbContextMenu, type MenuItem } from '@solid-dumb-kit/context-menu'
import { DumbToaster, toast } from '@solid-dumb-kit/toast'
import { Bar, Btn, Note } from '../_controls'

const ICONS = {
  open: 'icon-[solar--eye-bold]',
  copy: 'icon-[solar--copy-bold]',
  rename: 'icon-[solar--pen-2-bold]',
  trash: 'icon-[solar--trash-bin-trash-bold]',
}

export default function ContextMenuExample() {
  const [picked, setPicked] = createSignal<string | null>(null)
  const [open, setOpen] = createSignal(false)
  let area: HTMLDivElement | undefined
  let modal!: HTMLDialogElement

  const items = (): Array<MenuItem> => [
    {
      label: picked() ? `Открыть «${picked()}»` : 'Открыть',
      icon: ICONS.open,
      disabled: !picked(),
      run: () => toast.info(`открыли ${picked()}`),
    },
    {
      label: 'Копировать',
      icon: ICONS.copy,
      hint: '⌘C',
      run: () => toast.success('скопировано'),
    },
    { label: 'Переименовать', icon: ICONS.rename, hint: 'F2', disabled: !picked(), run: () => {} },
    { kind: 'separator' },
    {
      label: 'Удалить',
      icon: ICONS.trash,
      hint: 'Del',
      danger: true,
      disabled: !picked(),
      // спрашиваем ПЛАШКОЙ, а не `confirm()`: тот останавливает вкладку
      // целиком — вместе с идущей заливкой — и написать в нём, что именно
      // удаляется, нельзя
      run: async () => {
        // спрашиваем У КУРСОРА: вопрос про эту строку читают здесь же, а не в
        // углу экрана, куда ещё надо перевести взгляд
        const ok = await toast.confirm(`Удалить «${picked()}» безвозвратно?`, {
          yes: 'Удалить',
          danger: true,
          at: 'pointer',
        })
        if (!ok) return
        toast.error(`удалено: ${picked()}`, {
          action: { label: 'Вернуть', run: () => toast.success('возвращено') },
        })
      },
    },
  ]

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbContextMenu — меню там, где щёлкнули</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Место выбирает <b>браузер</b>: в точке клика ставится якорь в пиксель, меню цепляется за
        него (<code>position-anchor</code>), а у края окна разворачивается в другую сторону
        (<code>position-try-fallbacks</code>). Ни одного <code>getBoundingClientRect</code> —
        обычный способ «вставить и измерить» это forced layout ровно в тот момент, когда браузер
        и так занят.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Щёлкни правой кнопкой по карточке — и попробуй у самого низа окна: меню раскроется вверх.
        Стрелки водят по пунктам, Enter выбирает, Esc закрывает. По полю ввода меню НЕ
        перехватывается — там своё, браузерное, с «вставить».
      </p>

      <Bar>
        <Btn onClick={() => toast.info('обычное сообщение')}>Сообщение</Btn>
        <Btn onClick={() => toast.success('получилось')}>Успех</Btn>
        <Btn onClick={() => toast.error('не получилось')}>Ошибка</Btn>
        <Btn onClick={() => { for (let i = 0; i < 3; i++) toast.error('одно и то же') }}>
          Три одинаковых
        </Btn>
        <Btn
          onClick={async () => {
            const ok = await toast.confirm('Отправить отчёт руководителю?', { yes: 'Отправить' })
            toast.info(ok ? 'отправлено' : 'передумали')
          }}
        >
          Вопрос
        </Btn>
        <Btn
          onClick={async () => {
            const ok = await toast.confirm('Тот же вопрос, но у курсора', {
              yes: 'Ага',
              at: 'pointer',
            })
            toast.info(ok ? 'ага' : 'не-а')
          }}
        >
          Вопрос у курсора
        </Btn>
        <Btn
          onClick={() =>
            toast.ask('Файл изменён на диске. Что делать?', [
              { label: 'Перечитать', kind: 'primary', run: () => toast.success('перечитано') },
              { label: 'Оставить моё', run: () => toast.info('оставили') },
              { label: 'Показать разницу', keepOpen: true, run: () => toast.info('разница…') },
            ])
          }
        >
          Три ответа
        </Btn>
        <Btn onClick={() => { setOpen(true); modal.showModal() }}>Открыть модалку</Btn>
        <Note>{picked() ? `выбрано: ${picked()}` : 'правый клик по карточке'}</Note>
      </Bar>

      <div ref={area} class="grid max-w-[92ch] grid-cols-2 gap-3 sm:grid-cols-4">
        <For each={['Отчёт', 'Договор', 'Смета', 'Акт', 'Приказ', 'Заявка', 'Счёт', 'Накладная']}>
          {(name) => (
            <button
              class={`rounded-box border p-4 text-left text-sm ${
                picked() === name ? 'border-primary bg-primary/10' : 'border-base-300'
              }`}
              onClick={() => setPicked(name)}
              onContextMenu={() => setPicked(name)}
            >
              {name}
            </button>
          )}
        </For>
      </div>

      <p class="mt-3 max-w-[92ch] text-sm text-base-content">
        Поле ввода — меню тут браузерное:{' '}
        <input class="input input-sm" value="правый клик сюда" />
      </p>

      <dialog ref={modal} class="modal" onClose={() => setOpen(false)}>
        <div class="modal-box">
          <h4 class="mb-2 font-semibold">Модалка в top layer</h4>
          <p class="mb-3 text-sm">
            Щёлкни правой кнопкой здесь и нажми «Ошибка» — меню и тост окажутся <b>над</b> модалкой.
            Со своим <code>z-index</code> такого не добиться: элемент в top layer перекрывает любое
            число.
          </p>
          <Btn onClick={() => toast.error('поверх модалки')}>Показать ошибку</Btn>
          <div class="modal-action">
            <button class="btn btn-sm" onClick={() => modal.close()}>Закрыть</button>
          </div>
        </div>
      </dialog>

      {/* меню ловит правый клик только внутри своей области */}
      <DumbContextMenu target={() => (open() ? null : area ?? null)} items={items} />
      <DumbToaster />
    </div>
  )
}
