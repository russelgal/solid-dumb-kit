// DumbLightbox — просмотрщик: во весь экран, листать, зумить.
//
// Рисуется нативным `<dialog>`, то есть в top layer: над всем на странице,
// с блокировкой фокуса и Esc от браузера. Масштаб и сдвиг — только `transform`,
// layout не трогается, поэтому зум колесом идёт в кадре даже на большой
// картинке.
//
// Соседние картинки подгружаются заранее — по одной вперёд и назад. Без этого
// каждое нажатие стрелки показывает пустоту, и просмотр превращается в
// ожидание.
import { For, createSignal } from 'solid-js'
import { DumbLightbox } from '@solid-dumb-kit/lightbox'
import { Bar, Note, Btn } from '../_controls'

/**
 * Картинки — с picsum.photos, по фиксированным id: так набор не меняется между
 * заходами и видно, что соседние уже в кеше.
 */
const SHOTS = [1003, 1015, 1024, 1039, 1043, 1050, 1057, 1069].map((id, i) => ({
  url: `https://picsum.photos/id/${id}/1600/1000`,
  preview: `https://picsum.photos/id/${id}/320/200`,
  title: `Снимок ${i + 1} · id ${id}`,
}))

export default function DumbLightboxExample() {
  const [shown, setShown] = createSignal<number | null>(null)

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbLightbox — просмотр во весь экран</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <b>←</b> и <b>→</b> листают по кругу, <b>+</b>/<b>−</b> и колесо — масштаб, <b>0</b>{' '}
        сбрасывает, двойной клик увеличивает и возвращает. Увеличенную картинку можно таскать.{' '}
        <b>Esc</b> и клик по фону закрывают.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Внутри — нативный <code>&lt;dialog&gt;</code>, а не свой <code>position: fixed</code> с
        большим <code>z-index</code>: элемент в <b>top layer</b> стоит над всем, включая чужие
        модалки, и его не режет <code>overflow: hidden</code> у предков.
      </p>

      <Bar>
        <Btn onClick={() => setShown(0)}>Открыть первую</Btn>
        <Btn onClick={() => setShown(SHOTS.length - 1)}>Открыть последнюю</Btn>
        <Note>{shown() === null ? 'закрыт' : `открыт снимок ${(shown() ?? 0) + 1}`}</Note>
      </Bar>

      <div class="grid max-w-[92ch] grid-cols-2 gap-3 sm:grid-cols-4">
        <For each={SHOTS}>
          {(shot, i) => (
            <button
              class="overflow-hidden rounded-box border border-base-300"
              onClick={() => setShown(i())}
              title={shot.title}
            >
              <img
                src={shot.preview}
                alt={shot.title}
                loading="lazy"
                class="aspect-[16/10] w-full object-cover"
              />
            </button>
          )}
        </For>
      </div>

      <DumbLightbox
        items={SHOTS}
        index={shown}
        onIndexChange={setShown}
        actions={(item) => (
          <a class="btn btn-sm" href={item.url} target="_blank" rel="noopener">
            Открыть оригинал
          </a>
        )}
      />
    </div>
  )
}
