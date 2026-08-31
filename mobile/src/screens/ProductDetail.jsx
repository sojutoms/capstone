import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Animated,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useCart }      from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import Toast            from "react-native-toast-message";

const { width } = Dimensions.get("window");

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

/* ─────────────────── HELPERS ─────────────────── */

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ]+/g, ""));
  return Number(v);
};

const extractPrice = (price) => {
  const prim = toNumber(price);
  if (Number.isFinite(prim)) return prim;
  if (typeof price === "object") {
    const vals = Object.values(price)
      .map((v) =>
        typeof v === "object" && v.price !== undefined ? toNumber(v.price) : toNumber(v)
      )
      .filter(Number.isFinite);
    return vals.length ? Math.min(...vals) : NaN;
  }
  return NaN;
};

const formatPrice = (price) => {
  const num = extractPrice(price);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/* ─────────────────── STAR ROW ─────────────────── */

const StarRow = ({ rating, size = 13, onPress }) => (
  <View style={{ flexDirection: "row", gap: 1 }}>
    {[1, 2, 3, 4, 5].map((i) => {
      const filled = i <= Math.floor(rating);
      const half   = !filled && i - 0.5 <= rating;
      return (
        <TouchableOpacity key={i} onPress={() => onPress?.(i)} disabled={!onPress}>
          <Text style={{ fontSize: size, color: filled || half ? "#E8C84A" : "#333" }}>
            {filled ? "★" : half ? "⯨" : "★"}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */

const SHOE_CATEGORIES = ["nike", "adidas", "puma", "nb"];

export default function ProductDetailScreen({ route }) {
  const navigation                     = useNavigation();
  const { addToCart, refreshCart }               = useCart();
  const { toggleFavorite, isFavorite, refreshFavorites } = useFavorites();
  const { product }                    = route.params || {};

  const [selectedSize,     setSelectedSize]     = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDescription,  setShowDescription]  = useState(true);
  const [showReviews,      setShowReviews]      = useState(false);
  const [reviews,          setReviews]          = useState([]);
  const [loadingReviews,   setLoadingReviews]   = useState(true);
  

  const heartScale     = useRef(new Animated.Value(1)).current;
  const imageSliderRef = useRef(null);

  const favorite = isFavorite(product?.id);
  const isShoe   = SHOE_CATEGORIES.includes((product?.category || "").toLowerCase());

  if (!product) {
    return (
      <View style={s.center}>
        <Text style={{ color: "#fff" }}>No product found</Text>
      </View>
    );
  }

  const images = [product.image, ...(product.subImages || [])].filter(Boolean);

  /* ── fetch reviews ── */
  useEffect(() => { fetchReviews(); }, [product?.id]);

  const fetchReviews = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/getreviews/${product.id}`);
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
    } catch { setReviews([]); }
    finally  { setLoadingReviews(false); }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchReviews(), refreshCart(), refreshFavorites()]);
    setRefreshing(false);
  };

 

  /* ── stats ── */
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  /* ── size helpers ── */
  const getSizeStock = (size) => {
    const d = product.sizes?.[size];
    if (!d) return 0;
    return toNumber(typeof d === "object" ? d.quantity : d) || 0;
  };
  const getSizePrice = (size) => {
    const d = product.sizes?.[size];
    if (typeof d === "object" && d.price !== undefined) return toNumber(d.price);
    return extractPrice(product.new_price);
  };
  const sortedSizes = useMemo(() => {
    if (!product.sizes) return [];
    return Object.keys(product.sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [product]);
  const lowestPrice = useMemo(() => {
    const prices = sortedSizes
      .map((sz) => (getSizeStock(sz) > 0 ? getSizePrice(sz) : NaN))
      .filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : extractPrice(product.new_price);
  }, [product]);
  const displayPrice = selectedSize ? getSizePrice(selectedSize) : lowestPrice;

  /* ── add to cart ── */
  const handleAddToCart = () => {
    if (!selectedSize && product.sizes) {
      Toast.show({ type: "error", text1: "Select a size first" });
      return;
    }
    addToCart(product, selectedSize);
    Toast.show({ type: "success", text1: "Added to cart", text2: product.name });
  };

  /* ── heart press ── */
  const handleHeart = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 0  }),
    ]).start();
    toggleFavorite(product.id);
  };

  /* ── slider scroll ── */
  const onSliderScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveImageIndex(idx);
  };

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      {/* ══ TOP NAV BAR ══ */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn}>
          <Text style={s.navArrow}>←</Text>
        </TouchableOpacity>

        <Text style={s.topBarTitle} numberOfLines={1}>
          {product.name.toUpperCase()}
        </Text>

        <View style={s.navRight}>
          {/* share icon */}
          <TouchableOpacity style={s.navBtn}>
            <Text style={s.navIcon}>⎙</Text>
          </TouchableOpacity>
          {/* heart */}
          <TouchableOpacity style={s.navBtn} onPress={handleHeart}>
            <Animated.Text
              style={[s.navIcon, { transform: [{ scale: heartScale }] }, favorite && s.heartActive]}
            >
              {favorite ? "♥" : "♡"}
            </Animated.Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >

        {/* ══ IMAGE HERO WITH SLIDER ══ */}
        <View style={s.heroWrapper}>
          <FlatList
            ref={imageSliderRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onSliderScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={s.slideItem}>
                <Image source={{ uri: item }} style={s.slideImage} resizeMode="contain" />
              </View>
            )}
          />

          {/* dot indicators — bottom center */}
          {images.length > 1 && (
            <View style={s.dotsRow}>
              {images.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    imageSliderRef.current?.scrollToIndex({ index: i, animated: true });
                    setActiveImageIndex(i);
                  }}
                >
                  <View style={[s.dot, i === activeImageIndex && s.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ══ PRODUCT INFO BLOCK ══ */}
        <View style={s.infoBlock}>

          {/* Name */}
          <Text style={s.productName}>{product.name.toUpperCase()}</Text>

          {/* Category subtitle */}
          {product.category ? (
            <Text style={s.categoryLabel}>{product.category}</Text>
          ) : null}

          {/* Rating row */}
          <View style={s.ratingRow}>
            <StarRow rating={averageRating} size={14} />
            <Text style={s.ratingCount}>
              {reviews.length > 0
                ? `${reviews.length >= 1000 ? (reviews.length / 1000).toFixed(1) + "k" : reviews.length} reviews`
                : "No reviews yet"}
            </Text>
          </View>

          {/* Price row */}
          <View style={s.priceRow}>
            <View style={s.priceLeft}>
              <Text style={s.priceValue}>
                ₱{formatPrice(displayPrice)}
              </Text>
              <Text style={s.taxLabel}> (Tax incl.)</Text>
            </View>
            {product.category && (
              <View style={s.brandBadge}>
                <Text style={s.brandBadgeText}>
                  {(product.brand || product.category).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {product.old_price && (
            <Text style={s.oldPrice}>Was ₱{formatPrice(product.old_price)}</Text>
          )}
        </View>

        {/* ══ THIN DIVIDER ══ */}
        <View style={s.divider} />

        {/* ══ SIZE SELECTOR ══ */}
        {sortedSizes.length > 0 && (
          <View style={s.sizeBlock}>
            <View style={s.sizeHeader}>
              <Text style={s.sizeTitle}>SELECT SIZE</Text>
              <TouchableOpacity>
                <Text style={s.sizeGuide}>Size Guide ›</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.sizeScroll}
            >
              {sortedSizes.map((sz) => {
                const stock  = getSizeStock(sz);
                const oos    = stock === 0;
                const active = selectedSize === sz;
                return (
                  <TouchableOpacity
                    key={sz}
                    disabled={oos}
                    onPress={() => setSelectedSize(sz === selectedSize ? null : sz)}
                    style={[s.sizeChip, active && s.sizeChipActive, oos && s.sizeChipOos]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.sizeChipText, active && s.sizeChipTextActive, oos && s.sizeChipTextOos]}>
                      {sz}
                    </Text>
                    {oos && <View style={s.oosLine} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ══ AR TRY ON BUTTON ══ */}
        {isShoe && (
          <View style={s.arWrapper}>
            <TouchableOpacity
              style={s.arBtn}
              onPress={() => navigation.navigate("ARTryOn", { product })}
              activeOpacity={0.85}
            >
              <Text style={s.arBtnEmoji}>👟</Text>
              <Text style={s.arBtnText}>TRY ON WITH AR</Text>
              <Text style={s.arBtnChev}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ THIN DIVIDER ══ */}
        <View style={s.divider} />

        {/* ══ ABOUT THIS SHOE (description) ══ */}
        {product.description ? (
          <View style={s.section}>
            <TouchableOpacity
              style={s.sectionHeader}
              onPress={() => setShowDescription(!showDescription)}
              activeOpacity={0.8}
            >
              <Text style={s.sectionTitle}>ABOUT THIS SHOE</Text>
              <Text style={s.sectionChev}>{showDescription ? "∧" : "∨"}</Text>
            </TouchableOpacity>
            {showDescription && (
              <Text style={s.descText}>{product.description}</Text>
            )}
          </View>
        ) : null}

        {/* ══ THIN DIVIDER ══ */}
        <View style={s.divider} />

        {/* ══ REVIEWS ══ */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.sectionHeader}
            onPress={() => setShowReviews(!showReviews)}
            activeOpacity={0.8}
          >
            <View>
              <Text style={s.sectionTitle}>CUSTOMER REVIEWS</Text>
              <View style={s.reviewsSubRow}>
                {averageRating > 0 && <StarRow rating={averageRating} size={11} />}
                <Text style={s.reviewsSubText}>
                  {averageRating > 0
                    ? `${averageRating.toFixed(1)} · ${reviews.length} reviews`
                    : `${reviews.length} reviews`}
                </Text>
              </View>
            </View>
            <Text style={s.sectionChev}>{showReviews ? "∧" : "∨"}</Text>
          </TouchableOpacity>

          {showReviews && (
            <View style={s.reviewsList}>
              {loadingReviews ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />
              ) : reviews.length === 0 ? (
                <Text style={s.noReviews}>No reviews yet. Be the first!</Text>
              ) : (
                reviews.map((r, i) => (
                  <View key={i} style={s.reviewCard}>
                    <StarRow rating={r.rating || 0} size={11} />
                    <Text style={s.reviewText}>{r.review}</Text>
                  </View>
                ))
              )}

              
            </View>
          )}
        </View>

      </ScrollView>

      {/* ══ STICKY BOTTOM BAR ══ */}
      <View style={s.stickyBar}>
        <View style={s.stickyLeft}>
          <Text style={s.stickyLabel}>TOTAL</Text>
          <Text style={s.stickyPrice}>₱{formatPrice(displayPrice)}</Text>
        </View>

        {/* ADD TO BAG */}
        <TouchableOpacity
          style={[s.addBtn, !selectedSize && product.sizes && s.addBtnDim]}
          onPress={handleAddToCart}
          activeOpacity={0.85}
        >
          <Text style={[s.addBtnText, !selectedSize && product.sizes && s.addBtnTextDim]}>
            {selectedSize || !product.sizes ? "ADD TO BAG" : "SELECT SIZE"}
          </Text>
        </TouchableOpacity>

        {/* PAY button */}
        <TouchableOpacity style={s.payBtn} onPress={handleAddToCart} activeOpacity={0.85}>
          <Text style={s.payIcon}>⊟</Text>
          <Text style={s.payText}>PAY</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════ */

const HERO_H = width * 0.88;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#0D0D0D" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D0D0D" },

  /* ── top nav ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#0D0D0D",
  },
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  navArrow: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "300",
  },
  navIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
  },
  heartActive: {
    color: "#E84A4A",
  },
  topBarTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  navRight: {
    flexDirection: "row",
    gap: 4,
  },

  /* ── hero slider ── */
  heroWrapper: {
    width,
    height: HERO_H,
    backgroundColor: "#141414",
    position: "relative",
  },
  slideItem: {
    width,
    height: HERO_H,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#141414",
  },
  slideImage: {
    width: "80%",
    height: "75%",
  },

  /* ── dots ── */
  dotsRow: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },

  /* ── info block ── */
  infoBlock: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 8,
    backgroundColor: "#0D0D0D",
  },
  productName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    lineHeight: 32,
  },
  categoryLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "400",
    marginTop: -2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  ratingCount: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 0,
  },
  priceValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  taxLabel: {
    fontSize: 12,
    color: "#555",
    fontWeight: "400",
  },
  brandBadge: {
    borderWidth: 1,
    borderColor: "#2E2E2E",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brandBadgeText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  oldPrice: {
    fontSize: 13,
    color: "#3A3A3A",
    textDecorationLine: "line-through",
    marginTop: -2,
  },

  divider: {
    height: 1,
    backgroundColor: "#1A1A1A",
    marginHorizontal: 20,
  },

  /* ── size selector ── */
  sizeBlock: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  sizeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sizeTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#888",
  },
  sizeGuide: {
    fontSize: 12,
    color: "#666",
    letterSpacing: 0.3,
  },
  sizeScroll: {
    paddingRight: 20,
    gap: 8,
    flexDirection: "row",
  },
  sizeChip: {
    minWidth: 58,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#181818",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    position: "relative",
    overflow: "hidden",
  },
  sizeChipActive: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#00C8FF",
  },
  sizeChipOos: {
    opacity: 0.3,
  },
  sizeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
  },
  sizeChipTextActive: {
    color: "#00C8FF",
    fontWeight: "700",
  },
  sizeChipTextOos: {
    color: "#2A2A2A",
  },
  oosLine: {
    position: "absolute",
    width: "140%",
    height: 1,
    backgroundColor: "#2A2A2A",
    transform: [{ rotate: "-45deg" }],
  },

  /* ── AR try on ── */
  arWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  arBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A1A2A",
    borderWidth: 1,
    borderColor: "#00C8FF33",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
  },
  arBtnEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  arBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#00C8FF",
  },
  arBtnChev: {
    fontSize: 18,
    color: "#00C8FF",
    fontWeight: "300",
  },

  /* ── sections (description / reviews) ── */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#888",
  },
  sectionChev: {
    fontSize: 12,
    color: "#444",
    fontWeight: "600",
  },
  descText: {
    marginTop: 12,
    fontSize: 14,
    color: "#777",
    lineHeight: 22,
  },

  /* ── reviews ── */
  reviewsSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
  },
  reviewsSubText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  reviewsList: {
    marginTop: 16,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: "#141414",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    padding: 14,
    gap: 8,
  },
  reviewText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  noReviews: {
    fontSize: 13,
    color: "#333",
    letterSpacing: 0.3,
    paddingVertical: 12,
  },
  writeReview: {
    marginTop: 8,
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    padding: 16,
    gap: 14,
  },
  writeTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#444",
  },
  writeRatingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  writeMuted: {
    fontSize: 12,
    color: "#444",
  },
  reviewInput: {
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    color: "#FFF",
    fontSize: 13,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  submitBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
  },
  submitText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 2,
  },

  /* ── sticky bottom bar ── */
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
    gap: 10,
  },
  stickyLeft: {
    gap: 1,
    minWidth: 90,
  },
  stickyLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#555",
    fontWeight: "700",
  },
  stickyPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  addBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addBtnDim: {
    backgroundColor: "#111",
    borderColor: "#1E1E1E",
  },
  addBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 2,
  },
  addBtnTextDim: {
    color: "#555",
  },
  payBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  payIcon: {
    fontSize: 14,
    color: "#000",
    lineHeight: 18,
  },
  payText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1.5,
  },
});