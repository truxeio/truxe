import React, { useEffect, useState, useCallback } from 'react';
import { measurePerformance, getPerformanceMetrics, PerformanceMetrics } from '../../lib/performance-utils';

interface PerformanceMonitorProps {
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  showMetrics?: boolean;
  className?: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  onMetricsUpdate,
  showMetrics = false,
  className = ''
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const updateMetrics = useCallback(async () => {
    try {
      const currentMetrics = await getPerformanceMetrics();
      setMetrics(currentMetrics);
      onMetricsUpdate?.(currentMetrics);
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
    }
  }, [onMetricsUpdate]);

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(updateMetrics, 1000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring, updateMetrics]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    measurePerformance('admin-dashboard-load', () => {
      // This will be called when the dashboard finishes loading
      updateMetrics();
    });
  }, [updateMetrics]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!showMetrics && !isMonitoring) {
    return (
      <div className={`performance-monitor ${className}`}>
        <button
          onClick={startMonitoring}
          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Start Performance Monitor
        </button>
      </div>
    );
  }

  return (
    <div className={`performance-monitor ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={isMonitoring ? stopMonitoring : startMonitoring}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            isMonitoring
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isMonitoring ? 'Stop' : 'Start'} Monitoring
        </button>
        <span className="text-xs text-gray-600">
          {isMonitoring ? 'Monitoring...' : 'Stopped'}
        </span>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Load Time</div>
            <div className="text-lg font-mono">
              {formatTime(metrics.loadTime)}
            </div>
          </div>
          
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Bundle Size</div>
            <div className="text-lg font-mono">
              {formatBytes(metrics.bundleSize)}
            </div>
          </div>
          
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Memory Usage</div>
            <div className="text-lg font-mono">
              {formatBytes(metrics.memoryUsage)}
            </div>
          </div>
          
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Components</div>
            <div className="text-lg font-mono">
              {metrics.componentCount}
            </div>
          </div>
          
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Render Time</div>
            <div className="text-lg font-mono">
              {formatTime(metrics.renderTime)}
            </div>
          </div>
          
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">Cache Hit Rate</div>
            <div className="text-lg font-mono">
              {(metrics.cacheHitRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;

