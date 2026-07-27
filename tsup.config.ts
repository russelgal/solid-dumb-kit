import { defineConfig } from 'tsup'
import * as preset from 'tsup-preset-solid'

const preset_options: preset.PresetOptions = {
  entries: [
    {
      entry: 'src/index.tsx',
    },
  ],
  drop_console: true,
  cjs: false,
}

export default defineConfig(config => {
  const watching = !!config.watch

  const parsed_data = preset.parsePresetOptions(preset_options, watching)

  if (!watching) {
    // Только печатаем — writePackageJson() здесь НЕ вызываем.
    // Пресет поднимает два инстанса tsup параллельно; запись package.json на лету
    // ловится вторым инстансом в момент усечения файла, он не видит dependencies,
    // и тогда ВСЕ зависимости (fflate, slug, valibot, @viselect) инлайнятся в бандл.
    // Поля exports в package.json и так уже соответствуют этому выводу.
    const package_fields = preset.generatePackageExports(parsed_data)
    console.log(`\npackage.json exports (справочно):\n${JSON.stringify(package_fields, null, 2)}\n`)
  }

  return preset.generateTsupOptions(parsed_data)
})
