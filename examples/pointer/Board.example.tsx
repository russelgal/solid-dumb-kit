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
          <div class="widget" style={{ '--hue': String(w.hue) }}>
            <span class="wtitle">{w.title}</span>
            <span class="wval">{((w.hue * 137) % 900) + 100}</span>
          </div>
        ),
      })),
    )

    return (
      <section class="section">
        {/* шапка — ручка внешней сетки: за неё двигается вся секция */}
        <header data-drag-handle>
          <span class="grip">⠿</span>
          <strong>{p.section.title}</strong>
          <span class="count">{items().length}</span>
          <button
            class="add"
            data-no-drag
            type="button"
            onClick={() => addWidget(p.section.id)}
            title="Добавить виджет в секцию"
          >
            +
          </button>
        </header>

        {/* ВЛОЖЕННАЯ сетка: свои колонки, свой шаг строки, своя раскладка */}
        <div class="inner" classList={{ over: group.over() === p.section.id && group.active()?.grid !== p.section.id }}>
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
    <div class="bd-example">
      <h3>Вложенные сетки</h3>
      <p class="note">
        Каждый блок внешней сетки — <b>сам DumbGrid</b>, и все внутренние сетки состоят в одной
        <b> группе</b>: виджет перетаскивается <b>из секции в секцию</b>, как карточка в канбане, только
        это полноценный блок — со своим размером и ресайзом. Секцию двигаешь за её <b>⠿</b>, виджет — за
        тело. Приёмник подсвечивается, <b>Esc</b> отменяет перенос.
      </p>

      <div class="bar">
        <label class="switch">
          <input type="checkbox" checked={edit()} onChange={(e) => setEdit(e.currentTarget.checked)} />
          <b>edit mode</b>
        </label>
        <button onClick={addSection}>+ секция</button>
        <span class="log">{log()}</span>
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

      <style>{`
        .bd-example { padding: 16px 20px; color: #0f172a }
        .bd-example h3 { margin: 0 0 4px }
        .bd-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b }
        .bd-example .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
                           margin: 0 0 12px; font-size: 13px }
        .bd-example .switch { display: inline-flex; gap: 6px; align-items: center;
                              padding: 4px 10px; border: 1px solid #cbd5e1;
                              border-radius: 999px; background: #fff }
        .bd-example .bar button { font: inherit; padding: 4px 10px; border: 1px solid #cbd5e1;
                                  border-radius: 8px; background: #fff; cursor: pointer }

        .bd-example .section { height: 100%; display: flex; flex-direction: column; min-width: 0;
                               box-sizing: border-box; border-radius: 12px; border: 1px solid #e2e8f0;
                               background: #f8fafc; overflow: hidden }
        .bd-example .section header { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                                      cursor: grab; user-select: none; font-size: 13px;
                                      border-bottom: 1px solid #e9eef5; background: #fff }
        .bd-example .section header:active { cursor: grabbing }
        .bd-example .grip { color: #94a3b8; line-height: 1 }
        .bd-example .count { font-size: 12px; color: #94a3b8 }
        .bd-example .add { margin-left: auto; margin-right: 18px; width: 20px; height: 20px;
                           display: grid; place-items: center; padding: 0; font: inherit;
                           border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
                           color: #475569; cursor: pointer; line-height: 1 }

        .bd-example .inner { flex: 1; min-height: 0; padding: 8px; overflow: auto;
                             scrollbar-gutter: stable; border-radius: 0 0 11px 11px;
                             transition: background .15s, box-shadow .15s }
        .bd-example .inner.over { background: #eef2ff; box-shadow: inset 0 0 0 2px #6366f1 }
        .bd-example .log { color: #64748b }

        .bd-example .widget { height: 100%; box-sizing: border-box; display: flex;
                              flex-direction: column; justify-content: center; gap: 2px;
                              padding: 8px 10px; border-radius: 10px; background: #fff;
                              box-shadow: inset 0 0 0 1px #e2e8f0;
                              border-left: 3px solid oklch(0.7 0.13 var(--hue)) }
        .bd-example .wtitle { font-size: 12px; color: #64748b }
        .bd-example .wval { font-size: 17px; font-weight: 600 }
      `}</style>
    </div>
  )
}
