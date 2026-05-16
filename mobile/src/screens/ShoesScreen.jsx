import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
  TextInput,
  Animated,
} from "react-native";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://unlaboured-charise-unmachined.ngrok-free.dev";

/* ─────────────────── PRICE HELPERS ─────────────────── */

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ]+/g, ""));
  return Number(v);
};

const PRICE_KEYS = ["price", "amount", "retail_price", "value", "new_price", "price_php", "php", "p"];
const QTY_KEYS   = ["quantity", "qty", "stock", "available", "inventory"];

const findPriceInEntry = (entry) => {
  if (!entry) return NaN;
  if (typeof entry === "number" || typeof entry === "string") {
    const n = toNumber(entry);
    return Number.isFinite(n) ? n : NaN;
  }
  if (Array.isArray(entry)) {
    for (const it of entry) {
      const p = findPriceInEntry(it);
      if (Number.isFinite(p)) return p;
    }
  }
  if (typeof entry === "object") {
    for (const k of PRICE_KEYS) {
      if (entry[k] !== undefined) {
        const p = toNumber(entry[k]);
        if (Number.isFinite(p)) return p;
      }
    }
    for (const val of Object.values(entry)) {
      const p = findPriceInEntry(val);
      if (Number.isFinite(p)) return p;
    }
  }
  return NaN;
};

const isAvailableEntry = (entry) => {
  if (!entry) return false;
  if (typeof entry !== "object") return true;
  for (const k of QTY_KEYS) {
    if (entry[k] !== undefined) {
      const q = toNumber(entry[k]);
      return Number.isFinite(q) && q > 0;
    }
  }
  return true;
};

const getLowestPrice = (product) => {
  let prices = [];
  if (product.sizes) {
    Object.values(product.sizes).forEach((entry) => {
      if (!isAvailableEntry(entry)) return;
      const p = findPriceInEntry(entry);
      if (Number.isFinite(p) && p > 0) prices.push(p);
    });
  }
  if (prices.length === 0) {
    const p1 = findPriceInEntry(product.new_price);
    const p2 = findPriceInEntry(product.price);
    if (Number.isFinite(p1)) prices.push(p1);
    if (Number.isFinite(p2)) prices.push(p2);
  }
  return prices.length === 0 ? null : Math.min(...prices);
};

const getBadge = (product, index) => {
  if (product.is_new || product.badge === "new") return { label: "NEW", style: "new" };
  if (product.is_hot || product.badge === "hot") return { label: "HOT", style: "hot" };
  if (product.old_price)                         return { label: "SALE", style: "sale" };
  if (index % 5 === 0)                           return { label: "NEW", style: "new" };
  if (index % 7 === 3)                           return { label: "HOT", style: "hot" };
  return null;
};

/* ─────────────────── CONFIG ─────────────────── */

// The exact brand values that count as "shoes" — used to scope the All filter
const SHOE_BRAND_VALUES = ["nike", "adidas", "puma", "nb"];

const BRANDS = [
  { label: "All",         value: "all" },
  { label: "Nike",        value: "nike" },
  { label: "Adidas",      value: "adidas" },
  { label: "Puma",        value: "puma" },
  { label: "New Balance", value: "nb" },
];

const CATEGORIES = ["All", "Running", "Lifestyle", "Training", "Outdoor", "Collab"];

const SORT_OPTIONS = [
  { label: "Newest",    value: "newest" },
  { label: "Price ↑",  value: "price_asc" },
  { label: "Price ↓",  value: "price_desc" },
  { label: "Name A–Z", value: "name_asc" },
];

/* ─────────────────── PRODUCT CARD ─────────────────── */

