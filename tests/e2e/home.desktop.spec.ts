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
