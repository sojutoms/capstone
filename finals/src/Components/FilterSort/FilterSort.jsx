import React, { useState, useRef, useEffect } from 'react';
import './FilterSort.css';

const FilterSort = ({
  onFilterChange,
  onSortChange,
  priceRanges = [
    { label: 'All Prices', min: 0, max: Infinity },
    { label: 'Under ₱1000', min: 0, max: 1000 },
    { label: '₱1000 - ₱5000', min: 1000, max: 5000 },
    { label: '₱5000 - ₱10000', min: 5000, max: 10000 },
    { label: 'Over ₱10000', min: 10000, max: Infinity }
  ],
  brands = ['All Brands', 'Nike', 'Adidas', 'Puma', 'New Balance'],
  categories = ['All', 'Shoes', 'Watch', 'Bags', 'Collectibles'],
  totalResults = 0
}) => {
  const [filters, setFilters] = useState({
    category: 'All',
    priceRange: { label: 'All Prices', min: 0, max: Infinity },
    brand: 'All Brands',
    inStock: false
  });

  const [sortBy, setSortBy] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef(null);

  const sortOptions = [
    { value: 'featured', label: 'Featured' },
    { value: 'newest', label: 'Newest' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'name-asc', label: 'Name: A-Z' },
    { value: 'name-desc', label: 'Name: Z-A' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setShowSortDropdown(false);
    onSortChange?.(value);
  };

  const clearAllFilters = () => {
    const defaultFilters = {
      category: 'All',
      priceRange: { label: 'All Prices', min: 0, max: Infinity },
      brand: 'All Brands',
      inStock: false
    };
    setFilters(defaultFilters);
    onFilterChange?.(defaultFilters);
  };

  const hasActiveFilters = () => {
    return (
      filters.category !== 'All' ||
      filters.priceRange.label !== 'All Prices' ||
      filters.brand !== 'All Brands' ||
      filters.inStock
    );
  };

  return (
    <div className="filter-sort-container">
      {/* Top Bar */}
      <div className="filter-sort-topbar">
        <div className="results-info">
          <span className="results-count">{totalResults}</span> Results
          {hasActiveFilters() && (
            <button className="clear-filters-btn" onClick={clearAllFilters}>
              Clear All
            </button>
          )}
        </div>

        <div className="filter-sort-actions">
          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 4h16M5 10h10M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          <div className="sort-dropdown-wrapper" ref={sortDropdownRef}>
            <button
              className="sort-toggle-btn"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
            >
              <span>Sort By: {sortOptions.find(opt => opt.value === sortBy)?.label}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  transform: showSortDropdown ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {showSortDropdown && (
              <div className="sort-dropdown-menu">
                {sortOptions.map(option => (
                  <button
                    key={option.value}
                    className={`sort-option ${sortBy === option.value ? 'active' : ''}`}
                    onClick={() => handleSortChange(option.value)}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={`filter-panel ${showFilters ? 'show' : ''}`}>
        {/* Category Filter */}
        <div className="filter-group">
          <h3 className="filter-title">Category</h3>
          <div className="filter-options">
            {categories.map(cat => (
              <button
                key={cat}
                className={`filter-chip ${filters.category === cat ? 'active' : ''}`}
                onClick={() => handleFilterChange('category', cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range Filter */}
        <div className="filter-group">
          <h3 className="filter-title">Price Range</h3>
          <div className="filter-options vertical">
            {priceRanges.map((range, idx) => (
              <button
                key={idx}
                className={`filter-radio ${filters.priceRange.label === range.label ? 'active' : ''}`}
                onClick={() => handleFilterChange('priceRange', range)}
              >
                <span className="radio-circle">
                  {filters.priceRange.label === range.label && <span className="radio-dot" />}
                </span>
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brand Filter */}
        <div className="filter-group">
          <h3 className="filter-title">Brand</h3>
          <div className="filter-options">
            {brands.map(brand => (
              <button
                key={brand}
                className={`filter-chip ${filters.brand === brand ? 'active' : ''}`}
                onClick={() => handleFilterChange('brand', brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        {/* Availability Filter */}
        <div className="filter-group">
          <h3 className="filter-title">Availability</h3>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.inStock}
              onChange={(e) => handleFilterChange('inStock', e.target.checked)}
            />
            <span className="checkbox-custom">
              {filters.inStock && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5 10L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className="checkbox-label">In Stock Only</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default FilterSort;
