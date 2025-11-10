import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import validateNpmName from 'validate-npm-package-name';
import { Logger } from './logger';
import { HeimdallError } from './error-handler';
import { FrameworkTemplate } from '../types';

export class ProjectUtils {
  private static logger = new Logger();

  static validateProjectName(name: string): void {
    const validation = validateNpmName(name);
    
    if (!validation.validForNewPackages) {
      const errors = [
        ...(validation.errors || []),
        ...(validation.warnings || [])
      ];
      
      throw new HeimdallError(
        `Invalid project name: ${name}`,
        'INVALID_PROJECT_NAME',
        [
          'Use lowercase letters, numbers, and hyphens only',
          'Start with a letter',
          'Don\'t use spaces or special characters',
          ...errors.map(error => `• ${error}`)
        ]
      );
    }
  }

  static validateProjectPath(projectPath: string): void {
    if (existsSync(projectPath)) {
      throw new HeimdallError(
        `Directory already exists: ${projectPath}`,
        'DIRECTORY_EXISTS',
        [
          'Choose a different project name',
          'Remove the existing directory',
          'Use `--force` flag to overwrite (if available)'
        ]
      );
    }

    // Check if parent directory is writable
    const parentDir = join(projectPath, '..');
    try {
      // Try to create a temporary file to test write permissions
      const testFile = join(parentDir, '.heimdall-test-' + Date.now());
      writeFileSync(testFile, '');
      execSync(`rm -f "${testFile}"`);
    } catch {
      throw new HeimdallError(
        `Cannot write to directory: ${parentDir}`,
        'PERMISSION_DENIED',
        [
          'Check directory permissions',
          'Run with appropriate privileges',
          'Choose a different location'
        ]
      );
    }
  }

  static createProjectDirectory(projectPath: string): void {
    try {
      mkdirSync(projectPath, { recursive: true });
      this.logger.success(`Created project directory: ${basename(projectPath)}`);
    } catch (error) {
      throw new HeimdallError(
        `Failed to create project directory: ${(error as Error).message}`,
        'DIRECTORY_CREATION_FAILED'
      );
    }
  }

  static initGitRepository(projectPath: string): void {
    try {
      execSync('git --version', { stdio: 'ignore' });
      
      const gitDir = join(projectPath, '.git');
      if (!existsSync(gitDir)) {
        execSync('git init', { cwd: projectPath, stdio: 'ignore' });
        this.logger.success('Initialized git repository');
      }
    } catch {
      this.logger.warning('Git not available, skipping repository initialization');
    }
  }

  static installDependencies(projectPath: string, packageManager?: 'npm' | 'yarn' | 'pnpm'): void {
    const pm = packageManager || this.detectPackageManager();
    
    try {
      this.logger.info(`Installing dependencies with ${pm}...`);
      
      const commands = {
        npm: 'npm install',
        yarn: 'yarn install',
        pnpm: 'pnpm install'
      };
      
      execSync(commands[pm], { 
        cwd: projectPath, 
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });
      
      this.logger.success('Dependencies installed successfully');
    } catch (error) {
      throw new HeimdallError(
        `Failed to install dependencies: ${(error as Error).message}`,
        'DEPENDENCY_INSTALLATION_FAILED',
        [
          'Check your internet connection',
          'Try running the install command manually',
          'Clear package manager cache and try again'
        ]
      );
    }
  }

