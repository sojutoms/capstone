import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ScrollView,
  Linking,
  Animated,
  RefreshControl,
} from "react-native";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { colors, fonts, radius, typography } from "../theme";

const { width } = Dimensions.get("window");

/* ─────────────────── STORE CONFIG ─────────────────── */

const STORE = {
  name: "GoodSoles PH",
  lat: 14.5861,
  lng: 121.0569,
  address: "Robinsons Galleria, EDSA, Quezon City",
  hours: "Mon–Sun: 10:00 AM – 9:00 PM",
  phone: "+63 917 123 4567",
};

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

/* ─────────────────── ACCORDION TILE ─────────────────── */

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

/* ─────────────────── STORE MAP SECTION ─────────────────── */

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

      <TouchableOpacity style={mapStyles.mapCard} onPress={openInMaps} activeOpacity={0.85}>
        <View style={mapStyles.mapBg}>
          {[0,1,2,3,4].map((i) => (
            <View key={`h${i}`} style={[mapStyles.gridLine, mapStyles.gridLineH, { top: `${i*25}%` }]} />
          ))}
          {[0,1,2,3,4].map((i) => (
            <View key={`v${i}`} style={[mapStyles.gridLine, mapStyles.gridLineV, { left: `${i*25}%` }]} />
          ))}
          <View style={[mapStyles.road, mapStyles.roadH, { top: "40%" }]} />
          <View style={[mapStyles.road, mapStyles.roadH, { top: "65%" }]} />
          <View style={[mapStyles.road, mapStyles.roadV, { left: "30%" }]} />
          <View style={[mapStyles.road, mapStyles.roadV, { left: "70%" }]} />
          <View style={mapStyles.pinContainer}>
            <View style={mapStyles.pin}><View style={mapStyles.pinDot} /></View>
            <View style={mapStyles.pinShadow} />
          </View>
        </View>
        <View style={mapStyles.mapHint}>
          <Text style={mapStyles.mapHintText}>TAP TO OPEN IN MAPS  →</Text>
        </View>
      </TouchableOpacity>

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

/* ─────────────────── MAIN SCREEN ─────────────────── */

export default function ShopScreen({ navigation }) {
  const { refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  // This screen has no data of its own to re-fetch (it's a static category
  // menu) — pulling here just keeps the Cart/Favorites badges current.
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCart(), refreshFavorites()]);
    setRefreshing(false);
  };

  const handleBrandSelect = (category, brand) => {
    navigation.navigate(category.screen, { selectedBrand: brand.value });
  };

  const handleDirectNav = (category) => {
    navigation.navigate(category.screen);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* ── TOP NAV ── */}
        <View style={styles.topNav}>
          <View>
            <Text style={styles.eyebrow}>BROWSE</Text>
            <Text style={styles.navTitle}>SHOP</Text>
          </View>
        </View>

        <View style={styles.subtitle}>
          <Text style={styles.subtitleText}>What are you looking for?</Text>
        </View>

        {/* ── ACCORDION CATEGORY LIST ── */}
        <View style={styles.categoryList}>
          {CATEGORIES.map((cat) => (
            <AccordionTile
              key={cat.key}
              category={cat}
              onBrandSelect={handleBrandSelect}
              onDirectNav={handleDirectNav}
            />
          ))}
        </View>

        {/* ── STORE MAP SECTION ── */}
        <StoreMapSection />

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>MORE CATEGORIES DROPPING SOON</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── TILE STYLES ─────────────────── */

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
    color: colors.accentGold,
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

/* ─────────────────── STORE MAP STYLES ─────────────────── */

const mapStyles = StyleSheet.create({
  container:      { marginTop: 32, paddingHorizontal: 12 },
  sectionHeader:  { marginBottom: 14, paddingHorizontal: 4 },
  sectionEyebrow: { fontSize: 9, letterSpacing: 3, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginBottom: 2 },
  sectionTitle:   { fontSize: 26, color: colors.textPrimary, letterSpacing: 1, fontFamily: fonts.display },
  mapCard: {
    height: 180, backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden",
    marginBottom: 10, position: "relative",
  },
  mapBg:      { flex: 1, backgroundColor: colors.bgCard, position: "relative" },
  gridLine:   { position: "absolute", backgroundColor: colors.bgTertiary },
  gridLineH:  { left: 0, right: 0, height: 1 },
  gridLineV:  { top: 0, bottom: 0, width: 1 },
  road:       { position: "absolute", backgroundColor: colors.bgSurface },
  roadH:      { left: 0, right: 0, height: 8 },
  roadV:      { top: 0, bottom: 0, width: 8 },
  pinContainer: { position: "absolute", top: "38%", left: "48%", alignItems: "center" },
  pin: {
    width: 28, height: 28, borderRadius: 14, borderBottomRightRadius: 0,
    backgroundColor: colors.accentGold, transform: [{ rotate: "-45deg" }],
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.bgPrimary,
  },
  pinDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bgPrimary, transform: [{ rotate: "45deg" }] },
  pinShadow:{ width: 10, height: 4, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.4)", marginTop: 2 },
  mapHint: {
    position: "absolute", bottom: 10, right: 12,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  mapHintText:  { fontSize: 8, letterSpacing: 1.5, color: colors.textSecondary, fontFamily: fonts.bodySemibold },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.borderLight, padding: 16, marginBottom: 12,
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

/* ─────────────────── MAIN STYLES ─────────────────── */

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bgPrimary },
  scrollContent: { paddingBottom: 48 },
  topNav: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  eyebrow:      { fontSize: 9, letterSpacing: 3, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginBottom: 1 },
  navTitle:     { fontSize: 32, color: colors.textPrimary, letterSpacing: 2, fontFamily: fonts.display },
  subtitle:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  subtitleText: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.5, fontFamily: fonts.bodyRegular },
  categoryList: { borderTopWidth: 1, borderTopColor: colors.bgTertiary },
  footer:       { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  footerText:   { fontSize: 8, letterSpacing: 2.5, color: colors.bgTertiary, fontFamily: fonts.bodyBold },
});