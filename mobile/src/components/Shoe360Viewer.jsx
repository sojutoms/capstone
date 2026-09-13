import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Image, StyleSheet, PanResponder, Text, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Every this-many px of horizontal drag advances one frame — tuned so a full
// swipe across the screen roughly spins the shoe all the way around once.
const PX_PER_FRAME = 8;

/**
 * StockX-style 360° product viewer: drag left/right to spin through a
 * pre-rendered turntable frame sequence. `frames` must be an ordered array
 * of image URLs spanning a full rotation.
 */
const Shoe360Viewer = ({ frames, height }) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const startIndexRef = useRef(0);
  const frameCount = frames.length;

  useEffect(() => {
    frames.forEach((uri) => Image.prefetch(uri).catch(() => {}));
  }, [frames]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          startIndexRef.current = index;
          if (!interacted) {
            setInteracted(true);
            Animated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
          }
        },
        onPanResponderMove: (_, g) => {
          const delta = Math.round(g.dx / PX_PER_FRAME);
          let next = (startIndexRef.current - delta) % frameCount;
          if (next < 0) next += frameCount;
          setIndex(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameCount, interacted]
  );

  if (!frameCount) return null;

  return (
    <View style={[s.wrap, height ? { height } : null]} {...panResponder.panHandlers}>
      <Image source={{ uri: frames[index] }} style={s.image} resizeMode="contain" />

      <View style={s.badge}>
        <Text style={s.badgeText}>360°</Text>
      </View>

      <Animated.View style={[s.hint, { opacity: hintOpacity }]} pointerEvents="none">
        <Text style={s.hintText}>↔ DRAG TO SPIN</Text>
      </Animated.View>
    </View>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  wrap: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  image: {
    width: '80%',
    height: '75%',
  },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: {
    color: colors.accentGold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  hint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  hintText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default Shoe360Viewer;
