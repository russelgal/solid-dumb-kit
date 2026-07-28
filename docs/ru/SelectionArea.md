[English](../SelectionArea.md) · **Русский**

# SelectionArea

Выделение рамкой «как в Finder»: тянешь мышью — выделяется всё, чего коснулась рамка. `Shift` / `Cmd` / `Ctrl` добавляют к выделению. Клики тоже работают: обычный клик выделяет один элемент, клик с модификатором — переключает его.

```tsx
import { SelectionArea } from 'solid-dumb-kit'
```

Ни CSS импортировать, ни зависимостей. Позиции элементов снимаются **один раз** за жест через `IntersectionObserver`, а в кадре идёт только арифметика — горячий путь layout не трогает вовсе.

> Раньше здесь была обёртка над `@viselect/vanilla`. Та библиотека на *каждый* move зовёт `getBoundingClientRect()` по *каждому* элементу — сотни forced layout в кадр, ровно то, что кит запрещает. Теперь движок свой, вместе с ним поменялся и API (см. [Миграцию](#миграция-с-версии-на-viselect)).

## Пример

```tsx
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'

function Files(props: { files: { id: string; name: string }[] }) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <SelectionArea
      selectables=".file-card"
      selected={selected}
      onChange={setSelected}
      style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}
    >
      <div class="grid">
        <For each={props.files}>
          {(f) => (
            <div class="file-card" data-key={f.id} classList={{ active: selected().has(f.id) }}>
              {f.name}
            </div>
          )}
        </For>
      </div>
    </SelectionArea>
  )
}
```

Состояние выделения живёт в **твоём** сигнале — компонент им не владеет. Элемент опознаётся по `data-key`.

## Пропсы

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `selectables` | `string` | — (обязательный) | CSS-селектор выбираемых элементов. |
| `selected` | `() => Set<string>` | — (обязательный) | Текущее выделение (ключи). |
| `onChange` | `(selected: Set<string>) => void` | — (обязательный) | Срабатывает при каждом изменении выделения, в том числе во время протяжки. |
| `onStop` | `(selected: Set<string>) => void` | — | Жест завершён. |
| `onBeforeStart` | `(ev: PointerEvent) => boolean \| void` | — | Верни `false`, чтобы не начинать жест. |
| `keyAttr` | `string` | `'data-key'` | Атрибут с ключом элемента. |
| `intersect` | `'touch' \| 'cover' \| 'center'` | `'touch'` | Когда элемент считается выделенным: рамка коснулась / накрыла целиком / накрыла центр. |
| `threshold` | `number` | `10` | Сколько px пройти до появления рамки; меньше — это клик. |
| `areaClass` | `string` | — | Класс на рамку (структурные стили и так инлайном). |
| `class` | `string` | — | Доп. класс контейнера. |
| `style` | `JSX.CSSProperties` | — | Стили контейнера — сюда же вешать `overflow`/`max-height`, если список прокручивается. |

## Поведение

- **Модификаторы** — с зажатым `Shift`/`Cmd`/`Ctrl` протяжка только **добавляет** к прежнему выделению; проводя рамкой по уже выделенному, ты его не погасишь. Обычная протяжка выделение заменяет.
- **Клики** — клик по элементу выделяет только его; с модификатором — переключает. Клик по пустому месту снимает выделение (с модификатором — не трогает).
- **Игнорируемые цели** — жест, начатый на `button, a, input, select, textarea, [data-no-select]`, не стартует, поэтому элементы управления продолжают работать. Повесь `data-no-select`, чтобы исключить свой элемент.
- **Автоскролл** — протяжка у края контейнера прокручивает его, ускоряясь по мере ухода за край.
- **Скролл не сбрасывает выделение** — рамка живёт в координатах *контента*, поэтому растёт вместе с прокруткой, и уже задетые элементы не выпадают. (В версии на viselect они выпадали — теперь это исключено самой конструкцией.)

## Стилизация

Рамка рисуется инлайном через `currentColor`, поэтому сразу вписывается в окружающую тему. Нужен свой вид — передай `areaClass`; структурные стили (`position`, `pointer-events`) в любом случае остаются инлайновыми.

Выделенные элементы стилизуешь **сам**, из своего состояния — как в примере через `classList`.

## Примитив `createSelectionArea`

Компонент — тонкая обёртка, движок можно использовать напрямую, когда разметка своя:

```tsx
import { createSelectionArea } from 'solid-dumb-kit'

const area = createSelectionArea({
  container: () => hostEl,
  selectables: '.row',
  current: () => selected(),
  onChange: (next) => setSelected(next),
})
area.attach(hostEl)
```

## Миграция с версии на viselect

| Было | Стало |
| --- | --- |
| `onSelect={({ store }) => …}` с `store.stored`/`store.selected` | `selected={sig}` + `onChange={setSig}` — обычный `Set<string>` |
| доставать элементы через `el.dataset.key` в своём обработчике | ключи разбираются за тебя (`keyAttr`, по умолчанию `data-key`) |
| `import 'solid-dumb-kit/dist/index.css'` | не нужен, рамка инлайновая |
| `behaviour` / `features` / `boundaries` / `windowScroll` | убраны — полезное закрывают `intersect`, `threshold`, `areaClass` |
| тип `SelectionEvent` | ушёл вместе с viselect |
