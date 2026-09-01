import React, { useRef, forwardRef } from "react";
import { Animated, TouchableOpacity } from "react-native";

// Shared tactile press feedback — a small scale-down bounce instead of the
// flatter opacity dim that activeOpacity gives on its own. Originally lived
// only in HomeScreen's card grid; pulled out here so buttons/cards across
// the app get the same feel instead of everyone doing their own thing.
//
// Forwards its ref to the underlying TouchableOpacity so callers can
// measureInWindow() it (used by the fly-to-cart animation to find a
// button's on-screen position).
const PressScale = forwardRef(function PressScale(
  { children, style, onPress, disabled, ...touchableProps },
  ref
) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <TouchableOpacity
      ref={ref}
      activeOpacity={1}
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
      onPress={onPress}
      disabled={disabled}
      {...touchableProps}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
});

export default PressScale;
