import React, { useState } from 'react';
import { AdminLayout, AdminDashboard, UserManagement, SecurityMonitoring } from './index';

export interface AdminDashboardExampleProps {
  className?: string;
}

export function AdminDashboardExample({ className }: AdminDashboardExampleProps) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'security'>('dashboard');
  const [user] = useState({
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin' as const,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face'
  });

  const handleLogout = () => {
    console.log('Logout clicked');
    // Implement logout logic
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <UserManagement />;
      case 'security':
        return <SecurityMonitoring />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminLayout
      user={user}
      onLogout={handleLogout}
      className={className}
    >
      {renderContent()}
    </AdminLayout>
  );
}

export default AdminDashboardExample;

