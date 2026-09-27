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
      },
    }),
  ],
  test: {
    expect: { requireAssertions: true },
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
