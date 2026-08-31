import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

const ARTryOnScreen = ({ route, navigation }) => {
  const product = route?.params?.product;
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing]             = useState('back');
  const [scanning, setScanning]         = useState(true);
  const [placed, setPlaced]             = useState(false);

  /* ── animations ── */
  const scanLineAnim  = useRef(new Animated.Value(0)).current;
  const shoeOpacity   = useRef(new Animated.Value(0)).current;
  const shoeScale     = useRef(new Animated.Value(0.6)).current;
  const shoeY         = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  /* ── scan line loop ── */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1, duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0, duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    /* auto-place after 3 seconds for demo feel */
    const timer = setTimeout(() => placeshoe(), 3000);
    return () => { loop.stop(); clearTimeout(timer); };
  }, []);

  /* ── pulse loop for placed shoe ── */
  useEffect(() => {
    if (!placed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [placed]);

  /* ── float loop for placed shoe ── */
  useEffect(() => {
    if (!placed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shoeY, { toValue: -8, duration: 1200, useNativeDriver: true }),
        Animated.timing(shoeY, { toValue:  8, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [placed]);

  const placeshoe = () => {
    setScanning(false);
    setPlaced(true);

    /* fade out scan overlay */
    Animated.timing(overlayOpacity, {
      toValue: 0, duration: 400, useNativeDriver: true,
    }).start();

    /* pop shoe in */
    Animated.parallel([
      Animated.spring(shoeOpacity, { toValue: 1,   useNativeDriver: true, bounciness: 12 }),
      Animated.spring(shoeScale,   { toValue: 1,   useNativeDriver: true, bounciness: 14 }),
    ]).start();
  };

  const resetTryOn = () => {
    setPlaced(false);
    setScanning(true);
    shoeOpacity.setValue(0);
    shoeScale.setValue(0.6);
    overlayOpacity.setValue(1);
    setTimeout(() => placeshoe(), 2500);
  };

  /* ── permission states ── */
  if (!permission) {
    return (
      <View style={s.center}>
        <Text style={s.permText}>Requesting camera…</Text>
      </View>
    );
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

  /* ── derived ── */
  const scanLineY = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [height * 0.35, height * 0.72],
  });

  const formatPrice = (p) => {
    const n = typeof p === 'object' ? Math.min(...Object.values(p).map(Number).filter(isFinite)) : Number(p);
    return isFinite(n) ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—';
  };

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── CAMERA ── */}
      <CameraView style={StyleSheet.absoluteFill} facing={facing} />

      {/* ── SCAN OVERLAY (fades out after placement) ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">

        {/* dark vignette edges */}
        <View style={s.vigTop} />
        <View style={s.vigBottom} />

        {/* scan frame */}
        <View style={s.scanFrame}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
        </View>

        {/* animated scan line */}
        <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />

        {/* instruction */}
        <View style={s.instructionWrap}>
          <Text style={s.instructionText}>👟  Point camera at your feet</Text>
        </View>
      </Animated.View>

      {/* ── SHOE OVERLAY (appears after scan) ── */}
      {product.image && (
        <Animated.View
          style={[
            s.shoeOverlay,
            {
              opacity: shoeOpacity,
              transform: [
                { scale: Animated.multiply(shoeScale, pulseAnim) },
                { translateY: shoeY },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: product.image }}
            style={s.shoeImage}
            resizeMode="contain"
          />

          {/* glow under shoe */}
          <View style={s.shoeGlow} />

          {/* AR badge */}
          <View style={s.arBadge}>
            <Text style={s.arBadgeText}>AR LIVE</Text>
            <View style={s.arDot} />
          </View>
        </Animated.View>
      )}

      {/* ── TOP NAV ── */}
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

      {/* ── BOTTOM PRODUCT BAR ── */}
      <View style={s.bottomBar}>

        {/* product info */}
        <View style={s.productRow}>
          {product.image && (
            <Image source={{ uri: product.image }} style={s.thumbImg} resizeMode="contain" />
          )}
          <View style={s.productInfo}>
            <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
            <Text style={s.productPrice}>₱{formatPrice(product.new_price || product.price)}</Text>
          </View>
        </View>

        {/* action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.resetBtn} onPress={resetTryOn}>
            <Text style={s.resetText}>↺  RESCAN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.addText}>ADD TO BAG</Text>
          </TouchableOpacity>
        </View>

        {/* disclaimer */}
        <Text style={s.disclaimer}>
          Simulated AR preview · Actual fit may vary
        </Text>
      </View>
    </SafeAreaView>
  );
};

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },

  /* ── permission ── */
  permTitle:   { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  permText:    { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn:     { marginTop: 8, backgroundColor: '#00C8FF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  permBtnText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 2 },

  /* ── top bar ── */
  topBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16,
    left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
  },
  navBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  navArrow:    { color: '#FFF', fontSize: 20 },
  navIcon:     { color: '#FFF', fontSize: 20 },
  topBarTitle: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },

  /* ── vignette ── */
  vigTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: height * 0.28,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  vigBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: height * 0.32,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  /* ── scan frame ── */
  scanFrame: {
    position: 'absolute',
    top: height * 0.32,
    left: width * 0.08,
    right: width * 0.08,
    height: height * 0.42,
  },
  corner: {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#00C8FF',
  },
  cornerTL: { top: 0, left: 0,  borderTopWidth: 3,    borderLeftWidth: 3  },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3,    borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3  },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  /* ── scan line ── */
  scanLine: {
    position: 'absolute',
    left: width * 0.08,
    right: width * 0.08,
    height: 2,
    backgroundColor: '#00C8FF',
    opacity: 0.8,
    shadowColor: '#00C8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },

  /* ── instruction ── */
  instructionWrap: {
    position: 'absolute',
    top: height * 0.28,
    left: 0, right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: 'hidden',
  },

  /* ── shoe overlay ── */
  shoeOverlay: {
    position: 'absolute',
    bottom: height * 0.28,
    left: 0, right: 0,
    alignItems: 'center',
  },
  shoeImage: {
    width: width * 0.75,
    height: width * 0.45,
  },
  shoeGlow: {
    width: width * 0.55,
    height: 18,
    backgroundColor: 'rgba(0,200,255,0.18)',
    borderRadius: 40,
    marginTop: -6,
    alignSelf: 'center',
  },
  arBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,200,255,0.3)',
  },
  arBadgeText: { color: '#00C8FF', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  arDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF88' },

  /* ── bottom bar ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,13,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbImg: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#141414',
  },
  productInfo: { flex: 1, gap: 3 },
  productName:  { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  productPrice: { color: '#00C8FF', fontSize: 14, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetText: { color: '#666', fontWeight: '700', fontSize: 11, letterSpacing: 1.5 },
  addBtn: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 2 },

  disclaimer: {
    color: '#2A2A2A',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});

export default ARTryOnScreen;