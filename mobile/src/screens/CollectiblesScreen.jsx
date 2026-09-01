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
import FadeInItem from "../components/FadeInItem";
import ProductCard from "../components/ProductCard";
import { getLowestPrice, isOutOfStock } from "../utils/productHelpers";
import Toast from "react-native-toast-message";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const { width } = Dimensions.get("window");

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

/* ─────────────────── CONFIG ─────────────────── */

const SORT_OPTIONS = [
  { label: "Newest",             value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Name A–Z",           value: "name_asc" },
];

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function CollectiblesScreen({ navigation }) {
  const { addToCart, refreshCart } = useCart();
  const { toggleFavorite, isFavorite, refreshFavorites } = useFavorites();

  const handleAddToCart = (item) => {
    if (isOutOfStock(item)) {
      Toast.show({ type: "error", text1: "Out of stock" });
      return;
    }
    const sizes = item.sizes ? Object.keys(item.sizes) : [];
    const available = sizes.filter((sz) => {
      const d = item.sizes[sz];
      return Number((typeof d === "object" ? d.quantity : d) || 0) > 0;
    });
    if (available.length === 1) {
      addToCart(item, available[0]);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    } else if (available.length > 1) {
      Toast.show({ type: "info", text1: "Select a size first" });
      navigation.navigate("ProductDetail", { product: item });
    } else {
      addToCart(item, null);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    }
  };

  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [sortBy,        setSortBy]        = useState("newest");
  const [showSearch,    setShowSearch]    = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/allproducts`);
      const data = await res.json();
      const collectibles = Array.isArray(data)
        ? data.filter(
            (p) =>
              p.type === "collectible" ||
              p.category === "collectible" ||
              p.category === "collectibles"
          )
        : [];
      setProducts(collectibles);
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

    // ── SEARCH ──────────────────────────────────────────────────────────
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name     && p.name.toLowerCase().includes(q)) ||
          (p.brand    && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    // ── SORT ──────────────────────────────────────────────────────────
    switch (sortBy) {
      case "price_asc":  result.sort((a, b) => (getLowestPrice(a) || 0) - (getLowestPrice(b) || 0)); break;
      case "price_desc": result.sort((a, b) => (getLowestPrice(b) || 0) - (getLowestPrice(a) || 0)); break;
      case "name_asc":   result.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      default: break;
    }

    return result;
  }, [products, searchQuery, sortBy]);

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
            <Text style={styles.navTitle}>COLLECTIBLES</Text>
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
            placeholder="Search collectibles, brands…"
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
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >
        {/* ── STICKY SORT ROW ── */}
        <View style={styles.stickyFilters}>
          <View style={styles.divider} />
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
            <Text style={styles.emptyIcon}>🎖️</Text>
            <Text style={styles.emptyTitle}>NO COLLECTIBLES FOUND</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term.
            </Text>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
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
              <FadeInItem key={item._id || index} index={index}>
                <ProductCard
                  item={item}
                  index={index}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                  onAddToCart={handleAddToCart}
                  favorited={isFavorite(item.id)}
                  onToggleFavorite={() => toggleFavorite(item.id)}
                />
              </FadeInItem>
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

  divider: { height: 1, backgroundColor: colors.borderSubtle },

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

  emptyState:    { paddingVertical: 60, alignItems: "center", paddingHorizontal: 40 },
  emptyIcon:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { color: colors.textPrimary, fontSize: 17, fontFamily: fonts.display, letterSpacing: 2, marginBottom: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18, marginBottom: 28 },
  resetBtn:      { borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.sm },
  resetBtnText:  { ...typography.button, color: colors.textPrimary, fontSize: 11 },

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