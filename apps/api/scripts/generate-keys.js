#!/usr/bin/env node

/**
 * JWT Key Generation Script
 * 
 * Generates RSA key pairs for JWT signing and verification.
 * Supports RS256, ES256, and EdDSA algorithms.
 */

import crypto from 'crypto'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Generate RSA key pair for RS256
 */
function generateRSAKeys(keySize = 2048) {
  console.log(`Generating RSA ${keySize}-bit key pair...`)
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  
  return { publicKey, privateKey, algorithm: 'RS256' }
}

/**
 * Generate ECDSA key pair for ES256
 */
function generateECDSAKeys() {
  console.log('Generating ECDSA P-256 key pair...')
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256 curve for ES256
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  
  return { publicKey, privateKey, algorithm: 'ES256' }
}

/**
 * Generate Ed25519 key pair for EdDSA
 */
function generateEd25519Keys() {
  console.log('Generating Ed25519 key pair...')
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  
  return { publicKey, privateKey, algorithm: 'EdDSA' }
}

/**
 * Format key for environment variable
 */
function formatKeyForEnv(key) {
  return key.replace(/\n/g, '\\n')
}

/**
 * Generate keys based on algorithm
 */
function generateKeys(algorithm = 'RS256', keySize = 2048) {
  let keys
  
  switch (algorithm.toUpperCase()) {
    case 'RS256':
      keys = generateRSAKeys(keySize)
      break
    case 'ES256':
      keys = generateECDSAKeys()
      break
    case 'EDDSA':
      keys = generateEd25519Keys()
      break
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`)
  }
  
  return keys
}

/**
 * Save keys to files
 */
function saveKeysToFiles(keys, outputDir = '.') {
  const privateKeyPath = resolve(outputDir, 'jwt-private-key.pem')
  const publicKeyPath = resolve(outputDir, 'jwt-public-key.pem')
  const envPath = resolve(outputDir, 'jwt-keys.env')
  
  // Write PEM files
  writeFileSync(privateKeyPath, keys.privateKey)
  writeFileSync(publicKeyPath, keys.publicKey)
  
  // Write environment file
  const envContent = `# JWT Keys for ${keys.algorithm}
# Generated on ${new Date().toISOString()}

JWT_ALGORITHM=${keys.algorithm}
JWT_PRIVATE_KEY="${formatKeyForEnv(keys.privateKey)}"
JWT_PUBLIC_KEY="${formatKeyForEnv(keys.publicKey)}"

# Copy these values to your .env file
`
  
  writeFileSync(envPath, envContent)
  
  console.log(`\\n✅ Keys generated successfully!`)
  console.log(`📁 Private key: ${privateKeyPath}`)
  console.log(`📁 Public key: ${publicKeyPath}`)
  console.log(`📁 Environment file: ${envPath}`)
  console.log(`\\n🔐 Algorithm: ${keys.algorithm}`)
  
  if (keys.algorithm === 'RS256') {
    const keyInfo = crypto.createPublicKey(keys.publicKey)
    console.log(`🔑 Key size: ${keyInfo.asymmetricKeyDetails.mgf1HashAlgorithm ? keyInfo.asymmetricKeySize * 8 : 'Unknown'} bits`)
  }
  
  console.log(`\\n⚠️  Keep the private key secure and never commit it to version control!`)
  console.log(`📋 Copy the values from ${envPath} to your .env file`)
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  
  // Parse command line arguments
  let algorithm = 'RS256'
  let keySize = 2048
  let outputDir = '.'
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--algorithm' || arg === '-a') {
      algorithm = args[++i]
    } else if (arg === '--key-size' || arg === '-s') {
      keySize = parseInt(args[++i])
    } else if (arg === '--output' || arg === '-o') {
      outputDir = args[++i]
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
JWT Key Generation Script

Usage: node generate-keys.js [options]

Options:
  -a, --algorithm <algorithm>  JWT algorithm (RS256, ES256, EdDSA) [default: RS256]
  -s, --key-size <size>        RSA key size in bits [default: 2048]
  -o, --output <dir>           Output directory [default: current directory]
  -h, --help                   Show this help message

Examples:
  node generate-keys.js                           # Generate RS256 2048-bit keys
  node generate-keys.js -a ES256                  # Generate ES256 keys
  node generate-keys.js -a RS256 -s 4096          # Generate RS256 4096-bit keys
  node generate-keys.js -o ./keys                 # Output to ./keys directory
      `)
      process.exit(0)
    }
  }
  
  try {
    console.log(`🔐 Truxe JWT Key Generator`)
    console.log(`📋 Algorithm: ${algorithm}`)
    if (algorithm === 'RS256') {
      console.log(`📏 Key size: ${keySize} bits`)
    }
    console.log(`📁 Output directory: ${outputDir}`)
    console.log()
    
    const keys = generateKeys(algorithm, keySize)
    saveKeysToFiles(keys, outputDir)
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { generateKeys, saveKeysToFiles }
