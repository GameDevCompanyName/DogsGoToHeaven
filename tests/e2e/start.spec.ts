import { expect, test } from '@playwright/test';

// Первый заход: флага в localStorage нет, главная без хеша уводит на лендинг.

test('первый заход ведёт на лендинг, выбор персоны открывает карту с ней', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/start$/);
  const cards = page.getByTestId('persona-card');
  await expect(cards).toHaveCount(6);

  await cards.filter({ hasText: 'Семья с детьми' }).click();

  await expect(page).toHaveURL(/\/#p=family$/);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('button', { name: 'Настройки' })
    .click();
  await expect(
    page.getByTestId('persona-card').filter({ hasText: 'Семья с детьми' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');

  await expect(page).not.toHaveURL(/\/start$/);
});

test('ссылка с настройками открывает карту, минуя лендинг', async ({ page }) => {
  await page.goto('/#p=family');

  await expect(page.getByTestId('city-map')).toBeVisible();
  await expect(page).toHaveURL(/#p=family$/);
});
