// Общий конфиг сборки: у каждого пакета `tsup.config.ts` в две строки.
//
// Вынесено сюда не ради красоты. Одиннадцать копий одного конфига разъезжаются
// молча: правишь в одном месте, а девять пакетов ещё месяц собираются по-старому,
// и понимаешь это по странному багу у потребителя, а не по ошибке сборки.

import { defineConfig } from 'tsup'
import * as preset from 'tsup-preset-solid'

/**
 * Вход пакета. `.tsx` даже там, где JSX в самом барр-файле нет: пресет по
 * расширению решает, собирать ли рядом НЕ скомпилированный вариант под условие
 * `solid`. Без него потребитель с SSR получил бы уже развёрнутый в DOM-вызовы
 * код, который на сервере не исполнить. Пакетам без компонентов (`shared`,
 * `utils`, `odata-1c`) хватает `.ts`.
 */
export function solidPackage(entry = 'src/index.tsx') {
  return defineConfig(config => {
    const watching = !!config.watch

    const parsed = preset.parsePresetOptions(
      { entries: [{ entry }], drop_console: true, cjs: false },
      watching,
    )

    // preset.writePackageJson() здесь НЕ зовём: пресет поднимает два инстанса
    // tsup параллельно, и запись package.json на лету ловится вторым инстансом в
    // момент усечения файла — он не видит dependencies, external становится
    // пустым, и все зависимости инлайнятся в бандл. Симптом плавающий, сборка
    // ломается «через раз». Поля exports в манифестах прописаны руками и так.
    return preset.generateTsupOptions(parsed)
  })
}
