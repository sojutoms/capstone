import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ScrollView,
  RefreshControl,
  Platform,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { colors, fonts, radius } from "../theme";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import FadeInItem from "../components/FadeInItem";
import ProductCard from "../components/ProductCard";
import { isOutOfStock } from "../utils/productHelpers";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

// Same category-membership rules each dedicated category screen uses to
// filter the shared /allproducts pool, so these previews always match what
// "SEE ALL" actually shows.
const SHOE_BRAND_VALUES = ["nike", "adidas", "puma", "nb"];

function filterByCategory(products, key) {
  switch (key) {
    case "shoes":
      return products.filter((p) => {
        const brand = (p.brand || p.category || "").toLowerCase().trim();
        return SHOE_BRAND_VALUES.includes(brand) || brand === "new balance";
      });
    case "watches":
      return products.filter(
        (p) => p.type === "watch" || p.category === "watch" || p.category === "watches"
      );
    case "bags":
      return products.filter(
        (p) => p.type === "bag" || p.category === "bag" || p.category === "bags"
      );
    case "collectibles":
      return products.filter(
        (p) => p.type === "collectible" || p.category === "collectible" || p.category === "collectibles"
      );
    default:
      return [];
  }
}

/* ─────────────────── CATEGORY CONFIG ─────────────────── */

const CATEGORIES = [
  {
    key: "shoes",
    label: "Shoes",
    active: true,
    screen: "ShoesScreen",
    directNav: false,         // has brand sub-rows
    brands: [
      { label: "All Brands", value: "all" },
      { label: "Nike",        value: "nike" },
      { label: "Adidas",      value: "adidas" },
      { label: "Puma",        value: "puma" },
      { label: "New Balance", value: "nb" },
    ],
  },
  {
    key: "watches",
    label: "Watches",
    active: true,
    screen: "WatchesScreen",
    directNav: true,          // navigate directly, no brand sub-rows
    brands: [],
  },
  {
    key: "bags",
    label: "Bags",
    active: true,
    screen: "BagsScreen",
    directNav: true,
    brands: [],
  },
  {
    key: "collectibles",
    label: "Collectibles",
    active: true,
    screen: "CollectiblesScreen",
    directNav: true,
    brands: [],
  },
];

/* ─────────────────── SECTION HEADER ─────────────────── */

const SectionHeader = ({ title, onSeeAll }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
        <Text style={styles.seeAll}>SEE ALL →</Text>
      </TouchableOpacity>
    )}
  </View>
);

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function ShopScreen({ navigation }) {
  const { addToCart, refreshCart } = useCart();
  const { favorites, toggleFavorite, isFavorite, refreshFavorites } = useFavorites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Searches the full product pool (shoes, watches, bags, collectibles
  // together) instead of handing off to ShoesScreen's shoes-only search.
  const searchResults = searchQuery.trim()
    ? products.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.type && p.type.toLowerCase().includes(q))
        );
      })
    : [];

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${BASE_URL}/allproducts`);
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >
        {/* ── TOP NAV ── */}
        <View style={styles.topNav}>
          <View>
            <Text style={styles.eyebrow}>BROWSE</Text>
            <Text style={styles.navTitle}>SHOP</Text>
          </View>
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => navigation.navigate("Favorites")}
            activeOpacity={0.8}
          >
            <Ionicons name="heart" size={19} color={colors.accentGold} />
            {favorites.length > 0 && (
              <View style={styles.favBadge}>
                <Text style={styles.favBadgeText}>{favorites.length > 9 ? "9+" : favorites.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="What are you looking for?"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim() ? (
          /* ── SEARCH RESULTS (across every category) ── */
          <View style={styles.searchResults}>
            {searchResults.length > 0 ? (
              <View style={styles.grid}>
                {searchResults.map((item, index) => (
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
            ) : (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>No products match "{searchQuery}"</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* ── CATEGORY PREVIEWS ── */}
            {!loading &&
              CATEGORIES.map((cat) => {
                const items = filterByCategory(products, cat.key).slice(0, 6);
                if (!items.length) return null;
                return (
                  <View key={cat.key} style={styles.categorySection}>
                    <SectionHeader
                      title={cat.label}
                      onSeeAll={() => navigation.navigate(cat.screen)}
                    />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    >
                      {items.map((item, index) => (
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
                    </ScrollView>
                  </View>
                );
              })}

            {/* ── FOOTER ── */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>MORE CATEGORIES DROPPING SOON</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


/* ─────────────────── MAIN STYLES ─────────────────── */

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bgPrimary },
  scrollContent: { paddingBottom: TAB_BAR_CLEARANCE },
  topNav: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  eyebrow:      { fontSize: 9, letterSpacing: 3, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginBottom: 1 },
  navTitle:     { fontSize: 32, color: colors.textPrimary, letterSpacing: 2, fontFamily: fonts.display },
  favBtn: {
    width: 38, height: 38, borderRadius: 19,
    marginTop: 4,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  favBadge: {
    position: "absolute",
    top: -4, right: -4,
    backgroundColor: "#E53E1A",
    borderRadius: 8,
    minWidth: 16, height: 16,
    paddingHorizontal: 3,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.bgPrimary,
  },
  favBadgeText: { fontSize: 9, color: colors.textPrimary, fontFamily: fonts.bodyBold },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 6, marginBottom: 18,
    paddingHorizontal: 14, height: 46,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderLight,
    borderRadius: radius.full,
  },
  searchIcon:        { fontSize: 13 },
  searchInput:       { flex: 1, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.bodyRegular, padding: 0 },
  searchClear:       { fontSize: 13, color: colors.textMuted },
  searchResults:     { paddingTop: 4 },
  grid:              { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  emptyResults:      { paddingVertical: 60, alignItems: "center", paddingHorizontal: 40 },
  emptyResultsText:  { fontSize: 13, color: colors.textMuted, textAlign: "center", fontFamily: fonts.bodyRegular },
  categorySection: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 16, marginTop: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 22, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display },
  seeAllBtn:    { paddingBottom: 2 },
  seeAll:       { fontSize: 9, color: colors.textSecondary, letterSpacing: 1.5, fontFamily: fonts.bodySemibold },
  footer:       { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  footerText:   { fontSize: 8, letterSpacing: 2.5, color: colors.bgTertiary, fontFamily: fonts.bodyBold },
});