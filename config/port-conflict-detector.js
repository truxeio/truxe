/**
 * Truxe Advanced Port Conflict Detection and Resolution System
 * 
 * Comprehensive cross-platform port conflict detection with intelligent resolution suggestions.
 * Provides detailed process identification, actionable error messages, and automatic fallback options.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cross-Platform Process Information
 */
class ProcessInfo {
  constructor(pid, name, command, port, protocol = 'tcp') {
    this.pid = pid;
    this.name = name;
    this.command = command;
    this.port = port;
    this.protocol = protocol;
    this.platform = os.platform();
    this.timestamp = new Date().toISOString();
  }

  /**
   * Generate kill command for this process
   */
  getKillCommand() {
    const isWindows = this.platform === 'win32';
    return isWindows 
      ? `taskkill /PID ${this.pid} /F`
      : `kill -9 ${this.pid}`;
  }

  /**
   * Generate graceful shutdown command
   */
  getGracefulShutdownCommand() {
    const isWindows = this.platform === 'win32';
    return isWindows 
      ? `taskkill /PID ${this.pid}`
      : `kill -15 ${this.pid}`;
  }

  /**
   * Check if process is still running
   */
  async isRunning() {
    try {
      const isWindows = this.platform === 'win32';
      const command = isWindows 
        ? `tasklist /FI "PID eq ${this.pid}" /NH`
        : `ps -p ${this.pid} -o pid=`;
      
      const result = execSync(command, { 
        encoding: 'utf8', 
        timeout: 3000,
        stdio: 'pipe'
      });
      
      return result.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed process information
   */
  async getDetailedInfo() {
    try {
      const isWindows = this.platform === 'win32';
      let command, result;

      if (isWindows) {
        command = `wmic process where "ProcessId=${this.pid}" get Name,CommandLine,CreationDate,WorkingSetSize /format:csv`;
      } else {
        command = `ps -p ${this.pid} -o pid,ppid,user,comm,args,etime,pcpu,pmem --no-headers`;
      }

      result = execSync(command, { 
        encoding: 'utf8', 
        timeout: 5000 
      });

      return {
        pid: this.pid,
        raw_info: result.trim(),
        platform: this.platform,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        pid: this.pid,
        error: error.message,
        platform: this.platform
      };
    }
  }
}

/**
 * Advanced Port Conflict Detector
 */
export class AdvancedPortConflictDetector {
  constructor() {
    this.platform = os.platform();
    this.detectionMethods = new Map();
    this.processCache = new Map();
    this.conflictHistory = [];
    this.setupDetectionMethods();
  }

  /**
   * Setup platform-specific detection methods
   */
  setupDetectionMethods() {
    // Cross-platform methods
    this.detectionMethods.set('socket_test', this.detectWithSocketTest.bind(this));
    
    // Platform-specific methods
    if (this.platform === 'win32') {
      this.detectionMethods.set('netstat_windows', this.detectWithNetstatWindows.bind(this));
      this.detectionMethods.set('powershell', this.detectWithPowerShell.bind(this));
    } else {
      this.detectionMethods.set('lsof', this.detectWithLsof.bind(this));
      this.detectionMethods.set('netstat_unix', this.detectWithNetstatUnix.bind(this));
      this.detectionMethods.set('ss', this.detectWithSS.bind(this));
    }
    
    // Docker detection (cross-platform)
    this.detectionMethods.set('docker', this.detectDockerPorts.bind(this));
  }

  /**
   * Socket-based port availability test (most reliable)
   */
  async detectWithSocketTest(port, host = 'localhost') {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      const timeout = setTimeout(() => {
        server.close();
        resolve({
          method: 'socket_test',
          port,
          host,
          available: false,
          error: 'Connection timeout'
        });
      }, 3000);

      server.listen(port, host, () => {
        clearTimeout(timeout);
        server.close(() => {
          resolve({
            method: 'socket_test',
            port,
            host,
            available: true
          });
        });
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        server.close();
        resolve({
          method: 'socket_test',
          port,
          host,
          available: false,
          error: error.code,
          in_use: error.code === 'EADDRINUSE'
        });
      });
    });
  }

