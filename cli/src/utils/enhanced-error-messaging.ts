/**
 * Enhanced Error Messaging System
 * 
 * Provides intelligent error analysis and actionable guidance:
 * - Context-aware error detection
 * - Step-by-step resolution guidance
 * - Automated troubleshooting suggestions
 * - Cross-platform compatibility checks
 * - Performance impact analysis
 */

import { PortManager, SystemStatus } from './port-manager';
import { IntelligentPortSuggester } from './intelligent-port-suggester';
import chalk from 'chalk';
import ora from 'ora';

export interface ErrorAnalysis {
  error_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  root_cause: string;
  impact_assessment: {
    service_availability: 'full' | 'partial' | 'none';
    performance_impact: 'none' | 'minor' | 'moderate' | 'severe';
    user_experience: 'unaffected' | 'degraded' | 'broken';
  };
  resolution_steps: ResolutionStep[];
  prevention_tips: string[];
  related_issues: string[];
  estimated_resolution_time: string;
}

export interface ResolutionStep {
  step_number: number;
  title: string;
  description: string;
  command?: string;
  verification_command?: string;
  success_criteria: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_time: string;
  prerequisites?: string[];
}

export interface TroubleshootingContext {
  environment: string;
  service_name?: string;
  port?: number;
  error_message: string;
  system_status: SystemStatus;
  user_context: {
    os: string;
    shell: string;
    permissions: string[];
  };
}

export interface ErrorReport {
  error_id: string;
  timestamp: string;
  context: TroubleshootingContext;
  analysis: ErrorAnalysis;
  resolution_attempts: ResolutionAttempt[];
  status: 'unresolved' | 'in_progress' | 'resolved' | 'escalated';
}

export interface ResolutionAttempt {
  step_number: number;
  attempted_at: string;
  success: boolean;
  output?: string;
  error?: string;
  duration_ms: number;
}

export class EnhancedErrorMessaging {
  private portManager: PortManager;
  private intelligentSuggester: IntelligentPortSuggester;
  private errorDatabase: Map<string, ErrorReport> = new Map();

  constructor() {
    this.portManager = new PortManager();
    this.intelligentSuggester = new IntelligentPortSuggester();
  }

  /**
   * Analyze an error and provide comprehensive guidance
   */
  async analyzeError(
    error: Error,
    context: Partial<TroubleshootingContext> = {}
  ): Promise<ErrorAnalysis> {
    const fullContext = await this.buildTroubleshootingContext(error, context);
    
    // Determine error type and analyze
    const errorType = this.classifyError(error, fullContext);
    const analysis = await this.performErrorAnalysis(errorType, error, fullContext);
    
    return analysis;
  }

  /**
   * Get step-by-step resolution guidance
   */
  async getResolutionGuidance(
    error: Error,
    context: Partial<TroubleshootingContext> = {}
  ): Promise<{
    analysis: ErrorAnalysis;
    interactive_guidance: boolean;
    automated_fixes: ResolutionStep[];
    manual_steps: ResolutionStep[];
  }> {
    const analysis = await this.analyzeError(error, context);
    
    const automatedFixes = analysis.resolution_steps.filter(step => 
      step.command && step.risk_level === 'low'
    );
    
    const manualSteps = analysis.resolution_steps.filter(step => 
      !step.command || step.risk_level !== 'low'
    );

    return {
      analysis,
      interactive_guidance: true,
      automated_fixes: automatedFixes,
      manual_steps: manualSteps
    };
  }

  /**
   * Execute automated resolution steps
   */
  async executeAutomatedResolution(
    errorId: string,
    steps: ResolutionStep[],
    context: TroubleshootingContext
  ): Promise<{
    success: boolean;
    executed_steps: ResolutionAttempt[];
    remaining_steps: ResolutionStep[];
    final_status: string;
  }> {
    const executedSteps: ResolutionAttempt[] = [];
    let success = true;

    for (const step of steps) {
      const attempt: ResolutionAttempt = {
        step_number: step.step_number,
        attempted_at: new Date().toISOString(),
        success: false,
        duration_ms: 0
      };

      const startTime = Date.now();

      try {
        if (step.command) {
          const output = await this.executeCommand(step.command, context);
          attempt.output = output;
          attempt.success = true;
        } else {
          // Manual step - mark as requiring user action
          attempt.success = false;
          attempt.error = 'Manual step requires user intervention';
        }
      } catch (error) {
        attempt.error = error instanceof Error ? error.message : String(error);
        success = false;
      }

      attempt.duration_ms = Date.now() - startTime;
      executedSteps.push(attempt);

      // If a step fails, stop execution
      if (!attempt.success && step.risk_level === 'high') {
        break;
      }
    }

    const remainingSteps = steps.slice(executedSteps.length);
    const finalStatus = success ? 'resolved' : 'partial_failure';

    return {
      success,
      executed_steps: executedSteps,
      remaining_steps: remainingSteps,
      final_status: finalStatus
    };
  }

