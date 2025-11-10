#!/usr/bin/env node

/**
 * Truxe Port Monitor Entrypoint
 * 
 * Containerized port monitoring service for environment-specific
 * port range management and isolation validation.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import environment management components
import environmentManager from '../config/environment-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Port Monitor Service
 */
class PortMonitorService {
  constructor() {
    this.manager = environmentManager;
    this.server = null;
    this.port = process.env.MONITORING_PORT || 8080;
    this.isRunning = false;
    
    // Bind methods
    this.handleRequest = this.handleRequest.bind(this);
    this.shutdown = this.shutdown.bind(this);
    
    // Setup signal handlers
    process.on('SIGTERM', this.shutdown);
    process.on('SIGINT', this.shutdown);
    process.on('uncaughtException', this.handleError.bind(this));
    process.on('unhandledRejection', this.handleError.bind(this));
  }

  /**
   * Start the monitoring service
   */
  async start() {
    try {
      console.log('🚀 Starting Truxe Port Monitor Service...');
      
      // Wait for environment manager initialization
      await this.waitForManagerInitialization();
      
      // Start HTTP server
      this.server = http.createServer(this.handleRequest);
      
      this.server.listen(this.port, () => {
        console.log(`✅ Port Monitor Service running on port ${this.port}`);
        console.log(`📍 Environment: ${this.manager.portManager.currentEnvironment}`);
        this.isRunning = true;
      });
      
      // Start monitoring
      if (!this.manager.monitor.isMonitoring) {
        this.manager.monitor.startMonitoring();
        console.log('📊 Environment monitoring started');
      }
      
      // Setup event handlers
      this.setupEventHandlers();
      
      console.log('🔍 Port Monitor Service ready');
      
    } catch (error) {
      console.error(`❌ Failed to start Port Monitor Service: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Wait for environment manager initialization
   */
  async waitForManagerInitialization() {
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!this.manager.isInitialized && attempts < maxAttempts) {
      console.log(`Waiting for environment manager initialization... (${attempts + 1}/${maxAttempts})`);
      await this.sleep(1000);
      attempts++;
    }
    
    if (!this.manager.isInitialized) {
      throw new Error('Environment manager failed to initialize within timeout');
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Environment change events
    this.manager.on('environmentChanged', (data) => {
      console.log(`🔄 Environment changed: ${data.previous} → ${data.current}`);
    });
    
    // Alert events
    this.manager.on('alert', (alert) => {
      console.warn(`⚠️  Alert: ${alert.message}`);
    });
    
    // Critical events
    this.manager.on('critical', (alert) => {
      console.error(`🚨 CRITICAL: ${alert.message}`);
    });
  }

  /**
   * Handle HTTP requests
   */
  async handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);
    const pathname = url.pathname;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      switch (pathname) {
        case '/health':
          await this.handleHealthCheck(req, res);
          break;
        case '/status':
          await this.handleStatus(req, res);
          break;
        case '/metrics':
          await this.handleMetrics(req, res);
          break;
        case '/environment':
          await this.handleEnvironment(req, res);
          break;
        case '/conflicts':
          await this.handleConflicts(req, res);
          break;
        case '/validation':
          await this.handleValidation(req, res);
          break;
        case '/reports':
          await this.handleReports(req, res);
          break;
        case '/alerts':
          await this.handleAlerts(req, res);
          break;
        default:
          this.sendResponse(res, 404, { error: 'Not found' });
      }
    } catch (error) {
      console.error(`Request error: ${error.message}`);
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  /**
   * Handle health check
   */
  async handleHealthCheck(req, res) {
    try {
      const health = await this.manager.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      this.sendResponse(res, statusCode, {
        status: health.status,
        timestamp: health.timestamp,
        environment: health.environment,
        service: 'port-monitor',
        version: '1.0.0'
      });
    } catch (error) {
      this.sendResponse(res, 503, {
        status: 'error',
        error: error.message,
        service: 'port-monitor'
      });
    }
  }

  /**
   * Handle status request
   */
  async handleStatus(req, res) {
    const status = this.manager.getSystemStatus();
    this.sendResponse(res, 200, status);
  }

  /**
   * Handle metrics request
   */
  async handleMetrics(req, res) {
    const currentEnv = this.manager.portManager.currentEnvironment;
    const metrics = this.manager.monitor.getEnvironmentMetrics(currentEnv);
    
    this.sendResponse(res, 200, {
      environment: currentEnv,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle environment request
   */
  async handleEnvironment(req, res) {
    if (req.method === 'GET') {
      const config = this.manager.generateEnvironmentConfig();
      this.sendResponse(res, 200, config);
    } else if (req.method === 'POST') {
      // Handle environment switch
      const body = await this.getRequestBody(req);
      const { environment, force = false } = JSON.parse(body);
      
      try {
        const newEnv = await this.manager.switchEnvironment(environment, { force });
        this.sendResponse(res, 200, {
          success: true,
          environment: newEnv,
          message: `Switched to ${newEnv} environment`
        });
      } catch (error) {
        this.sendResponse(res, 400, {
          success: false,
          error: error.message
        });
      }
    } else {
      this.sendResponse(res, 405, { error: 'Method not allowed' });
    }
  }

  /**
   * Handle conflicts request
   */
  async handleConflicts(req, res) {
    const currentEnv = this.manager.portManager.currentEnvironment;
    const conflicts = this.manager.portManager.detectConflicts(currentEnv);
    
    this.sendResponse(res, 200, {
      environment: currentEnv,
      conflicts: conflicts,
      count: conflicts.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle validation request
   */
  async handleValidation(req, res) {
    const currentEnv = this.manager.portManager.currentEnvironment;
    
    // Port configuration validation
    const configIssues = this.manager.portManager.validateConfiguration(currentEnv);
    
    // Isolation validation
    const isolation = this.manager.isolationValidator.validateEnvironmentIsolation(currentEnv);
    
    this.sendResponse(res, 200, {
      environment: currentEnv,
      configuration: {
        issues: configIssues,
        count: configIssues.length
      },
      isolation: {
        status: isolation.status,
        violations: isolation.violations,
        warnings: isolation.warnings,
        count: isolation.violations.length
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle reports request
   */
  async handleReports(req, res) {
    const latestReport = this.manager.monitor.getLatestReport();
    
    this.sendResponse(res, 200, {
      latest_report: latestReport,
      reports_available: this.manager.monitor.reports.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle alerts request
   */
  async handleAlerts(req, res) {
    const recentAlerts = this.manager.monitor.getRecentAlerts();
    
    this.sendResponse(res, 200, {
      alerts: recentAlerts,
      count: recentAlerts.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get request body
   */
  async getRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error(`💥 Unhandled error: ${error.message}`);
    console.error(error.stack);
    
    // Don't exit on errors, just log them
    // The service should remain running
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Shutting down Port Monitor Service...');
    this.isRunning = false;
    
    try {
      // Stop monitoring
      if (this.manager.monitor.isMonitoring) {
        this.manager.monitor.stopMonitoring();
        console.log('📊 Monitoring stopped');
      }
      
      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        console.log('🌐 HTTP server closed');
      }
      
      // Cleanup environment manager
      await this.manager.shutdown();
      
      console.log('✅ Port Monitor Service shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error(`❌ Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the service
const service = new PortMonitorService();
service.start().catch(error => {
  console.error(`Failed to start service: ${error.message}`);
  process.exit(1);
});

export default PortMonitorService;
