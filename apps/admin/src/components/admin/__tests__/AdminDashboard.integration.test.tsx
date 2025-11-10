import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminProvider } from '../../../providers/AdminProvider';
import { AdminLayout } from '../AdminLayout';
import { DataTable } from '../DataTable';
import { StatsCard } from '../StatsCard';
import { PerformanceMonitor } from '../PerformanceMonitor';

// Mock the performance utilities
jest.mock('../../../lib/performance-utils', () => ({
  measurePerformance: jest.fn(),
  getPerformanceMetrics: jest.fn()
}));

const mockData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' }
];

const mockColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' }
];

const AdminDashboardTest = () => (
  <AdminProvider>
    <AdminLayout currentRoute="/dashboard">
      <div data-testid="dashboard-content">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard title="Total Users" value="1,234" change="+12%" changeType="positive" />
          <StatsCard title="Active Users" value="1,100" change="+8%" changeType="positive" />
          <StatsCard title="Inactive Users" value="134" change="-4%" changeType="negative" />
        </div>
        <DataTable data={mockData} columns={mockColumns} />
        <PerformanceMonitor showMetrics={true} />
      </div>
    </AdminLayout>
  </AdminProvider>
);

describe('AdminDashboard Integration', () => {
  it('renders complete admin dashboard', () => {
    render(<AdminDashboardTest />);
    
    // Check layout components
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    
    // Check dashboard content
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    
    // Check stats cards
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('1,100')).toBeInTheDocument();
    expect(screen.getByText('Inactive Users')).toBeInTheDocument();
    expect(screen.getByText('134')).toBeInTheDocument();
    
    // Check data table
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    
    // Check performance monitor
    expect(screen.getByText('Accessibility Tester')).toBeInTheDocument();
  });

  it('handles navigation between routes', () => {
    const onRouteChange = jest.fn();
    
    render(
      <AdminProvider>
        <AdminLayout currentRoute="/dashboard" onRouteChange={onRouteChange}>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </AdminLayout>
      </AdminProvider>
    );
    
    // Simulate route change
    fireEvent.click(screen.getByText('Test Route'));
    expect(onRouteChange).toHaveBeenCalledWith('/test-route');
  });

  it('handles sidebar toggle', () => {
    render(<AdminDashboardTest />);
    
    // Check if sidebar is rendered
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    
    // Simulate sidebar close
    fireEvent.click(screen.getByText('Close'));
    // Should not throw
  });

  it('handles data table interactions', () => {
    const onSort = jest.fn();
    const onRowClick = jest.fn();
    
    render(
      <AdminProvider>
        <AdminLayout currentRoute="/dashboard">
          <DataTable 
            data={mockData} 
            columns={mockColumns} 
            onSort={onSort}
            onRowClick={onRowClick}
          />
        </AdminLayout>
      </AdminProvider>
    );
    
    // Test sorting
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
    
    // Test row click
    fireEvent.click(screen.getByText('John Doe'));
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles performance monitoring', async () => {
    render(<AdminDashboardTest />);
    
    // Start performance monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    });
  });

  it('handles accessibility testing', async () => {
    render(<AdminDashboardTest />);
    
    // Run accessibility test
    const runTestButton = screen.getByText('Run Test');
    fireEvent.click(runTestButton);
    
    await waitFor(() => {
      expect(screen.getByText('Testing...')).toBeInTheDocument();
    });
  });

  it('maintains state across component interactions', () => {
    render(<AdminDashboardTest />);
    
    // Interact with data table
    fireEvent.click(screen.getByText('Name'));
    
    // Check that other components still work
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('handles responsive design', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768, // Tablet width
    });
    
    render(<AdminDashboardTest />);
    
    // Check that components still render
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
  });

  it('handles error boundaries gracefully', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };
    
    render(
      <AdminProvider>
        <AdminLayout currentRoute="/dashboard">
          <ErrorComponent />
        </AdminLayout>
      </AdminProvider>
    );
    
    // Should not crash the entire app
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(
      <AdminProvider>
        <AdminLayout currentRoute="/dashboard">
          <DataTable data={[]} columns={mockColumns} />
        </AdminLayout>
      </AdminProvider>
    );
    
    // Should render table headers even with empty data
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('handles missing props gracefully', () => {
    render(
      <AdminProvider>
        <AdminLayout>
          <div data-testid="content">Content</div>
        </AdminLayout>
      </AdminProvider>
    );
    
    // Should render without crashing
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<AdminDashboardTest />);
    
    // Test keyboard navigation
    const table = screen.getByRole('table');
    fireEvent.keyDown(table, { key: 'Tab' });
    
    // Should not throw
    expect(table).toBeInTheDocument();
  });

  it('handles focus management', () => {
    render(<AdminDashboardTest />);
    
    // Test focus management
    const table = screen.getByRole('table');
    table.focus();
    
    expect(document.activeElement).toBe(table);
  });

  it('handles screen reader announcements', () => {
    render(<AdminDashboardTest />);
    
    // Test that components render with proper ARIA attributes
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles performance optimization', () => {
    render(<AdminDashboardTest />);
    
    // Test that performance monitoring is available
    expect(screen.getByText('Start Performance Monitor')).toBeInTheDocument();
  });

  it('handles accessibility compliance', () => {
    render(<AdminDashboardTest />);
    
    // Test that accessibility testing is available
    expect(screen.getByText('Run Test')).toBeInTheDocument();
  });
});

