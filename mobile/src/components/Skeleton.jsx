import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { colors, radius } from "../theme";

// Shimmering placeholder block — pulses opacity in a loop while content
// is still loading, instead of a plain spinner blocking the whole screen.
export default function Skeleton({ width, height, borderRadius = radius.md, style }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.bgSurface, opacity }, style]}
    />
  );
}
