import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const exec = promisify(require('child_process').exec);

export interface PortCheckResult {
  port: number;
  available: boolean;
  process?: string;
  pid?: number;
  details?: any;
}

export interface SystemStatus {
  environment: string;
  portRange: { start: number; end: number };
  totalServices: number;
  portUtilization: number;
  conflicts: number;
  overallStatus: string;
  services: ServiceStatus[];
  processes?: ProcessInfo[];
}

export interface ServiceStatus {
  name: string;
  port: number;
  available: boolean;
  process?: string;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  port: number;
  command?: string;
}

export interface PortSuggestion {
  port: number;
  reason?: string;
  score: number;
}

export interface PortRange {
  start: number;
  end: number;
  count: number;
}

export class PortManager {
  private configPath: string;
  private config: any;

  constructor() {
    this.configPath = this.findConfigPath();
    this.loadConfig();
  }

  private findConfigPath(): string {
    // Try to find the port configuration file
    const possiblePaths = [
      path.join(process.cwd(), 'config', 'ports.js'),
      path.join(process.cwd(), '..', 'config', 'ports.js'),
      path.join(process.cwd(), '..', '..', 'config', 'ports.js')
    ];

    for (const configPath of possiblePaths) {
      try {
        require.resolve(configPath);
        return configPath;
      } catch {
        continue;
      }
    }

    // Fallback to default configuration
    return '';
  }

  private async loadConfig(): Promise<void> {
    if (this.configPath) {
      try {
        // Dynamic import for ES modules
        const configModule = await import(this.configPath);
        this.config = configModule.default || configModule;
      } catch (error) {
        console.warn('Could not load port configuration, using defaults');
        this.config = this.getDefaultConfig();
      }
    } else {
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): any {
    return {
      environments: {
        development: {
          name: 'Development',
          range: { start: 21000, end: 21999 },
          services: {
            api: 21001,
            database: 21432,
            redis: 21379,
            mailhog_smtp: 21025,
            mailhog_web: 21825,
            docs: 21002,
            monitoring: 21003,
            grafana: 21004,
            prometheus: 21005
          }
        },
        staging: {
          name: 'Staging',
          range: { start: 22000, end: 22999 },
          services: {
            api: 22001,
            database: 22432,
            redis: 22379
          }
        },
        production: {
          name: 'Production',
          range: { start: 80, end: 65535 },
          services: {
            api: 3001,
            database: 5432,
            redis: 6379
          }
        }
      }
    };
  }

  async checkPorts(ports: number[], _environment: string = 'development'): Promise<PortCheckResult[]> {
    const results: PortCheckResult[] = [];

    for (const port of ports) {
      const result = await this.checkSinglePort(port);
      results.push(result);
    }

    return results;
  }

  private async checkSinglePort(port: number): Promise<PortCheckResult> {
    try {
      // Try multiple methods to check port availability
      const methods = [
        () => this.checkPortWithLsof(port),
        () => this.checkPortWithNetstat(port),
        () => this.checkPortWithSS(port),
        () => this.checkPortWithTelnet(port)
      ];

      for (const method of methods) {
        try {
          const result = await method();
          if (result) {
            return result;
          }
        } catch (error) {
          continue; // Try next method
        }
      }

      // If all methods fail, assume port is available
      return {
        port,
        available: true
      };

    } catch (error) {
      return {
        port,
        available: true, // Default to available if we can't determine
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkPortWithLsof(port: number): Promise<PortCheckResult | null> {
    try {
      const { stdout } = await exec(`lsof -i :${port} -t`);
      const pids = stdout.trim().split('\n').filter((pid: string) => pid);
      
      if (pids.length > 0) {
        const pid = parseInt(pids[0]);
        const processInfo = await this.getProcessInfo(pid);
        
        return {
          port,
          available: false,
          process: processInfo.name,
          pid: processInfo.pid,
          details: processInfo
        };
      }
      
      return { port, available: true };
    } catch (error) {
      return null; // Method not available or failed
    }
  }

  private async checkPortWithNetstat(port: number): Promise<PortCheckResult | null> {
    try {
      const { stdout } = await exec(`netstat -an | grep :${port}`);
      
      if (stdout.includes('LISTEN')) {
        return {
          port,
          available: false,
          process: 'Unknown (netstat)',
          details: { method: 'netstat' }
        };
      }
      
      return { port, available: true };
    } catch (error) {
      return null;
    }
  }

  private async checkPortWithSS(port: number): Promise<PortCheckResult | null> {
    try {
      const { stdout } = await exec(`ss -tuln | grep :${port}`);
      
      if (stdout.trim()) {
        return {
          port,
          available: false,
          process: 'Unknown (ss)',
          details: { method: 'ss' }
        };
      }
      
      return { port, available: true };
    } catch (error) {
      return null;
    }
  }

  private async checkPortWithTelnet(port: number): Promise<PortCheckResult | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ port, available: true });
      }, 1000);

