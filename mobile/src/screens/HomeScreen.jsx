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
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CommonActions } from "@react-navigation/native";
import { useFavorites } from "../context/FavoritesContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius, shadows, typography } from "../theme";
import FadeInItem from "../components/FadeInItem";
import ProductCard from "../components/ProductCard";
import { getLowestPrice, isOutOfStock } from "../utils/productHelpers";
import Toast from "react-native-toast-message";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { openChatWidget } from "../utils/chatWidgetBus";

const { width } = Dimensions.get("window");

const BRAND_LOGO = require("../../assets/GSPH-removebg.png");

// Pure image carousel now — no text overlay, since the greeting/eyebrow/
// question all live in the header above it instead.
const HERO_SLIDES = [
  { id: "1", image: require("../../assets/Running.jpg") },
  { id: "2", image: require("../../assets/Own.jpg") },
  { id: "3", image: require("../../assets/Built.jpg") },
];

/* ─────────────────── CATEGORY DROPDOWN (copied from ShopScreen.jsx,
   which stays untouched — same CATEGORIES config, AccordionTile, and
   tileStyles) ─────────────────── */

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

const AccordionTile = ({ category, onBrandSelect, onDirectNav }) => {
  const [open, setOpen] = useState(false);
  const animHeight = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  const ROW_HEIGHT = 52;
  const expandedHeight = category.brands.length * ROW_HEIGHT;

  const toggle = () => {
    if (!category.active) return;

    // Direct navigation — no accordion needed
    if (category.directNav) {
      onDirectNav(category);
      return;
    }

    const toValue = open ? 0 : 1;
    setOpen(!open);
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue,
        duration: 240,
        useNativeDriver: false,
      }),
      Animated.timing(animRotate, {
        toValue,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const maxH = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, expandedHeight],
  });

  return (
    <View style={tileStyles.wrapper}>
      {/* ── MAIN TILE BUTTON ── */}
      <TouchableOpacity
        style={[tileStyles.tile, !category.active && tileStyles.tileDisabled]}
        onPress={toggle}
        activeOpacity={category.active ? 0.85 : 1}
      >
        <Text style={[tileStyles.label, !category.active && tileStyles.labelDisabled]}>
          {category.label}
        </Text>

        {category.active ? (
          // For directNav items, always show a static › arrow (no rotation)
          category.directNav ? (
            <Text style={tileStyles.chevron}>›</Text>
          ) : (
            <Animated.Text style={[tileStyles.chevron, { transform: [{ rotate }] }]}>
              ›
            </Animated.Text>
          )
        ) : (
          <Text style={tileStyles.comingSoon}>COMING SOON</Text>
        )}
      </TouchableOpacity>

      {/* ── DIVIDER ── */}
      <View style={tileStyles.divider} />

      {/* ── BRAND SUB-ROWS (only for non-directNav categories) ── */}
      {category.active && !category.directNav && (
        <Animated.View style={[tileStyles.subList, { maxHeight: maxH, overflow: "hidden" }]}>
          {category.brands.map((brand, idx) => (
            <React.Fragment key={brand.value}>
              <TouchableOpacity
                style={tileStyles.brandRow}
                onPress={() => onBrandSelect(category, brand)}
                activeOpacity={0.7}
              >
                <Text style={tileStyles.brandLabel}>{brand.label}</Text>
                <Text style={tileStyles.brandArrow}>›</Text>
              </TouchableOpacity>
              {idx < category.brands.length - 1 && (
                <View style={tileStyles.brandDivider} />
              )}
            </React.Fragment>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

/* ─────────────────── STORE MAP SECTION (moved from ShopScreen.jsx) ─────────────────── */

const STORE = {
  name: "GoodSoles PH",
  lat: 14.5861,
  lng: 121.0569,
  address: "Robinsons Galleria, EDSA, Quezon City",
  hours: "Mon–Sun: 10:00 AM – 9:00 PM",
  phone: "+63 917 123 4567",
};

const StoreMapSection = () => {
  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${STORE.lat},${STORE.lng}`;
    Linking.openURL(url);
  };
  const callStore = () => Linking.openURL(`tel:${STORE.phone}`);

  return (
    <View style={mapStyles.container}>
      <View style={mapStyles.sectionHeader}>
        <Text style={mapStyles.sectionEyebrow}>FIND US</Text>
        <Text style={mapStyles.sectionTitle}>Our Store</Text>
      </View>

      
      

      <View style={mapStyles.infoCard}>
        <View style={mapStyles.storeNameRow}>
          <View style={mapStyles.liveDot} />
          <Text style={mapStyles.storeName}>{STORE.name}</Text>
        </View>
        <View style={mapStyles.divider} />
        <View style={mapStyles.infoRow}>
          <Text style={mapStyles.infoIcon}>📍</Text>
          <Text style={mapStyles.infoText}>{STORE.address}</Text>
        </View>
        <View style={mapStyles.infoRow}>
          <Text style={mapStyles.infoIcon}>🕐</Text>
          <Text style={mapStyles.infoText}>{STORE.hours}</Text>
        </View>
        <View style={mapStyles.infoRow}>
          <Text style={mapStyles.infoIcon}>📞</Text>
          <TouchableOpacity onPress={callStore}>
            <Text style={[mapStyles.infoText, mapStyles.infoTextLink]}>{STORE.phone}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={mapStyles.directionsBtn} onPress={openInMaps} activeOpacity={0.85}>
        <Text style={mapStyles.directionsBtnText}>GET DIRECTIONS  →</Text>
      </TouchableOpacity>
    </View>
  );
};

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

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function HomeScreen({ navigation }) {
  const { toggleFavorite, isFavorite, refreshFavorites } = useFavorites();
  const { addToCart, refreshCart } = useCart();
  const { userProfile, refreshUserProfile } = useAuth();

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

  // Unlike ShopScreen's own version of these handlers, this one switches to
  // the Shop TAB itself (so the bottom nav highlights "Shop") and drills
  // into that tab's stack, instead of pushing a duplicate screen onto
  // Home's own stack.
  //
  // A plain cross-tab navigate({screen, params}) pushes onto whatever
  // history Shop's stack already has from earlier in the session — so
  // "back" from the new screen can land on some unrelated screen left over
  // from the last time Shop was visited. If Shop already has history, we
  // explicitly reset it to [ShopScreen, target] first, so back always goes
  // to ShopScreen. A first-ever visit has no history to reset, so it just
  // navigates normally.
  const navigateToShopCategory = (screenName, params) => {
    const tabNav = navigation.getParent();
    const shopRoute = tabNav?.getState()?.routes.find((r) => r.name === "Shop");
    if (tabNav && shopRoute?.state?.key) {
      tabNav.dispatch({
        ...CommonActions.reset({
          index: 1,
          routes: [{ name: "ShopScreen" }, { name: screenName, params }],
        }),
        target: shopRoute.state.key,
      });
      tabNav.navigate("Shop");
    } else {
      navigation.navigate("Shop", { screen: screenName, params });
    }
  };

  const handleBrandSelect = (category, brand) => {
    navigateToShopCategory(category.screen, { selectedBrand: brand.value });
  };

  const handleDirectNav = (category) => {
    navigateToShopCategory(category.screen);
  };
  const rawFirstName = (userProfile?.name || "").trim().split(" ")[0];
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : "there";
  const avatarUri = userProfile?.photoURL;
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedBrand,  setSelectedBrand]  = useState("all");
  const [activeQuickCat, setActiveQuickCat] = useState("All");
  const [heroIndex,      setHeroIndex]      = useState(0);
  const heroRef = useRef(null);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (heroIndex + 1) % HERO_SLIDES.length;
      heroRef.current?.scrollToOffset({ offset: (width - 32) * next, animated: true });
      setHeroIndex(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroIndex]);

  // Drives the sticky header's collapse: the greeting block (eyebrow + name
  // + question) fades/shrinks away and the header panel's background fades
  // toward transparent as the user scrolls, leaving just the logo + chat
  // icon in a slim bar.
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_COLLAPSE_RANGE = 88;
  const headerGreetingOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_RANGE * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const headerGreetingHeight = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_RANGE],
    outputRange: [HEADER_COLLAPSE_RANGE, 0],
    extrapolate: "clamp",
  });
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_RANGE],
    outputRange: [1, 0.5],
    extrapolate: "clamp",
  });

  // Logo morph: travels from its resting top-left spot (inside the same
  // row as the chat icon — no cross-container positioning, so nothing can
  // clip or mis-stack it) to the row's horizontal center and grows
  // slightly, via transform (translate + scale) rather than animating raw
  // width/height/left/top — the more reliable way to do this in RN. A
  // small halo the same color as the header rides along with it (same
  // transform, so it never drifts out of sync) instead of animating
  // separately. The "GOODSOLES" wordmark rises into the spot it vacated.
  const collapseProgress = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_RANGE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const LOGO_BASE_SIZE = 42;
  const LOGO_BASE_LEFT = 24; // matches pageLogoBase's fixed left
  const LOGO_GROWTH = 1.25; // modest — "sakto lang", not a big jump
  // pageLogoBase is positioned relative to the full-width header now (not
  // the padded row), so its start/target centers are computed in that same
  // full-width coordinate space.
  const logoStartCenterX = LOGO_BASE_LEFT + LOGO_BASE_SIZE / 2;
  const logoTargetCenterX = width / 2;
  const logoTranslateX = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, logoTargetCenterX - logoStartCenterX],
  });
  // Pushes the logo down as it centers so it ends up sitting on the
  // header's own bottom edge — half inside, half dipping into the content
  // below — instead of staying centered inside the row the whole time.
  // 57 = the fully collapsed header's total height (20 padTop + 50 row +
  // 32 padBottom = 102) minus the logo's own start center-y (45).
  const logoTranslateY = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 57],
  });
  const logoScale = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, LOGO_GROWTH],
  });
  const BULGE_PAD = 8; // small halo around the logo, not a big oversized circle
  const brandLabelTranslateY = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

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
        <ActivityIndicator size="large" color={colors.accentGold} />
        <Text style={s.loaderText}>Loading drops…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      {/* ── PAGE HEADER (logo + greeting + chat) ──
          Sibling of the ScrollView, not inside it, so it stays fixed in
          place while the hero and everything below it scrolls underneath.
          The greeting/name collapses away on scroll, leaving just the logo
          + chat icon in a slim, more transparent bar — and the logo itself
          morphs from top-left to a centered, slightly bigger mark with a
          small matching-color halo, while the "GOODSOLES" wordmark rises
          into the spot it vacated. */}
      <View style={s.pageHeaderShadowWrap}>
        <View style={s.pageHeaderClip}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, s.pageHeaderBgLayer, { opacity: headerBgOpacity }]}
          />
          <View style={s.pageHeaderTopRow}>
            <Animated.View
              style={[
                s.headerBrandLabelWrap,
                { opacity: collapseProgress, transform: [{ translateY: brandLabelTranslateY }] },
              ]}
            >
              <TouchableOpacity
                style={s.headerAvatarBtn}
                onPress={() => navigation.navigate("Profile")}
                activeOpacity={0.8}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={s.headerAvatarImg} />
                ) : (
                  <Ionicons name="person" size={16} color={colors.textPrimary} />
                )}
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity
              style={s.heroIconBtn}
              onPress={openChatWidget}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Animated.View style={{ opacity: headerGreetingOpacity, height: headerGreetingHeight, overflow: "hidden" }}>
            <Text style={s.headerEyebrow}>{getGreeting()}</Text>
            <Text style={s.headerGreeting} numberOfLines={1}>Hello, {firstName}</Text>
            <Text style={s.headerQuestion}>What's your next pair?</Text>
          </Animated.View>
        </View>

        {/* Halo + logo render outside the clipped panel (as siblings of
            it, not inside) so they can dip past the header's rounded
            bottom edge into the content below without being clipped. Fixed
            base left/top here, matching where they'd naturally sit inside
            the row — transform (not animated left/top) does all the
            movement, which is what actually renders reliably. */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.headerBulge,
            {
              transform: [
                { translateX: logoTranslateX },
                { translateY: logoTranslateY },
                { scale: logoScale },
              ],
              opacity: collapseProgress,
            },
          ]}
        />
        <Animated.View
          style={[
            s.pageLogoBase,
            {
              transform: [
                { translateX: logoTranslateX },
                { translateY: logoTranslateY },
                { scale: logoScale },
              ],
            },
          ]}
        >
          <Image source={BRAND_LOGO} style={s.pageLogo} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >

        {/* ── HERO — pure swipeable image carousel, no text overlay ── */}
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
        )}

        {/* ── CATEGORY DROPDOWN (same as ShopScreen.jsx) ── */}
        <View style={s.categoryList}>
          {CATEGORIES.map((cat) => (
            <AccordionTile
              key={cat.key}
              category={cat}
              onBrandSelect={handleBrandSelect}
              onDirectNav={handleDirectNav}
            />
          ))}
        </View>

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
        )}

        {/* ── STORE MAP SECTION (moved from ShopScreen.jsx) ── */}
        <StoreMapSection />

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

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgPrimary },
  loader:     { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: "center", alignItems: "center" },
  loaderText: { color: colors.textMuted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginTop: 14, fontFamily: fonts.bodyMedium },
  container:  { flex: 1, backgroundColor: colors.bgPrimary },

  /* PAGE HEADER — logo + greeting + chat, fixed above the scrolling content.
     Split into a shadow wrapper (no overflow:hidden, so the shadow isn't
     clipped) and an inner clipped layer that holds the animated background
     fade + rounded bottom corners. */
  pageHeaderShadowWrap: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    zIndex: 20,
    elevation: 20,
    ...shadows.sm,
  },
  pageHeaderClip: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  pageHeaderBgLayer: { backgroundColor: colors.bgCard },
  // Fixed height so the profile icon/label's absolute positioning inside
  // it is predictable. Only the chat button is a normal-flow child now (the
  // logo/halo render outside this row entirely — see pageLogoBase/
  // headerBulge below — so it's the only thing justifyContent needs to
  // push to the row's end).
  pageHeaderTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    height: 50,
  },
  // Plain, fixed-size Image — its wrapping Animated.View (pageLogoBase)
  // handles the travel-to-center + grow via transform, not by animating
  // width/height directly (more reliable, and matches how the logo
  // rendered correctly before this effect was added).
  pageLogo: { width: 42, height: 42 },
  // Rendered outside pageHeaderClip (as a sibling of it, not inside), so
  // it can dip past the header's rounded bottom edge without being
  // clipped. left/top here match where the logo would sit inside the row
  // (clip's paddingTop 20 + row's own vertical centering for a 42px icon
  // in a 50px row) — transform does all the animated movement from there.
  pageLogoBase: { position: "absolute", left: 24, top: 24, zIndex: 2 },
  // Small halo behind the logo, same color as the header so it blends —
  // same base spot and the exact same transform as the logo, so it can
  // never drift out of sync with it.
  headerBulge: {
    position: "absolute",
    left: 16,
    top: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.bgCard,
    zIndex: 1,
  },
  headerBrandLabelWrap: { position: "absolute", left: 0, top: 0, height: 50, justifyContent: "center" },
  headerAvatarBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: colors.accentGold,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  headerAvatarImg: { width: "100%", height: "100%" },
  heroIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  headerEyebrow: { fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.5)", fontFamily: fonts.bodySemibold, marginTop: 16 },
  headerGreeting: { fontSize: 26, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display, marginTop: 10 },
  headerQuestion: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, fontFamily: fonts.bodyRegular, letterSpacing: 0.3 },

  /* HERO — pure swipeable image carousel below the header */
  heroCarouselWrap: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  hero: {
    width: width - 32,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    overflow: "hidden", height: 200,
  },
  heroBgImage: { width: "100%", height: "100%" },
  heroDots: { flexDirection: "row", gap: 4, marginTop: 12, justifyContent: "center", alignItems: "center" },
  dot:       { width: 5, height: 3, borderRadius: 2, backgroundColor: colors.bgTertiary },
  dotActive: { width: 22, backgroundColor: colors.accentGold },

  /* CATEGORY DROPDOWN (same as ShopScreen.jsx) */
  categoryList: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.bgTertiary },

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
    paddingHorizontal: 16, marginTop: 32, marginBottom: 14,
  },
  sectionEyebrow: { fontSize: 8, letterSpacing: 3, color: colors.textTertiary, fontFamily: fonts.bodyBold, marginBottom: 4 },
  sectionTitle:   { fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display },
  seeAllBtn:      { paddingBottom: 2 },
  seeAll:         { fontSize: 9, color: colors.textSecondary, letterSpacing: 1.5, fontFamily: fonts.bodySemibold },

  /* TRENDING */
  trendingSection: { marginTop: 4 },

  /* EDITORIAL BANNER */
  editorialWrap: { marginHorizontal: 16, marginTop: 32 },
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
  editorialEye:   { fontSize: 8, letterSpacing: 3.5, color: colors.textTertiary, marginBottom: 10, fontFamily: fonts.bodyBold },
  editorialTitle: { fontSize: 34, color: colors.textPrimary, lineHeight: 36, letterSpacing: 0.3, fontFamily: fonts.display },
  editorialBtn: {
    marginTop: 20, borderWidth: 0.5, borderColor: colors.borderLight,
    alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.04)",
  },
  editorialBtnText: { ...typography.button, fontSize: 10, color: colors.textPrimary },

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

  /* EMPTY */
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText:  { fontSize: 12, color: colors.textMuted, letterSpacing: 2 },

  /* STATS BAR */
  statsBar: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    marginHorizontal: 16, marginTop: 36,
    backgroundColor: colors.bgCard, borderWidth: 0.5, borderColor: colors.borderLight,
    borderRadius: radius.lg, paddingVertical: 18,
    ...shadows.sm,
  },
  statDivider: { width: 0.5, height: 28, backgroundColor: colors.borderLight },
  statItem:    { alignItems: "center", flex: 1 },
  statNum:     { fontSize: 22, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display },
  statLabel:   { fontSize: 8, color: colors.textTertiary, letterSpacing: 2.5, fontFamily: fonts.bodyBold, marginTop: 4 },

  /* BRAND FOOTER TAG */
  footerTag: { alignItems: "center", marginTop: 40, paddingBottom: 8 },
  footerTagText: { fontSize: 13, color: colors.bgTertiary, letterSpacing: 5, fontFamily: fonts.display },
  footerTagSub:  { fontSize: 9, color: colors.bgTertiary, letterSpacing: 1.5, marginTop: 4, fontFamily: fonts.bodyRegular },
});

/* ─────────────────── TILE STYLES (copied from ShopScreen.jsx) ─────────────────── */

const tileStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bgPrimary,
  },
  tile: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: colors.bgPrimary,
  },
  tileDisabled: { opacity: 0.4 },
  label: {
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontFamily: fonts.display,
  },
  labelDisabled: { color: colors.textMuted },
  chevron: {
    fontSize: 28,
    color: colors.textSecondary,
    fontWeight: "300",
    lineHeight: 30,
    transform: [{ rotate: "90deg" }],
  },
  comingSoon: {
    fontSize: 8,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.bgTertiary,
    marginHorizontal: 0,
  },
  subList: {
    backgroundColor: colors.bgPrimary,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    height: 52,
  },
  brandLabel: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  brandArrow: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: "300",
  },
  brandDivider: {
    height: 1,
    backgroundColor: colors.bgCard,
    marginLeft: 28,
  },
});

/* ─────────────────── STORE MAP STYLES (moved from ShopScreen.jsx) ─────────────────── */

const mapStyles = StyleSheet.create({
  container:      { marginTop: 32, marginHorizontal: 4, paddingHorizontal: 12 },
  sectionHeader:  { marginBottom: 14, paddingHorizontal: 4 },
  sectionEyebrow: { fontSize: 9, letterSpacing: 3, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginBottom: 2 },
  sectionTitle:   { fontSize: 26, color: colors.textPrimary, letterSpacing: 1, fontFamily: fonts.display },
  mapCard: {
    height: 190, backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden",
    marginBottom: 10, position: "relative",
  },
  mapBg:      { flex: 1, backgroundColor: colors.bgCard, position: "relative" },
  gridLine:   { position: "absolute", backgroundColor: "rgba(255,255,255,0.04)" },
  gridLineH:  { left: 0, right: 0, height: 1 },
  gridLineV:  { top: 0, bottom: 0, width: 1 },
  road:       { position: "absolute", backgroundColor: "rgba(255,255,255,0.06)" },
  roadH:      { left: 0, right: 0, height: 10 },
  roadV:      { top: 0, bottom: 0, width: 10 },
  pinContainer: { position: "absolute", top: "32%", left: "48%", alignItems: "center", justifyContent: "center" },
  pinGlow: {
    position: "absolute",
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.accentGoldWash,
  },
  pin: {
    width: 26, height: 26, borderRadius: 13, borderBottomRightRadius: 0,
    backgroundColor: colors.accentGold, transform: [{ rotate: "-45deg" }],
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.bgPrimary,
    ...shadows.sm,
  },
  pinDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.bgPrimary, transform: [{ rotate: "45deg" }] },
  locationChip: {
    position: "absolute", left: 12, bottom: 12, right: 90,
  },
  locationChipTitle: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.bodyBold, letterSpacing: 0.2 },
  locationChipSub:   { fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: fonts.bodyRegular, marginTop: 1 },
  mapHint: {
    position: "absolute", bottom: 10, right: 12,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  mapHintText:  { fontSize: 8, letterSpacing: 1.5, color: colors.textSecondary, fontFamily: fonts.bodySemibold },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.borderLight, padding: 16, marginBottom: 12,
    ...shadows.sm,
  },
  storeNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  storeName:    { fontSize: 17, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display },
  divider:      { height: 1, backgroundColor: colors.bgTertiary, marginBottom: 12 },
  infoRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  infoIcon:     { fontSize: 13, marginTop: 1 },
  infoText:     { fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18, letterSpacing: 0.3, fontFamily: fonts.bodyRegular },
  infoTextLink: { color: colors.accentGold, textDecorationLine: "underline" },
  directionsBtn: {
    backgroundColor: colors.textPrimary, borderRadius: radius.full,
    paddingVertical: 14, alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  directionsBtnText: { ...typography.button, fontSize: 11, color: colors.bgPrimary },
});