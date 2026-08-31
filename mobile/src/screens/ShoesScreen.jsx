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
  Modal,
  RefreshControl,
} from "react-native";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { colors, fonts, radius, typography } from "../theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

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

const SHOE_BRAND_VALUES = ["nike", "adidas", "puma", "nb"];

const SUBCATEGORIES = ["All", "Lifestyle", "Basketball", "Running"];

const SORT_OPTIONS = [
  { label: "Newest",          value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Name A–Z",        value: "name_asc" },
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
  const { refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();

  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [selectedBrand,  setSelectedBrand]  = useState(initialBrand);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy,         setSortBy]         = useState("newest");
  const [showSearch,     setShowSearch]     = useState(false);
  const [showSortModal,  setShowSortModal]  = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), refreshCart(), refreshFavorites()]);
    setRefreshing(false);
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
    if (selectedBrand === "all") {
      result = result.filter((p) => {
        const brand = (p.brand || p.category || "").toLowerCase().trim();
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

    // ── SUBCATEGORY FILTER ────────────────────────────────────────────────
    if (activeCategory !== "All") {
      const activeLower = activeCategory.toLowerCase();
      result = result.filter(
        (p) =>
          Array.isArray(p.subCategories) &&
          p.subCategories.some((sc) => sc.toLowerCase() === activeLower)
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

  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Sort";

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accentGold} />
        <Text style={styles.loaderText}>Loading drops…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

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
            placeholderTextColor={colors.textMuted}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >
        {/* ── STICKY FILTERS ── */}
        <View style={styles.stickyFilters}>

          {/* Subcategory underline tabs */}
          <View style={styles.tabsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {SUBCATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={styles.tab}
                >
                  <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                    {cat}
                  </Text>
                  {activeCategory === cat && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.tabDivider} />
          </View>

          {/* Sort button + result count row */}
          <View style={styles.sortRow}>
            <Text style={styles.resultCount}>
              {displayed.length} {displayed.length === 1 ? "result" : "results"}
            </Text>
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setShowSortModal(true)}
            >
              <Text style={styles.sortBtnText}>{activeSortLabel}</Text>
              <Text style={styles.sortBtnIcon}>▾</Text>
            </TouchableOpacity>
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

      {/* ── SORT DROPDOWN MODAL ── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>SORT BY</Text>
            {SORT_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.dropdownItem, sortBy === s.value && styles.dropdownItemActive]}
                onPress={() => {
                  setSortBy(s.value);
                  setShowSortModal(false);
                }}
              >
                <Text style={[styles.dropdownItemText, sortBy === s.value && styles.dropdownItemTextActive]}>
                  {s.label}
                </Text>
                {sortBy === s.value && <Text style={styles.dropdownCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgPrimary },
  loader:     { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" },
  loaderText: { color: colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: 12 },
  container:  { flex: 1, backgroundColor: colors.bgPrimary },

  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.bgPrimary,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: "center", alignItems: "center",
  },
  backText:  { color: colors.textPrimary, fontSize: 16 },
  eyebrow:   { fontSize: 9, letterSpacing: 3, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginBottom: 1 },
  navTitle:  { fontSize: 30, fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 1.5 },
  navIcons:  { flexDirection: "row", gap: 8, paddingTop: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: "center", alignItems: "center",
  },
  iconText: { fontSize: 14 },

  searchBarWrap: { overflow: "hidden", backgroundColor: colors.bgPrimary, paddingHorizontal: 16 },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderLight,
    borderRadius: radius.md, paddingHorizontal: 12, height: 42, marginBottom: 8, gap: 8,
  },
  searchIcon:  { fontSize: 13 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  searchClear: { color: colors.textMuted, fontSize: 14, paddingLeft: 4 },

  stickyFilters: { backgroundColor: colors.bgPrimary, paddingTop: 4, paddingBottom: 0 },

  /* ── Underline tabs (Nike-style) ── */
  tabsRow: { backgroundColor: colors.bgPrimary },
  tab: {
    marginRight: 24,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accentGold,
    fontWeight: "700",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accentGold,
    borderRadius: 1,
  },
  tabDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginTop: 0,
  },

  /* ── Sort row ── */
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultCount: { color: colors.textMuted, fontSize: 12, fontWeight: "500" },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.bgCard,
  },
  sortBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  sortBtnIcon: { color: colors.textPrimary, fontSize: 10 },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, paddingTop: 4 },

  card:          { width: CARD_WIDTH, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden" },
  cardImageWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.bgSurface, justifyContent: "center", alignItems: "center", position: "relative" },
  cardImage:     { width: "80%", height: "80%" },
  heartBtn:      { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  heartIcon:     { color: colors.textPrimary, fontSize: 12 },

  badge:           { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, zIndex: 1 },
  badge_new:       { backgroundColor: colors.accentGold },
  badge_hot:       { backgroundColor: "#E53E1A" },
  badge_sale:      { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderLight },
  badgeText:       { fontSize: 7, fontWeight: "700", letterSpacing: 1.5 },
  badgeText_new:   { color: colors.textInverse },
  badgeText_hot:   { color: colors.textPrimary },
  badgeText_sale:  { color: colors.textMuted },

  cardBody:    { padding: 10 },
  cardBrand:   { fontSize: 8, fontFamily: fonts.bodySemibold, letterSpacing: 2, color: colors.textMuted, marginBottom: 2 },
  cardName:    { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textPrimary, lineHeight: 18, marginBottom: 8 },
  cardFooter:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  oldPrice:    { fontSize: 10, color: colors.textMuted, textDecorationLine: "line-through", marginBottom: 1 },
  newPrice:    { fontSize: 13, fontWeight: "700", color: colors.accentGold },
  addBtn:      { width: 28, height: 28, backgroundColor: colors.textPrimary, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  addBtnText:  { color: colors.textInverse, fontSize: 18, fontWeight: "300", lineHeight: 22 },

  emptyState:    { paddingVertical: 60, alignItems: "center", paddingHorizontal: 40 },
  emptyIcon:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { color: colors.textPrimary, fontSize: 17, fontFamily: fonts.display, letterSpacing: 2, marginBottom: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18, marginBottom: 28 },
  resetBtn:      { borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.sm },
  resetBtnText:  { ...typography.button, color: colors.textPrimary, fontSize: 11 },

  /* ── Sort modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dropdownMenu: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  dropdownTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownItemActive: {},
  dropdownItemText: { fontSize: 15, color: colors.textSecondary, fontWeight: "500" },
  dropdownItemTextActive: { color: colors.accentGold, fontWeight: "700" },
  dropdownCheck: { color: colors.accentGold, fontSize: 14, fontWeight: "700" },
});