      const telnet = spawn('telnet', ['localhost', port.toString()]);
      
      telnet.on('error', () => {
        clearTimeout(timeout);
        resolve({ port, available: true });
      });

      telnet.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({
            port,
            available: false,
            process: 'Unknown (telnet)',
            details: { method: 'telnet' }
          });
        } else {
          resolve({ port, available: true });
        }
      });

      // Kill telnet after timeout
      setTimeout(() => {
        telnet.kill();
      }, 1000);
    });
  }

  private async getProcessInfo(pid: number): Promise<ProcessInfo> {
    try {
      const { stdout } = await exec(`ps -p ${pid} -o comm=,args=`);
      const lines = stdout.trim().split('\n');
      const processLine = lines[0] || '';
      const [name, ...args] = processLine.split(/\s+/);
      
      return {
        name: name || 'Unknown',
        pid,
        port: 0, // Will be filled by caller
        command: args.join(' ')
      };
    } catch (error) {
      return {
        name: 'Unknown',
        pid,
        port: 0
      };
    }
  }

  async getSystemStatus(environment: string = 'development'): Promise<SystemStatus> {
    const envConfig = this.getEnvironmentConfig(environment);
    const services = Object.entries(envConfig.services);
    const ports = services.map(([, port]) => port as number);
    
    const portResults = await this.checkPorts(ports, environment);
    const serviceStatuses: ServiceStatus[] = services.map(([name, port]) => {
      const result = portResults.find(r => r.port === port);
      return {
        name,
        port: port as number,
        available: result?.available || false,
        process: result?.process
      };
    });

    const conflicts = serviceStatuses.filter(s => !s.available).length;
    const utilization = Math.round((services.length / (envConfig.range.end - envConfig.range.start + 1)) * 100);

    return {
      environment: envConfig.name,
      portRange: envConfig.range,
      totalServices: services.length,
      portUtilization: utilization,
      conflicts,
      overallStatus: conflicts === 0 ? 'healthy' : 'warning',
      services: serviceStatuses
    };
  }

  async suggestAlternativePorts(
    originalPort: number, 
    environment: string = 'development', 
    count: number = 5,
    serviceName?: string
  ): Promise<PortSuggestion[]> {
    const envConfig = this.getEnvironmentConfig(environment);
    const suggestions: PortSuggestion[] = [];
    
    // Strategy 1: Try ports near the original
    const nearbyPorts = this.generateNearbyPorts(originalPort, envConfig.range, 10);
    for (const port of nearbyPorts) {
      const result = await this.checkSinglePort(port);
      if (result.available) {
        suggestions.push({
          port,
          reason: `Near original port ${originalPort}`,
          score: 100 - Math.abs(port - originalPort)
        });
      }
    }

    // Strategy 2: Try service-specific ranges
    if (serviceName) {
      const serviceRangePorts = this.generateServiceRangePorts(serviceName, envConfig.range, 10);
      for (const port of serviceRangePorts) {
        if (suggestions.find(s => s.port === port)) continue;
        
        const result = await this.checkSinglePort(port);
        if (result.available) {
          suggestions.push({
            port,
            reason: `${serviceName} service range`,
            score: 90
          });
        }
      }
    }

    // Strategy 3: Try random ports in range
    const randomPorts = this.generateRandomPorts(envConfig.range, 20);
    for (const port of randomPorts) {
      if (suggestions.find(s => s.port === port)) continue;
      
      const result = await this.checkSinglePort(port);
      if (result.available) {
        suggestions.push({
          port,
          reason: 'Available in range',
          score: 50
        });
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  private generateNearbyPorts(originalPort: number, range: { start: number; end: number }, count: number): number[] {
    const ports: number[] = [];
    let offset = 1;
    
    while (ports.length < count && offset <= 100) {
      const lower = originalPort - offset;
      const upper = originalPort + offset;
      
      if (lower >= range.start && lower <= range.end) {
        ports.push(lower);
      }
      
      if (upper >= range.start && upper <= range.end) {
        ports.push(upper);
      }
      
      offset++;
    }
    
    return ports;
  }

  private generateServiceRangePorts(serviceName: string, range: { start: number; end: number }, count: number): number[] {
    // Define service-specific port ranges
    const serviceRanges: { [key: string]: { offset: number; size: number } } = {
      api: { offset: 0, size: 50 },
      database: { offset: 400, size: 50 },
      redis: { offset: 350, size: 50 },
      monitoring: { offset: 200, size: 100 },
      docs: { offset: 100, size: 50 }
    };
    
    const serviceRange = serviceRanges[serviceName] || { offset: 0, size: 100 };
    const startPort = range.start + serviceRange.offset;
    const endPort = Math.min(startPort + serviceRange.size, range.end);
    
    const ports: number[] = [];
    for (let port = startPort; port <= endPort && ports.length < count; port++) {
      ports.push(port);
    }
    
    return ports;
  }

  private generateRandomPorts(range: { start: number; end: number }, count: number): number[] {
    const ports: Set<number> = new Set();
    
    while (ports.size < count) {
      const port = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
      ports.add(port);
    }
    
    return Array.from(ports);
  }

  async getPortProcesses(ports: number[]): Promise<ProcessInfo[]> {
    const processes: ProcessInfo[] = [];
    
    for (const port of ports) {
      const result = await this.checkSinglePort(port);
      if (!result.available && result.pid) {
        processes.push({
          name: result.process || 'Unknown',
          pid: result.pid,
          port,
          command: result.details?.command
        });
      }
    }
    
    return processes;
  }

  async killPortProcesses(ports: number[], force: boolean = false): Promise<any[]> {
    const results: any[] = [];
    
    for (const port of ports) {
      try {
        const result = await this.checkSinglePort(port);
        
        if (!result.available && result.pid) {
          const signal = force ? 'SIGKILL' : 'SIGTERM';
          
          try {
            process.kill(result.pid, signal);
            
            // Wait a bit and check if process is still running
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              process.kill(result.pid, 0); // Check if process exists
              results.push({
                port,
                success: false,
                error: 'Process still running after kill attempt'
              });
            } catch {
              results.push({
                port,
                success: true,
                pid: result.pid
              });
            }
          } catch (error) {
            results.push({
              port,
              success: false,
              error: (error as Error).message
            });
          }
        } else {
          results.push({
            port,
            success: true,
            message: 'Port was already available'
          });
        }
      } catch (error) {
        results.push({
          port,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    return results;
  }

  async scanPortRange(startPort: number, endPort: number, consecutiveCount: number = 1): Promise<PortRange[]> {
    const availableRanges: PortRange[] = [];
    let currentRangeStart: number | null = null;
    let currentRangeLength = 0;
    
    for (let port = startPort; port <= endPort; port++) {
      const result = await this.checkSinglePort(port);
      
      if (result.available) {
        if (currentRangeStart === null) {
          currentRangeStart = port;
          currentRangeLength = 1;
        } else {
          currentRangeLength++;
        }
        
        // Check if we have enough consecutive ports
        if (currentRangeLength >= consecutiveCount) {
          const rangeEnd = currentRangeStart + currentRangeLength - 1;
          
          // Add or update the current range
          const existingRange = availableRanges.find(r => r.start === currentRangeStart);
          if (existingRange) {
            existingRange.end = rangeEnd;
            existingRange.count = currentRangeLength;
          } else {
            availableRanges.push({
              start: currentRangeStart,
              end: rangeEnd,
              count: currentRangeLength
            });
          }
        }
      } else {
        // Reset current range
        currentRangeStart = null;
        currentRangeLength = 0;
      }
    }
    
    // Filter ranges that meet the consecutive count requirement
    return availableRanges.filter(range => range.count >= consecutiveCount);
  }

  async getAllConfiguredPorts(environment: string = 'development'): Promise<number[]> {
    const envConfig = this.getEnvironmentConfig(environment);
    return Object.values(envConfig.services) as number[];
  }

  async getEnvironmentPorts(environment: string = 'development'): Promise<number[]> {
    return this.getAllConfiguredPorts(environment);
  }

  async createConfigBackup(environment: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(process.cwd(), `port-config-backup-${environment}-${timestamp}.json`);
    
    const envConfig = this.getEnvironmentConfig(environment);
    await fs.writeFile(backupPath, JSON.stringify(envConfig, null, 2));
    
    return backupPath;
  }

  async resetConfiguration(environment: string): Promise<void> {
    // This would reset to default configuration
    // In a real implementation, this might update the config file
    const defaultConfig = this.getDefaultConfig();
    const envConfig = defaultConfig.environments[environment];
    
    if (envConfig) {
      // Update the current config
      this.config.environments[environment] = envConfig;
    }
  }

  private getEnvironmentConfig(environment: string): any {
    const envConfig = this.config?.environments?.[environment];
    
    if (!envConfig) {
      throw new Error(`Environment '${environment}' not found in configuration`);
    }
    
    return envConfig;
  }
}
