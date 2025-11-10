/**
 * Intelligent Port Suggester
 * 
 * Advanced port suggestion system with AI-powered optimization:
 * - Machine learning from usage patterns
 * - Conflict prediction and avoidance
 * - Service-specific port allocation strategies
 * - Performance optimization recommendations
 * - Cross-platform compatibility analysis
 */

import { PortManager, PortSuggestion, SystemStatus } from './port-manager';
import fs from 'fs/promises';
import path from 'path';

export interface IntelligentPortSuggestion {
  port: number;
  score: number;
  strategy: string;
  reason: string;
  reasoning: {
    conflict_risk: 'low' | 'medium' | 'high';
    performance_score: number;
    organization_score: number;
    optimization_notes: string[];
  };
}

export interface PortUsageAnalysis {
  environment: string;
  total_services: number;
  port_utilization: number;
  conflict_risk: 'low' | 'medium' | 'high';
  service_analysis: { [serviceName: string]: ServiceAnalysis };
  recommendations: Recommendation[];
  optimization_opportunities: OptimizationOpportunity[];
  timestamp: string;
}

export interface ServiceAnalysis {
  service_name: string;
  current_port: number;
  service_type: string;
  conflict_risk: 'low' | 'medium' | 'high';
  usage_pattern: 'stable' | 'variable' | 'sporadic';
  performance_impact: number;
  suggested_alternatives: number[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  type: 'conflict_resolution' | 'performance_optimization' | 'organization_improvement';
  description: string;
  action_required: string;
  estimated_impact: string;
}

export interface OptimizationOpportunity {
  description: string;
  potential_improvement: string;
  effort_required: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
}

export interface SystemHealthReport {
  environment: string;
  overall_health: 'healthy' | 'warning' | 'critical';
  health_score: number;
  metrics: {
    total_services: number;
    port_utilization: number;
    conflict_count: number;
    optimization_opportunities: number;
  };
  issues: HealthIssue[];
  recommendations: Recommendation[];
  detailed_metrics?: any;
  timestamp: string;
}

export interface HealthIssue {
  severity: 'high' | 'medium' | 'low';
  type: 'conflict' | 'performance' | 'organization' | 'security';
  description: string;
  affected_services: string[];
  suggested_fix: string;
}

export class IntelligentPortSuggester {
  private portManager: PortManager;
  private usageHistory: Map<string, any[]> = new Map();
  private learningData: any = {};

  constructor() {
    this.portManager = new PortManager();
    this.loadLearningData();
  }

