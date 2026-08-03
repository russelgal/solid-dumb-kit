// Подписывающая ручка ТОЛЬКО ДЛЯ РАЗРАБОТКИ.
//
// Живёт в `configureServer`, то есть существует лишь пока крутится `pnpm demo`.
// В собранной витрине (и на Pages) её нет вовсе — там просто нет сервера,
// который мог бы подписать, и вкладка честно работает на поддельном транспорте.
//
// Ключи берутся из окружения и наружу не уходят: браузер получает подписанную
// ссылку на один объект и на пять минут. Ровно та схема, которую галерея и
// предполагает у потребителя, — здесь она просто собрана для проверки.
import { loadEnv, type Plugin } from 'vite'

/** префикс, в который кладём всё дев-барахло: отличить и вычистить */
const PREFIX = 'dumb-kit-dev/'

export function devSign(): Plugin {
  return {
    name: 'dumb-kit-dev-sign',
    apply: 'serve',          // ← в сборку не попадает никогда
    configureServer(server) {
      // `.env` Vite сам в `process.env` НЕ кладёт: клиенту он отдаёт только
      // `VITE_*` через `import.meta.env`, а для конфига и плагинов есть
      // `loadEnv`. Пустой префикс — значит читаем все переменные.
      const {
        S3_ENDPOINT: endpoint,
        S3_REGION: region,
        S3_BUCKET: bucket,
        S3_ACCESS_KEY: accessKeyId,
        S3_SECRET_KEY: secretAccessKey,
        S3_WEB_ENDPOINT: web,
      } = loadEnv(server.config.mode, server.config.envDir, '')

      const ready = Boolean(endpoint && bucket && accessKeyId && secretAccessKey)
      if (!ready) {
        server.config.logger.info(
          '  \x1b[33mдев-подпись выключена\x1b[0m: нет S3_* в окружении (см. .env.example)',
        )
      } else {
        server.config.logger.info(`  \x1b[32mдев-подпись\x1b[0m: ${bucket} на ${endpoint}, префикс ${PREFIX}`)
      }

      server.middlewares.use('/api/sign', async (req, res) => {
        res.setHeader('content-type', 'application/json')
        if (!ready) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'дев-подпись не настроена: заполни S3_* в .env' }))
        }
        try {
          // импортируем лениво: без настроек sdk и грузить незачем
          const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
          const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

          let body = ''
          for await (const chunk of req) body += chunk
          const { name = 'file', type = 'application/octet-stream' } = JSON.parse(body || '{}')

          const s3 = new S3Client({
            endpoint,
            region: region || 'garage',
            credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
            forcePathStyle: true,
            // БЕЗ ЭТОГО ПОДПИСАННЫЙ PUT НЕ ПРОЙДЁТ: свежий sdk кладёт в подпись
            // заголовки контрольной суммы, а браузер её не считает — хранилище
            // отвечает 400 InvalidDigest
            requestChecksumCalculation: 'WHEN_REQUIRED',
          })

          // чистим имя, но с флагом `u`: без него `\w` не знает кириллицы и
          // «проба.png» превращается в «_.png»
          const safe = String(name).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120)
          const key = `${PREFIX}${Date.now()}-${safe}`
          const url = await getSignedUrl(
            s3,
            new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }),
            { expiresIn: 300 },
          )
          res.end(JSON.stringify({
            url,
            key,
            headers: { 'Content-Type': type },
            publicUrl: web ? `${web}/${key}` : undefined,
          }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })
    },
  }
}
