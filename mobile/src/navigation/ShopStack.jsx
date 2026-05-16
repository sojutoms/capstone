import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ShopScreen    from "../screens/ShopScreen";      // category hub
import ShoesScreen   from "../screens/ShoesScreen";     // shoes product grid
import WatchesScreen from "../screens/WatchesScreen";   // watches product grid
import ProductDetail  from "../screens/ProductDetail";
import PlaceOrderScreen from "../screens/PlaceOrderScreen";
import OrdersScreen   from "../screens/OrdersScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import ARTryOnScreen from "../screens/ARTryOnScreen";

const Stack = createNativeStackNavigator();

export default function ShopStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShopScreen"    component={ShopScreen} />
      <Stack.Screen name="ShoesScreen"   component={ShoesScreen} />
      <Stack.Screen name="WatchesScreen" component={WatchesScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetail} />
      <Stack.Screen name="PlaceOrder"    component={PlaceOrderScreen} />
      <Stack.Screen name="Orders"        component={OrdersScreen} />
      <Stack.Screen name="Favorites"     component={FavoritesScreen} />
      <Stack.Screen name="ARTryOn" component={ARTryOnScreen} />
    </Stack.Navigator>
  );
}