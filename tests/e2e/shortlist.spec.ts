import { expect, test } from '@playwright/test';

test('первый заход сразу объясняет подборку без изучения весов', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Куда можно переехать?' })).toBeVisible({
    timeout: 3000,
  });
  await expect(page.getByTestId('city-list-item').first()).toBeVisible();
  await expect(page.getByTestId('selection-summary')).toContainText('Для изучения');
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('явный порядок по доходу поднимает доступный город перед слишком дорогим', async ({
  page,
}) => {
  await page.goto('/#p=first-look&b=1400&bp=1');
  const ids = await page
    .getByTestId('city-list-item')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-city-id')));
  expect(ids).toContain('qingdao');
  expect(ids).toContain('new-york-city');
  expect(ids.indexOf('qingdao')).toBeLessThan(ids.indexOf('new-york-city'));
});

test('ревью: конфликт нового предела не изменяет прежнее обязательное условие', async ({
  page,
}) => {
  await page.goto('/#p=first-look&f=rent:1000-');
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await page.getByTestId('quick-rent-max').fill('700');
  await page.getByTestId('quick-rent-max').press('Tab');
  await expect(page.getByTestId('quick-rent-max')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/rent:1000-/);
});

test('ревью: неверный ввод не позволяет уйти к прежним результатам без исправления', async ({
  page,
}) => {
  await page.goto('/#p=first-look&f=rent:-900');
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await page.getByTestId('quick-rent-max').fill('abc');
  await page.getByTestId('quick-rent-max').press('Tab');
  await page.getByRole('button', { name: 'Показать города', exact: true }).click();
  await expect(page.getByTestId('simple-preferences')).toBeVisible();
  await expect(page.getByTestId('quick-rent-max')).toBeFocused();
});

test('ревью: замена сценария сбрасывает ошибочный черновик условий', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await page.getByTestId('quick-rent-max').fill('abc');
  await page.getByTestId('quick-rent-max').press('Tab');
  await page.getByTestId('advanced-settings').locator('summary').click();
  await page.getByTestId('persona-card').filter({ hasText: 'Удалёнщик надолго' }).click();
  await expect(page.getByTestId('quick-rent-max')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('quick-rent-max')).toHaveValue('');
});

test('ревью: открыть сравнение можно из глубины списка', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await page.goto('/');
  const toggles = page.getByTestId('compare-toggle');
  await toggles.nth(76).click();
  await toggles.nth(77).click();
  await expect(
    page.getByTestId('compare-bar').getByRole('button', { name: 'Открыть', exact: true }),
  ).toBeInViewport();
});

test('ревью: заголовки трёх городов видны при прокрутке сравнения', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await page.goto('/#p=first-look&cmp=belgrade|tbilisi|batumi');
  await page
    .getByTestId('compare-bar')
    .getByRole('button', { name: 'Открыть', exact: true })
    .click();
  const sheet = page.getByTestId('compare-sheet');
  await sheet
    .getByRole('region', { name: 'Главные различия городов', exact: true })
    .evaluate((element) => {
      let scroller: Element | null = element;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight)
        scroller = scroller.parentElement;
      if (scroller) scroller.scrollTop = 750;
    });
  await expect(sheet.getByTestId('compare-column').first()).toBeInViewport();
});

test('ревью: сравнение сразу помечает города, не прошедшие ограничения', async ({ page }) => {
  await page.goto('/#p=first-look&f=rent:-1&cmp=new-york-city|belgrade');
  await page
    .getByTestId('compare-bar')
    .getByRole('button', { name: 'Открыть', exact: true })
    .click();
  await expect(page.getByTestId('compare-column').first()).toContainText('Не проходит');
});

test('обязательная аренда сохраняется в ссылке и неизвестные данные видны отдельно', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await page.getByTestId('quick-rent-max').fill('900');
  await page.getByTestId('quick-rent-max').press('Tab');
  await page.getByRole('button', { name: 'Показать города', exact: true }).click();
  await expect(page.getByTestId('selection-summary')).toContainText('900');
  await expect(page).toHaveURL(/rent:-900/);
  await expect(page.getByTestId('needs-data-heading')).toBeAttached();
  await page.reload();
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await expect(page.getByTestId('quick-rent-max')).toHaveValue('900');
});

test('при увеличении текста все разделы остаются достижимы', async ({ page }) => {
  await page.goto('/');
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = '32px';
  });
  const nav = page.getByRole('navigation', { name: 'Разделы' });
  for (const label of ['Города', 'Карта', 'Таблица', 'Условия']) {
    const button = nav.getByRole('button', { name: label, exact: true });
    await expect(button).toBeInViewport();
  }
});
