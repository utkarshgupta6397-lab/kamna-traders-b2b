import { useState, useCallback } from 'react';

export function useTableSorting(defaultField: string = 'orderDate', defaultDirection: 'asc' | 'desc' = 'desc') {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultDirection);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        // Third click -> default
        setSortField(defaultField);
        setSortDirection(defaultDirection);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection, defaultField, defaultDirection]);

  return { sortField, sortDirection, handleSort, setSortField, setSortDirection };
}
