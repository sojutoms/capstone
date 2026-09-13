import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
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
import { fonts, radius, shadows, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import FadeInItem from "../components/FadeInItem";
import ProductCard from "../components/ProductCard";
import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { getLowestPrice, isOutOfStock } from "../utils/productHelpers";
import Toast from "react-native-toast-message";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { openChatWidget } from "../utils/chatWidgetBus";

const { width } = Dimensions.get("window");

const BRAND_LOGO = require("../../assets/logo_hero.png");

// Space reserved at the top of the ScrollView so its content starts below
// the floating header panel (logo + greeting) instead of underneath it.
const FLOATING_HEADER_CLEARANCE = 216;

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

const AccordionTile = ({ category, onBrandSelect, onDirectNav, tileStyles }) => {
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

const StoreMapSection = ({ mapStyles, colors }) => {
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
          <Ionicons name="location-outline" size={14} color={colors.textMuted} style={mapStyles.infoIcon} />
          <Text style={mapStyles.infoText}>{STORE.address}</Text>
        </View>
        <View style={mapStyles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} style={mapStyles.infoIcon} />
          <Text style={mapStyles.infoText}>{STORE.hours}</Text>
        </View>
        <View style={mapStyles.infoRow}>
          <Ionicons name="call-outline" size={14} color={colors.textMuted} style={mapStyles.infoIcon} />
          <TouchableOpacity onPress={callStore}>
            <Text style={[mapStyles.infoText, mapStyles.infoTextLink]}>{STORE.phone}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={mapStyles.directionsBtn} onPress={openInMaps} activeOpacity={0.85}>
        <Text style={mapStyles.directionsBtnText}>GET DIRECTIONS</Text>
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

const SectionHeader = ({ eyebrow, title, onSeeAll, s }) => (
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
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const tileStyles = useMemo(() => makeTileStyles(colors), [colors]);
  const mapStyles = useMemo(() => makeMapStyles(colors), [colors]);

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
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedBrand,  setSelectedBrand]  = useState("all");
  const [activeQuickCat, setActiveQuickCat] = useState("All");
  const [heroIndex,      setHeroIndex]      = useState(0);
  const heroRef = useRef(null);
  const chatBtnRef = useRef(null);

  // Measures the header chat icon's actual position and passes it along so
  // ChatWidget's pop-out animation originates from here, not its own FAB
  // (which is hidden on this screen).
  const handleOpenChat = () => {
    chatBtnRef.current?.measureInWindow((x, y, width, height) => {
      openChatWidget({ x: x + width / 2, y: y + height / 2 });
    });
  };

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (heroIndex + 1) % HERO_SLIDES.length;
      heroRef.current?.scrollToOffset({ offset: (width - 32) * next, animated: true });
      setHeroIndex(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroIndex]);

  // Drives the floating header's fade: the whole panel — logo (sitting
  // where the profile icon used to be, top-left) + greeting text — fades
  // out together as the user scrolls, leaving only the chat button, which
  // lives outside this fading group entirely so it keeps floating on its
  // own with no panel behind it.
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_COLLAPSE_RANGE = 170;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_RANGE],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  // Once fully faded, the (invisible) panel shouldn't still swallow touches
  // meant for whatever's now scrolled up underneath it.
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

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

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      {/* ── FLOATING HEADER (logo + chat + greeting) ──
          Absolutely positioned above the ScrollView, not a flex sibling
          taking layout space — so once the panel fades to fully
          transparent, the content scrolling underneath just shows through.
          The logo sits OUTSIDE the fading Animated.View (as its own
          absolutely-positioned sibling matching the panel's old top-left
          inset) so it stays put as a persistent "hero" mark even once the
          rest of the card (eyebrow/greeting/chat) fades away on scroll. */}
      <View style={s.floatingHeaderOverlay} pointerEvents="box-none">
        <Animated.View
          style={[s.headerPanel, { opacity: headerOpacity }]}
          pointerEvents={headerCollapsed ? "none" : "auto"}
        >
          {/* Spacer holding the logo's old footprint so the text below
              doesn't shift up now that the real logo lives outside this
              fading panel. */}
          <View style={s.pageLogoSpacer} />
          <Text style={s.headerEyebrow}>{getGreeting()}</Text>
          <View style={s.headerTopRow}>
            <Text style={[s.headerGreeting, { flex: 1 }]} numberOfLines={1}>Hello, {firstName}</Text>
            <TouchableOpacity ref={chatBtnRef} style={s.chatBtn} onPress={handleOpenChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
        {/* Small persistent dark tab behind the logo — not just a naked
            floating image once the greeting card fades away on scroll. */}
        <View style={s.persistentLogoBar} pointerEvents="none">
          <Image source={BRAND_LOGO} style={[s.pageLogo, { tintColor: "#ffffff" }]} resizeMode="contain" />
        </View>
      </View>

      <Animated.ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: FLOATING_HEADER_CLEARANCE, paddingBottom: TAB_BAR_CLEARANCE }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: (e) => {
              const collapsed = e.nativeEvent.contentOffset.y >= HEADER_COLLAPSE_RANGE;
              setHeaderCollapsed((prev) => (prev !== collapsed ? collapsed : prev));
            },
          }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >

        {/* ── HERO — pure swipeable image carousel, no text overlay ── */}
        <View style={s.heroCarouselWrap}>
          <Text style={s.heroLabel}>BRANDS</Text>
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
        {(loading || trendingProducts.length > 0) && (
          <View style={s.trendingSection}>
            <SectionHeader
              eyebrow="MOST WANTED THIS WEEK"
              title="Trending Now"
              onSeeAll={() => {}}
              s={s}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : trendingProducts.map((item, index) => (
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
              tileStyles={tileStyles}
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
        {(loading || droppedProducts.length > 0) && (
          <View>
            <SectionHeader
              eyebrow="FRESH ARRIVALS"
              title="Just Dropped"
              onSeeAll={() => {}}
              s={s}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {loading
                ? Array.from({ length: 2 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : droppedProducts.map((item, index) => (
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
        <StoreMapSection mapStyles={mapStyles} colors={colors} />

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */

const makeStyles = (colors, isDark) => StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgPrimary },
  container:  { flex: 1, backgroundColor: colors.bgPrimary },

  /* FLOATING HEADER — logo + chat + greeting, all one panel that fades
     together on scroll. Absolutely positioned above the ScrollView, not a
     flex sibling, so once it fades out the scrolling content behind it
     just shows through. Pill-shaped bottom edge, generous padding. */
  floatingHeaderOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 20,
  },
  headerPanel: {
    // Dark mode: pure black, unchanged from before. Light mode: matches how
    // the bottom nav pill's translucent grey actually reads once blended
    // over the page (not the same raw value, since this card is opaque).
    backgroundColor: isDark ? "#000000" : "#404040",
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    paddingLeft: 22,
    paddingRight: 30,
    // Was 48 to clear the logo that used to sit here — tightened now that
    // the row is just the chat button, so the card doesn't read oversized.
    paddingTop: 34,
    paddingBottom: 20,
    ...shadows.sm,
  },
  // A small always-visible dark tab (not tied to headerOpacity) behind the
  // logo, so scrolling past the greeting card leaves this compact bar
  // instead of a bare floating image with nothing behind it.
  persistentLogoBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    alignItems: "center",
    backgroundColor: isDark ? "#000000" : "#404040",
    paddingTop: 34,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  // logo_hero.png is a wide 665x71 wordmark, not a square icon — sized by
  // explicit width+height (not aspectRatio, which isn't reliably respected
  // in every layout context) instead of a fixed square box.
  pageLogo: { width: 120, height: 13 },
  // Clears the persistent logo bar above (paddingTop 34 + logo 13 +
  // paddingBottom 16 ≈ 63) plus some breathing room, so the eyebrow/
  // greeting/chat row sits comfortably below it instead of crowding it.
  pageLogoSpacer: { height: 80 },
  headerTopRow: {
    // Greeting text + chat button side by side now (chat button used to be
    // its own row above the text, which cost extra vertical space).
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  // marginTop was 24 to clear the old logo/chat row above it — that row's
  // gone now (chat button moved inline with the greeting text below), so
  // this sits right under the card's own paddingTop instead.
  headerEyebrow: { fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.6)", fontFamily: fonts.bodySemibold },
  headerGreeting: { fontSize: 26, color: "#ffffff", letterSpacing: 0.5, fontFamily: fonts.display, marginTop: 0 },

  /* HERO — pure swipeable image carousel below the header */
  heroCarouselWrap: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  hero: {
    width: width - 32,
    // Fixed value, not colors.bgCard — kept isolated so tuning bgCard
    // elsewhere (cart, orders, favorites, product cards) never moves this.
    backgroundColor: isDark ? "#151515" : "#ffffff",
    borderRadius: radius.xl, borderWidth: 0.5, borderColor: colors.borderLight,
    overflow: "hidden", height: 200,
  },
  heroBgImage: { width: "100%", height: "100%" },
  // Same font treatment as "Trending Now" — a heading above the carousel,
  // not overlaid on the photo.
  heroLabel: {
    fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5, fontFamily: fonts.display,
    marginBottom: 12,
  },
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
});

/* ─────────────────── TILE STYLES (copied from ShopScreen.jsx) ─────────────────── */

const makeTileStyles = (colors) => StyleSheet.create({
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

const makeMapStyles = (colors) => StyleSheet.create({
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
  infoIcon:     { marginTop: 2 },
  infoText:     { fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18, letterSpacing: 0.3, fontFamily: fonts.bodyRegular },
  infoTextLink: { color: colors.accentGold, textDecorationLine: "underline" },
  // Same shape/size as Cart's checkout button — radius.lg, centered rather
  // than full-width, no arrow — so buttons read as one consistent system.
  directionsBtn: {
    alignSelf: "center", width: "70%",
    backgroundColor: colors.textPrimary, borderRadius: radius.lg,
    paddingVertical: 17, alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  directionsBtnText: { ...typography.button, fontSize: 12, color: colors.textInverse },
});