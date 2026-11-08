import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dogs:onboarded', '1'));
  await page.goto('/');
  // SSR-кнопка видна до гидратации; выбор раздела идемпотентен.
  await expect(async () => {
    const settings = page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('button', { name: 'Настройки' });
    await settings.click();
    await expect(settings).toHaveAttribute('aria-pressed', 'true');
  }).toPass();
});

test('очистка обязательной границы сохраняет число для последующего шага', async ({ page }) => {
  const lower = page.getByRole('spinbutton', { name: 'Температура летом: от', exact: true });
  const upper = page.getByRole('spinbutton', { name: 'Температура летом: до', exact: true });
  await lower.fill('18');
  await lower.press('Tab');
  await upper.fill('28');
  await upper.press('Tab');
  await lower.fill('');
  await lower.press('Tab');
  await expect(lower).toHaveValue('18');
  await page
    .getByRole('button', { name: 'Температура летом: увеличить нижнюю границу', exact: true })
    .click();
  await expect(lower).toHaveValue('19');
  await upper.fill('');
  await upper.press('Tab');
  await page
    .getByRole('button', { name: 'Температура летом: уменьшить верхнюю границу', exact: true })
    .click();
  await expect(upper).toHaveValue('27');
  // Пересечение границ нормализует обе стороны и исходное число следующего шага.
  await lower.fill('30');
  await lower.press('Tab');
  await expect(lower).toHaveValue('27');
  await expect(upper).toHaveValue('30');
  await page
    .getByRole('button', { name: 'Температура летом: увеличить нижнюю границу', exact: true })
    .click();
  await expect(lower).toHaveValue('28');
});

test('необязательная граница очищается, а шаг начинается с нуля', async ({ page }) => {
  // Доход не используется: проверяем числовой фильтр, а не целевой диапазон.
  const costLower = page.getByRole('spinbutton', { name: /Стоимость жизни: от/ });
  await costLower.fill('100');
  await costLower.press('Tab');
  await costLower.fill('');
  await costLower.press('Tab');
  await expect(costLower).toHaveValue('');
  await page
    .getByRole('button', { name: 'Стоимость жизни: увеличить нижнюю границу', exact: true })
    .click();
  await expect(costLower).toHaveValue('1');
});
