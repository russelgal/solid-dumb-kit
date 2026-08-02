// Вложенные сетки + ПЕРЕНОС БЛОКОВ МЕЖДУ НИМИ.
//
// Внешняя сетка раскладывает СЕКЦИИ, внутри каждой — своя сетка виджетов. Все
// внутренние сетки состоят в одной группе (createDumbGridGroup), поэтому виджет
// перетаскивается из секции в секцию — как карточка между колонками канбана, но
// это полноценные блоки сетки: со своим размером, ресайзом и местом в раскладке.
//
// Уровни не путаются: блок помечен [data-grid-block], и сетка забирает жест,
// только если ближайший блок под указателем — её собственный. Секцию тянут за
// шапку, виджет — за его тело.
import { createMemo, createSignal, For } from 'solid-js'
import { createDumbGridGroup, DumbGrid, type DumbGridItem, type DumbGridLayout } from '@solid-dumb-kit/grid'

type Widget = { id: string; title: string; hue: number }
type Section = { id: string; title: string }

const SECTIONS: Array<Section> = [
  { id: 'sales', title: 'Продажи' },
  { id: 'ops', title: 'Операционка' },
]

const WIDGETS: Record<string, Array<Widget>> = {
  sales: [
    { id: 's1', title: 'Выручка', hue: 265 },
    { id: 's2', title: 'Средний чек', hue: 200 },
    { id: 's3', title: 'Конверсия', hue: 30 },
    { id: 's4', title: 'Возвраты', hue: 20 },
  ],
  ops: [
    { id: 'o1', title: 'Склад', hue: 150 },
    { id: 'o2', title: 'Доставка', hue: 90 },
    { id: 'o3', title: 'Поддержка', hue: 320 },
  ],
}

// стартовые раскладки: внешняя — половина ширины на секцию, внутренняя — виджеты
const OUTER: DumbGridLayout = SECTIONS.map((s) => ({ id: s.id, w: 6, h: 4 }))
const INNER: Record<string, DumbGridLayout> = {
  sales: [
    { id: 's1', w: 6, h: 2 },
    { id: 's2', w: 3, h: 1 },
    { id: 's3', w: 3, h: 1 },
    { id: 's4', w: 6, h: 1 },
  ],
  ops: [
    { id: 'o1', w: 3, h: 2 },
    { id: 'o2', w: 3, h: 1 },
    { id: 'o3', w: 3, h: 1 },
  ],
}

