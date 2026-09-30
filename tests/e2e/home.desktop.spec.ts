import { expect, test } from '@playwright/test';

// На десктопе список городов виден сразу, а карточка открывается справа поверх карты.

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
