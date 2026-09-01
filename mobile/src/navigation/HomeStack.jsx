import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import ProductDetail from "../screens/ProductDetail";
import PlaceOrderScreen from "../screens/PlaceOrderScreen";
import OrdersScreen from "../screens/OrdersScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import ARTryOnScreen from "../screens/ARTryOnScreen";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { useAuth } from "../context/AuthContext";
import { stackScreenOptions } from "./screenTransition";


const Stack = createNativeStackNavigator();

export default function HomeStack() {
  const { refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();
  const { refreshUserProfile } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
      screenListeners={{
        // Fires whenever any screen in this stack comes into focus (e.g.
        // navigating back from ProductDetail to Home, or into Favorites) —
        // keeps cart/favorites-derived badges (and the Home greeting name)
        // current without needing a manual pull-to-refresh every time.
        focus: () => {
          refreshCart();
          refreshFavorites();
          refreshUserProfile();
        },
      }}
    >

      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
      />

      <Stack.Screen
        name="ProductDetail"
        component={ProductDetail}
      />

      <Stack.Screen
        name= "PlaceOrder"
        component={PlaceOrderScreen}
        />

        <Stack.Screen name="Orders" component={OrdersScreen} />
         <Stack.Screen name="Favorites" component={FavoritesScreen} />

<Stack.Screen name="ARTryOn" component={ARTryOnScreen} />


    </Stack.Navigator>
  );
}