export default function BoardExample() {
  const [sections, setSections] = createSignal<Array<Section>>(SECTIONS)
  const [widgets, setWidgets] = createSignal<Record<string, Array<Widget>>>(WIDGETS)
  const [outer, setOuter] = createSignal<DumbGridLayout>(OUTER)
  const [inner, setInner] = createSignal<Record<string, DumbGridLayout>>(INNER)
  const [edit, setEdit] = createSignal(true)
  const [seq, setSeq] = createSignal(0)
  const [log, setLog] = createSignal('тащи виджет из секции в секцию')

  // Группа: перенос между сетками — единственное, что она отдаёт наружу.
  // Всё локальное (перестановка, ресайз) сетки применяют сами.
  const group = createDumbGridGroup({
    onTransfer: (from, to) => {
      const moved = (widgets()[from.grid] ?? []).find((w) => w.id === from.id)
      if (!moved) return

      setWidgets((all) => ({
        ...all,
        [from.grid]: (all[from.grid] ?? []).filter((w) => w.id !== from.id),
        [to.grid]: [
          ...(all[to.grid] ?? []).slice(0, to.index),
          moved,
          ...(all[to.grid] ?? []).slice(to.index),
        ],
      }))
      setInner((all) => {
        const src = (all[from.grid] ?? []).filter((s) => s.id !== from.id)
        const span = (all[from.grid] ?? []).find((s) => s.id === from.id) ?? { id: from.id, w: 3, h: 1 }
        const dst = [...(all[to.grid] ?? [])]
        dst.splice(to.index, 0, { ...span, id: from.id })
        return { ...all, [from.grid]: src, [to.grid]: dst }
      })
      setLog(`«${moved.title}»: ${from.grid} → ${to.grid} #${to.index}`)
    },
  })

  const nextId = () => {
    const n = seq() + 1
    setSeq(n)
    return n
  }

  const addWidget = (sectionId: string) => {
    const n = nextId()
    const id = `w-${n}`
    setWidgets((w) => ({ ...w, [sectionId]: [...(w[sectionId] ?? []), { id, title: `Виджет ${n}`, hue: (n * 47) % 360 }] }))
  }

  const removeWidget = (sectionId: string, id: string) => {
    setWidgets((w) => ({ ...w, [sectionId]: (w[sectionId] ?? []).filter((x) => x.id !== id) }))
    setInner((l) => ({ ...l, [sectionId]: (l[sectionId] ?? []).filter((s) => s.id !== id) }))
  }

  const addSection = () => {
    const n = nextId()
    const id = `sec-${n}`
    setWidgets((w) => ({ ...w, [id]: [] }))
    setInner((l) => ({ ...l, [id]: [] }))
    setSections((list) => [...list, { id, title: `Секция ${n}` }])
    setOuter((l) => [...l, { id, w: 6, h: 4 }])
  }

  const removeSection = (id: string) => {
    setSections((list) => list.filter((s) => s.id !== id))
    setOuter((l) => l.filter((s) => s.id !== id))
    setWidgets((w) => { const next = { ...w }; delete next[id]; return next })
    setInner((l) => { const next = { ...l }; delete next[id]; return next })
  }

  // Вложенная сетка секции. items выведены из списка виджетов и НЕ зависят от
  // раскладки, поэтому перестановка внутри не пересобирает блоки снаружи.
  const SectionBody = (p: { section: Section }) => {
    const items = createMemo<Array<DumbGridItem>>(() =>
      (widgets()[p.section.id] ?? []).map((w) => ({
        id: w.id,
        w: 3,
        h: 1,
        minW: 2,
        content: () => (
          <div
            class="widget flex h-full box-border flex-col justify-center gap-0.5 rounded-box border-l-[3px] bg-base-100 px-2.5 py-2 ring-1 ring-base-300"
            style={{ 'border-left-color': `oklch(0.7 0.13 ${w.hue})` }}
          >
            <span class="text-xs text-base-content">{w.title}</span>
            <span class="text-[17px] font-semibold">{((w.hue * 137) % 900) + 100}</span>
          </div>
        ),
      })),
    )

    return (
      <section class="section flex h-full min-w-0 box-border flex-col overflow-hidden rounded-xl border border-base-300 bg-base-200 [&>header]:flex [&>header]:cursor-grab [&>header]:items-center [&>header]:gap-2 [&>header]:border-b [&>header]:border-base-200 [&>header]:bg-base-100 [&>header]:px-2.5 [&>header]:py-2 [&>header]:text-[13px] [&>header]:select-none [&>header:active]:cursor-grabbing">
        {/* шапка — ручка внешней сетки: за неё двигается вся секция */}
        <header data-drag-handle>
          <span class="leading-none text-base-content">⠿</span>
          <strong>{p.section.title}</strong>
          <span class="text-xs text-base-content">{items().length}</span>
          <button
            data-add-widget
            class="mr-4.5 ml-auto grid size-5 cursor-pointer place-items-center rounded-md border border-base-300 bg-base-100 p-0 leading-none text-base-content"
            data-no-drag
            type="button"
            onClick={() => addWidget(p.section.id)}
            title="Добавить виджет в секцию"
          >
            +
          </button>
        </header>

        {/* ВЛОЖЕННАЯ сетка: свои колонки, свой шаг строки, своя раскладка */}
        <div
          class="min-h-0 flex-1 overflow-auto rounded-b-xl p-2 transition-colors [scrollbar-gutter:stable]"
          classList={{
            'bg-primary/15 ring-2 ring-primary ring-inset':
              group.over() === p.section.id && group.active()?.grid !== p.section.id,
          }}
        >
          <DumbGrid
            group={group}
            name={p.section.id}
            cols={6}
            rowHeight={56}
            gap={8}
            editable={edit()}
            items={items()}
            layout={inner()[p.section.id] ?? []}
            onLayout={(l) => setInner((all) => ({ ...all, [p.section.id]: l }))}
            onRemove={(id) => removeWidget(p.section.id, id)}
            blockStyle={{ cursor: 'default' }}
          />
        </div>
      </section>
    )
  }

  const outerItems = createMemo<Array<DumbGridItem>>(() =>
    sections().map((s) => ({
      id: s.id,
      w: 6,
      h: 4,
      minW: 3,
      minH: 2,
      content: () => <SectionBody section={s} />,
    })),
  )

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">Вложенные сетки</h3>
      <p class="mb-2.5 text-[13px] text-base-content">
        Каждый блок внешней сетки — <b>сам DumbGrid</b>, и все внутренние сетки состоят в одной
        <b> группе</b>: виджет перетаскивается <b>из секции в секцию</b>, как карточка в канбане, только
        это полноценный блок — со своим размером и ресайзом. Секцию двигаешь за её <b>⠿</b>, виджет — за
        тело. Приёмник подсвечивается, <b>Esc</b> отменяет перенос.
      </p>

      <div class="mb-3 flex flex-wrap items-center gap-3 text-[13px] [&_button]:cursor-pointer [&_button]:rounded-lg [&_button]:border [&_button]:border-base-300 [&_button]:bg-base-100 [&_button]:px-2.5 [&_button]:py-1">
        <label class="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-2.5 py-1">
          <input type="checkbox" checked={edit()} onChange={(e) => setEdit(e.currentTarget.checked)} />
          <b>edit mode</b>
        </label>
        <button onClick={addSection}>+ секция</button>
        <span class="text-base-content">{log()}</span>
      </div>

      <DumbGrid
        cols={12}
        rowHeight={104}
        gap={12}
        editable={edit()}
        items={outerItems()}
        layout={outer()}
        onLayout={setOuter}
        onRemove={removeSection}
        labels={{ remove: 'Убрать секцию' }}
        blockStyle={{ cursor: 'default' }}
      />

    </div>
  )
}
