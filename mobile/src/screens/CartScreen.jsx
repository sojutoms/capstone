import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { colors, fonts, radius, shadows, spacing, typography } from "../theme";
import PressScale from "../components/PressScale";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

export default function CartScreen({ navigation }) {
  const { cart, addToCart, decreaseQuantity, removeFromCart, refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  // Picks up anything added/removed from the web app while this tab wasn't
  // in focus, instead of showing whatever was last fetched at login.
  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCart(), refreshFavorites()]);
    setRefreshing(false);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const sizeData = item?.sizes?.[item.selectedSize];
      const price =
        typeof sizeData === "object"
          ? Number(sizeData.price || item.new_price)
          : Number(sizeData || item.new_price);
      return total + price * item.quantity;
    }, 0);
  };

  if (!cart.length) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
          }
        >
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>YOUR CART IS EMPTY</Text>
          <Text style={styles.emptySubtitle}>
            Looks like you haven't added anything yet.
          </Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.shopBtnText}>EXPLORE PRODUCTS →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>YOUR CART</Text>
        <Text style={styles.headerCount}>{cart.length} item{cart.length !== 1 ? "s" : ""}</Text>
      </View>

      {/* ── CART LIST ──
          flex:1 so it fills exactly the space between the header and the
          summary panel below — the summary sits in normal flow after it,
          not position:absolute, so it's never separated from a short list
          by a big fixed paddingBottom hack. */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={cart}
        keyExtractor={(item) => `${item.id}_${item.selectedSize}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
        renderItem={({ item, index }) => {
          const sizeData = item?.sizes?.[item.selectedSize];
          const price =
            typeof sizeData === "object"
              ? Number(sizeData.price || item.new_price)
              : Number(sizeData || item.new_price);
          const availableStock =
            typeof sizeData === "object"
              ? sizeData.quantity
              : Number(sizeData) || 0;
          const remainingStock = availableStock - item.quantity;
          const isOutOfStock = remainingStock <= 0;

          return (
            <View style={styles.card}>
              {/* Product Image */}
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.image }} style={styles.image} />
                {isOutOfStock && (
                  <View style={styles.outOfStockOverlay}>
                    <Text style={styles.outOfStockOverlayText}>SOLD OUT</Text>
                  </View>
                )}
              </View>

              {/* Product Info */}
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.sizeBadge}>
                      <Text style={styles.sizeText}>SIZE {item.selectedSize}</Text>
                    </View>
                  </View>
                  <Text style={styles.priceText}>₱{price.toLocaleString()}</Text>
                </View>

                {/* Stock Warning */}
                {!isOutOfStock && remainingStock <= 3 && (
                  <Text style={styles.lowStockText}>
                    ⚡ Only {remainingStock} left
                  </Text>
                )}
                {isOutOfStock && (
                  <Text style={styles.outOfStockText}>Out of stock</Text>
                )}

                {/* Bottom Row */}
                <View style={styles.cardBottom}>
                  {/* Quantity Controls */}
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decreaseQuantity(index)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[
                        styles.qtyBtn,
                        item.quantity >= availableStock && styles.qtyBtnDisabled,
                      ]}
                      disabled={item.quantity >= availableStock}
                      onPress={() => addToCart(item, item.selectedSize)}
                    >
                      <Text
                        style={[
                          styles.qtyBtnText,
                          item.quantity >= availableStock && { color: colors.textMuted },
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Remove */}
                  <TouchableOpacity
                    onPress={() => removeFromCart(index)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>REMOVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />

      {/* ── ORDER SUMMARY ── */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>ORDER SUMMARY</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₱{calculateTotal().toLocaleString()}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>₱{calculateTotal().toLocaleString()}</Text>
        </View>

        <PressScale
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate("PlaceOrder")}
        >
          <Text style={styles.checkoutText}>PROCEED TO CHECKOUT</Text>
          <Text style={styles.checkoutArrow}>→</Text>
        </PressScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },

  // ── EMPTY STATE ──
  emptyContainer: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 36,
  },
  shopBtn: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.full,
  },
  shopBtnText: {
    ...typography.button,
    color: colors.textPrimary,
    fontSize: 13,
  },

  // ── HEADER ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerLabel: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: 1.5,
  },
  headerCount: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 2,
  },

  // ── LIST ──
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 16,
  },

  // ── CARD ──
  card: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 14,
    gap: 14,
    ...shadows.sm,
  },
  imageWrapper: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.bgTertiary,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  outOfStockOverlayText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardContent: {
    flex: 1,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  productName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  sizeBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  sizeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
  },
  priceText: {
    color: colors.accentGold,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  lowStockText: {
    color: colors.danger,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  outOfStockText: {
    color: colors.danger,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },

  // ── QTY ──
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  qtyValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
  },

  // ── REMOVE ──
  removeBtn: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  removeBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
  },

  // ── SUMMARY ──
  // Normal flow, not position:absolute — it sits directly below the list
  // (which has flex:1 above it) so a short cart never leaves a dead gap
  // between the last item and this panel.
  summaryContainer: {
    backgroundColor: colors.bgCard,
    padding: 20,
    paddingBottom: TAB_BAR_CLEARANCE,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    ...shadows.md,
  },
  summaryTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 2.5,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  freeBadge: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  freeBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 12,
  },
  totalLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.display,
    letterSpacing: 1,
  },
  totalValue: {
    color: colors.accentGold,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  // ── CHECKOUT ──
  checkoutBtn: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
    borderRadius: radius.full,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  checkoutText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 13,
  },
  checkoutArrow: {
    color: colors.textInverse,
    fontWeight: "900",
    fontSize: 15,
  },
});