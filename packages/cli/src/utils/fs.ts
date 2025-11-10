/**
 * File system utility helpers
 * Provides convenient wrappers around fs-extra for common operations
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

export interface CopyOptions {
  overwrite?: boolean;
  filter?: (src: string, dest: string) => boolean;
}

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
  logger.debug(`Ensured directory exists: ${dirPath}`);
}

/**
 * Copy file or directory
 */
export async function copy(
  src: string,
  dest: string,
  options: CopyOptions = {}
): Promise<void> {
  const { overwrite = true, filter } = options;
  
  try {
    if (filter) {
      await fs.copy(src, dest, {
        overwrite,
        filter,
      });
    } else {
      await fs.copy(src, dest, { overwrite });
    }
    logger.debug(`Copied ${src} to ${dest}`);
  } catch (error) {
    logger.error(`Failed to copy ${src} to ${dest}: ${error}`);
    throw error;
  }
}

/**
 * Copy multiple files/directories
 */
export async function copyMany(
  items: Array<{ src: string; dest: string; options?: CopyOptions }>
): Promise<void> {
  await Promise.all(items.map(({ src, dest, options }) => copy(src, dest, options)));
}

/**
 * Read file as string
 */
export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Write file with content
 */
export async function writeFile(
  filePath: string,
  content: string,
  options?: { mode?: number }
): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
  
  if (options?.mode !== undefined) {
    await fs.chmod(filePath, options.mode);
  }
  
  logger.debug(`Written file: ${filePath}`);
}

/**
 * Check if file or directory exists
 */
export async function exists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

/**
 * Check if path is a directory
 */
export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Remove file or directory
 */
export async function remove(filePath: string): Promise<void> {
  await fs.remove(filePath);
  logger.debug(`Removed: ${filePath}`);
}

/**
 * Read JSON file
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  return await fs.readJson(filePath);
}

/**
 * Write JSON file with formatting
 */
export async function writeJson(
  filePath: string,
  data: unknown,
  options?: { spaces?: number }
): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, {
    spaces: options?.spaces ?? 2,
  });
  logger.debug(`Written JSON: ${filePath}`);
}

/**
 * Get absolute path from relative path
 */
export function resolvePath(...paths: string[]): string {
  return path.resolve(...paths);
}

/**
 * Join path segments
 */
export function joinPath(...paths: string[]): string {
  return path.join(...paths);
}

/**
 * Get directory name from file path
 */
export function dirname(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get base name from file path
 */
export function basename(filePath: string, ext?: string): string {
  return path.basename(filePath, ext);
}

/**
 * Get file extension
 */
export function extname(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Template replacement in file content
 * Replaces {{key}} with value from data object
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

/**
 * Read template file and render with data
 */
export async function renderTemplateFile(
  templatePath: string,
  data: Record<string, string | number | boolean>,
  outputPath: string
): Promise<void> {
  const template = await readFile(templatePath);
  const rendered = renderTemplate(template, data);
  await writeFile(outputPath, rendered);
}

