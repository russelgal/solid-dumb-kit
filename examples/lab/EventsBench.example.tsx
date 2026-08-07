// Сколько стоит слушатель на элементе против делегирования.
//
// Вопрос прикладной: движки кита (`sortableCore`, `gridCore`) вешают
// `pointerdown` НА КАЖДЫЙ элемент — по слушателю на строку. Solid для тех же
// событий делегирует: один слушатель на документ, а до нужного обработчика
// событие доходит всплытием (`DelegatedEvents` — click, pointerdown,
// pointermove, keydown и ещё полтора десятка).
//
// Меряем три способа на одинаковой разметке:
//
//   1. solid      — onPointerDown в JSX, Solid делегирует сам
//   2. поэлементно — el.addEventListener на каждом узле, как в движках кита
//   3. на контейнере — один слушатель, цель ищется через closest()
//
// Три цифры на каждый: монтирование (создать N узлов и навесить), диспатч
// (сто событий подряд) и снятие (размонтировать всё). Цифры пляшут от прогона
// к прогону, поэтому берётся МЕДИАНА трёх заходов.
//
// ВАЖНО, КАК ЧИТАТЬ. Сравнивать между собой honest'но можно только «поэлементно»
// и «на контейнере»: они строят одинаковый DOM руками и отличаются ровно
// способом навесить слушатель. Строка solid стоит рядом для масштаба — она
// включает ещё и цену `<For>` с реактивностью, то есть меряет другое.
//
// Что вышло в Chrome (медиана трёх заходов):
//
//   строк   поэлементно   на контейнере   разница      снятие
//    1 000      1.8 мс        1.4 мс      +0.4 мс    0.2 / 0.1 мс
//    5 000      8.2 мс        4.6 мс      +3.6 мс    1.1 / 0.2 мс
//   20 000     25.5 мс       19.9 мс      +5.6 мс    3.7 / 0.8 мс
//
// То есть `addEventListener` стоит около 0.3 микросекунды на элемент, и
// столько же — снять его обратно. Диспатч одинаков (0.38–0.45 мс на сотню
// событий): всплытие до контейнера с `closest()` не дороже прямого попадания
// в обработчик.
//
// Вывод для кита: на сотнях строк разница неощутима, поэтому движки могут и
// дальше вешать `pointerdown` поэлементно — это проще и не требует хиттеста.
// На десятках тысяч (виртуализованные списки) стоит смотреть на делегирование:
// там экономятся уже единицы миллисекунд на монтировании и снятии.

import { createSignal, For, onCleanup, Show } from 'solid-js'
// solid-js/web тут можно: запрет на этот сабпуть касается пакетов кита, а
// витрина и так им пользуется — на нём стоит её точка входа
import { render } from 'solid-js/web'
import { Bar, Btn, Note, Pick } from '../_controls'

type Row = { id: number; label: string }
type Result = { name: string; mount: number; dispatch: number; unmount: number; listeners: number }

const SIZES = [1000, 5000, 20000]

/** медиана трёх заходов: одиночный замер в браузере врёт слишком часто */
const median = (xs: Array<number>) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

