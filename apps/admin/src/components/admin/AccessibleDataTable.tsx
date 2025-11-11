import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAccessibility, useKeyboardNavigation } from '../../lib/accessibility-utils';
import { DataTable } from './DataTable';
import { Button } from '../ui/Button';
import { Badge } from './Badge';
import { Card } from './Card';

interface AccessibleDataTableProps {
  data: any[];
  columns: any[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
  onRowSelect?: (row: any, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const AccessibleDataTable: React.FC<AccessibleDataTableProps> = ({
  data,
  columns,
  onSort,
  onRowClick,
  onRowSelect,
  onSelectAll,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [focusedColumn, setFocusedColumn] = useState<number | null>(null);
  
  const { announce } = useAccessibility();
  const tableRef = useRef<HTMLTableElement>(null);

  // Handle keyboard navigation
  useKeyboardNavigation(useCallback((direction) => {
    if (focusedRow === null || focusedColumn === null) return;

    const newRow = focusedRow;
    const newColumn = focusedColumn;

    switch (direction) {
      case 'up':
        if (focusedRow > 0) {
          setFocusedRow(focusedRow - 1);
          announce(`Row ${focusedRow} selected`, 'polite');
        }
        break;
      case 'down':
        if (focusedRow < data.length - 1) {
          setFocusedRow(focusedRow + 1);
          announce(`Row ${focusedRow + 2} selected`, 'polite');
        }
        break;
      case 'left':
        if (focusedColumn > 0) {
          setFocusedColumn(focusedColumn - 1);
          announce(`Column ${focusedColumn} selected`, 'polite');
        }
        break;
      case 'right':
        if (focusedColumn < columns.length - 1) {
          setFocusedColumn(focusedColumn + 1);
          announce(`Column ${focusedColumn + 2} selected`, 'polite');
        }
        break;
    }
  }, [focusedRow, focusedColumn, data.length, columns.length, announce]));

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
    announce(`Sorted by ${column} ${newDirection}`, 'polite');
  }, [sortColumn, sortDirection, onSort, announce]);

  // Handle row selection
  const handleRowSelect = useCallback((rowIndex: number, selected: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (selected) {
      newSelectedRows.add(rowIndex);
    } else {
      newSelectedRows.delete(rowIndex);
    }
    setSelectedRows(newSelectedRows);
    onRowSelect?.(data[rowIndex], selected);
    announce(`Row ${rowIndex + 1} ${selected ? 'selected' : 'deselected'}`, 'polite');
  }, [selectedRows, data, onRowSelect, announce]);

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedRows(new Set(data.map((_, index) => index)));
    } else {
      setSelectedRows(new Set());
    }
    onSelectAll?.(selected);
    announce(`All rows ${selected ? 'selected' : 'deselected'}`, 'polite');
  }, [data, onSelectAll, announce]);

  // Handle row click
  const handleRowClick = useCallback((row: any, rowIndex: number) => {
    onRowClick?.(row);
    setFocusedRow(rowIndex);
    announce(`Row ${rowIndex + 1} activated`, 'polite');
  }, [onRowClick, announce]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent, rowIndex: number) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleRowClick(data[rowIndex], rowIndex);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (rowIndex > 0) {
          setFocusedRow(rowIndex - 1);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (rowIndex < data.length - 1) {
          setFocusedRow(rowIndex + 1);
        }
        break;
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleSelectAll(true);
        }
        break;
    }
  }, [data, handleRowClick, handleSelectAll]);

  // Set initial focus
  useEffect(() => {
    if (data.length > 0 && focusedRow === null) {
      setFocusedRow(0);
      setFocusedColumn(0);
    }
  }, [data.length, focusedRow]);

  // Announce table information
  useEffect(() => {
    announce(`Table loaded with ${data.length} rows and ${columns.length} columns`, 'polite');
  }, [data.length, columns.length, announce]);

  const isAllSelected = selectedRows.size === data.length && data.length > 0;
  const isPartiallySelected = selectedRows.size > 0 && selectedRows.size < data.length;

  return (
    <div className={`accessible-data-table ${className}`}>
      <Card className="p-4">
        {/* Table controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Data Table</h3>
            <Badge color="blue">
              {data.length} rows
            </Badge>
            {selectedRows.size > 0 && (
              <Badge color="green">
                {selectedRows.size} selected
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleSelectAll(!isAllSelected)}
              variant="outline"
              size="sm"
              aria-pressed={isAllSelected}
              aria-describedby="select-all-description"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Button>
            <div id="select-all-description" className="sr-only">
              {isAllSelected ? 'Deselect all rows' : 'Select all rows'}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table
            ref={tableRef}
            className="w-full border-collapse"
            role="grid"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            aria-rowcount={data.length + 1}
            aria-colcount={columns.length + 1}
          >
            {/* Table header */}
            <thead>
              <tr role="row">
                <th
                  role="columnheader"
                  className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50"
                  aria-sort={isAllSelected ? 'ascending' : isPartiallySelected ? 'other' : 'none'}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = isPartiallySelected;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Select all rows"
                    className="mr-2"
                  />
                  Select
                </th>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    role="columnheader"
                    className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    tabIndex={0}
                    onClick={() => handleSort(column.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(column.key);
                      }
                    }}
                    aria-sort={sortColumn === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    aria-label={`Sort by ${column.label}`}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {sortColumn === column.key && (
                        <span className="text-blue-600" aria-label={`Sorted ${sortDirection}`}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table body */}
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  role="row"
                  className={`border-b border-gray-200 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                    focusedRow === rowIndex ? 'bg-blue-50' : ''
                  }`}
                  tabIndex={0}
                  onClick={() => handleRowClick(row, rowIndex)}
                  onKeyDown={(e) => handleKeyDown(e, rowIndex)}
                  aria-selected={selectedRows.has(rowIndex)}
                  aria-rowindex={rowIndex + 2}
                >
                  <td
                    role="gridcell"
                    className="px-4 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowIndex)}
                      onChange={(e) => handleRowSelect(rowIndex, e.target.checked)}
                      aria-label={`Select row ${rowIndex + 1}`}
                      className="mr-2"
                    />
                  </td>
                  {columns.map((column, colIndex) => (
                    <td
                      key={column.key}
                      role="gridcell"
                      className="px-4 py-2"
                      aria-colindex={colIndex + 2}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table summary */}
        <div className="mt-4 text-sm text-gray-600">
          <p>
            Showing {data.length} rows. 
            {selectedRows.size > 0 && ` ${selectedRows.size} rows selected.`}
            {sortColumn && ` Sorted by ${sortColumn} ${sortDirection}.`}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AccessibleDataTable;

