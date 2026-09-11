import React from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { colors, radius } from "../theme";
import { PRODUCT_CARD_WIDTH } from "./ProductCard";

// Placeholder matching ProductCard's own dimensions, so swapping between
// the two while products load doesn't jump the layout around.
export default function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={PRODUCT_CARD_WIDTH} borderRadius={0} />
      <View style={styles.body}>
        <Skeleton width={54} height={8} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width="65%" height={13} style={{ marginBottom: 12 }} />
        <Skeleton width={50} height={13} />
      </View>
    </View>
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
  body: { padding: 10 },
});
