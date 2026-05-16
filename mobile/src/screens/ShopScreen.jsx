import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  ScrollView,
  Linking,
} from "react-native";

const { width } = Dimensions.get("window");
const TILE_WIDTH = width - 32;

/* ─────────────────── STORE CONFIG ─────────────────── */

const STORE = {
  name: "GoodSoles PH",
  lat: 14.5861,
  lng: 121.0569,
  address: "Robinsons Galleria, EDSA, Quezon City",
  hours: "Mon–Sun: 10:00 AM – 9:00 PM",
  phone: "+63 917 123 4567",
};

/* ─────────────────── BRAND CONFIG ─────────────────── */

const SHOE_BRANDS = [
  { label: "All Brands",  value: "all",    emoji: "👟" },
  { label: "Nike",        value: "nike",   emoji: "✔️" },
  { label: "Adidas",      value: "adidas", emoji: "🌿" },
  { label: "Puma",        value: "puma",   emoji: "🐆" },
  { label: "New Balance", value: "nb",     emoji: "🔵" },
];

const WATCH_BRANDS = [
  { label: "All Brands", value: "all",     emoji: "⌚" },
  { label: "Casio",      value: "casio",   emoji: "🟧" },
  { label: "Seiko",      value: "seiko",   emoji: "⬜" },
  { label: "Citizen",    value: "citizen", emoji: "🔵" },
  { label: "Orient",     value: "orient",  emoji: "🟫" },
];

/* ─────────────────── CATEGORY CONFIG ─────────────────── */

const CATEGORIES = [
  {
    key: "shoes",
    label: "Shoes",
    emoji: "👟",
    tag: "ALL BRANDS",
    description: "Sneakers & more",
    active: true,
    brands: SHOE_BRANDS,
    screen: "ShoesScreen",
  },
  {
    key: "watches",
    label: "Watches",
    emoji: "⌚",
    tag: "ALL BRANDS",
    description: "Timepieces",
    active: true,
    brands: WATCH_BRANDS,
    screen: "WatchesScreen",
  },
  {
    key: "bags",
    label: "Bags",
    emoji: "👜",
    tag: "COMING SOON",
    description: "Carry in style",
    active: false,
    brands: [],
    screen: null,
  },
  {
    key: "collectibles",
    label: "Collectibles",
    emoji: "🎴",
    tag: "COMING SOON",
    description: "Limited drops",
    active: false,
    brands: [],
    screen: null,
  },
];

/* ─────────────────── BRAND PICKER MODAL ─────────────────── */

