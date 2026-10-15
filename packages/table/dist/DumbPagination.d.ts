import type { JSX } from '@solidjs/web';
export type DumbPaginationProps = {
    page: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    /**
     * Адрес страницы. Задан — номера и стрелки рисуются ссылками `<a href>`, а
     * не кнопками: по ним проходит поисковик, их открывают в новой вкладке и
     * копируют. Обычный клик всё равно идёт в `onPageChange` (без перезагрузки —
     * роутер приложения переходит сам), клик с Ctrl/Cmd/Shift или средней
     * кнопкой браузер обрабатывает как обычную ссылку.
     */
    href?: (page: number) => string;
    /** показывает переключатель размера страницы */
    pageSizes?: Array<number>;
    onPageSizeChange?: (size: number) => void;
    /** подпись слева; по умолчанию «total · page/pages» */
    summary?: (info: {
        page: number;
        pages: number;
        total: number;
    }) => string;
    class?: string;
    buttonClass?: string;
    activeClass?: string;
};
export declare function buildPageNumbers(current: number, total: number): Array<number | '…'>;
export declare function DumbPagination(props: DumbPaginationProps): JSX.Element;
