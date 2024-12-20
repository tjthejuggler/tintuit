import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setPapers, setLoading, setError } from '../lib/store/paperSlice';
import type { RootState } from '../lib/store';
import type { SearchFilters } from '../lib/types';
import { papers } from '../lib/api';
import { savePaper } from '../lib/db';

const PaperSearch: React.FC = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.papers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, _setFilters] = useState<SearchFilters>({
    topics: [],
    authors: [],
  });

  // Search timeout ref
  const searchTimeoutRef = useRef<number>();

  // Handle search execution
  const executeSearch = async (query: string) => {
    try {
      console.log('Executing search for:', query);
      dispatch(setLoading(true));
      dispatch(setError(null));

      const terms = query.split(',').map(t => t.trim()).filter(Boolean);
      
      if (terms.length === 0) {
        console.log('No search terms, clearing results');
        dispatch(setPapers([]));
        return;
      }

      const searchFilters: SearchFilters = {
        ...filters,
        topics: terms,
      };

      console.log('Fetching papers with filters:', searchFilters);
      const results = await papers.fetch({ ...searchFilters, count: 10 });
      console.log('Search results:', results);
      // Save papers to IndexedDB
      await Promise.all(results.map(paper => savePaper(paper)));
      dispatch(setPapers(results));
    } catch (err) {
      console.error('Search failed:', err);
      dispatch(setError(err instanceof Error ? err.message : 'Failed to fetch papers'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('Input value changed:', value);
    setSearchTerm(value);

    // Clear any pending search
    if (searchTimeoutRef.current) {
      console.log('Clearing pending search');
      window.clearTimeout(searchTimeoutRef.current);
    }

    // Set up new debounced search
    searchTimeoutRef.current = window.setTimeout(() => {
      executeSearch(value);
    }, 500);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with search term:', searchTerm);
    
    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    executeSearch(searchTerm);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Search input and button */}
          <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Search papers by topic (e.g., quantum physics, machine learning)"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center text-sm text-gray-600 dark:text-gray-400">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching papers...
            </div>
          )}
        </form>

        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-lg dark:text-red-400 dark:bg-red-900">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperSearch;
