// Крошечный zero-dep FLIP-сортировщик для Solid: вертикальный список ИЛИ сетка,
// с авто-скроллом, переменной высотой строк и нулевым reflow.
// Зачем свой, а не @dnd-kit: dnd-kit меряет getBoundingClientRect покадрово во
// время драга → reflow → джанк (поэтому раньше пришлось гасить optimistic).
// Здесь позиции ячеек снимаются ОДИН раз на старте через IntersectionObserver
// (entry.boundingClientRect считается off-main-thread, БЕЗ reflow —
//  https://toruskit.com/blog/how-to-get-element-bounds-without-reflow),
// а во время движения мы ТОЛЬКО пишем transform (GPU/compositor, без layout).
//
// Движок — FLIP «элемент → ячейка»: каждому элементу считаем новый визуальный
// индекс и двигаем его в СНЯТУЮ позицию той ячейки (translate dx,dy). Отсюда даром:
//   • переменная высота строк (берём реальные позиции, не усреднённый шаг);
//   • сетка (дельта по X и Y, диагональный прыжок на переносе строки).
// Вся математика — в координатах КОНТЕНТА контейнера (− top/left + scroll),
// поэтому хиттест/сдвиги иммунны к скроллу и авто-скролл у краёв «просто работает».
// Порядок массива коммитим на pointerup → opts.onEnd(fromIndex, toIndex).

import { onCleanup } from 'solid-js';

export type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
};

type Cell = { left: number; top: number; width: number; height: number };
type Item = { id: string; cx: number; cy: number; top: number; bottom: number };

type Drag = {
    id: string;
    pid: number;
    startX: number; startY: number;
    lastX: number; lastY: number;
    dragEl: HTMLElement;
    ids: string[];
    fromIndex: number;
    cells: Cell[];          // позиции ячеек по визуальному индексу (порядок ids)
    others: Item[];         // чужие ячейки в порядке чтения (для хиттеста)
    toIndex: number;
    scroller: HTMLElement | null;
    scrollX0: number; scrollY0: number;
    scrollMax0: number;     // предел прокрутки на старте (до трансформа dragged)
    raf: number;
    ready: boolean;
    moved: boolean;         // указатель реально сдвинулся (иначе не авто-скроллим — иначе дёрг при захвате у края)
};

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)';
const EDGE = 48;          // зона авто-скролла у края, px
const MAX_SPEED = 18;     // скорость авто-скролла у самого края, px/кадр
const ACCEL = 3.5;        // во сколько раз быстрее при сильном уходе за контейнер
const LONGPRESS = 350;    // тач: удержание до старта драга, мс
const MOVE_TOL = 10;      // тач: сдвиг за время удержания = скролл, отменяем, px
const LIFT_SHADOW = '0 10px 24px -6px rgba(0,0,0,.28)';

function scrollParent(el: HTMLElement): HTMLElement | null {
    let n = el.parentElement;
    while (n) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && n.scrollHeight > n.clientHeight) return n;
        n = n.parentElement;
    }
    return null;
}

function view(scroller: HTMLElement | null) {
    if (scroller) {
        const r = scroller.getBoundingClientRect();
        return { top: r.top, left: r.left, sy: scroller.scrollTop, sx: scroller.scrollLeft, clientH: scroller.clientHeight, clientW: scroller.clientWidth, max: scroller.scrollHeight - scroller.clientHeight };
    }
    const se = document.scrollingElement || document.documentElement;
    return { top: 0, left: 0, sy: window.scrollY, sx: window.scrollX, clientH: window.innerHeight, clientW: window.innerWidth, max: se.scrollHeight - window.innerHeight };
}
function doScroll(scroller: HTMLElement | null, dy: number) {
    if (scroller) scroller.scrollTop += dy;
    else window.scrollBy(0, dy);
}

export type DumbSortableOptions = {
    /** текущий визуальный порядок id (совпадает с порядком data) */
    order: () => string[];
    /** 'y' — вертикальный список (по умолчанию), 'grid' — двумерная сетка */
    axis?: 'y' | 'grid';
    /** drag запрещён (напр. активна сортировка колонки) */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Имеет приоритет над mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу, как было). По умолчанию 0 */
    mouseThreshold?: number;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};

