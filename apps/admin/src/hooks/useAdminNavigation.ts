import { useCallback } from 'react';
import { useAdminRouter } from '../components/admin/AdminRouter';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiredRole?: string[];
  requiredPermissions?: string[];
  badge?: string | number;
  children?: NavigationItem[];
}

export function useAdminNavigation() {
  const { currentUser, navigate, canAccess, hasPermission, hasRole } = useAdminRouter();

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/admin',
      requiredRole: ['owner', 'admin', 'member', 'viewer']
    },
    {
      id: 'users',
      label: 'Users',
      path: '/admin/users',
      requiredRole: ['owner', 'admin'],
      requiredPermissions: ['users:read']
    },
    {
      id: 'organizations',
      label: 'Organizations',
      path: '/admin/organizations',
      requiredRole: ['owner', 'admin'],
      requiredPermissions: ['organizations:read']
    },
    {
      id: 'security',
      label: 'Security',
      path: '/admin/security',
      requiredRole: ['owner', 'admin'],
      requiredPermissions: ['security:read']
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: '/admin/analytics',
      requiredRole: ['owner', 'admin', 'member'],
      requiredPermissions: ['analytics:read']
    },
    {
      id: 'system',
      label: 'System',
      path: '/admin/system',
      requiredRole: ['owner'],
      requiredPermissions: ['system:read']
    }
  ];

  const getFilteredNavigationItems = useCallback((): NavigationItem[] => {
    return navigationItems.filter(item => {
      // Check role requirements
      if (item.requiredRole && !item.requiredRole.includes(currentUser?.role || '')) {
        return false;
      }

      // Check permission requirements
      if (item.requiredPermissions) {
        const hasAllPermissions = item.requiredPermissions.every(permission =>
          hasPermission(permission)
        );
        if (!hasAllPermissions) return false;
      }

      return true;
    });
  }, [currentUser, hasPermission]);

  const navigateTo = useCallback((path: string) => {
    if (canAccess(path)) {
      navigate(path);
    } else {
      console.warn(`Access denied to path: ${path}`);
    }
  }, [navigate, canAccess]);

  const isCurrentRoute = useCallback((path: string): boolean => {
    return window.location.pathname === path;
  }, []);

  const getBreadcrumbs = useCallback((currentPath: string) => {
    const breadcrumbs = [];
    const pathSegments = currentPath.split('/').filter(Boolean);
    
    let currentBreadcrumbPath = '';
    for (const segment of pathSegments) {
      currentBreadcrumbPath += `/${segment}`;
      const item = navigationItems.find(nav => nav.path === currentBreadcrumbPath);
      if (item) {
        breadcrumbs.push({
          label: item.label,
          path: currentBreadcrumbPath
        });
      }
    }
    
    return breadcrumbs;
  }, [navigationItems]);

  const getNavigationItem = useCallback((path: string): NavigationItem | undefined => {
    return navigationItems.find(item => item.path === path);
  }, [navigationItems]);

  return {
    navigationItems: getFilteredNavigationItems(),
    navigateTo,
    isCurrentRoute,
    getBreadcrumbs,
    getNavigationItem,
    canAccess,
    hasPermission,
    hasRole
  };
}

export default useAdminNavigation;

