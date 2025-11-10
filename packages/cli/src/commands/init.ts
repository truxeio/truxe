/**
 * Init command - Initialize a new Truxe project
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ensureDir, copy, writeFile, exists } from '../utils/fs';
import { exec, commandExists } from '../utils/exec';
import { type InitOptions } from '../types';

/**
 * Generate secure random secret
 */
function generateSecret(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Render template with variables
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;

  // Replace all {{VARIABLE}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  // Handle conditional blocks {{#if CONDITION}}...{{/if}}
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
    return variables[condition] ? content : '';
  });

  return result;
}

/**
 * Prompt user for project configuration
 */
async function promptProjectConfig(projectName?: string): Promise<Record<string, any>> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: projectName || 'my-truxe-project',
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'database',
      message: 'Database:',
      choices: ['PostgreSQL', 'MySQL'],
      default: 'PostgreSQL',
    },
    {
      type: 'confirm',
      name: 'useRedis',
      message: 'Use Redis for sessions and caching?',
      default: true,
    },
    {
      type: 'list',
      name: 'emailProvider',
      message: 'Email provider:',
      choices: [
        { name: 'None (disable magic links)', value: 'none' },
        { name: 'SMTP', value: 'smtp' },
        { name: 'Brevo (recommended, free tier available)', value: 'brevo' },
        { name: 'SendGrid', value: 'sendgrid' },
      ],
      default: 'none',
    },
    {
      type: 'checkbox',
      name: 'oauthProviders',
      message: 'OAuth providers (select with space):',
      choices: [
        { name: 'GitHub', value: 'github', checked: true },
        { name: 'Google', value: 'google' },
        { name: 'Apple', value: 'apple' },
        { name: 'Microsoft', value: 'microsoft' },
      ],
    },
  ]);

  // Prompt for email-specific config
  if (answers.emailProvider === 'smtp') {
    const smtpAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'smtpHost',
        message: 'SMTP host:',
        default: 'smtp.gmail.com',
      },
      {
        type: 'input',
        name: 'smtpPort',
        message: 'SMTP port:',
        default: '587',
      },
      {
        type: 'confirm',
        name: 'smtpSecure',
        message: 'Use TLS?',
        default: true,
      },
      {
        type: 'input',
        name: 'smtpUser',
        message: 'SMTP username:',
      },
      {
        type: 'password',
        name: 'smtpPassword',
        message: 'SMTP password:',
        mask: '*',
      },
      {
        type: 'input',
        name: 'emailFrom',
        message: 'From email address:',
        validate: (input: string) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
            return 'Invalid email address';
          }
          return true;
        },
      },
    ]);
    Object.assign(answers, smtpAnswers);
  } else if (answers.emailProvider === 'brevo') {
    const brevoAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'brevoApiKey',
        message: 'Brevo API key (get from https://app.brevo.com/):',
      },
      {
        type: 'input',
        name: 'emailFrom',
        message: 'From email address:',
        validate: (input: string) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
            return 'Invalid email address';
          }
          return true;
        },
      },
    ]);
    Object.assign(answers, brevoAnswers);
  } else if (answers.emailProvider === 'sendgrid') {
    const sendgridAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sendgridApiKey',
        message: 'SendGrid API key:',
      },
      {
        type: 'input',
        name: 'emailFrom',
        message: 'From email address:',
        validate: (input: string) => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
            return 'Invalid email address';
          }
          return true;
        },
      },
    ]);
    Object.assign(answers, sendgridAnswers);
  }

  // Prompt for OAuth credentials (only if providers selected)
  if (answers.oauthProviders.includes('github')) {
    const githubAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'githubClientId',
        message: 'GitHub Client ID (leave empty to configure later):',
      },
      {
        type: 'input',
        name: 'githubClientSecret',
        message: 'GitHub Client Secret (leave empty to configure later):',
      },
    ]);
    Object.assign(answers, githubAnswers);
  }

  if (answers.oauthProviders.includes('google')) {
    const googleAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'googleClientId',
        message: 'Google Client ID (leave empty to configure later):',
      },
      {
        type: 'input',
        name: 'googleClientSecret',
        message: 'Google Client Secret (leave empty to configure later):',
      },
    ]);
    Object.assign(answers, googleAnswers);
  }

  return answers;
}

/**
 * Create project directory structure
 */
async function createProjectStructure(projectPath: string): Promise<void> {
  logger.debug(`Creating project structure: ${projectPath}`);

  // Create directories
  await ensureDir(projectPath);
  await ensureDir(join(projectPath, 'keys'));
  await ensureDir(join(projectPath, 'logs'));

  logger.success('Project directories created');
}

/**
 * Generate .env file from template and config
 */
