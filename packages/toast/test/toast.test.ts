// Шина сообщений: очередь, схлопывание повторов, таймеры, вопрос вместо
// confirm(). Ни DOM, ни Solid тут нет — проверяется чистая механика.
//
// Каждый тест берёт СВОЮ шину (`createToastBus`), а не общий синглтон `toast`:
// у синглтона состояние переживает файл целиком, и порядок тестов начал бы
// влиять на результат.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createToastBus } from '../src'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('очередь', () => {
  it('показывает то, что положили, и отдаёт id', () => {
    const bus = createToastBus()
    const id = bus.error('Не залилось')

    expect(bus.list()).toHaveLength(1)
    expect(bus.list()[0]).toMatchObject({ id, kind: 'error', text: 'Не залилось', count: 1 })
  })

  it('одинаковые сообщения схлопывает в одно со счётчиком', () => {
    const bus = createToastBus()
    bus.error('Не залилось')
    bus.error('Не залилось')
    bus.error('Не залилось')

    expect(bus.list()).toHaveLength(1)
    expect(bus.list()[0].count).toBe(3)
  })

  it('разные сообщения — разные плашки', () => {
    const bus = createToastBus()
    bus.error('Первое')
    bus.success('Второе')

    expect(bus.list().map((t) => t.text)).toEqual(['Первое', 'Второе'])
  })

  it('снимает плашку по истечении ttl', () => {
    const bus = createToastBus({ ttl: 1000 })
    bus.info('Сохранено')

    vi.advanceTimersByTime(999)
    expect(bus.list()).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(bus.list()).toHaveLength(0)
  })

  it('ttl 0 держит плашку до закрытия руками', () => {
    const bus = createToastBus()
    const id = bus.info('Идёт заливка', { ttl: 0 })

    vi.advanceTimersByTime(60_000)
    expect(bus.list()).toHaveLength(1)

    bus.dismiss(id)
    expect(bus.list()).toHaveLength(0)
  })

  it('clear убирает всё разом', () => {
    const bus = createToastBus()
    bus.info('Раз')
    bus.error('Два')
    bus.clear()

    expect(bus.list()).toHaveLength(0)
  })
})

describe('таймер снаружи', () => {
  it('pause останавливает обратный отсчёт, resume продолжает', () => {
    const bus = createToastBus({ ttl: 1000 })
    bus.info('Читаю')

    vi.advanceTimersByTime(500)
    bus.pause()
    // под курсором сообщение не уезжает, сколько бы ни висело
    vi.advanceTimersByTime(10_000)
    expect(bus.list()).toHaveLength(1)

    bus.resume()
    vi.advanceTimersByTime(499)
    expect(bus.list()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(bus.list()).toHaveLength(0)
  })
})

describe('вопрос вместо confirm()', () => {
  it('не гаснет сам и закрывается только ответом', () => {
    const bus = createToastBus({ ttl: 1000 })
    bus.ask('Удалить папку?', [{ label: 'Удалить' }, { label: 'Отмена' }])

    const t = bus.list()[0]
    expect(t.ttl).toBe(0)
    expect(t.closable).toBe(false)

    vi.advanceTimersByTime(60_000)
    expect(bus.list()).toHaveLength(1)
  })

  it('confirm отдаёт true на подтверждении и false на отказе', async () => {
    const bus = createToastBus()

    // Тексты РАЗНЫЕ: одинаковые схлопнулись бы в одну плашку с кнопками от
    // первого вопроса, и второй промис не дождался бы ответа никогда.
    const yes = bus.confirm('Удалить папку?')
    bus.list()[0].actions![0].run!()
    await expect(yes).resolves.toBe(true)

    const no = bus.confirm('Удалить файл?')
    bus.list().at(-1)!.actions![1].run!()
    await expect(no).resolves.toBe(false)
  })
})

describe('подписка', () => {
  it('зовёт слушателя на изменение очереди и отписывается', () => {
    const bus = createToastBus()
    const seen = vi.fn()
    const off = bus.subscribe(seen)

    bus.info('Раз')
    expect(seen).toHaveBeenCalled()

    off()
    seen.mockClear()
    bus.info('Два')
    expect(seen).not.toHaveBeenCalled()
  })
})
