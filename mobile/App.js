import React from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
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
import { colors } from "./src/theme";

export default function App() {
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

  return (
    <>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
            <ChatWidget />
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>

      <Toast />
    </>
  );
}