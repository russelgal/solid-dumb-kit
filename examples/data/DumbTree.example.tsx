// DumbTree — дерево: вложенные узлы, ленивая подгрузка ветки, поиск, выбор.
//
// Показаны оба способа кормления. Слева дерево знает всё сразу (`roots`), справа
// не знает ничего: ветка тянется `loadChildren` в момент раскрытия — так
// открывается каталог на десять тысяч узлов, из которого читают три.
//
// Значки — Solar через iconify, КЛАССАМИ: своих иконок кит не несёт.
import { createSignal, For } from 'solid-js'
import { DumbTree, type TreeNode } from '@solid-dumb-kit/tree'
import { Bar, Check, Note, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbTree.snippets'

const TREE_PROPS = [
  { name: 'roots', type: 'TreeNode[]', about: 'Корни дерева. Не заданы — первый запрос уйдёт через loadChildren("").' },
  {
    name: 'loadChildren',
    type: '(parentId) => Promise<TreeNode[]>',
    about: 'Содержимое ветки по требованию: зовётся при первом раскрытии и повторно при смене refreshKey.',
  },
  { name: 'selected / onSelect', type: '() => string | null / (node) => void', about: 'Выбранный узел; состояние держит потребитель.' },
  { name: 'onContextMenu', type: '(ev, node) => void', about: 'Правый клик по строке — обычно открывает своё меню.' },
  { name: 'storageKey', type: 'string', about: 'Ключ localStorage для раскрытых веток. Не задан — не помним.' },
  { name: 'refreshKey', type: '() => number | string', about: 'Сменился — раскрытые ветки перечитываются.' },
  { name: 'query / match', type: '() => string / (node, q) => boolean', about: 'Фильтр по названию: показываются совпавшие и дорога к ним. Матчер по умолчанию — подстрока без учёта регистра.' },
  { name: 'icons', type: 'DumbTreeIcons', about: 'Классы значков. Стрелка ОДНА на оба состояния — раскрытая поворачивается на 90°.' },
  { name: 'size', type: 'string', def: '13px', about: 'Размер дерева одним кеглем: высота строки 1lh, отступы едут следом.' },
  { name: 'stripes', type: 'boolean', def: 'true', about: 'Полосы через строку — одним градиентом на всё дерево.' },
  { name: 'renderAction', type: '(node) => JSX.Element', about: 'Свой контент справа в строке: кнопки, бейджи.' },
  { name: 'getDragData', type: '(node) => { type, id, label } | null', about: 'Узел можно тащить наружу: что вернули, то и уедет в dataTransfer.' },
]

const NODE_PROPS = [
  { name: 'id / label', type: 'string', about: 'Ключ и подпись.' },
  { name: 'children', type: 'TreeNode[]', about: 'Дети. Узел с children считается веткой и без флага.' },
  { name: 'isFolder', type: 'boolean', about: 'Ветка без загруженных детей — чтобы стрелка появилась заранее.' },
  { name: 'icon', type: 'string', about: 'Свой класс значка вместо взятого из icons по виду узла.' },
  { name: 'badge', type: 'string | number', about: 'Мелким справа: счётчик, размер, статус.' },
  { name: 'href', type: 'string', about: 'Строка станет ссылкой; навигацию делает потребитель.' },
  { name: 'class', type: 'string', about: 'Доп. класс на строку.' },
]

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

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Дерево из данных">
        <p>
          Узел — это <code>id</code>, подпись и, если есть, дети. Разметка — вложенные{' '}
          <code>ul &gt; li</code>, то есть ровно то, на что daisyUI кладёт свой{' '}
          <code>menu</code>. Выбранный узел и раскрытые ветки живут снаружи: первый в вашем
          состоянии, вторые — в <code>localStorage</code>, если дали ключ.
        </p>
      </Doc>
      <Code title="Дерево со списком" code={SNIP.basic} />

      <Doc title="Ленивая загрузка">
        <p>
          Ветка тянется при первом раскрытии — дерево на десятки тысяч узлов незачем грузить
          целиком. Когда данные на сервере поменялись, достаточно сменить <code>refreshKey</code>:
          раскрытые ветки перечитаются, а закрытые не тронутся.
        </p>
      </Doc>
      <Code title="Ветка по требованию" code={SNIP.lazy} />

      <Doc title="Поиск">
        <p>
          Фильтр показывает совпавшие узлы И дорогу к ним — иначе найденное висело бы в воздухе без
          понимания, где оно лежит. Пока поиск активен, перетаскивание выключается: показанный
          порядок не совпадает с порядком данных, и «переставил» означало бы не то, что видно.
        </p>
      </Doc>
      <Code title="Фильтр и свой матчер" code={SNIP.search} />

      <Doc title="Размер и значки">
        <p>
          Размер дерева задаётся ОДНИМ кеглем: строка ровно в <code>1lh</code>, поэтому высота,
          отступы, стрелка и полосы считаются от него сами. Своих иконок кит не несёт — классы
          приходят пропом, набор любой.
        </p>
      </Doc>
      <Code title="Кегль, полосы, иконки" code={SNIP.look} />

      <Doc title="Перетаскивание наружу">
        <p>
          Узел можно утащить в другой компонент — таблицу, карту, редактор. Кит только кладёт в{' '}
          <code>dataTransfer</code> то, что вернул <code>getDragData</code>; принимающая сторона
          читает это обычным нативным DnD.
        </p>
      </Doc>
      <Code title="Узел как источник" code={SNIP.drag} />

      <h4 class="mt-6 text-lg font-semibold">DumbTree</h4>
      <Props rows={TREE_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">TreeNode</h4>
      <Props rows={NODE_PROPS} />

    </div>
  )
}
