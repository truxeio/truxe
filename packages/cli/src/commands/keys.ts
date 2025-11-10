/**
 * Keys command - Generate RSA key pair for JWT signing
 */

import { Command } from 'commander';
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { loadEnv } from '../utils/env';

interface KeysOptions {
  force?: boolean;
  output?: string;
  bits?: number;
}

/**
 * Generate RSA key pair
 */
function generateRSAKeyPair(bits: number = 2048): { privateKey: string; publicKey: string } {
  logger.debug(`Generating ${bits}-bit RSA key pair...`);

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { privateKey, publicKey };
}

/**
 * Get key fingerprint (SHA256 hash of public key)
 */
function getKeyFingerprint(publicKey: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(publicKey);
  return hash.digest('hex').substring(0, 16);
}

/**
 * Save keys to files
 */
function saveKeys(
  privateKey: string,
  publicKey: string,
  outputDir: string
): { privatePath: string; publicPath: string } {
  // Ensure keys directory exists
  if (!existsSync(outputDir)) {
    logger.debug(`Creating directory: ${outputDir}`);
    mkdirSync(outputDir, { recursive: true });
  }

  const privatePath = join(outputDir, 'private.pem');
  const publicPath = join(outputDir, 'public.pem');

  // Write private key
  writeFileSync(privatePath, privateKey, { encoding: 'utf8', mode: 0o600 });
  logger.debug(`Private key saved: ${privatePath}`);

  // Write public key
  writeFileSync(publicPath, publicKey, { encoding: 'utf8', mode: 0o644 });
  logger.debug(`Public key saved: ${publicPath}`);

  // Ensure correct permissions on private key (600 = owner read/write only)
  try {
    chmodSync(privatePath, 0o600);
    logger.debug('Private key permissions set to 600');
  } catch (error) {
    logger.warn('Could not set private key permissions (this is okay on Windows)');
  }

  return { privatePath, publicPath };
}

/**
 * Update .env file with key paths
 */
