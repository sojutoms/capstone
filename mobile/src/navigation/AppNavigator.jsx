import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import VerifyOTPScreen from "../screens/VerifyOTPScreen";

// SCREENS
import SplashScreen from "../screens/SplashScreen";
import AuthChoice from "../screens/AuthChoice";
import Onboarding from "../screens/Onboarding";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import MainTabs from "./MainTabs";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";


const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { userToken, loading, hasSeenOnboarding } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash || loading) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken ? (
        // ── Logged in ──────────────────────────────
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        // ── Logged out ─────────────────────────────
        <>
          {!hasSeenOnboarding && (
            <Stack.Screen name="Onboarding" component={Onboarding} />
          )}
          <Stack.Screen name="AuthChoice"      component={AuthChoice} />
          <Stack.Screen name="LoginScreen"     component={LoginScreen} />
          <Stack.Screen name="SignupScreen"    component={SignupScreen} />
          <Stack.Screen name="VerifyOTP"       component={VerifyOTPScreen} />
          <Stack.Screen name="ForgotPassword"  component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}