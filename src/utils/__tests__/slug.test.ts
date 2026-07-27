import { describe, it, expect } from 'vitest'
import { genSlug } from '../slug'

describe('genSlug — генерация slug', () => {
  it('транслитерирует кириллицу', () => {
    expect(genSlug('Привет мир')).toBe('privet-mir')
  })

  it('переводит в нижний регистр', () => {
    expect(genSlug('Hello World')).toBe('hello-world')
  })

  it('заменяет пробелы на дефисы', () => {
    expect(genSlug('один два три')).toBe('odin-dva-tri')
  })

  it('убирает спецсимволы', () => {
    const result = genSlug('Привет! Мир? #123')
    expect(result).not.toContain('!')
    expect(result).not.toContain('?')
    expect(result).not.toContain('#')
    expect(result).toContain('123')
  })

  it('обрабатывает пустую строку', () => {
    expect(genSlug('')).toBe('')
  })

  it('обрабатывает строку только из спецсимволов', () => {
    const result = genSlug('!@#$%')
    expect(typeof result).toBe('string')
  })

  it('обрабатывает смешанный текст (кириллица + латиница)', () => {
    expect(genSlug('Категория Category')).toBe('kategoriya-category')
  })

  it('обрабатывает числа', () => {
    expect(genSlug('Номер 42')).toBe('nomer-42')
  })

  it('обрабатывает множественные пробелы', () => {
    const result = genSlug('слово   слово')
    expect(result).not.toContain('  ')
    expect(result).toContain('slovo')
  })

  it('обрезает дефисы по краям (trim)', () => {
    const result = genSlug(' привет ')
    expect(result).not.toMatch(/^-/)
    expect(result).not.toMatch(/-$/)
  })

  it('обрабатывает длинную строку', () => {
    const long = 'Очень длинное название категории которое содержит много слов и символов'
    const result = genSlug(long)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/^[a-z0-9-]+$/)
  })

  it('результат содержит только допустимые символы', () => {
    const inputs = ['Привет мир!', 'Тест @#$', 'Категория / Подкатегория']
    for (const input of inputs) {
      const result = genSlug(input)
      if (result.length > 0) {
        expect(result).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
      }
    }
  })
})

describe('genSlug — реальные данные из БД', () => {
  const realSlugs: [string, string][] = [
    ['Проживание', 'prozhivanie'],
    ['Пребывание', 'prebyvanie'],
    ['А-Фреймы', 'a-frejmy'],
    ['Гостевые Дома', 'gostevye-doma'],
    ['Гостиничные Номера', 'gostinichnye-nomera'],
    ['Гостиничный комплекс', 'gostinichnyj-kompleks'],
    ['Беседки и Павильоны', 'besedki-i-pavilony'],
    ['Развлечения', 'razvlecheniya'],
    ['Контакты', 'kontakty'],
    ['Главная', 'glavnaya'],
    ['Питание', 'pitanie'],
    ['Мероприятия', 'meropriyatiya'],
    ['Пляжный отдых и бассейны', 'plyazhnyj-otdyh-i-bassejny'],
    ['Развлечения на свежем воздухе', 'razvlecheniya-na-svezhem-vozduhe'],
    ['Развлечения в тёплом гостиничном комплексе', 'razvlecheniya-v-tyoplom-gostinichnom-komplekse'],
    ['Бизнес мероприятия', 'biznes-meropriyatiya'],
    ['Корпоративы', 'korporativy'],
    ['Банкеты', 'bankety'],
    ['Праздники', 'prazdniki'],
    ['Свадьбы', 'svadby'],
    ['Мясное ассорти', 'myasnoe-assorti'],
    ['Цезарь с курицей', 'cezar-s-kuricej'],
    ['Медальоны из говядины', 'medalony-iz-govyadiny'],
    ['Жульен из грибов', 'zhulen-iz-gribov'],
    ['Сёмга слабосолёная', 'syomga-slabosolyonaya'],
    ['Оливье', 'olive'],
    ['Картофель по-деревенски', 'kartofel-po-derevenski'],
    ['Шашлык из свинины', 'shashlyk-iz-svininy'],
  ]

  for (const [name, expectedSlug] of realSlugs) {
    it(`«${name}» → ${expectedSlug}`, () => {
      expect(genSlug(name)).toBe(expectedSlug)
    })
  }
})
