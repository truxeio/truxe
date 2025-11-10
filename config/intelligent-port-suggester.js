/**
 * Truxe Intelligent Port Suggestion System
 * 
 * Advanced AI-powered port allocation system that learns from usage patterns,
 * analyzes service requirements, and provides optimal port suggestions with
 * comprehensive conflict avoidance and optimization strategies.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import EventEmitter from 'events';
import portManager from './ports.js';
import { conflictDetector, portValidator } from './port-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service Type Classifications for Intelligent Allocation
 */
const SERVICE_TYPES = {
  CORE: {
    name: 'Core Services',
    priority: 1,
    services: ['api', 'database', 'redis', 'auth'],
    port_characteristics: {
      stability_required: true,
      high_availability: true,
      predictable_ports: true,
      range_preference: 'low'
    }
  },
  DEVELOPMENT: {
    name: 'Development Tools',
    priority: 2,
    services: ['mailhog_smtp', 'mailhog_web', 'docs', 'hot_reload', 'dev_server'],
    port_characteristics: {
      stability_required: false,
      high_availability: false,
      predictable_ports: false,
      range_preference: 'mid'
    }
  },
  MONITORING: {
    name: 'Monitoring & Observability',
    priority: 3,
    services: ['monitoring', 'grafana', 'prometheus', 'jaeger', 'metrics'],
    port_characteristics: {
      stability_required: true,
      high_availability: true,
      predictable_ports: true,
      range_preference: 'mid'
    }
  },
  TESTING: {
    name: 'Testing Services',
    priority: 4,
    services: ['test_runner', 'mock_server', 'load_tester', 'e2e_runner', 'selenium_hub'],
    port_characteristics: {
      stability_required: false,
      high_availability: false,
      predictable_ports: false,
      range_preference: 'high'
    }
  },
  UTILITY: {
    name: 'Utility Services',
    priority: 5,
    services: ['webhook_relay', 'file_server', 'backup_service', 'health_check'],
    port_characteristics: {
      stability_required: false,
      high_availability: false,
      predictable_ports: false,
      range_preference: 'high'
    }
  }
};

/**
 * Port Usage Patterns for Machine Learning
 */
const USAGE_PATTERNS = {
  FREQUENT: { weight: 1.0, description: 'Frequently used services' },
  OCCASIONAL: { weight: 0.7, description: 'Occasionally used services' },
  RARE: { weight: 0.4, description: 'Rarely used services' },
  DEVELOPMENT_ONLY: { weight: 0.3, description: 'Development-only services' },
  TESTING_ONLY: { weight: 0.2, description: 'Testing-only services' }
};

/**
 * Intelligent Port Suggestion Engine
 */
export class IntelligentPortSuggester extends EventEmitter {
  constructor() {
    super();
    this.historyPath = path.join(__dirname, '../data/port-usage-history.json');
    this.analyticsPath = path.join(__dirname, '../data/port-analytics.json');
    this.preferencesPath = path.join(__dirname, '../data/port-preferences.json');
    
    this.usageHistory = new Map();
    this.portAnalytics = new Map();
    this.userPreferences = new Map();
    this.conflictPatterns = new Map();
    this.performanceMetrics = new Map();
    
    this.initialized = false;
    this.learningEnabled = true;
    this.optimizationLevel = 'aggressive'; // conservative, balanced, aggressive
    
    this.init();
  }

