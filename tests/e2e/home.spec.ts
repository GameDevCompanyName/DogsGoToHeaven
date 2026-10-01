import { expect, type Page, test } from '@playwright/test';

// Тайлы и WebGL в CI не гарантированы: проверяем DOM, от карты — только контейнер.

// Флаг лендинга стоит заранее: без него главная без хеша уводит на /start.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dogs:onboarded', '1'));
});

function openSection(page: Page, name: 'Карта' | 'Города' | 'Таблица' | 'Настройки') {
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

test('выбор персоны меняет выдачу и попадает в адрес', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const items = page.getByTestId('city-list-item');
  // Сравниваем первую пятёрку, а не один город: лидер может совпасть у двух персон.
  const topBefore = await items.evaluateAll((nodes) =>
    nodes.slice(0, 5).map((node) => node.getAttribute('data-city-id')),
  );

  await openSection(page, 'Настройки');
  await personaCard(page, 'Семья с детьми').click();

  await expect(personaCard(page, 'Семья с детьми')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/#p=family/);
  await openSection(page, 'Города');
  await expect
    .poll(() =>
      items.evaluateAll((nodes) =>
        nodes.slice(0, 5).map((node) => node.getAttribute('data-city-id')),
      ),
    )
    .not.toEqual(topBefore);
});

test('ссылка с персоной открывает эту персону', async ({ page }) => {
  await page.goto('/#p=family');
  await openSection(page, 'Настройки');

  await expect(personaCard(page, 'Семья с детьми')).toHaveAttribute('aria-pressed', 'true');
  await expect(personaCard(page, 'Удалёнщик надолго')).toHaveAttribute('aria-pressed', 'false');
});

test('поиск находит город и сохраняет его место', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const tbilisi = page.locator('[data-city-id="tbilisi"]');
  const rankBefore = await tbilisi.getByTestId('city-rank').innerText();

  await page.getByTestId('city-search').fill('тбил');

  await expect(page.getByTestId('city-list-item')).toHaveCount(1);
  await expect(tbilisi.getByTestId('city-name')).toHaveText('Тбилиси');
  await expect(tbilisi.getByTestId('city-rank')).toHaveText(rankBefore);

  await page.getByTestId('city-search').fill('атлантида');

  await expect(page.getByTestId('empty-list')).toHaveText('Ничего не найдено');
});

test('сброс фильтров возвращает отсечённые города', async ({ page }) => {
  await page.goto('/#p=family');
  await openSection(page, 'Города');
  const hidden = page.getByTestId('hidden-by-filter');
  await expect(hidden).toContainText('Скрыто фильтрами');

  await hidden.getByRole('button', { name: 'Сбросить фильтры' }).click();

  await expect(hidden).toBeHidden();
  await expect(page).toHaveURL(/f=[\w-]+:-/);
});

test('ссылка, вставленная в открытую вкладку, заменяет правки', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Настройки');
  const thumb = page.getByTestId('weight-cost-of-living').getByRole('slider');
  await thumb.focus();
  await thumb.press('Home');
  await expect(page.getByTestId('persona-status')).toBeVisible();
  await expect(page).toHaveURL(/w=cost-of-living:0/);

  await page.evaluate(() => {
    location.hash = '#p=family';
  });

  await expect(personaCard(page, 'Семья с детьми')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('persona-status')).toBeHidden();
  await expect(page).toHaveURL(/#p=family$/);
});

test('сравнение двух городов показывает таблицу с двумя колонками', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Города');
  const toggles = page.getByTestId('compare-toggle');

  await toggles.nth(0).click();
  await toggles.nth(1).click();

  await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/cmp=[\w-]+\|[\w-]+/);
  await page.getByTestId('compare-bar').getByRole('button', { name: 'Открыть' }).click();
  const sheet = page.getByTestId('compare-sheet');
  await expect(sheet.getByTestId('compare-column')).toHaveCount(2);
  await expect(sheet.getByRole('rowheader').first()).toBeVisible();
});

test('таблица сортируется по колонке и пишет сортировку в адрес', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'Таблица');
  const table = page.getByTestId('city-table');
  const header = table.getByRole('columnheader').filter({ has: page.getByTestId('sort-rent') });
  // Пустой data-value — нет данных: Number('') дал бы 0 и сломал порядок.
  const rents = async () =>
    (
      await table
        .getByTestId('table-row')
        .locator('[data-factor-id="rent"]')
        .evaluateAll((cells) => cells.slice(0, 10).map((cell) => cell.getAttribute('data-value')))
    )
      .filter((value) => value !== null && value !== '')
      .map(Number);

  await table.getByTestId('sort-rent').click();

  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect(page).toHaveURL(/sort=rent:asc/);
  const ascending = await rents();
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await table.getByTestId('sort-rent').click();

  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/sort=rent:desc/);
  const descending = await rents();
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
});
