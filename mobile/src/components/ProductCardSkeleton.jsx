import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useProductCardWidth } from "../utils/responsive";

// Placeholder matching ProductCard's own dimensions, so swapping between
// the two while products load doesn't jump the layout around.
export default function ProductCardSkeleton() {
  const { colors } = useTheme();
  const { cardWidth } = useProductCardWidth();
  const styles = useMemo(() => makeStyles(colors, cardWidth), [colors, cardWidth]);
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={cardWidth} borderRadius={0} />
      <View style={styles.body}>
        <Skeleton width={54} height={8} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width="65%" height={13} style={{ marginBottom: 12 }} />
        <Skeleton width={50} height={13} />
      </View>
    </View>
  );
}

const makeStyles = (colors, cardWidth) => StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
  body: { padding: 10 },
});
