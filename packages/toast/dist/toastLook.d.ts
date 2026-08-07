import { type JSX } from 'solid-js';
import type { Toast, ToastKind } from './toast';
/** цвет значка по виду сообщения: токен темы, а не свой hex */
export declare const kindTone: (kind: ToastKind) => "bg-error text-error-content" | "bg-info text-info-content" | "bg-success text-success-content";
/**
 * Знак в значке, когда потребитель не дал свой класс иконки. Кит своих иконок
 * не несёт — рисуем символом, он есть в любом шрифте.
 */
export declare const kindGlyph: (kind: ToastKind) => "!" | "i" | "✓";
/** Значок уведомления: иконка потребителя или знак по виду сообщения. */
export declare function ToastIcon(props: {
    t: Toast;
    size?: 'sm' | 'md';
}): JSX.Element;
/**
 * Текст уведомления: жирная первая строка и подробности. Заголовка нет —
 * остаётся одна строка, как было до macOS-вида.
 */
export declare function ToastBody(props: {
    t: Toast;
}): JSX.Element;
