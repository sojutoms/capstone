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
import ImageViewing from "../components/ImageViewerModal";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCart }      from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import Toast            from "react-native-toast-message";
import { fonts, radius, shadows, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import PressScale from "../components/PressScale";
import Shoe360Viewer from "../components/Shoe360Viewer";
import ProductCard from "../components/ProductCard";
import FadeInItem from "../components/FadeInItem";
import { triggerFlyToCart } from "../utils/flyToCartBus";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { hapticTap, hapticSuccess } from "../utils/haptics";
import { isOutOfStock } from "../utils/productHelpers";

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

const StarRow = ({ rating, size = 13, onPress, colors }) => (
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

export default function ProductDetailScreen({ route }) {
  const navigation                     = useNavigation();
  const { addToCart, refreshCart }               = useCart();
  const { toggleFavorite, isFavorite, refreshFavorites } = useFavorites();
  const { product }                    = route.params || {};
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [selectedSize,     setSelectedSize]     = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [show360, setShow360] = useState(false);
  const [reviews,          setReviews]          = useState([]);
  const [loadingReviews,   setLoadingReviews]   = useState(true);
  const [sizeGuideVisible, setSizeGuideVisible] = useState(false);
  const [aboutVisible,     setAboutVisible]     = useState(false);
  const [reviewsVisible,   setReviewsVisible]   = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [relatedProducts,  setRelatedProducts]  = useState([]);
  const [loadingRelated,   setLoadingRelated]   = useState(true);


  const heartScale     = useRef(new Animated.Value(1)).current;
  const imageSliderRef = useRef(null);
  const addBtnRef      = useRef(null);

  const favorite = isFavorite(product?.id);
  // Was comparing category against a brand-name list ("nike"/"adidas"/…),
  // which product.category never actually holds — it's "shoes"/"watch"/
  // "bags"/"collectibles" (brand lives in its own product.brand field). That
  // mismatch meant this was always false, so the button never showed at all.
  const isShoe   = (product?.category || "").toLowerCase() === "shoes";

  if (!product) {
    return (
      <View style={s.center}>
        <Text style={{ color: colors.textPrimary }}>No product found</Text>
      </View>
    );
  }

  const images = [product.image, ...(product.subImages || [])].filter(Boolean);
  const has3D =
    product.model3d?.status === "ready" && (product.model3d.turntableFrames || []).length > 0;

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

  /* ── fetch related products — same category first, current product
     excluded, capped to a handful for a horizontal row ── */
  useEffect(() => { fetchRelated(); }, [product?.id]);

  const fetchRelated = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/allproducts`);
      const data = await res.json();
      const all  = Array.isArray(data) ? data : [];
      const others = all.filter((p) => p.id !== product.id);
      const sameCategory = others.filter(
        (p) => (p.category || "").toLowerCase() === (product.category || "").toLowerCase()
      );
      const rest = others.filter((p) => !sameCategory.includes(p));
      setRelatedProducts([...sameCategory, ...rest].slice(0, 10));
    } catch { setRelatedProducts([]); }
    finally  { setLoadingRelated(false); }
  };

  const handleRelatedAddToCart = (item) => {
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
      hapticSuccess();
      addToCart(item, available[0]);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    } else if (available.length > 1) {
      Toast.show({ type: "info", text1: "Select a size first" });
      navigation.push("ProductDetail", { product: item });
    } else {
      hapticSuccess();
      addToCart(item, null);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchReviews(), fetchRelated(), refreshCart(), refreshFavorites()]);
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
    // Non-shoe categories (watches/bags/collectibles) have no per-size
    // pricing at all (sizes: {}) — their real price lives in product.price,
    // not new_price, which those categories never populate.
    return extractPrice(product.new_price ?? product.price);
  };
  const sortedSizes = useMemo(() => {
    if (!product.sizes) return [];
    return Object.keys(product.sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [product]);
  // Non-shoe categories (watches/bags/collectibles) send sizes: {} — an
  // empty but still-truthy object — so checking product.sizes directly
  // treated them as "has sizes, none picked yet" and permanently blocked
  // Add to Bag behind an unreachable "SELECT SIZE" state.
  const hasSizes = sortedSizes.length > 0;
  const lowestPrice = useMemo(() => {
    const prices = sortedSizes
      .map((sz) => (getSizeStock(sz) > 0 ? getSizePrice(sz) : NaN))
      .filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : extractPrice(product.new_price ?? product.price);
  }, [product]);
  const displayPrice = selectedSize ? getSizePrice(selectedSize) : lowestPrice;

  /* ── add to cart ── */
  const handleAddToCart = () => {
    if (!selectedSize && hasSizes) {
      Toast.show({ type: "error", text1: "Select a size first" });
      return;
    }
    hapticSuccess();
    addBtnRef.current?.measureInWindow((x, y, width, height) => {
      triggerFlyToCart({ x, y, width, height });
    });
    addToCart(product, selectedSize);
    Toast.show({ type: "success", text1: "Added to cart", text2: product.name });
  };

  /* ── buy now — skips the cart entirely, straight to checkout for just this item ── */
  const handleBuyNow = () => {
    if (!selectedSize && hasSizes) {
      Toast.show({ type: "error", text1: "Select a size first" });
      return;
    }
    navigation.navigate("PlaceOrder", {
      buyNowItem: { ...product, selectedSize, quantity: 1 },
    });
  };

  /* ── heart press ── */
  const handleHeart = () => {
    hapticTap();
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      {/* ══ TOP NAV BAR ══ */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn}>
          <Text style={s.navArrow}>←</Text>
        </TouchableOpacity>

        <Text style={s.topBarTitle} numberOfLines={1}>
          {product.name.toUpperCase()}
        </Text>

        <View style={s.navRight}>
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
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >

        {/* ══ IMAGE HERO — same STUDIO/360° toggle as web, not an automatic
            switch, so users can still browse the regular photos even when
            a 3D model exists ══ */}
        <View style={s.heroWrapper}>
          {has3D && show360 ? (
            <Shoe360Viewer frames={product.model3d.turntableFrames} height={HERO_H} />
          ) : (
            <>
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
            </>
          )}

          {/* Rendered after the image/slider (not before) so it actually
              receives touches instead of the slider's TouchableOpacity
              swallowing them underneath — zIndex alone wasn't enough here.
              pointerEvents="box-none" so this row only catches taps
              directly on its two buttons, not the whole bounding box —
              otherwise it silently blocked the slider's swipe gesture. */}
          <View style={s.viewToggleRow} pointerEvents="box-none">
            <TouchableOpacity
              style={[s.viewToggleBtn, !show360 && s.viewToggleBtnActive]}
              onPress={() => setShow360(false)}
            >
              <Text style={[s.viewToggleText, !show360 && s.viewToggleTextActive]}>STUDIO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, show360 && s.viewToggleBtnActive, !has3D && s.viewToggleBtnDisabled]}
              onPress={() => has3D && setShow360(true)}
              disabled={!has3D}
            >
              <Text style={[s.viewToggleText, show360 && s.viewToggleTextActive]}>360°</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ PRODUCT INFO BLOCK ══ */}
        <View style={s.infoBlock}>

          {/* Name */}
          <Text style={s.productName}>{product.name.toUpperCase()}</Text>

          {/* Category subtitle */}
          {product.category ? (
            <Text style={s.categoryLabel}>{product.category}</Text>
          ) : null}

          {/* Price row */}
          <View style={s.priceRow}>
            <Text style={s.priceValue}>
              ₱{formatPrice(displayPrice)}
            </Text>
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

        {/* ══ ADD TO BAG / PAY — inline with the rest of the content now,
            not a floating bar (which duplicated the price already shown
            above and cramped the chat FAB against it). ══ */}
        <View style={s.actionsRow}>
          <PressScale
            ref={addBtnRef}
            style={[s.addBtn, !selectedSize && hasSizes && s.addBtnDim]}
            onPress={handleAddToCart}
          >
            <Text style={[s.addBtnText, !selectedSize && hasSizes && s.addBtnTextDim]}>
              {selectedSize || !hasSizes ? "ADD TO BAG" : "SELECT SIZE"}
            </Text>
          </PressScale>

          <PressScale style={s.payBtn} onPress={handleBuyNow}>
            <Text style={s.payText}>PAY</Text>
          </PressScale>
        </View>

        {/* ══ AR TRY ON BUTTON ══ */}
        {isShoe && (
          <View style={s.arWrapper}>
            <TouchableOpacity
              style={s.arBtn}
              onPress={() => navigation.navigate("ARTryOn", { product, selectedSize })}
              activeOpacity={0.85}
            >
              <Ionicons name="footsteps-outline" size={18} color={colors.accentGoldLight} />
              <Text style={s.arBtnText}>TRY ON WITH AR</Text>
              <Text style={s.arBtnChev}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ THIN DIVIDER ══ */}
        <View style={[s.divider, s.dividerSpaced]} />

        {/* ══ ABOUT THIS ITEM — opens a bottom-sheet, same pattern as Size Guide ══ */}
        {product.description ? (
          <TouchableOpacity
            style={s.section}
            onPress={() => setAboutVisible(true)}
            activeOpacity={0.7}
          >
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>ABOUT THIS ITEM</Text>
              <Text style={s.sectionChev}>›</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ══ THIN DIVIDER ══ */}
        <View style={[s.divider, s.dividerSpacedTight]} />

        {/* ══ REVIEWS — opens a bottom-sheet, same pattern as Size Guide ══ */}
        <TouchableOpacity
          style={s.section}
          onPress={() => setReviewsVisible(true)}
          activeOpacity={0.7}
        >
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>CUSTOMER REVIEWS</Text>
              <Text style={s.reviewsSubText}>
                {averageRating > 0
                  ? `${averageRating.toFixed(1)} · ${reviews.length} reviews`
                  : `${reviews.length} reviews`}
              </Text>
            </View>
            <Text style={s.sectionChev}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ══ YOU MAY ALSO LIKE ══ */}
        {(loadingRelated || relatedProducts.length > 0) && (
          <>
            <View style={s.divider} />
            <View style={s.relatedSection}>
              <Text style={s.relatedTitle}>YOU MAY ALSO LIKE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.relatedScroll}
              >
                {loadingRelated ? (
                  <ActivityIndicator color={colors.accentGold} style={{ marginVertical: 24 }} />
                ) : (
                  relatedProducts.map((item, index) => (
                    <FadeInItem key={item._id || item.id || index} index={index}>
                      <ProductCard
                        item={item}
                        index={index}
                        onPress={() => navigation.push("ProductDetail", { product: item })}
                        onAddToCart={handleRelatedAddToCart}
                        favorited={isFavorite(item.id)}
                        onToggleFavorite={() => toggleFavorite(item.id)}
                      />
                    </FadeInItem>
                  ))
                )}
              </ScrollView>
            </View>
          </>
        )}

      </ScrollView>

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

      {/* ══ ABOUT THIS ITEM MODAL — centered card, same language as the
          custom Alert (AlertHost.jsx), not a bottom sheet ══ */}
      <Modal
        visible={aboutVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={s.aboutOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAboutVisible(false)}
          />
          <View style={s.aboutCard}>
            <View style={s.aboutHeader}>
              <Text style={s.aboutTitle}>ABOUT THIS ITEM</Text>
              <TouchableOpacity onPress={() => setAboutVisible(false)} style={s.sgCloseBtn}>
                <Text style={s.sgCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.aboutScroll}>
              <Text style={s.descText}>{product.description}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ CUSTOMER REVIEWS MODAL — same bottom-sheet pattern as Size Guide ══ */}
      <Modal
        visible={reviewsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewsVisible(false)}
      >
        <View style={s.sgOverlay}>
          <View style={s.sgPanel}>
            <View style={s.sgHeader}>
              <View>
                <Text style={s.sgTitle}>CUSTOMER REVIEWS</Text>
                <View style={s.reviewsSubRow}>
                  {averageRating > 0 && <StarRow rating={averageRating} size={12} colors={colors} />}
                  <Text style={s.sgSubtitle}>
                    {averageRating > 0
                      ? `${averageRating.toFixed(1)} · ${reviews.length} reviews`
                      : `${reviews.length} reviews`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setReviewsVisible(false)} style={s.sgCloseBtn}>
                <Text style={s.sgCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sgBody}>
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
                      <StarRow rating={r.rating || 0} size={11} colors={colors} />
                      <Text style={s.reviewText}>{r.review}</Text>
                    </View>
                  ))
                )}
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

const HERO_H = width * 1.0;

const makeStyles = (colors) => StyleSheet.create({
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
  /* ── STUDIO / 360° toggle — overlays the top of the hero image, same
     pattern as the web app's lifestyle-toggle ── */
  viewToggleRow: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 5,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.full,
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  viewToggleBtnActive: { backgroundColor: "#fff" },
  viewToggleBtnDisabled: { opacity: 0.35 },
  viewToggleText: { color: "#fff", fontSize: 10, fontFamily: fonts.bodyBold, letterSpacing: 1 },
  viewToggleTextActive: { color: "#000" },
  slideItem: {
    width,
    height: HERO_H,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgCard,
  },
  slideImage: {
    width: "100%",
    height: "100%",
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
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
    gap: 14,
    backgroundColor: colors.bgPrimary,
  },
  productName: {
    fontSize: 26,
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    lineHeight: 32,
  },
  categoryLabel: {
    fontSize: 17,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
    marginTop: -10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: -6,
  },
  priceValue: {
    fontSize: 19,
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
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
    marginHorizontal: 24,
  },
  // Extra space BEFORE the divider (not after it) so it stays paired with
  // the section it introduces below, instead of floating stranded in the
  // middle of a big empty gap.
  dividerSpaced: {
    marginTop: 26,
  },
  // Same idea, but for the divider between About This Shoe and Customer
  // Reviews specifically — that gap read as too far from About This Shoe.
  dividerSpacedTight: {
    marginTop: 8,
  },

  /* ── size selector ── */
  sizeBlock: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 18,
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
    opacity: 0.55,
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
    color: colors.textSecondary,
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
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  arBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentGoldWash,
    borderWidth: 1,
    borderColor: colors.accentGold,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  arBtnText: {
    ...typography.button,
    flex: 1,
    fontSize: 12,
    color: colors.accentGoldLight,
  },
  arBtnChev: {
    fontSize: 18,
    color: colors.accentGoldLight,
    fontWeight: "300",
  },

  /* ── sections (description / reviews) ── */
  section: {
    paddingHorizontal: 24,
    paddingVertical: 38,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  sectionChev: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: "300",
  },
  descText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 23,
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
    marginTop: 4,
  },
  reviewsList: {
    marginTop: 16,
    gap: 10,
  },

  /* ── you may also like ── */
  relatedSection: {
    paddingTop: 64,
    paddingBottom: 12,
  },
  // Matches Home's "Trending Now" section title exactly (fonts.display,
  // 24px) instead of the small all-caps label style used elsewhere on
  // this screen, so it reads as the same kind of section as on Home.
  relatedTitle: {
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontFamily: fonts.display,
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  relatedScroll: {
    paddingHorizontal: 24,
    gap: 12,
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

  /* ── Add to Bag / Pay — inline with the rest of the content, right below
     the size selector, instead of a floating bar duplicating the price
     already shown above. */
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.textPrimary,
    paddingVertical: 17,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  addBtnDim: {
    backgroundColor: colors.bgTertiary,
  },
  addBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 12,
  },
  addBtnTextDim: {
    color: colors.textMuted,
  },
  payBtn: {
    flex: 1,
    backgroundColor: colors.textPrimary,
    paddingVertical: 17,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  payText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 12,
  },

  /* ══ ABOUT THIS ITEM MODAL — centered card, same language as AlertHost ══ */
  aboutOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  aboutCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.lg,
  },
  aboutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
  },
  aboutTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.5,
  },
  aboutScroll: {
    paddingHorizontal: 22,
    paddingBottom: 22,
  },

  /* ══ SIZE GUIDE MODAL ══ */
  sgOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sgPanel: {
    // A minHeight (not just maxHeight) so a modal with short content — like
    // "About This Shoe" — still fills a substantial, settled-looking sheet
    // instead of shrink-wrapping to the text and looking cut off short.
    minHeight: "55%",
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
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sgTitle: { fontSize: 22, color: colors.textPrimary, letterSpacing: 1, fontFamily: fonts.display },
  sgSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.bodyRegular },
  sgCloseBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  sgCloseText: { color: colors.textSecondary, fontSize: 16 },

  sgBody: { padding: 24, paddingBottom: 48 },
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