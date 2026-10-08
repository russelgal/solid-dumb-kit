---
"@solid-dumb-kit/timeline": patch
---

Полифил Temporal грузится только там, где своего Temporal нет (Safari): раньше он попадал в бандл всем браузерам — около 50 КБ сжатого кода, который Chrome, Brave и Firefox не исполняют.
