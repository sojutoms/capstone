import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loginUser,
  signupUser,
  verifyOtp,
  forgotPassword,
  resetPassword,
} from "../api/authApi";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken]               = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // ─── Load stored data on app start ──────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        const seen  = await AsyncStorage.getItem("hasSeenOnboarding");
        if (token) setUserToken(token);
        setHasSeenOnboarding(seen === "true");
      } catch (e) {
        console.log("Error loading stored data:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ─── Login ───────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await loginUser(email, password);
    if (!res.success) throw new Error(res.errors || "Login failed");
    await AsyncStorage.setItem("userToken", res.token);
    setUserToken(res.token);
  };

  // ─── Signup (step 1 — sends OTP) ─────────────────────────────────────────────
  const signup = async (userData) => {
    const res = await signupUser(userData);
    if (!res.success) throw new Error(res.errors || "Signup failed");
    return res; // success — OTP sent, caller shows OTP step
  };

  // ─── Verify OTP (step 2 — completes signup) ──────────────────────────────────
  const confirmOtp = async (email, otp) => {
    const res = await verifyOtp(email, otp);
    if (!res.success) throw new Error(res.errors || "OTP verification failed");
    await AsyncStorage.setItem("userToken", res.token);
    setUserToken(res.token);
  };

  // ─── Forgot password (sends reset OTP) ───────────────────────────────────────
  const sendForgotOtp = async (email) => {
    const res = await forgotPassword(email);
    if (!res.success) throw new Error(res.errors || "Failed to send reset OTP");
  };

  // ─── Reset password ───────────────────────────────────────────────────────────
  const confirmResetPassword = async (email, otp, newPassword) => {
    const res = await resetPassword(email, otp, newPassword);
    if (!res.success) throw new Error(res.errors || "Password reset failed");
  };

  // ─── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    await AsyncStorage.removeItem("userToken");
    setUserToken(null);
  };

  // ─── Onboarding ───────────────────────────────────────────────────────────────
  const completeOnboarding = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    setHasSeenOnboarding(true);
  };

  return (
    <AuthContext.Provider
      value={{
        userToken,
        loading,
        hasSeenOnboarding,
        login,
        signup,
        confirmOtp,
        sendForgotOtp,
        confirmResetPassword,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};