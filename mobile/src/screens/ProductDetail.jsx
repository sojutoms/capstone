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
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ImageViewing from "react-native-image-viewing";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCart }      from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import Toast            from "react-native-toast-message";
import { colors, fonts, radius, typography } from "../theme";
import PressScale from "../components/PressScale";
import { triggerFlyToCart } from "../utils/flyToCartBus";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

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

const formatReviewDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/* ─────────────────── STAR ROW ─────────────────── */

const StarRow = ({ rating, size = 13, onPress }) => (
  <View style={{ flexDirection: "row", gap: 1 }}>
    {[1, 2, 3, 4, 5].map((i) => {
      const filled = i <= Math.floor(rating);
      const half   = !filled && i - 0.5 <= rating;
      return (
        <TouchableOpacity key={i} onPress={() => onPress?.(i)} disabled={!onPress}>
          <Text style={{ fontSize: size, color: filled || half ? colors.accentGold : colors.bgTertiary }}>
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
  const [sizeGuideVisible, setSizeGuideVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  

  const heartScale     = useRef(new Animated.Value(1)).current;
  const imageSliderRef = useRef(null);
  const addBtnRef      = useRef(null);

  const favorite = isFavorite(product?.id);
  const isShoe   = SHOE_CATEGORIES.includes((product?.category || "").toLowerCase());

  if (!product) {
    return (
      <View style={s.center}>
        <Text style={{ color: colors.textPrimary }}>No product found</Text>
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
    addBtnRef.current?.measureInWindow((x, y, width, height) => {
      triggerFlyToCart({ x, y, width, height });
    });
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
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

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
        contentContainerStyle={{ paddingBottom: 130 + TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
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
              <TouchableOpacity
                style={s.slideItem}
                activeOpacity={0.9}
                onPress={() => setImageViewerVisible(true)}
              >
                <Image source={{ uri: item }} style={s.slideImage} resizeMode="contain" />
              </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setSizeGuideVisible(true)}>
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
                <ActivityIndicator color={colors.accentGold} style={{ marginVertical: 24 }} />
              ) : reviews.length === 0 ? (
                <Text style={s.noReviews}>No reviews yet. Be the first!</Text>
              ) : (
                reviews.map((r, i) => (
                  <View key={i} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <View style={s.reviewAvatarWrap}>
                        {r.userPhoto ? (
                          <Image source={{ uri: r.userPhoto }} style={s.reviewAvatarImg} />
                        ) : (
                          <Ionicons name="person" size={14} color={colors.textMuted} />
                        )}
                      </View>
                      <Text style={s.reviewAuthor} numberOfLines={1}>
                        {r.userName && r.userName !== "Anonymous" ? r.userName : "Anonymous"}
                      </Text>
                      {r.date && <Text style={s.reviewDate}>{formatReviewDate(r.date)}</Text>}
                    </View>
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
        <PressScale
          ref={addBtnRef}
          style={[s.addBtn, !selectedSize && product.sizes && s.addBtnDim]}
          onPress={handleAddToCart}
        >
          <Text style={[s.addBtnText, !selectedSize && product.sizes && s.addBtnTextDim]}>
            {selectedSize || !product.sizes ? "ADD TO BAG" : "SELECT SIZE"}
          </Text>
        </PressScale>

        {/* PAY button */}
        <PressScale style={s.payBtn} onPress={handleAddToCart}>
          <Text style={s.payIcon}>⊟</Text>
          <Text style={s.payText}>PAY</Text>
        </PressScale>
      </View>

      {/* ══ SIZE GUIDE MODAL — same charts as the web app's /size-guide page ══ */}
      <Modal
        visible={sizeGuideVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSizeGuideVisible(false)}
      >
        <View style={s.sgOverlay}>
          <View style={s.sgPanel}>
            <View style={s.sgHeader}>
              <View>
                <Text style={s.sgTitle}>SIZE GUIDE</Text>
                <Text style={s.sgSubtitle}>Find your perfect fit</Text>
              </View>
              <TouchableOpacity onPress={() => setSizeGuideVisible(false)} style={s.sgCloseBtn}>
                <Text style={s.sgCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sgBody}>
              {/* How to measure */}
              <Text style={s.sgSectionTitle}>How to Measure Your Feet</Text>
              <View style={s.sgCard}>
                {[
                  "Measure your feet at the end of the day when they're largest",
                  "Stand on a piece of paper and trace your foot",
                  "Measure from heel to longest toe",
                  "Use the measurement in inches or centimeters",
                  "If between sizes, we recommend sizing up",
                ].map((tip, i) => (
                  <View key={i} style={s.sgTipRow}>
                    <Text style={s.sgTipCheck}>✓</Text>
                    <Text style={s.sgTipText}>{tip}</Text>
                  </View>
                ))}
              </View>

              {/* Men's chart */}
              <Text style={s.sgSectionTitle}>Men's Shoe Size Chart</Text>
              <View style={s.sgCard}>
                <View style={s.sgTableHeader}>
                  <Text style={[s.sgTh, s.sgCol]}>US</Text>
                  <Text style={[s.sgTh, s.sgCol]}>UK</Text>
                  <Text style={[s.sgTh, s.sgCol]}>EU</Text>
                  <Text style={[s.sgTh, s.sgCol]}>CM</Text>
                </View>
                {[
                  ["7", "6", "40", "25.0"],
                  ["8", "7", "41", "25.5"],
                  ["9", "8", "42", "26.0"],
                  ["10", "9", "43", "27.0"],
                  ["11", "10", "44", "27.5"],
                  ["12", "11", "45", "28.0"],
                ].map((row, i) => (
                  <View key={i} style={s.sgTableRow}>
                    {row.map((cell, j) => (
                      <Text key={j} style={[s.sgTd, s.sgCol]}>{cell}</Text>
                    ))}
                  </View>
                ))}
              </View>

              {/* Women's chart */}
              <Text style={s.sgSectionTitle}>Women's Shoe Size Chart</Text>
              <View style={s.sgCard}>
                <View style={s.sgTableHeader}>
                  <Text style={[s.sgTh, s.sgCol]}>US</Text>
                  <Text style={[s.sgTh, s.sgCol]}>UK</Text>
                  <Text style={[s.sgTh, s.sgCol]}>EU</Text>
                  <Text style={[s.sgTh, s.sgCol]}>CM</Text>
                </View>
                {[
                  ["6", "4", "36", "22.5"],
                  ["7", "5", "37", "23.0"],
                  ["8", "6", "38", "23.5"],
                  ["9", "7", "39", "24.0"],
                  ["10", "8", "40", "25.0"],
                  ["11", "9", "41", "25.5"],
                ].map((row, i) => (
                  <View key={i} style={s.sgTableRow}>
                    {row.map((cell, j) => (
                      <Text key={j} style={[s.sgTd, s.sgCol]}>{cell}</Text>
                    ))}
                  </View>
                ))}
              </View>

              {/* Width guide */}
              <Text style={s.sgSectionTitle}>Width Guide</Text>
              <View style={s.sgWidthRow}>
                {[
                  { label: "Narrow (B)", desc: "For feet that are slimmer than average" },
                  { label: "Medium (D)", desc: "Standard width for most people" },
                  { label: "Wide (E/EE)", desc: "For feet that are wider than average" },
                ].map((w, i) => (
                  <View key={i} style={s.sgWidthCard}>
                    <Text style={s.sgWidthLabel}>{w.label}</Text>
                    <Text style={s.sgWidthDesc}>{w.desc}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ FULL-SCREEN IMAGE VIEWER — pinch to zoom, swipe between shots ══ */}
      <ImageViewing
        images={images.map((uri) => ({ uri }))}
        imageIndex={activeImageIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        onImageIndexChange={setActiveImageIndex}
      />
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════ */

const HERO_H = width * 0.88;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgPrimary },

  /* ── top nav ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.bgPrimary,
  },
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  navArrow: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "300",
  },
  navIcon: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
  },
  heartActive: {
    color: colors.danger,
  },
  topBarTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.display,
    letterSpacing: 1.2,
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
    backgroundColor: colors.bgCard,
    position: "relative",
  },
  slideItem: {
    width,
    height: HERO_H,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgCard,
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
    backgroundColor: colors.bgTertiary,
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGold,
  },

  /* ── info block ── */
  infoBlock: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 8,
    backgroundColor: colors.bgPrimary,
  },
  productName: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 0.8,
    lineHeight: 32,
  },
  categoryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
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
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
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
    color: colors.accentGold,
    letterSpacing: 0.3,
  },
  taxLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
  },
  brandBadge: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brandBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
  },
  oldPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: "line-through",
    marginTop: -2,
  },

  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
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
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  sizeGuide: {
    fontSize: 12,
    color: colors.accentGold,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    position: "relative",
    overflow: "hidden",
  },
  sizeChipActive: {
    backgroundColor: colors.accentGoldWash,
    borderWidth: 2,
    borderColor: colors.accentGold,
  },
  sizeChipOos: {
    opacity: 0.3,
  },
  sizeChipText: {
    fontSize: 13,
    fontFamily: fonts.bodySemibold,
    color: colors.textSecondary,
  },
  sizeChipTextActive: {
    color: colors.accentGold,
    fontFamily: fonts.bodyBold,
  },
  sizeChipTextOos: {
    color: colors.textMuted,
  },
  oosLine: {
    position: "absolute",
    width: "140%",
    height: 1,
    backgroundColor: colors.borderLight,
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
    backgroundColor: colors.accentGoldWash,
    borderWidth: 1,
    borderColor: colors.accentGold,
    borderRadius: radius.lg,
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
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
    color: colors.accentGoldLight,
  },
  arBtnChev: {
    fontSize: 18,
    color: colors.accentGoldLight,
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
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  sectionChev: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  descText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
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
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  reviewsList: {
    marginTop: 16,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    gap: 8,
  },
  reviewText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewAvatarWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewAvatarImg: { width: "100%", height: "100%" },
  reviewAuthor: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  reviewDate: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: fonts.bodyRegular,
  },
  noReviews: {
    fontSize: 13,
    color: colors.textMuted,
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
    // Lifted above the floating pill nav instead of sitting flush at the
    // screen edge — this screen stays reachable behind the pill's tab bar.
    bottom: TAB_BAR_CLEARANCE,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  stickyLeft: {
    gap: 1,
    minWidth: 90,
  },
  stickyLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
  },
  stickyPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.accentGold,
    letterSpacing: 0.3,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  addBtnDim: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderSubtle,
  },
  addBtnText: {
    ...typography.button,
    color: colors.textPrimary,
    fontSize: 12,
  },
  addBtnTextDim: {
    color: colors.textMuted,
  },
  payBtn: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  payIcon: {
    fontSize: 14,
    color: colors.textInverse,
    lineHeight: 18,
  },
  payText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 13,
  },

  /* ══ SIZE GUIDE MODAL ══ */
  sgOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sgPanel: {
    maxHeight: "85%",
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  sgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sgTitle: { fontSize: 22, color: colors.textPrimary, letterSpacing: 1, fontFamily: fonts.display },
  sgSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.bodyRegular },
  sgCloseBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  sgCloseText: { color: colors.textSecondary, fontSize: 16 },

  sgBody: { padding: 20, paddingBottom: 40 },
  sgSectionTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 10,
  },
  sgCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },

  sgTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentGold,
  },
  sgTipCheck: { color: colors.accentGold, fontSize: 13, fontFamily: fonts.bodyBold, marginTop: 1 },
  sgTipText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fonts.bodyRegular },

  sgTableHeader: {
    flexDirection: "row",
    backgroundColor: colors.accentGoldWash,
    paddingVertical: 10,
  },
  sgTableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  sgCol: { flex: 1, textAlign: "center" },
  sgTh: { fontSize: 11, color: colors.accentGoldLight, letterSpacing: 1, fontFamily: fonts.bodyBold },
  sgTd: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodyRegular },

  sgWidthRow: { flexDirection: "row", gap: 10 },
  sgWidthCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  sgWidthLabel: { fontSize: 12, color: colors.textPrimary, fontFamily: fonts.bodyBold, marginBottom: 6 },
  sgWidthDesc: { fontSize: 10.5, color: colors.textMuted, lineHeight: 15, fontFamily: fonts.bodyRegular },
});