async function generateEnvFile(projectPath: string, config: Record<string, any>): Promise<void> {
  logger.debug('Generating .env file');

  // Load template - handle both development and production paths
  const fs = require('fs');
  let templatePath = join(__dirname, '../templates/env.template');

  // In production (bundled), templates are at the package root
  if (!fs.existsSync(templatePath)) {
    templatePath = join(__dirname, '../../templates/env.template');
  }

  const template = fs.readFileSync(templatePath, 'utf-8');

  // Prepare variables
  const variables: Record<string, any> = {
    // Database
    DB_PASSWORD: generateSecret(16),
    DATABASE_URL: config.database === 'PostgreSQL'
      ? 'postgresql://postgres:{{DB_PASSWORD}}@localhost:5433/truxe'
      : 'mysql://root:{{DB_PASSWORD}}@localhost:3307/truxe',

    // Redis
    REDIS_PASSWORD: config.useRedis ? generateSecret(16) : '',

    // Security secrets
    COOKIE_SECRET: generateSecret(),
    SESSION_SECRET: generateSecret(),
    OAUTH_STATE_SECRET: generateSecret(),
    OAUTH_TOKEN_ENCRYPTION_KEY: generateSecret(),

    // Email
    EMAIL_PROVIDER: config.emailProvider !== 'none',
    EMAIL_SMTP: config.emailProvider === 'smtp',
    EMAIL_BREVO: config.emailProvider === 'brevo',
    EMAIL_SENDGRID: config.emailProvider === 'sendgrid',
    SMTP_HOST: config.smtpHost || '',
    SMTP_PORT: config.smtpPort || '',
    SMTP_SECURE: config.smtpSecure ? 'true' : 'false',
    SMTP_USER: config.smtpUser || '',
    SMTP_PASSWORD: config.smtpPassword || '',
    BREVO_API_KEY: config.brevoApiKey || '',
    SENDGRID_API_KEY: config.sendgridApiKey || '',
    EMAIL_FROM: config.emailFrom || '',

    // OAuth
    OAUTH_GITHUB: config.oauthProviders.includes('github'),
    OAUTH_GOOGLE: config.oauthProviders.includes('google'),
    GITHUB_CLIENT_ID: config.githubClientId || '',
    GITHUB_CLIENT_SECRET: config.githubClientSecret || '',
    GOOGLE_CLIENT_ID: config.googleClientId || '',
    GOOGLE_CLIENT_SECRET: config.googleClientSecret || '',
  };

  // Render template
  let envContent = renderTemplate(template, variables);

  // Second pass to replace nested variables (like DB_PASSWORD in DATABASE_URL)
  envContent = renderTemplate(envContent, variables);

  // Write .env file
  const envPath = join(projectPath, '.env');
  await writeFile(envPath, envContent);

  logger.success('.env file created');
}

/**
 * Copy docker-compose.yml
 */
async function copyDockerCompose(projectPath: string, config: Record<string, any>): Promise<void> {
  logger.debug('Copying docker-compose.yml');

  // Handle both development and production paths
  const fs = require('fs');
  let templatePath = join(__dirname, '../templates/docker-compose.yml');

  // In production (bundled), templates are at the package root
  if (!fs.existsSync(templatePath)) {
    templatePath = join(__dirname, '../../templates/docker-compose.yml');
  }

  const destPath = join(projectPath, 'docker-compose.yml');

  // For now, just copy the template
  // In future, we could customize based on database choice
  const content = fs.readFileSync(templatePath, 'utf-8');
  await writeFile(destPath, content);

  logger.success('docker-compose.yml created');
}

/**
 * Generate README.md
 */
async function generateReadme(projectPath: string, config: Record<string, any>): Promise<void> {
  logger.debug('Generating README.md');

  // Handle both development and production paths
  const fs = require('fs');
  let templatePath = join(__dirname, '../templates/README.template');

  // In production (bundled), templates are at the package root
  if (!fs.existsSync(templatePath)) {
    templatePath = join(__dirname, '../../templates/README.template');
  }

  const template = fs.readFileSync(templatePath, 'utf-8');

  const variables = {
    PROJECT_NAME: config.projectName,
    OAUTH_GITHUB: config.oauthProviders.includes('github'),
    OAUTH_GOOGLE: config.oauthProviders.includes('google'),
  };

  const readmeContent = renderTemplate(template, variables);
  const readmePath = join(projectPath, 'README.md');
  await writeFile(readmePath, readmeContent);

  logger.success('README.md created');
}

/**
 * Create .gitignore
 */
async function createGitignore(projectPath: string): Promise<void> {
  logger.debug('Creating .gitignore');

  const gitignoreContent = `# Environment
.env
.env.local
.env.*.local

# Keys
keys/
*.pem

# Logs
logs/
*.log
npm-debug.log*

# Dependencies
node_modules/

# Build
dist/
build/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Misc
.cache/
tmp/
temp/
`;

  await writeFile(join(projectPath, '.gitignore'), gitignoreContent);
  logger.success('.gitignore created');
}

