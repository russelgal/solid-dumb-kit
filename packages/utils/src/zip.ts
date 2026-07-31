const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])

const MIME_MAP: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** Извлечь изображения из ZIP-архива, вернуть как FileList */
export async function extractImagesFromZip(zipFile: File): Promise<FileList> {
  const { unzipSync } = await import('fflate')
  const buf = new Uint8Array(await zipFile.arrayBuffer())
  const entries = unzipSync(buf)
  const dt = new DataTransfer()

  for (const [name, data] of Object.entries(entries)) {
    if (name.startsWith('__MACOSX/') || name.startsWith('.')) continue
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (!IMAGE_EXTS.has(ext)) continue
    const mime = MIME_MAP[ext] || 'image/jpeg'
    const fileName = name.split('/').pop() || name
    dt.items.add(new File([data as BlobPart], fileName, { type: mime }))
  }

  return dt.files
}
