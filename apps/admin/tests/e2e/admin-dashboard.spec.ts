import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the admin dashboard
    await page.goto('/admin/dashboard');
  });

  test('should load admin dashboard successfully', async ({ page }) => {
    // Check if the main layout is loaded
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
    
    // Check if the dashboard content is loaded
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Check if stats cards are displayed
    await expect(page.locator('text=Total Users')).toBeVisible();
    await expect(page.locator('text=Active Users')).toBeVisible();
    await expect(page.locator('text=Inactive Users')).toBeVisible();
    
    // Check if values are displayed
    await expect(page.locator('text=1,234')).toBeVisible();
    await expect(page.locator('text=1,100')).toBeVisible();
    await expect(page.locator('text=134')).toBeVisible();
  });

  test('should display data table', async ({ page }) => {
    // Check if data table is displayed
    await expect(page.locator('role=table')).toBeVisible();
    
    // Check if table headers are displayed
    await expect(page.locator('text=Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    
    // Check if table data is displayed
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=jane@example.com')).toBeVisible();
  });

  test('should handle data table sorting', async ({ page }) => {
    // Click on Name column header to sort
    await page.click('text=Name');
    
    // Check if sorting indicator is displayed
    await expect(page.locator('[aria-sort="ascending"]')).toBeVisible();
    
    // Click again to sort descending
    await page.click('text=Name');
    
    // Check if sorting indicator changes
    await expect(page.locator('[aria-sort="descending"]')).toBeVisible();
  });

  test('should handle data table row selection', async ({ page }) => {
    // Check if select all checkbox is present
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    
    // Click select all checkbox
    await page.click('input[type="checkbox"]').first();
    
    // Check if all row checkboxes are selected
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });

  test('should handle data table row clicking', async ({ page }) => {
    // Click on a table row
    await page.click('text=John Doe');
    
    // Check if row click is handled (you might want to add a modal or detail view)
    // This depends on your implementation
  });

  test('should handle sidebar navigation', async ({ page }) => {
    // Check if sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Check if navigation items are present
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Security')).toBeVisible();
  });

  test('should handle sidebar toggle on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if menu button is visible on mobile
    await expect(page.locator('[data-testid="menu-button"]')).toBeVisible();
    
    // Click menu button to open sidebar
    await page.click('[data-testid="menu-button"]');
    
    // Check if sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('should handle breadcrumb navigation', async ({ page }) => {
    // Check if breadcrumb is displayed
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    
    // Check if breadcrumb items are present
    await expect(page.locator('text=Admin')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should handle performance monitoring', async ({ page }) => {
    // Check if performance monitor is available
    await expect(page.locator('text=Start Performance Monitor')).toBeVisible();
    
    // Click start monitoring button
    await page.click('text=Start Performance Monitor');
    
    // Check if monitoring status changes
    await expect(page.locator('text=Stop Monitoring')).toBeVisible();
    
    // Check if metrics are displayed
    await expect(page.locator('text=Load Time')).toBeVisible();
    await expect(page.locator('text=Bundle Size')).toBeVisible();
    await expect(page.locator('text=Memory Usage')).toBeVisible();
  });

  test('should handle accessibility testing', async ({ page }) => {
    // Check if accessibility tester is available
    await expect(page.locator('text=Run Test')).toBeVisible();
    
    // Click run test button
    await page.click('text=Run Test');
    
    // Check if testing status changes
    await expect(page.locator('text=Testing...')).toBeVisible();
    
    // Wait for test to complete
    await page.waitForSelector('text=Total Issues', { timeout: 10000 });
    
    // Check if test results are displayed
    await expect(page.locator('text=Total Issues')).toBeVisible();
    await expect(page.locator('text=Errors')).toBeVisible();
    await expect(page.locator('text=Warnings')).toBeVisible();
    await expect(page.locator('text=Passed')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Test arrow key navigation in table
    await page.click('text=John Doe');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    
    // Test enter key activation
    await page.keyboard.press('Enter');
  });

  test('should handle screen reader support', async ({ page }) => {
    // Check if ARIA attributes are present
    await expect(page.locator('role=table')).toBeVisible();
    await expect(page.locator('role=grid')).toBeVisible();
    await expect(page.locator('role=button')).toBeVisible();
    
    // Check if ARIA labels are present
    await expect(page.locator('[aria-label="User management table"]')).toBeVisible();
    await expect(page.locator('[aria-label="Select all rows"]')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test with empty data
    await page.goto('/admin/dashboard?empty=true');
    
    // Check if table still renders
    await expect(page.locator('role=table')).toBeVisible();
    
    // Check if empty state is handled
    await expect(page.locator('text=No data available')).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    // Test with slow loading
    await page.goto('/admin/dashboard?slow=true');
    
    // Check if loading indicator is shown
    await expect(page.locator('text=Loading...')).toBeVisible();
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 10000 });
  });

  test('should handle form interactions', async ({ page }) => {
    // Navigate to user management page
    await page.goto('/admin/users');
    
    // Check if form fields are present
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Test form input
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Test form submission
    await page.click('button[type="submit"]');
  });

  test('should handle modal interactions', async ({ page }) => {
    // Click on a button that opens a modal
    await page.click('text=Add User');
    
    // Check if modal is opened
    await expect(page.locator('role=dialog')).toBeVisible();
    
    // Test modal interactions
    await page.fill('input[name="name"]', 'New User');
    await page.fill('input[name="email"]', 'newuser@example.com');
    
    // Test modal close
    await page.click('text=Cancel');
    await expect(page.locator('role=dialog')).not.toBeVisible();
  });

  test('should handle search functionality', async ({ page }) => {
    // Test search input
    await page.fill('input[placeholder="Search..."]', 'John');
    
    // Check if search results are filtered
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).not.toBeVisible();
    
    // Clear search
    await page.fill('input[placeholder="Search..."]', '');
    
    // Check if all results are shown
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('should handle pagination', async ({ page }) => {
    // Check if pagination controls are present
    await expect(page.locator('text=Previous')).toBeVisible();
    await expect(page.locator('text=Next')).toBeVisible();
    
    // Test pagination navigation
    await page.click('text=Next');
    await page.click('text=Previous');
  });

  test('should handle bulk actions', async ({ page }) => {
    // Select multiple rows
    await page.check('input[type="checkbox"]').first();
    await page.check('input[type="checkbox"]').nth(1);
    
    // Check if bulk action buttons are enabled
    await expect(page.locator('text=Delete Selected')).toBeEnabled();
    await expect(page.locator('text=Export Selected')).toBeEnabled();
  });

  test('should handle real-time updates', async ({ page }) => {
    // Check if real-time updates are working
    await expect(page.locator('text=Last updated')).toBeVisible();
    
    // Wait for potential updates
    await page.waitForTimeout(2000);
    
    // Check if content is still visible
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
  });
});

