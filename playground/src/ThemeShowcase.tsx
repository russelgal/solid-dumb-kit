// Демо темы витрины: все токены daisyUI и все органы управления на одной
// странице. Живёт в `playground/`, а не в `examples/`, намеренно — тема к киту
// отношения не имеет: пакеты не знают ни про Tailwind, ни про daisyUI, а эта
// страница проверяет ровно оформление витрины.
//
// Чем полезна: переключая тему в шапке, видно всю палитру разом — и пару
// «фон + content» на контраст, и как ложится декор темы `scifi` (скобы, фаска,
// свечение, сканлайны).
import { createSignal, createEffect, For, Show, onCleanup } from 'solid-js'

/** Пара «поверхность → текст на ней». Обе половины рядом: так видно контраст. */
const SURFACES = [
  { token: 'base-100', bg: 'bg-base-100', fg: 'text-base-content', note: 'основной фон' },
  { token: 'base-200', bg: 'bg-base-200', fg: 'text-base-content', note: 'утопленные панели' },
  { token: 'base-300', bg: 'bg-base-300', fg: 'text-base-content', note: 'границы, разделители' },
  { token: 'neutral', bg: 'bg-neutral', fg: 'text-neutral-content', note: 'нейтральный блок' },
]

const ACCENTS = [
  { token: 'primary', bg: 'bg-primary', fg: 'text-primary-content' },
  { token: 'secondary', bg: 'bg-secondary', fg: 'text-secondary-content' },
  { token: 'accent', bg: 'bg-accent', fg: 'text-accent-content' },
  { token: 'info', bg: 'bg-info', fg: 'text-info-content' },
  { token: 'success', bg: 'bg-success', fg: 'text-success-content' },
  { token: 'warning', bg: 'bg-warning', fg: 'text-warning-content' },
  { token: 'error', bg: 'bg-error', fg: 'text-error-content' },
]

const BTN_COLORS = ['btn-primary', 'btn-secondary', 'btn-accent', 'btn-neutral', 'btn-info', 'btn-success', 'btn-warning', 'btn-error']
const BTN_STYLES = ['btn-outline', 'btn-soft', 'btn-ghost', 'btn-dash', 'btn-link']
const BTN_SIZES = ['btn-xs', 'btn-sm', 'btn-md', 'btn-lg']

const ROWS = [
  { id: 'SD-1042', unit: 'Реактор', state: 'штатно', load: 62, badge: 'badge-success' },
  { id: 'SD-1043', unit: 'Навигация', state: 'калибровка', load: 88, badge: 'badge-warning' },
  { id: 'SD-1044', unit: 'Связь', state: 'потеря пакетов', load: 97, badge: 'badge-error' },
  { id: 'SD-1045', unit: 'Жизнеобеспечение', state: 'штатно', load: 41, badge: 'badge-info' },
]

/**
 * Данные для «магазинных» секций. Выдуманные, но нарочно неудобные: длинные
 * названия, цены в четыре разряда и подписи вроде «потеря пакетов» — тема
 * ломается именно на них, а не на слове «товар».
 */
const GOODS = [
  {
    name: 'Кресло «Сосновка», дуб',
    icon: 'icon-[solar--armchair-2-bold]',
    price: '18 400 ₽',
    old: '23 000 ₽',
    sale: 20,
    rating: 4,
    reviews: 37,
  },
  {
    name: 'Светильник потолочный',
    icon: 'icon-[solar--lamp-bold]',
    price: '4 990 ₽',
    old: '',
    sale: 0,
    rating: 5,
    reviews: 8,
  },
]

const PLANS = [
  { name: 'Комната', price: '1 200 ₽', best: false, features: ['койко-место', 'общая кухня'] },
  {
    name: 'Полулюкс',
    price: '3 400 ₽',
    best: true,
    features: ['душ в номере', 'завтрак', 'поздний выезд'],
  },
  { name: 'Апартаменты', price: '6 800 ₽', best: false, features: ['две комнаты', 'парковка'] },
]

