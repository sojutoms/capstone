import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Dimensions, Platform } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors, radius, shadows } from "../theme";
import { onFlyToCart } from "../utils/flyToCartBus";

// Approximates where the Cart tab icon sits in the floating pill nav
// (see MainTabs.jsx's layout: bar padding + pill padding/border, four
// flex tabs split around the fixed-width center spacer, Cart is the
// third flex slot). Doesn't need to be pixel-perfect — the animation
// ends with a shrink+fade "absorb" into the icon, not a hard landing.
function getCartTargetPoint() {
  const { width, height } = Dimensions.get("window");
  const barPadH = 16;
  const pillPadH = 10;
  const border = 1;
  const centerSpacer = 64;
  const innerLeft = barPadH + pillPadH + border;
  const innerW = width - 2 * (barPadH + pillPadH + border);
  const tabW = (innerW - centerSpacer) / 4;
  const cartCenterX = innerLeft + 2 * tabW + centerSpacer + tabW / 2;

  const barPadTop = 10;
  const pillHeight = 60;
  const barPadBottom = Platform.OS === "ios" ? 30 : 14;
  const barHeight = barPadTop + pillHeight + barPadBottom;
  const cartCenterY = height - barHeight + barPadTop + pillHeight / 2;

  return { x: cartCenterX, y: cartCenterY };
}

export default function FlyToCartOverlay() {
  const [flight, setFlight] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return onFlyToCart((origin) => {
      const target = getCartTargetPoint();
      setFlight({ origin, target });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }).start(() => setFlight(null));
    });
  }, []);

  if (!flight) return null;

  const { origin, target } = flight;
  const startX = origin.x + origin.width / 2 - 14;
  const startY = origin.y + origin.height / 2 - 14;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, target.x - 14],
  });
  // A slight upward arc partway through, then down into the tab —
  // a straight line reads as robotic, a small arc reads as "tossed."
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [startY, startY - 60, target.y - 14],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0.6, 1, 1, 0.3],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        {
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <Feather name="shopping-cart" size={14} color={colors.textInverse} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.accentGold,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    ...shadows.sm,
  },
});
