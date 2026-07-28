// Перетаскивание МЕЖДУ контейнерами (канбан): несколько зон, один драг.
//
// Та же физика, что в sortableCore — снимок позиций один раз через
// IntersectionObserver, движение только transform, ноль forced layout в кадре, —
// но зон много, поэтому:
//   • снимок один на все зоны (элементы + сами контейнеры одним IO);
//   • у каждой зоны свой скроллер, геометрия кэшируется на старте, в кадре
//     читаются только scrollTop/scrollLeft и window.scrollX/Y;
//   • оригинал ОСТАЁТСЯ В ПОТОКЕ (просто прячется): его место держится само,
//     колонка не схлопывается, высота контейнера не скачет, компенсации не нужны.
//     За курсором летит КЛОН, поднятый в top layer через Popover API — top layer
//     не обрезается overflow колонки и не зависит от transform-предков.
//     Клон вставляется рядом с оригиналом, а не в body, поэтому наследует
//     CSS-контекст (правила вида `.column .card`, переменные) и выглядит так же.
//
// Порядок коммитим на pointerup → onEnd({list,index}, {list,index}).

import { onCleanup } from 'solid-js';
import {
    autoScrollSpeed, gapOf, holeTop, nextInsertIndex, shiftLayout, viewOrigin,
    type Cell, type ViewGeom,
} from './geometry';
import { measure, scrollOf, scrollParent } from '../shared/viewport';

export type SortableGroupOptions = {
    /** перенос завершён: откуда (зона+индекс) и куда */
    onEnd: (
        from: { list: string; index: number },
        to: { list: string; index: number },
    ) => void;
    /** запретить драг целиком */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс. По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл) */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу) */
    mouseThreshold?: number;
};

export type SortableListOptions = {
    /** визуальный порядок id внутри этой зоны */
    order: () => string[];
    /** принимать ли элемент из зоны `from` (по умолчанию принимает всех) */
    accepts?: (from: string) => boolean;
};

export type SortableListHandle = {
    /** ref на контейнер зоны */
    container: (el: HTMLElement) => void;
    /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
};

export type SortableGroupHandle = {
    /** зарегистрировать зону */
    list: (name: string, opts: SortableListOptions) => SortableListHandle;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
};

type Zone = {
    name: string;
    opts: SortableListOptions;
    el: HTMLElement | null;
    els: Map<string, HTMLElement>;
};

type ZoneSnap = {
    name: string;
    scroller: HTMLElement | null;
    geom: ViewGeom;          // геометрия скроллера зоны (для автоскролла и клампа)
    boxTop: number;          // позиция контейнера во вьюпорте на старте
    boxLeft: number;
    boxW: number;
    boxH: number;
    boxWinX: number;         // скролл окна на момент снимка контейнера
    boxWinY: number;
    scrollX0: number;
    scrollY0: number;
    ids: string[];           // элементы зоны (без перетаскиваемого)
    cells: Cell[];           // их позиции в координатах контента зоны
    top: number;             // верх колонки (координаты контента)
    gap: number;
};

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)';
const LONGPRESS = 350;
const MOVE_TOL = 10;
const LIFT_SHADOW = '0 12px 28px -8px rgba(0,0,0,.35)';
const RESET_STYLE_ID = 'dumb-sortable-ghost';

const canPopover = () =>
    typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

