import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccessibleDataTable } from '../AccessibleDataTable';

const mockData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'pending' }
];

const mockColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' }
];

describe('AccessibleDataTable', () => {
  const defaultProps = {
    data: mockData,
    columns: mockColumns
  };

  it('renders without crashing', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders with proper ARIA attributes', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '4'); // 1 header + 3 data rows
    expect(grid).toHaveAttribute('aria-colcount', '4'); // 1 select + 3 data columns
  });

  it('renders select all checkbox', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    expect(screen.getByLabelText('Select all rows')).toBeInTheDocument();
  });

  it('renders individual row checkboxes', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    expect(screen.getByLabelText('Select row 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Select row 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Select row 3')).toBeInTheDocument();
  });

  it('handles select all functionality', () => {
    const onSelectAll = jest.fn();
    render(<AccessibleDataTable {...defaultProps} onSelectAll={onSelectAll} />);
    
    const selectAllCheckbox = screen.getByLabelText('Select all rows');
    fireEvent.click(selectAllCheckbox);
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  it('handles individual row selection', () => {
    const onRowSelect = jest.fn();
    render(<AccessibleDataTable {...defaultProps} onRowSelect={onRowSelect} />);
    
    const row1Checkbox = screen.getByLabelText('Select row 1');
    fireEvent.click(row1Checkbox);
    expect(onRowSelect).toHaveBeenCalledWith(mockData[0], true);
  });

  it('handles row clicking', () => {
    const onRowClick = jest.fn();
    render(<AccessibleDataTable {...defaultProps} onRowClick={onRowClick} />);
    
    const row1 = screen.getByText('John Doe').closest('tr');
    fireEvent.click(row1!);
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles keyboard navigation', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    const row1 = screen.getByText('John Doe').closest('tr');
    fireEvent.keyDown(row1!, { key: 'Enter' });
    // Should not throw and should handle the event
  });

  it('handles arrow key navigation', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    const row1 = screen.getByText('John Doe').closest('tr');
    fireEvent.keyDown(row1!, { key: 'ArrowDown' });
    // Should not throw and should handle the event
  });

  it('handles Ctrl+A for select all', () => {
    const onSelectAll = jest.fn();
    render(<AccessibleDataTable {...defaultProps} onSelectAll={onSelectAll} />);
    
    const row1 = screen.getByText('John Doe').closest('tr');
    fireEvent.keyDown(row1!, { key: 'a', ctrlKey: true });
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  it('renders with proper accessibility labels', () => {
    render(<AccessibleDataTable {...defaultProps} aria-label="User management table" />);
    
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-label', 'User management table');
  });

  it('renders with proper accessibility labelledby', () => {
    render(
      <div>
        <h2 id="table-title">User Management</h2>
        <AccessibleDataTable {...defaultProps} aria-labelledby="table-title" />
      </div>
    );
    
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-labelledby', 'table-title');
  });

  it('shows selection count in summary', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    // Select a row
    const row1Checkbox = screen.getByLabelText('Select row 1');
    fireEvent.click(row1Checkbox);
    
    // Check if selection count is displayed
    expect(screen.getByText('1 rows selected')).toBeInTheDocument();
  });

  it('shows total row count in summary', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    expect(screen.getByText('Showing 3 rows')).toBeInTheDocument();
  });

  it('handles sorting with accessibility', () => {
    const onSort = jest.fn();
    render(<AccessibleDataTable {...defaultProps} onSort={onSort} />);
    
    const nameHeader = screen.getByLabelText('Sort by Name');
    fireEvent.click(nameHeader);
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('handles empty data gracefully', () => {
    render(<AccessibleDataTable {...defaultProps} data={[]} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 rows')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const className = 'custom-accessible-table';
    const { container } = render(
      <AccessibleDataTable {...defaultProps} className={className} />
    );
    expect(container.firstChild).toHaveClass(className);
  });

  it('handles missing event handlers gracefully', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    // Should not throw when handlers are not provided
    expect(() => {
      const row1 = screen.getByText('John Doe').closest('tr');
      fireEvent.click(row1!);
      fireEvent.keyDown(row1!, { key: 'Enter' });
    }).not.toThrow();
  });

  it('renders with proper focus management', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('tabIndex', '0');
  });

  it('handles column sorting with proper ARIA attributes', () => {
    render(<AccessibleDataTable {...defaultProps} />);
    
    const nameHeader = screen.getByLabelText('Sort by Name');
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    
    fireEvent.click(nameHeader);
    // After clicking, the aria-sort should change
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });
});

