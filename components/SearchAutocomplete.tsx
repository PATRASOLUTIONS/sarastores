/**
 * Search Autocomplete Component
 * 
 * Enhanced search with:
 * - Debounced input
 * - Keyboard navigation
 * - Recent searches
 * - Popular searches
 * - Product suggestions
 */

'use client';

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Clock, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

// ============================================
// Types
// ============================================

interface SearchSuggestion {
  id: string;
  type: 'product' | 'category' | 'brand' | 'query';
  text: string;
  image?: string;
  price?: number;
  url: string;
  metadata?: Record<string, unknown>;
}

interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  maxSuggestions?: number;
  debounceMs?: number;
  showRecentSearches?: boolean;
  showPopularSearches?: boolean;
  onSearch?: (query: string) => void;
  onSelect?: (suggestion: SearchSuggestion) => void;
}

// ============================================
// Local Storage for Recent Searches
// ============================================

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const searches = getRecentSearches().filter(s => s !== query);
    searches.unshift(query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY, 
      JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore storage errors
  }
}

function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// Mock Popular Searches (replace with API)
// ============================================

const POPULAR_SEARCHES = [
  'Refrigerator',
  'Washing Machine',
  'Air Conditioner',
  'LED TV',
  'Microwave',
];

// ============================================
// Search Autocomplete Component
// ============================================

export function SearchAutocomplete({
  placeholder = 'Search for products, brands, and more...',
  className,
  inputClassName,
  dropdownClassName,
  maxSuggestions = 8,
  debounceMs = 300,
  showRecentSearches = true,
  showPopularSearches = true,
  onSearch,
  onSelect,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const debouncedQuery = useDebounce(query, debounceMs);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}&limit=${maxSuggestions}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, maxSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = suggestions.length || 
      (showRecentSearches ? recentSearches.length : 0) ||
      (showPopularSearches ? POPULAR_SEARCHES.length : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelectSuggestion(suggestions[activeIndex]);
        } else if (query.trim()) {
          handleSearch(query);
        }
        break;
        
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [suggestions, recentSearches, activeIndex, query, showRecentSearches, showPopularSearches]);

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    addRecentSearch(searchQuery);
    setRecentSearches(getRecentSearches());
    setIsOpen(false);
    
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      router.push(`/products?q=${encodeURIComponent(searchQuery)}`);
    }
  }, [router, onSearch]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'query') {
      addRecentSearch(suggestion.text);
      setRecentSearches(getRecentSearches());
    }
    
    setQuery(suggestion.text);
    setIsOpen(false);
    
    if (onSelect) {
      onSelect(suggestion);
    } else {
      router.push(suggestion.url);
    }
  }, [router, onSelect]);

  // Handle recent search click
  const handleRecentSearchClick = useCallback((search: string) => {
    setQuery(search);
    handleSearch(search);
  }, [handleSearch]);

  // Handle clear recent searches
  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Determine what to show in dropdown
  const showDropdown = isOpen && (
    suggestions.length > 0 ||
    (showRecentSearches && recentSearches.length > 0 && !query) ||
    (showPopularSearches && POPULAR_SEARCHES.length > 0 && !query)
  );

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-all duration-200',
            inputClassName
          )}
          autoComplete="off"
          aria-label="Search"
          aria-expanded={showDropdown}
          aria-controls="search-dropdown"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          role="combobox"
        />
        
        {/* Loading/Clear Button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-gray-100 rounded-full"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          className={cn(
            'absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg',
            'border border-gray-200 overflow-hidden z-50',
            'max-h-[400px] overflow-y-auto',
            dropdownClassName
          )}
          role="listbox"
        >
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`suggestion-${index}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full px-4 py-2 flex items-center gap-3 text-left',
                    'hover:bg-gray-50 transition-colors',
                    activeIndex === index && 'bg-gray-50'
                  )}
                  role="option"
                  aria-selected={activeIndex === index}
                >
                  {suggestion.image ? (
                    <img
                      src={suggestion.image}
                      alt={suggestion.text}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <Search className="h-4 w-4 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {suggestion.text}
                    </div>
                    {suggestion.type !== 'query' && (
                      <div className="text-sm text-gray-500 capitalize">
                        {suggestion.type}
                      </div>
                    )}
                  </div>
                  {suggestion.price && (
                    <div className="text-primary font-semibold">
                      ₹{suggestion.price.toLocaleString('en-IN')}
                    </div>
                  )}
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 && !query && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-4 py-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Recent Searches
                </span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={search}
                  onClick={() => handleRecentSearchClick(search)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={cn(
                    'w-full px-4 py-2 flex items-center gap-3 text-left',
                    'hover:bg-gray-50 transition-colors',
                    activeIndex === index && 'bg-gray-50'
                  )}
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="flex-1 text-gray-700">{search}</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
          {showPopularSearches && !query && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-4 py-1">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Trending
                </span>
              </div>
              {POPULAR_SEARCHES.map((search, index) => {
                const adjustedIndex = recentSearches.length + index;
                return (
                  <button
                    key={search}
                    onClick={() => handleRecentSearchClick(search)}
                    onMouseEnter={() => setActiveIndex(adjustedIndex)}
                    role="option"
                    aria-selected={activeIndex === adjustedIndex}
                    className={cn(
                      'w-full px-4 py-2 flex items-center gap-3 text-left',
                      'hover:bg-gray-50 transition-colors',
                      activeIndex === adjustedIndex && 'bg-gray-50'
                    )}
                  >
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span className="flex-1 text-gray-700">{search}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchAutocomplete;