  /**
   * lsof-based detection (Unix/Linux/macOS)
   */
  async detectWithLsof(port) {
    try {
      const result = execSync(`lsof -ti:${port}`, { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        const pids = result.trim().split('\n').map(pid => parseInt(pid));
        const processes = [];
        
        for (const pid of pids) {
          try {
            const processInfo = execSync(`lsof -p ${pid} -a -i:${port} -F pcn`, {
              encoding: 'utf8',
              timeout: 3000
            });
            
            const lines = processInfo.split('\n');
            let processData = { pid };
            
            for (const line of lines) {
              if (line.startsWith('p')) processData.pid = parseInt(line.substring(1));
              if (line.startsWith('c')) processData.command = line.substring(1);
              if (line.startsWith('n')) processData.connection = line.substring(1);
            }
            
            // Get additional process details
            // Use cross-platform compatible ps command
            let psCommand;
            if (process.platform === 'darwin') {
              psCommand = `ps -p ${pid} -o pid,ppid,user,comm,args`;
            } else if (process.platform === 'linux') {
              psCommand = `ps -p ${pid} -o pid,ppid,user,comm,args --no-headers`;
            } else {
              psCommand = `ps -p ${pid}`;
            }
            
            const psInfo = execSync(psCommand, {
              encoding: 'utf8',
              timeout: 2000
            }).trim();
            
            processes.push(new ProcessInfo(
              pid,
              processData.command || 'unknown',
              psInfo,
              port
            ));
          } catch (error) {
            processes.push(new ProcessInfo(
              pid,
              'process_ended',
              'Process information unavailable',
              port
            ));
          }
        }
        
        return {
          method: 'lsof',
          port,
          available: false,
          in_use: true,
          processes,
          process_count: processes.length
        };
      }
      
      return { 
        method: 'lsof', 
        port, 
        available: true, 
        in_use: false 
      };
    } catch (error) {
      return { 
        method: 'lsof', 
        port, 
        available: true, 
        in_use: false, 
        error: error.message 
      };
    }
  }

  /**
   * netstat-based detection (Unix/Linux/macOS)
   */
  async detectWithNetstatUnix(port) {
    try {
      // Use cross-platform compatible netstat command
      let netstatCommand;
      if (process.platform === 'darwin') {
        netstatCommand = `netstat -an | grep :${port}`;
      } else {
        netstatCommand = `netstat -tulpn 2>/dev/null | grep :${port}`;
      }
      
      const result = execSync(netstatCommand, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const processes = [];
      if (result.trim()) {
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 7) {
            const pidInfo = parts[6];
            if (pidInfo && pidInfo !== '-') {
              const [pid, name] = pidInfo.split('/');
              if (pid && !isNaN(parseInt(pid))) {
                processes.push(new ProcessInfo(
                  parseInt(pid),
                  name || 'unknown',
                  line,
                  port,
                  parts[0].toLowerCase()
                ));
              }
            }
          }
        }
      }
      
      return {
        method: 'netstat_unix',
        port,
        available: processes.length === 0,
        in_use: processes.length > 0,
        processes,
        raw_output: result.trim()
      };
    } catch (error) {
      return { 
        method: 'netstat_unix', 
        port, 
        available: true, 
        in_use: false 
      };
    }
  }

