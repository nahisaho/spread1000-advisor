import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display header and title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page).toHaveTitle(/SPReAD-1000/i);
  });

  test('should show settings link in header', async ({ page }) => {
    await page.goto('/');
    const settingsLink = page.locator('a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test('should show project list or empty state', async ({ page }) => {
    await page.goto('/');
    // Wait for either empty state or project list (loading will resolve to one)
    const emptyState = page.getByTestId('empty-state');
    const projectList = page.getByTestId('project-list');
    // At least one should be visible after loading
    await expect(emptyState.or(projectList)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Settings Page', () => {
  test('should display LLM settings form', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#provider')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Connection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('should allow changing provider to ollama', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#provider')).toBeVisible();
    // Wait for initial settings load to complete (prevents race condition)
    await page.waitForTimeout(1000);
    await page.selectOption('#provider', 'ollama');
    await expect(page.locator('#endpoint')).toBeVisible({ timeout: 5000 });
  });

  test('should save settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#provider')).toBeVisible();
    // Wait for initial settings load to complete
    await page.waitForTimeout(1000);
    await page.selectOption('#provider', 'ollama');
    await expect(page.locator('#endpoint')).toBeVisible({ timeout: 5000 });
    await page.fill('#model', 'llama3');
    await page.fill('#endpoint', 'http://localhost:11434');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('✓ Saved')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Project Workflow', () => {
  test('should create a new project via form', async ({ page }) => {
    await page.goto('/');
    // Wait for page to be interactive
    const newProjectBtn = page.getByTestId('new-project-button');
    const emptyBtn = page.getByTestId('empty-state').locator('button');
    // Click whichever button is available
    const btn = newProjectBtn.or(emptyBtn);
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.first().click();
    // Form should appear
    await expect(page.getByTestId('create-project-form')).toBeVisible({ timeout: 5000 });
    await page.fill('#project-name', 'e2e-test-project');
    await page.getByTestId('create-project-form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/projects\/.+/, { timeout: 10000 });
  });

  test('should display wizard with step indicator', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('new-project-button').or(page.getByTestId('empty-state').locator('button'));
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.first().click();
    await page.fill('#project-name', 'wizard-test');
    await page.getByTestId('create-project-form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/projects\/.+/, { timeout: 10000 });

    await expect(page.getByTestId('wizard-layout')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('step-indicator')).toBeVisible();
    await expect(page.getByTestId('step-content')).toBeVisible();
  });

  test('should show context collector as first step', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('new-project-button').or(page.getByTestId('empty-state').locator('button'));
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.first().click();
    await page.fill('#project-name', 'context-test');
    await page.getByTestId('create-project-form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/projects\/.+/, { timeout: 10000 });

    await expect(page.getByTestId('wizard-layout')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('context-collector-step')).toBeVisible();
    await expect(page.getByTestId('context-progress')).toBeVisible();
    await expect(page.getByTestId('context-input')).toBeVisible();
  });
});

test.describe('API Endpoints', () => {
  test('GET /api/settings returns config', async ({ request }) => {
    const response = await request.get('/api/settings');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('provider');
    expect(data).toHaveProperty('model');
  });

  test('GET /api/projects returns array', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /api/projects creates project', async ({ request }) => {
    const response = await request.post('/api/projects', {
      data: { name: 'api-test-project' },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name', 'api-test-project');
  });

  test('POST /api/llm/test validates input', async ({ request }) => {
    const response = await request.post('/api/llm/test', {
      data: {},
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  test('POST /api/llm/test rejects invalid endpoint (SSRF)', async ({ request }) => {
    const response = await request.post('/api/llm/test', {
      data: {
        type: 'ollama',
        model: 'llama3',
        endpoint: 'http://169.254.169.254/metadata',
      },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid endpoint');
  });

  test('GET /api/export with invalid format returns 400', async ({ request }) => {
    const response = await request.get('/api/export/test-project/invalid');
    expect(response.status()).toBe(400);
  });
});
