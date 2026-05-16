// ProfileStack.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import OrderHistoryScreen from "../screens/OrderHistoryScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
    </Stack.Navigator>
  );
}