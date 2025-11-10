import inquirer from 'inquirer';
import chalk from 'chalk';
import { PortManager, PortCheckResult, ProcessInfo } from './port-manager';
import { Logger } from './logger';

export interface ResolutionStrategy {
  name: string;
  description: string;
  action: (conflict: PortConflict) => Promise<ResolutionResult>;
}

export interface PortConflict {
  port: number;
  service?: string;
  process: ProcessInfo;
  suggestions?: number[];
}

export interface ResolutionResult {
  success: boolean;
  action: string;
  details?: any;
  error?: string;
}

export interface AutoResolutionResults {
  conflictsFound: number;
  conflictsResolved: number;
  actionsTaken: number;
  status: 'success' | 'partial' | 'failed';
  actions: ResolutionAction[];
}

export interface ResolutionAction {
  type: 'kill' | 'reassign' | 'suggest' | 'skip';
  port: number;
  description: string;
  success: boolean;
  details?: any;
}

export class PortResolver {
  private portManager: PortManager;
  private logger: Logger;
  private strategies: Map<string, ResolutionStrategy>;

  constructor() {
    this.portManager = new PortManager();
    this.logger = new Logger();
    this.strategies = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Kill process strategy
    this.strategies.set('kill', {
      name: 'Kill Process',
      description: 'Terminate the process using the port',
      action: async (conflict: PortConflict) => {
        try {
          const results = await this.portManager.killPortProcesses([conflict.port], false);
          const result = results[0];
          
          return {
            success: result.success,
            action: 'kill',
            details: { pid: conflict.process.pid, processName: conflict.process.name },
            error: result.success ? undefined : result.error
          };
        } catch (error) {
          return {
            success: false,
            action: 'kill',
            error: (error as Error).message
          };
        }
      }
    });

    // Force kill strategy
    this.strategies.set('force-kill', {
      name: 'Force Kill Process',
      description: 'Forcefully terminate the process using the port',
      action: async (conflict: PortConflict) => {
        try {
          const results = await this.portManager.killPortProcesses([conflict.port], true);
          const result = results[0];
          
          return {
            success: result.success,
            action: 'force-kill',
            details: { pid: conflict.process.pid, processName: conflict.process.name },
            error: result.success ? undefined : result.error
          };
        } catch (error) {
          return {
            success: false,
            action: 'force-kill',
            error: (error as Error).message
          };
        }
      }
    });

    // Suggest alternative strategy
    this.strategies.set('suggest', {
      name: 'Suggest Alternative',
      description: 'Suggest alternative available ports',
      action: async (conflict: PortConflict) => {
        try {
          const suggestions = await this.portManager.suggestAlternativePorts(
            conflict.port,
            'development',
            5,
            conflict.service
          );
          
          return {
            success: suggestions.length > 0,
            action: 'suggest',
            details: { suggestions: suggestions.map(s => s.port) },
            error: suggestions.length === 0 ? 'No alternative ports found' : undefined
          };
        } catch (error) {
          return {
            success: false,
            action: 'suggest',
            error: (error as Error).message
          };
        }
      }
    });

    // Skip strategy
    this.strategies.set('skip', {
      name: 'Skip',
      description: 'Skip this conflict and continue',
      action: async (conflict: PortConflict) => {
        return {
          success: true,
          action: 'skip',
          details: { port: conflict.port }
        };
      }
    });
  }

  async interactiveResolveConflicts(environment: string = 'development'): Promise<void> {
    this.logger.header('🔧 Interactive Port Conflict Resolution');
    this.logger.blank();

    // Find conflicts
    const ports = await this.portManager.getEnvironmentPorts(environment);
    const results = await this.portManager.checkPorts(ports, environment);
    const conflicts = await this.identifyConflicts(results, environment);

    if (conflicts.length === 0) {
      this.logger.success('No port conflicts found!');
      return;
    }

    this.logger.info(`Found ${conflicts.length} port conflicts:`);
    this.logger.blank();

    // Display conflicts
    this.displayConflicts(conflicts);

    // Resolve each conflict interactively
    const resolutionResults: ResolutionAction[] = [];

    for (const conflict of conflicts) {
      this.logger.blank();
      this.logger.subheader(`Resolving conflict on port ${conflict.port}`);
      
      const action = await this.promptForResolution(conflict);
      const result = await this.executeResolution(conflict, action);
      
      resolutionResults.push({
        type: action as any,
        port: conflict.port,
        description: `${action} for port ${conflict.port}`,
        success: result.success,
        details: result.details
      });

      if (result.success) {
        this.logger.success(`✅ ${result.action} completed successfully`);
      } else {
        this.logger.error(`❌ ${result.action} failed: ${result.error}`);
      }
    }

    // Display summary
    this.displayResolutionSummary(resolutionResults);
  }

