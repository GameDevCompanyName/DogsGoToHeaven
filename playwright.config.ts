import { defineConfig, devices } from '@playwright/test';

const HOST = '127.0.0.1';
// Отдельные рабочие копии могут проверяться параллельно, не занимая один и тот же порт.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const BASE_URL = `http://${HOST}:${PORT}`;

// Системный HTTP_PROXY иначе перехватывает проверку готовности локального сервера.
process.env.NO_PROXY = [process.env.NO_PROXY, HOST].filter(Boolean).join(',');

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    // Явный IPv4-хост: на Windows `localhost` у Vite слушает только ::1.
    command: `npm run build && npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
  },
  use: { baseURL: BASE_URL },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /\.desktop\.spec\.ts$/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: /\.desktop\.spec\.ts$/,
    },
  ],
});
