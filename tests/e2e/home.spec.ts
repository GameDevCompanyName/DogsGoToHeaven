import { expect, type Page, test } from '@playwright/test';

// Тайлы и WebGL в CI не гарантированы: проверяем DOM, от карты — только контейнер.

function openSection(page: Page, name: 'Карта' | 'Города' | 'Настройки') {
  return page.getByRole('navigation', { name: 'Разделы' }).getByRole('button', { name }).click();
}

test('карта и список городов на месте', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('city-map')).toBeVisible();

  await openSection(page, 'Города');

  await expect(page.getByTestId('city-list-item').first()).toBeVisible();
});

test('ползунок веса меняет балл города', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const cityId = await page.getByTestId('city-list-item').first().getAttribute('data-city-id');
  const badge = page.locator(`[data-city-id="${cityId}"]`).getByTestId('score-badge');
  const scoreBefore = await badge.innerText();

  await openSection(page, 'Настройки');
  const thumb = page.getByTestId('weight-cost-of-living').getByRole('slider');
  await thumb.focus();
  await thumb.press('Home');
  await openSection(page, 'Города');

  await expect(badge).not.toHaveText(scoreBefore);
});

test('клик по городу открывает карточку с разбором балла', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const firstCity = page.getByTestId('city-list-item').first();
  const cityName = await firstCity.getByTestId('city-name').innerText();

  await firstCity.click();

  const card = page.getByTestId('city-card');
  await expect(card.getByRole('heading', { name: cityName })).toBeVisible();
  await expect(card.getByTestId('score-breakdown').getByRole('listitem').first()).toBeVisible();
});
