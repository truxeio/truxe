import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { 
  Home, 
  Users, 
  Shield, 
  Settings, 
  BarChart3, 
  Bell,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  currentRoute?: string;
  onRouteChange?: (route: string) => void;
  onClose?: () => void;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    avatar?: string;
  };
  onLogout?: () => void;
  className?: string;
}

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string[];
  badge?: string | number;
  isActive?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: Home,
    requiredRole: ['owner', 'admin', 'member', 'viewer']
  },
  {
    id: 'users',
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    requiredRole: ['owner', 'admin']
  },
  {
    id: 'organizations',
    label: 'Organizations',
    href: '/admin/organizations',
    icon: Settings,
    requiredRole: ['owner', 'admin']
  },
  {
    id: 'security',
    label: 'Security',
    href: '/admin/security',
    icon: Shield,
    requiredRole: ['owner', 'admin']
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    requiredRole: ['owner', 'admin', 'member']
  },
  {
    id: 'system',
    label: 'System',
    href: '/admin/system',
    icon: Settings,
    requiredRole: ['owner']
  }
];

export function Sidebar({
  isCollapsed = false,
  onToggle,
  currentRoute,
  onRouteChange,
  onClose,
  user,
  onLogout,
  className
}: SidebarProps) {
  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => 
    !item.requiredRole || (user?.role && item.requiredRole.includes(user.role))
  );

  return (
    <div className={cn(
      "bg-white shadow-lg transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">Truxe</span>
          </div>
        )}
        
        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-3">
        <ul className="space-y-1">
          {filteredNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                    item.isActive && "bg-blue-100 text-blue-900"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn(
                    "w-5 h-5 text-gray-400 group-hover:text-gray-500",
                    isCollapsed ? "mx-auto" : "mr-3"
                  )} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      {user && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : ""
          )}>
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
            
            {!isCollapsed && (
              <>
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
                  className="ml-2 p-2"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;