  static detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      return 'pnpm';
    } catch {
      // pnpm not available
    }

    try {
      execSync('yarn --version', { stdio: 'ignore' });
      return 'yarn';
    } catch {
      // yarn not available
    }

    return 'npm';
  }

  static createPackageJson(projectPath: string, projectName: string, template: FrameworkTemplate): void {
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      private: true,
      description: `${template.displayName} application with Heimdall authentication`,
      scripts: {
        ...template.scripts,
        'truxe.io': 'truxe.io',
        'heimdall:migrate': 'heimdall migrate',
        'heimdall:status': 'heimdall status'
      },
      dependencies: {
        ...template.dependencies
      },
      devDependencies: {
        ...template.devDependencies,
        '@heimdall/cli': 'latest'
      },
      keywords: [
        template.name,
        'heimdall',
        'authentication',
        'auth',
        'magic-links'
      ],
      heimdall: {
        template: template.name,
        version: '0.1.0',
        features: template.supportedFeatures
      }
    };

    const packageJsonPath = join(projectPath, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    this.logger.success('Created package.json');
  }

  static createGitignore(projectPath: string, template: FrameworkTemplate): void {
    const gitignoreContent = this.getGitignoreContent(template.name);
    const gitignorePath = join(projectPath, '.gitignore');
    
    writeFileSync(gitignorePath, gitignoreContent);
    this.logger.success('Created .gitignore');
  }

  static createEnvFiles(projectPath: string): void {
    const envExample = `# Truxe Configuration
# Copy this file to .env and update the values

# Database
DATABASE_URL=sqlite:./dev.db
# DATABASE_URL=postgresql://user:password@localhost:5432/heimdall

# JWT Keys (generate with: heimdall keys generate)
JWT_PRIVATE_KEY=""
JWT_PUBLIC_KEY=""
JWT_ALGORITHM=RS256

# Email Provider
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your-api-key-here
EMAIL_FROM=noreply@yourapp.com

# Features
ENABLE_SIGNUP=true
ENABLE_MULTI_TENANT=false

# Development
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
`;

    const env = `# Truxe Development Configuration
# This file is automatically generated - edit as needed

DATABASE_URL=sqlite:./dev.db
EMAIL_PROVIDER=development
EMAIL_FROM=noreply@localhost
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
ENABLE_SIGNUP=true
ENABLE_MULTI_TENANT=false
`;

    writeFileSync(join(projectPath, '.env.example'), envExample);
    writeFileSync(join(projectPath, '.env'), env);
    this.logger.success('Created environment files');
  }

  static createReadme(projectPath: string, projectName: string, template: FrameworkTemplate): void {
    const readmeContent = `# ${projectName}

A ${template.displayName} application with Heimdall authentication.

## Getting Started

### 1. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Start the development server

\`\`\`bash
# Start your application
npm run dev

# Start Heimdall (in another terminal)
npm run truxe.io
\`\`\`

### 3. Open your browser

- Application: http://localhost:3000
- Heimdall Admin: http://localhost:3001/admin
- Development Inbox: http://localhost:3001/dev/inbox

## Authentication

This project uses Heimdall for authentication with the following features:

${template.supportedFeatures.map(feature => `- ${feature}`).join('\n')}

### Usage

\`\`\`typescript
import { withAuth } from '@heimdall/${template.name}';

function ProtectedPage({ user }) {
  return <h1>Welcome, {user.email}!</h1>;
}

export default withAuth(ProtectedPage);
\`\`\`

## Configuration

Edit \`heimdall.config.yaml\` to customize your authentication setup:

\`\`\`yaml
multiTenant:
  enabled: false
auth:
  magicLink:
    enabled: true
    expiryMinutes: 15
email:
  provider: resend
  from: noreply@yourapp.com
\`\`\`

## Commands

- \`npm run truxe.io\` - Start Heimdall development server
- \`npm run heimdall:migrate\` - Run database migrations  
- \`npm run heimdall:status\` - Check system health

## Documentation

- [Heimdall Documentation](https://docs.truxe.io)
- [${template.displayName} Guide](https://docs.truxe.io/guides/${template.name})
- [API Reference](https://docs.truxe.io/api)

## Support

- [GitHub Issues](https://github.com/heimdall-auth/heimdall/issues)
- [Discord Community](https://discord.gg/heimdall)
- [Documentation](https://docs.truxe.io)
`;

    writeFileSync(join(projectPath, 'README.md'), readmeContent);
    this.logger.success('Created README.md');
  }

  private static getGitignoreContent(template: string): string {
    const common = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.db
*.db-journal
*.sqlite
*.sqlite3

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Truxe
.heimdall/cache/
`;

    const templateSpecific = {
      nextjs: `
# Next.js
.next/
out/
build/

# Vercel
.vercel
`,
      nuxt: `
# Nuxt.js
.nuxt
dist
.output
.nitro
.cache
`,
      sveltekit: `
# SvelteKit
.svelte-kit/
build/
.vercel
.netlify
`
    };

    return common + (templateSpecific[template as keyof typeof templateSpecific] || '');
  }
}
