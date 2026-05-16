import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { useFavorites } from "../context/FavoritesContext";
import { useCart }      from "../context/CartContext";
import Toast            from "react-native-toast-message";

export default function FavoritesScreen({ navigation }) {
  const { favorites, removeFromFavorites, clearFavorites } = useFavorites();
  const { addToCart } = useCart();

  const isOutOfStock = (item) => {
    if (!item.sizes || !Object.keys(item.sizes).length)
      return Number(item.stock || 0) <= 0;
    return Object.values(item.sizes).every((s) => {
      const qty = typeof s === "object" ? s.quantity : Number(s);
      return Number(qty || 0) <= 0;
    });
  };

  const getDisplayPrice = (item) => {
    if (item.sizes && Object.keys(item.sizes).length) {
      const prices = Object.values(item.sizes)
        .map((s) => (typeof s === "object" ? Number(s.price || 0) : Number(s || 0)))
        .filter((p) => p > 0);
      return prices.length ? Math.min(...prices) : Number(item.price || 0);
    }
    return Number(item.price || item.new_price || 0);
  };

  const handleProductPress = (item) => {
    navigation.navigate("Home", {
      screen: "ProductDetail",
      params: { product: item },
    });
  };

  const handleAddToCart = (item) => {
    if (isOutOfStock(item)) {
      Toast.show({ type: "error", text1: "Out of stock" });
      return;
    }
    const sizes = item.sizes ? Object.keys(item.sizes) : [];
    const available = sizes.filter((s) => {
      const d = item.sizes[s];
      return Number((typeof d === "object" ? d.quantity : d) || 0) > 0;
    });
    if (available.length === 1) {
      addToCart(item, available[0]);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    } else if (available.length > 1) {
      Toast.show({ type: "info", text1: "Select a size first" });
      handleProductPress(item);
    } else {
      addToCart(item, null);
      Toast.show({ type: "success", text1: "Added to cart", text2: item.name });
    }
  };

  /* ── Empty state ── */
  if (!favorites.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <View style={styles.emptyWrap}>
          {/* heart icon */}
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyHeart}>♡</Text>
          </View>
          <Text style={styles.emptyTitle}>No saves yet</Text>
          <Text style={styles.emptySub}>
            Tap the heart on any product to save it here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Main ── */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          <Text style={styles.title}>SAVED</Text>
        </View>
        <TouchableOpacity onPress={clearFavorites} style={styles.clearBtn}>
          <Text style={styles.clearText}>CLEAR ALL</Text>
        </TouchableOpacity>
      </View>

      {/* ── COUNT STRIP ── */}
      <View style={styles.countStrip}>
        <View style={styles.countDot} />
        <Text style={styles.countText}>
          {favorites.length} {favorites.length === 1 ? "item" : "items"} saved
        </Text>
      </View>

      {/* ── LIST ── */}
      <FlatList
        data={favorites}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const price      = getDisplayPrice(item);
          const outOfStock = isOutOfStock(item);
          const hasSizes   = item.sizes && Object.keys(item.sizes).length > 0;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleProductPress(item)}
              activeOpacity={0.88}
            >
              {/* index number */}
              <Text style={styles.cardIndex}>
                {String(index + 1).padStart(2, "0")}
              </Text>

              {/* product image */}
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>

              {/* info */}
              <View style={styles.info}>
                <Text style={styles.brand} numberOfLines={1}>
                  {(item.category || item.brand || "").toUpperCase()}
                </Text>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                {outOfStock ? (
                  <Text style={styles.oos}>Out of stock</Text>
                ) : (
                  <Text style={styles.price}>
                    {hasSizes ? "From " : ""}
                    ₱{new Intl.NumberFormat("en-PH").format(price)}
                  </Text>
                )}
              </View>

              {/* actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.cartBtn, outOfStock && styles.cartBtnDim]}
                  disabled={outOfStock}
                  onPress={() => handleAddToCart(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.cartBtnText}>+ BAG</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFromFavorites(item.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}

        /* separator */
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  /* ── header ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#555",
    fontWeight: "400",
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  clearBtn: {
    paddingBottom: 4,
  },
  clearText: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#444",
  },

  /* ── count strip ── */
  countStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  countDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
  },
  countText: {
    fontSize: 10,
    color: "#555",
    letterSpacing: 1,
    fontWeight: "400",
  },

  /* ── list ── */
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  /* ── card ── */
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141414",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },

  cardIndex: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2A2A2A",
    letterSpacing: 1,
    width: 22,
  },

  imageWrap: {
    width: 70,
    height: 70,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  image: {
    width: "90%",
    height: "90%",
  },

  info: {
    flex: 1,
    gap: 3,
  },
  brand: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#555",
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  price: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  oos: {
    fontSize: 11,
    color: "#E53E1A",
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  /* ── action buttons ── */
  actions: {
    alignItems: "center",
    gap: 8,
  },
  cartBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  cartBtnDim: {
    opacity: 0.25,
  },
  cartBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 9,
    letterSpacing: 1.5,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  removeBtnText: {
    color: "#555",
    fontSize: 11,
    fontWeight: "400",
  },

  separator: {
    height: 8,
  },

  /* ── empty ── */
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyHeart: {
    fontSize: 22,
    color: "#333",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  emptySub: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
    lineHeight: 17,
    letterSpacing: 0.5,
  },
});