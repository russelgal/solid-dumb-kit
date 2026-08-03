// DumbTree — дерево: вложенные узлы, ленивая подгрузка ветки, поиск, выбор.
//
// Показаны оба способа кормления. Слева дерево знает всё сразу (`roots`), справа
// не знает ничего: ветка тянется `loadChildren` в момент раскрытия — так
// открывается каталог на десять тысяч узлов, из которого читают три.
//
// Значки — Solar через iconify, КЛАССАМИ: своих иконок кит не несёт.
import { createSignal, For } from 'solid-js'
import { DumbTree, type TreeNode } from '@solid-dumb-kit/tree'
import { Bar, Check, Note } from '../_controls'

const icons = {
  twist: 'icon-[solar--alt-arrow-right-outline]',
  folder: 'icon-[solar--folder-bold] text-sky-600',
  folderOpen: 'icon-[solar--folder-open-bold] text-sky-600',
  leaf: 'icon-[solar--document-text-outline] text-slate-500',
}

/** дерево целиком: так его отдаёт обычный ответ сервера — уже вложенным */
const ROOTS: Array<TreeNode> = [
  {
    id: 'catalog',
    label: 'Каталог',
    isFolder: true,
    badge: 128,
    children: [
      {
        id: 'kitchen',
        label: 'Кухни',
        isFolder: true,
        badge: 64,
        children: [
          { id: 'kitchen-corner', label: 'Угловые', badge: 21 },
          { id: 'kitchen-straight', label: 'Прямые', badge: 43 },
        ],
      },
      {
        id: 'closet',
        label: 'Шкафы',
        isFolder: true,
        badge: 64,
        children: [
          { id: 'closet-coupe', label: 'Купе', badge: 30 },
          { id: 'closet-swing', label: 'Распашные', badge: 34 },
        ],
      },
    ],
  },
  {
    id: 'pages',
    label: 'Страницы',
    isFolder: true,
    badge: 3,
    children: [
      { id: 'about', label: 'О компании' },
      { id: 'delivery', label: 'Доставка и оплата' },
      { id: 'contacts', label: 'Контакты' },
    ],
  },
]

/**
 * Ленивая ветка. Настоящий `loadChildren` ходит на сервер; здесь он выдумывает
 * детей на лету и отвечает с задержкой — чтобы было видно, что ветка тянется
 * именно в момент раскрытия, а не заранее.
 */
const loadChildren = (parentId: string): Promise<Array<TreeNode>> =>
  new Promise((ok) =>
    setTimeout(() => {
      const depth = parentId ? parentId.split('/').length : 0
      ok(
        Array.from({ length: depth >= 3 ? 0 : 4 }, (_, i) => ({
          id: `${parentId ? `${parentId}/` : ''}узел-${i + 1}`,
          label: `Узел ${depth + 1}.${i + 1}`,
          // на последнем уровне — листья, выше — ветки
          isFolder: i < 3 && depth < 2,
          badge: (depth + 1) * (i + 1),
        })),
      )
    }, 350),
  )

export default function DumbTreeExample() {
  const [chosen, setChosen] = createSignal<string | null>(null)
  const [q, setQ] = createSignal('')
  const [stripes, setStripes] = createSignal(true)
  const [size, setSize] = createSignal('13px')

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbTree — дерево с ленивой веткой</h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Узлы задаются <b>вложенно</b> (<code>children</code>) — так их и отдаёт сервер. Ветку можно
        не грузить заранее: <code>loadChildren(id)</code> зовётся в момент раскрытия. Полосы —
        одним градиентом с шагом в строку (<code>1lh</code>), поэтому при раскрытии вложенных они
        не сбиваются с ритма. Стрелка одна на оба состояния, раскрытая просто повёрнута.
      </p>

      <Bar>
        <input
          class="input input-sm"
          placeholder="поиск по названию"
          value={q()}
          onInput={(e) => setQ(e.currentTarget.value)}
        />
        <Check checked={stripes()} onChange={setStripes}>полосы</Check>
        <div class="join">
          <For each={[['12px', 'S'], ['13px', 'M'], ['15px', 'L']] as const}>
            {([value, label]) => (
              <button
                class={`btn join-item btn-xs ${size() === value ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => setSize(value)}
              >
                {label}
              </button>
            )}
          </For>
        </div>
        <Note>{chosen() ? `выбран: ${chosen()}` : 'кликни по строке'}</Note>
      </Bar>

      <div class="grid max-w-[92ch] gap-4 sm:grid-cols-2">
        <section>
          <h4 class="mb-1 text-sm font-semibold">Всё дерево сразу</h4>
          <DumbTree
            roots={ROOTS}
            icons={icons}
            size={size()}
            stripes={stripes()}
            query={q}
            selected={chosen}
            onSelect={(n) => setChosen(n.id)}
            storageKey="demo-tree"
            class="rounded-box border border-base-300 p-2"
          />
        </section>

        <section>
          <h4 class="mb-1 text-sm font-semibold">Ветка тянется при раскрытии</h4>
          <DumbTree
            loadChildren={loadChildren}
            icons={icons}
            size={size()}
            stripes={stripes()}
            selected={chosen}
            onSelect={(n) => setChosen(n.id)}
            class="rounded-box border border-base-300 p-2"
          />
        </section>
      </div>
    </div>
  )
}