/**
 * Initialize git repository
 */
async function initGitRepo(projectPath: string): Promise<void> {
  logger.debug('Initializing git repository');

  const hasGit = await commandExists('git');
  if (!hasGit) {
    logger.warn('Git not found, skipping repository initialization');
    return;
  }

  try {
    await exec('git', ['init'], { cwd: projectPath });
    await exec('git', ['add', '.'], { cwd: projectPath });
    await exec('git', ['commit', '-m', 'Initial commit from @truxe/cli'], { cwd: projectPath });
    logger.success('Git repository initialized');
  } catch (error) {
    logger.warn('Could not initialize git repository');
    logger.debug(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Print next steps
 */
function printNextSteps(projectName: string, config: Record<string, any>): void {
  console.log();
  logger.success('Project initialized successfully!');
  console.log();

  console.log(chalk.bold('Next Steps:'));
  console.log();
  console.log(`  ${chalk.cyan('1.')} Navigate to your project:`);
  console.log(`     ${chalk.dim(`cd ${projectName}`)}`);
  console.log();
  console.log(`  ${chalk.cyan('2.')} Generate JWT keys:`);
  console.log(`     ${chalk.dim('truxe keys generate')}`);
  console.log();
  console.log(`  ${chalk.cyan('3.')} Start Docker services:`);
  console.log(`     ${chalk.dim('docker-compose up -d')}`);
  console.log();
  console.log(`  ${chalk.cyan('4.')} Run database migrations:`);
  console.log(`     ${chalk.dim('truxe migrate')}`);
  console.log();
  console.log(`  ${chalk.cyan('5.')} Start development server:`);
  console.log(`     ${chalk.dim('truxe dev')}`);
  console.log();

  // Additional steps based on configuration
  if (config.emailProvider === 'none') {
    logger.warn('Email provider not configured - magic links will be disabled');
    console.log(`     To enable magic links later, update ${chalk.cyan('.env')} with email credentials`);
    console.log();
  }

  if (config.oauthProviders.length > 0 && !config.githubClientId && !config.googleClientId) {
    logger.warn('OAuth credentials not provided');
    console.log(`     Update ${chalk.cyan('.env')} with OAuth client IDs and secrets`);
    console.log();
  }

  console.log(chalk.bold('Documentation:'));
  console.log(`  ${chalk.cyan('https://truxe.io/docs')}`);
  console.log();
}

/**
 * Init command handler
 */
async function initCommand(projectName?: string, options: InitOptions = {}): Promise<void> {
  logger.section('Initialize Truxe Project');

  // Determine project name
  const name = projectName || options.projectName || await (async () => {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-truxe-project',
    }]);
    return answer.name;
  })();

  const projectPath = join(process.cwd(), name);

  // Check if directory already exists
  if (existsSync(projectPath)) {
    logger.error(`Directory already exists: ${projectPath}`);
    logger.info('Choose a different project name or remove the existing directory');
    process.exit(1);
  }

  // Prompt for configuration (unless using defaults)
  let config: Record<string, any>;
  if (options.defaults) {
    logger.info('Using default configuration');
    config = {
      projectName: name,
      database: 'PostgreSQL',
      useRedis: true,
      emailProvider: 'none',
      oauthProviders: ['github'],
    };
  } else {
    config = await promptProjectConfig(name);
  }

  // Create project
  const ora = (await import('ora')).default;
  const spinner = ora('Creating project...').start();

  try {
    // 1. Create directory structure
    spinner.text = 'Creating project structure...';
    await createProjectStructure(projectPath);

    // 2. Generate .env file
    spinner.text = 'Generating .env file...';
    await generateEnvFile(projectPath, config);

    // 3. Copy docker-compose.yml
    spinner.text = 'Creating docker-compose.yml...';
    await copyDockerCompose(projectPath, config);

    // 4. Generate README.md
    spinner.text = 'Generating README.md...';
    await generateReadme(projectPath, config);

    // 5. Create .gitignore
    spinner.text = 'Creating .gitignore...';
    await createGitignore(projectPath);

    // 6. Initialize git repo
    if (!options.skipGit) {
      spinner.text = 'Initializing git repository...';
      await initGitRepo(projectPath);
    }

    spinner.succeed('Project created successfully!');

    // Print next steps
    printNextSteps(name, config);
  } catch (error) {
    spinner.fail('Project creation failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Register init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init [project-name]')
    .description('Initialize a new Truxe project')
    .option('--defaults', 'Use default configuration without prompts')
    .option('--skip-git', 'Skip git repository initialization')
    .action(async (projectName, options) => {
      try {
        await initCommand(projectName, options);
      } catch (error) {
        logger.error('Initialization failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
