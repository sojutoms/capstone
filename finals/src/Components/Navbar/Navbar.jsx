import React, { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import cart_icon from "../Assets/cart_icon.png";
import { ShopContext } from "../../Context/ShopContext";
import { useTheme } from "../../Context/ThemeContext";
import API_BASE_URL from "../../services/api";

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
  </svg>
);

const Navbar = () => {
  const { 
    getTotalCartItems, 
    all_product, 
    cartItems, 
    addToCart, 
    removeFromCart 
  } = useContext(ShopContext);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenDropdown, setMobileOpenDropdown] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("auth-token"));
  const [userName, setUserName] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [hoverDropdown, setHoverDropdown] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const searchInputRef = useRef(null);
  const userDropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  const getCategoryIcon = (slug) => {
    switch (slug) {
      case "shoes": return "👟";
      case "watch": return "⌚";
      case "bags": return "💼";
      case "collectibles": return "🧸";
      default: return "✨";
    }
  };

  const fetchCategoriesAndBrands = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        fetch(`${API_BASE_URL}/categories`),
        fetch(`${API_BASE_URL}/brands`),
      ]);
      const catData = await catRes.json();
      const brandData = await brandRes.json();
      if (catData.success) setCategories(catData.categories || []);
      if (brandData.success) setBrands(brandData.brands || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchCategoriesAndBrands(); }, [fetchCategoriesAndBrands]);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("auth-token"));
    if (localStorage.getItem("auth-token")) {
      fetch(`${API_BASE_URL}/user/profile`, { 
        headers: { "auth-token": localStorage.getItem("auth-token") } 
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const name = data.user.name?.split(" ")[0] || "Account";
          setUserName(name);
          localStorage.setItem('user-name', data.user.name);
        }
      }).catch(() => {});
    }
  }, [path]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setUserDropdownOpen(false);
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target)) setThemeDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (all_product?.length > 0) {
      setTrendingItems([...all_product].sort(() => Math.random() - 0.5).slice(0, 6));
    }
  }, [all_product]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  const handleSearchInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) { setSuggestions([]); return; }
    const matched = all_product.filter(p => 
      p.name.toLowerCase().includes(q.toLowerCase()) || 
      p.brand?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6);
    setSuggestions(matched);
  };

  const handleSuggestionClick = (product) => {
    closeSearch();
    navigate(`/product/${product.id}`);
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth-token");
    window.location.replace("/login");
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const toggleMobileDropdown = (slug) => setMobileOpenDropdown(mobileOpenDropdown === slug ? null : slug);
  const closeMobileMenu = () => { setMobileMenuOpen(false); setMobileOpenDropdown(null); };

  const getBrandsForCategory = (catSlug) => brands.filter(b => b.parentCategory === catSlug);

  const calculateCartTotal = () => {
    let total = 0;
    Object.entries(cartItems).forEach(([key, qty]) => {
      if (qty <= 0) return;
      const [id, size] = key.split("_");
      const p = all_product.find(x => x.id === Number(id));
      if (p) {
        const sz = size === "null" ? null : size;
        total += getSizePrice(p, sz) * qty;
      }
    });
    return total;
  };


  const getSizePrice = (p, size) => {
    if (!p) return 0;
    if (!size) return p.new_price || p.price || 0;
    const sData = Array.isArray(p.sizes) ? p.sizes.find(s => s.size === size) : p.sizes?.[size];
    return sData?.price || p.new_price || p.price || 0;
  };

  const clearCloseTimer = () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  const startCloseTimer = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHoverDropdown(null), 300);
  };

  const displayItems = searchQuery.trim() ? suggestions : trendingItems;
  const panelLabel = searchQuery.trim() ? "Search Results" : "Trending Now";

  const cartItemsArray = Object.entries(cartItems).filter(([_, q]) => q > 0);
  // Helper to get lowest price for display in results
  const getProductDisplayPrice = (p) => {
    if (p.new_price) return p.new_price;
    if (p.price) return p.price;
    if (Array.isArray(p.sizes) && p.sizes.length > 0) {
      const prices = p.sizes.map(s => Number(s.price)).filter(pr => pr > 0);
      if (prices.length > 0) return Math.min(...prices);
    }
    return 0;
  };

  return (
    <>
      <header className={`navbar ${isScrolled ? "is-scrolled" : ""} ${searchOpen ? "search-active" : ""} ${mobileMenuOpen ? "mobile-menu-active" : ""}`}>
        <button className="nav-toggle" onClick={toggleMobileMenu}>
          <span /><span /><span />
        </button>

        <div className="nav-left desktop-only">
          <Link to="/" className="nav-logo">
            <span className="nav-logo-text">GOODSOLES<span className="nav-logo-dot">.PH</span></span>
          </Link>
        </div>

        <div className="nav-brand-mobile mobile-only">
          <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
            <span className="nav-logo-text">GOODSOLES<span className="nav-logo-dot">.PH</span></span>
          </Link>
        </div>

        <nav className={`nav-center ${mobileMenuOpen ? "open" : ""} ${searchOpen ? "nav-center--hidden" : ""}`}>
          <ul className="nav-menu">
            <li className="nav-item">
              <NavLink to="/" className="nav-link" end onClick={closeMobileMenu}>
                <span className="nav-icon">🏠</span> HOME
              </NavLink>
            </li>
            {categories.map(cat => {
              const catBrands = getBrandsForCategory(cat.slug);
              const hasBrands = catBrands.length > 0;
              const isMobileOpen = mobileOpenDropdown === cat.slug;

              return (
                <li 
                  key={cat.slug} 
                  className={`nav-item ${hasBrands ? "has-mega" : ""} ${((hoverDropdown === cat.slug) && (window.innerWidth > 900)) || (mobileOpenDropdown === cat.slug) ? "open" : ""}`}
                  onMouseEnter={() => { if (hasBrands && window.innerWidth > 900) { clearCloseTimer(); setHoverDropdown(cat.slug); } }}
                  onMouseLeave={() => { if (window.innerWidth > 900) startCloseTimer(); }}
                >
                  <NavLink to={`/${cat.slug}`} className="nav-link" onClick={() => { if (!hasBrands) closeMobileMenu(); }}>
                    <span className="nav-icon">{getCategoryIcon(cat.slug)}</span> {cat.name.toUpperCase()}
                  </NavLink>
                  {hasBrands && (
                    <button 
                      className="nav-dropdown-toggle" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation();
                        toggleMobileDropdown(cat.slug); 
                      }}
                    >
                      {isMobileOpen ? "▲" : "▼"}
                    </button>
                  )}
                  {hasBrands && (
                    <div className="mega-dropdown">
                      <div className="mega-row">
                        <div className="mega-col">
                          <h4>BRANDS</h4>
                          <ul>
                            {catBrands.map(b => (
                              <li key={b.slug}><Link to={`/${b.slug}`} onClick={closeMobileMenu}>{b.name}</Link></li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="nav-right">
          <div className="nav-search-wrap">
            <button className="nav-search-icon-btn" onClick={openSearch}><SearchIcon /></button>
          </div>

          <div className="theme-menu" ref={themeDropdownRef}>
            <button className="nav-theme-btn" onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}>
              {theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <MonitorIcon />}
            </button>
            {themeDropdownOpen && (
              <div className="theme-dropdown">
                <button 
                  className={`theme-dropdown-item ${theme === 'light' ? 'active' : ''}`} 
                  onClick={() => { setTheme('light'); setThemeDropdownOpen(false); }}
                >
                  <SunIcon /> LIGHT
                </button>
                <button 
                  className={`theme-dropdown-item ${theme === 'dark' ? 'active' : ''}`} 
                  onClick={() => { setTheme('dark'); setThemeDropdownOpen(false); }}
                >
                  <MoonIcon /> DARK
                </button>
                <button 
                  className={`theme-dropdown-item ${theme === 'system' ? 'active' : ''}`} 
                  onClick={() => { setTheme('system'); setThemeDropdownOpen(false); }}
                >
                  <MonitorIcon /> SYSTEM
                </button>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <div className="user-menu" ref={userDropdownRef}>
              <button className="nav-login-btn" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                {userName.toUpperCase()} ▼
              </button>
              {userDropdownOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <span className="user-dropdown-name">{userName}</span>
                  </div>
                  <Link to="/orderhistory" className="user-dropdown-item" onClick={() => setUserDropdownOpen(false)}>MY ORDERS</Link>
                  <Link to="/my-vouchers" className="user-dropdown-item" onClick={() => setUserDropdownOpen(false)}>MY VOUCHERS</Link>
                  <Link to="/favorites" className="user-dropdown-item" onClick={() => setUserDropdownOpen(false)}>FAVORITES</Link>
                  <Link to="/settings" className="user-dropdown-item" onClick={() => setUserDropdownOpen(false)}>ACCOUNT SETTINGS</Link>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item logout" onClick={handleLogout}>LOGOUT</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login"><button className="nav-login-btn">LOGIN</button></Link>
          )}

          <div className="nav-cart-wrapper" onClick={() => setCartDrawerOpen(true)}>
            <img src={cart_icon} alt="Cart" className="nav-cart-icon" />
            <div className="nav-cart-count">{getTotalCartItems()}</div>
          </div>
        </div>
      </header>

      {/* SEARCH OVERLAY */}
      <div className={`search-vault-overlay ${searchOpen ? "active" : ""}`}>
        <div className="vault-container">
          <div className="vault-header">
            <div className="vault-input-box">
              <span className="vault-icon"><SearchIcon /></span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="SEARCH THE VAULT..."
                value={searchQuery}
                onChange={handleSearchInput}
                autoComplete="off"
              />
              <button className="vault-close-btn" onClick={closeSearch}>CLOSE</button>
            </div>
          </div>
          <div className="vault-content">
            <div className="vault-main">
              <h3 className="vault-label">{panelLabel}</h3>
              <div className="vault-results-grid">
                {displayItems.map(p => {
                  const price = getProductDisplayPrice(p);
                  return (
                    <div key={p.id} className="vault-item-card" onClick={() => handleSuggestionClick(p)}>
                      <div className="vault-item-img"><img src={p.image} alt={p.name} /></div>
                      <div className="vault-item-info">
                        <p className="vault-item-name">{p.name}</p>
                        <p className="vault-item-price">
                          {price > 0 ? `₱${Number(price).toLocaleString()}` : "Price TBD"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {displayItems.length === 0 && searchQuery && (
                  <div className="vault-no-results">No products found for "{searchQuery}"</div>
                )}
              </div>
            </div>
            {!searchQuery && (
              <div className="vault-sidebar">
                <div className="vault-sidebar-group">
                  <h4>TOP BRANDS</h4>
                  <div className="vault-sidebar-links">
                    {brands.slice(0, 10).map(b => (
                      <Link key={b.slug} to={`/${b.slug}`} onClick={closeSearch}>{b.name}</Link>
                    ))}
                  </div>
                </div>
                <div className="vault-sidebar-group">
                  <h4>CATEGORIES</h4>
                  <div className="vault-sidebar-links">
                    {categories.map(c => (
                      <Link key={c.slug} to={`/${c.slug}`} onClick={closeSearch}>{c.name}</Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CART DRAWER */}
      <div className={`cart-drawer-overlay ${cartDrawerOpen ? "open" : ""}`} onClick={() => setCartDrawerOpen(false)} />
      <div className={`cart-drawer ${cartDrawerOpen ? "open" : ""}`}>
        <div className="cart-drawer-header">
          <h3>BAG ({getTotalCartItems()})</h3>
          <button className="close-drawer" onClick={() => setCartDrawerOpen(false)}><CloseIcon /></button>
        </div>
        <div className="cart-drawer-content">
          {cartItemsArray.length > 0 && (
            <div className="drawer-shipping-promo">
              {(() => {
                const total = calculateCartTotal();
                const remaining = 5000 - total;
                const progress = Math.min(100, (total / 5000) * 100);
                return (
                  <>
                    <p>{progress >= 100 ? "COMPLIMENTARY SHIPPING UNLOCKED" : `Add ₱${remaining.toLocaleString()} for complimentary shipping`}</p>
                    <div className="shipping-progress-bg"><div className="shipping-progress-bar" style={{ width: `${progress}%` }} /></div>
                  </>
                );
              })()}
            </div>
          )}
          <div className="drawer-items">
            {cartItemsArray.map(([key, qty]) => {
              const [id, size] = key.split("_");
              const p = all_product.find(x => x.id === Number(id));
              const sz = size === "null" ? "" : size;
              return (
                <div key={key} className="drawer-item">
                  <img src={p.image} alt={p.name} />
                  <div className="drawer-item-info">
                    <h4>{p.name}</h4>
                    {sz && <p>Size: {sz}</p>}
                    <div className="drawer-item-controls">
                      <button onClick={() => removeFromCart(key)}>-</button>
                      <span>{qty}</span>
                      <button onClick={() => addToCart(p.id, sz || null)}>+</button>
                      <span className="price">₱{(getSizePrice(p, sz) * qty).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {cartItemsArray.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="drawer-total"><span>Total</span><span>₱{calculateCartTotal().toLocaleString()}</span></div>
            <button className="drawer-checkout-btn" onClick={() => { setCartDrawerOpen(false); navigate("/place-order"); }}>CHECKOUT</button>
          </div>
        )}
      </div>
    </>
  );
};

export default Navbar;
