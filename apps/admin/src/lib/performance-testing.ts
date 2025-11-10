import { measurePerformance, getPerformanceMetrics, PerformanceMetrics } from './performance-utils';

export interface PerformanceTestResult {
  testName: string;
  passed: boolean;
  metrics: PerformanceMetrics;
  threshold: PerformanceThreshold;
  score: number;
  recommendations: string[];
}

export interface PerformanceThreshold {
  maxLoadTime: number; // milliseconds
  maxBundleSize: number; // bytes
  maxMemoryUsage: number; // bytes
  minCacheHitRate: number; // 0-1
  maxRenderTime: number; // milliseconds
}

export const DEFAULT_THRESHOLDS: PerformanceThreshold = {
  maxLoadTime: 2000, // 2 seconds
  maxBundleSize: 500 * 1024, // 500KB
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  minCacheHitRate: 0.8, // 80%
  maxRenderTime: 100, // 100ms
};

export class PerformanceTester {
  private thresholds: PerformanceThreshold;
  private results: PerformanceTestResult[] = [];

  constructor(thresholds: PerformanceThreshold = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  async runLoadTimeTest(testName: string = 'load-time-test'): Promise<PerformanceTestResult> {
    const startTime = performance.now();
    
    // Simulate dashboard loading
    await measurePerformance('dashboard-load', async () => {
      // Simulate async operations
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    const metrics = await getPerformanceMetrics();
    const passed = loadTime <= this.thresholds.maxLoadTime;
    const score = Math.max(0, 100 - (loadTime / this.thresholds.maxLoadTime) * 100);
    
    const recommendations = this.generateRecommendations(metrics, this.thresholds);
    
    const result: PerformanceTestResult = {
      testName,
      passed,
      metrics: { ...metrics, loadTime },
      threshold: this.thresholds,
      score,
      recommendations
    };

    this.results.push(result);
    return result;
  }

  async runBundleSizeTest(testName: string = 'bundle-size-test'): Promise<PerformanceTestResult> {
    const metrics = await getPerformanceMetrics();
    const passed = metrics.bundleSize <= this.thresholds.maxBundleSize;
    const score = Math.max(0, 100 - (metrics.bundleSize / this.thresholds.maxBundleSize) * 100);
    
    const recommendations = this.generateRecommendations(metrics, this.thresholds);
    
    const result: PerformanceTestResult = {
      testName,
      passed,
      metrics,
      threshold: this.thresholds,
      score,
      recommendations
    };

    this.results.push(result);
    return result;
  }

  async runMemoryUsageTest(testName: string = 'memory-usage-test'): Promise<PerformanceTestResult> {
    const metrics = await getPerformanceMetrics();
    const passed = metrics.memoryUsage <= this.thresholds.maxMemoryUsage;
    const score = Math.max(0, 100 - (metrics.memoryUsage / this.thresholds.maxMemoryUsage) * 100);
    
    const recommendations = this.generateRecommendations(metrics, this.thresholds);
    
    const result: PerformanceTestResult = {
      testName,
      passed,
      metrics,
      threshold: this.thresholds,
      score,
      recommendations
    };

    this.results.push(result);
    return result;
  }

  async runRenderTimeTest(testName: string = 'render-time-test'): Promise<PerformanceTestResult> {
    const startTime = performance.now();
    
    // Simulate component rendering
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    const metrics = await getPerformanceMetrics();
    const passed = renderTime <= this.thresholds.maxRenderTime;
    const score = Math.max(0, 100 - (renderTime / this.thresholds.maxRenderTime) * 100);
    
    const recommendations = this.generateRecommendations(metrics, this.thresholds);
    
    const result: PerformanceTestResult = {
      testName,
      passed,
      metrics: { ...metrics, renderTime },
      threshold: this.thresholds,
      score,
      recommendations
    };

    this.results.push(result);
    return result;
  }

  async runComprehensiveTest(): Promise<PerformanceTestResult[]> {
    this.results = [];
    
    await this.runLoadTimeTest();
    await this.runBundleSizeTest();
    await this.runMemoryUsageTest();
    await this.runRenderTimeTest();
    
    return this.results;
  }

  private generateRecommendations(metrics: PerformanceMetrics, thresholds: PerformanceThreshold): string[] {
    const recommendations: string[] = [];

    if (metrics.loadTime > thresholds.maxLoadTime) {
      recommendations.push('Consider implementing code splitting and lazy loading');
      recommendations.push('Optimize bundle size and reduce initial load');
    }

    if (metrics.bundleSize > thresholds.maxBundleSize) {
      recommendations.push('Use tree shaking to remove unused code');
      recommendations.push('Consider dynamic imports for large dependencies');
    }

    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      recommendations.push('Implement memory cleanup and garbage collection');
      recommendations.push('Use React.memo and useMemo for expensive components');
    }

    if (metrics.cacheHitRate < thresholds.minCacheHitRate) {
      recommendations.push('Improve caching strategy and cache invalidation');
      recommendations.push('Use service workers for better caching');
    }

    if (metrics.renderTime > thresholds.maxRenderTime) {
      recommendations.push('Optimize component rendering with React.memo');
      recommendations.push('Use useCallback and useMemo for expensive operations');
    }

    return recommendations;
  }

  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  getOverallScore(): number {
    if (this.results.length === 0) return 0;
    
    const totalScore = this.results.reduce((sum, result) => sum + result.score, 0);
    return totalScore / this.results.length;
  }

  getPassedTests(): number {
    return this.results.filter(result => result.passed).length;
  }

  getTotalTests(): number {
    return this.results.length;
  }

  generateReport(): string {
    const overallScore = this.getOverallScore();
    const passedTests = this.getPassedTests();
    const totalTests = this.getTotalTests();
    
    let report = `# Performance Test Report\n\n`;
    report += `**Overall Score:** ${overallScore.toFixed(1)}/100\n`;
    report += `**Tests Passed:** ${passedTests}/${totalTests}\n\n`;
    
    report += `## Test Results\n\n`;
    
    this.results.forEach(result => {
      report += `### ${result.testName}\n`;
      report += `- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `- **Score:** ${result.score.toFixed(1)}/100\n`;
      report += `- **Load Time:** ${result.metrics.loadTime.toFixed(2)}ms\n`;
      report += `- **Bundle Size:** ${(result.metrics.bundleSize / 1024).toFixed(2)}KB\n`;
      report += `- **Memory Usage:** ${(result.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
      report += `- **Cache Hit Rate:** ${(result.metrics.cacheHitRate * 100).toFixed(1)}%\n`;
      
      if (result.recommendations.length > 0) {
        report += `- **Recommendations:**\n`;
        result.recommendations.forEach(rec => {
          report += `  - ${rec}\n`;
        });
      }
      
      report += `\n`;
    });
    
    return report;
  }
}

// Utility functions for easy testing
export const runQuickPerformanceTest = async (): Promise<PerformanceTestResult[]> => {
  const tester = new PerformanceTester();
  return await tester.runComprehensiveTest();
};

export const runPerformanceTestWithCustomThresholds = async (
  thresholds: PerformanceThreshold
): Promise<PerformanceTestResult[]> => {
  const tester = new PerformanceTester(thresholds);
  return await tester.runComprehensiveTest();
};

export const generatePerformanceReport = async (): Promise<string> => {
  const tester = new PerformanceTester();
  await tester.runComprehensiveTest();
  return tester.generateReport();
};

export default PerformanceTester;

