import { Command } from 'commander';
import { join } from 'path';
import inquirer from 'inquirer';
import { Listr } from 'listr2';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ErrorHandler, TruxeError } from '../utils/error-handler';
import { ProjectUtils } from '../utils/project';
import { ConfigManager } from '../utils/config';
import { getTemplate, listTemplates } from '../templates';
import { InitOptions, ProjectScaffold } from '../types';

export function initCommand(program: Command): void {
  program
    .command('init')
    .argument('[project-name]', 'Name of the project to create')
    .description('Initialize a new Truxe project with authentication')
    .option('-t, --template <template>', 'Framework template (nextjs|nuxt|sveltekit)')
    .option('--db <database>', 'Database type (sqlite|postgresql)', 'sqlite')
    .option('--multi-tenant', 'Enable multi-tenant mode')
    .option('--skip-install', 'Skip dependency installation')
    .option('--skip-git', 'Skip git repository initialization')
    .option('-y, --yes', 'Skip interactive prompts and use defaults')
    .action(async (projectName: string | undefined, options: InitOptions & { yes?: boolean }) => {
      const logger = new Logger();
      
      try {
        logger.header('🛡️  Truxe CLI - Initialize Project');
        logger.blank();
        
        // Interactive setup if not using --yes flag
        const config = options.yes 
          ? await getDefaultConfig(projectName, options)
          : await interactiveSetup(projectName, options);
        
        // Create project scaffold
        const scaffold = await createProjectScaffold(config);
        
        // Execute initialization tasks
        await executeInitialization(scaffold as any, options);
        
        // Success message
        logger.blank();
        logger.success('🎉 Project initialized successfully!');
        logger.blank();
        
        showNextSteps(scaffold);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Project Initialization');
      }
    });
}

async function interactiveSetup(
  projectName: string | undefined, 
  options: InitOptions
): Promise<ProjectScaffold> {
  const logger = new Logger();
  
  logger.info('Let\'s set up your Truxe project! 🚀');
  logger.blank();
  
  const questions = [];
  
  // Project name
  if (!projectName) {
    questions.push({
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: 'my-truxe-app',
      validate: (input: string) => {
        try {
          ProjectUtils.validateProjectName(input);
          return true;
        } catch (error) {
          return (error as TruxeError).message;
        }
      }
    });
  }
  
  // Framework template
  if (!options.template) {
    const templates = listTemplates();
    questions.push({
      type: 'list',
      name: 'template',
      message: 'Which framework would you like to use?',
      choices: templates.map(t => ({
        name: `${t.displayName} - ${t.description}`,
        value: t.name,
        short: t.displayName
      })),
      default: 'nextjs'
    });
  }
  
  // Database type
  if (!options.database) {
    questions.push({
      type: 'list',
      name: 'database',
      message: 'Which database would you like to use?',
      choices: [
        {
          name: 'SQLite - Perfect for development and small projects',
          value: 'sqlite',
          short: 'SQLite'
        },
        {
          name: 'PostgreSQL - Production-ready with advanced features',
          value: 'postgresql',
          short: 'PostgreSQL'
        }
      ],
      default: 'sqlite'
    });
  }
  
  // Multi-tenant mode
  if (options.multiTenant === undefined) {
    questions.push({
      type: 'confirm',
      name: 'multiTenant',
      message: 'Enable multi-tenant mode? (Organizations, roles, permissions)',
      default: false
    });
  }
  
  // Additional features
  questions.push({
    type: 'checkbox',
    name: 'features',
    message: 'Select additional features:',
    choices: [
      {
        name: 'Email templates customization',
        value: 'email-templates',
        checked: false
      },
      {
        name: 'Webhook endpoints',
        value: 'webhooks',
        checked: false
      },
      {
        name: 'Admin dashboard',
        value: 'admin-dashboard',
        checked: true
      },
      {
        name: 'Development email inbox',
        value: 'dev-inbox',
        checked: true
      }
    ]
  });
  
  // Installation preferences
  questions.push({
    type: 'confirm',
    name: 'installDeps',
    message: 'Install dependencies now?',
    default: !options.skipInstall
  });
  
  questions.push({
    type: 'confirm',
    name: 'initGit',
    message: 'Initialize git repository?',
    default: !options.skipGit
  });
  
  const answers = await inquirer.prompt(questions);
  
  return {
    template: getTemplate(options.template || answers.template),
    projectName: projectName || answers.projectName,
    projectPath: join(process.cwd(), projectName || answers.projectName),
    config: {
      database: {
        url: answers.database === 'sqlite' ? 'sqlite:./dev.db' : 'postgresql://user:password@localhost:5432/truxe'
      },
      multiTenant: {
        enabled: options.multiTenant ?? answers.multiTenant,
        defaultRole: 'member',
        allowSignup: true
      }
    },
    installDeps: answers.installDeps,
    initGit: answers.initGit,
    selectedFeatures: answers.features || []
  } as any;
}

