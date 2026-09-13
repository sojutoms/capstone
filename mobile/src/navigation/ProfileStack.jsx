// ProfileStack.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import OrderHistoryScreen from "../screens/OrderHistoryScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import MyReviewsScreen from "../screens/MyReviewsScreen";
import VouchersScreen from "../screens/VouchersScreen";
import LegalScreen from "../screens/LegalScreen";
import FAQScreen from "../screens/FAQScreen";
import AddressesScreen from "../screens/AddressesScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import SizeGuideScreen from "../screens/SizeGuideScreen";
import { stackScreenOptions } from "./screenTransition";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />

      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
      <Stack.Screen name="Vouchers" component={VouchersScreen} />
      <Stack.Screen name="Privacy" component={LegalScreen} initialParams={{ type: "privacy" }} />
      <Stack.Screen name="Terms" component={LegalScreen} initialParams={{ type: "terms" }} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="SizeGuide" component={SizeGuideScreen} />
    </Stack.Navigator>
  );
}