import { ConfigManager } from '../../src/utils/config';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ConfigManager as any).configCache = null;
  });

  describe('isTruxeProject', () => {
    it('should return true when truxe.config file exists', () => {
      const { existsSync } = require('fs');
      existsSync.mockReturnValue(true);

      const result = ConfigManager.isTruxeProject();
      expect(result).toBe(true);
    });

    it('should return false when no truxe.config files exist', () => {
      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);

      const result = ConfigManager.isTruxeProject();
      expect(result).toBe(false);
    });
  });

  describe('loadConfig', () => {
    it('should load default configuration when no config files exist', () => {
      const { existsSync } = require('fs');
      existsSync.mockImplementation((path: string) => {
        // Simulate project root exists but no config files
        return path.includes('truxe.config') ? false : true;
      });

      const config = ConfigManager.loadConfig('/test/project');
      
      expect(config.database?.url).toBe('sqlite:./dev.db');
      expect(config.auth?.jwt?.algorithm).toBe('RS256');
      expect(config.multiTenant?.enabled).toBe(false);
    });

    it('should merge environment variables into configuration', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        ENABLE_MULTI_TENANT: 'true'
      };

      const { existsSync } = require('fs');
      existsSync.mockImplementation((path: string) => {
        return path.includes('truxe.config') ? false : true;
      });

      const config = ConfigManager.loadConfig('/test/project');
      
      expect(config.database?.url).toBe('postgresql://test:test@localhost:5432/test');
      expect(config.multiTenant?.enabled).toBe(true);

      process.env = originalEnv;
    });
  });

  describe('setValue', () => {
    it('should set nested configuration values', () => {
      const { existsSync } = require('fs');
      
      existsSync.mockImplementation((path: string) => {
        return path.includes('truxe.config') ? false : true;
      });

      const mockSaveConfig = jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();

      ConfigManager.setValue('database.url', 'postgresql://new-url', '/test/project');

      expect(mockSaveConfig).toHaveBeenCalled();
      mockSaveConfig.mockRestore();
    });
  });

  describe('getValue', () => {
    it('should get nested configuration values', () => {
      const { existsSync } = require('fs');
      existsSync.mockImplementation((path: string) => {
        return path.includes('truxe.config') ? false : true;
      });

      const value = ConfigManager.getValue('database.url', '/test/project');
      
      expect(value).toBeTruthy();
      expect(value?.key).toBe('database.url');
      expect(value?.value).toBe('sqlite:./dev.db');
      expect(value?.source).toBe('file');
    });

    it('should return null for non-existent keys', () => {
      const { existsSync } = require('fs');
      existsSync.mockImplementation((path: string) => {
        return path.includes('truxe.config') ? false : true;
      });

      const value = ConfigManager.getValue('nonexistent.key', '/test/project');
      
      expect(value).toBeNull();
    });
  });
});
