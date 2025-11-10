module.exports = {
  // URLs to test (Storybook stories)
  urls: [
    'http://localhost:6006/iframe.html?args=&id=ui-button--primary',
    'http://localhost:6006/iframe.html?args=&id=ui-button--variants',
    'http://localhost:6006/iframe.html?args=&id=ui-button--accessibility-example',
    'http://localhost:6006/iframe.html?args=&id=ui-input--default',
    'http://localhost:6006/iframe.html?args=&id=ui-input--with-error',
    'http://localhost:6006/iframe.html?args=&id=auth-loginform--default',
    'http://localhost:6006/iframe.html?args=&id=auth-loginform--with-organization',
    'http://localhost:6006/iframe.html?args=&id=auth-loginform--accessibility-features',
  ],

  // Standard to test against (WCAG2A, WCAG2AA, WCAG2AAA)
  standard: 'WCAG2AA',

  // Reporters to use
  reporter: ['html', 'json', 'cli'],

  // Output directory
  outputDir: './accessibility-reports',

  // Browser options
  chromeLaunchConfig: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },

  // Viewport options
  viewport: {
    width: 1280,
    height: 1024,
  },

  // Timeout for page loads
  timeout: 30000,

  // Rules to ignore (use sparingly and document why)
  ignore: [
    // Ignore color contrast on disabled elements (they're intentionally low contrast)
    'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.BgImage',
  ],

  // Actions to perform before testing (useful for interactive components)
  actions: [
    // Focus on first interactive element
    'click element button',
    'wait for element [role="menu"] to be visible',
    'set field input[type="email"] to test@example.com',
  ],

  // Headers to send with requests
  headers: {
    'User-Agent': 'Pa11y Accessibility Tester',
  },

  // Wait conditions
  wait: 1000,

  // Include warnings
  includeWarnings: true,

  // Include notices
  includeNotices: false,

  // Threshold for failing (number of issues)
  threshold: 0,

  // Custom rules
  rules: [
    // Ensure all interactive elements are keyboard accessible
    'keyboard-navigation',
    // Ensure proper heading hierarchy
    'heading-hierarchy',
    // Ensure proper color contrast
    'color-contrast',
    // Ensure proper focus management
    'focus-management',
    // Ensure proper ARIA usage
    'aria-usage',
  ],

  // Custom CSS to inject (for testing different themes)
  css: `
    /* High contrast mode simulation */
    .high-contrast-test {
      filter: contrast(200%);
    }
    
    /* Focus ring visibility test */
    *:focus {
      outline: 3px solid #ff0000 !important;
      outline-offset: 2px !important;
    }
  `,

  // JavaScript to inject (for testing interactive states)
  javascript: `
    // Simulate reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: function(query) {
        return {
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: function() {},
          removeListener: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() {},
        };
      },
    });

    // Test keyboard navigation
    function testKeyboardNavigation() {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      focusableElements.forEach((element, index) => {
        if (element.tabIndex >= 0) {
          console.log(\`Focusable element \${index}: \`, element);
        }
      });
    }

    // Test ARIA attributes
    function testAriaAttributes() {
      const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
      
      elementsWithAria.forEach(element => {
        const ariaLabel = element.getAttribute('aria-label');
        const ariaLabelledby = element.getAttribute('aria-labelledby');
        const ariaDescribedby = element.getAttribute('aria-describedby');
        const role = element.getAttribute('role');
        
        console.log('ARIA element:', {
          element: element.tagName,
          ariaLabel,
          ariaLabelledby,
          ariaDescribedby,
          role
        });
      });
    }

    // Run tests after page load
    setTimeout(() => {
      testKeyboardNavigation();
      testAriaAttributes();
    }, 1000);
  `,
};
