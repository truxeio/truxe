import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import {
  ensureDir,
  copy,
  copyMany,
  readFile,
  writeFile,
  exists,
  isDirectory,
  isFile,
  remove,
  readJson,
  writeJson,
  resolvePath,
  joinPath,
  dirname,
  basename,
  extname,
  renderTemplate,
  renderTemplateFile,
} from '../../src/utils/fs';

describe('fs utility', () => {
  const testDir = join(process.cwd(), 'tests', 'tmp', 'fs-tests');

  beforeEach(async () => {
    // Ensure clean test directory
    await ensureDir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await remove(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', async () => {
      const dirPath = join(testDir, 'new-dir');

      await ensureDir(dirPath);

      const dirExists = await exists(dirPath);
      expect(dirExists).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const dirPath = join(testDir, 'existing-dir');

      await ensureDir(dirPath);
      await ensureDir(dirPath); // Call again

      const dirExists = await exists(dirPath);
      expect(dirExists).toBe(true);
    });

    it('should create nested directories', async () => {
      const dirPath = join(testDir, 'level1', 'level2', 'level3');

      await ensureDir(dirPath);

      const dirExists = await exists(dirPath);
      expect(dirExists).toBe(true);
    });
  });

  describe('writeFile and readFile', () => {
    it('should write and read file', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Hello, World!';

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });

    it('should create parent directories automatically', async () => {
      const filePath = join(testDir, 'nested', 'deep', 'file.txt');
      const content = 'nested content';

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });

    it('should handle empty file', async () => {
      const filePath = join(testDir, 'empty.txt');

      await writeFile(filePath, '');
      const readContent = await readFile(filePath);

      expect(readContent).toBe('');
    });

    it('should handle multi-line content', async () => {
      const filePath = join(testDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3';

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });

    it('should handle file permissions', async () => {
      const filePath = join(testDir, 'chmod.txt');
      const content = 'content';

      await writeFile(filePath, content, { mode: 0o600 });

      const fileExists = await exists(filePath);
      expect(fileExists).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const filePath = join(testDir, 'overwrite.txt');

      await writeFile(filePath, 'original');
      await writeFile(filePath, 'updated');

      const content = await readFile(filePath);
      expect(content).toBe('updated');
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      const srcPath = join(testDir, 'source.txt');
      const destPath = join(testDir, 'destination.txt');

      await writeFile(srcPath, 'file content');
      await copy(srcPath, destPath);

      const destContent = await readFile(destPath);
      expect(destContent).toBe('file content');
    });

    it('should copy directory', async () => {
      const srcDir = join(testDir, 'src-dir');
      const destDir = join(testDir, 'dest-dir');

      await ensureDir(srcDir);
      await writeFile(join(srcDir, 'file.txt'), 'content');

      await copy(srcDir, destDir);

      const copiedFile = await readFile(join(destDir, 'file.txt'));
      expect(copiedFile).toBe('content');
    });

    it('should overwrite by default', async () => {
      const srcPath = join(testDir, 'source-overwrite.txt');
      const destPath = join(testDir, 'dest-overwrite.txt');

      await writeFile(srcPath, 'new content');
      await writeFile(destPath, 'old content');

      await copy(srcPath, destPath);

      const content = await readFile(destPath);
      expect(content).toBe('new content');
    });

    it('should respect overwrite: false option', async () => {
      const srcPath = join(testDir, 'source-no-overwrite.txt');
      const destPath = join(testDir, 'dest-no-overwrite.txt');

      await writeFile(srcPath, 'new content');
      await writeFile(destPath, 'old content');

      await copy(srcPath, destPath, { overwrite: false });

      const content = await readFile(destPath);
      expect(content).toBe('old content');
    });

    it('should support filter function', async () => {
      const srcDir = join(testDir, 'src-filter');
      const destDir = join(testDir, 'dest-filter');

      await ensureDir(srcDir);
      await writeFile(join(srcDir, 'include.txt'), 'include');
      await writeFile(join(srcDir, 'exclude.txt'), 'exclude');

      await copy(srcDir, destDir, {
        filter: (src) => !src.includes('exclude'),
      });

      const includeExists = await exists(join(destDir, 'include.txt'));
      const excludeExists = await exists(join(destDir, 'exclude.txt'));

      expect(includeExists).toBe(true);
      expect(excludeExists).toBe(false);
    });
  });

  describe('copyMany', () => {
    it('should copy multiple files', async () => {
      const file1Src = join(testDir, 'file1.txt');
      const file1Dest = join(testDir, 'copy1.txt');
      const file2Src = join(testDir, 'file2.txt');
      const file2Dest = join(testDir, 'copy2.txt');

      await writeFile(file1Src, 'content1');
      await writeFile(file2Src, 'content2');

      await copyMany([
        { src: file1Src, dest: file1Dest },
        { src: file2Src, dest: file2Dest },
      ]);

      const content1 = await readFile(file1Dest);
      const content2 = await readFile(file2Dest);

      expect(content1).toBe('content1');
      expect(content2).toBe('content2');
    });

    it('should handle empty array', async () => {
      await copyMany([]);
      // Should not throw
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'exists-file.txt');
      await writeFile(filePath, 'content');

      const fileExists = await exists(filePath);
      expect(fileExists).toBe(true);
    });

    it('should return true for existing directory', async () => {
      const dirPath = join(testDir, 'exists-dir');
      await ensureDir(dirPath);

      const dirExists = await exists(dirPath);
      expect(dirExists).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const filePath = join(testDir, 'non-existent.txt');

      const fileExists = await exists(filePath);
      expect(fileExists).toBe(false);
    });
  });

  describe('isDirectory and isFile', () => {
    it('should identify directory correctly', async () => {
      const dirPath = join(testDir, 'is-dir');
      await ensureDir(dirPath);

      const isDir = await isDirectory(dirPath);
      const isFileResult = await isFile(dirPath);

      expect(isDir).toBe(true);
      expect(isFileResult).toBe(false);
    });

    it('should identify file correctly', async () => {
      const filePath = join(testDir, 'is-file.txt');
      await writeFile(filePath, 'content');

      const isDir = await isDirectory(filePath);
      const isFileResult = await isFile(filePath);

      expect(isDir).toBe(false);
      expect(isFileResult).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const fakePath = join(testDir, 'fake-path');

      const isDir = await isDirectory(fakePath);
      const isFileResult = await isFile(fakePath);

      expect(isDir).toBe(false);
      expect(isFileResult).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove file', async () => {
      const filePath = join(testDir, 'remove-file.txt');
      await writeFile(filePath, 'content');

      await remove(filePath);

      const fileExists = await exists(filePath);
      expect(fileExists).toBe(false);
    });

    it('should remove directory', async () => {
      const dirPath = join(testDir, 'remove-dir');
      await ensureDir(dirPath);
      await writeFile(join(dirPath, 'file.txt'), 'content');

      await remove(dirPath);

      const dirExists = await exists(dirPath);
      expect(dirExists).toBe(false);
    });

    it('should not fail for non-existent path', async () => {
      const fakePath = join(testDir, 'non-existent-remove');

      await remove(fakePath);
      // Should not throw
    });
  });

  describe('readJson and writeJson', () => {
    it('should write and read JSON', async () => {
      const filePath = join(testDir, 'data.json');
      const data = { key: 'value', number: 42, nested: { prop: true } };

      await writeJson(filePath, data);
      const readData = await readJson(filePath);

      expect(readData).toEqual(data);
    });

    it('should format JSON with spaces', async () => {
      const filePath = join(testDir, 'formatted.json');
      const data = { key: 'value' };

      await writeJson(filePath, data, { spaces: 4 });

      const content = await readFile(filePath);
      expect(content).toContain('    '); // 4 spaces indentation
    });

    it('should handle arrays', async () => {
      const filePath = join(testDir, 'array.json');
      const data = [1, 2, 3, { key: 'value' }];

      await writeJson(filePath, data);
      const readData = await readJson(filePath);

      expect(readData).toEqual(data);
    });

    it('should handle empty object', async () => {
      const filePath = join(testDir, 'empty.json');

      await writeJson(filePath, {});
      const readData = await readJson(filePath);

      expect(readData).toEqual({});
    });

    it('should create parent directories', async () => {
      const filePath = join(testDir, 'nested', 'deep', 'data.json');
      const data = { test: true };

      await writeJson(filePath, data);
      const readData = await readJson(filePath);

      expect(readData).toEqual(data);
    });
  });

  describe('path utilities', () => {
    it('should resolve path', () => {
      const resolved = resolvePath('.');
      expect(resolved).toBeTruthy();
      expect(resolved).toContain(process.cwd());
    });

    it('should join paths', () => {
      const joined = joinPath('path', 'to', 'file.txt');
      expect(joined).toBe(join('path', 'to', 'file.txt'));
    });

    it('should get dirname', () => {
      const dir = dirname('/path/to/file.txt');
      expect(dir).toBe('/path/to');
    });

    it('should get basename', () => {
      const base = basename('/path/to/file.txt');
      expect(base).toBe('file.txt');
    });

    it('should get basename without extension', () => {
      const base = basename('/path/to/file.txt', '.txt');
      expect(base).toBe('file');
    });

    it('should get extname', () => {
      const ext = extname('/path/to/file.txt');
      expect(ext).toBe('.txt');
    });

    it('should handle paths without extension', () => {
      const ext = extname('/path/to/file');
      expect(ext).toBe('');
    });
  });

  describe('renderTemplate', () => {
    it('should replace template variables', () => {
      const template = 'Hello {{name}}, you are {{age}} years old.';
      const data = { name: 'Alice', age: 30 };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello Alice, you are 30 years old.');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{name}} likes {{name}}';
      const data = { name: 'Bob' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Bob likes Bob');
    });

    it('should handle number values', () => {
      const template = 'Port: {{port}}';
      const data = { port: 3456 };

      const result = renderTemplate(template, data);

      expect(result).toBe('Port: 3456');
    });

    it('should handle boolean values', () => {
      const template = 'Enabled: {{enabled}}';
      const data = { enabled: true };

      const result = renderTemplate(template, data);

      expect(result).toBe('Enabled: true');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}';
      const data = {};

      const result = renderTemplate(template, data);

      // Missing variables remain as-is
      expect(result).toBe('Hello {{name}}');
    });

    it('should handle whitespace in placeholders', () => {
      const template = 'Hello {{ name }}';
      const data = { name: 'Charlie' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello Charlie');
    });

    it('should handle special characters in values', () => {
      const template = 'Connection: {{url}}';
      const data = { url: 'postgresql://user:pass@localhost:5432/db' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Connection: postgresql://user:pass@localhost:5432/db');
    });

    it('should handle empty string values', () => {
      const template = 'Value: {{value}}';
      const data = { value: '' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Value: ');
    });
  });

  describe('renderTemplateFile', () => {
    it('should render template file and write output', async () => {
      const templatePath = join(testDir, 'template.txt');
      const outputPath = join(testDir, 'output.txt');
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const data = { name: 'Alice', project: 'Truxe' };

      await writeFile(templatePath, template);
      await renderTemplateFile(templatePath, data, outputPath);

      const output = await readFile(outputPath);
      expect(output).toBe('Hello Alice, welcome to Truxe!');
    });

    it('should handle complex templates', async () => {
      const templatePath = join(testDir, 'complex-template.txt');
      const outputPath = join(testDir, 'complex-output.txt');
      const template = `
DATABASE_URL={{database_url}}
PORT={{port}}
NODE_ENV={{env}}
`;
      const data = {
        database_url: 'postgresql://localhost:5432/db',
        port: 3456,
        env: 'development',
      };

      await writeFile(templatePath, template);
      await renderTemplateFile(templatePath, data, outputPath);

      const output = await readFile(outputPath);
      expect(output).toContain('DATABASE_URL=postgresql://localhost:5432/db');
      expect(output).toContain('PORT=3456');
      expect(output).toContain('NODE_ENV=development');
    });

    it('should create output directory if needed', async () => {
      const templatePath = join(testDir, 'template-nested.txt');
      const outputPath = join(testDir, 'output', 'nested', 'file.txt');
      const template = 'Value: {{value}}';

      await writeFile(templatePath, template);
      await renderTemplateFile(templatePath, { value: 'test' }, outputPath);

      const output = await readFile(outputPath);
      expect(output).toBe('Value: test');
    });
  });

  describe('edge cases', () => {
    it('should handle very large files', async () => {
      const filePath = join(testDir, 'large-file.txt');
      const content = 'x'.repeat(1000000); // 1MB of data

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent.length).toBe(1000000);
    });

    it('should handle unicode characters', async () => {
      const filePath = join(testDir, 'unicode.txt');
      const content = 'Hello 世界 🌍 Привет';

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });

    it('should handle files with special characters in name', async () => {
      const filePath = join(testDir, 'file-with-special@chars#123.txt');
      const content = 'special file';

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });
  });
});