export function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle {
    const grid = opts.axis === 'grid';
    const pressDelay = opts.pressDelay ?? LONGPRESS;
    const mousePress = opts.mousePressDelay ?? 0;
    const mouseThresh = opts.mouseThreshold ?? 0;
    const rowEls = new Map<string, HTMLElement>();
    let drag: Drag | null = null;

    // Снимок позиций ВСЕХ строк на старте драга. Ключевой трюк: даже если в DOM
    // тысячи элементов, страница НЕ захлебнётся синхронным reflow — мы не зовём
    // getBoundingClientRect в цикле (он форсил бы layout на каждый элемент). Вместо
    // этого IntersectionObserver отдаёт boundingClientRect батчем, посчитанным
    // off-main-thread, за один асинхронный колбэк → ноль форсированных reflow.
    function snapshot(ids: string[], cb: (rects: Map<string, DOMRectReadOnly>) => void) {
        const out = new Map<string, DOMRectReadOnly>();
        const io = new IntersectionObserver(entries => {
            for (const e of entries) {
                const el = e.target as HTMLElement;
                if (el.dataset.flipId) out.set(el.dataset.flipId, e.boundingClientRect);
            }
            io.disconnect();
            cb(out);
        });
        let n = 0;
        for (const id of ids) { const el = rowEls.get(id); if (el) { io.observe(el); n++; } }
        if (n === 0) cb(out);
    }

    // позиция вставки (reduced index) по указателю в координатах контента
    function hitIndex(d: Drag, pX: number, pY: number): number {
        let k = 0;
        for (const o of d.others) {
            if (grid) {
                if (pY > o.bottom) k++;                          // указатель ниже всей строки
                else if (pY >= o.top && pX > o.cx) k++;          // в той же строке, правее центра
            } else {
                if (pY > o.cy) k++;                              // вертикаль: ниже центра
            }
        }
        return k;
    }

    function frame() {
        if (!drag) return;
        const d = drag;
        const v = view(d.scroller);

        // авто-скролл: чем дальше указатель за краем контейнера — тем быстрее (до ACCEL× потолка).
        // ВАЖНО: только после реального движения — иначе захват у нижнего края сразу скроллит,
        // dragged получает +ty, его трансформ растит scrollHeight → скроллбар/сдвиг/съезд сортировки.
        let speed = 0;
        if (d.moved) {
            const distTop = d.lastY - v.top;
            const distBot = v.top + v.clientH - d.lastY;
            // предел снизу — снятый на старте (живой scrollHeight растёт от трансформа dragged → гонка)
            if (distTop < EDGE && v.sy > 0) {
                const over = (EDGE - distTop) / EDGE;          // 0 у границы зоны, 1 у края, >1 за пределами
                speed = -Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
            } else if (distBot < EDGE && v.sy < d.scrollMax0) {
                const over = (EDGE - distBot) / EDGE;
                speed = Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
            }
        }
        if (speed) doScroll(d.scroller, speed);

        const vv = speed ? view(d.scroller) : v;
        // перетаскиваемая следует за курсором (+ компенсация прокрутки контента)
        let tx = grid ? (d.lastX - d.startX) + (vv.sx - d.scrollX0) : 0;
        let ty = (d.lastY - d.startY) + (vv.sy - d.scrollY0);
        // кламп: перетаскиваемый не выходит за видимую область контейнера
        if (d.ready && d.cells.length) {
            const cell = d.cells[d.fromIndex];
            const top = Math.max(vv.sy, Math.min(vv.sy + vv.clientH - cell.height, cell.top + ty));
            ty = top - cell.top;
            if (grid) {
                const left = Math.max(vv.sx, Math.min(vv.sx + vv.clientW - cell.width, cell.left + tx));
                tx = left - cell.left;
            }
        }
        d.dragEl.style.transform = `translate(${tx}px,${ty}px)`;

        if (d.ready) {
            const pX = d.lastX - vv.left + vv.sx;
            const pY = d.lastY - vv.top + vv.sy;
            const k = hitIndex(d, pX, pY);
            d.toIndex = k;
            if (grid) {
                // грид: FLIP-маппинг «элемент → исходная ячейка нового индекса»
                // (корректно для одинаковых ячеек; для грида это норм)
                d.ids.forEach((id, i) => {
                    if (id === d.id) return;
                    const el = rowEls.get(id);
                    if (!el) return;
                    const ri = i < d.fromIndex ? i : i - 1;
                    const newVis = ri < k ? ri : ri + 1;
                    const cell = d.cells[newVis], me = d.cells[i];
                    const dx = cell.left - me.left, dy = cell.top - me.top;
                    el.style.transform = (dx || dy) ? `translate(${dx}px,${dy}px)` : '';
                });
            } else {
                // вертикаль: накопительная раскладка по РЕАЛЬНЫМ высотам (разная высота строк).
                // Кладём чужих по порядку, на позиции k резервируем дырку под перетаскиваемую.
                const dragH = d.cells[d.fromIndex].height;
                const colTop = d.cells[0].top;
                const gap = d.cells.length > 1 ? Math.max(0, d.cells[1].top - d.cells[0].top - d.cells[0].height) : 0;
                let cursor = colTop, oi = 0;
                for (let v = 0; v < d.ids.length; v++) {
                    if (v === k) { cursor += dragH + gap; continue; }   // дырка под dragged
                    while (d.ids[oi] === d.id) oi++;                    // пропустить перетаскиваемую
                    const oc = d.cells[oi];
                    const el = rowEls.get(d.ids[oi]);
                    oi++;
                    if (el) { const dy = cursor - oc.top; el.style.transform = dy ? `translateY(${dy}px)` : ''; }
                    cursor += oc.height + gap;
                }
            }
        }
        d.raf = requestAnimationFrame(frame);
    }

    function onMove(ev: PointerEvent) {
        if (!drag || ev.pointerId !== drag.pid) return;
        if (!drag.moved && (Math.abs(ev.clientX - drag.startX) > 2 || Math.abs(ev.clientY - drag.startY) > 2)) drag.moved = true;
        drag.lastX = ev.clientX;
        drag.lastY = ev.clientY;
    }

    function cleanup() {
        if (!drag) return;
        const d = drag;
        if (d.raf) cancelAnimationFrame(d.raf);
        for (const id of d.ids) {
            const el = rowEls.get(id);
            if (!el) continue;
            el.style.transition = '';
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.position = '';
            el.style.willChange = '';
            el.style.boxShadow = '';
            el.style.opacity = '';
            el.style.cursor = '';
        }
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        drag = null;
    }

    function onUp(ev: PointerEvent) {
        if (!drag || ev.pointerId !== drag.pid) return;
        const { fromIndex, toIndex, ready } = drag;
        cleanup();
        if (ready && toIndex !== fromIndex) opts.onEnd(fromIndex, toIndex);
    }

    function begin(id: string, handle: HTMLElement, pid: number, x: number, y: number) {
        const dragEl = rowEls.get(id);
        if (!dragEl) return;
        const ids = opts.order();
        const fromIndex = ids.indexOf(id);
        if (fromIndex < 0) return;

        const scroller = scrollParent(dragEl);
        const v0 = view(scroller);
        drag = {
            id, pid,
            startX: x, startY: y, lastX: x, lastY: y,
            dragEl, ids, fromIndex, cells: [], others: [], toIndex: fromIndex,
            scroller, scrollX0: v0.sx, scrollY0: v0.sy, scrollMax0: v0.max, raf: 0, ready: false, moved: false,
        };
        dragEl.style.position = 'relative';
        dragEl.style.zIndex = '2';
        dragEl.style.willChange = 'transform';
        // «подъём»: тень + лёгкая прозрачность (плавно; transform НЕ анимируем — он следует за курсором)
        dragEl.style.boxShadow = LIFT_SHADOW;
        dragEl.style.opacity = '0.97';
        dragEl.style.cursor = 'grabbing';
        dragEl.style.transition = 'box-shadow .15s ease, opacity .15s ease';
        document.body.style.userSelect = 'none';
        for (const oid of ids) {
            if (oid === id) continue;
            const el = rowEls.get(oid);
            if (el) { el.style.transition = SLIDE; el.style.willChange = 'transform'; }
        }

        // bounds без reflow → ячейки (в координатах контента) + чужие центры для хиттеста
        snapshot(ids, rects => {
            if (!drag || drag.id !== id) return;
            const w = view(scroller);
            const ox = (r: DOMRectReadOnly) => r.left - w.left + w.sx;
            const oy = (r: DOMRectReadOnly) => r.top - w.top + w.sy;
            drag.cells = ids.map(i => { const r = rects.get(i); return r ? { left: ox(r), top: oy(r), width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 }; });
            drag.others = ids
                .filter(oid => oid !== id)
                .map(oid => {
                    const r = rects.get(oid)!;
                    const l = ox(r), t = oy(r);
                    return { id: oid, cx: l + r.width / 2, cy: t + r.height / 2, top: t, bottom: t + r.height };
                });
            drag.ready = true;
        });

        try { handle.setPointerCapture(pid); } catch { /* noop */ }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        drag.raf = requestAnimationFrame(frame);
    }

    // ожидание старта: тач — long-press ('press'), мышь — порог-дистанция ('dist')
    let pending: { id: string; handle: HTMLElement; pid: number; x: number; y: number; timer: any; mode: 'press' | 'dist'; thresh: number } | null = null;
    function addPend() {
        window.addEventListener('pointermove', pendMove);
        window.addEventListener('pointerup', pendCancel);
        window.addEventListener('pointercancel', pendCancel);
    }
    function clearPending() {
        if (!pending) return;
        clearTimeout(pending.timer);
        window.removeEventListener('pointermove', pendMove);
        window.removeEventListener('pointerup', pendCancel);
        window.removeEventListener('pointercancel', pendCancel);
        pending = null;
    }
    function pendMove(ev: PointerEvent) {
        if (!pending || ev.pointerId !== pending.pid) return;
        const moved = Math.abs(ev.clientX - pending.x) > pending.thresh || Math.abs(ev.clientY - pending.y) > pending.thresh;
        if (!moved) return;
        if (pending.mode === 'press') clearPending();             // палец поехал = скролл, отменяем
        else { const p = pending; clearPending(); begin(p.id, p.handle, p.pid, ev.clientX, ev.clientY); } // мышь: старт
    }
    function pendCancel(ev: PointerEvent) {
        if (pending && ev.pointerId === pending.pid) clearPending();
    }

    function onDown(id: string, handle: HTMLElement, ev: PointerEvent) {
        if (ev.button !== 0 || opts.disabled?.() || drag || pending) return;
        if (!rowEls.get(id)) return;
        const touch = ev.pointerType === 'touch';
        const delay = touch ? pressDelay : mousePress;
        if (delay > 0) {
            // long-press (тач или мышь): ждём удержание, отмена при сдвиге или отпускании
            pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'press', thresh: MOVE_TOL };
            pending.timer = setTimeout(() => {
                const p = pending; clearPending();
                if (p) { if (touch) navigator.vibrate?.(8); begin(p.id, p.handle, p.pid, p.x, p.y); }
            }, delay);
            addPend();
            return;
        }
        if (!touch && mouseThresh > 0) {
            // мышь: стартуем только после сдвига на mouseThreshold px
            pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'dist', thresh: mouseThresh };
            addPend();
            return;
        }
        ev.preventDefault();
        begin(id, handle, ev.pointerId, ev.clientX, ev.clientY);
    }

    onCleanup(() => { clearPending(); cleanup(); });

    return {
        // самодостаточный ref: регистрирует элемент И навешивает старт драга.
        // ручка = дочка с [data-drag-handle] (делегирование); нет её → тянем за весь элемент.
        bind: (id: string) => (el: HTMLElement) => {
            el.dataset.flipId = id;
            rowEls.set(id, el);
            const h = el.querySelector('[data-drag-handle]') as HTMLElement | null;
            if (h) h.style.touchAction = 'none';
            const down = (ev: PointerEvent) => {
                const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null;
                if (handle && !(ev.target instanceof Node && handle.contains(ev.target))) return;
                onDown(id, handle || el, ev);
            };
            el.addEventListener('pointerdown', down);
            onCleanup(() => {
                el.removeEventListener('pointerdown', down);
                if (rowEls.get(id) === el) rowEls.delete(id);
            });
        },
        // низкоуровневые рефы (для ручной разводки; используются текущими DataTable/ColorsEditor)
        row: (id: string) => (el: HTMLElement) => {
            el.dataset.flipId = id;
            rowEls.set(id, el);
            onCleanup(() => { if (rowEls.get(id) === el) rowEls.delete(id); });
        },
        handle: (id: string) => (el: HTMLElement) => {
            const down = (ev: PointerEvent) => onDown(id, el, ev);
            el.addEventListener('pointerdown', down);
            onCleanup(() => el.removeEventListener('pointerdown', down));
        },
    };
}
