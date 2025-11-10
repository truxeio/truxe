import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { UserManagement } from './UserManagement';
import { SecurityMonitoring } from './SecurityMonitoring';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  permissions?: string[];
}

export interface AdminRoute {
  path: string;
  component: React.ComponentType<any>;
  title: string;
  requiredRole?: string[];
  requiredPermissions?: string[];
  exact?: boolean;
}

export interface AdminRouterContextType {
  currentUser: User | null;
  currentRoute: string;
  navigate: (path: string) => void;
  canAccess: (path: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AdminRouterContext = createContext<AdminRouterContextType | null>(null);

export const useAdminRouter = () => {
  const context = useContext(AdminRouterContext);
  if (!context) {
    throw new Error('useAdminRouter must be used within AdminRouterProvider');
  }
  return context;
};

export interface AdminRouterProps {
  user: User | null;
  onLogout?: () => void;
  children?: React.ReactNode;
  className?: string;
}

// Define admin routes with role-based access
const adminRoutes: AdminRoute[] = [
  {
    path: '/admin',
    component: AdminDashboard,
    title: 'Dashboard',
    requiredRole: ['owner', 'admin', 'member', 'viewer'],
    exact: true
  },
  {
    path: '/admin/users',
    component: UserManagement,
    title: 'User Management',
    requiredRole: ['owner', 'admin'],
    requiredPermissions: ['users:read', 'users:write']
  },
  {
    path: '/admin/organizations',
    component: () => <div>Organizations</div>,
    title: 'Organizations',
    requiredRole: ['owner', 'admin'],
    requiredPermissions: ['organizations:read', 'organizations:write']
  },
  {
    path: '/admin/security',
    component: SecurityMonitoring,
    title: 'Security',
    requiredRole: ['owner', 'admin'],
    requiredPermissions: ['security:read']
  },
  {
    path: '/admin/analytics',
    component: () => <div>Analytics</div>,
    title: 'Analytics',
    requiredRole: ['owner', 'admin', 'member'],
    requiredPermissions: ['analytics:read']
  },
  {
    path: '/admin/system',
    component: () => <div>System</div>,
    title: 'System',
    requiredRole: ['owner'],
    requiredPermissions: ['system:read', 'system:write']
  }
];

export function AdminRouter({ user, onLogout, children, className }: AdminRouterProps) {
  const [currentRoute, setCurrentRoute] = useState('/admin');
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const navigate = (path: string) => {
    if (canAccess(path)) {
      setCurrentRoute(path);
      // Update browser URL without page reload
      window.history.pushState({}, '', path);
    }
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;

    const route = adminRoutes.find(r => 
      r.exact ? r.path === path : path.startsWith(r.path)
    );

    if (!route) return false;

    // Check role requirements
    if (route.requiredRole && !route.requiredRole.includes(user.role)) {
      return false;
    }

    // Check permission requirements
    if (route.requiredPermissions && user.permissions) {
      const hasAllPermissions = route.requiredPermissions.every(permission =>
        user.permissions?.includes(permission)
      );
      if (!hasAllPermissions) return false;
    }

    return true;
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const getCurrentRoute = (): AdminRoute | null => {
    return adminRoutes.find(r => 
      r.exact ? r.path === currentRoute : currentRoute.startsWith(r.path)
    ) || null;
  };

  const renderCurrentRoute = () => {
    const route = getCurrentRoute();
    if (!route) {
      return <div>Route not found</div>;
    }

    const Component = route.component;
    return <Component />;
  };

  const contextValue: AdminRouterContextType = {
    currentUser: user,
    currentRoute,
    navigate,
    canAccess,
    hasPermission,
    hasRole
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please log in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminRouterContext.Provider value={contextValue}>
      <AdminLayout
        user={user}
        onLogout={onLogout}
        className={className}
      >
        {children || renderCurrentRoute()}
      </AdminLayout>
    </AdminRouterContext.Provider>
  );
}

export default AdminRouter;

