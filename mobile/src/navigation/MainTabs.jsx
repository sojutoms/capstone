import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeStack from "./HomeStack";
import CartStack from "./CartStack";
import CameraScreen from "../screens/CameraScreen";
import ProfileStack from "./ProfileStack";

import { useCart } from "../context/CartContext";
import ShopStack from "./ShopStack";

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get("window");

/* ══════════════════════════════════════
   ICONS
══════════════════════════════════════ */

const HomeIcon = ({ on }) => {
  const c = on ? "#FFF" : "#484848";
  return (
    <View style={styles.icon}>
      <View style={[styles.homeBase, { borderColor: c }]} />
      <View style={[styles.homeDoor, { borderColor: c }]} />
      <View style={[styles.homeRoofLeft, { backgroundColor: c }]} />
      <View style={[styles.homeRoofRight, { backgroundColor: c }]} />
    </View>
  );
};

const ShopIcon = ({ on }) => {
  const c = on ? "#FFF" : "#484848";
  return (
    <View style={styles.icon}>
      <View style={[styles.bagHandle, { borderColor: c }]} />
      <View style={[styles.bagBody, { borderColor: c }]} />
    </View>
  );
};

const CameraIcon = ({ on }) => {
  const c = on ? "#FFF" : "#888";
  return (
    <View style={styles.cameraWrap}>
      <View style={[styles.cameraTop, { borderColor: c }]} />
      <View style={[styles.cameraBody, { borderColor: c }]}>
        <View style={[styles.lensOuter, { borderColor: c }]}>
          <View style={[styles.lensInner, { backgroundColor: on ? "#FFF" : "#888" }]} />
        </View>
      </View>
    </View>
  );
};

const CartIcon = ({ on }) => {
  const c = on ? "#FFF" : "#484848";
  return (
    <View style={styles.icon}>
      <View style={[styles.cartBasket, { borderColor: c }]} />
      <View style={[styles.cartHandle, { borderColor: c }]} />
    </View>
  );
};

const PersonIcon = ({ on }) => {
  const c = on ? "#FFF" : "#484848";
  return (
    <View style={styles.icon}>
      <View style={[styles.personHead, { borderColor: c }]} />
      <View style={[styles.personBody, { borderColor: c }]} />
    </View>
  );
};

/* ══════════════════════════════════════
   TAB CONFIG (single source of truth)
══════════════════════════════════════ */

const TABS = [
  { name: "Home", label: "HOME", icon: HomeIcon, component: HomeStack },
  { name: "Shop", label: "SHOP", icon: ShopIcon, component: ShopStack },
  { name: "Camera", label: "CAMERA", icon: CameraIcon, component: CameraScreen, center: true },
  { name: "Cart", label: "BAG", icon: CartIcon, component: CartStack },
  { name: "Profile", label: "PROFILE", icon: PersonIcon, component: ProfileStack },
];

const TAB_W = width / TABS.length;

/* ══════════════════════════════════════ */

const Badge = ({ count }) =>
  count > 0 ? (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  ) : null;

/* ══════════════════════════════════════ */

