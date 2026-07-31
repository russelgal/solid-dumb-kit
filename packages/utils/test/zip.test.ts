import { describe, it, expect } from 'vitest'
import { zipSync } from 'fflate'
import { extractImagesFromZip } from '../src/zip'

/** Вспомогательная функция: создать File из ZIP-данных */
function makeZipFile(entries: Record<string, Uint8Array>): File {
  const zipped = zipSync(entries)
  return new File([zipped], 'test.zip', { type: 'application/zip' })
}

/** Заглушка 1x1 пиксель — просто непустые байты */
const DUMMY = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])

describe('extractImagesFromZip', () => {
  it('извлекает jpg, png, gif файлы', async () => {
    const zip = makeZipFile({
      'photo.jpg': DUMMY,
      'image.png': DUMMY,
      'anim.gif': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(3)
    const names = Array.from(files).map((f) => f.name)
    expect(names).toContain('photo.jpg')
    expect(names).toContain('image.png')
    expect(names).toContain('anim.gif')
  })

  it('извлекает webp и svg файлы', async () => {
    const zip = makeZipFile({
      'pic.webp': DUMMY,
      'icon.svg': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(2)
    const names = Array.from(files).map((f) => f.name)
    expect(names).toContain('pic.webp')
    expect(names).toContain('icon.svg')
  })

  it('пропускает не-изображения (txt, pdf)', async () => {
    const zip = makeZipFile({
      'readme.txt': DUMMY,
      'doc.pdf': DUMMY,
      'photo.jpg': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(1)
    expect(files[0].name).toBe('photo.jpg')
  })

  it('пропускает файлы из __MACOSX/', async () => {
    const zip = makeZipFile({
      '__MACOSX/._photo.jpg': DUMMY,
      '__MACOSX/resource.png': DUMMY,
      'photo.jpg': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(1)
    expect(files[0].name).toBe('photo.jpg')
  })

  it('пропускает файлы начинающиеся на "."', async () => {
    const zip = makeZipFile({
      '.hidden.png': DUMMY,
      '.DS_Store': DUMMY,
      'visible.png': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(1)
    expect(files[0].name).toBe('visible.png')
  })

  it('извлекает имена файлов без путей из вложенных папок', async () => {
    const zip = makeZipFile({
      'folder/subfolder/deep.jpg': DUMMY,
      'another/image.png': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(2)
    const names = Array.from(files).map((f) => f.name)
    expect(names).toContain('deep.jpg')
    expect(names).toContain('image.png')
  })

  it('возвращает FileList с length 0 для пустого ZIP', async () => {
    const zip = makeZipFile({})

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(0)
  })

  it('возвращает FileList с length 0 если в ZIP нет изображений', async () => {
    const zip = makeZipFile({
      'data.json': DUMMY,
      'script.js': DUMMY,
      'style.css': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(0)
  })

  it('устанавливает правильный MIME-тип для каждого расширения', async () => {
    const zip = makeZipFile({
      'a.jpg': DUMMY,
      'b.jpeg': DUMMY,
      'c.png': DUMMY,
      'd.gif': DUMMY,
      'e.webp': DUMMY,
      'f.svg': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(6)

    const byName = Object.fromEntries(Array.from(files).map((f) => [f.name, f.type]))

    expect(byName['a.jpg']).toBe('image/jpeg')
    expect(byName['b.jpeg']).toBe('image/jpeg')
    expect(byName['c.png']).toBe('image/png')
    expect(byName['d.gif']).toBe('image/gif')
    expect(byName['e.webp']).toBe('image/webp')
    expect(byName['f.svg']).toBe('image/svg+xml')
  })

  it('одновременно фильтрует __MACOSX, скрытые и не-изображения', async () => {
    const zip = makeZipFile({
      '__MACOSX/._thumb.jpg': DUMMY,
      '.hidden.png': DUMMY,
      'docs/report.pdf': DUMMY,
      'photos/sunset.jpg': DUMMY,
      'photos/lake.png': DUMMY,
    })

    const files = await extractImagesFromZip(zip)

    expect(files.length).toBe(2)
    const names = Array.from(files).map((f) => f.name)
    expect(names).toContain('sunset.jpg')
    expect(names).toContain('lake.png')
  })
})
