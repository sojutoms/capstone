import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { CartProvider } from "./src/context/CartContext";
import { FavoritesProvider } from "./src/context/FavoritesContext";
import Toast from "react-native-toast-message";
import ChatWidget from "./src/components/ChatWidget";

export default function App() {
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