function ElegantTabBar({ state, navigation }) {
  if (state.index === 2) return null;

  const { cart } = useCart();
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const counts = { Cart: cartCount };

  const dotX = useRef(new Animated.Value(state.index * TAB_W + TAB_W / 2 - 2)).current;

  const ops = useRef(
    TABS.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  const scales = useRef(
    TABS.map(() => new Animated.Value(1))
  ).current;

  useEffect(() => {
    Animated.spring(dotX, {
      toValue: state.index * TAB_W + TAB_W / 2 - 2,
      useNativeDriver: true,
    }).start();

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
  };

  return (
    <View style={styles.bar}>
      <View style={styles.topLine} />
      <Animated.View style={[styles.dot, { transform: [{ translateX: dotX }] }]} />

      {TABS.map((tab, i) => {
        const Icon = tab.icon;
        const isCenter = tab.center;
        const count = counts[tab.name] || 0;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => pressTab(i)}
            style={[styles.tab, isCenter && styles.tabCenter]}
          >
            <Animated.View style={[
              styles.tabInner,
              isCenter && styles.tabInnerCenter,
              { transform: [{ scale: scales[i] }] }
            ]}>
              <View style={{ position: "relative" }}>
                <View style={isCenter ? styles.iconWrapBig : styles.iconWrap}>
                  <Icon on={false} />
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: ops[i] }]}>
                    <Icon on={true} />
                  </Animated.View>
                </View>
                <Badge count={count} />
              </View>

              {!isCenter && (
                <Animated.Text style={[
                  styles.label,
                  {
                    color: ops[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ["#383838", "#FFFFFF"],
                    }),
                  },
                ]}>
                  {tab.label}
                </Animated.Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ══════════════════════════════════════ */

export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <ElegantTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={tab.center ? { tabBarStyle: { display: "none" } } : {}}
        />
      ))}
    </Tab.Navigator>
  );
}

/* ══════════════════════════════════════ */

const styles = StyleSheet.create({
  bar: {
    height: Platform.OS === "ios" ? 82 : 64,
    backgroundColor: "#0A0A0A",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
  },
  tab: { flex: 1, alignItems: "center" },
  tabCenter: { overflow: "visible" },
  tabInner: { alignItems: "center", gap: 5 },
  tabInnerCenter: { marginBottom: 14 },
  label: { fontSize: 7, fontWeight: "600", letterSpacing: 1.4 },

  dot: {
    position: "absolute",
    top: 0,
    width: 4,
    height: 2,
    backgroundColor: "#FFF",
  },

  topLine: {
    position: "absolute",
    top: 0,
    height: 1,
    width: "100%",
    backgroundColor: "#1C1C1C",
  },

  iconWrap: { width: 20, height: 18 },
  iconWrapBig: { width: 30, height: 26 },

  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    backgroundColor: "#E53E1A",
    borderRadius: 7,
    minWidth: 13,
    height: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { fontSize: 6.5, color: "#FFF" },

  icon: { width: 20, height: 18 },

  /* shapes (cleaned) */
  homeBase: { position:"absolute", bottom:0, left:3, right:3, height:9, borderWidth:1.5, borderTopWidth:0 },
  homeDoor: { position:"absolute", bottom:0, alignSelf:"center", width:5, height:5, borderWidth:1.5, borderBottomWidth:0 },
  homeRoofLeft: { position:"absolute", top:2, left:0, width:11, height:1.5, transform:[{rotate:"-33deg"}] },
  homeRoofRight: { position:"absolute", top:2, right:0, width:11, height:1.5, transform:[{rotate:"33deg"}] },

  bagHandle: { position:"absolute", top:0, alignSelf:"center", width:9, height:5, borderWidth:1.5, borderBottomWidth:0 },
  bagBody: { position:"absolute", bottom:0, width:16, height:12, borderWidth:1.5 },

  cartBasket: { position:"absolute", bottom:0, width:16, height:10, borderWidth:1.5 },
  cartHandle: { position:"absolute", top:0, width:10, height:5, borderWidth:1.5, borderBottomWidth:0 },

  personHead: { position:"absolute", top:0, width:8, height:8, borderRadius:4, borderWidth:1.5 },
  personBody: { position:"absolute", bottom:0, width:16, height:8, borderTopLeftRadius:8, borderTopRightRadius:8, borderWidth:1.5, borderBottomWidth:0 },

  cameraWrap: { width: 30, height: 26 },
  cameraTop: { position:"absolute", top:0, width:10, height:5, borderWidth:1.8, borderBottomWidth:0 },
  cameraBody: { position:"absolute", bottom:0, width:28, height:18, borderWidth:1.8, alignItems:"center", justifyContent:"center" },
  lensOuter: { width:11, height:11, borderRadius:5.5, borderWidth:1.8, alignItems:"center", justifyContent:"center" },
  lensInner: { width:4, height:4, borderRadius:2 },
});