  /**
   * Initialize the suggestion engine
   */
  async init() {
    try {
      await this.ensureDataDirectory();
      await this.loadHistoricalData();
      await this.loadAnalytics();
      await this.loadUserPreferences();
      
      this.initialized = true;
      this.emit('initialized');
      
      console.log('🧠 Intelligent Port Suggester initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Intelligent Port Suggester:', error.message);
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * Load historical usage data
   */
  async loadHistoricalData() {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      const history = JSON.parse(data);
      
      for (const [key, value] of Object.entries(history)) {
        this.usageHistory.set(key, value);
      }
      
      console.log(`📊 Loaded ${this.usageHistory.size} historical usage records`);
    } catch (error) {
      console.log('📊 No historical data found, starting fresh');
      this.usageHistory = new Map();
    }
  }

  /**
   * Load port analytics data
   */
  async loadAnalytics() {
    try {
      const data = await fs.readFile(this.analyticsPath, 'utf8');
      const analytics = JSON.parse(data);
      
      for (const [key, value] of Object.entries(analytics)) {
        this.portAnalytics.set(key, value);
      }
      
      console.log(`📈 Loaded ${this.portAnalytics.size} analytics records`);
    } catch (error) {
      console.log('📈 No analytics data found, starting fresh');
      this.portAnalytics = new Map();
    }
  }

  /**
   * Load user preferences
   */
  async loadUserPreferences() {
    try {
      const data = await fs.readFile(this.preferencesPath, 'utf8');
      const preferences = JSON.parse(data);
      
      for (const [key, value] of Object.entries(preferences)) {
        this.userPreferences.set(key, value);
      }
      
      console.log(`⚙️ Loaded ${this.userPreferences.size} user preferences`);
    } catch (error) {
      console.log('⚙️ No user preferences found, using defaults');
      this.userPreferences = new Map();
    }
  }

  /**
   * Save all data to persistent storage
   */
  async saveData() {
    try {
      await Promise.all([
        this.saveHistoricalData(),
        this.saveAnalytics(),
        this.saveUserPreferences()
      ]);
    } catch (error) {
      console.error('❌ Failed to save data:', error.message);
    }
  }

  /**
   * Save historical data
   */
  async saveHistoricalData() {
    const data = Object.fromEntries(this.usageHistory);
    await fs.writeFile(this.historyPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save analytics data
   */
  async saveAnalytics() {
    const data = Object.fromEntries(this.portAnalytics);
    await fs.writeFile(this.analyticsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences() {
    const data = Object.fromEntries(this.userPreferences);
    await fs.writeFile(this.preferencesPath, JSON.stringify(data, null, 2));
  }

  /**
   * Record port usage for machine learning
   */
  async recordPortUsage(serviceName, port, environment, context = {}) {
    if (!this.learningEnabled) return;

    const timestamp = Date.now();
    const usageKey = `${environment}:${serviceName}:${port}`;
    
    const usage = this.usageHistory.get(usageKey) || {
      service: serviceName,
      port,
      environment,
      first_used: timestamp,
      usage_count: 0,
      success_rate: 1.0,
      conflict_count: 0,
      performance_score: 1.0,
      contexts: []
    };

    usage.last_used = timestamp;
    usage.usage_count++;
    usage.contexts.push({
      timestamp,
      ...context
    });

    // Keep only last 100 contexts to prevent memory bloat
    if (usage.contexts.length > 100) {
      usage.contexts = usage.contexts.slice(-100);
    }

    this.usageHistory.set(usageKey, usage);
    
    // Update analytics
    await this.updateAnalytics(serviceName, port, environment, context);
    
    this.emit('usage_recorded', { serviceName, port, environment, context });
  }

  /**
   * Update analytics based on usage
   */
  async updateAnalytics(serviceName, port, environment, context) {
    const analyticsKey = `${environment}:${serviceName}`;
    
    const analytics = this.portAnalytics.get(analyticsKey) || {
      service: serviceName,
      environment,
      preferred_ports: new Map(),
      conflict_history: [],
      performance_history: [],
      usage_patterns: {},
      recommendations: []
    };

    // Update preferred ports
    const portKey = port.toString();
    const portStats = analytics.preferred_ports.get(portKey) || {
      port,
      usage_count: 0,
      success_rate: 1.0,
      avg_performance: 1.0,
      last_used: Date.now()
    };

    portStats.usage_count++;
    portStats.last_used = Date.now();
    
    if (context.success !== undefined) {
      portStats.success_rate = (portStats.success_rate + (context.success ? 1 : 0)) / 2;
    }
    
    if (context.performance_score !== undefined) {
      portStats.avg_performance = (portStats.avg_performance + context.performance_score) / 2;
    }

    analytics.preferred_ports.set(portKey, portStats);
    this.portAnalytics.set(analyticsKey, analytics);
  }

  /**
   * Analyze current port usage patterns
   */
  async analyzePortUsage(environment = 'development') {
    const envConfig = portManager.getEnvironmentConfig(environment);
    const analysis = {
      environment,
      timestamp: new Date().toISOString(),
      total_services: Object.keys(envConfig.services).length,
      port_utilization: portManager.calculatePortUtilization(environment),
      service_analysis: {},
      conflict_patterns: {},
      optimization_opportunities: [],
      recommendations: []
    };

    // Analyze each service
    for (const [serviceName, currentPort] of Object.entries(envConfig.services)) {
      const serviceAnalysis = await this.analyzeService(serviceName, currentPort, environment);
      analysis.service_analysis[serviceName] = serviceAnalysis;
    }

    // Identify conflict patterns
    analysis.conflict_patterns = await this.identifyConflictPatterns(environment);

    // Generate optimization opportunities
    analysis.optimization_opportunities = await this.identifyOptimizationOpportunities(environment);

    // Generate recommendations
    analysis.recommendations = await this.generateSystemRecommendations(analysis);

    return analysis;
  }

  /**
   * Analyze individual service port usage
   */
  async analyzeService(serviceName, currentPort, environment) {
    const usageKey = `${environment}:${serviceName}:${currentPort}`;
    const usage = this.usageHistory.get(usageKey);
    const serviceType = this.getServiceType(serviceName);
    
    const analysis = {
      service: serviceName,
      current_port: currentPort,
      service_type: serviceType.name,
      priority: serviceType.priority,
      usage_frequency: usage ? this.calculateUsageFrequency(usage) : 'unknown',
      conflict_risk: await this.assessConflictRisk(currentPort, environment),
      optimization_score: await this.calculateOptimizationScore(serviceName, currentPort, environment),
      recommendations: []
    };

    // Add service-specific recommendations
    analysis.recommendations = await this.generateServiceRecommendations(serviceName, currentPort, environment, analysis);

    return analysis;
  }

  /**
   * Calculate usage frequency category
   */
  calculateUsageFrequency(usage) {
    const daysSinceFirstUse = (Date.now() - usage.first_used) / (1000 * 60 * 60 * 24);
    const usagePerDay = usage.usage_count / Math.max(daysSinceFirstUse, 1);

    if (usagePerDay >= 5) return 'frequent';
    if (usagePerDay >= 1) return 'occasional';
    if (usagePerDay >= 0.2) return 'rare';
    return 'very_rare';
  }

  /**
   * Assess conflict risk for a port
   */
  async assessConflictRisk(port, environment) {
    const conflicts = await conflictDetector.detectConflicts([port]);
    const validation = portValidator.validatePort(port, environment);
    
    let riskScore = 0;
    
    // Check current conflicts
    if (conflicts.conflicts.length > 0) {
      riskScore += 50;
    }
    
    // Check validation issues
    if (!validation.valid) {
      riskScore += 30;
    }
    
    // Check reserved ranges
    if (portManager.isPortReserved(port)) {
      riskScore += 20;
    }
    
    // Check historical conflicts
    const historicalConflicts = this.getHistoricalConflicts(port, environment);
    riskScore += Math.min(historicalConflicts * 5, 25);

    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'very_low';
  }

  /**
   * Get historical conflicts for a port
   */
  getHistoricalConflicts(port, environment) {
    let conflicts = 0;
    
    for (const [key, usage] of this.usageHistory) {
      if (key.includes(`:${port}`) && key.includes(`${environment}:`)) {
        conflicts += usage.conflict_count || 0;
      }
    }
    
    return conflicts;
  }

  /**
   * Calculate optimization score for a service port
   */
  async calculateOptimizationScore(serviceName, port, environment) {
    const serviceType = this.getServiceType(serviceName);
    const envConfig = portManager.getEnvironmentConfig(environment);
    
    let score = 100;
    
    // Check if port is in optimal range for service type
    const optimalRange = this.getOptimalPortRange(serviceType, envConfig);
    if (port < optimalRange.start || port > optimalRange.end) {
      score -= 20;
    }
    
    // Check port availability and conflicts
    if (!portManager.isPortAvailable(port)) {
      score -= 30;
    }
    
    // Check if port follows service grouping conventions
    if (!this.followsGroupingConventions(serviceName, port, envConfig)) {
      score -= 15;
    }
    
    // Check historical performance
    const usage = this.usageHistory.get(`${environment}:${serviceName}:${port}`);
    if (usage) {
      score = score * usage.success_rate * usage.performance_score;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get optimal port range for service type
   */
  getOptimalPortRange(serviceType, envConfig) {
    const totalRange = envConfig.range.end - envConfig.range.start + 1;
    const segmentSize = Math.floor(totalRange / 5);
    
    switch (serviceType.port_characteristics.range_preference) {
      case 'low':
        return {
          start: envConfig.range.start,
          end: envConfig.range.start + segmentSize
        };
      case 'mid':
        return {
          start: envConfig.range.start + segmentSize,
          end: envConfig.range.start + (segmentSize * 3)
        };
      case 'high':
        return {
          start: envConfig.range.start + (segmentSize * 3),
          end: envConfig.range.end
        };
      default:
        return envConfig.range;
    }
  }

  /**
   * Check if port follows grouping conventions
   */
  followsGroupingConventions(serviceName, port, envConfig) {
    const serviceType = this.getServiceType(serviceName);
    const optimalRange = this.getOptimalPortRange(serviceType, envConfig);
    
    return port >= optimalRange.start && port <= optimalRange.end;
  }

  /**
   * Get service type classification
   */
  getServiceType(serviceName) {
    for (const [typeKey, typeInfo] of Object.entries(SERVICE_TYPES)) {
      if (typeInfo.services.includes(serviceName)) {
        return typeInfo;
      }
    }
    
    // Default to utility type
    return SERVICE_TYPES.UTILITY;
  }

  /**
   * Generate intelligent port suggestions
   */
  async suggestOptimalPorts(serviceName, environment = 'development', options = {}) {
    const {
      count = 5,
      avoidCurrentPort = true,
      considerDependencies = true,
      optimizeForPerformance = true,
      includeReasoningDetails = true
    } = options;

    if (!this.initialized) {
      await this.init();
    }

    const envConfig = portManager.getEnvironmentConfig(environment);
    const currentPort = envConfig.services[serviceName];
    const serviceType = this.getServiceType(serviceName);
    
    console.log(`🧠 Generating intelligent suggestions for ${serviceName} in ${environment}`);

    const suggestions = [];
    const strategies = [
      { name: 'historical_preference', weight: 0.3 },
      { name: 'service_optimization', weight: 0.25 },
      { name: 'conflict_avoidance', weight: 0.2 },
      { name: 'performance_optimization', weight: 0.15 },
      { name: 'dependency_optimization', weight: 0.1 }
    ];

    // Strategy 1: Historical preference analysis
    const historicalSuggestions = await this.generateHistoricalSuggestions(serviceName, environment);
    
    // Strategy 2: Service-specific optimization
    const serviceSuggestions = await this.generateServiceOptimizedSuggestions(serviceName, serviceType, envConfig);
    
    // Strategy 3: Conflict avoidance optimization
    const conflictAvoidanceSuggestions = await this.generateConflictAvoidanceSuggestions(envConfig);
    
    // Strategy 4: Performance optimization
    const performanceSuggestions = await this.generatePerformanceOptimizedSuggestions(serviceName, environment);
    
    // Strategy 5: Dependency optimization
    const dependencySuggestions = considerDependencies ? 
      await this.generateDependencyOptimizedSuggestions(serviceName, envConfig) : [];

    // Combine and score all suggestions
    const allSuggestions = [
      ...historicalSuggestions.map(s => ({ ...s, strategy: 'historical_preference' })),
      ...serviceSuggestions.map(s => ({ ...s, strategy: 'service_optimization' })),
      ...conflictAvoidanceSuggestions.map(s => ({ ...s, strategy: 'conflict_avoidance' })),
      ...performanceSuggestions.map(s => ({ ...s, strategy: 'performance_optimization' })),
      ...dependencySuggestions.map(s => ({ ...s, strategy: 'dependency_optimization' }))
    ];

    // Remove duplicates and current port if requested
    const uniqueSuggestions = this.removeDuplicateSuggestions(allSuggestions, currentPort, avoidCurrentPort);

    // Calculate final scores using weighted strategy approach
    const scoredSuggestions = await this.calculateFinalScores(uniqueSuggestions, strategies, serviceName, environment);

    // Sort by score and return top suggestions
    const topSuggestions = scoredSuggestions
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, count);

    // Add detailed reasoning if requested
    if (includeReasoningDetails) {
      for (const suggestion of topSuggestions) {
        suggestion.reasoning = await this.generateReasoningDetails(suggestion, serviceName, environment);
      }
    }

    // Record this suggestion request for learning
    await this.recordSuggestionRequest(serviceName, environment, topSuggestions);

    return {
      service: serviceName,
      environment,
      current_port: currentPort,
      suggestions: topSuggestions,
      analysis_metadata: {
        total_candidates_evaluated: allSuggestions.length,
        unique_candidates: uniqueSuggestions.length,
        strategies_used: strategies.map(s => s.name),
        service_type: serviceType.name,
        optimization_level: this.optimizationLevel
      }
    };
  }

  /**
   * Generate suggestions based on historical usage patterns
   */
  async generateHistoricalSuggestions(serviceName, environment) {
    const suggestions = [];
    const analyticsKey = `${environment}:${serviceName}`;
    const analytics = this.portAnalytics.get(analyticsKey);

    if (analytics && analytics.preferred_ports) {
      for (const [portStr, stats] of analytics.preferred_ports) {
        const port = parseInt(portStr);
        
        if (await this.isPortSuggestionViable(port, environment)) {
          suggestions.push({
            port,
            base_score: stats.success_rate * stats.avg_performance * 100,
            reason: `Historically successful (${stats.usage_count} uses, ${Math.round(stats.success_rate * 100)}% success rate)`,
            metadata: {
              usage_count: stats.usage_count,
              success_rate: stats.success_rate,
              avg_performance: stats.avg_performance,
              last_used: stats.last_used
            }
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.base_score - a.base_score).slice(0, 3);
  }

  /**
   * Generate service-optimized suggestions
   */
  async generateServiceOptimizedSuggestions(serviceName, serviceType, envConfig) {
    const suggestions = [];
    const optimalRange = this.getOptimalPortRange(serviceType, envConfig);
    
    // Generate ports in optimal range
    const step = Math.max(1, Math.floor((optimalRange.end - optimalRange.start) / 20));
    
    for (let port = optimalRange.start; port <= optimalRange.end; port += step) {
      if (await this.isPortSuggestionViable(port, envConfig.name || 'development')) {
        const score = await this.calculateServiceOptimizationScore(port, serviceType, envConfig);
        
        suggestions.push({
          port,
          base_score: score,
          reason: `Optimized for ${serviceType.name} (priority ${serviceType.priority})`,
          metadata: {
            service_type: serviceType.name,
            optimal_range: optimalRange,
            optimization_score: score
          }
        });
      }
    }

    return suggestions.sort((a, b) => b.base_score - a.base_score).slice(0, 5);
  }

  /**
   * Calculate service optimization score
   */
  async calculateServiceOptimizationScore(port, serviceType, envConfig) {
    let score = 80; // Base score
    
    // Bonus for service type characteristics
    if (serviceType.port_characteristics.stability_required && this.isStablePort(port)) {
      score += 10;
    }
    
    if (serviceType.port_characteristics.predictable_ports && this.isPredictablePort(port)) {
      score += 10;
    }
    
    // Distance from range center (closer is better for some service types)
    const rangeCenter = (envConfig.range.start + envConfig.range.end) / 2;
    const distance = Math.abs(port - rangeCenter);
    const maxDistance = (envConfig.range.end - envConfig.range.start) / 2;
    const distanceScore = (1 - (distance / maxDistance)) * 20;
    score += distanceScore;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if port is considered stable (lower numbers, avoiding common ranges)
   */
  isStablePort(port) {
    // Avoid common development ports that might conflict
    const unstableRanges = [
      { start: 3000, end: 3010 },
      { start: 8000, end: 8010 },
      { start: 9000, end: 9010 }
    ];
    
    return !unstableRanges.some(range => port >= range.start && port <= range.end);
  }

  /**
   * Check if port is predictable (follows patterns)
   */
  isPredictablePort(port) {
    // Ports ending in 01, 02, etc. or round numbers
    return port % 10 <= 5 || port % 100 === 0;
  }

  /**
   * Generate conflict avoidance suggestions
   */
  async generateConflictAvoidanceSuggestions(envConfig) {
    const suggestions = [];
    const usedPorts = new Set(Object.values(envConfig.services));
    const reservedPorts = new Set();
    
    // Add system reserved ports
    for (const range of portManager.config.conflict_detection.reserved_ranges) {
      for (let port = range.start; port <= range.end; port++) {
        reservedPorts.add(port);
      }
    }

    // Find safe ports with good spacing
    const minSpacing = 5;
    
    for (let port = envConfig.range.start; port <= envConfig.range.end; port += minSpacing) {
      if (!usedPorts.has(port) && 
          !reservedPorts.has(port) && 
          await this.isPortSuggestionViable(port, envConfig.name || 'development')) {
        
        const conflictScore = await this.calculateConflictAvoidanceScore(port, usedPorts, reservedPorts);
        
        suggestions.push({
          port,
          base_score: conflictScore,
          reason: `Conflict-free with ${minSpacing}-port spacing`,
          metadata: {
            spacing: minSpacing,
            conflict_risk: 'low',
            used_ports_nearby: this.countNearbyUsedPorts(port, usedPorts, 10)
          }
        });
      }
    }

    return suggestions.sort((a, b) => b.base_score - a.base_score).slice(0, 5);
  }

  /**
   * Calculate conflict avoidance score
   */
  async calculateConflictAvoidanceScore(port, usedPorts, reservedPorts) {
    let score = 90; // Base high score for conflict avoidance
    
    // Penalty for nearby used ports
    const nearbyUsed = this.countNearbyUsedPorts(port, usedPorts, 5);
    score -= nearbyUsed * 5;
    
    // Penalty for nearby reserved ports
    const nearbyReserved = this.countNearbyReservedPorts(port, reservedPorts, 10);
    score -= nearbyReserved * 3;
    
    // Bonus for being in a clear area
    const clearArea = this.isInClearArea(port, usedPorts, reservedPorts, 20);
    if (clearArea) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count nearby used ports
   */
  countNearbyUsedPorts(port, usedPorts, range) {
    let count = 0;
    for (let i = port - range; i <= port + range; i++) {
      if (usedPorts.has(i)) count++;
    }
    return count;
  }

  /**
   * Count nearby reserved ports
   */
  countNearbyReservedPorts(port, reservedPorts, range) {
    let count = 0;
    for (let i = port - range; i <= port + range; i++) {
      if (reservedPorts.has(i)) count++;
    }
    return count;
  }

  /**
   * Check if port is in a clear area
   */
  isInClearArea(port, usedPorts, reservedPorts, range) {
    for (let i = port - range; i <= port + range; i++) {
      if (usedPorts.has(i) || reservedPorts.has(i)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate performance-optimized suggestions
   */
  async generatePerformanceOptimizedSuggestions(serviceName, environment) {
    const suggestions = [];
    
    // Look for ports with good historical performance
    for (const [key, usage] of this.usageHistory) {
      if (key.includes(`${environment}:${serviceName}:`) && usage.performance_score > 0.8) {
        const port = parseInt(key.split(':')[2]);
        
        if (await this.isPortSuggestionViable(port, environment)) {
          suggestions.push({
            port,
            base_score: usage.performance_score * 100,
            reason: `High performance history (${Math.round(usage.performance_score * 100)}% score)`,
            metadata: {
              performance_score: usage.performance_score,
              usage_count: usage.usage_count,
              success_rate: usage.success_rate
            }
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.base_score - a.base_score).slice(0, 3);
  }

  /**
   * Generate dependency-optimized suggestions
   */
  async generateDependencyOptimizedSuggestions(serviceName, envConfig) {
    const suggestions = [];
    const dependencies = this.getServiceDependencies(serviceName);
    
    if (dependencies.length === 0) {
      return suggestions;
    }

    // Find ports that are optimally spaced from dependencies
    const dependencyPorts = dependencies
      .map(dep => envConfig.services[dep])
      .filter(port => port !== undefined);

    if (dependencyPorts.length === 0) {
      return suggestions;
    }

    const optimalSpacing = 10;
    
    for (const depPort of dependencyPorts) {
      const candidatePorts = [
        depPort + optimalSpacing,
        depPort - optimalSpacing,
        depPort + (optimalSpacing * 2),
        depPort - (optimalSpacing * 2)
      ];

      for (const port of candidatePorts) {
        if (port >= envConfig.range.start && 
            port <= envConfig.range.end && 
            await this.isPortSuggestionViable(port, envConfig.name || 'development')) {
          
          suggestions.push({
            port,
            base_score: 75,
            reason: `Optimally spaced from dependency ${dependencies[0]} (port ${depPort})`,
            metadata: {
              dependency_service: dependencies[0],
              dependency_port: depPort,
              spacing: Math.abs(port - depPort)
            }
          });
        }
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(serviceName) {
    const dependencyMap = {
      api: ['database', 'redis'],
      monitoring: ['api'],
      docs: ['api'],
      test_runner: ['api', 'database'],
      load_tester: ['api']
    };

    return dependencyMap[serviceName] || [];
  }

  /**
   * Check if port suggestion is viable
   */
  async isPortSuggestionViable(port, environment) {
    try {
      // Check basic availability
      if (!portManager.isPortAvailable(port)) {
        return false;
      }

      // Check if not reserved
      if (portManager.isPortReserved(port)) {
        return false;
      }

      // Check environment range
      const envConfig = portManager.getEnvironmentConfig(environment);
      if (port < envConfig.range.start || port > envConfig.range.end) {
        return false;
      }

      // Check validation rules
      const validation = portValidator.validatePort(port, environment);
      if (!validation.valid) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove duplicate suggestions
   */
  removeDuplicateSuggestions(suggestions, currentPort, avoidCurrentPort) {
    const seen = new Set();
    const unique = [];

    for (const suggestion of suggestions) {
      if (avoidCurrentPort && suggestion.port === currentPort) {
        continue;
      }

      if (!seen.has(suggestion.port)) {
        seen.add(suggestion.port);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Calculate final weighted scores
   */
  async calculateFinalScores(suggestions, strategies, serviceName, environment) {
    const strategyWeights = new Map(strategies.map(s => [s.name, s.weight]));

    for (const suggestion of suggestions) {
      const strategyWeight = strategyWeights.get(suggestion.strategy) || 0.1;
      
      // Apply strategy weight
      suggestion.weighted_score = suggestion.base_score * strategyWeight;
      
      // Apply additional factors
      const additionalFactors = await this.calculateAdditionalFactors(suggestion.port, serviceName, environment);
      
      suggestion.final_score = suggestion.weighted_score * additionalFactors.multiplier;
      suggestion.additional_factors = additionalFactors;
    }

    return suggestions;
  }

  /**
   * Calculate additional scoring factors
   */
  async calculateAdditionalFactors(port, serviceName, environment) {
    let multiplier = 1.0;
    const factors = {};

    // User preference factor
    const userPref = this.getUserPreference(serviceName, port);
    if (userPref !== null) {
      factors.user_preference = userPref;
      multiplier *= (1 + userPref * 0.2);
    }

    // Recency factor (prefer recently successful ports)
    const recentSuccess = this.getRecentSuccessRate(serviceName, port, environment);
    factors.recent_success = recentSuccess;
    multiplier *= (1 + recentSuccess * 0.1);

    // Stability factor (prefer ports with consistent performance)
    const stability = this.getPortStability(port, environment);
    factors.stability = stability;
    multiplier *= (1 + stability * 0.15);

    return { multiplier, factors };
  }

  /**
   * Get user preference for a service/port combination
   */
  getUserPreference(serviceName, port) {
    const prefKey = `${serviceName}:${port}`;
    return this.userPreferences.get(prefKey) || null;
  }

  /**
   * Get recent success rate for a port
   */
  getRecentSuccessRate(serviceName, port, environment) {
    const usageKey = `${environment}:${serviceName}:${port}`;
    const usage = this.usageHistory.get(usageKey);
    
    if (!usage || !usage.contexts.length) {
      return 0;
    }

    // Look at last 10 contexts or last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentContexts = usage.contexts.filter(ctx => ctx.timestamp > thirtyDaysAgo).slice(-10);
    
    if (recentContexts.length === 0) {
      return 0;
    }

    const successCount = recentContexts.filter(ctx => ctx.success !== false).length;
    return successCount / recentContexts.length;
  }

  /**
   * Get port stability score
   */
  getPortStability(port, environment) {
    let totalUsage = 0;
    let totalSuccess = 0;

    for (const [key, usage] of this.usageHistory) {
      if (key.includes(`:${port}`) && key.includes(`${environment}:`)) {
        totalUsage += usage.usage_count;
        totalSuccess += usage.usage_count * usage.success_rate;
      }
    }

    if (totalUsage === 0) {
      return 0;
    }

    return totalSuccess / totalUsage;
  }

  /**
   * Generate detailed reasoning for suggestions
   */
  async generateReasoningDetails(suggestion, serviceName, environment) {
    const reasoning = {
      primary_reason: suggestion.reason,
      strategy_used: suggestion.strategy,
      score_breakdown: {
        base_score: suggestion.base_score,
        weighted_score: suggestion.weighted_score,
        final_score: suggestion.final_score
      },
      factors: suggestion.additional_factors?.factors || {},
      risk_assessment: await this.assessConflictRisk(suggestion.port, environment),
      optimization_notes: []
    };

    // Add optimization notes based on service type and context
    const serviceType = this.getServiceType(serviceName);
    
    if (serviceType.port_characteristics.stability_required) {
      reasoning.optimization_notes.push('Selected for stability requirements');
    }
    
    if (serviceType.port_characteristics.high_availability) {
      reasoning.optimization_notes.push('Optimized for high availability');
    }

    if (suggestion.metadata) {
      reasoning.metadata = suggestion.metadata;
    }

    return reasoning;
  }

  /**
   * Record suggestion request for learning
   */
  async recordSuggestionRequest(serviceName, environment, suggestions) {
    const requestKey = `suggestion_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const request = {
      timestamp: Date.now(),
      service: serviceName,
      environment,
      suggestions: suggestions.map(s => ({
        port: s.port,
        score: s.final_score,
        strategy: s.strategy
      })),
      context: {
        optimization_level: this.optimizationLevel,
        learning_enabled: this.learningEnabled
      }
    };

    // Store for future analysis
    this.usageHistory.set(requestKey, request);
    
    // Trigger periodic data save
    if (Math.random() < 0.1) { // 10% chance to save data
      await this.saveData();
    }
  }

  /**
   * Identify conflict patterns in the environment
   */
  async identifyConflictPatterns(environment) {
    const patterns = {};
    const conflicts = portManager.detectConflicts(environment);
    
    // Analyze conflict types
    const conflictTypes = {};
    for (const conflict of conflicts) {
      const type = conflict.type || 'unknown';
      conflictTypes[type] = (conflictTypes[type] || 0) + 1;
    }

    patterns.conflict_types = conflictTypes;
    patterns.total_conflicts = conflicts.length;
    patterns.high_risk_ports = conflicts
      .filter(c => c.severity === 'high' || c.severity === 'critical')
      .map(c => c.port);

    return patterns;
  }

  /**
   * Identify optimization opportunities
   */
  async identifyOptimizationOpportunities(environment) {
    const opportunities = [];
    const envConfig = portManager.getEnvironmentConfig(environment);
    
    // Check for services that could be better grouped
    const servicesByType = {};
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      const serviceType = this.getServiceType(serviceName);
      if (!servicesByType[serviceType.name]) {
        servicesByType[serviceType.name] = [];
      }
      servicesByType[serviceType.name].push({ serviceName, port });
    }

    // Look for scattered services of the same type
    for (const [typeName, services] of Object.entries(servicesByType)) {
      if (services.length > 1) {
        const ports = services.map(s => s.port).sort((a, b) => a - b);
        const maxGap = Math.max(...ports.map((p, i) => i > 0 ? p - ports[i-1] : 0));
        
        if (maxGap > 50) {
          opportunities.push({
            type: 'service_grouping',
            description: `${typeName} services are scattered (max gap: ${maxGap} ports)`,
            affected_services: services.map(s => s.serviceName),
            potential_improvement: 'Group services by type for better organization'
          });
        }
      }
    }

    // Check for underutilized port ranges
    const utilization = portManager.calculatePortUtilization(environment);
    if (utilization < 30) {
      opportunities.push({
        type: 'range_optimization',
        description: `Low port utilization (${utilization}%)`,
        potential_improvement: 'Consider consolidating to a smaller port range'
      });
    }

    return opportunities;
  }

  /**
   * Generate system-wide recommendations
   */
  async generateSystemRecommendations(analysis) {
    const recommendations = [];
    
    // High conflict services
    const highConflictServices = Object.entries(analysis.service_analysis)
      .filter(([, serviceAnalysis]) => serviceAnalysis.conflict_risk === 'high')
      .map(([serviceName]) => serviceName);

    if (highConflictServices.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'conflict_resolution',
        description: `Resolve high-risk conflicts for: ${highConflictServices.join(', ')}`,
        action: 'suggest_alternative_ports',
        affected_services: highConflictServices
      });
    }

    // Low optimization scores
    const lowOptimizationServices = Object.entries(analysis.service_analysis)
      .filter(([, serviceAnalysis]) => serviceAnalysis.optimization_score < 50)
      .map(([serviceName]) => serviceName);

    if (lowOptimizationServices.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'optimization',
        description: `Optimize port assignments for: ${lowOptimizationServices.join(', ')}`,
        action: 'optimize_port_allocation',
        affected_services: lowOptimizationServices
      });
    }

    // Service grouping opportunities
    if (analysis.optimization_opportunities.some(op => op.type === 'service_grouping')) {
      recommendations.push({
        priority: 'low',
        type: 'organization',
        description: 'Reorganize services by type for better port management',
        action: 'regroup_services_by_type'
      });
    }

    return recommendations;
  }

  /**
   * Generate service-specific recommendations
   */
  async generateServiceRecommendations(serviceName, currentPort, environment, analysis) {
    const recommendations = [];
    
    if (analysis.conflict_risk === 'high') {
      recommendations.push({
        type: 'immediate_action',
        priority: 'high',
        message: 'Consider changing port immediately due to high conflict risk'
      });
    }

    if (analysis.optimization_score < 50) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        message: 'Port assignment could be optimized for better performance'
      });
    }

    if (analysis.usage_frequency === 'very_rare') {
      recommendations.push({
        type: 'resource_optimization',
        priority: 'low',
        message: 'Consider consolidating with other services due to low usage'
      });
    }

    return recommendations;
  }

  /**
   * Learn from user feedback on suggestions
   */
  async recordUserFeedback(serviceName, environment, suggestedPort, feedback) {
    const feedbackKey = `feedback_${environment}_${serviceName}_${suggestedPort}`;
    
    const feedbackData = {
      timestamp: Date.now(),
      service: serviceName,
      environment,
      suggested_port: suggestedPort,
      feedback: feedback, // 'accepted', 'rejected', 'modified'
      user_rating: feedback.rating || null,
      user_comments: feedback.comments || null
    };

    this.usageHistory.set(feedbackKey, feedbackData);

    // Update user preferences
    if (feedback === 'accepted' || feedback.rating >= 4) {
      const prefKey = `${serviceName}:${suggestedPort}`;
      const currentPref = this.userPreferences.get(prefKey) || 0;
      this.userPreferences.set(prefKey, Math.min(1.0, currentPref + 0.2));
    } else if (feedback === 'rejected' || feedback.rating <= 2) {
      const prefKey = `${serviceName}:${suggestedPort}`;
      const currentPref = this.userPreferences.get(prefKey) || 0;
      this.userPreferences.set(prefKey, Math.max(-1.0, currentPref - 0.3));
    }

    await this.saveData();
    
    console.log(`📝 Recorded user feedback for ${serviceName}:${suggestedPort} - ${feedback}`);
  }

  /**
   * Get system health report
   */
  async getSystemHealthReport(environment = 'development') {
    const analysis = await this.analyzePortUsage(environment);
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      environment,
      overall_health: 'healthy',
      health_score: 100,
      issues: [],
      recommendations: analysis.recommendations,
      metrics: {
        total_services: analysis.total_services,
        port_utilization: analysis.port_utilization,
        conflict_count: Object.keys(analysis.conflict_patterns.conflict_types || {}).length,
        optimization_opportunities: analysis.optimization_opportunities.length
      }
    };

    // Calculate health score
    let healthScore = 100;
    
    // Deduct for conflicts
    healthScore -= (healthReport.metrics.conflict_count * 10);
    
    // Deduct for low optimization scores
    const lowOptServices = Object.values(analysis.service_analysis)
      .filter(s => s.optimization_score < 50).length;
    healthScore -= (lowOptServices * 5);
    
    // Deduct for high-risk services
    const highRiskServices = Object.values(analysis.service_analysis)
      .filter(s => s.conflict_risk === 'high').length;
    healthScore -= (highRiskServices * 15);

    healthReport.health_score = Math.max(0, healthScore);
    
    if (healthScore >= 80) {
      healthReport.overall_health = 'healthy';
    } else if (healthScore >= 60) {
      healthReport.overall_health = 'warning';
    } else {
      healthReport.overall_health = 'critical';
    }

    return healthReport;
  }

  /**
   * Export configuration with optimized ports
   */
  async exportOptimizedConfiguration(environment = 'development') {
    const envConfig = portManager.getEnvironmentConfig(environment);
    const optimizedConfig = {
      ...envConfig,
      services: { ...envConfig.services }
    };

    console.log(`🔧 Generating optimized configuration for ${environment}...`);

    // Get suggestions for each service
    for (const serviceName of Object.keys(envConfig.services)) {
      const suggestions = await this.suggestOptimalPorts(serviceName, environment, {
        count: 1,
        avoidCurrentPort: false,
        includeReasoningDetails: false
      });

      if (suggestions.suggestions.length > 0) {
        const bestSuggestion = suggestions.suggestions[0];
        
        // Only change if significantly better
        if (bestSuggestion.final_score > 80) {
          optimizedConfig.services[serviceName] = bestSuggestion.port;
        }
      }
    }

    return {
      original_config: envConfig,
      optimized_config: optimizedConfig,
      changes: this.calculateConfigChanges(envConfig, optimizedConfig),
      optimization_summary: await this.generateOptimizationSummary(envConfig, optimizedConfig, environment)
    };
  }

  /**
   * Calculate configuration changes
   */
  calculateConfigChanges(originalConfig, optimizedConfig) {
    const changes = [];
    
    for (const [serviceName, originalPort] of Object.entries(originalConfig.services)) {
      const optimizedPort = optimizedConfig.services[serviceName];
      
      if (originalPort !== optimizedPort) {
        changes.push({
          service: serviceName,
          from: originalPort,
          to: optimizedPort,
          change_type: 'port_optimization'
        });
      }
    }

    return changes;
  }

  /**
   * Generate optimization summary
   */
  async generateOptimizationSummary(originalConfig, optimizedConfig, environment) {
    const summary = {
      total_services: Object.keys(originalConfig.services).length,
      services_changed: 0,
      estimated_improvements: {
        conflict_reduction: 0,
        performance_improvement: 0,
        organization_improvement: 0
      },
      risk_assessment: 'low'
    };

    // Count changes and estimate improvements
    for (const [serviceName, originalPort] of Object.entries(originalConfig.services)) {
      const optimizedPort = optimizedConfig.services[serviceName];
      
      if (originalPort !== optimizedPort) {
        summary.services_changed++;
        
        // Estimate conflict reduction
        const originalRisk = await this.assessConflictRisk(originalPort, environment);
        const optimizedRisk = await this.assessConflictRisk(optimizedPort, environment);
        
        if (originalRisk === 'high' && optimizedRisk === 'low') {
          summary.estimated_improvements.conflict_reduction += 25;
        }
      }
    }

    // Calculate overall risk
    if (summary.services_changed > summary.total_services * 0.5) {
      summary.risk_assessment = 'high';
    } else if (summary.services_changed > summary.total_services * 0.2) {
      summary.risk_assessment = 'medium';
    }

    return summary;
  }
}

// Export singleton instance
const intelligentPortSuggester = new IntelligentPortSuggester();

export default intelligentPortSuggester;
export { IntelligentPortSuggester, SERVICE_TYPES, USAGE_PATTERNS };
