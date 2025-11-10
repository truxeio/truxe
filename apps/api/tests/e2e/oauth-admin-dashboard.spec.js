/**
 * OAuth Admin Dashboard - E2E Tests (Playwright)
 * 
 * End-to-end tests for OAuth Provider Admin Dashboard UI flows:
 * - Create new OAuth client
 * - View client details
 * - Edit client configuration
 * - Regenerate client secret
 * - Delete client
 * - Search and filter clients
 * 
 * Prerequisites:
 * - Server running on http://localhost:3001
 * - Test user authenticated
 * - Database accessible
 * 
 * Test Count: 10 tests
 */

import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPassword123!';

// Test data
const TEST_CLIENT = {
  name: `E2E Test Client ${Date.now()}`,
  description: 'Automated test client created by Playwright',
  redirectUri: 'http://localhost:3000/callback',
  homepageUrl: 'http://localhost:3000',
  logoUrl: 'https://via.placeholder.com/80',
};

test.describe('OAuth Admin Dashboard - E2E Tests', () => {
  let clientId;

  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/auth/login`);

    // Fill in credentials and login
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL(/dashboard|clients/, { timeout: 10000 });
  });

  // ============================================================================
  // Client List Page Tests
  // ============================================================================

  test('should display OAuth clients list page', async ({ page }) => {
    await page.goto(`${BASE_URL}/oauth/admin/clients.html`);

    // Verify page title
    await expect(page.locator('h1')).toContainText('OAuth Clients');

    // Verify main elements are visible
    await expect(page.locator('.page-header')).toBeVisible();
    await expect(page.locator('.search-box')).toBeVisible();
    await expect(page.locator('button:has-text("New Client")')).toBeVisible();
  });

  test('should search for clients', async ({ page }) => {
    await page.goto(`${BASE_URL}/oauth/admin/clients.html`);

    // Wait for clients to load
    await page.waitForSelector('.clients-grid', { timeout: 5000 });

    // Type in search box
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('test');

    // Wait for debounce (300ms) + a bit extra
    await page.waitForTimeout(500);

    // Verify URL parameter is set
    expect(page.url()).toContain('search=test');
  });

  test('should filter clients by status', async ({ page }) => {
    await page.goto(`${BASE_URL}/oauth/admin/clients.html`);

    // Wait for clients to load
    await page.waitForSelector('.clients-grid', { timeout: 5000 });

    // Select filter
    await page.selectOption('#statusFilter', 'active');

    // Wait for filter to apply
    await page.waitForTimeout(300);

    // Verify URL parameter is set
    expect(page.url()).toContain('status=active');
  });

  // ============================================================================
  // Create Client Tests
  // ============================================================================

  test('should create a new OAuth client', async ({ page }) => {
    await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);

    // Verify we're on the create form
    await expect(page.locator('h1')).toContainText('Create OAuth Client');

    // Fill in basic information
    await page.fill('#clientName', TEST_CLIENT.name);
    await page.fill('#description', TEST_CLIENT.description);
    await page.fill('#logoUri', TEST_CLIENT.logoUrl);

    // Add redirect URI
    await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
    await page.click('button:has-text("Add URI")');

    // Verify URI was added
    await expect(page.locator('.redirect-uri-item')).toContainText(TEST_CLIENT.redirectUri);

    // Select scopes
    await page.check('input[value="openid"]');
    await page.check('input[value="email"]');
    await page.check('input[value="profile"]');

    // Fill in additional fields
    await page.fill('#clientUri', TEST_CLIENT.homepageUrl);

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Client")');

    // Wait for success modal
    await expect(page.locator('.modal-title')).toContainText('OAuth Client Created', { timeout: 5000 });

    // Verify credentials are displayed
    await expect(page.locator('.modal-content')).toContainText('Client ID');
    await expect(page.locator('.modal-content')).toContainText('Client Secret');

    // Extract client ID for later tests
    const clientIdText = await page.locator('.credential-row:has-text("Client ID") input').inputValue();
    clientId = clientIdText;
    expect(clientId).toMatch(/^cl_[a-f0-9]+$/);

    // Copy credentials
    await page.click('button:has-text("Copy Client ID")');
    await page.click('button:has-text("Copy Client Secret")');

    // Verify success toast
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 2000 });

    // Close modal
    await page.click('button:has-text("Done")');

    // Should redirect to clients list
    await expect(page).toHaveURL(/clients\.html/, { timeout: 5000 });

    // Verify new client appears in list
    await expect(page.locator('.client-card')).toContainText(TEST_CLIENT.name);
  });

  // ============================================================================
  // Client Details Tests
  // ============================================================================

  test('should view client details', async ({ page }) => {
    // First create a client
    await test.step('Create test client', async () => {
      await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
      await page.fill('#clientName', TEST_CLIENT.name);
      await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
      await page.click('button:has-text("Add URI")');
      await page.check('input[value="openid"]');
      await page.click('button[type="submit"]:has-text("Create Client")');
      await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
      
      // Get client ID
      const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
      clientId = await clientIdInput.inputValue();
      
      await page.click('button:has-text("Done")');
    });

    // Navigate to details page
    await test.step('View client details', async () => {
      await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

      // Verify details are displayed
      await expect(page.locator('h1.details-name')).toContainText(TEST_CLIENT.name);
      await expect(page.locator('#clientId')).toContainText(clientId);

      // Verify sections are visible
      await expect(page.locator('h2:has-text("Client Credentials")')).toBeVisible();
      await expect(page.locator('h2:has-text("OAuth Configuration")')).toBeVisible();
      await expect(page.locator('h2:has-text("Security Settings")')).toBeVisible();
      await expect(page.locator('h2:has-text("Token Statistics")')).toBeVisible();

      // Verify redirect URIs are displayed
      await expect(page.locator('.uri-item')).toContainText(TEST_CLIENT.redirectUri);

      // Verify scopes are displayed
      await expect(page.locator('.scope-tag')).toContainText('openid');
    });
  });

  test('should display token statistics', async ({ page }) => {
    // Use existing client or create one
    if (!clientId) {
      await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
      await page.fill('#clientName', TEST_CLIENT.name);
      await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
      await page.click('button:has-text("Add URI")');
      await page.check('input[value="openid"]');
      await page.click('button[type="submit"]:has-text("Create Client")');
      await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
      
      const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
      clientId = await clientIdInput.inputValue();
      
      await page.click('button:has-text("Done")');
    }

    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

    // Wait for statistics to load
    await page.waitForSelector('#tokenStats .info-item', { timeout: 5000 });

    // Verify statistics are displayed (not "Loading..." or "N/A")
    const tokensGenerated = page.locator('#tokenStats .info-item:has-text("Tokens Generated") .info-value');
    await expect(tokensGenerated).not.toContainText('Loading');
    await expect(tokensGenerated).not.toContainText('N/A');
    await expect(tokensGenerated).toContainText(/\d+/); // Should contain a number

    // Verify active tokens
    const activeTokens = page.locator('#tokenStats .info-item:has-text("Active Tokens") .info-value');
    await expect(activeTokens).toContainText(/\d+/);

    // Change timeframe
    await page.selectOption('#statsTimeframe', '7d');

    // Wait for stats to reload
    await page.waitForTimeout(1000);

    // Verify stats still display correctly
    await expect(tokensGenerated).toContainText(/\d+/);
  });

  test('should copy client ID', async ({ page }) => {
    if (!clientId) {
      // Create a client first
      await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
      await page.fill('#clientName', TEST_CLIENT.name);
      await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
      await page.click('button:has-text("Add URI")');
      await page.check('input[value="openid"]');
      await page.click('button[type="submit"]:has-text("Create Client")');
      await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
      
      const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
      clientId = await clientIdInput.inputValue();
      
      await page.click('button:has-text("Done")');
    }

    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

    // Click copy button
    const copyBtn = page.locator('.credential-row:has-text("Client ID") button:has-text("Copy")');
    await copyBtn.click();

    // Verify success toast appears
    await expect(page.locator('.toast-success')).toContainText('Copied', { timeout: 2000 });
  });

  // ============================================================================
  // Regenerate Secret Tests
  // ============================================================================

  test('should regenerate client secret', async ({ page }) => {
    if (!clientId) {
      // Create a client first
      await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
      await page.fill('#clientName', TEST_CLIENT.name);
      await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
      await page.click('button:has-text("Add URI")');
      await page.check('input[value="openid"]');
      await page.click('button[type="submit"]:has-text("Create Client")');
      await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
      
      const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
      clientId = await clientIdInput.inputValue();
      
      await page.click('button:has-text("Done")');
    }

    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

    // Click regenerate button
    await page.click('button:has-text("Regenerate")');

    // Confirm in modal
    await expect(page.locator('.modal-title')).toContainText('Regenerate', { timeout: 2000 });
    await expect(page.locator('.modal-content')).toContainText('invalidate');
    await page.click('.modal button:has-text("Regenerate Secret")');

    // Wait for success modal
    await expect(page.locator('.modal-title')).toContainText('Regenerated', { timeout: 5000 });

    // Verify new secret is displayed
    await expect(page.locator('.modal-content')).toContainText('cs_'); // Secret format

    // Copy new secret
    await page.click('.modal button:has-text("Copy Secret")');

    // Verify copy success
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 2000 });

    // Close modal
    await page.click('.modal button:has-text("Done")');
  });

  // ============================================================================
  // Edit Client Tests
  // ============================================================================

  test('should edit client details', async ({ page }) => {
    if (!clientId) {
      // Create a client first
      await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
      await page.fill('#clientName', TEST_CLIENT.name);
      await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
      await page.click('button:has-text("Add URI")');
      await page.check('input[value="openid"]');
      await page.click('button[type="submit"]:has-text("Create Client")');
      await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
      
      const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
      clientId = await clientIdInput.inputValue();
      
      await page.click('button:has-text("Done")');
    }

    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

    // Click edit button
    await page.click('button:has-text("Edit")');

    // Should navigate to edit form
    await expect(page).toHaveURL(/client-form\.html\?id=/, { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Edit OAuth Client');

    // Verify form is pre-populated
    const nameInput = page.locator('#clientName');
    await expect(nameInput).toHaveValue(TEST_CLIENT.name);

    // Update client name
    const updatedName = `${TEST_CLIENT.name} (Updated)`;
    await nameInput.fill(updatedName);

    // Update description
    await page.fill('#description', 'Updated description');

    // Submit form
    await page.click('button[type="submit"]:has-text("Save Changes")');

    // Wait for success
    await expect(page.locator('.toast-success')).toContainText('updated', { timeout: 5000 });

    // Navigate back to details
    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);

    // Verify changes
    await expect(page.locator('h1.details-name')).toContainText(updatedName);
  });

  // ============================================================================
  // Delete Client Tests
  // ============================================================================

  test('should delete client', async ({ page }) => {
    // Create a client specifically for deletion
    await page.goto(`${BASE_URL}/oauth/admin/client-form.html`);
    const deleteTestName = `Delete Test ${Date.now()}`;
    await page.fill('#clientName', deleteTestName);
    await page.fill('input[placeholder="https://example.com/callback"]', TEST_CLIENT.redirectUri);
    await page.click('button:has-text("Add URI")');
    await page.check('input[value="openid"]');
    await page.click('button[type="submit"]:has-text("Create Client")');
    await page.waitForSelector('.modal-title:has-text("OAuth Client Created")');
    
    const clientIdInput = page.locator('.credential-row:has-text("Client ID") input');
    const deleteClientId = await clientIdInput.inputValue();
    
    await page.click('button:has-text("Done")');

    // Navigate to details page
    await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${deleteClientId}`);

    // Click delete button
    await page.click('button:has-text("Delete")');

    // Confirm in modal
    await expect(page.locator('.modal-title')).toContainText('Delete', { timeout: 2000 });
    await expect(page.locator('.modal-content')).toContainText('permanent');
    await page.click('.modal button.btn-danger:has-text("Delete")');

    // Should redirect to clients list
    await expect(page).toHaveURL(/clients\.html/, { timeout: 5000 });

    // Verify success toast
    await expect(page.locator('.toast-success')).toContainText('deleted', { timeout: 2000 });

    // Verify client is no longer in list
    await expect(page.locator('.client-card')).not.toContainText(deleteTestName, { timeout: 3000 });
  });

  // ============================================================================
  // Cleanup: Delete test clients
  // ============================================================================

  test.afterAll(async ({ page }) => {
    if (clientId) {
      try {
        await page.goto(`${BASE_URL}/oauth/admin/client-details.html?id=${clientId}`);
        await page.click('button:has-text("Delete")');
        await page.click('.modal button.btn-danger:has-text("Delete")');
        await page.waitForURL(/clients\.html/, { timeout: 5000 });
      } catch (error) {
        console.log('Cleanup failed (client may already be deleted):', error.message);
      }
    }
  });
});
