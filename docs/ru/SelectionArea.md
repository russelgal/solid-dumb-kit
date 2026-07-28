[English](../SelectionArea.md) · **Русский**

# SelectionArea

Выделение рамкой «как в Finder»: тянешь мышью — рисуется прямоугольник и выделяет всё, чего коснулся. `Shift` / `Cmd` / `Ctrl` добавляют к текущему выделению. Тонкая SolidJS-обёртка над [`@viselect/vanilla`](https://github.com/Simonwep/selection).

```tsx
import { SelectionArea } from 'solid-dumb-kit'
import 'solid-dumb-kit/dist/index.css'
```

## Пример

```tsx
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'

function Files(props: { files: { id: string; name: string }[] }) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <SelectionArea
      selectables=".file-card"
      onSelect={({ store }) =>
        setSelected(new Set(
          [...store.stored, ...store.selected].map(el => (el as HTMLElement).dataset.key!),
        ))
      }
    >
      <div class="grid">
        <For each={props.files}>
          {(f) => (
            <div
              class="file-card"
              data-key={f.id}
              classList={{ active: selected().has(f.id) }}
            >
              {f.name}
            </div>
          )}
        </For>
      </div>
    </SelectionArea>
  )
}
```

## Пропсы

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `selectables` | `string` | — (обязательный) | CSS-селектор выделяемых элементов. |
| `children` | `JSX.Element` | — (обязательный) | Содержимое контейнера. Рендерится внутри обёртки с `position: relative`. |
| `onSelect` | `(e: SelectionEvent) => void` | — | Срабатывает на каждое изменение выделения во время протяжки. |
| `onStop` | `(e: SelectionEvent) => void` | — | Срабатывает по окончании протяжки. |
| `onBeforeStart` | `(e: SelectionEvent) => boolean \| void` | — | Верни `false`, чтобы отменить выделение до его начала. |
| `intersect` | `'touch' \| 'cover' \| 'center'` | `'touch'` | Когда элемент считается выделенным: `touch` — рамка его коснулась, `cover` — рамка накрыла целиком, `center` — рамка накрыла его центр. |
| `class` | `string` | — | Доп. класс на контейнерный `<div>`. |
| `style` | `JSX.CSSProperties` | — | Инлайн-стили контейнера. Если список прокручивается — `overflow`/`max-height` вешай **сюда**, см. ниже. |
| `selectionAreaClass` | `string` | `'viselect-area'` | Класс на самом прямоугольнике выделения. |
| `boundaries` | `(string \| HTMLElement)[]` | `[контейнер]` | Элементы, ограничивающие область, где выделение может начинаться и продолжаться. |
| `behaviour` | `Partial<SelectionOptions['behaviour']>` | см. ниже | Пробрасывается в `@viselect/vanilla`. |
| `features` | `Partial<SelectionOptions['features']>` | см. ниже | Пробрасывается в `@viselect/vanilla`. |
| `windowScroll` | `boolean` | `false` | Автопрокрутка **окна**, когда тянешь за край вьюпорта (для страниц без своего скролл-контейнера). См. заметку ниже. |

### Значения по умолчанию

`behaviour`: `{ overlap: 'invert', intersect: 'touch', startThreshold: 10 }`
`features`: `{ touch: true, range: true, singleTap: { allow: true, intersect: 'native' }, deselectOnBlur: false }`

Твои `behaviour` / `features` мержатся поверх этих (поверхностно, на один уровень).

## Что зашито в поведение

- **Модификаторы-добавление** — с зажатым `Shift`, `Cmd` или `Ctrl` прошлое выделение сохраняется и к нему добавляется новое; обычная протяжка сначала сбрасывает выделение.
- **Класс `.viselect-selected`** — автоматически ставится и снимается с элементов, когда они входят в выделение и выходят из него. Стилизуй этот класс, чтобы показать выделенное состояние.
- **Игнорируемые цели** — протяжка, начатая на `button, a, input, [data-no-select]`, подавляется, чтобы интерактивные элементы продолжали работать. Повесь `data-no-select`, чтобы исключить свой элемент.

## Стилизация

Идущий в комплекте CSS (`solid-dumb-kit/dist/index.css`) стилизует:

- `.viselect-area` — прямоугольник рамки (использует `currentColor`, поэтому подхватывает цвет текста вокруг);
- `.viselect-window-scroll *::selection` — держит нативное выделение текста невидимым, пока работает `windowScroll`.

**Выделенные элементы** стилизуешь сам — через `.viselect-selected` (или через своё производное состояние, как в примере).

## Прокручиваемые списки: скроллером должен быть сам контейнер

Рамка считается относительно **boundary** — по умолчанию это собственный контейнер компонента. Если прокручивается что-то *внутри* него, рамка остаётся приклеенной к вьюпорту, элементы уезжают под ней, и при скролле из выделения молча вылетает всё, что ушло за пределы видимой части.

Поэтому прокрутку вешай на сам контейнер:

```tsx
<SelectionArea
  selectables=".card"
  style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}   // ← сюда, а не на потомка
>
  <div class="grid">…</div>
</SelectionArea>
```

Либо укажи в `boundaries` тот элемент, который реально скроллится:

```tsx
<SelectionArea selectables=".card" boundaries={['.my-scroll-area']}>
```

## Про `windowScroll`

Если выделяемая область не лежит в собственном скролл-контейнере (прокручивается вся страница), включи `windowScroll` — тогда протяжка у края вьюпорта прокручивает окно. Механика: на короткое время включается нативное выделение текста, чтобы задействовать встроенный автоскролл браузера; идущий в комплекте CSS это выделение прячет, а вскоре после окончания протяжки оно снимается.

## `SelectionEvent`

Реэкспортируется из `@viselect/vanilla`. Самое полезное поле — `store`:

- `store.selected` — элементы, выделенные текущей протяжкой;
- `store.stored` — элементы, выделенные предыдущими (добавляющими) протяжками;
- `store.changed.added` / `store.changed.removed` — дельта последнего движения.