const STATS = [
  { icon: 'icon-[solar--home-bold]', title: 'Свободно', value: '12', desc: 'из 48 квартир' },
  { icon: 'icon-[solar--key-bold]', title: 'Сдача', value: 'IV кв.', desc: 'корпус 3' },
  { icon: 'icon-[solar--users-group-rounded-bold]', title: 'Броней', value: '9', desc: 'за неделю' },
]

/** Кусок `app.css`, которым тема объявлена. Показываем, чтобы не искать по репе. */
const SNIPPET = `@plugin "daisyui/theme" {
  name: "scifi";
  color-scheme: dark;

  --color-base-100: #0b0f19;
  --color-base-200: #070a11;
  --color-base-300: #101626;
  --color-base-content: #d1d5db;

  --color-primary: #00f3ff;
  --color-secondary: #b000ff;
  --color-accent: #ff5500;

  --radius-selector: 0rem;
  --radius-field: 0.1rem;
  --radius-box: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}`

/** Варианты ауры: дорогие от daisyUI и дешёвые свои. */
const AURAS = [
  { id: 'none', label: 'без анимации', wrap: '', note: 'опорная точка: только статичное свечение темы' },
  { id: 'aura', label: 'daisyUI .aura', wrap: 'aura text-primary', note: 'conic-градиент с анимированным углом + два слоя blur' },
  { id: 'aura-glow', label: 'daisyUI .aura-glow', wrap: 'aura aura-glow text-primary', note: 'анимируется сам радиус blur — самый дорогой вариант' },
  { id: 'sf-aura', label: 'свой .sf-aura', wrap: 'sf-aura text-primary', note: 'готовый градиент, анимируется только rotate' },
  { id: 'sf-glow', label: 'свой .sf-glow', wrap: 'sf-glow text-primary', note: 'статичный ореол, анимируется только opacity' },
] as const

/**
 * Счётчик кадров. Нужен ровно для того, чтобы «этот тормозной» перестало быть
 * вопросом вкуса: включаешь сотню элементов и смотришь на число.
 */
