import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { colors, fonts, radius, typography } from "../theme";

const { width } = Dimensions.get("window");
const isSmall = width < 380;
const isTablet = width > 768;

export default function OrdersScreen({ navigation, route }) {
  // Receive params passed from PlaceOrderScreen via navigation.navigate("Orders", {...})
  const { orderNumber = "N/A", purchasedItems = [] } = route?.params || {};

  const grandTotal = purchasedItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

      {/* ── Success Header ── */}
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
        <Text style={styles.title}>Order Confirmed!</Text>
        <Text style={styles.subtitle}>Thank you for your purchase</Text>
        <View style={styles.orderNumberBadge}>
          <Text style={styles.orderNumberLabel}>ORDER NUMBER</Text>
          <Text style={styles.orderNumber}>{orderNumber}</Text>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Receipt ── */}
      <Text style={styles.sectionTitle}>Your Receipt</Text>

      {purchasedItems.length === 0 ? (
        <Text style={styles.emptyMsg}>No items found.</Text>
      ) : (
        <>
          {purchasedItems.map((item, index) => (
            <View
              key={`${item.id}_${item.size}_${index}`}
              style={styles.itemCard}
            >
              {/* Image */}
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.itemImage, styles.imagePlaceholder]}>
                  <Text style={styles.imagePlaceholderText}>No Image</Text>
                </View>
              )}

              {/* Details */}
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta}>Size: {item.size}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                <Text style={styles.itemPrice}>
                  ₱{(item.price || 0).toLocaleString()} each
                </Text>
              </View>

              {/* Line total */}
              <View style={styles.lineTotal}>
                <Text style={styles.lineTotalAmount}>
                  ₱{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}

          {/* Grand total */}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Paid</Text>
            <Text style={styles.grandTotalAmount}>
              ₱{grandTotal.toLocaleString()}
            </Text>
          </View>
        </>
      )}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => {
            // Reset CartStack to just CartScreen so Orders never reappears
            navigation.reset({
              index: 0,
              routes: [{ name: "CartScreen" }],
            });
            // Then navigate to the Home tab
            navigation.navigate("Home");
          }}
        >
          <Text style={styles.homeBtnText}>BACK TO HOMEPAGE</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  contentContainer: { padding: isSmall ? 16 : 20 },

  // Header
  header: { alignItems: "center", paddingVertical: 28 },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentGoldWash,
    borderWidth: 1,
    borderColor: colors.accentGold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  checkIcon: { color: colors.accentGold, fontSize: 36, fontWeight: "700" },
  title: {
    fontSize: isSmall ? 24 : isTablet ? 34 : 28,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 16 },
  orderNumberBadge: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: colors.bgCard,
  },
  orderNumberLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: isSmall ? 16 : 18,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 20,
  },

  sectionTitle: {
    fontSize: isSmall ? 16 : 18,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 14,
  },

  emptyMsg: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 },

  // Item card
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  itemImage: {
    width: isSmall ? 60 : 80,
    height: isSmall ? 60 : 80,
    borderRadius: radius.sm,
    backgroundColor: colors.bgTertiary,
  },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  imagePlaceholderText: { fontSize: 11, color: colors.textMuted },

  itemDetails: { flex: 1 },
  itemName: {
    fontSize: isSmall ? 13 : 14,
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  itemPrice: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  lineTotal: { justifyContent: "center" },
  lineTotalAmount: {
    fontSize: isSmall ? 13 : 15,
    fontWeight: "700",
    color: colors.accentGold,
  },

  // Grand total
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.accentGold,
  },
  grandTotalLabel: { fontSize: 16, fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 0.5 },
  grandTotalAmount: { fontSize: 20, fontWeight: "800", color: colors.accentGold },

  // Actions
  actions: { marginTop: 28 },
  homeBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  homeBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: isSmall ? 12 : 13,
  },
});