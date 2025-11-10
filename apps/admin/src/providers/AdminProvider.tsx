import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AdminRouter } from '../components/admin/AdminRouter';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  permissions?: string[];
  organization?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface AdminContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export interface AdminProviderProps {
  children: ReactNode;
  initialUser?: User | null;
  onLogin?: (user: User) => void;
  onLogout?: () => void;
  onUserUpdate?: (user: User) => void;
}

export function AdminProvider({
  children,
  initialUser = null,
  onLogin,
  onLogout,
  onUserUpdate
}: AdminProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // In a real app, this would check for stored tokens or make an API call
        const storedUser = localStorage.getItem('admin_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('admin_user', JSON.stringify(newUser));
    onLogin?.(newUser);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('admin_user');
    onLogout?.();
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('admin_user', JSON.stringify(updatedUser));
      onUserUpdate?.(updatedUser);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return user?.permissions ? permissions.some(p => user.permissions?.includes(p)) : false;
  };

  const contextValue: AdminContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    hasPermission,
    hasRole,
    hasAnyRole,
    hasAnyPermission
  };

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
}

export default AdminProvider;

