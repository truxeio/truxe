import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Global timeout for each action */
    actionTimeout: 10000,
    
    /* Global timeout for navigation */
    navigationTimeout: 30000,
    
    /* Global timeout for each test */
    timeout: 30000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* User agent */
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    
    /* Viewport */
    viewport: { width: 1280, height: 720 },
    
    /* Color scheme */
    colorScheme: 'light',
    
    /* Locale */
    locale: 'en-US',
    
    /* Timezone */
    timezoneId: 'America/New_York',
    
    /* Geolocation */
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    
    /* Permissions */
    permissions: ['geolocation', 'notifications'],
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    },
    
    /* Storage state */
    storageState: undefined,
    
    /* Context options */
    contextOptions: {
      reducedMotion: 'reduce',
      forcedColors: 'none',
      colorScheme: 'light'
    }
  },
  
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    
    /* Test against different screen sizes */
    {
      name: 'Desktop Large',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'Desktop Medium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'Mobile Small',
      use: { ...devices['iPhone SE'] },
    },
    
    /* Test with different color schemes */
    {
      name: 'Dark Mode',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    
    /* Test with reduced motion */
    {
      name: 'Reduced Motion',
      use: { 
        ...devices['Desktop Chrome'], 
        contextOptions: { reducedMotion: 'reduce' }
      },
    },
    
    /* Test with high contrast */
    {
      name: 'High Contrast',
      use: { 
        ...devices['Desktop Chrome'], 
        contextOptions: { forcedColors: 'active' }
      },
    }
  ],
  
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test'
    }
  },
  
  /* Global setup */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  
  /* Global teardown */
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
  
  /* Test timeout */
  timeout: 30000,
  
  /* Expect timeout */
  expect: {
    timeout: 10000
  },
  
  /* Output directory */
  outputDir: 'test-results/',
  
  /* Test ignore patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**'
  ],
  
  /* Test match patterns */
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  /* Update snapshots */
  updateSnapshots: 'missing',
  
  /* Preserve output */
  preserveOutput: 'failures-only',
  
  /* Quiet mode */
  quiet: false,
  
  /* Reporter options */
  reporterOptions: {
    html: {
      open: 'never'
    }
  },
  
  /* Test directory */
  testDir: './tests/e2e',
  
  /* Use configuration */
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  
  /* Web server configuration */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});

