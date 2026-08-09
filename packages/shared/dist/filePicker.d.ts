export type PickedFile = {
    /** сам файл: его и отдаём в очередь заливки */
    file: File;
    name: string;
    size: number;
    /** `objectURL`: показать картинку сразу, не дожидаясь заливки */
    source: string;
};
export type FilePickerOptions = {
    /** что пускать в диалог; по умолчанию всё */
    accept?: string;
    /** можно ли выбрать несколько; по умолчанию да */
    multiple?: boolean;
};
/**
 * Открыть системный диалог выбора файлов.
 *
 * Возвращает функцию: зовёшь — открывается диалог, выбранное приезжает в
 * колбэк. Инпут живёт вне документа и переиспользуется: вставлять его в
 * разметку незачем, а пересоздавать на каждый клик — плодить мусор.
 */
export declare function createFilePicker(opts?: FilePickerOptions): (onPick: (files: Array<PickedFile>) => void) => void;
/** превратить брошенные в окно файлы в тот же вид, что даёт диалог */
export declare const pickedFrom: (files: ArrayLike<File>) => Array<PickedFile>;
