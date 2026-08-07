---
"@solid-dumb-kit/toast": minor
"@solid-dumb-kit/modal": minor
"@solid-dumb-kit/date-range": minor
---

Центр уведомлений, вопрос окном и период с временем.

- `toast`: `DumbToastCenter` — панель истории с колокольчиком и счётчиком
  непрочитанных; у шины появились `history`, `unread`, `forget`, `clearHistory`,
  `toggleHistory`, `pause`/`resume`.
- `modal`: `DumbModalHost` и шина `modal` (`confirm`, `ask`, `alert`) — замена
  браузерного `confirm()`, с очередью вопросов и `dismissible: false`.
- `date-range`: `DumbDateTimeRange` и `DumbTimeSelect` — момент `{ day, time }`
  строками, занятость до минуты (конец отрезка не включается), два способа
  выбора времени; наружу выложена арифметика времени (`checkMomentRange`,
  `minutesBetween`, `slotsOfDay`, `fmtLength` и прочее).
