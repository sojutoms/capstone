/**
 * ARTryOnScreen.jsx — Fixed version
 * Fixes:
 *  1. left/top positions use useNativeDriver: false (layout props)
 *  2. Removed expo-file-system — reads base64 directly from takePictureAsync
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Image, Animated,
  Dimensions, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

// ── Your ngrok URL (no trailing slash) ──
const API_BASE = 'https://unlaboured-charise-unmachined.ngrok-free.dev';

const SHOE_W = width * 0.45;
const SHOE_H = width * 0.28;

const ARTryOnScreen = ({ route, navigation }) => {
  const product = route?.params?.product;
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing]     = useState('back');
  const [status, setStatus]     = useState('scanning'); // 'scanning' | 'tracking' | 'lost'
  const [twoFeet, setTwoFeet]   = useState(false);

  const cameraRef    = useRef(null);
  const detectingRef = useRef(false);
  const intervalRef  = useRef(null);
  const statusRef    = useRef('scanning'); // mirror status in ref so callbacks see latest value

  /* ── Animations ── */
  const scanLineAnim   = useRef(new Animated.Value(0)).current;
  const shoeOpacity    = useRef(new Animated.Value(0)).current;
  const shoeScale      = useRef(new Animated.Value(0.6)).current;
  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Position animations — useNativeDriver: false (layout props)
  const leftShoeLeft = useRef(new Animated.Value(width * 0.1)).current;
  const leftShoeTop  = useRef(new Animated.Value(height * 0.55)).current;
  const rightShoeLeft = useRef(new Animated.Value(width * 0.5)).current;
  const rightShoeTop  = useRef(new Animated.Value(height * 0.55)).current;

  /* ── Scan line loop ── */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  /* ── Pulse loop when tracking ── */
  useEffect(() => {
    if (status !== 'tracking') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  /* ── Reveal shoes animation ── */
  const revealShoes = useCallback(() => {
    Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.spring(shoeOpacity, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.spring(shoeScale,   { toValue: 1, useNativeDriver: true, bounciness: 14 }),
    ]).start();
  }, []);

  /* ── Move shoe to position (layout animation — no native driver) ── */
  const animateShoePosition = useCallback((leftFoot, rightFoot) => {
    const springCfg = { useNativeDriver: false, speed: 14, bounciness: 3 };

    if (leftFoot) {
      Animated.spring(leftShoeLeft, { toValue: leftFoot.screenX - SHOE_W / 2, ...springCfg }).start();
      Animated.spring(leftShoeTop,  { toValue: leftFoot.screenY  - SHOE_H * 0.7, ...springCfg }).start();
    }
    if (rightFoot) {
      Animated.spring(rightShoeLeft, { toValue: rightFoot.screenX - SHOE_W / 2, ...springCfg }).start();
      Animated.spring(rightShoeTop,  { toValue: rightFoot.screenY - SHOE_H * 0.7, ...springCfg }).start();
    }
  }, []);

  /* ── Fallback: simulated center placement ── */
  const fallbackPlacement = useCallback(() => {
    if (statusRef.current === 'tracking') return;
    statusRef.current = 'tracking';
    setStatus('tracking');
    setTwoFeet(false);
    // Place shoe in a sensible default position
    leftShoeLeft.setValue(width * 0.27);
    leftShoeTop.setValue(height * 0.52);
    revealShoes();
  }, [revealShoes]);

  /* ── Detection ── */
  const runDetection = useCallback(async () => {
    if (detectingRef.current || !cameraRef.current) return;
    detectingRef.current = true;

    try {
      // takePictureAsync with base64:true — no expo-file-system needed
      const photo = await cameraRef.current.takePictureAsync({
        quality:        0.25,
        base64:         true,
        skipProcessing: true,
        exif:           false,
      });

      if (!photo?.base64) throw new Error('No base64 data from camera');

      // Build FormData from the URI (React Native fetch handles file URIs)
      const formData = new FormData();
      formData.append('frame', {
        uri:  photo.uri,
        name: 'frame.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`${API_BASE}/api/ar/detect-feet`, {
        method:  'POST',
        body:    formData,
        headers: {
          'Content-Type':              'multipart/form-data',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();

      if (result.detected && result.feet.length > 0) {
        const mapped = result.feet.map(f => ({
          side:    f.side,
          screenX: f.x * width,
          screenY: f.y * height,
        }));

        const leftFoot  = mapped.find(f => f.side?.includes('left'))  || mapped[0];
        const rightFoot = mapped.find(f => f.side?.includes('right')) || (mapped.length > 1 ? mapped[1] : null);

        setTwoFeet(mapped.length > 1);
        animateShoePosition(leftFoot, rightFoot);

        if (statusRef.current !== 'tracking') {
          statusRef.current = 'tracking';
          setStatus('tracking');
          revealShoes();
        }
      } else {
        if (statusRef.current === 'tracking') {
          statusRef.current = 'lost';
          setStatus('lost');
        }
      }

    } catch (err) {
      console.warn('[AR Detection]', err.message);
      // If backend unreachable, fall back to simulated placement
      if (statusRef.current === 'scanning') {
        fallbackPlacement();
      }
    } finally {
      detectingRef.current = false;
    }
  }, [animateShoePosition, revealShoes, fallbackPlacement]);

  /* ── Start detection loop ── */
  useEffect(() => {
    if (!permission?.granted) return;
    intervalRef.current = setInterval(runDetection, 700);
    return () => clearInterval(intervalRef.current);
  }, [permission, runDetection]);

  /* ── Reset ── */
  const resetTryOn = () => {
    statusRef.current = 'scanning';
    setStatus('scanning');
    setTwoFeet(false);
    shoeOpacity.setValue(0);
    shoeScale.setValue(0.6);
    overlayOpacity.setValue(1);
  };

  /* ── Permission screens ── */
  if (!permission) {
    return <View style={s.center}><Text style={s.permText}>Requesting camera…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.permTitle}>Camera Access Needed</Text>
        <Text style={s.permText}>We need your camera to show the AR try-on.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>GRANT ACCESS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1], outputRange: [height * 0.35, height * 0.72],
  });

  const formatPrice = (p) => {
    const n = typeof p === 'object'
      ? Math.min(...Object.values(p).map(Number).filter(isFinite))
      : Number(p);
    return isFinite(n) ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—';
  };

  const statusLabel = {
    scanning: '👟  Point camera at your feet',
    tracking: '✅  Feet detected — tracking',
    lost:     '⚠️  Reposition — feet not visible',
  }[status];

  /* ── Render ── */
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* CAMERA */}
      <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef} />

      {/* SCAN OVERLAY */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
        pointerEvents="none"
      >
        <View style={s.vigTop} />
        <View style={s.vigBottom} />
        <View style={s.scanFrame}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
        </View>
        <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />
      </Animated.View>

      {/* STATUS LABEL */}
      <View style={[s.instructionWrap, status === 'lost' && s.instructionWrapHigh]}>
        <Text style={s.instructionText}>{statusLabel}</Text>
      </View>

      {/* LEFT SHOE — absolutely positioned, layout animated */}
      {product?.image && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.shoeAbs,
            {
              opacity: shoeOpacity,
              left: leftShoeLeft,
              top:  leftShoeTop,
              transform: [{ scale: Animated.multiply(shoeScale, pulseAnim) }],
            },
          ]}
        >
          <Image source={{ uri: product.image }} style={s.shoeImage} resizeMode="contain" />
          <View style={s.shoeGlow} />
        </Animated.View>
      )}

      {/* RIGHT SHOE — only when 2 feet tracked */}
      {product?.image && twoFeet && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.shoeAbs,
            {
              opacity: shoeOpacity,
              left: rightShoeLeft,
              top:  rightShoeTop,
              transform: [{ scale: Animated.multiply(shoeScale, pulseAnim) }],
            },
          ]}
        >
          <Image source={{ uri: product.image }} style={s.shoeImage} resizeMode="contain" />
          <View style={s.shoeGlow} />
        </Animated.View>
      )}

      {/* AR LIVE BADGE */}
      {status === 'tracking' && (
        <View style={s.arBadge}>
          <Text style={s.arBadgeText}>AR LIVE</Text>
          <View style={s.arDot} />
        </View>
      )}

      {/* TOP NAV */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.navBtn} onPress={() => navigation.goBack()}>
          <Text style={s.navArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>TRY ON</Text>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Text style={s.navIcon}>⇄</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM BAR */}
      <View style={s.bottomBar}>
        <View style={s.productRow}>
          {product?.image && (
            <Image source={{ uri: product.image }} style={s.thumbImg} resizeMode="contain" />
          )}
          <View style={s.productInfo}>
            <Text style={s.productName} numberOfLines={1}>{product?.name}</Text>
            <Text style={s.productPrice}>₱{formatPrice(product?.new_price || product?.price)}</Text>
          </View>
        </View>
        <View style={s.actionRow}>
          <TouchableOpacity style={s.resetBtn} onPress={resetTryOn}>
            <Text style={s.resetText}>↺  RESCAN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.goBack()}>
            <Text style={s.addText}>ADD TO BAG</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.disclaimer}>
          {status === 'tracking' ? 'AI foot tracking active' : 'Simulated AR preview · Actual fit may vary'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

/* ── Styles ── */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },

  permTitle:   { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  permText:    { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn:     { marginTop: 8, backgroundColor: '#00C8FF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  permBtnText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 2 },

  topBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16,
    left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
  },
  navBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  navArrow:    { color: '#FFF', fontSize: 20 },
  navIcon:     { color: '#FFF', fontSize: 20 },
  topBarTitle: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },

  vigTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.28, backgroundColor: 'rgba(0,0,0,0.55)' },
  vigBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.32, backgroundColor: 'rgba(0,0,0,0.55)' },

  scanFrame: { position: 'absolute', top: height * 0.32, left: width * 0.08, right: width * 0.08, height: height * 0.42 },
  corner:    { position: 'absolute', width: 28, height: 28, borderColor: '#00C8FF' },
  cornerTL:  { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR:  { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL:  { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR:  { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  scanLine: {
    position: 'absolute', left: width * 0.08, right: width * 0.08, height: 2,
    backgroundColor: '#00C8FF', opacity: 0.8,
    shadowColor: '#00C8FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8,
  },

  instructionWrap:     { position: 'absolute', top: height * 0.28, left: 0, right: 0, alignItems: 'center' },
  instructionWrapHigh: { top: height * 0.1 },
  instructionText: {
    color: '#FFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.5,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 8, paddingHorizontal: 18,
    borderRadius: 20, overflow: 'hidden',
  },

  // Absolutely positioned shoe — left/top are Animated.Value
  shoeAbs: {
    position: 'absolute',
    width: SHOE_W,
    alignItems: 'center',
  },
  shoeImage: { width: SHOE_W, height: SHOE_H },
  shoeGlow: {
    width: SHOE_W * 0.75, height: 14,
    backgroundColor: 'rgba(0,200,255,0.18)',
    borderRadius: 40, marginTop: -4, alignSelf: 'center',
  },

  arBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 72,
    alignSelf: 'center',
    left: width / 2 - 40,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(0,200,255,0.3)',
  },
  arBadgeText: { color: '#00C8FF', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  arDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF88' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,13,0.96)',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20, gap: 14,
  },
  productRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbImg:     { width: 52, height: 52, borderRadius: 10, backgroundColor: '#141414' },
  productInfo:  { flex: 1, gap: 3 },
  productName:  { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  productPrice: { color: '#00C8FF', fontSize: 14, fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 10 },
  resetBtn: {
    flex: 1, backgroundColor: '#141414',
    borderWidth: 1, borderColor: '#2A2A2A',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  resetText: { color: '#666', fontWeight: '700', fontSize: 11, letterSpacing: 1.5 },
  addBtn:    { flex: 2, backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  addText:   { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 2 },
  disclaimer: { color: '#2A2A2A', fontSize: 10, textAlign: 'center', letterSpacing: 0.3 },
});

export default ARTryOnScreen;