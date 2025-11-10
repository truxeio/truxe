import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataTable } from '../DataTable';

const mockData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'pending' }
];

const mockColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { 
    key: 'status', 
    label: 'Status',
    render: (value: string) => <span data-testid={`status-${value}`}>{value}</span>
  }
];

describe('DataTable', () => {
  const defaultProps = {
    data: mockData,
    columns: mockColumns
  };

  it('renders without crashing', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders table data', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('renders custom column renderers', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByTestId('status-active')).toBeInTheDocument();
    expect(screen.getByTestId('status-inactive')).toBeInTheDocument();
    expect(screen.getByTestId('status-pending')).toBeInTheDocument();
  });

  it('calls onSort when column header is clicked', () => {
    const onSort = jest.fn();
    render(<DataTable {...defaultProps} onSort={onSort} />);
    
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = jest.fn();
    render(<DataTable {...defaultProps} onRowClick={onRowClick} />);
    
    fireEvent.click(screen.getByText('John Doe'));
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles empty data gracefully', () => {
    render(<DataTable {...defaultProps} data={[]} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument(); // Headers should still render
  });

  it('handles missing onSort gracefully', () => {
    render(<DataTable {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByText('Name'));
    }).not.toThrow();
  });

  it('handles missing onRowClick gracefully', () => {
    render(<DataTable {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByText('John Doe'));
    }).not.toThrow();
  });

  it('applies custom className', () => {
    const className = 'custom-table';
    const { container } = render(
      <DataTable {...defaultProps} className={className} />
    );
    expect(container.firstChild).toHaveClass(className);
  });

  it('renders with proper table structure', () => {
    render(<DataTable {...defaultProps} />);
    
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4); // 1 header + 3 data rows
  });

  it('handles sorting direction toggle', () => {
    const onSort = jest.fn();
    render(<DataTable {...defaultProps} onSort={onSort} />);
    
    // First click - ascending
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
    
    // Second click - descending
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('renders with proper accessibility attributes', () => {
    render(<DataTable {...defaultProps} />);
    
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    const headers = screen.getAllByRole('columnheader');
    headers.forEach(header => {
      expect(header).toHaveAttribute('tabIndex', '0');
    });
  });
});

