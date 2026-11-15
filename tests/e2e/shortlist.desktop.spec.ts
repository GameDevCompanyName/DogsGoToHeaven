import { expect, test } from '@playwright/test';

test('desktop: условия, подборка и сравнение проходят без числовых весов', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
  await page.getByTestId('quick-rent-max').fill('1200');
  await page.getByTestId('quick-rent-max').press('Tab');
  await page.getByRole('button', { name: 'Показать города', exact: true }).click();
  await expect(page.getByTestId('selection-summary')).toContainText(/1\s200/);
  const toggles = page.getByTestId('compare-toggle');
  await toggles.nth(0).click();
  await toggles.nth(1).click();
  await page
    .getByTestId('compare-bar')
    .getByRole('button', { name: 'Открыть', exact: true })
    .click();
  await expect(page.getByTestId('compare-sheet').getByTestId('compare-column')).toHaveCount(2);
  await expect(page.getByTestId('compare-sheet').getByRole('rowheader').first()).toBeVisible();
});