async function getDefaultConfig(
  projectName: string | undefined,
  options: InitOptions
): Promise<ProjectScaffold> {
  const name = projectName || 'my-truxe-app';
  
  try {
    ProjectUtils.validateProjectName(name);
  } catch (error) {
    throw new TruxeError(
      `Invalid project name: ${name}`,
      'INVALID_PROJECT_NAME',
      ['Use lowercase letters, numbers, and hyphens only']
    );
  }
  
  return {
    template: getTemplate(options.template || 'nextjs'),
    projectName: name,
    projectPath: join(process.cwd(), name),
    config: {
      database: {
        url: options.database === 'postgresql' 
          ? 'postgresql://user:password@localhost:5432/truxe'
          : 'sqlite:./dev.db'
      },
      multiTenant: {
        enabled: options.multiTenant || false
      }
    },
    installDeps: !options.skipInstall,
    initGit: !options.skipGit,
    selectedFeatures: ['admin-dashboard', 'dev-inbox']
  } as ProjectScaffold & { installDeps: boolean; initGit: boolean; selectedFeatures: string[] };
}

async function createProjectScaffold(config: ProjectScaffold): Promise<ProjectScaffold> {
  // Validate project path
  ProjectUtils.validateProjectPath(config.projectPath);
  
  return config;
}

async function executeInitialization(
  scaffold: ProjectScaffold & { installDeps: boolean; initGit: boolean; selectedFeatures: string[] },
  _options: InitOptions
): Promise<void> {
  const tasks = new Listr([
    {
      title: 'Creating project directory',
      task: () => {
        ProjectUtils.createProjectDirectory(scaffold.projectPath);
      }
    },
    {
      title: 'Generating project files',
      task: async (_ctx, task) => {
        // Create package.json
        ProjectUtils.createPackageJson(scaffold.projectPath, scaffold.projectName, scaffold.template);
        
        // Create configuration files
        ConfigManager.saveConfig(scaffold.config, scaffold.projectPath);
        
        // Create environment files
        ProjectUtils.createEnvFiles(scaffold.projectPath);
        
        // Create gitignore
        ProjectUtils.createGitignore(scaffold.projectPath, scaffold.template);
        
        // Create README
        ProjectUtils.createReadme(scaffold.projectPath, scaffold.projectName, scaffold.template);
        
        // Copy template files
        await copyTemplateFiles(scaffold);
        
        task.output = 'Project structure created';
      }
    },
    {
      title: 'Installing dependencies',
      enabled: () => scaffold.installDeps,
      task: async (_ctx, task) => {
        const packageManager = ProjectUtils.detectPackageManager();
        task.output = `Using ${packageManager}...`;
        
        ProjectUtils.installDependencies(scaffold.projectPath, packageManager);
      }
    },
    {
      title: 'Initializing git repository',
      enabled: () => scaffold.initGit,
      task: () => {
        ProjectUtils.initGitRepository(scaffold.projectPath);
      }
    },
    {
      title: 'Generating JWT keys',
      task: async (_ctx, task) => {
        task.output = 'Creating development keys...';
        await generateJWTKeys(scaffold.projectPath);
      }
    },
    {
      title: 'Setting up database',
      task: async (_ctx, task) => {
        if (scaffold.config.database?.url?.startsWith('sqlite:')) {
          task.output = 'SQLite database will be created on first run';
        } else {
          task.output = 'PostgreSQL connection configured';
        }
      }
    }
  ], {
    concurrent: false,
    rendererOptions: {
      showSubtasks: true
    }
  });
  
  await tasks.run();
}

