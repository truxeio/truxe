import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  Menu, 
  Search, 
  Bell, 
  User, 
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';

export interface TopBarProps {
  onMenuToggle?: () => void;
  onMenuClick?: () => void;
  currentRoute?: string;
  showMenuButton?: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    avatar?: string;
  };
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  className?: string;
}

export function TopBar({
  onMenuToggle,
  onMenuClick,
  currentRoute,
  showMenuButton = true,
  user,
  onLogout,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch = true,
  className
}: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value);
  };

  return (
    <div className={cn(
      "sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200",
      className
    )}>
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          {(onMenuToggle || onMenuClick) && showMenuButton && (
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden mr-2"
              onClick={onMenuToggle || onMenuClick}
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          
          {showSearch && (
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>
          </div>

          {/* Settings */}
          <Button variant="ghost" size="sm">
            <Settings className="w-5 h-5" />
          </Button>

          {/* User menu */}
          {user && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2"
              >
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
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Profile
                  </a>
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Settings
                  </a>
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Help
                  </a>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        onLogout?.();
                        setShowUserMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TopBar;

