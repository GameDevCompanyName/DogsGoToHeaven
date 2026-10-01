import { expect, test } from '@playwright/test';

// На десктопе список городов виден сразу, а карточка открывается справа поверх карты.

// Флаг лендинга стоит заранее: без него главная без хеша уводит на /start.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dogs:onboarded', '1'));
});

test('клик по городу в списке открывает карточку', async ({ page }) => {
  await page.goto('/');
  const firstCity = page.getByTestId('city-list-item').first();
  const cityName = await firstCity.getByTestId('city-name').innerText();

  await firstCity.click();

  const card = page.getByTestId('city-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: cityName })).toBeVisible();
});

test('карточка на десктопе показывает сводку и подсказку фактора', async ({ page }) => {
  await page.goto('/');
  const firstCity = page.getByTestId('city-list-item').first();
  await expect(firstCity.getByTestId('city-chip').first()).toBeVisible();

  await firstCity.click();

  const card = page.getByTestId('city-card');
  await expect(card.getByTestId('summary-line')).toContainText('В топе за счёт');
  await card.getByTestId('factor-hint').first().click();
  await expect(page.getByTestId('factor-hint-content')).toBeVisible();
});

test('кнопка «Поделиться» в карточке копирует ссылку на город', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const firstCity = page.getByTestId('city-list-item').first();
  const cityId = await firstCity.getAttribute('data-city-id');
  await firstCity.click();

  const share = page.getByTestId('city-card').getByTestId('share-button');
  await share.click();

  await expect(share).toHaveText('Скопировано');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`c=${cityId}`);
});

test('сравнение из карточки и списка показывает таблицу с двумя колонками', async ({ page }) => {
  await page.goto('/');
  const rows = page.getByRole('list', { name: 'Города по баллу' }).getByRole('listitem');
  await rows.nth(0).getByTestId('city-list-item').click();
  await page.getByTestId('city-card').getByRole('button', { name: 'Сравнить' }).click();
  await page.keyboard.press('Escape');

  await rows.nth(1).getByRole('button', { name: 'Сравнить' }).click();
  await page.getByTestId('compare-bar').getByRole('button', { name: 'Открыть' }).click();

  const sheet = page.getByTestId('compare-sheet');
  await expect(sheet.getByTestId('compare-column')).toHaveCount(2);
  await sheet.getByTestId('compare-column').first().getByRole('button', { name: 'Убрать' }).click();
  await expect(sheet.getByTestId('compare-column')).toHaveCount(1);
});

test('доход показывает остаток у города и сортирует сначала по карману', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Настройки' }).click();
  await page.getByTestId('budget-input').fill('2000');
  await page.getByRole('tab', { name: 'Города' }).click();

  await expect(page.getByTestId('city-list-item').first()).toContainText(/Останется|Не по карману/);

  await page.getByRole('checkbox', { name: 'Сначала по карману' }).click();

  await expect(page).toHaveURL(/b=2000/);
  await expect(page).toHaveURL(/bp=1/);
});

test('таблица встаёт вместо карты, сортируется и открывает карточку', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Таблица' }).click();
  const table = page.getByTestId('city-table');
  await expect(table).toBeVisible();
  // Слева при таблице — настройки: вес двигается, таблица справа видна.
  await expect(page.getByTestId('weight-cost-of-living')).toBeVisible();
  const sortSafety = table.getByTestId('sort-safety');

  await sortSafety.click();
  await sortSafety.click();

  await expect(page).toHaveURL(/sort=safety:desc/);
  // Пустой data-value — нет данных: Number('') дал бы 0 и сломал порядок.
  const safety = (
    await table
      .getByTestId('table-row')
      .locator('[data-factor-id="safety"]')
      .evaluateAll((cells) => cells.slice(0, 10).map((cell) => cell.getAttribute('data-value')))
  )
    .filter((value) => value !== null && value !== '')
    .map(Number);
  expect(safety).toEqual([...safety].sort((a, b) => b - a));

  const firstRow = table.getByTestId('table-row').first();
  const cityName = await firstRow.getByRole('rowheader').innerText();
  await firstRow.locator('td').last().click();

  await expect(
    page.getByTestId('city-card').getByRole('heading', { name: cityName }),
  ).toBeVisible();
});