async function copyTemplateFiles(scaffold: ProjectScaffold): Promise<void> {
  const templatePath = join(__dirname, '..', 'templates', scaffold.template.name);
  const { copySync } = await import('fs-extra');
  
  try {
    copySync(templatePath, scaffold.projectPath, {
      overwrite: true,
      filter: (src) => {
        // Skip node_modules and other build artifacts
        return !src.includes('node_modules') && 
               !src.includes('.next') && 
               !src.includes('dist') &&
               !src.includes('.nuxt');
      }
    });
  } catch (error) {
    // If template files don't exist, create basic structure
    await createBasicStructure(scaffold);
  }
}

async function createBasicStructure(scaffold: ProjectScaffold): Promise<void> {
  const { ensureDirSync, writeFileSync } = await import('fs-extra');
  
  // Create basic directory structure based on template
  switch (scaffold.template.name) {
    case 'nextjs':
      ensureDirSync(join(scaffold.projectPath, 'app'));
      ensureDirSync(join(scaffold.projectPath, 'app', 'auth', 'login'));
      ensureDirSync(join(scaffold.projectPath, 'app', 'dashboard'));
      ensureDirSync(join(scaffold.projectPath, 'public'));
      
      // Create basic files (these would normally be copied from templates)
      writeFileSync(
        join(scaffold.projectPath, 'next.config.js'),
        `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`
      );
      break;
      
    case 'nuxt':
      ensureDirSync(join(scaffold.projectPath, 'pages'));
      ensureDirSync(join(scaffold.projectPath, 'components'));
      ensureDirSync(join(scaffold.projectPath, 'middleware'));
      
      writeFileSync(
        join(scaffold.projectPath, 'nuxt.config.ts'),
        `export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@truxe/nuxt']
})`
      );
      break;
      
    case 'sveltekit':
      ensureDirSync(join(scaffold.projectPath, 'src', 'routes'));
      ensureDirSync(join(scaffold.projectPath, 'src', 'lib'));
      ensureDirSync(join(scaffold.projectPath, 'static'));
      
      writeFileSync(
        join(scaffold.projectPath, 'svelte.config.js'),
        `import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  }
};

export default config;`
      );
      break;
  }
}

async function generateJWTKeys(projectPath: string): Promise<void> {
  const { generateKeyPairSync } = await import('crypto');
  
  try {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // Update .env file with generated keys
    const { readFileSync, writeFileSync } = await import('fs');
    const envPath = join(projectPath, '.env');
    let envContent = readFileSync(envPath, 'utf-8');
    
    envContent = envContent.replace(
      'JWT_PRIVATE_KEY=""',
      `JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`
    );
    envContent = envContent.replace(
      'JWT_PUBLIC_KEY=""',
      `JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"`
    );
    
    writeFileSync(envPath, envContent);
    
  } catch (error) {
    throw new TruxeError(
      'Failed to generate JWT keys',
      'KEY_GENERATION_FAILED',
      [
        'Make sure Node.js crypto module is available',
        'Check file permissions in project directory'
      ]
    );
  }
}

function showNextSteps(scaffold: ProjectScaffold): void {
  const logger = new Logger();
  
  logger.subheader('🚀 Next Steps:');
  logger.blank();
  
  logger.step(1, 4, `Navigate to your project:`);
  logger.command(`cd ${scaffold.projectName}`);
  logger.blank();
  
  if (!(scaffold as any).installDeps) {
    logger.step(2, 4, `Install dependencies:`);
    logger.command(`npm install`);
    logger.blank();
  }
  
  logger.step((scaffold as any).installDeps ? 2 : 3, 4, `Start your application:`);
  logger.command(`npm run dev`);
  logger.blank();
  
  logger.step((scaffold as any).installDeps ? 3 : 4, 4, `Start Truxe (in another terminal):`);
  logger.command(`npm run truxe.io`);
  logger.blank();
  
  logger.step(4, 4, `Open your browser:`);
  logger.bullet(`Application: ${chalk.cyan('http://localhost:3000')}`);
  logger.bullet(`Truxe Admin: ${chalk.cyan('http://localhost:3001/admin')}`);
  logger.bullet(`Development Inbox: ${chalk.cyan('http://localhost:3001/dev/inbox')}`);
  logger.blank();
  
  logger.info('📚 Documentation: https://docs.truxe.io');
  logger.info('💬 Discord: https://discord.gg/truxe');
  logger.info('🐛 Issues: https://github.com/truxe-auth/truxe/issues');
  logger.blank();
  
  logger.success('Happy coding! 🎉');
}
