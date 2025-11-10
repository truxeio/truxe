# Truxe Error Handling Guide

## Overview

Truxe features a comprehensive error messaging system that provides developers with clear, actionable guidance for resolving port-related issues and general system problems. This guide covers the error handling architecture, troubleshooting procedures, and automated resolution capabilities.

## Table of Contents

1. [Error Categories](#error-categories)
2. [Error Severity Levels](#error-severity-levels)
3. [Structured Error Classes](#structured-error-classes)
4. [Automated Troubleshooting](#automated-troubleshooting)
5. [Resolution Guidance System](#resolution-guidance-system)
6. [Common Error Scenarios](#common-error-scenarios)
7. [Troubleshooting Commands](#troubleshooting-commands)
8. [Best Practices](#best-practices)

## Error Categories

Truxe classifies errors into the following categories:

### Port Conflict Errors
- **Description**: Occurs when a port is already in use by another process
- **Common Causes**: Multiple services trying to use the same port, leftover processes
- **Icon**: 🚫
- **Example**: `Port 3000 is already in use by node (PID: 1234)`

### Permission Errors
- **Description**: Insufficient permissions to bind to a port or access resources
- **Common Causes**: Trying to bind to privileged ports (<1024) without root access
- **Icon**: 🔒
- **Example**: `Permission denied to bind on port 80`

### Configuration Errors
- **Description**: Invalid or missing configuration files
- **Common Causes**: Syntax errors, missing files, invalid values
- **Icon**: ⚙️
- **Example**: `Configuration error in config/ports.js: Invalid JSON syntax`

### Network Errors
- **Description**: Network connectivity or DNS resolution issues
- **Common Causes**: Network interface problems, firewall blocking, DNS issues
- **Icon**: 🌐
- **Example**: `Network error: Failed to connect to localhost:3000`

### Resource Limitation Errors
- **Description**: System resource limits exceeded
- **Common Causes**: Too many open files, memory exhaustion, disk space
- **Icon**: 💾
- **Example**: `Resource limit exceeded: file_descriptors (1024/1024)`

### Validation Errors
- **Description**: Configuration or input validation failures
- **Common Causes**: Invalid port ranges, reserved ports, constraint violations
- **Icon**: ✅
- **Example**: `Validation failed for port (value: 80): Port is reserved`

### Service Startup Errors
- **Description**: Services failing to start properly
- **Common Causes**: Missing dependencies, configuration issues, resource conflicts
- **Icon**: 🚀
- **Example**: `Failed to start service 'api': Port conflict detected`

### Runtime Errors
- **Description**: General runtime errors not covered by other categories
- **Common Causes**: Unexpected exceptions, system failures
- **Icon**: ⚡
- **Example**: `Unexpected runtime error occurred`

## Error Severity Levels

### INFO (ℹ️)
- Informational messages
- No action required
- System operating normally

### WARNING (⚠️)
- Potential issues that should be monitored
- System can continue operating
- May require attention soon

### ERROR (❌)
- Errors that prevent normal operation
- Immediate attention required
- System functionality impacted

### CRITICAL (🚨)
- Severe errors that may cause system failure
- Urgent attention required
- Multiple system components affected

### FATAL (💀)
- System-breaking errors
- Immediate intervention required
- System cannot continue operating

## Structured Error Classes

Truxe uses structured error classes that provide rich context and automated resolution suggestions:

### TruxeError (Base Class)
```javascript
class TruxeError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.category = options.category;
    this.severity = options.severity;
    this.context = options.context;
    this.suggestions = options.suggestions;
    this.resolutionActions = options.resolutionActions;
  }
}
```

### PortConflictError
```javascript
// Automatically detects conflicting processes and suggests solutions
const error = new PortConflictError(3000, {
  name: 'node',
  pid: 1234
});
```

### PermissionDeniedError
```javascript
// Provides specific guidance for permission issues
const error = new PermissionDeniedError(80, 'bind');
```

### ConfigurationError
```javascript
// Includes file validation and fix suggestions
const error = new ConfigurationError('config/ports.js', 'Invalid JSON syntax');
```

## Automated Troubleshooting

Truxe includes an intelligent troubleshooting engine that can automatically diagnose and fix common issues.

### Troubleshooting Strategies

#### Conservative Strategy
- Only safe, non-destructive actions
- Low risk of system impact
- Suitable for production environments

#### Balanced Strategy (Default)
- Mix of safe and medium-risk actions
- Good balance of effectiveness and safety
- Recommended for most scenarios

#### Aggressive Strategy
- All available actions including high-risk
- Maximum problem resolution capability
- Use with caution in production

#### Diagnostic Only
- Information gathering only
- No system changes made
- Safe for all environments

### Running Automated Troubleshooting

```bash
# Basic troubleshooting
npm run troubleshoot

# With specific strategy
npm run troubleshoot --strategy=conservative

# Interactive mode
npm run troubleshoot --interactive

# Dry run (show what would be done)
npm run troubleshoot --dry-run
```

### System Health Monitoring

The system continuously monitors health across multiple dimensions:

```bash
# Run comprehensive health check
npm run health:check

# Monitor specific components
npm run health:check --component=ports
npm run health:check --component=docker
npm run health:check --component=network
```

## Resolution Guidance System

### Resolution Plans

The system generates step-by-step resolution plans for different error types:

```javascript
// Example resolution plan for port conflicts
const plan = new ResolutionPlan({
  title: 'Port Conflict Resolution',
  steps: [
    {
      title: 'Identify Conflicting Process',
      commands: ['lsof -ti:3000', 'ps -p $(lsof -ti:3000)'],
      estimatedTime: '30 seconds'
    },
    {
      title: 'Terminate Process',
      commands: ['kill -15 $(lsof -ti:3000)'],
      riskLevel: 'medium'
    },
    {
      title: 'Verify Port Available',
      validation: () => checkPortAvailable(3000)
    }
  ]
});
```

### Automated Fixes

The system can automatically apply fixes with varying confidence levels:

```javascript
// High-confidence fix for port conflicts
const fix = new AutomatedFix({
  title: 'Use Alternative Port',
  confidence: 0.9,
  riskLevel: 'low',
  actions: [
    {
      type: 'environment_change',
      variable: 'PORT',
      value: '3001'
    }
  ]
});
```

## Common Error Scenarios

### Scenario 1: Port Already in Use

**Error Message:**
```
🚫 Port Conflict Detected
Port 3000 is already in use by node (PID: 1234)
```

**Automated Resolution:**
1. Identify the conflicting process
2. Assess if process is safe to terminate
3. Either terminate process or suggest alternative port
4. Verify resolution

**Manual Steps:**
```bash
# Check what's using the port
lsof -ti:3000
ps -p $(lsof -ti:3000)

# Terminate the process (if safe)
kill -15 1234

# Or use alternative port
export PORT=3001
npm start
```

### Scenario 2: Permission Denied on Privileged Port

**Error Message:**
```
🔒 Permission Denied
Permission denied to bind on port 80
```

**Automated Resolution:**
1. Detect privileged port usage
2. Suggest non-privileged alternative
3. Update configuration automatically

**Manual Steps:**
```bash
# Use non-privileged port
export PORT=8080

# Or run with elevated privileges (not recommended)
sudo npm start
```

### Scenario 3: Configuration File Error

**Error Message:**
```
⚙️ Configuration Error
Configuration error in config/ports.js: Unexpected token
```

**Automated Resolution:**
1. Validate configuration syntax
2. Backup current configuration
3. Restore from template or fix syntax
4. Verify configuration validity

**Manual Steps:**
```bash
# Validate configuration
npm run config:validate

# Fix syntax errors manually
code config/ports.js

# Or restore from backup
cp config/ports.js.backup config/ports.js
```

### Scenario 4: Network Connectivity Issues

**Error Message:**
```
🌐 Network Error
Network error: Failed to connect to localhost:3000
```

**Automated Resolution:**
1. Test basic connectivity
2. Check network interfaces
3. Verify DNS resolution
4. Reset network configuration if needed

**Manual Steps:**
```bash
# Test connectivity
ping -c 3 localhost
telnet localhost 3000

# Check network interfaces
ip addr show
netstat -tulpn

# Reset network (if needed)
sudo systemctl restart NetworkManager
```

### Scenario 5: Resource Limitations

**Error Message:**
```
💾 Resource Limitation
Resource limit exceeded: file_descriptors (1024/1024)
```

**Automated Resolution:**
1. Check current resource usage
2. Increase limits temporarily
3. Clean up resources
4. Suggest permanent fixes

**Manual Steps:**
```bash
# Check current limits
ulimit -n

# Increase temporarily
ulimit -n 4096

# Check resource usage
lsof | wc -l

# Clean up if needed
npm cache clean --force
```

## Troubleshooting Commands

### Port Management Commands

```bash
# Check port availability
npm run port:check

# Resolve port conflicts automatically
npm run port:resolve

# Get port suggestions
npm run port:suggest --service=api

# Diagnose port issues
npm run port:diagnose

# Monitor port usage
npm run port:monitor
```

### System Diagnostics

```bash
# Run comprehensive diagnostics
npm run diagnose

# Check system health
npm run health:check

# Validate configuration
npm run config:validate

# Check service status
npm run status

# View system logs
npm run logs
```

### Error Analysis

```bash
# Analyze recent errors
npm run error:analyze

# Export error report
npm run error:report --format=json

# Clear error history
npm run error:clear

# Test error handling
npm run error:test
```

## Best Practices

### Error Prevention

1. **Use Port Ranges**: Assign services to specific port ranges to avoid conflicts
2. **Validate Configuration**: Always validate configuration files before deployment
3. **Monitor Resources**: Keep track of system resource usage
4. **Regular Health Checks**: Run periodic health checks to catch issues early
5. **Proper Cleanup**: Ensure processes are properly terminated when stopping services

### Error Handling

1. **Structured Logging**: Use structured error objects with rich context
2. **Graceful Degradation**: Design systems to handle errors gracefully
3. **User-Friendly Messages**: Provide clear, actionable error messages
4. **Automated Recovery**: Implement automated recovery mechanisms where possible
5. **Documentation**: Keep error documentation up to date

### Troubleshooting

1. **Start with Health Check**: Always begin with a comprehensive health check
2. **Use Conservative Strategy**: Start with conservative troubleshooting in production
3. **Verify Fixes**: Always verify that fixes actually resolve the issue
4. **Document Solutions**: Keep track of successful resolution procedures
5. **Learn from Errors**: Use error analytics to improve system reliability

### Configuration Management

1. **Version Control**: Keep configuration files in version control
2. **Environment Separation**: Use different configurations for different environments
3. **Validation Rules**: Implement comprehensive validation rules
4. **Backup Strategy**: Maintain backups of working configurations
5. **Change Management**: Use proper change management procedures

### Monitoring and Alerting

1. **Proactive Monitoring**: Monitor system health continuously
2. **Alert Thresholds**: Set appropriate alert thresholds
3. **Error Tracking**: Track error patterns and trends
4. **Performance Metrics**: Monitor system performance metrics
5. **Capacity Planning**: Plan for future capacity needs

## Advanced Features

### Custom Error Handlers

You can create custom error handlers for specific scenarios:

```javascript
import { SmartErrorHandler, ErrorFactory } from './config/structured-error-classes.js';

const handler = new SmartErrorHandler();

// Add custom error pattern
handler.addErrorPattern(/CUSTOM_ERROR_(\d+)/, (match, error) => {
  const code = match[1];
  return ErrorFactory.createCustomError(code, error.message);
});
```

### Integration with Monitoring Systems

```javascript
import { errorMessagingSystem } from './config/error-messaging-system.js';

// Listen for error events
errorMessagingSystem.on('error_processed', (result) => {
  // Send to monitoring system
  sendToMonitoring(result.analysis);
});
```

### Custom Resolution Plans

```javascript
import { ResolutionPlan, ResolutionStep } from './config/resolution-guidance-system.js';

const customPlan = new ResolutionPlan({
  title: 'Custom Resolution',
  category: 'custom'
});

customPlan.addStep(new ResolutionStep({
  title: 'Custom Fix',
  commands: ['custom-command'],
  validation: async () => {
    // Custom validation logic
    return { success: true };
  }
}));
```

## Troubleshooting FAQ

### Q: How do I enable debug mode for error handling?
A: Set the environment variable `TRUXE_DEBUG=true` to enable detailed error logging.

### Q: Can I disable automated troubleshooting?
A: Yes, set `TRUXE_AUTO_TROUBLESHOOT=false` in your environment variables.

### Q: How do I add custom error patterns?
A: Use the `SmartErrorHandler.addErrorPattern()` method to register custom patterns.

### Q: Where are error reports stored?
A: Error reports are stored in the `reports/` directory with timestamps.

### Q: How do I rollback an automated fix?
A: Use `npm run troubleshoot:rollback --fix-id=<id>` to rollback specific fixes.

### Q: Can I run troubleshooting in CI/CD pipelines?
A: Yes, use `npm run troubleshoot --strategy=diagnostic_only --format=json` for CI/CD integration.

## Support and Resources

- **Documentation**: [docs/05-guides/](../05-guides/)
- **Issue Tracker**: GitHub Issues
- **Community**: Discord Server
- **Professional Support**: Contact DevOps Team

For additional help or to report issues with the error handling system, please consult the resources above or contact the development team.