  private async identifyConflicts(results: PortCheckResult[], environment: string): Promise<PortConflict[]> {
    const conflicts: PortConflict[] = [];
    const envConfig = await this.getEnvironmentConfig(environment);

    for (const result of results) {
      if (!result.available && result.pid) {
        const serviceName = this.findServiceNameForPort(result.port, envConfig);
        const process: ProcessInfo = {
          name: result.process || 'Unknown',
          pid: result.pid,
          port: result.port,
          command: result.details?.command
        };

        const suggestions = await this.portManager.suggestAlternativePorts(
          result.port,
          environment,
          3,
          serviceName
        );

        conflicts.push({
          port: result.port,
          service: serviceName,
          process,
          suggestions: suggestions.map(s => s.port)
        });
      }
    }

    return conflicts;
  }

  private findServiceNameForPort(port: number, envConfig: any): string | undefined {
    for (const [serviceName, servicePort] of Object.entries(envConfig.services)) {
      if (servicePort === port) {
        return serviceName;
      }
    }
    return undefined;
  }

  private async getEnvironmentConfig(_environment: string): Promise<any> {
    // This would normally load from the port configuration
    // For now, return a basic structure
    return {
      services: {
        api: 21001,
        database: 21432,
        redis: 21379,
        mailhog_smtp: 21025,
        mailhog_web: 21825
      }
    };
  }

  private displayConflicts(conflicts: PortConflict[]): void {
    const tableData = conflicts.map(conflict => ({
      key: `Port ${conflict.port}`,
      value: `${conflict.service || 'Unknown service'} - ${conflict.process.name} (PID: ${conflict.process.pid})`,
      status: 'error' as const
    }));

    this.logger.table(tableData);
  }