  /**
   * Generate comprehensive error report
   */
  async generateErrorReport(
    error: Error,
    context: Partial<TroubleshootingContext> = {}
  ): Promise<ErrorReport> {
    const errorId = this.generateErrorId();
    const fullContext = await this.buildTroubleshootingContext(error, context);
    const analysis = await this.analyzeError(error, context);

    const report: ErrorReport = {
      error_id: errorId,
      timestamp: new Date().toISOString(),
      context: fullContext,
      analysis,
      resolution_attempts: [],
      status: 'unresolved'
    };

    this.errorDatabase.set(errorId, report);
    return report;
  }

  /**
   * Get error history and patterns
   */
  getErrorHistory(serviceName?: string): ErrorReport[] {
    const reports = Array.from(this.errorDatabase.values());
    
    if (serviceName) {
      return reports.filter(report => 
        report.context.service_name === serviceName
      );
    }
    
    return reports;
  }

  /**
   * Get common error patterns and prevention tips
   */
  getErrorPatterns(): {
    common_errors: { error_type: string; frequency: number; common_causes: string[] }[];
    prevention_tips: string[];
    best_practices: string[];
  } {
    const reports = Array.from(this.errorDatabase.values());
    const errorCounts = new Map<string, number>();
    const errorCauses = new Map<string, Set<string>>();

    reports.forEach(report => {
      const errorType = report.analysis.error_type;
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
      
      if (!errorCauses.has(errorType)) {
        errorCauses.set(errorType, new Set());
      }
      errorCauses.get(errorType)!.add(report.analysis.root_cause);
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([errorType, frequency]) => ({
        error_type: errorType,
        frequency,
        common_causes: Array.from(errorCauses.get(errorType) || [])
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      common_errors: commonErrors,
      prevention_tips: this.getPreventionTips(),
      best_practices: this.getBestPractices()
    };
  }

  private async buildTroubleshootingContext(
    error: Error,
    context: Partial<TroubleshootingContext>
  ): Promise<TroubleshootingContext> {
    const systemStatus = await this.portManager.getSystemStatus(context.environment || 'development');
    
    return {
      environment: context.environment || 'development',
      service_name: context.service_name,
      port: context.port,
      error_message: error.message,
      system_status: systemStatus,
      user_context: {
        os: process.platform,
        shell: process.env.SHELL || 'unknown',
        permissions: await this.checkUserPermissions()
      }
    };
  }

  private classifyError(error: Error, context: TroubleshootingContext): string {
    const message = error.message.toLowerCase();
    
    // Port-related errors
    if (message.includes('port') && message.includes('already in use')) {
      return 'port_conflict';
    }
    if (message.includes('port') && message.includes('permission denied')) {
      return 'port_permission_denied';
    }
    if (message.includes('port') && message.includes('out of range')) {
      return 'port_out_of_range';
    }
    
    // Network-related errors
    if (message.includes('eaddrinuse')) {
      return 'address_in_use';
    }
    if (message.includes('econnrefused')) {
      return 'connection_refused';
    }
    if (message.includes('enotfound')) {
      return 'host_not_found';
    }
    
    // Permission errors
    if (message.includes('permission denied') || message.includes('eacces')) {
      return 'permission_denied';
    }
    
    // Configuration errors
    if (message.includes('config') || message.includes('configuration')) {
      return 'configuration_error';
    }
    
    // Service errors
    if (message.includes('service') && message.includes('not found')) {
      return 'service_not_found';
    }
    
    return 'unknown_error';
  }

  private async performErrorAnalysis(
    errorType: string,
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    switch (errorType) {
      case 'port_conflict':
        return this.analyzePortConflictError(error, context);
      case 'port_permission_denied':
        return this.analyzePortPermissionError(error, context);
      case 'address_in_use':
        return this.analyzeAddressInUseError(error, context);
      case 'permission_denied':
        return this.analyzePermissionDeniedError(error, context);
      case 'configuration_error':
        return this.analyzeConfigurationError(error, context);
      default:
        return this.analyzeGenericError(error, context);
    }
  }

  private async analyzePortConflictError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    const port = this.extractPortFromError(error.message);
    const conflictingService = context.system_status.services.find(s => s.port === port);
    
    return {
      error_type: 'port_conflict',
      severity: 'high',
      root_cause: `Port ${port} is already in use by ${conflictingService?.name || 'unknown service'}`,
      impact_assessment: {
        service_availability: 'none',
        performance_impact: 'none',
        user_experience: 'broken'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Identify conflicting process',
          description: 'Find the process using the conflicting port',
          command: `lsof -ti:${port}`,
          verification_command: `lsof -i:${port}`,
          success_criteria: 'Process ID identified',
          risk_level: 'low',
          estimated_time: '30 seconds'
        },
        {
          step_number: 2,
          title: 'Kill conflicting process',
          description: 'Terminate the process using the port',
          command: `kill -9 $(lsof -ti:${port})`,
          verification_command: `lsof -i:${port}`,
          success_criteria: 'Port is now available',
          risk_level: 'medium',
          estimated_time: '1 minute'
        },
        {
          step_number: 3,
          title: 'Find alternative port',
          description: 'Get intelligent port suggestions',
          success_criteria: 'Alternative port identified',
          risk_level: 'low',
          estimated_time: '1 minute'
        }
      ],
      prevention_tips: [
        'Use port management tools to check availability before starting services',
        'Implement port conflict detection in startup scripts',
        'Use intelligent port suggestion system for new services'
      ],
      related_issues: ['port_permission_denied', 'configuration_error'],
      estimated_resolution_time: '2-5 minutes'
    };
  }

  private async analyzePortPermissionError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    const port = this.extractPortFromError(error.message);
    
    return {
      error_type: 'port_permission_denied',
      severity: 'high',
      root_cause: `Insufficient permissions to bind to port ${port}`,
      impact_assessment: {
        service_availability: 'none',
        performance_impact: 'none',
        user_experience: 'broken'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Check port permissions',
          description: 'Verify if port requires elevated privileges',
          command: `netstat -tuln | grep :${port}`,
          success_criteria: 'Port permission requirements identified',
          risk_level: 'low',
          estimated_time: '30 seconds'
        },
        {
          step_number: 2,
          title: 'Use alternative port',
          description: 'Switch to a port that doesn\'t require elevated privileges',
          success_criteria: 'Service starts successfully',
          risk_level: 'low',
          estimated_time: '1 minute'
        },
        {
          step_number: 3,
          title: 'Run with elevated privileges',
          description: 'Use sudo or run as administrator (if necessary)',
          command: `sudo ${process.argv.join(' ')}`,
          success_criteria: 'Service starts with elevated privileges',
          risk_level: 'high',
          estimated_time: '2 minutes',
          prerequisites: ['Administrator/sudo access']
        }
      ],
      prevention_tips: [
        'Use ports above 1024 to avoid privilege requirements',
        'Configure services to use non-privileged ports',
        'Implement proper permission checking in startup scripts'
      ],
      related_issues: ['port_conflict', 'permission_denied'],
      estimated_resolution_time: '2-5 minutes'
    };
  }

  private async analyzeAddressInUseError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    return {
      error_type: 'address_in_use',
      severity: 'high',
      root_cause: 'Network address is already in use by another process',
      impact_assessment: {
        service_availability: 'none',
        performance_impact: 'none',
        user_experience: 'broken'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Find conflicting process',
          description: 'Identify the process using the address',
          command: 'netstat -tulpn | grep LISTEN',
          success_criteria: 'Conflicting process identified',
          risk_level: 'low',
          estimated_time: '30 seconds'
        },
        {
          step_number: 2,
          title: 'Kill conflicting process',
          description: 'Terminate the conflicting process',
          success_criteria: 'Address is now available',
          risk_level: 'medium',
          estimated_time: '1 minute'
        }
      ],
      prevention_tips: [
        'Check address availability before binding',
        'Use unique addresses for different services',
        'Implement proper cleanup on service shutdown'
      ],
      related_issues: ['port_conflict'],
      estimated_resolution_time: '1-3 minutes'
    };
  }

  private async analyzePermissionDeniedError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    return {
      error_type: 'permission_denied',
      severity: 'high',
      root_cause: 'Insufficient permissions to perform the requested operation',
      impact_assessment: {
        service_availability: 'none',
        performance_impact: 'none',
        user_experience: 'broken'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Check file permissions',
          description: 'Verify file and directory permissions',
          command: 'ls -la',
          success_criteria: 'Permission issues identified',
          risk_level: 'low',
          estimated_time: '30 seconds'
        },
        {
          step_number: 2,
          title: 'Fix permissions',
          description: 'Update file permissions as needed',
          command: 'chmod +x filename',
          success_criteria: 'Permissions updated',
          risk_level: 'medium',
          estimated_time: '1 minute'
        },
        {
          step_number: 3,
          title: 'Run with elevated privileges',
          description: 'Use sudo if necessary',
          command: 'sudo command',
          success_criteria: 'Operation succeeds',
          risk_level: 'high',
          estimated_time: '1 minute',
          prerequisites: ['Administrator/sudo access']
        }
      ],
      prevention_tips: [
        'Ensure proper file permissions are set',
        'Use appropriate user accounts for services',
        'Implement permission checking in scripts'
      ],
      related_issues: ['port_permission_denied'],
      estimated_resolution_time: '2-5 minutes'
    };
  }

  private async analyzeConfigurationError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    return {
      error_type: 'configuration_error',
      severity: 'medium',
      root_cause: 'Invalid or missing configuration',
      impact_assessment: {
        service_availability: 'none',
        performance_impact: 'none',
        user_experience: 'broken'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Validate configuration',
          description: 'Check configuration file syntax and values',
          command: 'heimdall config validate',
          success_criteria: 'Configuration issues identified',
          risk_level: 'low',
          estimated_time: '1 minute'
        },
        {
          step_number: 2,
          title: 'Fix configuration',
          description: 'Update configuration with correct values',
          success_criteria: 'Configuration is valid',
          risk_level: 'low',
          estimated_time: '2 minutes'
        },
        {
          step_number: 3,
          title: 'Restart services',
          description: 'Restart services with new configuration',
          command: 'heimdall restart',
          success_criteria: 'Services start successfully',
          risk_level: 'low',
          estimated_time: '1 minute'
        }
      ],
      prevention_tips: [
        'Use configuration validation tools',
        'Implement configuration templates',
        'Test configuration changes in development first'
      ],
      related_issues: ['service_not_found'],
      estimated_resolution_time: '3-5 minutes'
    };
  }

  private async analyzeGenericError(
    error: Error,
    context: TroubleshootingContext
  ): Promise<ErrorAnalysis> {
    return {
      error_type: 'unknown_error',
      severity: 'medium',
      root_cause: 'Unknown error occurred',
      impact_assessment: {
        service_availability: 'partial',
        performance_impact: 'minor',
        user_experience: 'degraded'
      },
      resolution_steps: [
        {
          step_number: 1,
          title: 'Gather error details',
          description: 'Collect detailed error information',
          command: 'heimdall logs --tail 50',
          success_criteria: 'Error details collected',
          risk_level: 'low',
          estimated_time: '1 minute'
        },
        {
          step_number: 2,
          title: 'Check system status',
          description: 'Verify overall system health',
          command: 'heimdall status',
          success_criteria: 'System status verified',
          risk_level: 'low',
          estimated_time: '1 minute'
        },
        {
          step_number: 3,
          title: 'Contact support',
          description: 'Escalate to support team with error details',
          success_criteria: 'Support ticket created',
          risk_level: 'low',
          estimated_time: '5 minutes'
        }
      ],
      prevention_tips: [
        'Implement comprehensive error logging',
        'Use monitoring and alerting systems',
        'Regular system health checks'
      ],
      related_issues: [],
      estimated_resolution_time: '5-10 minutes'
    };
  }

  private extractPortFromError(message: string): number | null {
    const portMatch = message.match(/:(\d+)/);
    return portMatch ? parseInt(portMatch[1], 10) : null;
  }

  private async executeCommand(command: string, context: TroubleshootingContext): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command);
      return stdout || stderr;
    } catch (error) {
      throw new Error(`Command failed: ${command} - ${error}`);
    }
  }

  private async checkUserPermissions(): Promise<string[]> {
    const permissions: string[] = [];
    
    try {
      // Check if user can bind to privileged ports
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('nc -l 80');
      permissions.push('privileged_ports');
    } catch {
      // User cannot bind to privileged ports
    }
    
    return permissions;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPreventionTips(): string[] {
    return [
      'Always check port availability before starting services',
      'Use intelligent port suggestion system for new services',
      'Implement proper error handling and logging',
      'Regular system health monitoring',
      'Keep services updated and patched',
      'Use configuration validation tools',
      'Implement proper cleanup on service shutdown',
      'Monitor resource usage and conflicts'
    ];
  }

  private getBestPractices(): string[] {
    return [
      'Use non-privileged ports (>1024) when possible',
      'Implement graceful shutdown procedures',
      'Use environment-specific configurations',
      'Implement proper logging and monitoring',
      'Use containerization for service isolation',
      'Implement health checks and auto-recovery',
      'Use load balancing for high availability',
      'Regular backup and disaster recovery planning'
    ];
  }
}

export default EnhancedErrorMessaging;
