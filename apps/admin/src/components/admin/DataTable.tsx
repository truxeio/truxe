import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
  onRowSelect?: (selectedRows: T[]) => void;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  exportable?: boolean;
  onExport?: (data: T[]) => void;
  filterable?: boolean;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  onFilter?: (filters: Record<string, string>) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  searchFields,
  sortable = true,
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onRowClick,
  onRowSelect,
  selectable = false,
  loading = false,
  emptyMessage = "No data available",
  className,
  exportable = false,
  onExport,
  filterable = false,
  filters = [],
  onFilter
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [selectedPageSize, setSelectedPageSize] = useState(pageSize);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    const searchFieldsToUse = searchFields || columns.map(col => col.key as keyof T);
    
    return data.filter(row =>
      searchFieldsToUse.some(field => {
        const value = row[field];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, searchFields, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !sortable) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortField as keyof T];
      const bValue = b[sortField as keyof T];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection, sortable]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (currentPage - 1) * selectedPageSize;
    const endIndex = startIndex + selectedPageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, selectedPageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / selectedPageSize);

  const handleSort = (field: keyof T | string) => {
    if (!sortable) return;
    
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowSelect = (row: T, checked: boolean) => {
    if (!selectable) return;
    
    if (checked) {
      const newSelected = [...selectedRows, row];
      setSelectedRows(newSelected);
      onRowSelect?.(newSelected);
    } else {
      const newSelected = selectedRows.filter(r => r !== row);
      setSelectedRows(newSelected);
      onRowSelect?.(newSelected);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!selectable) return;
    
    if (checked) {
      setSelectedRows(paginatedData);
      onRowSelect?.(paginatedData);
    } else {
      setSelectedRows([]);
      onRowSelect?.([]);
    }
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    const newFilters = { ...activeFilters, [filterKey]: value };
    setActiveFilters(newFilters);
    onFilter?.(newFilters);
  };

  const getSortIcon = (field: keyof T | string) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg shadow", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            {searchable && (
              <div className="relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {filterable && filters.length > 0 && (
              <div className="flex items-center space-x-2">
                {filters.map(filter => (
                  <select
                    key={filter.key}
                    value={activeFilters[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                  >
                    <option value="">All {filter.label}</option>
                    {filter.options.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
            
            {exportable && onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport(sortedData)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.className
                  )}
                  style={{ width: column.width }}
                >
                  <button
                    className={cn(
                      "flex items-center space-x-1 group",
                      column.sortable !== false && sortable ? "cursor-pointer hover:text-gray-700" : "cursor-default"
                    )}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                  >
                    <span>{column.label}</span>
                    {column.sortable !== false && sortable && (
                      <span className="text-gray-400 group-hover:text-gray-600">
                        {getSortIcon(column.key)}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    "hover:bg-gray-50",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row)}
                        onChange={(e) => handleRowSelect(row, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", column.className)}
                    >
                      {column.render
                        ? column.render(row[column.key as keyof T], row)
                        : String(row[column.key as keyof T] || '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">
                Showing {((currentPage - 1) * selectedPageSize) + 1} to{' '}
                {Math.min(currentPage * selectedPageSize, sortedData.length)} of{' '}
                {sortedData.length} results
              </span>
              <select
                value={selectedPageSize}
                onChange={(e) => {
                  setSelectedPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;

