/**
 * MapSearch component
 * Geocoding search bar to find and center map on locations
 */

import React, { useState, useRef, useEffect } from 'react';
import { geocode, GeocodeResult } from '../../services/geocoding';

export interface MapSearchProps {
  onLocationSelect: (location: GeocodeResult) => void;
  className?: string;
}

export function MapSearch({ onLocationSelect, className = '' }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedIndex(-1);

    try {
      const searchResults = await geocode(query);
      setResults(searchResults);

      if (searchResults.length === 0) {
        setError('No results found');
      }
    } catch (err) {
      setError('Error searching for location');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultSelect = (result: GeocodeResult) => {
    onLocationSelect(result);
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleResultSelect(results[selectedIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setResults([]);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className={`map-search ${className}`} ref={inputRef}>
      <div className="map-search-input-container">
        <input
          type="search"
          role="searchbox"
          aria-label="Search for location"
          placeholder="Search for location..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="map-search-input"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="map-search-clear"
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="map-search-button"
          aria-label="Search"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="map-search-error" role="alert">{error}</div>}

      {results.length > 0 && (
        <ul className="map-search-results" role="listbox">
          {results.map((result, index) => (
            <li
              key={`${result.lat}-${result.lng}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`map-search-result ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleResultSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
