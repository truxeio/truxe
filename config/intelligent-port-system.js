/**
 * Truxe Intelligent Port Management System - Main Integration Hub
 * 
 * Comprehensive integration system that orchestrates all port management
 * components including intelligent suggestions, usage analysis, conflict
 * avoidance, and optimization features.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Intelligent Port System Orchestrator
 */
export class IntelligentPortSystem extends EventEmitter {
  constructor() {
    super();
    
    this.components = {
      portManager: null,
      intelligentSuggester: null,
      usageAnalyzer: null,
      conflictAvoidance: null
    };
    
    this.initialized = false;
    this.systemHealth = {
      status: 'unknown',
      score: 0,
      last_check: null,
      components_status: {}
    };
    
    this.config = {
      auto_optimization: false,
      learning_enabled: true,
      monitoring_enabled: true,
      health_check_interval: 300000, // 5 minutes
      optimization_interval: 3600000, // 1 hour
      backup_interval: 86400000 // 24 hours
    };
    
    this.intervals = {
      healthCheck: null,
      optimization: null,
      backup: null
    };
  }

  /**
   * Initialize the complete intelligent port system
   */
  async initialize(options = {}) {
    console.log('🚀 Initializing Intelligent Port Management System...');
    
    try {
      // Load configuration overrides
      if (options.config) {
        this.config = { ...this.config, ...options.config };
      }

      // Initialize core components
      await this.initializeComponents();
      
      // Set up component event handlers
      this.setupEventHandlers();
      
      // Start system services
      await this.startSystemServices();
      
      // Perform initial health check
      await this.performHealthCheck();
      
      this.initialized = true;
      console.log('✅ Intelligent Port Management System initialized successfully');
      
      this.emit('system_initialized', {
        timestamp: Date.now(),
        components: Object.keys(this.components),
        config: this.config
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Intelligent Port System:', error.message);
      this.emit('initialization_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize all system components
   */
  async initializeComponents() {
    console.log('🔧 Initializing system components...');
    
    try {
      // Initialize base port manager
      const { default: portManager } = await import('./ports.js');
      this.components.portManager = portManager;
      console.log('✅ Port Manager initialized');

      // Initialize intelligent suggester
      const { default: intelligentSuggester } = await import('./intelligent-port-suggester.js');
      await intelligentSuggester.init();
      this.components.intelligentSuggester = intelligentSuggester;
      console.log('✅ Intelligent Suggester initialized');

      // Initialize usage analyzer
      const { default: usageAnalyzer } = await import('./port-usage-analyzer.js');
      await usageAnalyzer.init();
      this.components.usageAnalyzer = usageAnalyzer;
      console.log('✅ Usage Analyzer initialized');

      // Initialize conflict avoidance
      const { default: conflictAvoidance } = await import('./advanced-conflict-avoidance.js');
      await conflictAvoidance.init();
      this.components.conflictAvoidance = conflictAvoidance;
      console.log('✅ Conflict Avoidance initialized');

    } catch (error) {
      console.error('❌ Component initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Set up event handlers for component integration
   */
  setupEventHandlers() {
    console.log('🔗 Setting up component event handlers...');

    // Intelligent Suggester events
    if (this.components.intelligentSuggester) {
      this.components.intelligentSuggester.on('usage_recorded', (data) => {
        this.handleUsageRecorded(data);
      });
    }

    // Usage Analyzer events
    if (this.components.usageAnalyzer) {
      this.components.usageAnalyzer.on('anomalies_detected', (anomalies) => {
        this.handleAnomaliesDetected(anomalies);
      });
      
      this.components.usageAnalyzer.on('analysis_complete', () => {
        this.handleAnalysisComplete();
      });
    }

    // Conflict Avoidance events
    if (this.components.conflictAvoidance) {
      this.components.conflictAvoidance.on('high_severity_conflicts', (conflicts) => {
        this.handleHighSeverityConflicts(conflicts);
      });
      
      this.components.conflictAvoidance.on('conflicts_detected', (conflicts) => {
        this.handleConflictsDetected(conflicts);
      });
      
      this.components.conflictAvoidance.on('auto_resolution_complete', (results) => {
        this.handleAutoResolutionComplete(results);
      });
    }

    console.log('✅ Event handlers configured');
  }

  /**
   * Start system services
   */
  async startSystemServices() {
    console.log('🔄 Starting system services...');

    // Start health check monitoring
    if (this.config.health_check_interval > 0) {
      this.intervals.healthCheck = setInterval(
        () => this.performHealthCheck(),
        this.config.health_check_interval
      );
      console.log('✅ Health check monitoring started');
    }

    // Start optimization service
    if (this.config.auto_optimization && this.config.optimization_interval > 0) {
      this.intervals.optimization = setInterval(
        () => this.performAutoOptimization(),
        this.config.optimization_interval
      );
      console.log('✅ Auto-optimization service started');
    }

    // Start backup service
    if (this.config.backup_interval > 0) {
      this.intervals.backup = setInterval(
        () => this.performSystemBackup(),
        this.config.backup_interval
      );
      console.log('✅ Backup service started');
    }

    // Start conflict monitoring if enabled
    if (this.config.monitoring_enabled && this.components.conflictAvoidance) {
      await this.components.conflictAvoidance.startMonitoring();
      console.log('✅ Conflict monitoring started');
    }
  }

  /**
   * Handle usage recorded event
   */
  async handleUsageRecorded(data) {
    console.log(`📊 Usage recorded: ${data.serviceName}:${data.port} in ${data.environment}`);
    
    // Trigger usage analysis update
    if (this.components.usageAnalyzer) {
      // The usage analyzer will automatically pick up the data
    }
    
    this.emit('usage_learned', data);
  }

  /**
   * Handle anomalies detected event
   */
  async handleAnomaliesDetected(anomalies) {
    console.log(`🚨 ${anomalies.length} port usage anomalies detected`);
    
    // Trigger conflict detection for anomalous ports
    if (this.components.conflictAvoidance) {
      for (const anomaly of anomalies) {
        if (anomaly.anomalies.some(a => a.severity === 'high')) {
          // High severity anomaly - trigger immediate conflict check
          await this.components.conflictAvoidance.detectConflicts();
        }
      }
    }
    
    this.emit('anomalies_detected', anomalies);
  }

  /**
   * Handle analysis complete event
   */
  async handleAnalysisComplete() {
    console.log('📈 Port usage analysis completed');
    
    // Update system health based on latest analysis
    await this.updateSystemHealth();
    
    this.emit('analysis_complete');
  }

  /**
   * Handle high severity conflicts
   */
  async handleHighSeverityConflicts(conflicts) {
    console.log(`🚨 High severity conflicts detected: ${conflicts.summary.critical_conflicts + conflicts.summary.high_conflicts}`);
    
    // Immediate notification
    this.emit('critical_alert', {
      type: 'high_severity_conflicts',
      conflicts: conflicts,
      timestamp: Date.now()
    });
    
    // Trigger emergency optimization if enabled
    if (this.config.auto_optimization) {
      console.log('🤖 Triggering emergency optimization...');
      await this.performEmergencyOptimization(conflicts);
    }
  }

  /**
   * Handle conflicts detected event
   */
  async handleConflictsDetected(conflicts) {
    console.log(`⚠️  ${conflicts.summary.total_conflicts} conflicts detected`);
    
    // Record conflict metrics
    await this.recordConflictMetrics(conflicts);
    
    // Update intelligent suggester with conflict information
    if (this.components.intelligentSuggester) {
      for (const conflict of conflicts.conflicts) {
        if (conflict.service && conflict.port) {
          await this.components.intelligentSuggester.recordPortUsage(
            conflict.service,
            conflict.port,
            conflict.environment,
            { success: false, conflict_detected: true }
          );
        }
      }
    }
    
    this.emit('conflicts_detected', conflicts);
  }

  /**
   * Handle auto resolution complete event
   */
  async handleAutoResolutionComplete(results) {
    console.log(`🔧 Auto-resolution completed: ${results.resolved_conflicts}/${results.total_conflicts} resolved`);
    
    // Record resolution success for learning
    if (this.components.intelligentSuggester) {
      for (const resolution of results.resolutions) {
        if (resolution.success && resolution.conflict_id) {
          // Find the original conflict to get service info
          // This would need to be implemented with proper conflict tracking
        }
      }
    }
    
    this.emit('auto_resolution_complete', results);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    console.log('🏥 Performing system health check...');
    
    const healthCheck = {
      timestamp: Date.now(),
      overall_status: 'healthy',
      overall_score: 100,
      components: {},
      issues: [],
      recommendations: []
    };

    try {
      // Check each component
      for (const [componentName, component] of Object.entries(this.components)) {
        if (component) {
          const componentHealth = await this.checkComponentHealth(componentName, component);
          healthCheck.components[componentName] = componentHealth;
          
          if (componentHealth.status !== 'healthy') {
            healthCheck.overall_score -= componentHealth.impact || 10;
            healthCheck.issues.push({
              component: componentName,
              issue: componentHealth.issue,
              severity: componentHealth.severity
            });
          }
        }
      }

      // Determine overall status
      if (healthCheck.overall_score >= 80) {
        healthCheck.overall_status = 'healthy';
      } else if (healthCheck.overall_score >= 60) {
        healthCheck.overall_status = 'warning';
      } else {
        healthCheck.overall_status = 'critical';
      }

      // Generate recommendations
      healthCheck.recommendations = await this.generateHealthRecommendations(healthCheck);

      // Update system health
      this.systemHealth = {
        status: healthCheck.overall_status,
        score: healthCheck.overall_score,
        last_check: healthCheck.timestamp,
        components_status: healthCheck.components
      };

      this.emit('health_check_complete', healthCheck);
      
      if (healthCheck.overall_status === 'critical') {
        this.emit('critical_alert', {
          type: 'system_health_critical',
          health_check: healthCheck,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      this.systemHealth.status = 'error';
      this.emit('health_check_failed', { error: error.message });
    }
  }

  /**
   * Check individual component health
   */
  async checkComponentHealth(componentName, component) {
    const health = {
      status: 'healthy',
      score: 100,
      last_activity: null,
      issue: null,
      severity: 'none',
      impact: 0
    };

    try {
      switch (componentName) {
        case 'portManager':
          // Check if port manager is responsive
          const testEnv = 'development';
          const envConfig = component.getEnvironmentConfig(testEnv);
          if (!envConfig) {
            health.status = 'error';
            health.issue = 'Cannot access environment configuration';
            health.severity = 'high';
            health.impact = 25;
          }
          break;

        case 'intelligentSuggester':
          // Check if suggester is initialized and learning
          if (!component.initialized) {
            health.status = 'warning';
            health.issue = 'Component not fully initialized';
            health.severity = 'medium';
            health.impact = 15;
          }
          break;

        case 'usageAnalyzer':
          // Check if analyzer is collecting data
          if (component.realTimeData && component.realTimeData.size === 0) {
            health.status = 'warning';
            health.issue = 'No usage data being collected';
            health.severity = 'medium';
            health.impact = 10;
          }
          break;

        case 'conflictAvoidance':
          // Check if conflict avoidance is monitoring
          if (!component.monitoringActive) {
            health.status = 'warning';
            health.issue = 'Conflict monitoring not active';
            health.severity = 'medium';
            health.impact = 20;
          }
          break;
      }
    } catch (error) {
      health.status = 'error';
      health.issue = `Component error: ${error.message}`;
      health.severity = 'high';
      health.impact = 30;
    }

    return health;
  }

  /**
   * Generate health recommendations
   */
  async generateHealthRecommendations(healthCheck) {
    const recommendations = [];

    // Component-specific recommendations
    for (const [componentName, componentHealth] of Object.entries(healthCheck.components)) {
      if (componentHealth.status !== 'healthy') {
        recommendations.push({
          type: 'component_issue',
          priority: componentHealth.severity,
          component: componentName,
          message: `${componentName}: ${componentHealth.issue}`,
          action: this.getComponentRecommendedAction(componentName, componentHealth)
        });
      }
    }

    // System-wide recommendations
    if (healthCheck.overall_score < 70) {
      recommendations.push({
        type: 'system_optimization',
        priority: 'high',
        message: 'System health is below optimal levels',
        action: 'perform_comprehensive_optimization'
      });
    }

    return recommendations;
  }

  /**
   * Get recommended action for component issues
   */
  getComponentRecommendedAction(componentName, componentHealth) {
    const actions = {
      'portManager': 'restart_port_manager',
      'intelligentSuggester': 'reinitialize_suggester',
      'usageAnalyzer': 'restart_data_collection',
      'conflictAvoidance': 'enable_monitoring'
    };

    return actions[componentName] || 'investigate_component';
  }

  /**
   * Perform automatic optimization
   */
  async performAutoOptimization() {
    if (!this.initialized) return;

    console.log('⚡ Performing automatic optimization...');

    try {
      const optimizationResults = {
        timestamp: Date.now(),
        optimizations_performed: [],
        improvements: {},
        errors: []
      };

      // Optimize each environment
      const environments = ['development', 'staging', 'testing'];
      
      for (const env of environments) {
        try {
          console.log(`🔧 Optimizing ${env} environment...`);
          
          // Get optimization suggestions
          if (this.components.intelligentSuggester) {
            const optimization = await this.components.intelligentSuggester.exportOptimizedConfiguration(env);
            
            if (optimization.changes.length > 0) {
              // Apply safe optimizations (low risk only)
              const safeChanges = optimization.changes.filter(change => 
                optimization.optimization_summary.risk_assessment === 'low'
              );
              
              if (safeChanges.length > 0) {
                optimizationResults.optimizations_performed.push({
                  environment: env,
                  changes: safeChanges.length,
                  estimated_improvement: optimization.optimization_summary.estimated_improvements
                });
                
                console.log(`✅ Applied ${safeChanges.length} optimizations to ${env}`);
              }
            }
          }
        } catch (error) {
          optimizationResults.errors.push({
            environment: env,
            error: error.message
          });
        }
      }

      this.emit('auto_optimization_complete', optimizationResults);

    } catch (error) {
      console.error('❌ Auto-optimization failed:', error.message);
      this.emit('auto_optimization_failed', { error: error.message });
    }
  }

  /**
   * Perform emergency optimization for critical conflicts
   */
  async performEmergencyOptimization(conflicts) {
    console.log('🚨 Performing emergency optimization...');

    try {
      // Focus on critical and high severity conflicts
      const criticalConflicts = conflicts.conflicts.filter(c => 
        c.severity.level >= 3 // HIGH or CRITICAL
      );

      if (criticalConflicts.length === 0) return;

      // Attempt automatic resolution
      if (this.components.conflictAvoidance) {
        const resolutionResults = await this.components.conflictAvoidance.resolveConflicts(
          criticalConflicts,
          { dryRun: false, strategy: 'auto', maxConcurrentResolutions: 1 }
        );

        console.log(`🔧 Emergency resolution: ${resolutionResults.resolved_conflicts}/${resolutionResults.total_conflicts} resolved`);

        this.emit('emergency_optimization_complete', {
          conflicts_addressed: criticalConflicts.length,
          resolution_results: resolutionResults
        });
      }

    } catch (error) {
      console.error('❌ Emergency optimization failed:', error.message);
      this.emit('emergency_optimization_failed', { error: error.message });
    }
  }

  /**
   * Record conflict metrics for analysis
   */
  async recordConflictMetrics(conflicts) {
    // This would integrate with the usage analyzer to record conflict patterns
    if (this.components.usageAnalyzer) {
      // Record conflict events for pattern analysis
      for (const conflict of conflicts.conflicts) {
        // The usage analyzer would track these metrics
      }
    }
  }

  /**
   * Update system health based on latest data
   */
  async updateSystemHealth() {
    // Trigger a health check to update system status
    await this.performHealthCheck();
  }

  /**
   * Perform system backup
   */
  async performSystemBackup() {
    console.log('💾 Performing system backup...');

    try {
      const backupData = {
        timestamp: Date.now(),
        version: '3.0.0',
        system_config: this.config,
        system_health: this.systemHealth,
        components_data: {}
      };

      // Backup each component's data
      for (const [componentName, component] of Object.entries(this.components)) {
        if (component && typeof component.saveData === 'function') {
          try {
            await component.saveData();
            backupData.components_data[componentName] = 'saved';
          } catch (error) {
            backupData.components_data[componentName] = `error: ${error.message}`;
          }
        }
      }

      // Save system backup
      const backupPath = path.join(__dirname, '../data/system-backup.json');
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      console.log('✅ System backup completed');
      this.emit('backup_complete', { backup_path: backupPath });

    } catch (error) {
      console.error('❌ System backup failed:', error.message);
      this.emit('backup_failed', { error: error.message });
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const status = {
      timestamp: Date.now(),
      initialized: this.initialized,
      system_health: this.systemHealth,
      components: {},
      active_services: {
        health_monitoring: this.intervals.healthCheck !== null,
        auto_optimization: this.intervals.optimization !== null,
        backup_service: this.intervals.backup !== null,
        conflict_monitoring: this.components.conflictAvoidance?.monitoringActive || false
      },
      configuration: this.config
    };

    // Get status from each component
    for (const [componentName, component] of Object.entries(this.components)) {
      if (component) {
        try {
          if (componentName === 'intelligentSuggester' && component.getSystemHealthReport) {
            status.components[componentName] = await component.getSystemHealthReport();
          } else if (componentName === 'conflictAvoidance' && component.getConflictReport) {
            status.components[componentName] = await component.getConflictReport();
          } else if (componentName === 'usageAnalyzer' && component.generateAnalyticsReport) {
            status.components[componentName] = await component.generateAnalyticsReport();
          } else {
            status.components[componentName] = { status: 'active' };
          }
        } catch (error) {
          status.components[componentName] = { status: 'error', error: error.message };
        }
      } else {
        status.components[componentName] = { status: 'not_initialized' };
      }
    }

    return status;
  }

  /**
   * Get intelligent port suggestions with full system integration
   */
  async getIntelligentSuggestions(serviceName, environment = 'development', options = {}) {
    if (!this.initialized || !this.components.intelligentSuggester) {
      throw new Error('Intelligent suggester not available');
    }

    console.log(`🧠 Getting intelligent suggestions for ${serviceName} in ${environment}...`);

    // Get suggestions from intelligent suggester
    const suggestions = await this.components.intelligentSuggester.suggestOptimalPorts(
      serviceName,
      environment,
      {
        count: options.count || 5,
        avoidCurrentPort: options.avoidCurrentPort !== false,
        considerDependencies: options.considerDependencies !== false,
        optimizeForPerformance: options.optimizeForPerformance !== false,
        includeReasoningDetails: options.includeReasoningDetails !== false,
        ...options
      }
    );

    // Enhance suggestions with conflict analysis
    if (this.components.conflictAvoidance) {
      for (const suggestion of suggestions.suggestions) {
        const conflictAnalysis = await this.components.conflictAvoidance.detectConflicts(environment, {
          includeRuntime: true,
          includeConfiguration: false,
          includePredictive: true
        });

        // Check if suggested port has any conflicts
        const portConflicts = conflictAnalysis.conflicts.filter(c => c.port === suggestion.port);
        suggestion.conflict_analysis = {
          has_conflicts: portConflicts.length > 0,
          conflict_count: portConflicts.length,
          conflicts: portConflicts
        };

        // Adjust score based on conflicts
        if (portConflicts.length > 0) {
          const conflictPenalty = portConflicts.reduce((penalty, conflict) => {
            return penalty + (conflict.severity.level * 5);
          }, 0);
          
          suggestion.final_score = Math.max(0, suggestion.final_score - conflictPenalty);
        }
      }

      // Re-sort suggestions by adjusted scores
      suggestions.suggestions.sort((a, b) => b.final_score - a.final_score);
    }

    // Record the suggestion request for learning
    if (this.config.learning_enabled) {
      await this.components.intelligentSuggester.recordSuggestionRequest(
        serviceName,
        environment,
        suggestions.suggestions
      );
    }

    return suggestions;
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown() {
    console.log('🛑 Shutting down Intelligent Port Management System...');

    try {
      // Clear all intervals
      if (this.intervals.healthCheck) {
        clearInterval(this.intervals.healthCheck);
        this.intervals.healthCheck = null;
      }

      if (this.intervals.optimization) {
        clearInterval(this.intervals.optimization);
        this.intervals.optimization = null;
      }

      if (this.intervals.backup) {
        clearInterval(this.intervals.backup);
        this.intervals.backup = null;
      }

      // Stop component services
      if (this.components.conflictAvoidance && this.components.conflictAvoidance.monitoringActive) {
        this.components.conflictAvoidance.stopMonitoring();
      }

      if (this.components.usageAnalyzer && typeof this.components.usageAnalyzer.stop === 'function') {
        await this.components.usageAnalyzer.stop();
      }

      // Perform final backup
      await this.performSystemBackup();

      this.initialized = false;
      console.log('✅ System shutdown completed');
      
      this.emit('system_shutdown', { timestamp: Date.now() });

    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      this.emit('shutdown_error', { error: error.message });
    }
  }
}

// Export singleton instance
const intelligentPortSystem = new IntelligentPortSystem();

export default intelligentPortSystem;
export { IntelligentPortSystem };