function useFps() {
  const [fps, setFps] = createSignal(0)
  let frames = 0
  let last = performance.now()
  let raf = 0
  const tick = (now: number) => {
    frames++
    if (now - last >= 500) {
      setFps(Math.round((frames * 1000) / (now - last)))
      frames = 0
      last = now
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  onCleanup(() => cancelAnimationFrame(raf))
  return fps
}

function AuraBench() {
  const [kind, setKind] = createSignal<(typeof AURAS)[number]['id']>('sf-aura')
  const [count, setCount] = createSignal(24)
  const fps = useFps()

  const current = () => AURAS.find((a) => a.id === kind())!
  const items = () => Array.from({ length: count() }, (_, i) => i + 1)

  return (
    <>
      <div class="flex flex-wrap items-center gap-2">
        <For each={AURAS}>
          {(a) => (
            <button
              type="button"
              // `class` массивом, а НЕ `classList`: во второй линии Solid такого
              // атрибута нет — он уезжает в DOM как `classlist="[object Object]"`,
              // и классы просто не применяются. Массив и объект `class` берёт сам.
              class={['btn btn-xs', kind() === a.id && 'btn-primary']}
              onClick={() => setKind(a.id)}
            >
              {a.label}
            </button>
          )}
        </For>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="join">
          <For each={[1, 24, 96]}>
            {(n) => (
              <button
                type="button"
                class={['btn join-item btn-xs', count() === n && 'btn-primary']}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            )}
          </For>
        </div>
        <span class="font-mono text-sm tabular-nums">{fps()} fps</span>
        <span class="text-sm">{current().note}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <For each={items()}>
          {(i) => (
            <div class={current().wrap}>
              <button type="button" class="btn btn-sm">
                узел {i}
              </button>
            </div>
          )}
        </For>
      </div>
    </>
  )
}

/**
 * Карточка-секция витрины тем.
 *
 * `wide` — занять две колонки. Нужен там, где содержимое по природе широкое
 * (таблица, карточки товаров): в одной колонке таблица упиралась в
 * горизонтальный скролл и рвала бейджи посреди слова.
 */
function Section(props: { title: string; note?: string; wide?: boolean; children: any }) {
  return (
    <section class={['card bg-base-100', props.wide && 'md:col-span-2']}>
      <div class="card-body gap-3 p-4">
        <div>
          <h3 class="card-title text-base">{props.title}</h3>
          <Show when={props.note}>
            <p class="mt-0.5 text-sm text-base-content">{props.note}</p>
          </Show>
        </div>
        {props.children}
      </div>
    </section>
  )
}

export default function ThemeShowcase() {
  const [range, setRange] = createSignal(70)
  const [on, setOn] = createSignal(true)
  const [pick, setPick] = createSignal('two')

  return (
    // Колонки заданы брейкпоинтами, а не `auto-fit`: при `auto-fit` их число
    // заранее неизвестно, и `col-span-2` у широкой секции норовит создать
    // неявную колонку — раскладка уезжает за край. Здесь же на узком экране
    // колонка одна, и `md:col-span-2` просто не применяется.
    <div class="grid grid-cols-1 items-start gap-4 p-5 text-base-content md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <Section
        title="Поверхности"
        note="Пара «фон + content» показана вместе: если текст на плашке читается с трудом — токены подобраны неверно."
      >
        <div class="grid gap-2">
          <For each={SURFACES}>
            {(s) => (
              <div class={`flex items-center justify-between gap-3 rounded-box px-3 py-2 ${s.bg} ${s.fg} ring-1 ring-base-300`}>
                <span class="font-mono text-sm">{s.token}</span>
                <span class="text-sm">{s.note}</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Акценты" note="Каждый цвет — со своим *-content поверх, ровно как его использует daisyUI.">
        <div class="grid grid-cols-2 gap-2">
          <For each={ACCENTS}>
            {(c) => (
              <div class={`rounded-box px-3 py-2 ${c.bg} ${c.fg}`}>
                <div class="font-mono text-sm">{c.token}</div>
                <div class="text-xs">Aa · текст 12px</div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Кнопки" note="Цвета, стили и размеры. В теме scifi у них срезаны углы и добавлено свечение.">
        <div class="flex flex-wrap gap-2">
          <For each={BTN_COLORS}>{(c) => <button class={`btn btn-sm ${c}`}>{c.replace('btn-', '')}</button>}</For>
        </div>
        <div class="flex flex-wrap gap-2">
          <For each={BTN_STYLES}>{(s) => <button class={`btn btn-sm btn-primary ${s}`}>{s.replace('btn-', '')}</button>}</For>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <For each={BTN_SIZES}>{(s) => <button class={`btn btn-primary ${s}`}>{s.replace('btn-', '')}</button>}</For>
          <button class="btn btn-sm btn-primary" disabled>
            disabled
          </button>
          <button class="btn btn-sm btn-primary">
            <span class="loading loading-spinner loading-xs" />
            loading
          </button>
        </div>
      </Section>

      <Section title="Формы" note="Поля, переключатели и ползунок — на них видно --radius-field и цвет фокуса.">
        <label class="input input-sm w-full">
          <span class="opacity-100">поиск</span>
          <input type="text" placeholder="введите запрос" />
        </label>
        <select class="select select-sm w-full">
          <option>вариант первый</option>
          <option>вариант второй</option>
        </select>
        <textarea class="textarea textarea-sm w-full" rows="2" placeholder="многострочное поле" />
        <div class="flex flex-wrap items-center gap-4">
          <label class="label cursor-pointer gap-2">
            <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" checked />
            <span class="label-text">чекбокс</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
              checked={on()}
              onChange={(e) => setOn(e.currentTarget.checked)}
            />
            <span class="label-text">тумблер</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              name="sf-pick"
              class="radio radio-primary radio-sm"
              checked={pick() === 'one'}
              onChange={() => setPick('one')}
            />
            <span class="label-text">радио</span>
          </label>
        </div>
        <input
          type="range"
          class="range range-primary range-sm"
          min="0"
          max="100"
          value={range()}
          onInput={(e) => setRange(+e.currentTarget.value)}
        />
        <div class="font-mono text-sm">мощность: {range()}%</div>
      </Section>

      <Section
        title="Таблица и бейджи"
        note="Шапка таблицы в теме scifi набрана капсом цветом primary — как строка консоли."
        wide
      >
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>борт</th>
                <th>узел</th>
                <th>статус</th>
                <th class="text-right">нагрузка</th>
              </tr>
            </thead>
            <tbody>
              <For each={ROWS}>
                {(r) => (
                  <tr class="hover:bg-base-200">
                    {/* `whitespace-nowrap`: без него узкая колонка рвала и
                        артикул («SD-» / «1042»), и текст бейджа посреди слова —
                        вторая строка вылезала за скруглённую плашку. */}
                    <td class="font-mono whitespace-nowrap">{r.id}</td>
                    <td>{r.unit}</td>
                    <td>
                      <span class={`badge badge-sm whitespace-nowrap ${r.badge}`}>{r.state}</span>
                    </td>
                    <td class="text-right tabular-nums">{r.load}%</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-primary">primary</span>
          <span class="badge badge-secondary">secondary</span>
          <span class="badge badge-accent">accent</span>
          <span class="badge badge-outline">outline</span>
          <kbd class="kbd kbd-sm">⌘</kbd>
          <kbd class="kbd kbd-sm">K</kbd>
        </div>
      </Section>

      <Section title="Обратная связь" note="Полоски прогресса и сообщения: проверяем, что статусные цвета не сливаются с фоном.">
        <div class="alert alert-info alert-soft">
          <span>Курс проложен, расчётное время — 14 минут.</span>
        </div>
        <div class="alert alert-success alert-soft">
          <span>Стыковка подтверждена.</span>
        </div>
        <div class="alert alert-warning alert-soft">
          <span>Навигация на калибровке, точность снижена.</span>
        </div>
        <div class="alert alert-error alert-soft">
          <span>Потеря пакетов на канале связи.</span>
        </div>
        <progress class="progress progress-primary" value="70" max="100" />
        <progress class="progress progress-warning" value="88" max="100" />
        <div class="flex items-center gap-3">
          <span class="loading loading-spinner text-primary" />
          <span class="loading loading-dots text-secondary" />
          <span class="loading loading-ring text-accent" />
        </div>
      </Section>

      <Section
        title="Оформление кита"
        note="Плитки и панели с теми же переменными, что кит отдаёт потребителю: --dumb-board-grip и --dumb-grid-line."
      >
        <div class="sd-grid !max-h-none">
          <For each={['A1', 'B2', 'C3', 'D4', 'E5', 'F6']}>
            {(t) => <div class="sd-tile border-primary">{t}</div>}
          </For>
        </div>
        <div class="dumb-board-zone">
          <div class="p-2 text-sm">
            Так выглядит зона доски: рамка, скобы по углам и фон base-200. Ручки ресайза кит красит
            через <code class="font-mono">--dumb-board-grip</code>, в этой теме — циан.
          </div>
        </div>
      </Section>

      <Section
        title="Карточки товара"
        note="Ровно тот блок, ради которого тему и заводят: фото, цена, скидка, кнопка. Проверяем, что акцент темы не спорит с ценой, а бейдж скидки читается на любом фоне."
        wide
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={GOODS}>
            {(g) => (
              <div class="card card-compact border border-base-300 bg-base-100">
                {/* Фото — заглушкой: своих картинок кит не несёт, а тянуть
                    внешние в витрину незачем. Иконка в полном цвете, без
                    приглушения: правило контраста действует и на заглушки. */}
                <figure class="grid aspect-[4/3] place-items-center bg-base-200">
                  <span class={`${g.icon} size-12 text-base-content`} />
                </figure>
                <div class="card-body gap-2">
                  <div class="flex items-start justify-between gap-2">
                    <h4 class="card-title text-sm">{g.name}</h4>
                    <Show when={g.sale}>
                      <span class="badge badge-sm badge-error whitespace-nowrap">−{g.sale}%</span>
                    </Show>
                  </div>
                  <div class="flex items-center gap-1">
                    <For each={[1, 2, 3, 4, 5]}>
                      {(i) => (
                        // Незакрашенная звезда — КОНТУРНАЯ иконка обычным
                        // цветом текста, а не сплошная блёклым: `text-base-300`
                        // на `bg-base-100` не читается, а сколько звёзд не
                        // набрано — такая же информация, как сколько набрано.
                        <span
                          class={[
                            'size-4',
                            i <= g.rating
                              ? 'icon-[solar--star-bold] text-warning'
                              : 'icon-[solar--star-linear] text-base-content',
                          ]}
                        />
                      )}
                    </For>
                    <span class="ml-1 text-xs tabular-nums">{g.reviews} отз.</span>
                  </div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-lg font-semibold tabular-nums text-primary">{g.price}</span>
                    <Show when={g.old}>
                      <s class="text-sm tabular-nums">{g.old}</s>
                    </Show>
                  </div>
                  <div class="card-actions">
                    <button type="button" class="btn btn-primary btn-sm flex-1">
                      <span class="icon-[solar--cart-plus-bold] size-4" />В корзину
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm btn-square" title="В избранное">
                      <span class="icon-[solar--heart-bold] size-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section
        title="Объект недвижимости"
        note="Палитры сайтов — жилищные, и вот их естественный блок: цена, площадь, этаж, метро. Длинные подписи здесь нарочно — на них видно, как тема держит плотную строку."
      >
        <div class="card card-compact border border-base-300 bg-base-100">
          <figure class="grid aspect-video place-items-center bg-base-200">
            <span class="icon-[solar--home-smile-bold] size-12 text-base-content" />
          </figure>
          <div class="card-body gap-2">
            <div class="flex flex-wrap gap-1">
              <span class="badge badge-sm badge-primary">сдан</span>
              <span class="badge badge-sm badge-outline">ипотека 4%</span>
            </div>
            <h4 class="card-title text-base">2-комнатная, 64 м²</h4>
            <p class="text-sm">Черёмушки, корпус 3, этаж 7 из 12</p>
            <div class="flex items-center gap-1 text-sm">
              <span class="icon-[solar--map-point-bold] size-4 text-primary" />
              <span>15 минут пешком до метро</span>
            </div>
            <div class="divider my-0" />
            <div class="flex items-end justify-between gap-2">
              <div>
                <div class="text-xl font-semibold tabular-nums text-primary">8 940 000 ₽</div>
                <div class="text-xs tabular-nums">139 700 ₽ за м²</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm">Записаться</button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Тарифы"
        note="Три плашки рядом: средняя выделена рамкой primary. Проверяем, хватает ли акценту силы выделить одну карточку среди одинаковых."
        wide
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <For each={PLANS}>
            {(p) => (
              <div
                class={[
                  'card card-compact bg-base-100',
                  p.best ? 'border-2 border-primary' : 'border border-base-300',
                ]}
              >
                <div class="card-body gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <h4 class="card-title text-sm">{p.name}</h4>
                    <Show when={p.best}>
                      <span class="badge badge-sm badge-primary">выбор</span>
                    </Show>
                  </div>
                  <div class="text-2xl font-semibold tabular-nums">{p.price}</div>
                  <ul class="flex flex-col gap-1 text-sm">
                    <For each={p.features}>
                      {(f) => (
                        <li class="flex items-start gap-1.5">
                          <span class="icon-[solar--check-circle-bold] mt-0.5 size-4 shrink-0 text-success" />
                          <span>{f}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                  <button
                    type="button"
                    class={['btn btn-sm mt-1', p.best ? 'btn-primary' : 'btn-outline']}
                  >
                    Подключить
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section
        title="Отзыв и профиль"
        note="Аватар, звёзды и цитата. Аватар — плашка с инициалами: кит картинок не носит, а тема обязана выглядеть прилично и без них."
      >
        <div class="flex items-start gap-3">
          <div class="avatar avatar-placeholder">
            <div class="w-12 rounded-full bg-neutral text-neutral-content">
              <span class="text-lg">ИП</span>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold">Ирина П.</span>
              <span class="badge badge-xs badge-success whitespace-nowrap">купила здесь</span>
            </div>
            <div class="flex items-center gap-0.5">
              <For each={[1, 2, 3, 4, 5]}>
                {(i) => (
                  <span
                    class={[
                      'size-4',
                      i <= 4
                        ? 'icon-[solar--star-bold] text-warning'
                        : 'icon-[solar--star-linear] text-base-content',
                    ]}
                  />
                )}
              </For>
              <span class="ml-1 text-xs">12 марта</span>
            </div>
            <p class="text-sm">
              Заселились в срок, двор закрытый, до метро действительно пятнадцать минут. Полы
              пришлось выравнивать, но это мелочь.
            </p>
          </div>
        </div>
        <div class="chat chat-start">
          <div class="chat-header text-xs">Отдел продаж</div>
          <div class="chat-bubble chat-bubble-primary text-sm">
            Спасибо! Про полы передали в строительный контроль.
          </div>
        </div>
      </Section>

      <Section
        title="Навигация"
        note="Крошки, вкладки и пагинация. Самое коварное место темы: у активного пункта и у ссылки под курсором цвета разные, и оба обязаны читаться."
      >
        <div class="breadcrumbs py-0 text-sm">
          <ul>
            <li>
              <a>Главная</a>
            </li>
            <li>
              <a>Квартиры</a>
            </li>
            <li>Корпус 3</li>
          </ul>
        </div>
        <div role="tablist" class="tabs tabs-box">
          <a role="tab" class="tab">
            Описание
          </a>
          <a role="tab" class="tab tab-active">
            Планировки
          </a>
          <a role="tab" class="tab">
            Ход стройки
          </a>
        </div>
        <div class="join">
          <button type="button" class="btn join-item btn-sm">
            «
          </button>
          <button type="button" class="btn join-item btn-sm btn-active">
            1
          </button>
          <button type="button" class="btn join-item btn-sm">
            2
          </button>
          <button type="button" class="btn join-item btn-sm">
            3
          </button>
          <button type="button" class="btn join-item btn-sm">
            »
          </button>
        </div>
      </Section>

      <Section
        title="Сводка"
        note="Цифры крупно. У daisyUI подписи `stat-title` и `stat-desc` приглушены до 60% — здесь непрозрачность возвращена: по правилу репы блёклых подписей быть не должно."
      >
        <div class="stats stats-vertical border border-base-300 bg-base-100 sm:stats-horizontal">
          <For each={STATS}>
            {(s) => (
              <div class="stat">
                <div class="stat-figure text-primary">
                  <span class={`${s.icon} size-7`} />
                </div>
                <div class="stat-title opacity-100">{s.title}</div>
                <div class="stat-value text-2xl tabular-nums text-primary">{s.value}</div>
                <div class="stat-desc opacity-100">{s.desc}</div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section
        title="Аура: дорогая и дешёвая"
        note="Переключи вариант и подними число до 96 — счётчик кадров покажет цену. У daisyUI анимируется угол conic-градиента и радиус blur (перерисовка каждый кадр), у своих — только rotate и opacity, которые двигает композитор."
      >
        <AuraBench />
      </Section>

      <Section title="Как объявлена тема" note="Файл playground/src/app.css. daisyUI 5: тема — это набор CSS-переменных, а не JS-объект.">
        <pre class="overflow-x-auto rounded-box bg-base-200 p-3 text-xs leading-relaxed">
          <code>{SNIPPET}</code>
        </pre>
        <p class="text-sm">
          Свечение, фаска и сканлайны темой не задаются — они лежат отдельным блоком{' '}
          <code class="font-mono">[data-theme="scifi"]</code> там же и навешаны на классы daisyUI,
          поэтому примеры кита ради темы не переверстаны.
        </p>
      </Section>
    </div>
  )
}