  private async promptForResolution(conflict: PortConflict): Promise<string> {
    const choices = [
      {
        name: `${chalk.red('Kill')} - Terminate ${conflict.process.name} (PID: ${conflict.process.pid})`,
        value: 'kill'
      },
      {
        name: `${chalk.red('Force Kill')} - Forcefully terminate ${conflict.process.name}`,
        value: 'force-kill'
      },
      {
        name: `${chalk.blue('Suggest')} - Show alternative ports`,
        value: 'suggest'
      },
      {
        name: `${chalk.yellow('Skip')} - Leave this conflict unresolved`,
        value: 'skip'
      }
    ];

    if (conflict.suggestions && conflict.suggestions.length > 0) {
      choices.splice(2, 0, {
        name: `${chalk.green('Use Alternative')} - Use port ${conflict.suggestions[0]}`,
        value: 'use-alternative'
      });
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `How would you like to resolve the conflict on port ${conflict.port}?`,
        choices
      }
    ]);

    return answer.action;
  }

  private async executeResolution(conflict: PortConflict, action: string): Promise<ResolutionResult> {
    if (action === 'use-alternative') {
      return {
        success: true,
        action: 'suggest-alternative',
        details: { 
          originalPort: conflict.port,
          suggestedPort: conflict.suggestions?.[0],
          suggestions: conflict.suggestions
        }
      };
    }

    const strategy = this.strategies.get(action);
    if (!strategy) {
      return {
        success: false,
        action,
        error: 'Unknown resolution strategy'
      };
    }

    return await strategy.action(conflict);
  }

  async autoResolveConflicts(
    environment: string = 'development',
    strategy: string = 'suggest'
  ): Promise<AutoResolutionResults> {
    const ports = await this.portManager.getEnvironmentPorts(environment);
    const results = await this.portManager.checkPorts(ports, environment);
    const conflicts = await this.identifyConflicts(results, environment);

    const resolutionResults: AutoResolutionResults = {
      conflictsFound: conflicts.length,
      conflictsResolved: 0,
      actionsTaken: 0,
      status: 'success',
      actions: []
    };

    if (conflicts.length === 0) {
      return resolutionResults;
    }

    for (const conflict of conflicts) {
      let resolutionStrategy = strategy;
      
      // Adjust strategy based on conflict type
      if (strategy === 'auto') {
        resolutionStrategy = this.determineAutoStrategy(conflict);
      }

      const strategyImpl = this.strategies.get(resolutionStrategy);
      if (!strategyImpl) {
        resolutionResults.actions.push({
          type: 'skip',
          port: conflict.port,
          description: `Unknown strategy: ${resolutionStrategy}`,
          success: false
        });
        continue;
      }

      try {
        const result = await strategyImpl.action(conflict);
        
        resolutionResults.actions.push({
          type: result.action as any,
          port: conflict.port,
          description: `${result.action} for port ${conflict.port}`,
          success: result.success,
          details: result.details
        });

        if (result.success) {
          resolutionResults.conflictsResolved++;
        }
        
        resolutionResults.actionsTaken++;
      } catch (error) {
        resolutionResults.actions.push({
          type: 'skip',
          port: conflict.port,
          description: `Failed to resolve port ${conflict.port}: ${(error as Error).message}`,
          success: false
        });
      }
    }

    // Determine overall status
    if (resolutionResults.conflictsResolved === resolutionResults.conflictsFound) {
      resolutionResults.status = 'success';
    } else if (resolutionResults.conflictsResolved > 0) {
      resolutionResults.status = 'partial';
    } else {
      resolutionResults.status = 'failed';
    }

    return resolutionResults;
  }

  private determineAutoStrategy(conflict: PortConflict): string {
    // Simple heuristics for auto strategy selection
    const processName = conflict.process.name.toLowerCase();
    
    // Don't kill system processes
    if (processName.includes('system') || processName.includes('kernel')) {
      return 'suggest';
    }
    
    // Kill development servers that are likely safe to restart
    if (processName.includes('node') || processName.includes('npm') || 
        processName.includes('yarn') || processName.includes('dev')) {
      return 'kill';
    }
    
    // For databases and other services, suggest alternatives
    if (processName.includes('postgres') || processName.includes('redis') || 
        processName.includes('mysql') || processName.includes('mongo')) {
      return 'suggest';
    }
    
    // Default to suggesting alternatives
    return 'suggest';
  }

  private displayResolutionSummary(results: ResolutionAction[]): void {
    this.logger.blank();
    this.logger.subheader('Resolution Summary:');

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    const summaryData = [
      { key: 'Total Actions', value: results.length.toString(), status: undefined },
      { key: 'Successful', value: successful.toString(), status: 'success' as const },
      { key: 'Failed', value: failed.toString(), status: failed > 0 ? 'error' as const : 'success' as const }
    ];

    this.logger.table(summaryData);

    if (results.length > 0) {
      this.logger.blank();
      this.logger.subheader('Actions Performed:');

      results.forEach(action => {
        const icon = action.success ? '✅' : '❌';
        const color = action.success ? chalk.green : chalk.red;
        this.logger.info(`${icon} ${color(action.description)}`);
        
        if (action.details && action.type === 'suggest') {
          const suggestions = action.details.suggestions || [];
          if (suggestions.length > 0) {
            this.logger.indent(`💡 Suggested ports: ${suggestions.join(', ')}`);
          }
        }
      });
    }
  }

  // Batch resolution for multiple environments
  async batchResolveConflicts(
    environments: string[],
    strategy: string = 'suggest'
  ): Promise<{ [env: string]: AutoResolutionResults }> {
    const results: { [env: string]: AutoResolutionResults } = {};

    for (const env of environments) {
      this.logger.info(`Resolving conflicts for ${env} environment...`);
      results[env] = await this.autoResolveConflicts(env, strategy);
    }

    return results;
  }

  // Get available resolution strategies
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  // Add custom resolution strategy
  addStrategy(name: string, strategy: ResolutionStrategy): void {
    this.strategies.set(name, strategy);
  }
}