const BrandPickerModal = ({ visible, category, onClose, onSelect }) => {
  if (!category) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>BROWSE BY BRAND</Text>
              <Text style={styles.modalTitle}>{category.label}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.brandList}
          >
            {category.brands.map((brand) => (
              <TouchableOpacity
                key={brand.value}
                style={styles.brandRow}
                onPress={() => onSelect(category, brand)}
                activeOpacity={0.7}
              >
                <View style={styles.brandRowLeft}>
                  <View style={styles.brandEmojiWrap}>
                    <Text style={styles.brandEmoji}>{brand.emoji}</Text>
                  </View>
                  <Text style={styles.brandRowLabel}>{brand.label}</Text>
                </View>
                <View style={styles.brandArrow}>
                  <Text style={styles.brandArrowText}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

/* ─────────────────── STORE MAP SECTION ─────────────────── */

const StoreMapSection = () => {
  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${STORE.lat},${STORE.lng}`;
    Linking.openURL(url);
  };

  const callStore = () => {
    Linking.openURL(`tel:${STORE.phone}`);
  };

  return (
    <View style={mapStyles.container}>
      <View style={mapStyles.sectionHeader}>
        <Text style={mapStyles.sectionEyebrow}>FIND US</Text>
        <Text style={mapStyles.sectionTitle}>Our Store</Text>
      </View>

      <TouchableOpacity
        style={mapStyles.mapCard}
        onPress={openInMaps}
        activeOpacity={0.85}
      >
        <View style={mapStyles.mapBg}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={`h${i}`}
              style={[mapStyles.gridLine, mapStyles.gridLineH, { top: `${i * 25}%` }]}
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={`v${i}`}
              style={[mapStyles.gridLine, mapStyles.gridLineV, { left: `${i * 25}%` }]}
            />
          ))}

          <View style={[mapStyles.road, mapStyles.roadH, { top: "40%" }]} />
          <View style={[mapStyles.road, mapStyles.roadH, { top: "65%" }]} />
          <View style={[mapStyles.road, mapStyles.roadV, { left: "30%" }]} />
          <View style={[mapStyles.road, mapStyles.roadV, { left: "70%" }]} />

          <View style={mapStyles.pinContainer}>
            <View style={mapStyles.pin}>
              <View style={mapStyles.pinDot} />
            </View>
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
  const [pickerVisible,    setPickerVisible]    = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleTilePress = (category) => {
    if (!category.active) return;
    setSelectedCategory(category);
    setPickerVisible(true);
  };

  const handleBrandSelect = (category, brand) => {
    setPickerVisible(false);
    navigation.navigate(category.screen, { selectedBrand: brand.value });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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

        {/* ── CATEGORY LIST ── */}
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tile, !cat.active && styles.tileDisabled]}
              onPress={() => handleTilePress(cat)}
              activeOpacity={cat.active ? 0.8 : 1}
            >
              {cat.active && <View style={styles.tileActiveBorder} />}

              {/* Emoji */}
              <Text style={[styles.tileEmoji, !cat.active && styles.tileEmojiDisabled]}>
                {cat.emoji}
              </Text>

              {/* Label + description */}
              <View style={styles.tileBody}>
                <Text style={[styles.tileLabel, !cat.active && styles.tileLabelDisabled]}>
                  {cat.label}
                </Text>
                <Text style={[styles.tileDesc, !cat.active && styles.tileDescDisabled]}>
                  {cat.description}
                </Text>
              </View>

              {/* Tag */}
              <Text style={[styles.tileTag, !cat.active && styles.tileTagDisabled]}>
                {cat.tag}
              </Text>

              {/* Arrow / lock */}
              {cat.active ? (
                <View style={styles.arrowCircle}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              ) : (
                <View style={styles.lockBadge}>
                  <Text style={styles.lockText}>🔒</Text>
                </View>
              )}

              {/* Live dot */}
              {cat.active && (
                <View style={styles.liveDotWrap}>
                  <View style={styles.liveDot} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── STORE MAP SECTION ── */}
        <StoreMapSection />

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>MORE CATEGORIES DROPPING SOON</Text>
        </View>
      </ScrollView>

      {/* ── BRAND PICKER MODAL ── */}
      <BrandPickerModal
        visible={pickerVisible}
        category={selectedCategory}
        onClose={() => setPickerVisible(false)}
        onSelect={handleBrandSelect}
      />
    </SafeAreaView>
  );
}

/* ─────────────────── STORE MAP STYLES ─────────────────── */

const mapStyles = StyleSheet.create({
  container: {
    marginTop: 32,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionEyebrow: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#555",
    fontWeight: "400",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  mapCard: {
    height: 180,
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  mapBg: {
    flex: 1,
    backgroundColor: "#141414",
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "#1e1e1e",
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  road: {
    position: "absolute",
    backgroundColor: "#242424",
  },
  roadH: {
    left: 0,
    right: 0,
    height: 8,
  },
  roadV: {
    top: 0,
    bottom: 0,
    width: 8,
  },
  pinContainer: {
    position: "absolute",
    top: "38%",
    left: "48%",
    alignItems: "center",
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderBottomRightRadius: 0,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "-45deg" }],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0A0A0A",
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0A0A0A",
    transform: [{ rotate: "45deg" }],
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    marginTop: 2,
  },
  mapHint: {
    position: "absolute",
    bottom: 10,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  mapHintText: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: "#a8a49c",
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
    marginBottom: 12,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  storeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e1e1e",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  infoIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  infoText: {
    fontSize: 12,
    color: "#a8a49c",
    flex: 1,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  infoTextLink: {
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
  directionsBtn: {
    backgroundColor: "#F5F3EF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  directionsBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#0A0A0A",
  },
});

/* ─────────────────── MAIN STYLES ─────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },

  scrollContent: {
    paddingBottom: 48,
  },

  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  eyebrow:  { fontSize: 9, letterSpacing: 3, color: "#555", fontWeight: "400", marginBottom: 1 },
  navTitle: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: 2 },

  subtitle:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  subtitleText: { fontSize: 13, color: "#444", letterSpacing: 0.5 },

  /* ── GRID → vertical column of rectangular tiles ── */
  grid: {
    flexDirection: "column",
    paddingHorizontal: 16,
    gap: 12,
  },

  tile: {
    width: TILE_WIDTH,
    height: 100,
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  tileDisabled: { opacity: 0.45 },
  tileActiveBorder: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  tileEmoji:         { fontSize: 36, marginRight: 16 },
  tileEmojiDisabled: { opacity: 0.4 },

  tileBody: { flex: 1 },
  tileLabel:         { fontSize: 18, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.5, marginBottom: 3 },
  tileLabelDisabled: { color: "#555" },
  tileDesc:          { fontSize: 10, color: "#555", letterSpacing: 0.5 },
  tileDescDisabled:  { color: "#333" },

  tileTag:         { fontSize: 7, fontWeight: "700", letterSpacing: 1.5, color: "#FFFFFF", marginRight: 10 },
  tileTagDisabled: { color: "#444" },

  arrowCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center",
  },
  arrowText: { color: "#000", fontSize: 14, fontWeight: "700" },

  lockBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a",
    justifyContent: "center", alignItems: "center",
  },
  lockText: { fontSize: 12 },

  liveDotWrap: {
    position: "absolute",
    top: 12,
    right: 56,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#2a2a2a",
    justifyContent: "center", alignItems: "center",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" },

  footer: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  footerText: { fontSize: 8, letterSpacing: 2.5, color: "#2a2a2a", fontWeight: "700" },

  /* ── MODAL ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#2a2a2a",
    alignSelf: "center",
    marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  modalEyebrow: { fontSize: 8, letterSpacing: 2.5, color: "#555", marginBottom: 4, fontWeight: "600" },
  modalTitle:   { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a",
    justifyContent: "center", alignItems: "center",
    marginTop: 4,
  },
  modalCloseText: { color: "#555", fontSize: 12 },

  brandList: { paddingHorizontal: 16, paddingTop: 8 },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  brandRowLeft:  { flexDirection: "row", alignItems: "center", gap: 14 },
  brandEmojiWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a",
    justifyContent: "center", alignItems: "center",
  },
  brandEmoji:     { fontSize: 18 },
  brandRowLabel:  { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  brandArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a",
    justifyContent: "center", alignItems: "center",
  },
  brandArrowText: { color: "#fff", fontSize: 13 },
});