import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SortableTableHeaderProps {
  label: string;
  field: string;
  currentSortField: string;
  currentSortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableTableHeader({
  label,
  field,
  currentSortField,
  currentSortDirection,
  onSort,
  className = ''
}: SortableTableHeaderProps) {
  const isActive = currentSortField === field;

  return (
    <th 
      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5 select-none text-[13.5px] font-semibold text-gray-500 tracking-wide uppercase">
        {label}
        <span className="inline-flex text-gray-400">
          {isActive ? (
            currentSortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
          ) : (
            <ArrowUpDown size={14} className="opacity-50 hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );
}
