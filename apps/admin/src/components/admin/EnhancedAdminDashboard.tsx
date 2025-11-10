import React, { useState, useEffect, Suspense } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Menu, 
  X, 
  Home, 
  Users, 
  Shield, 
  Settings, 
  BarChart3, 
  Bell,
  Search,
  User,
  LogOut,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  lastActive?: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface StatsCardData {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string[];
  badge?: string | number;
  isActive?: boolean;
}

// Enhanced Admin Layout Component
export interface EnhancedAdminLayoutProps {
  children: React.ReactNode;
  user?: User;
  onLogout?: () => void;
  className?: string;
  initialSidebarOpen?: boolean;
}

export function EnhancedAdminLayout({ 
  children, 
  user, 
  onLogout, 
  className,
  initialSidebarOpen = false
}: EnhancedAdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentRoute, setCurrentRoute] = useState('/admin');

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Navigation items with role-based access
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin',
      icon: Home,
      requiredRole: ['owner', 'admin', 'member', 'viewer'],
      isActive: currentRoute === '/admin'
    },
    {
      id: 'users',
      label: 'Users',
      href: '/admin/users',
      icon: Users,
      requiredRole: ['owner', 'admin'],
      badge: 12,
      isActive: currentRoute === '/admin/users'
    },
    {
      id: 'organizations',
      label: 'Organizations',
      href: '/admin/organizations',
      icon: Settings,
      requiredRole: ['owner', 'admin'],
      isActive: currentRoute === '/admin/organizations'
    },
    {
      id: 'security',
      label: 'Security',
      href: '/admin/security',
      icon: Shield,
      requiredRole: ['owner', 'admin'],
      badge: 3,
      isActive: currentRoute === '/admin/security'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      requiredRole: ['owner', 'admin', 'member'],
      isActive: currentRoute === '/admin/analytics'
    },
    {
      id: 'system',
      label: 'System',
      href: '/admin/system',
      icon: Settings,
      requiredRole: ['owner'],
      isActive: currentRoute === '/admin/system'
    }
  ];

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => 
    !item.requiredRole || (user?.role && item.requiredRole.includes(user.role))
  );

  const handleNavigation = (href: string) => {
    setCurrentRoute(href);
    // In a real app, this would use React Router or similar
    console.log('Navigate to:', href);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">Truxe</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {filteredNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      item.isActive 
                        ? "bg-blue-100 text-blue-900 border-r-2 border-blue-600" 
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500" />
                    {item.label}
                    {item.badge && (
                      <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <img
                    className="w-8 h-8 rounded-full"
                    src={user.avatar}
                    alt={user.name}
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.role}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="ml-2"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              {/* Search */}
              <div className="ml-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </Button>

              {/* User menu */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  {user.avatar ? (
                    <img
                      className="w-8 h-8 rounded-full"
                      src={user.avatar}
                      alt={user.name}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Stats Card Component
export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color, 
  className 
}: StatsCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-500 text-white';
      case 'green':
        return 'bg-green-500 text-white';
      case 'yellow':
        return 'bg-yellow-500 text-white';
      case 'red':
        return 'bg-red-500 text-white';
      case 'purple':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className={cn("bg-white overflow-hidden shadow rounded-lg", className)}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={cn("p-3 rounded-md", getColorClasses(color))}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {value}
                </div>
                {change && (
                  <div className={cn(
                    "ml-2 flex items-baseline text-sm font-semibold",
                    change.type === 'increase' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {change.type === 'increase' ? '+' : '-'}{change.value}%
                    <span className="sr-only"> {change.type} from {change.period}</span>
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Admin Dashboard Component
export interface EnhancedAdminDashboardProps {
  user?: User;
  onLogout?: () => void;
  className?: string;
}

export function EnhancedAdminDashboard({ 
  user, 
  onLogout, 
  className 
}: EnhancedAdminDashboardProps) {
  // Sample data
  const statsData: StatsCardData[] = [
    {
      title: 'Total Users',
      value: '2,847',
      change: { value: 12.5, type: 'increase', period: 'last month' },
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Sessions',
      value: '1,234',
      change: { value: 8.2, type: 'increase', period: 'last week' },
      icon: Activity,
      color: 'green'
    },
    {
      title: 'Security Alerts',
      value: '3',
      change: { value: 15.0, type: 'decrease', period: 'last 24h' },
      icon: AlertTriangle,
      color: 'yellow'
    },
    {
      title: 'System Health',
      value: '99.9%',
      change: { value: 0.1, type: 'increase', period: 'last hour' },
      icon: CheckCircle,
      color: 'green'
    }
  ];

  const recentActivity = [
    { id: 1, user: 'John Doe', action: 'Logged in', time: '2 minutes ago', status: 'success' },
    { id: 2, user: 'Jane Smith', action: 'Updated profile', time: '5 minutes ago', status: 'info' },
    { id: 3, user: 'Bob Johnson', action: 'Failed login attempt', time: '10 minutes ago', status: 'error' },
    { id: 4, user: 'Alice Brown', action: 'Created organization', time: '15 minutes ago', status: 'success' },
    { id: 5, user: 'Charlie Wilson', action: 'Password reset', time: '20 minutes ago', status: 'warning' }
  ];

  return (
    <EnhancedAdminLayout user={user} onLogout={onLogout} className={className}>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.name || 'Admin'}. Here's what's happening with your system.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              change={stat.change}
              icon={stat.icon}
              color={stat.color}
            />
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Activity
              </h3>
              <div className="mt-5">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {recentActivity.map((activity, activityIdx) => (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {activityIdx !== recentActivity.length - 1 ? (
                            <span
                              className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white",
                                activity.status === 'success' ? 'bg-green-500' :
                                activity.status === 'error' ? 'bg-red-500' :
                                activity.status === 'warning' ? 'bg-yellow-500' :
                                'bg-blue-500'
                              )}>
                                {activity.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4 text-white" />
                                ) : activity.status === 'error' ? (
                                  <AlertTriangle className="w-4 h-4 text-white" />
                                ) : (
                                  <Clock className="w-4 h-4 text-white" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-500">
                                  <span className="font-medium text-gray-900">{activity.user}</span> {activity.action}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                {activity.time}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Quick Actions
              </h3>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <Button className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Add User
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Security Scan
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Reports
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </EnhancedAdminLayout>
  );
}

export default EnhancedAdminDashboard;
