import { expect, test } from '@playwright/test';

// Первый заход: флага в localStorage нет, главная без хеша уводит на лендинг.

test('без флага в localStorage главная уводит на лендинг', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('dogs:onboarded'));

  await page.goto('/');

  await expect(page).toHaveURL(/\/start$/);
});

test('первый заход ведёт на лендинг, выбор персоны открывает карту с ней', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/start$/);
  const cards = page.getByTestId('persona-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
  const family = cards.filter({ hasText: 'Семья с детьми' });
  await expect(family).toHaveCount(1);

  await family.click();

  await expect(page).toHaveURL(/\/#p=family$/);
  const sections = page.getByRole('navigation', { name: 'Разделы' });
  await sections.getByRole('button', { name: 'Настройки' }).click();
  await expect(
    page.getByTestId('persona-card').filter({ hasText: 'Семья с детьми' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  await sections.getByRole('button', { name: 'Города' }).click();
  await expect(page.getByTestId('city-list-item').first()).toBeVisible();

  // Список уже на экране, а переход на лендинг так и не случился.
  await expect.poll(() => page.url(), { timeout: 1500 }).toMatch(/\/(#.*)?$/);
});

test('ссылка с настройками открывает карту, минуя лендинг', async ({ page }) => {
  await page.goto('/#p=family');

  await expect(page.getByTestId('city-map')).toBeVisible();
  await expect(page).toHaveURL(/#p=family$/);
});
