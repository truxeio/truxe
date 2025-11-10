import { Command } from 'commander';
import { generateKeyPairSync, createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import { Logger } from '../utils/logger';
import { ErrorHandler, TruxeError } from '../utils/error-handler';
import { ConfigManager } from '../utils/config';

export function keysCommand(program: Command): void {
  const keys = program
    .command('keys')
    .description('Manage JWT signing keys for authentication')
    .addHelpText('after', `
Examples:
  $ truxe keys generate
  $ truxe keys generate --bits=4096
  $ truxe keys generate --output-dir=./certs
  $ truxe keys generate --force

Key Sizes:
  2048  Recommended for most applications (default)
  3072  Enhanced security
  4096  Maximum security (slower)

Security Notes:
  - Private keys are saved with 600 permissions (owner read/write only)
  - Never commit private keys to version control
  - Use environment variables or secrets management in production

For more information, visit: https://docs.truxe.io/cli/keys
    `);

  keys
    .command('generate')
    .description('Generate RSA key pair for JWT signing')
    .addHelpText('after', `
Examples:
  $ truxe keys generate
  $ truxe keys generate --bits=4096 --force
  $ truxe keys generate --output-dir=./certs --update-env=false
    `)
    .option('-f, --force', 'Overwrite existing keys')
    .option('--bits <bits>', 'Key size in bits (2048|3072|4096)', '2048')
    .option('--output-dir <dir>', 'Output directory for keys', 'keys')
    .option('--update-env', 'Update .env file with key paths', true)
    .action(async (options: {
      force?: boolean;
      bits?: string;
      outputDir?: string;
      updateEnv?: boolean;
    }) => {
      const logger = new Logger();
      
      try {
        logger.header('🔑 Truxe JWT Key Generation');
        logger.blank();
        
        // Validate project
        const projectRoot = ConfigManager.isTruxeProject() 
          ? ConfigManager.getProjectRoot()
          : process.cwd();
        
        const keySize = parseInt(options.bits || '2048', 10);
        
        // Validate key size
        if (![2048, 3072, 4096].includes(keySize)) {
          throw new TruxeError(
            'Invalid key size',
            'INVALID_KEY_SIZE',
            ['Supported key sizes: 2048, 3072, 4096']
          );
        }
        
        const keysDir = join(projectRoot, options.outputDir || 'keys');
        const privateKeyPath = join(keysDir, 'private.pem');
        const publicKeyPath = join(keysDir, 'public.pem');
        
        // Check if keys already exist
        if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
          if (!options.force) {
            throw new TruxeError(
              'Keys already exist',
              'KEYS_EXIST',
              [
                'Use --force to overwrite existing keys',
                `Private key: ${privateKeyPath}`,
                `Public key: ${publicKeyPath}`
              ]
            );
          }
          
          logger.warning('⚠️  Existing keys will be overwritten');
          logger.blank();
        }
        
        // Generate keys
        const spinner = ora('Generating RSA key pair...').start();
        
        try {
          const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: keySize,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem'
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem'
            }
          });
          
          // Create keys directory
          if (!existsSync(keysDir)) {
            mkdirSync(keysDir, { recursive: true });
          }
          
          // Write keys to files
          writeFileSync(privateKeyPath, privateKey);
          writeFileSync(publicKeyPath, publicKey);
          
          // Set proper permissions (600 for private key, 644 for public key)
          chmodSync(privateKeyPath, 0o600);
          chmodSync(publicKeyPath, 0o644);
          
          spinner.succeed(`Generated ${keySize}-bit RSA key pair`);
          
          // Calculate key fingerprint
          const fingerprint = calculateKeyFingerprint(publicKey);
          
          logger.blank();
          logger.success('✅ Keys generated successfully!');
          logger.blank();
          
          logger.subheader('Key Information:');
          logger.table([
            { key: 'Private Key', value: privateKeyPath, status: 'success' },
            { key: 'Public Key', value: publicKeyPath, status: 'success' },
            { key: 'Key Size', value: `${keySize} bits` },
            { key: 'Fingerprint', value: fingerprint }
          ]);
          
          // Update .env file if requested
          if (options.updateEnv !== false) {
            await updateEnvFile(projectRoot, privateKeyPath, publicKeyPath);
          }
          
          logger.blank();
          logger.info('💡 Security Tips:');
          logger.bullet('Keep your private key secure and never commit it to version control');
          logger.bullet('Add keys/ directory to .gitignore');
          logger.bullet('Use environment variables in production');
          logger.bullet('Rotate keys periodically for better security');
          
        } catch (error) {
          spinner.fail('Key generation failed');
          throw error;
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Key Generation');
      }
    });

  keys
    .command('show')
    .description('Display key information')
    .option('--fingerprint', 'Show key fingerprint only')
    .option('--public', 'Show public key only')
    .action(async (options: { fingerprint?: boolean; public?: boolean }) => {
      const logger = new Logger();
      
      try {
        const projectRoot = ConfigManager.isTruxeProject() 
          ? ConfigManager.getProjectRoot()
          : process.cwd();
        
        const keysDir = join(projectRoot, 'keys');
        const publicKeyPath = join(keysDir, 'public.pem');
        
        if (!existsSync(publicKeyPath)) {
          throw new TruxeError(
            'Public key not found',
            'KEY_NOT_FOUND',
            ['Run `truxe keys generate` to create keys']
          );
        }
        
        const publicKey = readFileSync(publicKeyPath, 'utf-8');
        
        if (options.fingerprint) {
          const fingerprint = calculateKeyFingerprint(publicKey);
          console.log(fingerprint);
          return;
        }
        
        if (options.public) {
          console.log(publicKey);
          return;
        }
        
        logger.header('🔑 JWT Key Information');
        logger.blank();
        
        const fingerprint = calculateKeyFingerprint(publicKey);
        
        logger.table([
          { key: 'Public Key Path', value: publicKeyPath },
          { key: 'Fingerprint', value: fingerprint }
        ]);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Key Display');
      }
    });
}

