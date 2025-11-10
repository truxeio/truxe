/**
 * Playwright Configuration
 * 
 * Configuration for E2E tests of the OAuth Admin Dashboard
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  
  // Maximum time one test can run
  timeout: 30 * 1000,
  
  // Test execution settings
  fullyParallel: false, // Run tests sequentially for OAuth admin tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['list'],
  ],
  
  // Shared test settings
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    
    // Browser options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Emulate viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors (for local testing)
    ignoreHTTPSErrors: true,
    
    // Set timeout for actions
    actionTimeout: 10 * 1000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    
    // Mobile testing
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Web server configuration (auto-start if needed)
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