const ProductCard = ({ item, index, onPress }) => {
  const price       = getLowestPrice(item);
  const hasMultiple = item.sizes && Object.keys(item.sizes).length > 1;
  const badge       = getBadge(item, index);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardImageWrap}>
        {badge && (
          <View style={[styles.badge, styles[`badge_${badge.style}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${badge.style}`]]}>
              {badge.label}
            </Text>
          </View>
        )}
        <TouchableOpacity style={styles.heartBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Text style={styles.heartIcon}>♡</Text>
        </TouchableOpacity>
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="contain" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardBrand} numberOfLines={1}>
          {(item.brand || item.category || "").toUpperCase()}
        </Text>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.cardFooter}>
          <View>
            {item.old_price && (
              <Text style={styles.oldPrice}>
                ₱{toNumber(item.old_price)?.toLocaleString("en-PH")}
              </Text>
            )}
            <Text style={styles.newPrice}>
              {price ? `${hasMultiple ? "From " : ""}₱${price.toLocaleString("en-PH")}` : "TBA"}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={onPress} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function ShoesScreen({ navigation, route }) {
  const initialBrand = route?.params?.selectedBrand || "all";

  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [selectedBrand,  setSelectedBrand]  = useState(initialBrand);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy,         setSortBy]         = useState("newest");
  const [showSearch,     setShowSearch]     = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/allproducts`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("FETCH ERROR:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSearch = () => {
    const toValue = showSearch ? 0 : 1;
    setShowSearch(!showSearch);
    if (showSearch) setSearchQuery("");
    Animated.timing(searchAnim, { toValue, duration: 220, useNativeDriver: false }).start();
  };

  /* ── Filter + sort ── */
  const filteredProducts = useCallback(() => {
    let result = [...products];

    // ── BRAND FILTER ──────────────────────────────────────────────────────
    // "All" → only show products whose brand is one of the 4 shoe brands
    // Specific brand → show only that exact brand
    if (selectedBrand === "all") {
      result = result.filter((p) => {
        const brand = (p.brand || p.category || "").toLowerCase().trim();
        // "nb" stored as "new balance" in some DBs — handle both
        return (
          SHOE_BRAND_VALUES.includes(brand) ||
          brand === "new balance"
        );
      });
    } else {
      result = result.filter((p) => {
        const brand = (p.brand || p.category || "").toLowerCase().trim();
        if (selectedBrand === "nb") {
          return brand === "nb" || brand === "new balance";
        }
        return brand === selectedBrand;
      });
    }

    // ── CATEGORY FILTER ───────────────────────────────────────────────────
    if (activeCategory !== "All") {
      result = result.filter(
        (p) =>
          (p.type && p.type.toLowerCase() === activeCategory.toLowerCase()) ||
          (p.tags && p.tags.includes(activeCategory.toLowerCase()))
      );
    }

    // ── SEARCH ────────────────────────────────────────────────────────────
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name     && p.name.toLowerCase().includes(q)) ||
          (p.brand    && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    // ── SORT ──────────────────────────────────────────────────────────────
    switch (sortBy) {
      case "price_asc":  result.sort((a, b) => (getLowestPrice(a) || 0) - (getLowestPrice(b) || 0)); break;
      case "price_desc": result.sort((a, b) => (getLowestPrice(b) || 0) - (getLowestPrice(a) || 0)); break;
      case "name_asc":   result.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      default: break;
    }

    return result;
  }, [products, selectedBrand, activeCategory, searchQuery, sortBy]);

  const displayed = filteredProducts();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loaderText}>Loading drops…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* ── TOP NAV ── */}
      <View style={styles.topNav}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>BROWSE</Text>
            <Text style={styles.navTitle}>SHOES</Text>
          </View>
        </View>
        <View style={styles.navIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleSearch}>
            <Text style={styles.iconText}>{showSearch ? "✕" : "🔍"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SEARCH BAR (animated) ── */}
      <Animated.View
        style={[
          styles.searchBarWrap,
          {
            maxHeight: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }),
            opacity: searchAnim,
          },
        ]}
      >
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search shoes, brands…"
            placeholderTextColor="#444"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        stickyHeaderIndices={[0]}
      >
        {/* ── STICKY FILTERS ── */}
        <View style={styles.stickyFilters}>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsRow}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.tab, activeCategory === cat && styles.tabActive]}
              >
                {activeCategory === cat && <View style={styles.tabDot} />}
                <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Brand chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.brandsRow}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {BRANDS.map((b) => (
              <TouchableOpacity
                key={b.value}
                onPress={() => setSelectedBrand(b.value)}
                style={[styles.brandChip, selectedBrand === b.value && styles.brandChipActive]}
              >
                <Text style={[styles.brandChipText, selectedBrand === b.value && styles.brandChipTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort + result count row */}
          <View style={styles.sortRow}>
            <Text style={styles.resultCount}>
              {displayed.length} {displayed.length === 1 ? "RESULT" : "RESULTS"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {SORT_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSortBy(s.value)}
                  style={[styles.sortChip, sortBy === s.value && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, sortBy === s.value && styles.sortChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── PRODUCT GRID ── */}
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👟</Text>
            <Text style={styles.emptyTitle}>NO PRODUCTS FOUND</Text>
            <Text style={styles.emptySubtitle}>
              Try a different category or search term.
            </Text>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
                setSelectedBrand("all");
                setActiveCategory("All");
                setSearchQuery("");
                setSortBy("newest");
              }}
            >
              <Text style={styles.resetBtnText}>RESET FILTERS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {displayed.map((item, index) => (
              <ProductCard
                key={item._id || index}
                item={item}
                index={index}
                onPress={() => navigation.navigate("ProductDetail", { product: item })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: "#0A0A0A" },
  loader:     { flex: 1, backgroundColor: "#0A0A0A", justifyContent: "center", alignItems: "center" },
  loaderText: { color: "#555", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: 12 },
  container:  { flex: 1, backgroundColor: "#0A0A0A" },

  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#0A0A0A",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A",
    justifyContent: "center", alignItems: "center",
  },
  backText:  { color: "#fff", fontSize: 16 },
  eyebrow:   { fontSize: 9, letterSpacing: 3, color: "#555", fontWeight: "400", marginBottom: 1 },
  navTitle:  { fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: 2 },
  navIcons:  { flexDirection: "row", gap: 8, paddingTop: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A",
    justifyContent: "center", alignItems: "center",
  },
  iconText: { fontSize: 14 },

  searchBarWrap: { overflow: "hidden", backgroundColor: "#0A0A0A", paddingHorizontal: 16 },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#141414", borderWidth: 1, borderColor: "#2A2A2A",
    borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 8, gap: 8,
  },
  searchIcon:  { fontSize: 13 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  searchClear: { color: "#444", fontSize: 14, paddingLeft: 4 },

  stickyFilters: { backgroundColor: "#0A0A0A", paddingTop: 8, paddingBottom: 4 },

  tabsRow: { marginBottom: 8 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 16,
    borderRadius: 8, backgroundColor: "#141414",
    borderWidth: 1, borderColor: "#2A2A2A", marginRight: 8,
  },
  tabActive:     { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  tabDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: "#000" },
  tabText:       { fontSize: 12, fontWeight: "500", color: "#555" },
  tabTextActive: { color: "#000", fontWeight: "700" },

  brandsRow: { marginBottom: 8 },
  brandChip: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 6, borderWidth: 1, borderColor: "#2A2A2A",
    marginRight: 6, backgroundColor: "transparent",
  },
  brandChipActive:     { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  brandChipText:       { fontSize: 11, fontWeight: "500", color: "#555" },
  brandChipTextActive: { color: "#000", fontWeight: "700" },

  sortRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
  },
  resultCount:        { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginRight: 10 },
  sortChip:           { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: "#2A2A2A", backgroundColor: "transparent" },
  sortChipActive:     { backgroundColor: "#1e1e1e", borderColor: "#444" },
  sortChipText:       { fontSize: 10, color: "#444", fontWeight: "600" },
  sortChipTextActive: { color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, paddingTop: 14 },

  card:          { width: CARD_WIDTH, backgroundColor: "#141414", borderRadius: 16, borderWidth: 1, borderColor: "#2A2A2A", overflow: "hidden" },
  cardImageWrap: { width: "100%", aspectRatio: 1, backgroundColor: "#1A1A1A", justifyContent: "center", alignItems: "center", position: "relative" },
  cardImage:     { width: "80%", height: "80%" },
  heartBtn:      { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  heartIcon:     { color: "#fff", fontSize: 12 },

  badge:           { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, zIndex: 1 },
  badge_new:       { backgroundColor: "#FFFFFF" },
  badge_hot:       { backgroundColor: "#E53E1A" },
  badge_sale:      { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333" },
  badgeText:       { fontSize: 7, fontWeight: "700", letterSpacing: 1.5 },
  badgeText_new:   { color: "#000" },
  badgeText_hot:   { color: "#fff" },
  badgeText_sale:  { color: "#666" },

  cardBody:    { padding: 10 },
  cardBrand:   { fontSize: 8, fontWeight: "600", letterSpacing: 2, color: "#555", marginBottom: 2 },
  cardName:    { fontSize: 13, fontWeight: "700", color: "#FFFFFF", lineHeight: 18, marginBottom: 8 },
  cardFooter:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  oldPrice:    { fontSize: 10, color: "#444", textDecorationLine: "line-through", marginBottom: 1 },
  newPrice:    { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  addBtn:      { width: 28, height: 28, backgroundColor: "#FFFFFF", borderRadius: 7, justifyContent: "center", alignItems: "center" },
  addBtnText:  { color: "#000", fontSize: 18, fontWeight: "300", lineHeight: 22 },

  emptyState:    { paddingVertical: 60, alignItems: "center", paddingHorizontal: 40 },
  emptyIcon:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 3, marginBottom: 8 },
  emptySubtitle: { color: "#444", fontSize: 12, textAlign: "center", lineHeight: 18, marginBottom: 28 },
  resetBtn:      { borderWidth: 1, borderColor: "#2a2a2a", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 6 },
  resetBtnText:  { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
});