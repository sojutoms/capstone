import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { fonts, radius, typography } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';

const BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000'
    : 'https://lifting-manpower-corral.ngrok-free.dev';

// Real foot-tracked AR via DeepAR's Web SDK, loaded in a WebView — ported
// from testing/shoetryon-web-js (a working DeepAR demo) and served as
// static files from the backend (see backend/public/artryon). DeepAR has
// no official React Native SDK, and the one community wrapper
// (react-native-deepar) only supports face tracking, not feet — so rather
// than build a native module from scratch for both platforms, this reuses
// the proven-working web implementation inside a WebView. Works identically
// on Android and iOS with the same code.
const ARTryOnScreen = ({ route, navigation }) => {
  const product = route?.params?.product;
  const selectedSize = route?.params?.selectedSize;
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { addToCart } = useCart();

  const [permission, requestPermission] = useCameraPermissions();
  const [arReady, setArReady] = useState(false);
  const [arError, setArError] = useState(null);

  const formatPrice = (p) => {
    const n = typeof p === 'object' ? Math.min(...Object.values(p).map(Number).filter(isFinite)) : Number(p);
    return isFinite(n) ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—';
  };

  // Same "select a size first" gate as Product Details — if the user
  // opened Try On without picking one there, bounce them back to pick one
  // instead of adding a sizeless item.
  const handleAddToCart = () => {
    if (!selectedSize && product?.sizes) {
      Toast.show({ type: 'error', text1: 'Select a size first' });
      navigation.goBack();
      return;
    }
    addToCart(product, selectedSize);
    Toast.show({ type: 'success', text1: 'Added to cart', text2: product?.name });
  };

  // Per-shoe .deepar effects haven't been exported from DeepAR Studio yet for
  // individual products, so every product uses the same demo shoe effect for
  // now. Once real per-product effects exist (e.g. stored as
  // product.model3d.deeparEffect), swap this to reference that instead.
  const effectFile = product?.model3d?.deeparEffect || 'Shoe_PBR.deepar';
  const arUrl = `${BASE_URL}/artryon/index.html?effect=${encodeURIComponent(effectFile)}`;

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'effectLoaded') setArReady(true);
      if (data.type === 'error') setArError(data.message);
    } catch {}
  }, []);

  /* ── permission states ──
     Requested here (not just left to the WebView) because Android's
     WebView camera permission prompt only auto-grants when the app itself
     already holds the native CAMERA permission. */
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

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    // Plain View, not SafeAreaView — SafeAreaView pads in the safe-area
    // insets as real layout space, which shrank the WebView below it and
    // left a dead black strip above the camera feed. The camera should run
    // edge-to-edge; only the back button below is nudged down manually to
    // clear the status bar / notch.
    <View style={s.safe}>
      {/* Transparent + translucent so the camera reaches the true top edge
          of the screen instead of leaving a solid status-bar-colored band
          above it. */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── REAL FOOT-TRACKED AR ── */}
      <WebView
        source={{ uri: arUrl }}
        style={StyleSheet.absoluteFill}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // iOS-only (15+): grants the page's getUserMedia request instead of
        // prompting the user again on top of our own permission screen.
        // Android needs no equivalent prop — react-native-webview's native
        // WebChromeClient already auto-grants a WebView camera request
        // whenever the app itself already holds the CAMERA runtime
        // permission, which useCameraPermissions() above guarantees.
        mediaCapturePermissionGrantType="grant"
        originWhitelist={['*']}
      />

      {!arReady && !arError && (
        <View style={s.loadingOverlay} pointerEvents="none">
          <Ionicons name="footsteps-outline" size={36} color="#fff" style={s.loadingIcon} />
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.loadingText}>Loading AR…</Text>
        </View>
      )}

      {arError && (
        <View style={s.loadingOverlay}>
          <Text style={s.permTitle}>AR failed to load</Text>
          <Text style={s.permText}>{arError}</Text>
        </View>
      )}

      {/* ── TOP LABEL ──
          Back button dropped — the BACK button in the bottom card already
          covers navigation, so this is just a floating pill label now. */}
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>TRY ON</Text>
      </View>

      {/* ── BOTTOM PRODUCT BAR ── */}
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
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>BACK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={handleAddToCart}>
            <Text style={s.addText}>ADD TO CART</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/* ══════════════════════════════════════
   STYLES
══════════════════════════════════════ */
const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },

  /* ── permission / loading ── */
  permTitle:   { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.display, letterSpacing: 1 },
  permText:    { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn:     { marginTop: 8, backgroundColor: colors.accentGold, paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.lg },
  permBtnText: { ...typography.button, color: colors.textInverse, fontSize: 12 },

  loadingOverlay: {
    // Bounded above the bottom product card instead of the full screen —
    // centering across the whole height (card included) made it sit
    // visibly higher than the actual middle of the visible camera area.
    position: 'absolute',
    top: 0, left: 0, right: 0,
    bottom: Platform.OS === 'ios' ? 190 : 170,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingIcon: { opacity: 0.9 },
  loadingText: { color: '#fff', fontSize: 13, letterSpacing: 0.5 },

  /* ── top label ──
     Fixed light-grey/dark-text below, not theme colors — a small floating
     pill over the live camera feed, like a native camera app's mode label,
     regardless of the app's own light/dark mode setting. */
  topBar: {
    position: 'absolute',
    // Now that the status bar is translucent (see the <StatusBar> above),
    // this sits directly under the real system clock/battery icons unless
    // we push it down by that reserved height ourselves.
    top: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 26,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: 'rgba(220,220,220,0.55)',
  },
  topBarTitle: { color: '#222', fontSize: 11, fontFamily: fonts.display, fontWeight: 'bold', letterSpacing: 1.5, textAlign: 'center' },

  /* ── bottom bar ──
     A rounded white card floating over the camera feed (like the order
     summary card elsewhere in the app), not the flat dark strip it was —
     black/white/gray only, no gold accent, to keep the palette minimal. */
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbImg: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: '#f2f2f2',
  },
  productInfo: { flex: 1, gap: 3 },
  productName:  { color: '#111', fontSize: 15, fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
  productPrice: { color: '#111', fontSize: 14, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  backText: { ...typography.button, color: '#fff', fontSize: 12 },
  addBtn: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  addText: { ...typography.button, color: '#fff', fontSize: 12 },
});

export default ARTryOnScreen;
