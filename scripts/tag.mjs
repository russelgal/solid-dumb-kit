// Теги на пакеты — короткие: `table@0.5.0`, а не `@solid-dumb-kit/table@0.5.0`.
//
// `changeset tag` называет их полным именем пакета, и в git-ссылке получается
// «solid-dumb-kit#@solid-dumb-kit/table» — имя репы, а следом почти оно же.
// Тег ничем не обязан совпадать с именем пакета: он метит точку в истории, а
// какой это пакет, уже сказано в `path:`.
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'

const dirs = readdirSync('packages').filter((d) => statSync(`packages/${d}`).isDirectory())
const made = []

for (const dir of dirs) {
  const { version } = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf8'))
  const tag = `${dir}@${version}`
  // уже есть — значит эта версия пакета выпущена, второй раз не метим
  const exists = execSync(`git tag -l ${JSON.stringify(tag)}`, { encoding: 'utf8' }).trim()
  if (exists) continue
  execSync(`git tag -a ${JSON.stringify(tag)} -m ${JSON.stringify(tag)}`)
  made.push(tag)
}

console.log(made.length ? `новые теги:\n  ${made.join('\n  ')}` : 'новых тегов нет — все версии уже помечены')
