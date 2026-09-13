import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Text, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Every this-many px of horizontal drag advances one frame. Higher means
// fewer distinct frame swaps for the same drag distance — each swap forces
// a native image-source change, so raising this from 8 cuts down on how
// often that happens during a fast swipe, which is what read as "glitching".
const PX_PER_FRAME = 16;

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
  const [ready, setReady] = useState(false);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const startIndexRef = useRef(0);
  const frameCount = frames.length;

  // PanResponder is memoized (recreated only when interacted/ready/frameCount
  // change) so its callbacks close over a stale `index` from whenever it was
  // last built — reading indexRef.current instead keeps every touch-start
  // anchored to wherever the shoe actually is right now.
  const indexRef = useRef(0);
  indexRef.current = index;

  // Scrub bar: measured in absolute screen coordinates (not just local
  // width) so dragging past the bar's own edges still tracks correctly,
  // same approach a custom RN slider normally needs.
  const trackRef = useRef(null);
  const trackLayoutRef = useRef({ x: 0, width: 1 });
  const seekToAbsoluteX = (absoluteX) => {
    const { x, width: trackW } = trackLayoutRef.current;
    const frac = Math.min(1, Math.max(0, (absoluteX - x) / (trackW || 1)));
    setIndex(Math.round(frac * (frameCount - 1)));
  };
  const trackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, g) => seekToAbsoluteX(g.x0),
        onPanResponderMove: (_, g) => seekToAbsoluteX(g.moveX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameCount]
  );

  // Wait for every frame to actually be cached before allowing drag — letting
  // the user spin while frames are still loading in the background is what
  // caused the flicker/glitch (fast swipes landing on not-yet-fetched frames).
  useEffect(() => {
    setReady(false);
    ExpoImage.prefetch(frames, { cachePolicy: 'memory-disk' })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [frames]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => ready && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          startIndexRef.current = indexRef.current;
          if (!interacted) {
            setInteracted(true);
            Animated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
          }
        },
        onPanResponderMove: (_, g) => {
          // Dragging right advances the index (+delta), matching the scrub
          // bar's own left=0/right=max convention — they used to move in
          // opposite directions from each other.
          // Clamped, not wrapped — looping from the last frame straight
          // back to the first (or vice versa) snapped the scrub dot across
          // the whole bar instantly, which read as broken/confusing.
          const delta = Math.round(g.dx / PX_PER_FRAME);
          const next = Math.min(frameCount - 1, Math.max(0, startIndexRef.current + delta));
          setIndex(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameCount, interacted, ready]
  );

  if (!frameCount) return null;

  return (
    <View style={[s.wrap, height ? { height } : null]} {...panResponder.panHandlers}>
      {/* expo-image instead of RN's Image — it caches every frame in
          memory (not just disk) via cachePolicy, and transition={0} skips
          the fade-in RN's Image applies to every new source by default.
          Rapid swaps during a fast drag were retriggering that fade
          repeatedly, which is what actually read as "glitching". */}
      <ExpoImage
        source={frames[index]}
        style={s.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
      />

      {!ready && (
        <View style={s.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.accentGold} />
        </View>
      )}

      <View style={s.badge}>
        <Text style={s.badgeText}>360°</Text>
      </View>

      {/* Rotation assist bar, StockX-style — a full-width scrub track with a
          filled segment behind the dot, always visible unlike the hint
          below which fades after the first drag. Now actually interactive:
          the taller wrapper (not just the thin 3px visual bar) is the real
          touch target, and tapping/dragging anywhere on it jumps straight
          to that frame — measured in absolute coordinates via trackRef so
          it tracks correctly even once the finger moves past the bar's own
          edges. */}
      <View
        ref={trackRef}
        style={s.progressHitArea}
        onLayout={() => {
          trackRef.current?.measure((fx, fy, w, h, px) => {
            trackLayoutRef.current = { x: px, width: w };
          });
        }}
        {...trackPanResponder.panHandlers}
      >
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(index / (frameCount - 1)) * 100}%` }]} />
          <View style={[s.progressDot, { left: `${(index / (frameCount - 1)) * 100}%` }]} />
        </View>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
  // The real touch target — much taller than the thin bar itself so it's
  // actually easy to tap/drag, with the visual bar just centered inside it.
  progressHitArea: {
    position: 'absolute',
    bottom: 44,
    left: 24,
    right: 24,
    height: 32,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'visible',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentGold,
  },
  progressDot: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    marginLeft: -5.5,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: '#fff',
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