async function updateEnvFile(privatePath: string, publicPath: string): Promise<void> {
  try {
    const envPath = join(process.cwd(), '.env');

    if (!existsSync(envPath)) {
      logger.debug('.env file not found, skipping update');
      return;
    }

    // Read current .env
    const fs = require('fs');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or add JWT key paths
    const updates = [
      { key: 'JWT_PRIVATE_KEY_PATH', value: privatePath },
      { key: 'JWT_PUBLIC_KEY_PATH', value: publicPath },
    ];

    for (const { key, value } of updates) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        // Update existing
        envContent = envContent.replace(regex, `${key}=${value}`);
        logger.debug(`Updated ${key} in .env`);
      } else {
        // Add new
        envContent += `\n${key}=${value}`;
        logger.debug(`Added ${key} to .env`);
      }
    }

    // Write updated .env
    fs.writeFileSync(envPath, envContent, 'utf8');
    logger.success('Updated .env with key paths');
  } catch (error) {
    logger.warn('Could not update .env file');
    logger.debug(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Keys generate command handler
 */
async function keysGenerateCommand(options: KeysOptions): Promise<void> {
  const {
    force = false,
    output = './keys',
    bits = 2048,
  } = options;

  logger.section('Generate JWT Keys');

  // Validate bits
  if (bits < 2048) {
    logger.error('Key size must be at least 2048 bits for security');
    logger.info('Recommended: 2048 bits (default) or 4096 bits for enhanced security');
    process.exit(1);
  }

  // Check if keys already exist
  const privatePath = join(output, 'private.pem');
  const publicPath = join(output, 'public.pem');

  if (existsSync(privatePath) || existsSync(publicPath)) {
    if (!force) {
      logger.error('Keys already exist in this directory');
      logger.info(`Private key: ${privatePath}`);
      logger.info(`Public key: ${publicPath}`);
      logger.info('\nUse --force to overwrite existing keys');
      logger.warn('⚠️  WARNING: Overwriting keys will invalidate all existing JWTs!');
      process.exit(1);
    }

    logger.warn('Overwriting existing keys (--force flag used)');
    logger.warn('⚠️  All existing JWTs will be invalidated!');
  }

  // Generate keys
  logger.info(`Generating ${bits}-bit RSA key pair...`);
  const ora = (await import('ora')).default;
  const spinner = ora('Generating keys...').start();

  try {
    const { privateKey, publicKey } = generateRSAKeyPair(bits);
    spinner.succeed('Keys generated successfully');

    // Save keys
    logger.info('Saving keys to disk...');
    const paths = saveKeys(privateKey, publicKey, output);

    // Get fingerprint
    const fingerprint = getKeyFingerprint(publicKey);

    // Update .env if it exists
    await updateEnvFile(paths.privatePath, paths.publicPath);

    // Success message
    console.log();
    logger.success('JWT keys generated successfully!');
    console.log();
    console.log(chalk.bold('Key Details:'));
    console.log(`  Private key: ${chalk.cyan(paths.privatePath)}`);
    console.log(`  Public key:  ${chalk.cyan(paths.publicPath)}`);
    console.log(`  Algorithm:   ${chalk.dim('RSA-' + bits)}`);
    console.log(`  Fingerprint: ${chalk.dim(fingerprint)}`);
    console.log();

    // Security reminder
    logger.warn('Security Reminder:');
    console.log(chalk.yellow('  • Never commit private.pem to git'));
    console.log(chalk.yellow('  • Add keys/ to .gitignore'));
    console.log(chalk.yellow('  • Keep private key permissions at 600'));
    console.log(chalk.yellow('  • Back up keys securely'));
    console.log();

    // Next steps
    logger.info('Next Steps:');
    console.log('  1. Verify keys/ is in .gitignore');
    console.log('  2. Update .env with key paths (if not auto-updated)');
    console.log('  3. Restart your Truxe server to use new keys');
    console.log();

    // Check .gitignore
    const gitignorePath = join(process.cwd(), '.gitignore');
    if (existsSync(gitignorePath)) {
      const fs = require('fs');
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('keys/') && !gitignoreContent.includes('/keys')) {
        logger.warn('⚠️  keys/ is not in .gitignore - add it now!');
        console.log(chalk.yellow('\n  echo "keys/" >> .gitignore\n'));
      } else {
        logger.success('✓ keys/ is in .gitignore');
      }
    }
  } catch (error) {
    spinner.fail('Key generation failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Keys rotate command handler (future)
 */
async function keysRotateCommand(): Promise<void> {
  logger.warn('Key rotation is not yet implemented');
  logger.info('For now, use: truxe keys generate --force');
  logger.info('\nManual rotation steps:');
  console.log('  1. Generate new keys: truxe keys generate --output keys-new --force');
  console.log('  2. Update .env to point to new keys');
  console.log('  3. Restart server with both old and new keys (dual-key mode)');
  console.log('  4. Wait for all old tokens to expire');
  console.log('  5. Remove old keys');
  process.exit(0);
}

/**
 * Keys verify command handler
 */
async function keysVerifyCommand(): Promise<void> {
  logger.section('Verify JWT Keys');

  try {
    // Load env to get key paths (returns empty object if .env doesn't exist)
    const env = await loadEnv();

    const privatePath = env.JWT_PRIVATE_KEY_PATH || process.env.JWT_PRIVATE_KEY_PATH || './keys/private.pem';
    const publicPath = env.JWT_PUBLIC_KEY_PATH || process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem';

    // Check if files exist
    if (!existsSync(privatePath)) {
      logger.error(`Private key not found: ${privatePath}`);
      logger.info('Run: truxe keys generate');
      process.exit(1);
    }

    if (!existsSync(publicPath)) {
      logger.error(`Public key not found: ${publicPath}`);
      logger.info('Run: truxe keys generate');
      process.exit(1);
    }

    // Read keys
    const fs = require('fs');
    const privateKey = fs.readFileSync(privatePath, 'utf8');
    const publicKey = fs.readFileSync(publicPath, 'utf8');

    // Verify they are valid PEM format
    if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
      logger.error('Invalid private key format (not PEM)');
      process.exit(1);
    }

    if (!publicKey.includes('BEGIN PUBLIC KEY')) {
      logger.error('Invalid public key format (not PEM)');
      process.exit(1);
    }

    // Try to use them
    const crypto = require('crypto');
    try {
      // Test signing
      const sign = crypto.createSign('RSA-SHA256');
      sign.update('test data');
      const signature = sign.sign(privateKey, 'base64');

      // Test verifying
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update('test data');
      const isValid = verify.verify(publicKey, signature, 'base64');

      if (!isValid) {
        logger.error('Keys do not match - public key cannot verify private key signature');
        process.exit(1);
      }

      // Get fingerprint
      const fingerprint = getKeyFingerprint(publicKey);

      // Success
      logger.success('JWT keys are valid!');
      console.log();
      console.log(chalk.bold('Key Details:'));
      console.log(`  Private key: ${chalk.cyan(privatePath)}`);
      console.log(`  Public key:  ${chalk.cyan(publicPath)}`);
      console.log(`  Fingerprint: ${chalk.dim(fingerprint)}`);
      console.log(`  Status:      ${chalk.green('✓ Valid and matching')}`);
      console.log();
    } catch (error) {
      logger.error('Keys are invalid or corrupted');
      logger.debug(error instanceof Error ? error.message : String(error));
      logger.info('Generate new keys: truxe keys generate --force');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Key verification failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Register keys command
 */
export function registerKeysCommand(program: Command): void {
  const keysCommand = program
    .command('keys')
    .description('Manage JWT signing keys');

  // keys generate
  keysCommand
    .command('generate')
    .description('Generate new RSA key pair for JWT signing')
    .option('-f, --force', 'Overwrite existing keys')
    .option('-o, --output <dir>', 'Output directory for keys', './keys')
    .option('-b, --bits <bits>', 'Key size in bits (2048 or 4096)', '2048')
    .action(async (options) => {
      try {
        await keysGenerateCommand({
          force: options.force,
          output: options.output,
          bits: parseInt(options.bits, 10),
        });
      } catch (error) {
        logger.error('Key generation failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // keys verify
  keysCommand
    .command('verify')
    .description('Verify existing JWT keys')
    .action(async () => {
      try {
        await keysVerifyCommand();
      } catch (error) {
        logger.error('Key verification failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // keys rotate (future)
  keysCommand
    .command('rotate')
    .description('Rotate JWT keys (not yet implemented)')
    .action(async () => {
      try {
        await keysRotateCommand();
      } catch (error) {
        logger.error('Key rotation failed:');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
