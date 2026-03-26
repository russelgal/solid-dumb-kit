import { onMount, onCleanup, type JSX } from 'solid-js'
import VanillaSelectionArea from '@viselect/vanilla'
import type { SelectionEvent, SelectionOptions } from '@viselect/vanilla'

export type { SelectionEvent }

export type SelectionAreaProps = {
  /** CSS-селектор выбираемых элементов */
  selectables: string
  /** Вызывается при изменении выделения */
  onSelect?: (e: SelectionEvent) => void
  /** Вызывается при завершении выделения */
  onStop?: (e: SelectionEvent) => void
  /** Вызывается перед началом — return false чтобы отменить */
  onBeforeStart?: (e: SelectionEvent) => boolean | void
  /** Доп. класс контейнера */
  class?: string
  /** Класс для прямоугольника выделения */
  selectionAreaClass?: string
  /** Режим пересечения: touch (касание), cover (полное покрытие), center */
  intersect?: 'touch' | 'cover' | 'center'
  /** Доп. настройки поведения */
  behaviour?: Partial<SelectionOptions['behaviour']>
  /** Доп. настройки фич */
  features?: Partial<SelectionOptions['features']>
  children: JSX.Element
}

let stylesInjected = false

function injectStyles() {
  if (stylesInjected) return
  stylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
.viselect-area {
  background: oklch(from currentColor l c h / 0.08);
  border: 1.5px solid oklch(from currentColor l c h / 0.3);
  border-radius: 4px;
  pointer-events: none;
}`
  document.head.appendChild(style)
}

/**
 * Обёртка над @viselect/vanilla для SolidJS.
 * Рисует прямоугольник выделения при перетаскивании мыши (как в Finder).
 * Shift/Cmd — добавление к выделению.
 *
 * @example
 * ```tsx
 * <SelectionArea
 *   selectables=".file-card"
 *   onSelect={({ store }) => setSelected(new Set(
 *     [...store.stored, ...store.selected].map(el => el.dataset.key!)
 *   ))}
 * >
 *   <div class="grid">
 *     <For each={files()}>
 *       {(f) => <div class="file-card" data-key={f.id}>{f.name}</div>}
 *     </For>
 *   </div>
 * </SelectionArea>
 * ```
 */
export function SelectionArea(props: SelectionAreaProps) {
  let containerRef!: HTMLDivElement

  onMount(() => {
    injectStyles()

    const selection = new VanillaSelectionArea({
      selectables: [props.selectables],
      boundaries: [containerRef],
      container: containerRef,
      selectionAreaClass: props.selectionAreaClass ?? 'viselect-area',
      behaviour: {
        overlap: 'invert',
        intersect: props.intersect ?? 'touch',
        startThreshold: 10,
        ...props.behaviour,
      },
      features: {
        touch: true,
        range: true,
        singleTap: { allow: true, intersect: 'native' },
        deselectOnBlur: false,
        ...props.features,
      },
    })

    selection
      .on('beforestart', (e) => {
        const target = e.event?.target as HTMLElement | null
        if (target?.closest('button, a, input, [data-no-select]')) return false
        return props.onBeforeStart?.(e) ?? true
      })
      .on('start', ({ store, event }) => {
        const e = event as MouseEvent | TouchEvent
        const isAdditive = e instanceof MouseEvent
          ? (e.shiftKey || e.metaKey || e.ctrlKey)
          : false

        if (!isAdditive) {
          selection.clearSelection()
          store.stored.forEach(el => el.classList.remove('viselect-selected'))
        }
      })
      .on('move', (e) => {
        const { added, removed } = e.store.changed
        added.forEach(el => el.classList.add('viselect-selected'))
        removed.forEach(el => el.classList.remove('viselect-selected'))
        props.onSelect?.(e)
      })
      .on('stop', (e) => {
        props.onStop?.(e)
      })

    onCleanup(() => selection.destroy())
  })

  return (
    <div ref={containerRef} class={props.class} style={{ position: 'relative' }}>
      {props.children}
    </div>
  )
}
