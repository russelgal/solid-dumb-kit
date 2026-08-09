// Выбор файлов и приём броска — без зависимостей.
//
// Заменил `@solid-primitives/upload`: он ломался дважды подряд — версия 0.1.5
// импортирует `solid-js/web`, которого во второй линии нет вовсе, а в
// 1.0.0-next API переписан целиком (`createFileUploader(send)` вместо
// `createFileUploader({ accept })`, отдельные `createFilePicker` и
// `createDropzone`). Нам от него нужны две вещи на тридцать строк, поэтому
// дешевле держать своё, чем догонять чужие мажорки.
//
// Заливкой это НЕ занимается: очередь и транспорт живут в `uploadQueue`.

export type PickedFile = {
  /** сам файл: его и отдаём в очередь заливки */
  file: File
  name: string
  size: number
  /** `objectURL`: показать картинку сразу, не дожидаясь заливки */
  source: string
}

const toPicked = (file: File): PickedFile => ({
  file,
  name: file.name,
  size: file.size,
  source: URL.createObjectURL(file),
})

export type FilePickerOptions = {
  /** что пускать в диалог; по умолчанию всё */
  accept?: string
  /** можно ли выбрать несколько; по умолчанию да */
  multiple?: boolean
}

/**
 * Открыть системный диалог выбора файлов.
 *
 * Возвращает функцию: зовёшь — открывается диалог, выбранное приезжает в
 * колбэк. Инпут живёт вне документа и переиспользуется: вставлять его в
 * разметку незачем, а пересоздавать на каждый клик — плодить мусор.
 */
export function createFilePicker(opts: FilePickerOptions = {}) {
  let input: HTMLInputElement | null = null

  return (onPick: (files: Array<PickedFile>) => void): void => {
    if (typeof document === 'undefined') return
    if (!input) {
      input = document.createElement('input')
      input.type = 'file'
      input.style.display = 'none'
    }
    input.accept = opts.accept ?? ''
    input.multiple = opts.multiple !== false
    // значение чистим ПЕРЕД открытием: иначе выбор того же файла второй раз
    // подряд не даёт события `change` вовсе
    input.value = ''
    input.onchange = () => {
      const files = Array.from(input?.files ?? []).map(toPicked)
      if (files.length) onPick(files)
    }
    input.click()
  }
}

/** превратить брошенные в окно файлы в тот же вид, что даёт диалог */
export const pickedFrom = (files: ArrayLike<File>): Array<PickedFile> =>
  Array.from(files).map(toPicked)
