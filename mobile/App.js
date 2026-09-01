import React, { useRef } from "react";
import { View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { setActiveRouteName } from "./src/navigation/activeRoute";
import { useFonts, BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { CartProvider } from "./src/context/CartContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import Toast from "react-native-toast-message";
import ChatWidget from "./src/components/ChatWidget";
import FlyToCartOverlay from "./src/components/FlyToCartOverlay";
import { colors } from "./src/theme";

export default function App() {
  const navigationRef = useRef(null);

  // Loaded once here (not per-screen) so every screen can use the web's
  // actual typefaces — Bebas Neue for headings/buttons, Outfit for body —
  // without each one re-declaring its own useFonts call.
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  if (!fontsLoaded) {
    // Matches SplashScreen's background so there's no white flash before
    // the real splash animation takes over.
    return <View style={{ flex: 1, backgroundColor: colors.black }} />;
  }

  // React Navigation's own DefaultTheme has a white `background` — without
  // overriding it, any gap the navigator itself paints (safe-area insets
  // around a custom tab bar, screen-transition seams) shows through white
  // instead of the app's dark background.
  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.bgPrimary,
      card: colors.bgPrimary,
      border: colors.borderSubtle,
      primary: colors.accentGold,
      text: colors.textPrimary,
    },
  };

  return (
    <>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={navTheme}
              onReady={() => setActiveRouteName(navigationRef.current?.getCurrentRoute()?.name ?? null)}
              onStateChange={() => setActiveRouteName(navigationRef.current?.getCurrentRoute()?.name ?? null)}
            >
              <AppNavigator />
            </NavigationContainer>
            <ChatWidget />
            <FlyToCartOverlay />
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>

      <Toast />
    </>
  );
}