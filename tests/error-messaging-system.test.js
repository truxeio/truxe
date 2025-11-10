/**
 * Truxe Error Messaging System Test Suite
 * 
 * Comprehensive test suite for the error messaging system including
 * error detection, structured error classes, resolution guidance,
 * automated troubleshooting, and validation automation.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import { jest } from '@jest/globals';
import { 
  errorMessagingSystem,
  ErrorSeverity,
  ErrorCategory 
} from '../config/error-messaging-system.js';
import {
  PortConflictError,
  PermissionDeniedError,
  ConfigurationError,
  NetworkError,
  ResourceLimitationError,
  ServiceStartupError,
  ValidationError,
  smartErrorHandler,
  ErrorFactory
} from '../config/structured-error-classes.js';
import { 
  resolutionGuidanceEngine,
  ResolutionPlan,
  ResolutionStep 
} from '../config/resolution-guidance-system.js';
import { 
  automatedTroubleshootingEngine,
  TroubleshootingStrategy 
} from '../config/automated-troubleshooting-engine.js';
import { 
  configurationValidator,
  healthCheckAutomation,
  ValidationRule 
} from '../config/validation-automation-system.js';

describe('Error Messaging System', () => {
  describe('Context-Aware Error Detection', () => {
    test('should analyze port conflict error with context', async () => {
      const error = new Error('listen EADDRINUSE :::3000');
      error.code = 'EADDRINUSE';
      
      const result = await errorMessagingSystem.processError(error, {
        context: { port: 3000 },
        autoTroubleshoot: false
      });

      expect(result.analysis).toBeDefined();
      expect(result.analysis.category).toBe(ErrorCategory.PORT_CONFLICT);
      expect(result.analysis.detected_patterns).toHaveLength(1);
      expect(result.analysis.suggestions).toBeInstanceOf(Array);
      expect(result.analysis.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide context-aware suggestions', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      const result = await errorMessagingSystem.processError(error, {
        context: { port: 80 },
        autoTroubleshoot: false
      });

      expect(result.analysis.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'command',
          title: expect.stringContaining('permission')
        })
      );
    });

    test('should gather comprehensive context information', async () => {
      const error = new Error('Test error');
      
      const result = await errorMessagingSystem.processError(error);

      expect(result.analysis.context).toBeDefined();
      expect(result.analysis.context.system).toBeDefined();
      expect(result.analysis.context.system.platform).toBeDefined();
      expect(result.analysis.context.system.node_version).toBeDefined();
    });
  });

  describe('Enhanced Error Message Formatter', () => {
    test('should format error as console output', async () => {
      const error = new PortConflictError(3000, { name: 'node', pid: 1234 });
      
      const result = await errorMessagingSystem.processError(error, {
        format: 'console'
      });

      expect(result.formatted_message).toContain('Port Conflict Detected');
      expect(result.formatted_message).toContain('3000');
      expect(result.formatted_message).toContain('Suggested Solutions');
    });

    test('should format error as JSON', async () => {
      const error = new ConfigurationError('config.json', 'Invalid syntax');
      
      const result = await errorMessagingSystem.processError(error, {
        format: 'json'
      });

      const parsed = JSON.parse(result.formatted_message);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(parsed.suggestions).toBeInstanceOf(Array);
    });

    test('should format error as Markdown', async () => {
      const error = new NetworkError('localhost', 3000);
      
      const result = await errorMessagingSystem.processError(error, {
        format: 'markdown'
      });

      expect(result.formatted_message).toContain('# 🌐 Network Error');
      expect(result.formatted_message).toContain('## Error Details');
      expect(result.formatted_message).toContain('## 💡 Suggested Solutions');
    });
  });

  describe('Error Statistics', () => {
    test('should track error statistics', async () => {
      // Process multiple errors
      await errorMessagingSystem.processError(new PortConflictError(3000));
      await errorMessagingSystem.processError(new PermissionDeniedError(80));
      await errorMessagingSystem.processError(new ConfigurationError('test.json'));

      const stats = errorMessagingSystem.getErrorStatistics();
      
      expect(stats.total_errors).toBeGreaterThanOrEqual(3);
      expect(stats.by_category).toBeDefined();
      expect(stats.by_severity).toBeDefined();
      expect(stats.recent_errors).toBeInstanceOf(Array);
    });
  });
});

describe('Structured Error Classes', () => {
  describe('PortConflictError', () => {
    test('should create port conflict error with process info', () => {
      const processInfo = { name: 'node', pid: 1234 };
      const error = new PortConflictError(3000, processInfo);

      expect(error.port).toBe(3000);
      expect(error.conflictingProcess).toEqual(processInfo);
      expect(error.category).toBe(ErrorCategory.PORT_CONFLICT);
      expect(error.resolutionActions).toHaveLength(4);
    });

    test('should generate appropriate resolution actions', () => {
      const error = new PortConflictError(3000);
      
      const checkAction = error.resolutionActions.find(a => a.title.includes('Identify'));
      expect(checkAction).toBeDefined();
      expect(checkAction.commands).toContain(
        expect.stringMatching(/lsof|netstat/)
      );
    });
  });

  describe('PermissionDeniedError', () => {
    test('should handle privileged port scenarios', () => {
      const error = new PermissionDeniedError(80, 'bind');

      expect(error.port).toBe(80);
      expect(error.isPrivilegedPort).toBe(true);
      expect(error.resolutionActions).toContainEqual(
        expect.objectContaining({
          title: expect.stringContaining('elevated privileges')
        })
      );
    });

    test('should handle non-privileged port scenarios', () => {
      const error = new PermissionDeniedError(3000, 'bind');

      expect(error.isPrivilegedPort).toBe(false);
      expect(error.resolutionActions).toContainEqual(
        expect.objectContaining({
          title: expect.stringContaining('permissions')
        })
      );
    });
  });

  describe('Smart Error Handler', () => {
    test('should detect port conflict from raw error', () => {
      const rawError = new Error('listen EADDRINUSE :::3000');
      rawError.code = 'EADDRINUSE';

      const structuredError = smartErrorHandler.handleError(rawError);

      expect(structuredError).toBeInstanceOf(PortConflictError);
      expect(structuredError.port).toBe(3000);
    });

    test('should detect permission denied from raw error', () => {
      const rawError = new Error('bind: permission denied');
      rawError.code = 'EACCES';

      const structuredError = smartErrorHandler.handleError(rawError);

      expect(structuredError).toBeInstanceOf(PermissionDeniedError);
    });

    test('should fallback to generic error for unknown patterns', () => {
      const rawError = new Error('Unknown error message');

      const structuredError = smartErrorHandler.handleError(rawError);

      expect(structuredError.name).toBe('TruxeError');
      expect(structuredError.message).toBe('Unknown error message');
    });
  });

  describe('Error Factory', () => {
    test('should create errors from exceptions', () => {
      const exception = new Error('EADDRINUSE: port 3000');
      exception.code = 'EADDRINUSE';

      const error = ErrorFactory.createFromException(exception);

      expect(error).toBeInstanceOf(PortConflictError);
    });

    test('should create specific error types', () => {
      const portError = ErrorFactory.createPortConflictError(3000);
      const permError = ErrorFactory.createPermissionDeniedError(80);
      const configError = ErrorFactory.createConfigurationError('test.json');

      expect(portError).toBeInstanceOf(PortConflictError);
      expect(permError).toBeInstanceOf(PermissionDeniedError);
      expect(configError).toBeInstanceOf(ConfigurationError);
    });
  });
});

describe('Resolution Guidance System', () => {
  describe('Resolution Plan Generation', () => {
    test('should generate plan for port conflict', () => {
      const error = new PortConflictError(3000);
      const plan = resolutionGuidanceEngine.generateResolutionPlan(error, { port: 3000 });

      expect(plan).toBeInstanceOf(ResolutionPlan);
      expect(plan.title).toContain('Port Conflict');
      expect(plan.steps).toHaveLength(3);
      expect(plan.estimatedTotalTime).toBeGreaterThan(0);
    });

    test('should generate plan for permission error', () => {
      const error = new PermissionDeniedError(80);
      const plan = resolutionGuidanceEngine.generateResolutionPlan(error, { port: 80 });

      expect(plan.title).toContain('Permission');
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    test('should create fallback plan for unknown errors', () => {
      const error = new Error('Unknown error');
      const plan = resolutionGuidanceEngine.generateResolutionPlan(error);

      expect(plan.title).toContain('Generic');
      expect(plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Resolution Step Execution', () => {
    test('should execute command step in dry run mode', async () => {
      const step = new ResolutionStep({
        title: 'Test Command',
        type: 'command',
        commands: ['echo "test"']
      });

      const result = await step.execute({}, 'dry_run');

      expect(result.success).toBe(true);
      expect(result.dry_run).toBe(true);
    });

    test('should check prerequisites before execution', async () => {
      const step = new ResolutionStep({
        title: 'Test with Prerequisites',
        prerequisites: [
          { type: 'file_exists', path: '/nonexistent/file' }
        ],
        commands: ['echo "test"']
      });

      const result = await step.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Prerequisites not met');
    });
  });

  describe('Plan Execution', () => {
    test('should execute plan in dry run mode', async () => {
      const plan = new ResolutionPlan({
        title: 'Test Plan'
      });
      
      plan.addStep({
        title: 'Test Step',
        commands: ['echo "test"']
      });

      const result = await plan.execute({ mode: 'dry_run' });

      expect(result.success).toBe(true);
      expect(result.totalSteps).toBe(1);
      expect(result.completedSteps).toBe(1);
    });
  });
});

describe('Automated Troubleshooting Engine', () => {
  describe('System Health Monitor', () => {
    test('should run port availability check', async () => {
      const result = await automatedTroubleshootingEngine.healthMonitor.runHealthCheck('port_availability');

      expect(result).toBeDefined();
      expect(result.healthy).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.details).toBeDefined();
    });

    test('should run system resources check', async () => {
      const result = await automatedTroubleshootingEngine.healthMonitor.runHealthCheck('system_resources');

      expect(result.healthy).toBeDefined();
      expect(result.details.heap_used_percent).toBeDefined();
      expect(typeof result.details.heap_used_percent).toBe('number');
    });

    test('should run comprehensive health check', async () => {
      const { summary, results } = await automatedTroubleshootingEngine.healthMonitor.runAllHealthChecks();

      expect(summary.total_checks).toBeGreaterThan(0);
      expect(summary.overall_health).toMatch(/healthy|warning|critical/);
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(summary.total_checks);
    });
  });

  describe('Intelligent Fix Suggester', () => {
    test('should suggest fixes for port conflicts', () => {
      const error = new PortConflictError(3000);
      const fixes = automatedTroubleshootingEngine.fixSuggester.suggestFixes(error, { port: 3000 });

      expect(fixes).toBeInstanceOf(Array);
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].title).toBeDefined();
      expect(fixes[0].confidence).toBeGreaterThan(0);
    });

    test('should filter fixes by strategy', () => {
      const error = new PortConflictError(3000);
      const conservativeFixes = automatedTroubleshootingEngine.fixSuggester.suggestFixes(
        error, 
        { port: 3000 }, 
        TroubleshootingStrategy.CONSERVATIVE
      );
      const aggressiveFixes = automatedTroubleshootingEngine.fixSuggester.suggestFixes(
        error, 
        { port: 3000 }, 
        TroubleshootingStrategy.AGGRESSIVE
      );

      expect(conservativeFixes.length).toBeLessThanOrEqual(aggressiveFixes.length);
      expect(conservativeFixes.every(fix => ['low', 'none'].includes(fix.riskLevel))).toBe(true);
    });
  });

  describe('Automated Troubleshooting', () => {
    test('should run troubleshooting without auto-apply', async () => {
      const error = new PortConflictError(3000);
      
      const result = await automatedTroubleshootingEngine.runTroubleshooting(error, {
        autoApply: false,
        includeHealthCheck: false
      });

      expect(result.suggested_fixes).toBeInstanceOf(Array);
      expect(result.applied_fixes).toHaveLength(0);
      expect(result.success).toBe(false); // No fixes applied
    });

    test('should include health check when requested', async () => {
      const error = new PortConflictError(3000);
      
      const result = await automatedTroubleshootingEngine.runTroubleshooting(error, {
        includeHealthCheck: true,
        autoApply: false
      });

      expect(result.health_check).toBeDefined();
      expect(result.health_check.overall_status).toMatch(/healthy|warning|critical/);
    });
  });

  describe('Statistics and Reporting', () => {
    test('should provide troubleshooting statistics', () => {
      const stats = automatedTroubleshootingEngine.getTroubleshootingStatistics();

      expect(stats.total_sessions).toBeDefined();
      expect(stats.fix_statistics).toBeDefined();
      expect(typeof stats.success_rate).toBe('number');
    });
  });
});

describe('Validation Automation System', () => {
  describe('Configuration Validator', () => {
    test('should validate port ranges', async () => {
      const rule = configurationValidator.rules.get('port_range');
      
      const validResult = await rule.validate(3000);
      expect(validResult.valid).toBe(true);
      
      const invalidResult = await rule.validate(70000);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.reason).toContain('65535');
    });

    test('should validate reserved ports', async () => {
      const rule = configurationValidator.rules.get('port_reserved');
      
      const reservedResult = await rule.validate(80);
      expect(reservedResult.valid).toBe(false);
      expect(reservedResult.fixable).toBe(true);
      
      const nonReservedResult = await rule.validate(3000);
      expect(nonReservedResult.valid).toBe(true);
    });

    test('should run comprehensive configuration validation', async () => {
      const config = {
        port: 3000,
        environment: 'development'
      };

      const result = await configurationValidator.validateConfiguration(config, {
        rules: ['port_range', 'port_reserved'],
        autoFix: false
      });

      expect(result.valid).toBeDefined();
      expect(result.rules_checked).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });

    test('should apply auto-fixes when enabled', async () => {
      const config = { port: 80 }; // Reserved port
      
      const result = await configurationValidator.validateConfiguration(config, {
        rules: ['port_reserved'],
        autoFix: true
      });

      expect(result.fixes_applied.length).toBeGreaterThan(0);
      expect(config.port).not.toBe(80); // Should be changed
    });
  });

  describe('Health Check Automation', () => {
    test('should run individual health checks', async () => {
      const result = await healthCheckAutomation.runHealthCheck('configuration_health');

      expect(result.healthy).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.execution_time).toBeGreaterThan(0);
    });

    test('should provide health statistics', () => {
      const stats = healthCheckAutomation.getHealthStatistics();

      expect(stats.total_checks).toBeGreaterThan(0);
      expect(stats.check_types).toBeDefined();
      expect(typeof stats.success_rate).toBe('number');
    });

    test('should schedule health checks', () => {
      const healthCheck = {
        id: 'test_check',
        name: 'Test Check',
        interval: '*/5 * * * *',
        check: async () => ({ healthy: true, message: 'Test OK' })
      };

      healthCheckAutomation.addHealthCheck(healthCheck);
      
      expect(healthCheckAutomation.healthChecks.has('test_check')).toBe(true);
      expect(healthCheckAutomation.schedules.has('test_check')).toBe(true);
    });
  });

  describe('Validation Rules', () => {
    test('should create custom validation rule', async () => {
      const customRule = new ValidationRule({
        name: 'Custom Test Rule',
        validator: async (value) => ({
          valid: value === 'test',
          reason: value === 'test' ? 'Valid' : 'Must be "test"'
        })
      });

      const validResult = await customRule.validate('test');
      expect(validResult.valid).toBe(true);

      const invalidResult = await customRule.validate('invalid');
      expect(invalidResult.valid).toBe(false);
    });

    test('should handle rule dependencies', async () => {
      const rule = new ValidationRule({
        name: 'Dependent Rule',
        dependencies: [
          { type: 'env_var', name: 'NODE_ENV' }
        ],
        validator: async () => ({ valid: true })
      });

      // Set environment variable
      process.env.NODE_ENV = 'test';
      const result = await rule.validate('test');
      expect(result.valid).toBe(true);

      // Remove environment variable
      delete process.env.NODE_ENV;
      const failedResult = await rule.validate('test');
      expect(failedResult.valid).toBe(false);
      expect(failedResult.dependency_failed).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  test('should handle end-to-end error processing', async () => {
    // Simulate a raw error from the system
    const rawError = new Error('listen EADDRINUSE :::3000');
    rawError.code = 'EADDRINUSE';

    // Process through the complete system
    const result = await errorMessagingSystem.processError(rawError, {
      autoTroubleshoot: true,
      autoFix: false,
      format: 'console'
    });

    // Verify complete processing
    expect(result.analysis).toBeDefined();
    expect(result.formatted_message).toContain('Port Conflict');
    expect(result.troubleshooting_result).toBeDefined();
    expect(result.troubleshooting_result.suggested_fixes.length).toBeGreaterThan(0);
  });

  test('should integrate validation with error handling', async () => {
    // Create configuration error
    const configError = new ConfigurationError('test.json', 'Invalid port');
    
    // Process error and run validation
    const errorResult = await errorMessagingSystem.processError(configError);
    const validationResult = await configurationValidator.validateConfiguration({
      port: 70000 // Invalid port
    });

    expect(errorResult.analysis.category).toBe(ErrorCategory.CONFIGURATION);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThan(0);
  });

  test('should integrate health checks with troubleshooting', async () => {
    // Run health check
    const healthResult = await healthCheckAutomation.runAllHealthChecks();
    
    // If health issues found, run troubleshooting
    if (healthResult.summary.overall_health !== 'healthy') {
      const error = new Error('System health issues detected');
      const troubleshootingResult = await automatedTroubleshootingEngine.runTroubleshooting(error, {
        includeHealthCheck: false // Already have health data
      });
      
      expect(troubleshootingResult.suggested_fixes).toBeDefined();
    }

    expect(healthResult.summary).toBeDefined();
  });
});

describe('Performance Tests', () => {
  test('should process errors efficiently', async () => {
    const startTime = Date.now();
    
    // Process multiple errors
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const error = new PortConflictError(3000 + i);
      promises.push(errorMessagingSystem.processError(error, {
        autoTroubleshoot: false
      }));
    }
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should process 10 errors in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
  });

  test('should run health checks efficiently', async () => {
    const startTime = Date.now();
    
    await healthCheckAutomation.runAllHealthChecks();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Health checks should complete quickly (< 10 seconds)
    expect(duration).toBeLessThan(10000);
  });
});

// Test cleanup
afterAll(async () => {
  // Stop any scheduled health checks
  healthCheckAutomation.stopAllSchedules();
  
  // Clean up any test files or resources
  console.log('🧹 Test cleanup completed');
});