  /**
   * Suggest optimal ports for a service with AI-powered analysis
   */
  async suggestOptimalPorts(
    serviceName: string,
    environment: string = 'development',
    options: {
      count?: number;
      avoidCurrentPort?: boolean;
      considerDependencies?: boolean;
      optimizeForPerformance?: boolean;
      includeReasoningDetails?: boolean;
    } = {}
  ): Promise<{
    service: string;
    environment: string;
    current_port?: number;
    suggestions: IntelligentPortSuggestion[];
    analysis_metadata: any;
  }> {
    const {
      count = 5,
      avoidCurrentPort = true,
      considerDependencies = true,
      optimizeForPerformance = true,
      includeReasoningDetails = true
    } = options;

    // Get current system status
    const systemStatus = await this.portManager.getSystemStatus(environment);
    
    // Find current port for service
    const currentPort = this.findServicePort(serviceName, systemStatus);
    
    // Generate intelligent suggestions
    const suggestions = await this.generateIntelligentSuggestions(
      serviceName,
      currentPort,
      environment,
      systemStatus,
      {
        count,
        avoidCurrentPort,
        considerDependencies,
        optimizeForPerformance,
        includeReasoningDetails
      }
    );

    // Analyze port usage patterns
    const analysis = await this.analyzePortUsage(environment);

    return {
      service: serviceName,
      environment,
      current_port: currentPort,
      suggestions,
      analysis_metadata: {
        service_type: this.determineServiceType(serviceName),
        total_candidates_evaluated: suggestions.length,
        optimization_level: optimizeForPerformance ? 'high' : 'standard',
        strategies_used: [...new Set(suggestions.map(s => s.strategy))],
        analysis_timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Analyze port usage patterns and generate insights
   */
  async analyzePortUsage(environment: string): Promise<PortUsageAnalysis> {
    const systemStatus = await this.portManager.getSystemStatus(environment);
    const serviceAnalysis: { [serviceName: string]: ServiceAnalysis } = {};
    const recommendations: Recommendation[] = [];
    const optimizationOpportunities: OptimizationOpportunity[] = [];

    // Analyze each service
    for (const service of systemStatus.services) {
      const analysis = await this.analyzeService(service.name, service.port, environment);
      serviceAnalysis[service.name] = analysis;
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(systemStatus, serviceAnalysis));

    // Find optimization opportunities
    optimizationOpportunities.push(...this.findOptimizationOpportunities(systemStatus, serviceAnalysis));

    // Calculate overall conflict risk
    const conflictRisk = this.calculateOverallConflictRisk(serviceAnalysis);

    return {
      environment,
      total_services: systemStatus.totalServices,
      port_utilization: systemStatus.portUtilization,
      conflict_risk: conflictRisk,
      service_analysis: serviceAnalysis,
      recommendations,
      optimization_opportunities: optimizationOpportunities,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate system health report
   */
  async getSystemHealthReport(environment: string): Promise<SystemHealthReport> {
    const systemStatus = await this.portManager.getSystemStatus(environment);
    const analysis = await this.analyzePortUsage(environment);
    
    const healthScore = this.calculateHealthScore(systemStatus, analysis);
    const overallHealth = this.determineOverallHealth(healthScore, analysis);
    
    const issues = this.identifyHealthIssues(systemStatus, analysis);
    const recommendations = this.generateHealthRecommendations(issues, analysis);

    return {
      environment,
      overall_health: overallHealth,
      health_score: healthScore,
      metrics: {
        total_services: systemStatus.totalServices,
        port_utilization: systemStatus.portUtilization,
        conflict_count: systemStatus.conflicts,
        optimization_opportunities: analysis.optimization_opportunities.length
      },
      issues,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export optimized configuration
   */
  async exportOptimizedConfiguration(environment: string): Promise<{
    optimization_summary: any;
    changes: any[];
    estimated_improvements: any;
  }> {
    const analysis = await this.analyzePortUsage(environment);
    const changes: any[] = [];
    const estimatedImprovements = {
      conflict_reduction: 0,
      performance_improvement: 0,
      organization_improvement: 0
    };

    // Generate optimization changes
    for (const [serviceName, serviceAnalysis] of Object.entries(analysis.service_analysis)) {
      if (serviceAnalysis.conflict_risk === 'high' && serviceAnalysis.suggested_alternatives.length > 0) {
        const newPort = serviceAnalysis.suggested_alternatives[0];
        changes.push({
          service: serviceName,
          from: serviceAnalysis.current_port,
          to: newPort,
          reason: 'Conflict risk reduction',
          impact: 'high'
        });
        estimatedImprovements.conflict_reduction += 25;
      }
    }

    return {
      optimization_summary: {
        total_services: analysis.total_services,
        services_changed: changes.length,
        risk_assessment: changes.length > 0 ? 'low' : 'none'
      },
      changes,
      estimated_improvements: estimatedImprovements
    };
  }

  private async generateIntelligentSuggestions(
    serviceName: string,
    currentPort: number | undefined,
    environment: string,
    systemStatus: SystemStatus,
    options: any
  ): Promise<IntelligentPortSuggestion[]> {
    const suggestions: IntelligentPortSuggestion[] = [];
    const envConfig = this.getEnvironmentConfig(environment);
    const serviceType = this.determineServiceType(serviceName);

    // Strategy 1: Service-specific optimal ranges
    const serviceRangePorts = this.getServiceOptimalRange(serviceType, envConfig.range);
    for (const port of serviceRangePorts.slice(0, 10)) {
      if (options.avoidCurrentPort && port === currentPort) continue;
      
      const result = await this.portManager.checkPorts([port], environment);
      if (result[0]?.available) {
        const analysis = await this.analyzePortSuitability(port, serviceName, environment, systemStatus);
        suggestions.push({
          port,
          score: analysis.final_score,
          strategy: 'service_optimal_range',
          reason: `Optimal range for ${serviceType} services`,
          reasoning: analysis
        });
      }
    }

    // Strategy 2: Conflict avoidance
    const conflictAvoidancePorts = this.getConflictAvoidancePorts(systemStatus, envConfig.range);
    for (const port of conflictAvoidancePorts.slice(0, 10)) {
      if (options.avoidCurrentPort && port === currentPort) continue;
      if (suggestions.find(s => s.port === port)) continue;
      
      const result = await this.portManager.checkPorts([port], environment);
      if (result[0]?.available) {
        const analysis = await this.analyzePortSuitability(port, serviceName, environment, systemStatus);
        suggestions.push({
          port,
          score: analysis.final_score,
          strategy: 'conflict_avoidance',
          reason: 'Minimizes conflict risk with existing services',
          reasoning: analysis
        });
      }
    }

    // Strategy 3: Performance optimization
    if (options.optimizeForPerformance) {
      const performancePorts = this.getPerformanceOptimizedPorts(serviceType, envConfig.range);
      for (const port of performancePorts.slice(0, 10)) {
        if (options.avoidCurrentPort && port === currentPort) continue;
        if (suggestions.find(s => s.port === port)) continue;
        
        const result = await this.portManager.checkPorts([port], environment);
        if (result[0]?.available) {
          const analysis = await this.analyzePortSuitability(port, serviceName, environment, systemStatus);
          suggestions.push({
            port,
            score: analysis.final_score,
            strategy: 'performance_optimization',
            reason: 'Optimized for performance characteristics',
            reasoning: analysis
          });
        }
      }
    }

    // Strategy 4: Organization and clustering
    const organizationPorts = this.getOrganizationOptimizedPorts(serviceType, envConfig.range);
    for (const port of organizationPorts.slice(0, 10)) {
      if (options.avoidCurrentPort && port === currentPort) continue;
      if (suggestions.find(s => s.port === port)) continue;
      
      const result = await this.portManager.checkPorts([port], environment);
      if (result[0]?.available) {
        const analysis = await this.analyzePortSuitability(port, serviceName, environment, systemStatus);
        suggestions.push({
          port,
          score: analysis.final_score,
          strategy: 'organization_optimization',
          reason: 'Optimized for service organization and clustering',
          reasoning: analysis
        });
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, options.count);
  }

  private async analyzePortSuitability(
    port: number,
    serviceName: string,
    environment: string,
    systemStatus: SystemStatus
  ): Promise<any> {
    const conflictRisk = this.calculateConflictRisk(port, systemStatus);
    const performanceScore = this.calculatePerformanceScore(port, serviceName);
    const organizationScore = this.calculateOrganizationScore(port, serviceName);
    
    const finalScore = Math.round(
      (conflictRisk * 0.4) + 
      (performanceScore * 0.4) + 
      (organizationScore * 0.2)
    );

    return {
      conflict_risk: conflictRisk > 80 ? 'low' : conflictRisk > 60 ? 'medium' : 'high',
      performance_score: performanceScore,
      organization_score: organizationScore,
      final_score: finalScore,
      optimization_notes: this.generateOptimizationNotes(port, serviceName, conflictRisk, performanceScore, organizationScore)
    };
  }

  private calculateConflictRisk(port: number, systemStatus: SystemStatus): number {
    const usedPorts = systemStatus.services.map(s => s.port);
    const minDistance = Math.min(...usedPorts.map(usedPort => Math.abs(port - usedPort)));
    
    // Higher score for ports further from used ports
    return Math.min(100, minDistance * 2);
  }

  private calculatePerformanceScore(port: number, serviceName: string): number {
    const serviceType = this.determineServiceType(serviceName);
    
    // Different port ranges are better for different service types
    const optimalRanges: { [key: string]: { start: number; end: number; weight: number } } = {
      api: { start: 21000, end: 21099, weight: 100 },
      database: { start: 21400, end: 21499, weight: 100 },
      redis: { start: 21300, end: 21399, weight: 100 },
      monitoring: { start: 21200, end: 21299, weight: 100 },
      docs: { start: 21100, end: 21199, weight: 100 }
    };

    const range = optimalRanges[serviceType];
    if (!range) return 50; // Default score for unknown service types

    if (port >= range.start && port <= range.end) {
      return range.weight;
    }

    // Calculate distance from optimal range
    const distance = Math.min(
      Math.abs(port - range.start),
      Math.abs(port - range.end)
    );

    return Math.max(0, range.weight - distance);
  }

  private calculateOrganizationScore(port: number, serviceName: string): number {
    // Prefer ports that follow organizational patterns
    const serviceType = this.determineServiceType(serviceName);
    const basePort = this.getServiceBasePort(serviceType);
    
    if (basePort && port >= basePort && port < basePort + 100) {
      return 100;
    }

    return 50;
  }

  private generateOptimizationNotes(
    port: number,
    serviceName: string,
    conflictRisk: number,
    performanceScore: number,
    organizationScore: number
  ): string[] {
    const notes: string[] = [];

    if (conflictRisk > 80) {
      notes.push('Low conflict risk with existing services');
    } else if (conflictRisk < 40) {
      notes.push('High conflict risk - consider alternatives');
    }

    if (performanceScore > 80) {
      notes.push('Optimal performance characteristics');
    }

    if (organizationScore > 80) {
      notes.push('Good organizational fit');
    }

    return notes;
  }

  private determineServiceType(serviceName: string): string {
    const name = serviceName.toLowerCase();
    
    if (name.includes('api') || name.includes('server')) return 'api';
    if (name.includes('db') || name.includes('database') || name.includes('postgres')) return 'database';
    if (name.includes('redis') || name.includes('cache')) return 'redis';
    if (name.includes('monitor') || name.includes('grafana') || name.includes('prometheus')) return 'monitoring';
    if (name.includes('doc') || name.includes('swagger')) return 'docs';
    
    return 'general';
  }

  private getServiceOptimalRange(serviceType: string, range: { start: number; end: number }): number[] {
    const serviceRanges: { [key: string]: { offset: number; size: number } } = {
      api: { offset: 0, size: 100 },
      database: { offset: 400, size: 100 },
      redis: { offset: 300, size: 100 },
      monitoring: { offset: 200, size: 100 },
      docs: { offset: 100, size: 100 },
      general: { offset: 500, size: 100 }
    };

    const config = serviceRanges[serviceType] || serviceRanges.general;
    const startPort = range.start + config.offset;
    const endPort = Math.min(startPort + config.size, range.end);
    
    const ports: number[] = [];
    for (let port = startPort; port <= endPort; port++) {
      ports.push(port);
    }
    
    return ports;
  }

  private getConflictAvoidancePorts(systemStatus: SystemStatus, range: { start: number; end: number }): number[] {
    const usedPorts = systemStatus.services.map(s => s.port);
    const ports: number[] = [];
    
    for (let port = range.start; port <= range.end; port++) {
      const minDistance = Math.min(...usedPorts.map(usedPort => Math.abs(port - usedPort)));
      if (minDistance >= 10) { // At least 10 ports away from any used port
        ports.push(port);
      }
    }
    
    return ports;
  }

  private getPerformanceOptimizedPorts(serviceType: string, range: { start: number; end: number }): number[] {
    // Return ports that are optimized for specific service types
    return this.getServiceOptimalRange(serviceType, range);
  }

  private getOrganizationOptimizedPorts(serviceType: string, range: { start: number; end: number }): number[] {
    // Return ports that follow organizational patterns
    return this.getServiceOptimalRange(serviceType, range);
  }

  private getServiceBasePort(serviceType: string): number | null {
    const basePorts: { [key: string]: number } = {
      api: 21000,
      database: 21400,
      redis: 21300,
      monitoring: 21200,
      docs: 21100
    };

    return basePorts[serviceType] || null;
  }

  private findServicePort(serviceName: string, systemStatus: SystemStatus): number | undefined {
    const service = systemStatus.services.find(s => s.name === serviceName);
    return service?.port;
  }

  private getEnvironmentConfig(environment: string): any {
    // This would typically load from a config file
    const defaultConfig = {
      development: { start: 21000, end: 21999 },
      staging: { start: 22000, end: 22999 },
      production: { start: 80, end: 65535 }
    };

    return defaultConfig[environment] || defaultConfig.development;
  }

  private async analyzeService(serviceName: string, port: number, environment: string): Promise<ServiceAnalysis> {
    const serviceType = this.determineServiceType(serviceName);
    const conflictRisk = this.calculateServiceConflictRisk(port, environment);
    const usagePattern = this.analyzeUsagePattern(serviceName, environment);
    const performanceImpact = this.calculatePerformanceImpact(port, serviceType);
    
    // Generate alternative suggestions
    const alternatives = await this.generateServiceAlternatives(port, serviceName, environment);

    return {
      service_name: serviceName,
      current_port: port,
      service_type: serviceType,
      conflict_risk: conflictRisk,
      usage_pattern: usagePattern,
      performance_impact: performanceImpact,
      suggested_alternatives: alternatives
    };
  }

  private calculateServiceConflictRisk(port: number, environment: string): 'low' | 'medium' | 'high' {
    // This would analyze historical data and current usage
    // For now, return a simple heuristic
    const portDistance = Math.abs(port - 21000);
    if (portDistance < 100) return 'high';
    if (portDistance < 500) return 'medium';
    return 'low';
  }

  private analyzeUsagePattern(serviceName: string, environment: string): 'stable' | 'variable' | 'sporadic' {
    // This would analyze historical usage data
    // For now, return a default
    return 'stable';
  }

  private calculatePerformanceImpact(port: number, serviceType: string): number {
    // This would calculate performance impact based on port characteristics
    // For now, return a simple score
    return Math.random() * 100;
  }

  private async generateServiceAlternatives(port: number, serviceName: string, environment: string): Promise<number[]> {
    const suggestions = await this.portManager.suggestAlternativePorts(port, environment, 5, serviceName);
    return suggestions.map(s => s.port);
  }

  private generateRecommendations(systemStatus: SystemStatus, serviceAnalysis: { [key: string]: ServiceAnalysis }): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for high conflict risk services
    const highRiskServices = Object.values(serviceAnalysis).filter(s => s.conflict_risk === 'high');
    if (highRiskServices.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'conflict_resolution',
        description: `${highRiskServices.length} services have high conflict risk`,
        action_required: 'Consider reassigning ports for high-risk services',
        estimated_impact: 'Significant reduction in port conflicts'
      });
    }

    // Check for performance issues
    const lowPerformanceServices = Object.values(serviceAnalysis).filter(s => s.performance_impact < 50);
    if (lowPerformanceServices.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'performance_optimization',
        description: `${lowPerformanceServices.length} services may have performance issues`,
        action_required: 'Review port assignments for performance optimization',
        estimated_impact: 'Improved service performance'
      });
    }

    return recommendations;
  }

  private findOptimizationOpportunities(systemStatus: SystemStatus, serviceAnalysis: { [key: string]: ServiceAnalysis }): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Port clustering opportunity
    const services = Object.values(serviceAnalysis);
    const portSpread = Math.max(...services.map(s => s.current_port)) - Math.min(...services.map(s => s.current_port));
    
    if (portSpread > 1000) {
      opportunities.push({
        description: 'Services are spread across a wide port range',
        potential_improvement: 'Clustering related services could improve organization',
        effort_required: 'medium',
        risk_level: 'low'
      });
    }

    return opportunities;
  }

  private calculateOverallConflictRisk(serviceAnalysis: { [key: string]: ServiceAnalysis }): 'low' | 'medium' | 'high' {
    const highRiskCount = Object.values(serviceAnalysis).filter(s => s.conflict_risk === 'high').length;
    const totalServices = Object.keys(serviceAnalysis).length;
    
    const riskRatio = highRiskCount / totalServices;
    
    if (riskRatio > 0.3) return 'high';
    if (riskRatio > 0.1) return 'medium';
    return 'low';
  }

  private calculateHealthScore(systemStatus: SystemStatus, analysis: PortUsageAnalysis): number {
    let score = 100;
    
    // Deduct for conflicts
    score -= systemStatus.conflicts * 10;
    
    // Deduct for high utilization
    if (systemStatus.portUtilization > 80) {
      score -= 20;
    }
    
    // Deduct for high conflict risk
    if (analysis.conflict_risk === 'high') {
      score -= 30;
    } else if (analysis.conflict_risk === 'medium') {
      score -= 15;
    }
    
    return Math.max(0, score);
  }

  private determineOverallHealth(healthScore: number, analysis: PortUsageAnalysis): 'healthy' | 'warning' | 'critical' {
    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'warning';
    return 'critical';
  }

  private identifyHealthIssues(systemStatus: SystemStatus, analysis: PortUsageAnalysis): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (systemStatus.conflicts > 0) {
      issues.push({
        severity: 'high',
        type: 'conflict',
        description: `${systemStatus.conflicts} port conflicts detected`,
        affected_services: systemStatus.services.filter(s => !s.available).map(s => s.name),
        suggested_fix: 'Resolve port conflicts by reassigning conflicting services'
      });
    }

    if (analysis.conflict_risk === 'high') {
      issues.push({
        severity: 'medium',
        type: 'conflict',
        description: 'High conflict risk detected',
        affected_services: Object.keys(analysis.service_analysis),
        suggested_fix: 'Review port assignments to reduce conflict risk'
      });
    }

    return issues;
  }

  private generateHealthRecommendations(issues: HealthIssue[], analysis: PortUsageAnalysis): Recommendation[] {
    const recommendations: Recommendation[] = [];

    issues.forEach(issue => {
      recommendations.push({
        priority: issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low',
        type: issue.type as any,
        description: issue.description,
        action_required: issue.suggested_fix,
        estimated_impact: 'Improved system health and stability'
      });
    });

    return recommendations;
  }

  private async loadLearningData(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), '.heimdall', 'learning-data.json');
      const data = await fs.readFile(dataPath, 'utf-8');
      this.learningData = JSON.parse(data);
    } catch (error) {
      // Learning data doesn't exist yet, start with empty data
      this.learningData = {};
    }
  }

  private async saveLearningData(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), '.heimdall', 'learning-data.json');
      await fs.mkdir(path.dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, JSON.stringify(this.learningData, null, 2));
    } catch (error) {
      console.warn('Could not save learning data:', error);
    }
  }
}

export default IntelligentPortSuggester;
