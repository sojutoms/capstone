import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
  RefreshControl,
  Linking,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
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

const { width, height } = Dimensions.get("window");

const HERO_VIDEO_HEIGHT = height;

// Same logo used on the Sign In screen (GSPH-removebg.png) — swapped in for
// the wordmark that used to sit in its own persistent bar up top.
const BRAND_LOGO = require("../../assets/GSPH-removebg.png");

// Real brand logos for the BRANDS row — only these four exist as assets
// right now (no Nike/Jordan logo files were provided), each mapped to the
// exact brand value ShoesScreen's filter expects.
const BRANDS = [
  { label: "Nike", value: "nike", logo: require("../../assets/nike_logo.jpg") },
  { label: "Adidas", value: "adidas", logo: require("../../assets/adidas_logo.png") },
  { label: "New Balance", value: "nb", logo: require("../../assets/nb_logo.png") },
  { label: "On Cloud", value: "on", logo: require("../../assets/oncloud_logo.png") },
  { label: "Puma", value: "puma", logo: require("../../assets/puma_logo.png") },
];

// Note: the 3rd file is named "silde_3.jpg" (typo) in assets, not "slide_3.jpg".
const EDITORIAL_SLIDES = [
  require("../../assets/slide_1.jpg"),
  require("../../assets/slide_2.jpg"),
  require("../../assets/silde_3.jpg"),
  require("../../assets/slide_4.jpg"),
];

