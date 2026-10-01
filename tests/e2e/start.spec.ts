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

test('опрос из лендинга открывает карту с подобранной персоной', async ({ page }) => {
  await page.goto('/start');
  await page.getByTestId('start-quiz').click();
  await expect(page).toHaveURL(/\/quiz$/);
  const progress = page.getByTestId('quiz-progress');
  const answer = (label: string) => page.getByRole('button', { name: label }).click();

  await answer('На год-два');
  await expect(progress).toHaveText('Вопрос 2 из 5');
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('button', { name: 'На год-два' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await answer('На год-два');
  await answer('Удалённая работа, доход из России');
  await answer('Тёплая зима важна');
  await answer('Чтобы было дёшево');
  await answer('Небольшой');

  await expect(page).toHaveURL(/\/#p=[\w-]+&/);
  await expect(page).toHaveURL(/r=[^&]*winter-temp:12-25/);
  expect(await page.evaluate(() => localStorage.getItem('dogs:onboarded'))).toBe('1');
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('button', { name: 'Настройки' })
    .click();
  const presetId = /#p=([\w-]+)/.exec(page.url())?.[1];
  await expect(
    page.locator(`[data-testid="persona-card"][data-preset-id="${presetId}"]`),
  ).toHaveAttribute('aria-pressed', 'true');
});
