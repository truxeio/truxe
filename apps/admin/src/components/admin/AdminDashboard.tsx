import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { 
  Users, 
  Shield, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  UserPlus,
  Settings,
  BarChart3
} from 'lucide-react';

export interface AdminDashboardProps {
  className?: string;
}

interface StatCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

interface RecentActivity {
  id: string;
  type: 'user' | 'security' | 'system' | 'organization';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface SecurityAlert {
  id: string;
  type: 'threat' | 'anomaly' | 'breach' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export function AdminDashboard({ className }: AdminDashboardProps) {
  const [stats, setStats] = useState<StatCard[]>([
    {
      title: 'Total Users',
      value: '2,847',
      change: { value: 12.5, type: 'increase' },
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Sessions',
      value: '1,234',
      change: { value: 8.2, type: 'increase' },
      icon: Activity,
      color: 'green'
    },
    {
      title: 'Security Events',
      value: '23',
      change: { value: 15.3, type: 'decrease' },
      icon: Shield,
      color: 'yellow'
    },
    {
      title: 'System Uptime',
      value: '99.9%',
      change: { value: 0.1, type: 'increase' },
      icon: TrendingUp,
      color: 'green'
    }
  ]);

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'user',
      message: 'New user registered: john.doe@example.com',
      timestamp: '2 minutes ago',
      status: 'success'
    },
    {
      id: '2',
      type: 'security',
      message: 'Suspicious login attempt blocked from IP 192.168.1.100',
      timestamp: '5 minutes ago',
      status: 'warning'
    },
    {
      id: '3',
      type: 'system',
      message: 'Database backup completed successfully',
      timestamp: '1 hour ago',
      status: 'success'
    },
    {
      id: '4',
      type: 'organization',
      message: 'Organization "Acme Corp" created',
      timestamp: '2 hours ago',
      status: 'info'
    }
  ]);

  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([
    {
      id: '1',
      type: 'threat',
      severity: 'high',
      message: 'Multiple failed login attempts detected',
      timestamp: '10 minutes ago',
      resolved: false
    },
    {
      id: '2',
      type: 'rate_limit',
      severity: 'medium',
      message: 'Rate limit exceeded for API endpoint /auth/magic-link',
      timestamp: '1 hour ago',
      resolved: true
    },
    {
      id: '3',
      type: 'anomaly',
      severity: 'low',
      message: 'Unusual traffic pattern detected',
      timestamp: '3 hours ago',
      resolved: false
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Eye className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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
      case 'gray':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your Truxe authentication system</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={cn("p-3 rounded-lg", getColorClasses(stat.color))}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.change && (
                    <div className="flex items-center mt-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          stat.change.type === 'increase' && "text-green-600",
                          stat.change.type === 'decrease' && "text-red-600",
                          stat.change.type === 'neutral' && "text-gray-600"
                        )}
                      >
                        {stat.change.type === 'increase' && '+'}
                        {stat.change.value}%
                      </span>
                      <span className="text-sm text-gray-500 ml-1">vs last month</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Security Alerts</h3>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {securityAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          getSeverityColor(alert.severity)
                        )}
                      >
                        {alert.severity}
                      </span>
                      {alert.resolved && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {alert.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col">
              <Users className="w-6 h-6 mb-2" />
              <span>Manage Users</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <Shield className="w-6 h-6 mb-2" />
              <span>Security Settings</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <BarChart3 className="w-6 h-6 mb-2" />
              <span>View Analytics</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <Settings className="w-6 h-6 mb-2" />
              <span>System Config</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