// Space reserved at the top of the ScrollView so its content starts below
// the floating header panel (logo + greeting) instead of underneath it.
// Android-tuned value — untouched. iOS derives its own version of this from
// the device's real safe-area inset instead (see headerExtraPad below).
const FLOATING_HEADER_CLEARANCE = 160;

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
    bg: require("../../assets/shoes_bg.jpg"),
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
    bg: require("../../assets/watch_bg.jpg"),
    brands: [],
  },
  {
    key: "bags",
    label: "Bags",
    active: true,
    screen: "BagsScreen",
    directNav: true,
    bg: require("../../assets/bags_bg.jpg"),
    brands: [],
  },
  {
    key: "collectibles",
    label: "Collectibles",
    active: true,
    screen: "CollectiblesScreen",
    directNav: true,
    bg: require("../../assets/collectibles_bg.jpg"),
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
      {/* ── MAIN TILE BUTTON — background photo per category, with a dark
          scrim underneath so the label/chevron stay readable on any image ── */}
      <TouchableOpacity
        style={!category.active && tileStyles.tileDisabled}
        onPress={toggle}
        activeOpacity={category.active ? 0.85 : 1}
      >
        <ImageBackground source={category.bg} style={tileStyles.tile} imageStyle={tileStyles.tileBgImage}>
          <View style={tileStyles.tileScrim} />
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
        </ImageBackground>
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
    const destination = encodeURIComponent(`${STORE.name}, ${STORE.address}`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
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

  // iOS-only header sizing: derived from the real device safe-area inset
  // (root is a plain View, not SafeAreaView, so nothing else adds this
  // automatically). Android is untouched, still using its own flat,
  // previously-tuned numbers below.
  const insets = useSafeAreaInsets();
  const headerExtraPad   = Platform.OS === "ios" ? insets.top + 56 : 48;
  const scrollClearance  = Platform.OS === "ios" ? headerExtraPad + 95 : FLOATING_HEADER_CLEARANCE;

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

  // Bumped every time the Home tab regains focus, forcing FadeInItem below
  // to remount and replay its fade/rise-in — otherwise it only ever plays
  // once on the very first mount since React Navigation keeps tab screens
  // alive in the background instead of unmounting them on tab switch.
  const [greetingAnimKey, setGreetingAnimKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setGreetingAnimKey((k) => k + 1);
    }, [])
  );

  const featuredVideoPlayer = useVideoPlayer(require("../../assets/featured_vid.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const [editorialSlide, setEditorialSlide] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setEditorialSlide((prev) => (prev + 1) % EDITORIAL_SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

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
    // Plain View, not SafeAreaView — matches ProfileScreen's root exactly.
    // Core SafeAreaView auto-adds the device's real top/bottom insets on
    // iOS on top of the manual insets.top/insets.bottom math already used
    // below and in the tab bar clearance, double-counting them (it's a
    // no-op on Android, so this changes nothing there).
    <View style={s.safe}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      {/* ── FLOATING HEADER (logo + chat + greeting) ──
          Absolutely positioned above the ScrollView, not a flex sibling
          taking layout space — so once the panel fades to fully
          transparent, the content scrolling underneath just shows through. */}
      <View style={s.floatingHeaderOverlay} pointerEvents="box-none">
        <Animated.View
          style={[s.headerPanel, { opacity: headerOpacity, paddingTop: headerExtraPad }]}
          pointerEvents={headerCollapsed ? "none" : "auto"}
        >
          {/* Chat button moved up to its own top-right corner, separate
              from the greeting row below — matching the reference layout's
              bell icon placement. */}
          <TouchableOpacity
            ref={chatBtnRef}
            style={[s.chatBtnTopRight, Platform.OS === "ios" && { top: insets.top + 14 }]}
            onPress={handleOpenChat}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#ffffff" />
          </TouchableOpacity>

          {/* All three text lines grouped in their own column, then that
              column + the logo sit side by side with alignItems:"center" —
              flexbox centers them against each other automatically instead
              of guessing manual offsets that never quite lined up. */}
          <View style={s.greetingRow}>
            <FadeInItem key={greetingAnimKey} style={{ flex: 1 }}>
              <Text style={s.headerEyebrow}>{getGreeting()}</Text>
              <Text style={s.headerGreeting} numberOfLines={1}>Hello, {firstName}</Text>
              <Text style={s.headerQuestion}>What's your next pair?</Text>
            </FadeInItem>
            <Image source={BRAND_LOGO} style={[s.miniLogo, { tintColor: "#ffffff" }]} resizeMode="contain" />
          </View>
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: scrollClearance, paddingBottom: TAB_BAR_CLEARANCE }}
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

        {/* ── BRANDS ── */}
        <View style={s.brandsSection}>
          <SectionHeader title="Brands" s={s} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingLeft: Platform.OS === "ios" ? 3 : 16,
              paddingRight: 16,
              gap: Platform.OS === "ios" ? 15 : 18,
            }}
          >
            {BRANDS.map((b) => (
              <TouchableOpacity
                key={b.value}
                style={s.brandItem}
                activeOpacity={0.7}
                onPress={() => navigateToShopCategory("ShoesScreen", { selectedBrand: b.value })}
              >
                <View style={s.brandCircle}>
                  <Image
                    source={b.logo}
                    style={[s.brandLogo, { tintColor: "#fff" }]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={s.brandLabel}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── TRENDING NOW ── */}
        {(loading || trendingProducts.length > 0) && (
          <View style={s.trendingSection}>
            <SectionHeader
              eyebrow="MOST WANTED THIS WEEK"
              title="Trending Now"
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

        {/* ── JUST DROPPED ── */}
        {(loading || droppedProducts.length > 0) && (
          <View>
            <SectionHeader
              eyebrow="FRESH ARRIVALS"
              title="Just Dropped"
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

        {/* ── FEATURED — full-bleed video banner. contentFit="cover" needs
            surfaceType="textureView" below — the default surfaceView is a
            hardware overlay that ignores the rounded/clipped container and
            resizes unreliably. */}
        <SectionHeader title="Featured" s={s} />
        <View style={s.heroFullBleed}>
          <VideoView
            player={featuredVideoPlayer}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        </View>

        {/* ── FEATURED EDITORIAL BANNER — auto-advancing photo slideshow ── */}
        <View style={s.editorialWrap}>
          <ImageBackground
            source={EDITORIAL_SLIDES[editorialSlide]}
            style={s.editorial}
            imageStyle={s.editorialBgImage}
          >
            <View style={s.editorialScrim} pointerEvents="none" />
            <View style={s.editorialContent}>
              <Text style={s.editorialEye}>GOODSOLESPH</Text>
              <Text style={s.editorialTitle}>{"Crafted for\nthe streets."}</Text>
            </View>
            <View style={s.editorialDots} pointerEvents="none">
              {EDITORIAL_SLIDES.map((_, i) => (
                <View key={i} style={[s.editorialDot, i === editorialSlide && s.editorialDotActive]} />
              ))}
            </View>
          </ImageBackground>
        </View>

        {/* ── STORE MAP SECTION (moved from ShopScreen.jsx) ── */}
        <StoreMapSection mapStyles={mapStyles} colors={colors} />

      </Animated.ScrollView>
    </View>
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
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingLeft: 22,
    paddingRight: 24,
    // Was 48 to clear the logo that used to sit here — tightened now that
    // the row is just the chat button, so the card doesn't read oversized.
    paddingTop: 48,
    paddingBottom: 28,
    ...shadows.sm,
  },
  // GSPH-removebg.png is roughly 594x420 (not square) — sized to a small
  // icon box, contain-fit so it doesn't distort.
  // Plain flex child now (not absolutely positioned) — sits inside
  // greetingRow alongside the text column, centered against it by flexbox.
  miniLogo: { width: 88, height: 88 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  chatBtnTopRight: {
    position: "absolute",
    top: 14, right: 16,
    width: 36, height: 36,
    justifyContent: "center", alignItems: "center",
  },
  // marginTop was 24 to clear the old logo/chat row above it — that row's
  // gone now (chat button moved inline with the greeting text below), so
  // this sits right under the card's own paddingTop instead.
  headerEyebrow: { fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.6)", fontFamily: fonts.bodySemibold, marginBottom: 4 },
  headerGreeting: { fontSize: 26, color: "#ffffff", letterSpacing: 0.5, fontFamily: fonts.display, marginTop: 0 },
  headerQuestion: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 6, fontFamily: fonts.bodyRegular, letterSpacing: 0.3 },

  /* HERO — pure swipeable image carousel below the header */
  heroFullBleed: {
    width,
    height: HERO_VIDEO_HEIGHT,
    backgroundColor: "#000",
    overflow: "hidden",
    borderRadius: 28,
  },
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

  /* BRANDS */
  brandsSection: { marginTop: 4 },
  brandItem: { alignItems: "center", width: 72 },
  brandCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brandLogo: { width: "62%", height: "62%" },
  brandLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: isDark ? "#ffffff" : "#000000",
    fontFamily: fonts.bodySemibold,
    textAlign: "center",
  },

  /* TRENDING */
  trendingSection: { marginTop: 4 },

  /* EDITORIAL BANNER */
  editorialWrap: { marginHorizontal: 16, marginTop: 32 },
  editorial: {
    borderRadius: radius.xl,
    overflow: "hidden", height: 260,
  },
  editorialBgImage: { resizeMode: "cover" },
  editorialScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  editorialContent: { flex: 1, padding: 26, justifyContent: "flex-end" },
  editorialDots: {
    position: "absolute", top: 16, right: 20,
    flexDirection: "row", gap: 5,
  },
  editorialDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  editorialDotActive: { backgroundColor: "#ffffff" },
  editorialEye:   { fontSize: 8, letterSpacing: 3.5, color: "rgba(255,255,255,0.7)", marginBottom: 10, fontFamily: fonts.bodyBold },
  editorialTitle: { fontSize: 34, color: "#ffffff", lineHeight: 36, letterSpacing: 0.3, fontFamily: fonts.display },

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
    paddingVertical: 28,
    overflow: "hidden",
  },
  tileBgImage: { resizeMode: "cover" },
  // Dark scrim under the label/chevron so they stay readable regardless of
  // what the category photo looks like underneath.
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  tileDisabled: { opacity: 0.4 },
  // Fixed light-on-photo below, not theme colors — this tile always sits on
  // a dark-scrimmed background image regardless of light/dark mode, same
  // reasoning as other permanently-dark overlays elsewhere in the app.
  label: {
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: 0.5,
    fontFamily: fonts.display,
  },
  labelDisabled: { color: "rgba(255,255,255,0.5)" },
  chevron: {
    fontSize: 28,
    color: "#ffffff",
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