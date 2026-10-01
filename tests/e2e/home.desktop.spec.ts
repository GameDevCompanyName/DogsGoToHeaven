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
