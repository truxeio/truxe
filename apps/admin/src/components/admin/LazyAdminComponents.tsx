import React, { Suspense } from 'react';
import { createLazyComponent } from '../../lib/performance-utils';
import { LoadingSpinner } from '../ui/LoadingSpinner';

// Loading fallback component
const AdminLoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <LoadingSpinner size="lg" />
    <span className="ml-2 text-gray-600">Loading admin component...</span>
  </div>
);

// Lazy-loaded admin components
export const LazyAdminDashboard = createLazyComponent(
  () => import('./AdminDashboard'),
  AdminLoadingFallback
);

export const LazyUserManagement = createLazyComponent(
  () => import('./UserManagement'),
  AdminLoadingFallback
);

export const LazySecurityMonitoring = createLazyComponent(
  () => import('./SecurityMonitoring'),
  AdminLoadingFallback
);

export const LazyDataTable = createLazyComponent(
  () => import('./DataTable'),
  AdminLoadingFallback
);

export const LazyAdminLayout = createLazyComponent(
  () => import('./AdminLayout'),
  AdminLoadingFallback
);

export const LazyAdminRouter = createLazyComponent(
  () => import('./AdminRouter'),
  AdminLoadingFallback
);

// Lazy-loaded supporting components
export const LazySidebar = createLazyComponent(
  () => import('./Sidebar'),
  () => <div className="w-64 h-full bg-gray-100 animate-pulse" />
);

export const LazyTopBar = createLazyComponent(
  () => import('./TopBar'),
  () => <div className="h-16 bg-gray-100 animate-pulse" />
);

export const LazyStatsCard = createLazyComponent(
  () => import('./StatsCard'),
  () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
);

export const LazyModal = createLazyComponent(
  () => import('./Modal'),
  () => null
);

export const LazyFormField = createLazyComponent(
  () => import('./FormField'),
  () => <div className="h-10 bg-gray-100 rounded animate-pulse" />
);

export const LazyBadge = createLazyComponent(
  () => import('./Badge'),
  () => <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
);

export const LazyCard = createLazyComponent(
  () => import('./Card'),
  () => <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
);

export const LazyBreadcrumb = createLazyComponent(
  () => import('./Breadcrumb'),
  () => <div className="h-6 bg-gray-100 rounded animate-pulse" />
);

// Lazy-loaded complete dashboard
export const LazyAdminDashboardComplete = createLazyComponent(
  () => import('./AdminDashboardComplete'),
  AdminLoadingFallback
);

// Preload functions for critical components
export const preloadAdminDashboard = () => import('./AdminDashboard');
export const preloadUserManagement = () => import('./UserManagement');
export const preloadSecurityMonitoring = () => import('./SecurityMonitoring');
export const preloadDataTable = () => import('./DataTable');

// Preload all admin components
export const preloadAllAdminComponents = () => {
  preloadAdminDashboard();
  preloadUserManagement();
  preloadSecurityMonitoring();
  preloadDataTable();
};

// Export all lazy components
export const LazyAdminComponents = {
  LazyAdminDashboard,
  LazyUserManagement,
  LazySecurityMonitoring,
  LazyDataTable,
  LazyAdminLayout,
  LazyAdminRouter,
  LazySidebar,
  LazyTopBar,
  LazyStatsCard,
  LazyModal,
  LazyFormField,
  LazyBadge,
  LazyCard,
  LazyBreadcrumb,
  LazyAdminDashboardComplete,
} as const;

export default LazyAdminComponents;

