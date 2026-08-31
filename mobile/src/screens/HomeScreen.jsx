import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Animated,
  RefreshControl,
} from "react-native";
import { useFavorites } from "../context/FavoritesContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius, typography } from "../theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.58;
const TRENDING_CARD_WIDTH = width * 0.58;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "GOOD MORNING";
  if (hour >= 12 && hour < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

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

/* ─────────────────── CONFIG ─────────────────── */





const HERO_SLIDES = [
  {
    id: "1",
    tag: "● NEW SEASON",
    title: "Run\nBeyond\nLimits",
    sub: "Spring / Summer 2025",
    btnLabel: "SHOP NOW",
    image: require("../../assets/Running.jpg"),
  },
  {
    id: "2",
    tag: "● EXCLUSIVE DROP",
    title: "Own\nThe\nStreet",
    sub: "Limited Edition Collection",
    btnLabel: "EXPLORE",
    image: require("../../assets/Own.jpg"),
  },
  {
    id: "3",
    tag: "● BEST SELLERS",
    title: "Built\nTo\nLast",
    sub: "Premium Performance Line",
    btnLabel: "VIEW ALL",
    image: require("../../assets/Built.jpg"),
  },
];

const getBadge = (product, index) => {
  if (product.is_new || product.badge === "new") return { label: "NEW", style: "new" };
  if (product.is_hot || product.badge === "hot") return { label: "HOT", style: "hot" };
  if (product.old_price)                         return { label: "SALE", style: "sale" };
  if (index % 5 === 0)                           return { label: "NEW", style: "new" };
  if (index % 7 === 3)                           return { label: "HOT", style: "hot" };
  return null;
};

/* ─────────────────── PRESS SCALE WRAPPER ─────────────────── */

const PressScale = ({ children, style, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/* ─────────────────── SECTION HEADER ─────────────────── */

const SectionHeader = ({ eyebrow, title, onSeeAll }) => (
  <View style={s.sectionHeader}>
    <View>
      {eyebrow ? <Text style={s.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} style={s.seeAllBtn}>
        <Text style={s.seeAll}>SEE ALL →</Text>
      </TouchableOpacity>
    )}
  </View>
);

/* ─────────────────── PRODUCT CARD (horizontal swipe) ─────────────────── */

const ProductCard = ({ item, index, onPress }) => {
  const price       = getLowestPrice(item);
  const hasMultiple = item.sizes && Object.keys(item.sizes).length > 1;
  const badge       = getBadge(item, index);

  return (
    <PressScale style={s.card} onPress={onPress}>
      <View style={s.cardImageWrap}>
        {badge && (
          <View style={[s.badge, s[`badge_${badge.style}`]]}>
            <Text style={[s.badgeText, s[`badgeText_${badge.style}`]]}>
              {badge.label}
            </Text>
          </View>
        )}
        <TouchableOpacity style={s.heartBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Text style={s.heartIcon}>♡</Text>
        </TouchableOpacity>
        <Image source={{ uri: item.image }} style={s.cardImage} resizeMode="contain" />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardBrand} numberOfLines={1}>
          {(item.category || item.brand || "").toUpperCase()}
        </Text>
        <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
        <View style={s.cardFooter}>
          <View>
            {item.old_price && (
              <Text style={s.oldPrice}>₱{toNumber(item.old_price)?.toLocaleString("en-PH")}</Text>
            )}
            <Text style={s.newPrice}>
              {price ? `${hasMultiple ? "From " : ""}₱${price.toLocaleString("en-PH")}` : "TBA"}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={onPress} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </PressScale>
  );
};

/* ─────────────────── TRENDING CARD ─────────────────── */

const TrendingCard = ({ item, index, onPress }) => {
  const price = getLowestPrice(item);
  const trendBadges = ["🔥 Popular", "⚡ Trending", "💎 Limited", "🏆 Best Seller"];
  const badge = trendBadges[index % trendBadges.length];

  return (
    <PressScale style={s.trendCard} onPress={onPress}>
      <View style={s.trendImageWrap}>
        <Image source={{ uri: item.image }} style={s.trendImage} resizeMode="contain" />
        <View style={s.trendBadgeWrap}>
          <Text style={s.trendBadge}>{badge}</Text>
        </View>
      </View>
      <View style={s.trendBody}>
        <Text style={s.trendBrand}>{(item.category || item.brand || "").toUpperCase()}</Text>
        <Text style={s.trendName} numberOfLines={2}>{item.name}</Text>
        <Text style={s.trendPrice}>
          {price ? `₱${price.toLocaleString("en-PH")}` : "TBA"}
        </Text>
      </View>
    </PressScale>
  );
};

/* ─────────────────── JUST DROPPED CARD ─────────────────── */

const DroppedCard = ({ item, onPress }) => {
  const price = getLowestPrice(item);
  return (
    <PressScale style={s.droppedCard} onPress={onPress}>
      <View style={s.droppedImageWrap}>
        <Image source={{ uri: item.image }} style={s.droppedImage} resizeMode="contain" />
        <View style={s.droppedOverlay} />
        <View style={s.droppedInfo}>
          <Text style={s.droppedBrand}>{(item.category || item.brand || "").toUpperCase()}</Text>
          <Text style={s.droppedName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.droppedPrice}>{price ? `₱${price.toLocaleString("en-PH")}` : "TBA"}</Text>
        </View>
        <View style={s.limitedTag}>
          <View style={s.limitedDot} />
          <Text style={s.limitedText}>LIMITED STOCK</Text>
        </View>
      </View>
    </PressScale>
  );
};

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function HomeScreen({ navigation }) {
  const { refreshFavorites } = useFavorites();
  const { refreshCart } = useCart();
  const { userProfile, refreshUserProfile } = useAuth();
  const displayName = (userProfile?.name || "").trim().split(" ")[0].toUpperCase() || "GOODSOLES";
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedBrand,  setSelectedBrand]  = useState("all");
  const [activeQuickCat, setActiveQuickCat] = useState("All");
  const [heroIndex,      setHeroIndex]      = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (heroIndex + 1) % HERO_SLIDES.length;
      heroRef.current?.scrollToOffset({ offset: (width - 32) * next, animated: true });
      setHeroIndex(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroIndex]);

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
    await Promise.all([fetchProducts(), refreshCart(), refreshFavorites(), refreshUserProfile()]);
    setRefreshing(false);
  };

  const filteredProducts =
    selectedBrand === "all"
      ? products
      : products.filter((p) => p.category && p.category.toLowerCase() === selectedBrand);

  const trendingProducts = products.slice(0, 6);
  const droppedProducts  = products.slice(0, 2);

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={s.loaderText}>Loading drops…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      <ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >

        {/* ── TOP NAV ── */}
        <View style={s.topNav}>
          <View>
            <Text style={s.eyebrow}>{getGreeting()}</Text>
            <Text style={s.navTitle}>{displayName}</Text>
          </View>
          <View style={s.navIcons}>
            <TouchableOpacity style={s.iconBtn}>
              <Text style={s.iconText}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── THIN DIVIDER ── */}
        <View style={s.navDivider} />

        {/* ── HERO CAROUSEL ── */}
        <View style={s.heroCarouselWrap}>
          <FlatList
            ref={heroRef}
            data={HERO_SLIDES}
            keyExtractor={(slide) => slide.id}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            snapToInterval={width - 32}
            snapToAlignment="start"
            decelerationRate="fast"
            bounces={false}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({ length: width - 32, offset: (width - 32) * index, index })}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
              if (idx !== heroIndex && idx >= 0 && idx < HERO_SLIDES.length) setHeroIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={s.hero}>
                <Image source={item.image} style={s.heroBgImage} resizeMode="cover" />
                <View style={s.heroOverlay} />
                <View style={s.heroDecorCircle} />
                <View style={s.heroDecorCircle2} />
                <View style={s.heroContent}>
                  <View style={s.heroTagWrap}>
                    <Text style={s.heroTag}>{item.tag}</Text>
                  </View>
                  <Text style={s.heroTitle}>{item.title}</Text>
                  <Text style={s.heroSub}>{item.sub}</Text>
                  <TouchableOpacity style={s.shopBtn} activeOpacity={0.85}>
                    <Text style={s.shopBtnText}>{item.btnLabel} →</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.heroSlideNum}>
                  <Text style={s.heroSlideNumText}>
                    {HERO_SLIDES.indexOf(item) + 1}/{HERO_SLIDES.length}
                  </Text>
                </View>
              </View>
            )}
          />
          <View style={s.heroDots}>
            {HERO_SLIDES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  heroRef.current?.scrollToOffset({ offset: (width - 32) * i, animated: true });
                  setHeroIndex(i);
                }}
              >
                <View style={[s.dot, i === heroIndex && s.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── TRENDING NOW ── */}
        {trendingProducts.length > 0 && (
          <View style={s.trendingSection}>
            <SectionHeader
              eyebrow="MOST WANTED THIS WEEK"
              title="Trending Now"
              onSeeAll={() => {}}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {trendingProducts.map((item, index) => (
                <TrendingCard
                  key={item._id || index}
                  item={item}
                  index={index}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── FEATURED EDITORIAL BANNER ── */}
        <View style={s.editorialWrap}>
          <View style={s.editorial}>
            <Text style={s.editorialWatermark}>GS</Text>
            <View style={s.editorialDecor} />
            <View style={s.editorialDecor2} />
            <Text style={s.editorialEye}>THE EDIT</Text>
            <Text style={s.editorialTitle}>{"Crafted for\nthe streets."}</Text>
            <TouchableOpacity style={s.editorialBtn} activeOpacity={0.8}>
              <Text style={s.editorialBtnText}>EXPLORE THE EDIT →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── JUST DROPPED ── */}
        {droppedProducts.length > 0 && (
          <View>
            <SectionHeader
              eyebrow="FRESH ARRIVALS"
              title="Just Dropped"
              onSeeAll={() => {}}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {droppedProducts.map((item, index) => (
                <DroppedCard
                  key={item._id || index}
                  item={item}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── BOTTOM STATS BAR ── */}
        <View style={s.statsBar}>
          {[
            { num: "500+", label: "Products" },
            { num: "4.9★", label: "Rating" },
            { num: "24H",  label: "Delivery" },
          ].map((stat, i) => (
            <React.Fragment key={stat.label}>
              <View style={s.statItem}>
                <Text style={s.statNum}>{stat.num}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
              {i < 2 && <View style={s.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── BRAND FOOTER TAG ── */}
        <View style={s.footerTag}>
          <Text style={s.footerTagText}>GOODSOLES™</Text>
          <Text style={s.footerTagSub}>Where your next pair begins.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgPrimary },
  loader:     { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" },
  loaderText: { color: colors.textMuted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginTop: 14, fontFamily: fonts.bodyMedium },
  container:  { flex: 1, backgroundColor: colors.bgPrimary },

  /* TOP NAV */
  topNav: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  eyebrow:  { fontSize: 8, letterSpacing: 3, color: colors.textTertiary, fontFamily: fonts.bodySemibold, marginBottom: 2 },
  navTitle: { fontSize: 26, color: colors.textPrimary, letterSpacing: 2, fontFamily: fonts.display },
  navDivider: { height: 0.5, backgroundColor: colors.borderSubtle, marginHorizontal: 16, marginBottom: 14 },
  navIcons: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.borderLight,
    justifyContent: "center", alignItems: "center",
  },
  iconText: { fontSize: 14 },

  /* HERO */
  heroCarouselWrap: { marginHorizontal: 16, marginBottom: 4 },
  hero: {
    width: width - 32,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    overflow: "hidden", height: 280, position: "relative",
  },
  heroBgImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" },
  heroDecorCircle: {
    position: "absolute", right: -40, top: -40,
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.05)",
  },
  heroDecorCircle2: {
    position: "absolute", right: 50, bottom: -60,
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.03)",
  },
  heroContent:  { position: "absolute", bottom: 24, left: 22, right: 22 },
  heroTagWrap:  {
    alignSelf: "flex-start",
    backgroundColor: colors.accentGoldWash,
    borderRadius: 4, borderWidth: 0.5, borderColor: colors.accentGold,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10,
  },
  heroTag:   { fontSize: 8, letterSpacing: 2.5, color: colors.accentGoldLight, fontFamily: fonts.bodyBold },
  heroTitle: { fontSize: 42, color: colors.textPrimary, lineHeight: 42, letterSpacing: 0.5, maxWidth: 230, fontFamily: fonts.display },
  heroSub:   { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: 1.5, fontFamily: fonts.bodyRegular },
  shopBtn: {
    marginTop: 16, backgroundColor: colors.textPrimary, alignSelf: "flex-start",
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.full,
  },
  shopBtnText: { ...typography.button, fontSize: 11, color: colors.bgPrimary },
  heroSlideNum: {
    position: "absolute", top: 16, right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)",
  },
  heroSlideNumText: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: fonts.bodyBold, letterSpacing: 1 },
  heroDots: { flexDirection: "row", gap: 4, marginTop: 12, justifyContent: "center", alignItems: "center" },
  dot:       { width: 5, height: 3, borderRadius: 2, backgroundColor: colors.bgTertiary },
  dotActive: { width: 22, backgroundColor: colors.accentGold },

  /* QUICK CATEGORIES */
  quickCatRow: { marginTop: 18 },
  quickCat: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 6, backgroundColor: "#111",
    borderWidth: 0.5, borderColor: "#222",
  },
  quickCatActive:      { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  quickCatLabel:       { fontSize: 11, fontWeight: "600", color: "#444", letterSpacing: 1 },
  quickCatLabelActive: { color: "#000", fontWeight: "800" },

  /* SECTION HEADER */
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 16, marginTop: 26, marginBottom: 12,
  },
  sectionEyebrow: { fontSize: 8, letterSpacing: 3, color: colors.textTertiary, fontFamily: fonts.bodyBold, marginBottom: 4 },
  sectionTitle:   { fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display },
  seeAllBtn:      { paddingBottom: 2 },
  seeAll:         { fontSize: 9, color: colors.accentGold, letterSpacing: 1.5, fontFamily: fonts.bodySemibold },

  /* TRENDING */
  trendingSection: { marginTop: 4 },
  trendCard: {
    width: TRENDING_CARD_WIDTH,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.borderLight, overflow: "hidden",
  },
  trendImageWrap: {
    width: "100%", height: 160, backgroundColor: colors.bgTertiary,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  trendImage:     { width: "75%", height: "75%" },
  trendBadgeWrap: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 0.5, borderColor: colors.bgTertiary,
  },
  trendBadge:  { fontSize: 9, color: colors.textPrimary, fontFamily: fonts.bodySemibold },
  trendBody:   { padding: 12 },
  trendBrand:  { fontSize: 7, fontFamily: fonts.bodyBold, letterSpacing: 2.5, color: colors.textTertiary, marginBottom: 3 },
  trendName:   { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textPrimary, lineHeight: 18, marginBottom: 6 },
  trendPrice:  { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.accentGold },

  /* EDITORIAL BANNER */
  editorialWrap: { marginHorizontal: 16, marginTop: 26 },
  editorial: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5, borderColor: colors.borderLight,
    borderRadius: radius.xl, padding: 26,
    overflow: "hidden", position: "relative", minHeight: 160,
  },
  editorialWatermark: {
    position: "absolute", right: -10, bottom: -20,
    fontSize: 120, color: "rgba(255,255,255,0.03)", letterSpacing: -4, fontFamily: fonts.display,
  },
  editorialDecor: {
    position: "absolute", right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 0.5, borderColor: colors.bgSurface,
  },
  editorialDecor2: {
    position: "absolute", left: -20, bottom: -20,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 0.5, borderColor: colors.bgSurface,
  },
  editorialEye:   { fontSize: 8, letterSpacing: 3.5, color: colors.accentGold, marginBottom: 10, fontFamily: fonts.bodyBold },
  editorialTitle: { fontSize: 34, color: colors.textPrimary, lineHeight: 36, letterSpacing: 0.3, fontFamily: fonts.display },
  editorialBtn: {
    marginTop: 20, borderWidth: 0.5, borderColor: colors.borderLight,
    alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.04)",
  },
  editorialBtnText: { ...typography.button, fontSize: 10, color: colors.textPrimary },

  /* JUST DROPPED */
  droppedCard: {
    width: width * 0.72,
    borderRadius: radius.lg, overflow: "hidden", borderWidth: 0.5, borderColor: colors.borderLight,
  },
  droppedImageWrap: {
    height: 190, backgroundColor: colors.bgCard,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  droppedImage:   { width: "70%", height: "70%" },
  droppedOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  droppedInfo:  { position: "absolute", bottom: 16, left: 14, right: 14 },
  droppedBrand: { fontSize: 7, fontFamily: fonts.bodyBold, letterSpacing: 2.5, color: "rgba(255,255,255,0.4)", marginBottom: 3 },
  droppedName:  { fontSize: 15, color: colors.textPrimary, marginBottom: 4, fontFamily: fonts.display, letterSpacing: 0.3 },
  droppedPrice: { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.accentGold },
  limitedTag: {
    position: "absolute", top: 12, right: 12,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: colors.borderLight,
  },
  limitedDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  limitedText: { fontSize: 7, fontFamily: fonts.bodyBold, letterSpacing: 1.5, color: colors.textPrimary },

  /* BRAND CHIPS */
  brandsRow: { marginBottom: 8 },
  brandChip: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 6, borderWidth: 0.5, borderColor: "#222",
    marginRight: 6, backgroundColor: "transparent",
  },
  brandChipActive:     { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  brandChipText:       { fontSize: 11, fontWeight: "500", color: "#444" },
  brandChipTextActive: { color: "#000", fontWeight: "800" },

  /* PRODUCT CARD — now sized for horizontal swipe */
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.borderLight, overflow: "hidden",
  },
  cardImageWrap: {
    width: "100%", aspectRatio: 1, backgroundColor: colors.bgTertiary,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  cardImage:  { width: "80%", height: "80%" },
  heartBtn: {
    position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center",
    borderWidth: 0.5, borderColor: colors.borderLight,
  },
  heartIcon:        { color: colors.textPrimary, fontSize: 12 },
  badge:            { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, zIndex: 1 },
  badge_new:        { backgroundColor: colors.accentGold },
  badge_hot:        { backgroundColor: colors.danger },
  badge_sale:       { backgroundColor: colors.bgSurface, borderWidth: 0.5, borderColor: colors.borderLight },
  badgeText:        { fontSize: 7, fontFamily: fonts.bodyBold, letterSpacing: 1.5 },
  badgeText_new:    { color: colors.bgPrimary },
  badgeText_hot:    { color: colors.textPrimary },
  badgeText_sale:   { color: colors.textMuted },
  cardBody:         { padding: 10 },
  cardBrand:        { fontSize: 7, fontFamily: fonts.bodyBold, letterSpacing: 2.5, color: colors.textTertiary, marginBottom: 3 },
  cardName:         { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textPrimary, lineHeight: 18, marginBottom: 8 },
  cardFooter:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  oldPrice:         { fontSize: 10, color: colors.textMuted, textDecorationLine: "line-through", marginBottom: 1 },
  newPrice:         { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.accentGold },
  addBtn:           { width: 28, height: 28, backgroundColor: colors.textPrimary, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  addBtnText:       { color: colors.bgPrimary, fontSize: 18, fontWeight: "300", lineHeight: 22 },

  /* EMPTY */
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText:  { fontSize: 12, color: colors.textMuted, letterSpacing: 2 },

  /* STATS BAR */
  statsBar: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    marginHorizontal: 16, marginTop: 28,
    backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.borderLight,
    borderRadius: radius.lg, paddingVertical: 18,
  },
  statDivider: { width: 0.5, height: 28, backgroundColor: colors.borderLight },
  statItem:    { alignItems: "center", flex: 1 },
  statNum:     { fontSize: 22, color: colors.accentGold, letterSpacing: 0.5, fontFamily: fonts.display },
  statLabel:   { fontSize: 8, color: colors.textTertiary, letterSpacing: 2.5, fontFamily: fonts.bodyBold, marginTop: 4 },

  /* BRAND FOOTER TAG */
  footerTag: { alignItems: "center", marginTop: 32, paddingBottom: 8 },
  footerTagText: { fontSize: 13, color: colors.bgTertiary, letterSpacing: 5, fontFamily: fonts.display },
  footerTagSub:  { fontSize: 9, color: colors.bgTertiary, letterSpacing: 1.5, marginTop: 4, fontFamily: fonts.bodyRegular },
});