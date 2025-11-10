import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Lock,
  Unlock,
  Ban,
  User,
  Globe,
  Server
} from 'lucide-react';

export interface SecurityMonitoringProps {
  className?: string;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'suspicious_activity' | 'rate_limit' | 'blocked_ip' | 'password_reset' | 'account_locked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  userId?: string;
  resolved: boolean;
}

interface SecurityStats {
  totalEvents: number;
  criticalEvents: number;
  blockedIPs: number;
  activeThreats: number;
  rateLimitViolations: number;
  suspiciousLogins: number;
}

const mockEvents: SecurityEvent[] = [
  {
    id: '1',
    type: 'failed_login',
    severity: 'high',
    message: 'Multiple failed login attempts from IP 192.168.1.100',
    timestamp: '2024-01-15T10:30:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    userId: 'user123',
    resolved: false
  },
  {
    id: '2',
    type: 'suspicious_activity',
    severity: 'critical',
    message: 'Unusual login pattern detected from multiple locations',
    timestamp: '2024-01-15T09:15:00Z',
    ipAddress: '203.0.113.45',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    userId: 'user456',
    resolved: false
  },
  {
    id: '3',
    type: 'rate_limit',
    severity: 'medium',
    message: 'Rate limit exceeded for API endpoint /auth/magic-link',
    timestamp: '2024-01-15T08:45:00Z',
    ipAddress: '198.51.100.42',
    userAgent: 'curl/7.68.0',
    resolved: true
  },
  {
    id: '4',
    type: 'blocked_ip',
    severity: 'high',
    message: 'IP address 192.168.1.100 has been blocked due to repeated violations',
    timestamp: '2024-01-15T08:30:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    resolved: true
  },
  {
    id: '5',
    type: 'login',
    severity: 'low',
    message: 'Successful login from new device',
    timestamp: '2024-01-15T07:20:00Z',
    ipAddress: '203.0.113.78',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    userId: 'user789',
    resolved: true
  }
];

export function SecurityMonitoring({ className }: SecurityMonitoringProps) {
  const [events, setEvents] = useState<SecurityEvent[]>(mockEvents);
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 1247,
    criticalEvents: 3,
    blockedIPs: 12,
    activeThreats: 5,
    rateLimitViolations: 89,
    suspiciousLogins: 23
  });
  const [filter, setFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'logout':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'failed_login':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'suspicious_activity':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'rate_limit':
        return <TrendingUp className="w-4 h-4 text-yellow-500" />;
      case 'blocked_ip':
        return <Ban className="w-4 h-4 text-red-500" />;
      case 'password_reset':
        return <Lock className="w-4 h-4 text-blue-500" />;
      case 'account_locked':
        return <Lock className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'login':
        return 'text-green-600 bg-green-100';
      case 'logout':
        return 'text-gray-600 bg-gray-100';
      case 'failed_login':
        return 'text-red-600 bg-red-100';
      case 'suspicious_activity':
        return 'text-orange-600 bg-orange-100';
      case 'rate_limit':
        return 'text-yellow-600 bg-yellow-100';
      case 'blocked_ip':
        return 'text-red-600 bg-red-100';
      case 'password_reset':
        return 'text-blue-600 bg-blue-100';
      case 'account_locked':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesFilter = filter === 'all' || event.type === filter;
    const matchesSeverity = severityFilter === 'all' || event.severity === severityFilter;
    return matchesFilter && matchesSeverity;
  });

  const handleResolveEvent = (eventId: string) => {
    setEvents(events.map(event => 
      event.id === eventId 
        ? { ...event, resolved: true }
        : event
    ));
  };

  const handleBlockIP = (ipAddress: string) => {
    // In a real implementation, this would call an API
    console.log(`Blocking IP: ${ipAddress}`);
  };

  const handleUnblockIP = (ipAddress: string) => {
    // In a real implementation, this would call an API
    console.log(`Unblocking IP: ${ipAddress}`);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Monitoring</h1>
          <p className="text-gray-600">Monitor security events and threats in real-time</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Shield className="w-4 h-4 mr-2" />
            Security Settings
          </Button>
          <Button size="sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            View All Alerts
          </Button>
        </div>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-500 text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.criticalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-orange-500 text-white">
              <Ban className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Blocked IPs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.blockedIPs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500 text-white">
              <Activity className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Threats</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeThreats}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500 text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rate Limit Violations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rateLimitViolations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500 text-white">
              <User className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Suspicious Logins</p>
              <p className="text-2xl font-bold text-gray-900">{stats.suspiciousLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500 text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Events</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="failed_login">Failed Login</option>
              <option value="suspicious_activity">Suspicious Activity</option>
              <option value="rate_limit">Rate Limit</option>
              <option value="blocked_ip">Blocked IP</option>
              <option value="password_reset">Password Reset</option>
              <option value="account_locked">Account Locked</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <Button variant="outline" className="w-full">
              <Clock className="w-4 h-4 mr-2" />
              Last 24 Hours
            </Button>
          </div>
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Security Events</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredEvents.map((event) => (
            <div key={event.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        getSeverityColor(event.severity)
                      )}>
                        {event.severity}
                      </span>
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        getTypeColor(event.type)
                      )}>
                        {event.type.replace('_', ' ')}
                      </span>
                      {event.resolved && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{event.message}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Globe className="w-3 h-3 mr-1" />
                        {event.ipAddress}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                      {event.userId && (
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {event.userId}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!event.resolved && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolveEvent(event.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolve
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBlockIP(event.ipAddress)}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Block IP
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SecurityMonitoring;

