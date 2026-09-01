import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

// Wraps a list/grid item so it fades and rises in on mount, staggered by
// `index` — used for product grids and horizontal card rows so a screen's
// content doesn't just pop in fully-loaded all at once. Delay is capped so
// long lists don't leave the last items waiting a long time to appear.
export default function FadeInItem({ index = 0, style, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const delay = Math.min(index * 45, 360);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