// UA-стили [popover] (рамка, паддинг, фон, inset:0 + margin:auto) утащили бы клон
// в центр экрана. Сбрасываем их В СЛОЕ: слой проигрывает любым авторским стилям,
// поэтому собственное оформление карточки остаётся нетронутым.
function injectGhostReset() {
    if (typeof document === 'undefined' || document.getElementById(RESET_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = RESET_STYLE_ID;
    style.textContent = `@layer dumb-sortable {
  [data-dumb-ghost]:popover-open {
    position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
    background: transparent; color: inherit; overflow: visible;
  }
}`;
    document.head.appendChild(style);
}

/** копия перетаскиваемого, поднятая в top layer и летящая за курсором */
function makeGhost(src: HTMLElement, r: DOMRectReadOnly): HTMLElement {
    const ghost = src.cloneNode(true) as HTMLElement;
    ghost.setAttribute('data-dumb-ghost', '');
    ghost.removeAttribute('id');
    // рядом с оригиналом — чтобы сработали CSS-правила, зависящие от родителя
    src.insertAdjacentElement('afterend', ghost);

    if (canPopover()) {
        ghost.setAttribute('popover', 'manual');
        try { ghost.showPopover(); } catch { /* фолбэк: обычный fixed */ }
    }
    // rect — border-box, а width/height задают content-box: без box-sizing
    // клон раздулся бы ровно на свои паддинги и рамку
    ghost.style.boxSizing = 'border-box';
    ghost.style.position = 'fixed';
    ghost.style.margin = '0';
    ghost.style.top = `${r.top}px`;
    ghost.style.left = `${r.left}px`;
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.willChange = 'transform';
    ghost.style.boxShadow = LIFT_SHADOW;
    ghost.style.cursor = 'grabbing';
    return ghost;
}

function originOf(z: ZoneSnap) {
    return z.scroller ? viewOrigin(z.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
}

/** прямоугольник контейнера во вьюпорте сейчас (компенсируем прокрутку страницы) */
function boxOf(z: ZoneSnap) {
    const dx = window.scrollX - z.boxWinX;
    const dy = window.scrollY - z.boxWinY;
    return { top: z.boxTop - dy, left: z.boxLeft - dx, right: z.boxLeft - dx + z.boxW, bottom: z.boxTop - dy + z.boxH };
}

type Drag = {
    id: string;
    fromList: string;
    fromIndex: number;
    dragEl: HTMLElement;
    pid: number;
    startX: number; startY: number;
    lastX: number; lastY: number;
    dragH: number;
    zones: Map<string, ZoneSnap>;
    active: string;
    k: number;
    raf: number;
    ready: boolean;
    moved: boolean;
    prevStyle: string;
    /** карточки, которым довелось поехать — только их стили и трогаем */
    touched: Set<HTMLElement>;
    /** клон в top layer, летящий за курсором */
    ghost: HTMLElement | null;
    /** где клон был закреплён (координаты вьюпорта) */
    ghostX0: number; ghostY0: number;
};

export function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle {
    const pressDelay = opts.pressDelay ?? LONGPRESS;
    const mousePress = opts.mousePressDelay ?? 0;
    const mouseThresh = opts.mouseThreshold ?? 0;

    const zones = new Map<string, Zone>();
    let drag: Drag | null = null;
    let activeName: string | null = null;
    let draggingId: string | null = null;

    /** один IO на элементы всех зон + сами контейнеры: батч, ноль forced layout */
    function snapshot(cb: (rects: Map<Element, DOMRectReadOnly>) => void) {
        const out = new Map<Element, DOMRectReadOnly>();
        const targets: Element[] = [];
        for (const z of zones.values()) {
            if (z.el) targets.push(z.el);
            for (const id of z.opts.order()) {
                const el = z.els.get(id);
                if (el) targets.push(el);
            }
        }
        if (!targets.length) { cb(out); return; }
        const io = new IntersectionObserver(entries => {
            for (const e of entries) out.set(e.target, e.boundingClientRect);
            io.disconnect();
            cb(out);
        });
        for (const t of targets) io.observe(t);
    }

    function buildZoneSnaps(rects: Map<Element, DOMRectReadOnly>, dragId: string): Map<string, ZoneSnap> {
        const snaps = new Map<string, ZoneSnap>();
        for (const z of zones.values()) {
            if (!z.el) continue;
            const scroller = scrollParent(z.el, true);
            const geom = measure(scroller);
            const s0 = scrollOf(scroller);
            const box = rects.get(z.el);
            const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };

            // Верх колонки и зазор считаем по ПОЛНОМУ набору ячеек — вместе с
            // перетаскиваемой. Иначе, если тащат первую карточку, за верх колонки
            // принимается позиция второй (вся колонка съезжает), а если тащат
            // среднюю — зазор меряется через её место и оказывается завышен.
            const ids: string[] = [];
            const cells: Cell[] = [];
            const allCells: Cell[] = [];
            for (const id of z.opts.order()) {
                const el = z.els.get(id);
                const r = el && rects.get(el);
                if (!r) continue;
                const cell: Cell = {
                    left: r.left - origin.left + s0.sx,
                    top: r.top - origin.top + s0.sy,
                    width: r.width, height: r.height,
                };
                allCells.push(cell);
                if (id === dragId) continue;             // в раскладке сам перетаскиваемый не участвует
                ids.push(id);
                cells.push(cell);
            }

            snaps.set(z.name, {
                name: z.name, scroller, geom,
                boxTop: box ? box.top : geom.top,
                boxLeft: box ? box.left : geom.left,
                boxW: box ? box.width : geom.clientW,
                boxH: box ? box.height : geom.clientH,
                boxWinX: window.scrollX, boxWinY: window.scrollY,
                scrollX0: s0.sx, scrollY0: s0.sy,
                ids, cells,
                top: allCells.length ? allCells[0].top : s0.sy,
                gap: gapOf(allCells),
            });
        }
        return snaps;
    }

    /** зона под указателем; если ни одной — оставляем прошлую (дроп у края не теряется) */
    function zoneAt(d: Drag, x: number, y: number): string {
        for (const z of d.zones.values()) {
            const b = boxOf(z);
            if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
                const accepts = zones.get(z.name)?.opts.accepts;
                if (accepts && !accepts(d.fromList)) continue;
                return z.name;
            }
        }
        return d.active;
    }

    /** разложить все зоны под текущую позицию вставки (d.active, d.k) */
    function applyLayout(d: Drag) {
        for (const zz of d.zones.values()) {
            // Перетаскиваемый остаётся в потоке своей колонки, поэтому её место
            // никуда не девается: в активной зоне дырка едет за указателем, в
            // родной (когда указатель ушёл в другую) — держится там, где была.
            const home = zz.name === d.fromList;
            const to = zz.name === d.active ? d.k : home ? d.fromIndex : null;
            const dy = shiftLayout({
                count: zz.ids.length,
                from: home ? d.fromIndex : null,
                to,
                amount: d.dragH + zz.gap,
            });
            zz.ids.forEach((id, i) => {
                const el = zones.get(zz.name)?.els.get(id);
                if (!el) return;
                if (!dy[i]) {
                    if (d.touched.has(el)) el.style.transform = '';
                    return;
                }
                // Стили — ТОЛЬКО тем, кто реально поехал: вешать transition и
                // will-change всем карточкам всех колонок на старте означало бы
                // пачку лишних записей и композиторных слоёв на ровном месте.
                if (!d.touched.has(el)) {
                    d.touched.add(el);
                    el.style.transition = SLIDE;
                    el.style.willChange = 'transform';
                    return;                       // поедет со следующего кадра, зато плавно
                }
                el.style.transform = `translateY(${dy[i]}px)`;
            });
        }
    }

    function frame() {
        if (!drag) return;
        const d = drag;

        // клон висит в top layer (координаты вьюпорта) — просто следует за курсором,
        // прокрутку компенсировать не нужно: он не внутри колонки
        if (d.ghost) {
            d.ghost.style.transform = `translate(${d.lastX - d.startX}px,${d.lastY - d.startY}px)`;
        }

        if (d.ready) {
            const prevActive = d.active;
            const active = zoneAt(d, d.lastX, d.lastY);
            d.active = active;
            activeName = active;
            const z = d.zones.get(active);

            if (z) {
                const origin = originOf(z);
                let { sx, sy } = scrollOf(z.scroller);

                // автоскролл — у активной зоны
                const speed = d.moved
                    ? autoScrollSpeed({
                        pointerY: d.lastY, viewTop: origin.top, clientH: z.geom.clientH,
                        scrollY: sy, scrollMax: z.geom.max,
                    })
                    : 0;
                if (speed) {
                    if (z.scroller) z.scroller.scrollTop += speed; else window.scrollBy(0, speed);
                    ({ sx, sy } = scrollOf(z.scroller));
                }

                const pY = d.lastY - origin.top + sy;
                // считаем от ТЕКУЩЕЙ дырки по видимым позициям; при заходе в новую
                // колонку прошлое k к ней не относится — начинаем с нуля
                const from = active === prevActive ? d.k : 0;
                d.k = nextInsertIndex({
                    cells: z.cells, gap: z.gap, top: z.top,
                    holeH: d.dragH, k: from, pointerY: pY,
                });
                applyLayout(d);
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

    function detach() {
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
    }

    function resetStyles(d: Drag) {
        if (d.ghost) {
            try { d.ghost.hidePopover(); } catch { /* noop */ }
            d.ghost.remove();
            d.ghost = null;
        }
        d.dragEl.style.cssText = d.prevStyle;

        for (const el of d.touched) {      // остальных мы и не трогали
            el.style.transition = '';
            el.style.transform = '';
            el.style.willChange = '';
        }
    }

    function cleanup() {
        if (!drag) return;
        const d = drag;
        if (d.raf) cancelAnimationFrame(d.raf);
        detach();
        resetStyles(d);
        drag = null;
        activeName = null;
        draggingId = null;
    }

    function onKey(ev: KeyboardEvent) {
        if (ev.key === 'Escape' && drag) { drag.ready = false; cleanup(); }
    }

    /** довести клон до места вставки, чтобы карточка не телепортировалась на дропе */
    function land(d: Drag, done: () => void) {
        const z = d.zones.get(d.active);
        const ghost = d.ghost;
        if (!z || !ghost) { done(); return; }

        const origin = originOf(z);
        const s = scrollOf(z.scroller);
        const targetY = origin.top + holeTop({ cells: z.cells, gap: z.gap, top: z.top, k: d.k }) - s.sy;
        const targetX = z.cells.length
            ? origin.left + z.cells[0].left - s.sx
            : boxOf(z).left;

        ghost.style.transition = SLIDE;
        ghost.style.transform = `translate(${targetX - d.ghostX0}px,${targetY - d.ghostY0}px)`;
        let fired = false;
        const finish = () => {
            if (fired) return;
            fired = true;
            ghost.removeEventListener('transitionend', finish);
            done();
        };
        ghost.addEventListener('transitionend', finish);
        setTimeout(finish, 240);   // страховка, если transitionend не придёт
    }

    function onUp(ev: PointerEvent) {
        if (!drag || ev.pointerId !== drag.pid) return;
        const d = drag;
        const { fromList, fromIndex, active, k, ready } = d;

        if (!ready || (fromList === active && k === fromIndex)) {
            cleanup();
            return;
        }

        // слушатели снимаем сразу, разбор стилей — после приземления
        detach();
        if (d.raf) cancelAnimationFrame(d.raf);
        drag = null;
        activeName = null;
        draggingId = null;
        land(d, () => {
            resetStyles(d);
            opts.onEnd({ list: fromList, index: fromIndex }, { list: active, index: k });
        });
    }

    function begin(name: string, id: string, handle: HTMLElement, pid: number, x: number, y: number) {
        const zone = zones.get(name);
        const dragEl = zone?.els.get(id);
        if (!zone || !dragEl) return;
        const fromIndex = zone.opts.order().indexOf(id);
        if (fromIndex < 0) return;

        drag = {
            id, fromList: name, fromIndex, dragEl, pid,
            startX: x, startY: y, lastX: x, lastY: y,
            dragH: 0,
            zones: new Map(), active: name, k: fromIndex,
            raf: 0, ready: false, moved: false,
            prevStyle: dragEl.style.cssText,
            ghost: null,
            ghostX0: 0, ghostY0: 0,
            touched: new Set(),
        };
        draggingId = id;
        activeName = name;
        document.body.style.userSelect = 'none';

        snapshot(rects => {
            if (!drag || drag.id !== id) return;
            const d = drag;
            const r = rects.get(dragEl);
            d.zones = buildZoneSnaps(rects, id);

            if (r) {
                d.dragH = r.height;
                // Оригинал остаётся в потоке и просто прячется — его место держится
                // само, поэтому колонка не схлопывается и высота не пляшет.
                // За курсором летит клон в top layer: overflow колонки его не режет.
                injectGhostReset();
                d.ghost = makeGhost(dragEl, r);
                d.ghostX0 = r.left; d.ghostY0 = r.top;
                dragEl.style.opacity = '0';
            }

            // Раскладку не трогаем: карточка осталась в потоке, её место на месте,
            // все сдвиги нулевые. Первый же кадр разложит, если указатель уехал.
            d.ready = true;
        });

        try { handle.setPointerCapture(pid); } catch { /* noop */ }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('keydown', onKey);
        drag.raf = requestAnimationFrame(frame);
    }

    // ожидание старта — как в sortableCore: тач long-press, мышь порог/задержка
    let pending: { name: string; id: string; handle: HTMLElement; pid: number; x: number; y: number; timer: any; mode: 'press' | 'dist'; thresh: number } | null = null;
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
        if (pending.mode === 'press') clearPending();
        else { const p = pending; clearPending(); begin(p.name, p.id, p.handle, p.pid, ev.clientX, ev.clientY); }
    }
    function pendCancel(ev: PointerEvent) {
        if (pending && ev.pointerId === pending.pid) clearPending();
    }

    function onDown(name: string, id: string, handle: HTMLElement, ev: PointerEvent) {
        if (ev.button !== 0 || opts.disabled?.() || drag || pending) return;
        const touch = ev.pointerType === 'touch';
        const delay = touch ? pressDelay : mousePress;
        if (delay > 0) {
            pending = { name, id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'press', thresh: MOVE_TOL };
            pending.timer = setTimeout(() => {
                const p = pending; clearPending();
                if (p) { if (touch) navigator.vibrate?.(8); begin(p.name, p.id, p.handle, p.pid, p.x, p.y); }
            }, delay);
            addPend();
            return;
        }
        if (!touch && mouseThresh > 0) {
            pending = { name, id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'dist', thresh: mouseThresh };
            addPend();
            return;
        }
        ev.preventDefault();
        begin(name, id, handle, ev.pointerId, ev.clientX, ev.clientY);
    }

    onCleanup(() => { clearPending(); cleanup(); });

    return {
        list(name, listOpts) {
            const zone: Zone = zones.get(name) ?? { name, opts: listOpts, el: null, els: new Map() };
            zone.opts = listOpts;
            zones.set(name, zone);
            return {
                container: (el: HTMLElement) => {
                    zone.el = el;
                    onCleanup(() => { if (zone.el === el) zone.el = null; });
                },
                bind: (id: string) => (el: HTMLElement) => {
                    zone.els.set(id, el);
                    const h = el.querySelector('[data-drag-handle]') as HTMLElement | null;
                    if (h) h.style.touchAction = 'none';
                    const down = (ev: PointerEvent) => {
                        const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null;
                        if (handle && !(ev.target instanceof Node && handle.contains(ev.target))) return;
                        onDown(name, id, handle || el, ev);
                    };
                    el.addEventListener('pointerdown', down);
                    onCleanup(() => {
                        el.removeEventListener('pointerdown', down);
                        if (zone.els.get(id) === el) zone.els.delete(id);
                    });
                },
            };
        },
        activeList: () => activeName,
        draggingId: () => draggingId,
    };
}
