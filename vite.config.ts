import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Руны принудительно для всего проекта, кроме библиотек. Можно убрать в Svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter(),
      alias: {
        '@': 'src',
        '@data': 'data',
      },
    }),
  ],
  build: {
    // MapLibre GL — один модуль около 1 МБ; он грузится лениво, только для карты,
    // и дробить его нечем. Порог поднят ровно под него.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    // Обзоры из data/notes грузятся как `?raw`, а такие импорты дев-сервер
    // отдаёт только из разрешённых папок; SvelteKit разрешает src, но не data.
    fs: { allow: ['data'] },
  },
  test: {
    expect: { requireAssertions: true },
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
