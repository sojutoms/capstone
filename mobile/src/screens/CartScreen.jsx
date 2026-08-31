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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

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
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
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
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>YOUR CART</Text>
        <Text style={styles.headerCount}>{cart.length} item{cart.length !== 1 ? "s" : ""}</Text>
      </View>

      {/* ── CART LIST ── */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={cart}
        keyExtractor={(item) => `${item.id}_${item.selectedSize}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
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
                          item.quantity >= availableStock && { color: "#444" },
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate("PlaceOrder")}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>PROCEED TO CHECKOUT</Text>
          <Text style={styles.checkoutArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  // ── EMPTY STATE ──
  emptyContainer: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 20,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 36,
  },
  shopBtn: {
    borderWidth: 1,
    borderColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 2,
  },
  shopBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 2,
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
    borderBottomColor: "#1e1e1e",
  },
  headerLabel: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
  },
  headerCount: {
    color: "#666",
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 2,
  },

  // ── LIST ──
  listContent: {
    padding: 16,
    paddingBottom: 240,
  },
  separator: {
    height: 1,
    backgroundColor: "#1a1a1a",
    marginVertical: 4,
  },

  // ── CARD ──
  card: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 4,
    padding: 14,
    gap: 14,
  },
  imageWrapper: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
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
    color: "#fff",
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
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sizeBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  sizeText: {
    color: "#888",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  priceText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  lowStockText: {
    color: "#ff4444",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  outOfStockText: {
    color: "#ff4444",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
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
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
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
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  qtyValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "center",
  },

  // ── REMOVE ──
  removeBtn: {
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
  },
  removeBtnText: {
    color: "#888",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  // ── SUMMARY ──
  summaryContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111",
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
  },
  summaryTitle: {
    color: "#444",
    fontSize: 10,
    fontWeight: "800",
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
    color: "#888",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "700",
  },
  freeBadge: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 2,
  },
  freeBadgeText: {
    color: "#4caf50",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e1e1e",
    marginVertical: 12,
  },
  totalLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
  },
  totalValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // ── CHECKOUT ──
  checkoutBtn: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 2,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  checkoutText: {
    color: "#0a0a0a",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2.5,
  },
  checkoutArrow: {
    color: "#0a0a0a",
    fontWeight: "900",
    fontSize: 15,
  },
});