function calculateKeyFingerprint(publicKey: string): string {
  // Remove header/footer and whitespace
  const keyContent = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');
  
  // Create SHA-256 hash
  const hash = createHash('sha256')
    .update(Buffer.from(keyContent, 'base64'))
    .digest('hex');
  
  // Format as colon-separated hex pairs
  return hash.match(/.{2}/g)?.join(':') || hash;
}

async function updateEnvFile(
  projectRoot: string,
  privateKeyPath: string,
  publicKeyPath: string
): Promise<void> {
  const envPath = join(projectRoot, '.env');
  const envExamplePath = join(projectRoot, '.env.example');
  
  // Read private key and format for .env (escape newlines)
  const privateKey = readFileSync(privateKeyPath, 'utf-8');
  const publicKey = readFileSync(publicKeyPath, 'utf-8');
  
  const privateKeyEnv = privateKey.replace(/\n/g, '\\n');
  const publicKeyEnv = publicKey.replace(/\n/g, '\\n');
  
  // Update .env file
  if (existsSync(envPath)) {
    let envContent = readFileSync(envPath, 'utf-8');
    
    // Update or add JWT_PRIVATE_KEY
    if (envContent.includes('JWT_PRIVATE_KEY=')) {
      envContent = envContent.replace(
        /JWT_PRIVATE_KEY=.*/,
        `JWT_PRIVATE_KEY="${privateKeyEnv}"`
      );
    } else {
      envContent += `\nJWT_PRIVATE_KEY="${privateKeyEnv}"\n`;
    }
    
    // Update or add JWT_PUBLIC_KEY
    if (envContent.includes('JWT_PUBLIC_KEY=')) {
      envContent = envContent.replace(
        /JWT_PUBLIC_KEY=.*/,
        `JWT_PUBLIC_KEY="${publicKeyEnv}"`
      );
    } else {
      envContent += `\nJWT_PUBLIC_KEY="${publicKeyEnv}"\n`;
    }
    
    writeFileSync(envPath, envContent);
  } else {
    // Create new .env file
    const envContent = `# JWT Keys
JWT_PRIVATE_KEY="${privateKeyEnv}"
JWT_PUBLIC_KEY="${publicKeyEnv}"
`;
    writeFileSync(envPath, envContent);
  }
  
  // Update .env.example if it exists
  if (existsSync(envExamplePath)) {
    let exampleContent = readFileSync(envExamplePath, 'utf-8');
    
    if (!exampleContent.includes('JWT_PRIVATE_KEY=')) {
      exampleContent += `\n# JWT Keys (generated by 'truxe keys generate')\nJWT_PRIVATE_KEY=""\nJWT_PUBLIC_KEY=""\n`;
      writeFileSync(envExamplePath, exampleContent);
    }
  }
}

