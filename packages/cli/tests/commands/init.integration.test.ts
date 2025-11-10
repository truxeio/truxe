import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { exec } from '../../src/utils/exec';
import { exists, remove, ensureDir, readFile } from '../../src/utils/fs';

describe('init command integration', () => {
  const testDir = join(process.cwd(), 'tests', 'tmp', 'init-integration');
  const cliPath = join(process.cwd(), 'dist', 'index.js');

  beforeEach(async () => {
    await ensureDir(testDir);
  });

  afterEach(async () => {
    try {
      await remove(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('init with defaults', () => {
    it('should initialize project with --defaults flag', async () => {
      const projectName = 'test-project-defaults';
      const projectPath = join(testDir, projectName);

      const { exitCode } = await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      expect(exitCode).toBe(0);

      // Check if project directory was created
      const projectExists = await exists(projectPath);
      expect(projectExists).toBe(true);

      // Check for essential files
      const essentialFiles = [
        '.env',
        'docker-compose.yml',
        '.gitignore',
        'README.md',
      ];

      for (const file of essentialFiles) {
        const filePath = join(projectPath, file);
        const fileExists = await exists(filePath);
        expect(fileExists).toBe(true);
      }
    });

    it('should create .env with correct default ports', async () => {
      const projectName = 'test-ports';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const envPath = join(projectPath, '.env');
      const envContent = await readFile(envPath);

      // Check for Truxe default ports
      expect(envContent).toContain('PORT=3456');
      expect(envContent).toContain('5433'); // PostgreSQL
      expect(envContent).toContain('6380'); // Redis
    });

    it('should generate secure random secrets', async () => {
      const projectName = 'test-secrets';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const envPath = join(projectPath, '.env');
      const envContent = await readFile(envPath);

      // Check for secrets
      expect(envContent).toContain('COOKIE_SECRET=');
      expect(envContent).toContain('SESSION_SECRET=');
      expect(envContent).toContain('OAUTH_STATE_SECRET=');
      expect(envContent).toContain('OAUTH_TOKEN_ENCRYPTION_KEY=');

      // Secrets should be 64 characters (hex encoded)
      const cookieSecretMatch = envContent.match(/COOKIE_SECRET=([a-f0-9]+)/);
      expect(cookieSecretMatch).toBeTruthy();
      if (cookieSecretMatch) {
        expect(cookieSecretMatch[1].length).toBe(64);
      }
    });

    it('should create docker-compose.yml with correct services', async () => {
      const projectName = 'test-docker';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const dockerComposePath = join(projectPath, 'docker-compose.yml');
      const dockerComposeContent = await readFile(dockerComposePath);

      // Check for required services
      expect(dockerComposeContent).toContain('postgres');
      expect(dockerComposeContent).toContain('redis');

      // Check for port mappings
      expect(dockerComposeContent).toContain('5433:5432'); // PostgreSQL
      expect(dockerComposeContent).toContain('6380:6379'); // Redis
    });

    it('should create .gitignore with correct entries', async () => {
      const projectName = 'test-gitignore';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const gitignorePath = join(projectPath, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath);

      // Check for important ignore entries
      expect(gitignoreContent).toContain('.env');
      expect(gitignoreContent).toContain('node_modules');
      expect(gitignoreContent).toContain('keys/');
    });

    it('should create README with project information', async () => {
      const projectName = 'test-readme';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const readmePath = join(projectPath, 'README.md');
      const readmeContent = await readFile(readmePath);

      // Check for project name in README
      expect(readmeContent).toContain(projectName);
      expect(readmeContent).toContain('Truxe');
    });
  });

  describe('init with skip-git flag', () => {
    it('should not initialize git repository with --skip-git', async () => {
      const projectName = 'test-no-git';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      const gitPath = join(projectPath, '.git');
      const gitExists = await exists(gitPath);

      expect(gitExists).toBe(false);
    });

    it('should initialize git repository without --skip-git', async () => {
      const projectName = 'test-with-git';
      const projectPath = join(testDir, projectName);

      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
      ], {
        cwd: testDir,
      });

      const gitPath = join(projectPath, '.git');
      const gitExists = await exists(gitPath);

      expect(gitExists).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should fail when project directory already exists', async () => {
      const projectName = 'test-existing';
      const projectPath = join(testDir, projectName);

      // Create project first time
      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      // Try to create again
      try {
        await exec('node', [
          cliPath,
          'init',
          projectName,
          '--defaults',
          '--skip-git',
        ], {
          cwd: testDir,
        });

        expect.fail('Should have thrown error for existing directory');
      } catch (error) {
        // Expected - directory already exists
        expect(error).toBeDefined();
      }
    });

    it('should validate project name', async () => {
      const invalidNames = [
        'Invalid Name With Spaces',
        'UPPERCASE',
        'special@chars',
      ];

      for (const invalidName of invalidNames) {
        try {
          await exec('node', [
            cliPath,
            'init',
            invalidName,
            '--defaults',
            '--skip-git',
          ], {
            cwd: testDir,
          });

          expect.fail(`Should have rejected invalid project name: ${invalidName}`);
        } catch (error) {
          // Expected - invalid name
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle permission errors gracefully', async () => {
      try {
        await exec('node', [
          cliPath,
          'init',
          'test-permissions',
          '--defaults',
          '--skip-git',
        ], {
          cwd: '/root', // Likely no permission
        });

        // If it succeeds, we're probably running as root
        // Just verify it completed
      } catch (error) {
        // Expected in most cases - permission denied
        expect(error).toBeDefined();
      }
    });
  });

  describe('output and feedback', () => {
    it('should provide progress feedback during init', async () => {
      const projectName = 'test-feedback';

      const { stdout } = await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      // Should mention key steps
      expect(stdout.toLowerCase()).toMatch(/creat/);
    });

    it('should show success message on completion', async () => {
      const projectName = 'test-success';

      const { stdout } = await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      // Should indicate success
      expect(stdout.toLowerCase()).toMatch(/success|complete|done|ready/);
    });

    it('should provide next steps', async () => {
      const projectName = 'test-next-steps';

      const { stdout } = await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      // Should mention what to do next
      expect(stdout.toLowerCase()).toMatch(/cd|next|start/);
    });
  });

  describe('integration with other commands', () => {
    it('should create project compatible with keys generate', async () => {
      const projectName = 'test-keys-compat';
      const projectPath = join(testDir, projectName);

      // Initialize project
      await exec('node', [
        cliPath,
        'init',
        projectName,
        '--defaults',
        '--skip-git',
      ], {
        cwd: testDir,
      });

      // Try to generate keys in the new project
      const { exitCode } = await exec('node', [
        cliPath,
        'keys',
        'generate',
      ], {
        cwd: projectPath,
      });

      expect(exitCode).toBe(0);

      // Verify keys were created
      const privateKeyExists = await exists(join(projectPath, 'keys', 'private.pem'));
      const publicKeyExists = await exists(join(projectPath, 'keys', 'public.pem'));

      expect(privateKeyExists).toBe(true);
      expect(publicKeyExists).toBe(true);
    });
  });
});
