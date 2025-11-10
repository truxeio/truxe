import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import DataTable from './DataTable';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  Search,
  Filter,
  Download
} from 'lucide-react';

export interface UserManagementProps {
  className?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin: string;
  createdAt: string;
  organization: string;
  avatar?: string;
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-01-15T10:30:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    organization: 'Acme Corp',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'member',
    status: 'active',
    lastLogin: '2024-01-14T15:45:00Z',
    createdAt: '2024-01-02T00:00:00Z',
    organization: 'Acme Corp'
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    role: 'viewer',
    status: 'inactive',
    lastLogin: '2024-01-10T09:15:00Z',
    createdAt: '2024-01-03T00:00:00Z',
    organization: 'Beta Inc'
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice.brown@example.com',
    role: 'owner',
    status: 'active',
    lastLogin: '2024-01-15T08:20:00Z',
    createdAt: '2023-12-15T00:00:00Z',
    organization: 'Gamma LLC'
  },
  {
    id: '5',
    name: 'Charlie Wilson',
    email: 'charlie.wilson@example.com',
    role: 'member',
    status: 'suspended',
    lastLogin: '2024-01-05T14:30:00Z',
    createdAt: '2024-01-04T00:00:00Z',
    organization: 'Acme Corp'
  }
];

export function UserManagement({ className }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const columns = [
    {
      key: 'user' as keyof User,
      label: 'User',
      sortable: true,
      render: (value: any, row: User) => (
        <div className="flex items-center">
          {row.avatar ? (
            <img
              className="w-8 h-8 rounded-full mr-3"
              src={row.avatar}
              alt={row.name}
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{row.name}</div>
            <div className="text-sm text-gray-500">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role' as keyof User,
      label: 'Role',
      sortable: true,
      render: (value: string) => (
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          value === 'owner' && "bg-purple-100 text-purple-800",
          value === 'admin' && "bg-blue-100 text-blue-800",
          value === 'member' && "bg-green-100 text-green-800",
          value === 'viewer' && "bg-gray-100 text-gray-800"
        )}>
          {value}
        </span>
      )
    },
    {
      key: 'status' as keyof User,
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          value === 'active' && "bg-green-100 text-green-800",
          value === 'inactive' && "bg-gray-100 text-gray-800",
          value === 'suspended' && "bg-red-100 text-red-800",
          value === 'pending' && "bg-yellow-100 text-yellow-800"
        )}>
          {value}
        </span>
      )
    },
    {
      key: 'organization' as keyof User,
      label: 'Organization',
      sortable: true
    },
    {
      key: 'lastLogin' as keyof User,
      label: 'Last Login',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1" />
          {new Date(value).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'actions' as keyof User,
      label: 'Actions',
      render: (value: any, row: User) => (
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  const handleUserSelect = (selectedRows: User[]) => {
    setSelectedUsers(selectedRows);
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.length === 0) return;
    
    switch (action) {
      case 'activate':
        setUsers(users.map(user => 
          selectedUsers.includes(user) 
            ? { ...user, status: 'active' as const }
            : user
        ));
        break;
      case 'suspend':
        setUsers(users.map(user => 
          selectedUsers.includes(user) 
            ? { ...user, status: 'suspended' as const }
            : user
        ));
        break;
      case 'delete':
        setUsers(users.filter(user => !selectedUsers.includes(user)));
        break;
    }
    setSelectedUsers([]);
  };

  const handleExport = (data: User[]) => {
    const csvContent = [
      ['Name', 'Email', 'Role', 'Status', 'Organization', 'Last Login', 'Created At'],
      ...data.map(user => [
        user.name,
        user.email,
        user.role,
        user.status,
        user.organization,
        new Date(user.lastLogin).toLocaleDateString(),
        new Date(user.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage users, roles, and permissions</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <User className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <Button variant="outline" className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('activate')}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('suspend')}
              >
                <UserX className="w-4 h-4 mr-2" />
                Suspend
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={filteredUsers}
        columns={columns}
        searchable={false}
        sortable={true}
        pagination={true}
        pageSize={10}
        selectable={true}
        onRowSelect={handleUserSelect}
        onExport={handleExport}
        exportable={true}
        emptyMessage="No users found"
      />
    </div>
  );
}

export default UserManagement;

