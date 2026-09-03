---
'@solid-dumb-kit/selection': patch
---

Пример в JSDoc `SelectionArea` переписан с `classList` на `class` массивом:
атрибута `classList` во второй линии Solid нет вовсе — он уезжает в DOM как
`classlist="[object Object]"`, классы не применяются, и никакой ошибки при этом
не возникает. Документация учила приёму, который молча не работает.
