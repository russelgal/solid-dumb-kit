export type InlineEdit = {
    /** что правим сейчас; `null` — ничего */
    editing: () => string | null;
    /** текущее содержимое поля */
    value: () => string;
    /** идёт сохранение */
    busy: () => boolean;
    /** ошибка последнего сохранения */
    error: () => string | null;
    start: (id: string, initial: string) => void;
    input: (next: string) => void;
    /** сохранить; вернёт `true`, если действительно сохраняли */
    commit: () => Promise<boolean>;
    cancel: () => void;
};
export type InlineEditOptions = {
    /** собственно сохранение */
    save: (id: string, value: string) => Promise<void>;
    /** привести введённое к виду хранилища: обрезать пробелы, убрать слэши */
    clean?: (value: string) => string;
    /** состояние изменилось — перерисовать */
    onChange?: () => void;
};
export declare function createInlineEdit(opts: InlineEditOptions): InlineEdit;
