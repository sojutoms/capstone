import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CartScreen from "../screens/CartScreen";
import PlaceOrderScreen from "../screens/PlaceOrderScreen";
import OrdersScreen from "../screens/OrdersScreen";

const Stack = createNativeStackNavigator();

export default function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      <Stack.Screen 
        name="CartScreen" 
        component={CartScreen} 
      />

      <Stack.Screen 
        name="PlaceOrder" 
        component={PlaceOrderScreen} 
      />

      <Stack.Screen name="Orders" component={OrdersScreen} />

    </Stack.Navigator>
  );
}