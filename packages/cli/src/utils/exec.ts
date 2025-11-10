/**
 * Command execution utility
 * Wraps execa for consistent command execution with better error handling
 */

import { execa, type ExecaError } from 'execa';
import { logger } from './logger';

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: 'inherit' | 'pipe' | 'ignore';
  verbose?: boolean;
  shell?: boolean;
}

/**
 * Execute a command and return result
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const {
    cwd = process.cwd(),
    env = process.env,
    stdio = 'pipe',
    verbose = false,
    shell = false,
  } = options;

  if (verbose || logger) {
    const cmdStr = shell ? command : [command, ...args].join(' ');
    logger.debug(`Executing: ${cmdStr}${cwd !== process.cwd() ? ` (in ${cwd})` : ''}`);
  }

  try {
    const result = await execa(command, args, {
      cwd,
      env,
      stdio,
      shell,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    const execaError = error as ExecaError;
    
    if (verbose || logger) {
      logger.error(`Command failed: ${command} ${args.join(' ')}`);
      if (execaError.stdout) {
        logger.debug(`stdout: ${execaError.stdout}`);
      }
      if (execaError.stderr) {
        logger.debug(`stderr: ${execaError.stderr}`);
      }
    }

    throw error;
  }
}

/**
 * Execute a command and stream output to console
 */
export async function execStream(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<{ exitCode: number }> {
  const {
    cwd = process.cwd(),
    env = process.env,
    shell = false,
  } = options;

  logger.debug(`Executing (streaming): ${command} ${args.join(' ')}`);

  try {
    const result = await execa(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      shell,
    });

    return {
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    logger.error(`Command failed: ${command} ${args.join(' ')}`);
    
    throw error;
  }
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      await exec('where', [command], { stdio: 'ignore' });
    } else {
      await exec('which', [command], { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute command and return boolean success status
 */
export async function execSilent(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<boolean> {
  try {
    await exec(command, args, { ...options, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

