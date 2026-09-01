import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors, fonts, radius, typography } from "../theme";
import { toNumber, getLowestPrice, getBadge } from "../utils/productHelpers";
import PressScale from "./PressScale";
import { triggerFlyToCart } from "../utils/flyToCartBus";

const { width } = Dimensions.get("window");
export const PRODUCT_CARD_WIDTH = (width - 48) / 2;

// The one product card used everywhere a product grid/row shows up (Home's
// Trending/Just Dropped rows, and all four category grids) — previously
// four near-identical copies that had quietly drifted apart (Home's cards
// had no working heart/add-to-cart at all). One component now, so a style
// or behavior fix lands everywhere at once.
export default function ProductCard({ item, index = 0, onPress, onAddToCart, favorited, onToggleFavorite }) {
  const price       = getLowestPrice(item);
  const hasMultiple = item.sizes && Object.keys(item.sizes).length > 1;
  const badge       = getBadge(item, index);
  const comingSoon  = !price;

  return (
    <PressScale style={[styles.card, comingSoon && styles.cardComingSoon]} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        {badge && !comingSoon && (
          <View style={[styles.badge, styles[`badge_${badge.style}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${badge.style}`]]}>
              {badge.label}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => onToggleFavorite(item)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={[styles.heartIcon, favorited && styles.heartIconActive]}>
            {favorited ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="contain" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardBrand} numberOfLines={1}>
          {(item.brand || item.category || "").toUpperCase()}
        </Text>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.cardFooter}>
          <View>
            {item.old_price && (
              <Text style={styles.oldPrice}>
                ₱{toNumber(item.old_price)?.toLocaleString("en-PH")}
              </Text>
            )}
            {comingSoon ? (
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            ) : (
              <Text style={styles.newPrice}>
                {hasMultiple ? "From " : ""}₱{price.toLocaleString("en-PH")}
              </Text>
            )}
          </View>
          {!comingSoon && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={(e) => {
                triggerFlyToCart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, width: 0, height: 0 });
                onAddToCart(item);
              }}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Feather name="shopping-bag" size={14} color={colors.textInverse} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PRODUCT_CARD_WIDTH,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
  cardComingSoon: { opacity: 0.55 },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.bgSurface,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cardImage: { width: "80%", height: "80%" },
  heartBtn: {
    position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
  },
  heartIcon: { color: colors.textPrimary, fontSize: 12 },
  heartIconActive: { color: colors.danger },

  badge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, zIndex: 1 },
  badge_new: { backgroundColor: colors.textPrimary },
  badge_hot: { backgroundColor: "#E53E1A" },
  badge_sale: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderLight },
  badgeText: { fontSize: 7, fontWeight: "700", letterSpacing: 1.5 },
  badgeText_new: { color: colors.textInverse },
  badgeText_hot: { color: colors.textPrimary },
  badgeText_sale: { color: colors.textMuted },

  cardBody: { padding: 10 },
  cardBrand: { fontSize: 8, fontFamily: fonts.bodySemibold, letterSpacing: 2, color: colors.textTertiary, marginBottom: 3 },
  cardName: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textPrimary, lineHeight: 18, marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  oldPrice: { fontSize: 10, color: colors.textMuted, textDecorationLine: "line-through", marginBottom: 1 },
  newPrice: { fontSize: 13, fontWeight: "700", color: colors.accentGold },
  comingSoonText: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.bodyMedium, letterSpacing: 0.3 },
  addBtn: { width: 28, height: 28, backgroundColor: colors.textPrimary, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});