  /**
   * ss (socket statistics) detection (Linux)
   */
  async detectWithSS(port) {
    try {
      const result = execSync(`ss -tulpn | grep :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const processes = [];
      if (result.trim()) {
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
          const processMatch = line.match(/users:\(\("([^"]+)",pid=(\d+),fd=\d+\)\)/);
          if (processMatch) {
            const [, name, pid] = processMatch;
            processes.push(new ProcessInfo(
              parseInt(pid),
              name,
              line,
              port
            ));
          }
        }
      }
      
      return {
        method: 'ss',
        port,
        available: processes.length === 0,
        in_use: processes.length > 0,
        processes,
        raw_output: result.trim()
      };
    } catch (error) {
      return { 
        method: 'ss', 
        port, 
        available: true, 
        in_use: false 
      };
    }
  }

  /**
   * netstat-based detection (Windows)
   */
  async detectWithNetstatWindows(port) {
    try {
      const result = execSync(`netstat -ano | findstr :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const processes = [];
      if (result.trim()) {
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parseInt(parts[4]);
            if (!isNaN(pid)) {
              try {
                const processName = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, {
                  encoding: 'utf8',
                  timeout: 3000
                });
                
                const nameMatch = processName.match(/"([^"]+)"/);
                const name = nameMatch ? nameMatch[1] : 'unknown';
                
                processes.push(new ProcessInfo(
                  pid,
                  name,
                  line,
                  port,
                  parts[0].toLowerCase()
                ));
              } catch (error) {
                processes.push(new ProcessInfo(
                  pid,
                  'unknown',
                  line,
                  port
                ));
              }
            }
          }
        }
      }
      
      return {
        method: 'netstat_windows',
        port,
        available: processes.length === 0,
        in_use: processes.length > 0,
        processes,
        raw_output: result.trim()
      };
    } catch (error) {
      return { 
        method: 'netstat_windows', 
        port, 
        available: true, 
        in_use: false 
      };
    }
  }

  /**
   * PowerShell-based detection (Windows)
   */
  async detectWithPowerShell(port) {
    try {
      const command = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess | ConvertTo-Json`;
      const result = execSync(`powershell -Command "${command}"`, { 
        encoding: 'utf8', 
        timeout: 10000 
      });
      
      const processes = [];
      if (result.trim() && result.trim() !== '') {
        try {
          const connections = JSON.parse(result);
          const connectionArray = Array.isArray(connections) ? connections : [connections];
          
          for (const conn of connectionArray) {
            if (conn.OwningProcess) {
              try {
                const processInfo = execSync(`wmic process where "ProcessId=${conn.OwningProcess}" get Name,CommandLine /format:csv`, {
                  encoding: 'utf8',
                  timeout: 3000
                });
                
                const lines = processInfo.split('\n').filter(line => line.includes(','));
                if (lines.length > 0) {
                  const parts = lines[0].split(',');
                  const name = parts[2] || 'unknown';
                  
                  processes.push(new ProcessInfo(
                    conn.OwningProcess,
                    name,
                    parts[1] || 'Command unavailable',
                    port
                  ));
                }
              } catch (error) {
                processes.push(new ProcessInfo(
                  conn.OwningProcess,
                  'unknown',
                  'Process information unavailable',
                  port
                ));
              }
            }
          }
        } catch (parseError) {
          // Handle single connection case or parsing errors
        }
      }
      
      return {
        method: 'powershell',
        port,
        available: processes.length === 0,
        in_use: processes.length > 0,
        processes
      };
    } catch (error) {
      return { 
        method: 'powershell', 
        port, 
        available: true, 
        in_use: false,
        error: error.message 
      };
    }
  }

  /**
   * Docker container port detection
   */
  async detectDockerPorts(port) {
    try {
      const result = execSync(`docker ps --format "table {{.Names}}\\t{{.Ports}}" | grep :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const containers = [];
      if (result.trim()) {
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            containers.push({
              name: parts[0],
              ports: parts[1],
              port_mapping: parts[1].includes(`:${port}`)
            });
          }
        }
      }
      
      return {
        method: 'docker',
        port,
        available: containers.length === 0,
        in_use: containers.length > 0,
        containers,
        container_count: containers.length
      };
    } catch (error) {
      return { 
        method: 'docker', 
        port, 
        available: true, 
        in_use: false,
        docker_available: false
      };
    }
  }

  /**
   * Comprehensive port conflict detection using multiple methods
   */
  async detectPortConflicts(ports, options = {}) {
    const {
      methods = this.getDefaultMethods(),
      includeProcessDetails = true,
      timeout = 15000,
      parallel = true
    } = options;

    const portsToCheck = Array.isArray(ports) ? ports : [ports];
    const results = {
      timestamp: new Date().toISOString(),
      platform: this.platform,
      methods_used: methods,
      total_ports_checked: portsToCheck.length,
      conflicts_detected: 0,
      ports: {},
      summary: {
        available_ports: 0,
        conflicted_ports: 0,
        error_count: 0,
        process_count: 0
      }
    };

    const detectionPromises = [];

    for (const port of portsToCheck) {
      const portResult = {
        port,
        available: true,
        conflicts: [],
        processes: [],
        containers: [],
        detection_results: [],
        resolution_suggestions: []
      };

      const portDetectionPromises = methods.map(async (methodName) => {
        const method = this.detectionMethods.get(methodName);
        if (!method) {
          return {
            method: methodName,
            error: 'Method not available on this platform',
            port
          };
        }

        try {
          const detection = await Promise.race([
            method(port),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Detection timeout')), timeout / methods.length)
            )
          ]);

          portResult.detection_results.push(detection);

          if (detection.in_use) {
            portResult.available = false;
            
            if (detection.processes) {
              portResult.processes.push(...detection.processes);
            }
            
            if (detection.containers) {
              portResult.containers.push(...detection.containers);
            }

            portResult.conflicts.push({
              method: methodName,
              type: detection.containers ? 'docker_container' : 'system_process',
              details: detection
            });
          }

          return detection;
        } catch (error) {
          const errorResult = {
            method: methodName,
            port,
            error: error.message,
            available: null
          };
          
          portResult.detection_results.push(errorResult);
          results.summary.error_count++;
          
          return errorResult;
        }
      });

      if (parallel) {
        detectionPromises.push(
          Promise.all(portDetectionPromises).then(() => {
            this.generateResolutionSuggestions(portResult);
            results.ports[port] = portResult;
            
            if (!portResult.available) {
              results.conflicts_detected++;
              results.summary.conflicted_ports++;
            } else {
              results.summary.available_ports++;
            }
            
            results.summary.process_count += portResult.processes.length;
          })
        );
      } else {
        for (const promise of portDetectionPromises) {
          await promise;
        }
        
        this.generateResolutionSuggestions(portResult);
        results.ports[port] = portResult;
        
        if (!portResult.available) {
          results.conflicts_detected++;
          results.summary.conflicted_ports++;
        } else {
          results.summary.available_ports++;
        }
        
        results.summary.process_count += portResult.processes.length;
      }
    }

    if (parallel) {
      await Promise.all(detectionPromises);
    }

    // Add to conflict history
    this.conflictHistory.push({
      timestamp: results.timestamp,
      ports_checked: portsToCheck,
      conflicts_found: results.conflicts_detected
    });

    return results;
  }

  /**
   * Generate resolution suggestions for port conflicts
   */
  generateResolutionSuggestions(portResult) {
    const suggestions = [];

    if (!portResult.available) {
      // Process-based suggestions
      if (portResult.processes.length > 0) {
        for (const process of portResult.processes) {
          suggestions.push({
            type: 'kill_process',
            priority: 'high',
            description: `Stop process ${process.name} (PID: ${process.pid})`,
            commands: {
              graceful: process.getGracefulShutdownCommand(),
              force: process.getKillCommand()
            },
            risk_level: this.assessProcessRiskLevel(process),
            process_info: process
          });
        }
      }

      // Container-based suggestions
      if (portResult.containers.length > 0) {
        for (const container of portResult.containers) {
          suggestions.push({
            type: 'stop_container',
            priority: 'medium',
            description: `Stop Docker container ${container.name}`,
            commands: {
              stop: `docker stop ${container.name}`,
              remove: `docker rm ${container.name}`,
              restart_with_different_port: `docker run -p <new_port>:${portResult.port} ${container.name}`
            },
            risk_level: 'low',
            container_info: container
          });
        }
      }

      // Alternative port suggestions
      suggestions.push({
        type: 'use_alternative_port',
        priority: 'low',
        description: 'Use an alternative port',
        alternative_ports: this.suggestAlternativePorts(portResult.port),
        risk_level: 'none'
      });

      // Service-specific suggestions
      suggestions.push({
        type: 'modify_service_config',
        priority: 'medium',
        description: 'Modify service configuration to use a different port',
        risk_level: 'low'
      });
    }

    portResult.resolution_suggestions = suggestions;
  }

  /**
   * Assess risk level of killing a process
   */
  assessProcessRiskLevel(process) {
    const lowRiskProcesses = ['node', 'npm', 'yarn', 'webpack', 'vite', 'next'];
    const mediumRiskProcesses = ['apache', 'nginx', 'httpd', 'postgres', 'mysql', 'redis'];
    const highRiskProcesses = ['systemd', 'kernel', 'init', 'launchd', 'svchost'];

    const processName = process.name.toLowerCase();

    if (highRiskProcesses.some(name => processName.includes(name))) {
      return 'critical';
    } else if (mediumRiskProcesses.some(name => processName.includes(name))) {
      return 'medium';
    } else if (lowRiskProcesses.some(name => processName.includes(name))) {
      return 'low';
    }

    return 'medium'; // Default to medium risk
  }

  /**
   * Suggest alternative ports
   */
  suggestAlternativePorts(originalPort, count = 5) {
    const alternatives = [];
    let port = originalPort + 1;
    
    while (alternatives.length < count && port < 65535) {
      alternatives.push(port);
      port++;
    }

    return alternatives;
  }

  /**
   * Get default detection methods for current platform
   */
  getDefaultMethods() {
    const common = ['socket_test'];
    
    if (this.platform === 'win32') {
      return [...common, 'netstat_windows', 'powershell', 'docker'];
    } else {
      return [...common, 'lsof', 'netstat_unix', 'docker'];
    }
  }

  /**
   * Clear process cache
   */
  clearCache() {
    this.processCache.clear();
  }

  /**
   * Get conflict history
   */
  getConflictHistory() {
    return this.conflictHistory;
  }

  /**
   * Export conflict report
   */
  async exportConflictReport(results, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `port-conflict-report-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(results);
      await fs.writeFile(filepath, csv);
    }

    return filepath;
  }

  /**
   * Convert results to CSV format
   */
  convertToCSV(results) {
    const headers = ['Port', 'Available', 'Conflicts', 'Processes', 'Containers', 'Resolution'];
    const rows = [headers.join(',')];

    for (const [port, result] of Object.entries(results.ports)) {
      const row = [
        port,
        result.available,
        result.conflicts.length,
        result.processes.length,
        result.containers.length,
        result.resolution_suggestions.length
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Export singleton instance
export const portConflictDetector = new AdvancedPortConflictDetector();
export default portConflictDetector;
