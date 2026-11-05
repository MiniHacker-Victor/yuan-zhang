import { expect, test } from '@playwright/test';

test('records a CNY expense and preserves the converted GBP amount', async ({ page }) => {
  await page.route('https://api.frankfurter.dev/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ date: '2026-09-18', base: 'CNY', quote: 'GBP', rate: 0.1 }])
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('币种')).toHaveValue('GBP');
  await dialog.getByLabel('账单金额').fill('100');
  await dialog.getByLabel('币种').selectOption('CNY');

  const rateInput = dialog.getByLabel('1 CNY 等于多少英镑');
  await expect.poll(async () => rateInput.inputValue(), { timeout: 10_000 }).not.toBe('');
  await rateInput.fill('0.1');
  await dialog.getByPlaceholder('例如：和朋友晚餐、地铁月票').fill('人民币账单');
  await dialog.getByRole('button', { name: '确认记账' }).click();

  await expect(page.getByText('账单已记录。')).toBeVisible();
  await page.getByRole('button', { name: '账单', exact: true }).click();
  await expect(page.getByText('¥100.00')).toBeVisible();
  await expect(page.getByText('≈ £10.00')).toBeVisible();
  await expect(page.getByText('人民币账单')).toBeVisible();

  await page.getByRole('button', { name: '总览', exact: true }).click();
  await page.getByLabel('换算显示').selectOption('CNY');
  await expect(page.locator('.hero-total')).toHaveText('¥100.00');
});

test('sets budgets and shows category overspend advice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '预算', exact: true }).click();

  const totalBudgetPanel = page.locator('.budget-form-panel');
  await totalBudgetPanel.getByLabel('预算金额（英镑）').fill('1000');
  await totalBudgetPanel.getByRole('button', { name: '设置总预算' }).click();
  await expect(page.getByText('预算已在本期生效。')).toBeVisible();

  const categoryBudgetPanel = page.locator('.category-budget-editor');
  await categoryBudgetPanel.getByLabel('预算金额（英镑）').fill('600');
  await categoryBudgetPanel.getByRole('button', { name: '添加分类预算' }).click();
  await expect(page.getByText('预算已在本期生效。')).toBeVisible();
  await expect(page.getByText('餐饮', { exact: true }).last()).toBeVisible();

  await page.getByRole('button', { name: '记一笔' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('账单金额').fill('700');
  await dialog.getByRole('button', { name: '确认记账' }).click();
  await expect(page.getByText('账单已记录。')).toBeVisible();

  await page.getByRole('button', { name: '总览', exact: true }).click();
  await expect(page.getByText('餐饮预算已超支')).toBeVisible();
  await expect(page.getByText(/超出分类预算 £100\.00/)).toBeVisible();
});

test('publishes an installable PWA manifest', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe('元账 · 多币种记账');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(2);
});
