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

test('у первого города в списке есть ярлык сильной или слабой стороны', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');

  const chip = page.getByTestId('city-list-item').first().getByTestId('city-chip').first();

  await expect(chip).toHaveText(/\S/);
});

test('карточка объясняет место города уровнями и подсказками', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  await page.getByTestId('city-list-item').first().click();

  const card = page.getByTestId('city-card');
  await expect(card.getByRole('heading', { name: 'Тянет вверх' })).toBeVisible();
  await expect(card.getByTestId('level-chip').first()).toHaveText(/\S/);

  await card.getByTestId('factor-hint').first().click();

  await expect(page.getByTestId('factor-hint-content')).toBeVisible();
});

function personaCard(page: Page, name: string) {
  return page.getByTestId('persona-card').filter({ hasText: name });
}

test('выбор персоны меняет первый город и попадает в адрес', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const firstCity = page.getByTestId('city-list-item').first();
  const cityBefore = (await firstCity.getAttribute('data-city-id')) ?? '';

  await openSection(page, 'Настройки');
  await personaCard(page, 'Семья с детьми').click();

  await expect(personaCard(page, 'Семья с детьми')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/#p=family/);
  await openSection(page, 'Города');
  await expect(firstCity).not.toHaveAttribute('data-city-id', cityBefore);
});

test('ссылка с персоной открывает эту персону', async ({ page }) => {
  await page.goto('/#p=family');
  await openSection(page, 'Настройки');

  await expect(personaCard(page, 'Семья с детьми')).toHaveAttribute('aria-pressed', 'true');
  await expect(personaCard(page, 'Удалёнщик надолго')).toHaveAttribute('aria-pressed', 'false');
});
