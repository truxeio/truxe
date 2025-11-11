import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LazyAdminLayout, 
  LazyAdminDashboard, 
  LazyUserManagement, 
  LazySecurityMonitoring,
  preloadAllAdminComponents 
} from './LazyAdminComponents';
import { PerformanceMonitor } from './PerformanceMonitor';
import { usePerformanceOptimization } from '../../lib/performance-utils';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface PerformanceOptimizedAdminProps {
  initialRoute?: string;
  enablePerformanceMonitoring?: boolean;
  preloadComponents?: boolean;
  className?: string;
}

export const PerformanceOptimizedAdmin: React.FC<PerformanceOptimizedAdminProps> = ({
  initialRoute = '/dashboard',
  enablePerformanceMonitoring = false,
  preloadComponents = true,
  className = ''
}) => {
  const [currentRoute, setCurrentRoute] = useState(initialRoute);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    isOptimized,
    enableOptimizations,
    disableOptimizations,
    getOptimizationStatus
  } = usePerformanceOptimization();

  // Preload components on mount
  useEffect(() => {
    if (preloadComponents) {
      preloadAllAdminComponents();
    }
  }, [preloadComponents]);

  // Initialize performance optimizations
  useEffect(() => {
    enableOptimizations();
    setIsInitialized(true);
  }, [enableOptimizations]);

  const handleRouteChange = useCallback((route: string) => {
    setCurrentRoute(route);
  }, []);

  const handlePerformanceMetricsUpdate = useCallback((metrics: any) => {
    // Log performance metrics for monitoring
    console.log('Performance metrics updated:', metrics);
    
    // You could send metrics to analytics service here
    // analytics.track('admin_dashboard_performance', metrics);
  }, []);

  // Memoized route component to prevent unnecessary re-renders
  const RouteComponent = useMemo(() => {
    switch (currentRoute) {
      case '/dashboard':
        return LazyAdminDashboard;
      case '/users':
        return LazyUserManagement;
      case '/security':
        return LazySecurityMonitoring;
      default:
        return LazyAdminDashboard;
    }
  }, [currentRoute]);

  // Loading fallback with performance info
  const LoadingFallback = () => (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <LoadingSpinner size="lg" />
      <div className="text-center">
        <p className="text-gray-600">Loading admin dashboard...</p>
        {isOptimized && (
          <p className="text-sm text-green-600 mt-1">
            Performance optimizations enabled
          </p>
        )}
      </div>
    </div>
  );

  if (!isInitialized) {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary>
      <div className={`performance-optimized-admin ${className}`}>
        {/* Performance Monitor */}
        {enablePerformanceMonitoring && (
          <div className="fixed top-4 right-4 z-50">
            <PerformanceMonitor
              onMetricsUpdate={handlePerformanceMetricsUpdate}
              showMetrics={true}
            />
          </div>
        )}

        {/* Main Admin Layout */}
        <LazyAdminLayout
          currentRoute={currentRoute}
          onRouteChange={handleRouteChange}
        >
          <Suspense fallback={<LoadingFallback />}>
            <RouteComponent />
          </Suspense>
        </LazyAdminLayout>

        {/* Performance Status Indicator */}
        <div className="fixed bottom-4 left-4 z-50">
          <div className={`px-3 py-1 text-xs rounded-full ${
            isOptimized 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isOptimized ? 'Optimized' : 'Standard'}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default PerformanceOptimizedAdmin;