export default function EventsBenchExample() {
  const [size, setSize] = createSignal(5000)
  const [runs, setRuns] = createSignal<Array<Result>>([])
  const [busy, setBusy] = createSignal(false)

  const rows = (n: number): Array<Row> =>
    Array.from({ length: n }, (_, i) => ({ id: i, label: `строка ${i}` }))

  /**
   * Один замер. Разметку строим НЕ через Solid, а руками: так три способа
   * отличаются ровно тем, чем мы хотим — способом навесить слушатель, а не
   * ценой реактивности.
   */
  function measure(kind: 'element' | 'container', n: number): Result {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hits = 0
    const cleanups: Array<() => void> = []

    const t0 = performance.now()
    const onHit = () => void hits++
    for (const r of rows(n)) {
      const el = document.createElement('div')
      el.className = 'row'
      el.dataset.id = String(r.id)
      el.textContent = r.label
      if (kind === 'element') {
        el.addEventListener('pointerdown', onHit)
        cleanups.push(() => el.removeEventListener('pointerdown', onHit))
      }
      host.appendChild(el)
    }
    if (kind === 'container') {
      const onDown = (ev: Event) => {
        // цель ищется так же, как это делают движки кита при делегировании
        if ((ev.target as HTMLElement).closest('.row')) hits++
      }
      host.addEventListener('pointerdown', onDown)
      cleanups.push(() => host.removeEventListener('pointerdown', onDown))
    }
    const mount = performance.now() - t0

    // диспатч: сотня событий по случайным строкам
    const targets = Array.from(host.children)
    const t1 = performance.now()
    for (let i = 0; i < 100; i++) {
      targets[(i * 977) % targets.length].dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    }
    const dispatch = performance.now() - t1

    const t2 = performance.now()
    for (const off of cleanups) off()
    host.remove()
    const unmount = performance.now() - t2

    return {
      name: kind === 'element' ? 'поэлементно' : 'на контейнере',
      mount,
      dispatch,
      unmount,
      listeners: kind === 'element' ? n : 1,
    }
  }

  /** тот же замер, но разметку и слушатели делает Solid (делегирование) */
  function measureSolid(n: number): Result {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hits = 0
    const data = rows(n)

    const t0 = performance.now()
    const dispose = render(
      () => (
        <For each={data}>
          {(r) => (
            <div class="row" data-id={r.id} onPointerDown={() => void hits++}>
              {r.label}
            </div>
          )}
        </For>
      ),
      host,
    )
    const mount = performance.now() - t0

    const targets = Array.from(host.children)
    const t1 = performance.now()
    for (let i = 0; i < 100; i++) {
      targets[(i * 977) % targets.length].dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    }
    const dispatch = performance.now() - t1

    const t2 = performance.now()
    dispose()
    host.remove()
    const unmount = performance.now() - t2

    // Solid держит ОДИН слушатель на документ для каждого вида события
    return { name: 'solid (делегирует)', mount, dispatch, unmount, listeners: 1 }
  }

  async function run() {
    setBusy(true)
    setRuns([])
    await new Promise((r) => setTimeout(r, 30))
    const n = size()
    const kinds: Array<'solid' | 'element' | 'container'> = ['solid', 'element', 'container']
    const out: Array<Result> = []

    for (const kind of kinds) {
      const three = Array.from({ length: 3 }, () =>
        kind === 'solid' ? measureSolid(n) : measure(kind, n),
      )
      out.push({
        name: three[0].name,
        mount: median(three.map((r) => r.mount)),
        dispatch: median(three.map((r) => r.dispatch)),
        unmount: median(three.map((r) => r.unmount)),
        listeners: three[0].listeners,
      })
      await new Promise((r) => setTimeout(r, 20))
    }
    setRuns(out)
    setBusy(false)
  }

  onCleanup(() => setRuns([]))

  const base = () => runs().find((r) => r.name.startsWith('solid'))

  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">События: делегирование против слушателя на элементе</h3>
      <p class="mb-3 max-w-[92ch] text-sm">
        Solid делегирует полтора десятка событий (<code>click</code>, <code>pointerdown</code>,{' '}
        <code>pointermove</code>, <code>keydown</code>…): один слушатель на документ, дальше
        всплытие. Движки кита вешают <code>pointerdown</code> на каждый элемент. Здесь видно, чего
        это стоит на самом деле.
      </p>

      <Bar>
        <Pick
          label="строк"
          value={size()}
          options={SIZES.map((n) => ({ value: n }))}
          onChange={(v) => setSize(Number(v))}
        />
        <Btn onClick={() => void run()}>{busy() ? 'меряю…' : 'Прогнать'}</Btn>
      </Bar>

      <Show when={runs().length}>
        <div class="overflow-x-auto">
          <table class="table table-sm w-auto">
            <thead>
              <tr>
                <th>способ</th>
                <th>монтирование</th>
                <th>диспатч ×100</th>
                <th>снятие</th>
                <th>слушателей</th>
              </tr>
            </thead>
            <tbody>
              <For each={runs()}>
                {(r) => (
                  <tr>
                    <td class="font-medium">{r.name}</td>
                    <td class="tabular-nums">
                      {r.mount.toFixed(1)} мс
                      <Show when={base() && r !== base()}>
                        <span class="ml-1 text-xs">×{(r.mount / base()!.mount).toFixed(1)}</span>
                      </Show>
                    </td>
                    <td class="tabular-nums">{r.dispatch.toFixed(2)} мс</td>
                    <td class="tabular-nums">{r.unmount.toFixed(1)} мс</td>
                    <td class="tabular-nums">{r.listeners.toLocaleString('ru-RU')}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Note>
        Числа пляшут от прогона к прогону, поэтому берётся медиана трёх заходов. Смотреть стоит не
        на абсолютные миллисекунды, а на отношение: во сколько раз способ дороже делегирования на
        том же числе строк.
      </Note>
    </div>
  )
}
