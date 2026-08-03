// Выгрести дев-мусор из хранилища.
//
// Всё, что заливает вкладка DumbGallery в деве, лежит под одним префиксом —
// `dumb-kit-dev/`. Скрипт удаляет ТОЛЬКО его: чужого не тронет, даже если в
// `.env` прописан боевой бакет.
//
//   node scripts/dev-s3-clean.mjs          посмотреть, что там
//   node scripts/dev-s3-clean.mjs --yes    удалить
import { readFileSync } from 'node:fs'
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const PREFIX = 'dumb-kit-dev/'

const env = { ...process.env }
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
} catch { /* нет .env — значит всё из окружения */ }

if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY) {
  console.error('нет S3_* — заполни .env (см. .env.example)')
  process.exit(1)
}

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION || 'garage',
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
})

const list = await s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: PREFIX }))
const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key }))

console.log(`${env.S3_BUCKET}/${PREFIX} — объектов: ${keys.length}`)
for (const k of keys.slice(0, 20)) console.log('  ' + k.Key)
if (keys.length > 20) console.log(`  … и ещё ${keys.length - 20}`)

if (!keys.length) process.exit(0)
if (!process.argv.includes('--yes')) {
  console.log('\nудалить: node scripts/dev-s3-clean.mjs --yes')
  process.exit(0)
}
await s3.send(new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: keys } }))
console.log(`удалено: ${keys.length}`)
