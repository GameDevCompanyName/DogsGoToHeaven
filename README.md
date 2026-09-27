# Все псы попадают в рай

Сервис выбора города для переезда: задаёшь приоритеты — получаешь ранжированный список городов на карте.

- Что строим — [docs/prd.md](docs/prd.md)
- Как пишем код — [docs/code-style.md](docs/code-style.md)

## Запуск

Нужен Node.js 24 (см. `.nvmrc`).

```bash
npm install
npx playwright install chromium
npm run dev
```

`npm run verify` прогоняет форматирование, ESLint, Steiger, svelte-check, Vitest и Playwright.
