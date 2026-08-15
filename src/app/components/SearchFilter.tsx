import { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { ExternalPaper } from '../services/api';
import { FilterCriteria } from '../utils/filterUtils';

interface SearchFilterProps {
  results: ExternalPaper[];
  filters: FilterCriteria;
  onFilterChange: (filters: FilterCriteria) => void;
  loadingMore?: boolean;
}

export function SearchFilter({ results, filters, onFilterChange, loadingMore }: SearchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stagedFilters, setStagedFilters] = useState<FilterCriteria>(filters);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync staged filters whenever the dropdown opens or active filters prop changes
  useEffect(() => {
    if (isOpen) {
      setStagedFilters(filters);
    }
  }, [isOpen, filters]);

  const availableAuthors = useMemo(() => {
    const authorSet = new Set<string>();
    results.forEach(paper => {
      paper.authors.forEach(author => authorSet.add(author));
    });
    return Array.from(authorSet).sort();
  }, [results]);

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    results.forEach(paper => {
      if (paper.year && paper.year !== 'N/A') {
        yearSet.add(paper.year);
      }
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [results]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleAuthor = (author: string) => {
    setStagedFilters(prev => ({
      ...prev,
      authors: prev.authors.includes(author)
        ? prev.authors.filter(a => a !== author)
        : [...prev.authors, author]
    }));
  };

  const toggleYear = (year: string) => {
    setStagedFilters(prev => ({
      ...prev,
      years: prev.years.includes(year)
        ? prev.years.filter(y => y !== year)
        : [...prev.years, year]
    }));
  };

  const handleApply = () => {
    onFilterChange(stagedFilters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters = { authors: [], years: [] };
    setStagedFilters(emptyFilters);
    onFilterChange(emptyFilters);
    setIsOpen(false);
  };

  const activeFilterCount = filters.authors.length + filters.years.length;

  if (results.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-4 border rounded-xl transition-all shadow-sm active:scale-95 ${
          activeFilterCount > 0 
            ? 'bg-blue-50 border-blue-200 text-blue-700' 
            : 'bg-white border-[#E5E7EB] text-[#374151] hover:border-blue-500'
        }`}
      >
        <Filter className="w-5 h-5" />
        <span className="font-semibold hidden sm:inline">Filter By</span>
        {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
        {!loadingMore && activeFilterCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs text-white bg-blue-600 rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4 ml-1 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 z-50 w-72 mt-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-gray-50">
            <h3 className="font-semibold text-[#111827]">Filters</h3>
            {(stagedFilters.authors.length > 0 || stagedFilters.years.length > 0 || activeFilterCount > 0) && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 p-4">
            <div className="mb-6">
              <h4 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Publication Year</h4>
              <div className="space-y-2">
                {availableYears.length > 0 ? availableYears.map(year => (
                  <label key={year} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${stagedFilters.years.includes(year) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                      {stagedFilters.years.includes(year) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={stagedFilters.years.includes(year)} onChange={() => toggleYear(year)} />
                    <span className="text-sm text-[#374151]">{year}</span>
                  </label>
                )) : <p className="text-xs text-gray-400 italic">No years available</p>}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Authors</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {availableAuthors.length > 0 ? availableAuthors.map(author => (
                  <label key={author} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${stagedFilters.authors.includes(author) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                      {stagedFilters.authors.includes(author) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={stagedFilters.authors.includes(author)} onChange={() => toggleAuthor(author)} />
                    <span className="text-sm text-[#374151] truncate" title={author}>{author}</span>
                  </label>
                )) : <p className="text-xs text-gray-400 italic">No authors available</p>}
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-[#E5E7EB] bg-gray-50">
            <button
              onClick={handleApply}
              className="w-full py-2 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              Apply Filters
              {(stagedFilters.authors.length + stagedFilters.years.length) > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {stagedFilters.authors.length + stagedFilters.years.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
