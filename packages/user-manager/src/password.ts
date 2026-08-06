// Пароль для нового сотрудника: его диктуют голосом или пересылают в мессенджер,
// поэтому важнее читаемость, чем максимальная энтропия. Из алфавита выкинуты
// пары, которые путают при чтении вслух и на бумаге: 0/O/o, 1/l/I, B/8, Z/2 —
// остальное оставлено, включая заглавные (иначе не пройдут проверки «должна
// быть заглавная»).

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789ACDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Предложить пароль.
 *
 * Байты берутся с ОТБРАКОВКОЙ, а не остатком от деления: 256 не делится на 55
 * нацело, и `byte % 55` делает первые 36 букв алфавита чуть вероятнее прочих.
 * На стойкость такого пароля это влияет мало, но перебирать байты дешевле, чем
 * потом объяснять, почему генератор смещён.
 *
 * @param length сколько символов; по умолчанию 9 — на глаз запоминаемо
 */
export function suggestPassword(length = 9): string {
  const limit = 256 - (256 % ALPHABET.length)
  let out = ''

  while (out.length < length) {
    // просим с запасом: отбракованных байтов в среднем меньше пятой части
    const bytes = new Uint8Array(length - out.length + 4)
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (b >= limit) continue
      out += ALPHABET[b % ALPHABET.length]
      if (out.length === length) break
    }
  }

  return out
}
