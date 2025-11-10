import { FrameworkTemplate } from '../types';

export const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  nextjs: {
    name: 'nextjs',
    displayName: 'Next.js',
    description: 'Production-ready React framework with complete Truxe authentication integration',
    supportedFeatures: [
      'Magic link authentication with organization support',
      'Protected routes with role-based access control',
      'Automatic token refresh and session management',
      'CSRF protection and security headers',
      'Responsive UI with accessibility (WCAG 2.1 AA)',
      'Comprehensive error handling and boundaries',
      'TypeScript throughout with complete type definitions',
      'Modern UX patterns and loading states',
      'User profile management and session controls'
    ],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'clsx': '^2.0.0',
      'tailwind-merge': '^2.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      'typescript': '^5.0.0',
      'eslint': '^8.0.0',
      'eslint-config-next': '^14.0.0',
      'eslint-config-prettier': '^9.0.0',
      'eslint-plugin-react': '^7.33.0',
      'eslint-plugin-react-hooks': '^4.6.0',
      'eslint-plugin-jsx-a11y': '^6.7.0',
      'prettier': '^3.0.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0',
      'tailwindcss': '^3.3.0',
      '@tailwindcss/forms': '^0.5.0',
      '@tailwindcss/typography': '^0.5.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint',
      'lint:fix': 'next lint --fix',
      'type-check': 'tsc --noEmit',
      'format': 'prettier --write "**/*.{js,jsx,ts,tsx,json,md}"',
      'truxe.io': 'truxe.io',
      'truxe:status': 'truxe status'
    }
  },

  nuxt: {
    name: 'nuxt',
    displayName: 'Nuxt',
    description: 'Vue.js framework with universal rendering',
    supportedFeatures: [
      'Magic link authentication',
      'Protected pages with middleware',
      'Server-side authentication',
      'Multi-tenant organizations',
      'Role-based access control',
      'Automatic token refresh',
      'TypeScript support'
    ],
    dependencies: {
      'nuxt': '^3.8.0',
      'vue': '^3.3.0',
      '@truxe/nuxt': 'latest',
      '@truxe/vue': 'latest',
      '@truxe/ui': 'latest'
    },
    devDependencies: {
      '@nuxt/devtools': 'latest',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0'
    },
    scripts: {
      'dev': 'nuxt dev',
      'build': 'nuxt build',
      'preview': 'nuxt preview',
      'postinstall': 'nuxt prepare',
      'lint': 'eslint .',
      'type-check': 'nuxt typecheck'
    }
  },

  sveltekit: {
    name: 'sveltekit',
    displayName: 'SvelteKit',
    description: 'Svelte framework with full-stack capabilities',
    supportedFeatures: [
      'Magic link authentication',
      'Protected routes with hooks',
      'Server-side authentication',
      'Multi-tenant organizations',
      'Role-based access control',
      'Automatic token refresh',
      'TypeScript support'
    ],
    dependencies: {
      '@sveltejs/kit': '^1.27.0',
      'svelte': '^4.2.0',
      '@truxe/sveltekit': 'latest',
      '@truxe/svelte': 'latest',
      '@truxe/ui': 'latest'
    },
    devDependencies: {
      '@sveltejs/adapter-auto': '^2.1.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'vite': '^4.5.0',
      'eslint': '^8.0.0',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      'eslint-plugin-svelte': '^2.35.0',
      'svelte-check': '^3.6.0',
      'tslib': '^2.6.0'
    },
    scripts: {
      'dev': 'vite dev',
      'build': 'vite build',
      'preview': 'vite preview',
      'check': 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
      'check:watch': 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch',
      'lint': 'eslint .',
      'type-check': 'svelte-check --tsconfig ./tsconfig.json'
    }
  }
};

export function getTemplate(name: string): FrameworkTemplate {
  const template = FRAMEWORK_TEMPLATES[name];
  if (!template) {
    throw new Error(`Unknown template: ${name}. Available templates: ${Object.keys(FRAMEWORK_TEMPLATES).join(', ')}`);
  }
  return template;
}

export function listTemplates(): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES);
}
