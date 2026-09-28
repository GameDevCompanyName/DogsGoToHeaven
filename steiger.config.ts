import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Экран один: каждый виджет собирает только главная страница, а каждую фичу —
    // только панель настроек, и правило требует слить такие слайсы. Разбиение задано
    // спекой MVP (docs/superpowers/specs/2026-09-28-mvp-ui-design.md). Выключить правило
    // только для widgets и features нельзя: Steiger тогда не видит их файлы вовсе
    // и считает entities неиспользуемыми.
    rules: { 'fsd/insignificant-slice': 'off' },
  },
]);
