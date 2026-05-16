import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import ProductDetail from "../screens/ProductDetail";
import PlaceOrderScreen from "../screens/PlaceOrderScreen";
import OrdersScreen from "../screens/OrdersScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import ARTryOnScreen from "../screens/ARTryOnScreen";


const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
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