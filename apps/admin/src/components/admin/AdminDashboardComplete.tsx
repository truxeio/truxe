import React, { useState } from 'react';
import { AdminProvider, AdminRouter, useAdmin } from '../index';

export interface AdminDashboardCompleteProps {
  className?: string;
}

// Mock user data for demonstration
const mockUser = {
  id: '1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin' as const,
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
  permissions: [
    'users:read',
    'users:write',
    'organizations:read',
    'organizations:write',
    'security:read',
    'analytics:read'
  ],
  organization: {
    id: 'org-1',
    name: 'Acme Corp',
    role: 'admin'
  }
};

function AdminApp() {
  const { user, login, logout } = useAdmin();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    login(mockUser);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Admin Dashboard
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to access the admin panel
            </p>
          </div>
          <div className="mt-8 space-y-6">
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={mockUser.email}
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                onClick={handleLogin}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminRouter
      user={user}
      onLogout={handleLogout}
    />
  );
}

export function AdminDashboardComplete({ className }: AdminDashboardCompleteProps) {
  return (
    <div className={className}>
      <AdminProvider>
        <AdminApp />
      </AdminProvider>
    </div>
  );
}

export default AdminDashboardComplete;

