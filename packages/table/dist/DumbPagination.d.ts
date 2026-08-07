export type DumbPaginationProps = {
    page: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
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
export declare function DumbPagination(props: DumbPaginationProps): import("solid-js").JSX.Element;
