import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";

import HomeStack from "./HomeStack";
import CartStack from "./CartStack";
import CameraScreen from "../screens/CameraScreen";
import ProfileStack from "./ProfileStack";

import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { useAuth } from "../context/AuthContext";
import ShopStack from "./ShopStack";
import { colors, radius, shadows, typography } from "../theme";
import { TAB_BAR_CLEARANCE } from "./tabBarMetrics";

const Tab = createBottomTabNavigator();

/* ══════════════════════════════════════
   TAB CONFIG

   Outline glyph when inactive, filled/solid glyph when active — the same
   shape-change iOS/Netflix use for their tab bars, not just a color swap.
══════════════════════════════════════ */

const TABS = [
  { name: "Home", label: "Home", iconOutline: "home-outline", iconFilled: "home", component: HomeStack },
  { name: "Shop", label: "Shop", iconOutline: "bag-outline", iconFilled: "bag", component: ShopStack },
  { name: "Camera", label: "Try-On", iconOutline: "camera-outline", iconFilled: "camera", component: CameraScreen },
  { name: "Cart", label: "Bag", iconOutline: "cart-outline", iconFilled: "cart", component: CartStack },
  { name: "Profile", label: "Profile", iconOutline: "person-outline", iconFilled: "person", component: ProfileStack, isProfile: true },
];

/* ══════════════════════════════════════ */

const Badge = ({ count }) =>
  count > 0 ? (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  ) : null;

/* ══════════════════════════════════════
   FLOATING GLASS PILL NAV (Netflix-quality shading)

   Detached from the screen edges with a shadow underneath — reads as a
   distinct floating surface, not a seam glued to the bottom edge. The
   translucent fill is tuned close to the app's actual background color so
   it blends rather than looking like a lighter grey patch.
══════════════════════════════════════ */

function ElegantTabBar({ state, navigation }) {
  if (state.index === 2) return null;

  const { cart, refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();
  const { userProfile, refreshUserProfile } = useAuth();
  const avatarUri = userProfile?.photoURL;
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const counts = { Cart: cartCount };

  const ops = useRef(
    TABS.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  const scales = useRef(
    TABS.map(() => new Animated.Value(1))
  ).current;

  useEffect(() => {
    ops.forEach((op, i) =>
      Animated.timing(op, {
        toValue: i === state.index ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    );
  }, [state.index]);

  const pressTab = (i) => {
    const route = state.routes[i];
    const focused = state.index === i;

    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.85, duration: 65, useNativeDriver: true }),
      Animated.spring(scales[i], { toValue: 1, useNativeDriver: true }),
    ]).start();

    const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);

    // Keep the Cart badge (and anything reading favorites elsewhere, like
    // the Home heart icon) live as the user moves between tabs, not just
    // when they land on Cart/Favorites and pull to refresh directly.
    refreshCart();
    refreshFavorites();
    refreshUserProfile();
  };

  const renderIcon = (tab, i) => {
    if (tab.isProfile && avatarUri) {
      // A circular photo, not an icon glyph — matches the reference
      // screenshot's "My Netflix" tab shape, distinct from the other
      // outline/filled icon tabs.
      return (
        <>
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          </View>
          <Animated.View style={[styles.iconOverlay, { opacity: ops[i] }]}>
            <View style={[styles.avatarRing, styles.avatarRingActive]}>
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            </View>
          </Animated.View>
        </>
      );
    }
    return (
      <>
        {/* Muted outline icon, always rendered; the gold filled version
            fades in on top via opacity — animating the icon's own
            color/name prop directly isn't supported on this component. */}
        <Ionicons name={tab.iconOutline} size={21} color={colors.textTertiary} />
        <Animated.View style={[styles.iconOverlay, { opacity: ops[i] }]}>
          <Ionicons name={tab.iconFilled} size={21} color={colors.accentGold} />
        </Animated.View>
      </>
    );
  };

  return (
    <View style={styles.bar}>
      <View style={styles.pillShadowWrap}>
        <BlurView intensity={45} tint="dark" style={styles.pill}>
          {TABS.map((tab, i) => {
            const count = counts[tab.name] || 0;

            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => pressTab(i)}
                style={styles.tab}
                activeOpacity={0.7}
              >
                <Animated.View style={[styles.tabInner, { transform: [{ scale: scales[i] }] }]}>
                  <View style={styles.iconSlot}>
                    {renderIcon(tab, i)}
                    <Badge count={count} />
                  </View>

                  <View style={styles.labelSlot}>
                    <Text style={[styles.label, styles.labelMuted]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                    <Animated.Text
                      style={[styles.label, styles.labelGold, styles.labelOverlay, { opacity: ops[i] }]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Animated.Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════ */

export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <ElegantTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // "shift" gives a subtle horizontal slide + fade between tabs
        // (React Navigation v7) instead of the default instant cut —
        // switching tabs was the one navigation action with zero animation.
        animation: "shift",
        // position:'absolute' is what tells the navigator not to reserve
        // layout space for the tab bar at all — screens render full-height
        // behind it, so real content (not a flat color) shows through the
        // pill's transparent margins. Every screen needs its own bottom
        // padding now (see TAB_BAR_CLEARANCE) since nothing pushes their
        // content up automatically anymore.
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          elevation: 0,
          borderTopWidth: 0,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          // Shop's stack gets fully unmounted (and re-mounted fresh at
          // ShopScreen) every time you leave the tab — otherwise, jumping
          // into it from Home's category dropdown (a cross-tab navigate)
          // lands on top of whatever screen was left over from the last
          // time you visited Shop, so the back button goes to that stale
          // screen instead of somewhere sensible. Shop's own screens don't
          // hold state worth preserving (it's a category menu + product
          // grids), so resetting on every visit is a safe, simple fix.
          options={tab.name === "Shop" ? { unmountOnBlur: true } : undefined}
        />
      ))}
    </Tab.Navigator>
  );
}

/* ══════════════════════════════════════ */

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
  },

  pillShadowWrap: {
    borderRadius: radius.full,
    ...shadows.md,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    // Tuned close to the app's actual background color (bgPrimary) instead
    // of a lighter/greyer translucent tint, so the pill reads as "the same
    // dark surface, slightly elevated" rather than a mismatched grey patch.
    backgroundColor: "rgba(10,10,10,0.85)",
    overflow: "hidden",
  },

  tab: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center" },
  tabInner: { alignItems: "center", justifyContent: "center", gap: 5 },

  iconSlot: { position: "relative", width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  iconOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarRing: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    overflow: "hidden",
  },
  avatarRingActive: { borderColor: colors.accentGold },
  avatarImg: { width: "100%", height: "100%" },

  labelSlot: { position: "relative" },
  label: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  labelMuted: { color: colors.textTertiary },
  labelGold: { color: colors.accentGold },
  labelOverlay: { position: "absolute", top: 0, left: 0, right: 0 },

  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#E53E1A",
    borderRadius: 7,
    minWidth: 13,
    height: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { fontSize: 6.5, color: colors.textPrimary },
});
