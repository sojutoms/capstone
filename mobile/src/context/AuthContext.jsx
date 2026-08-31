import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  loginUser,
  signupUser,
  verifyOtp,
  forgotPassword,
  resetPassword,
} from "../api/authApi";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken]               = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const emptyProfile = { name: "", email: "", photoURL: null, place: "", bio: "" };
  const [userProfile, setUserProfile] = useState(emptyProfile);

  // The JWT only carries the user's id ({ user: { id } }) — name/email/etc.
  // live in the database, so any screen wanting the real account info
  // needs this instead of trying to decode it out of the token.
  const fetchUserProfile = async (token) => {
    if (!token) { setUserProfile(emptyProfile); return; }
    try {
      const res  = await fetch(`${BASE_URL}/user/profile`, { headers: { "auth-token": token } });
      const data = await res.json();
      if (data.success && data.user) {
        setUserProfile({
          name: data.user.name || "",
          email: data.user.email || "",
          photoURL: data.user.photo || data.user.avatar || null,
          place: data.user.place || "",
          bio: data.user.bio || "",
        });
      }
    } catch {}
  };

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

  useEffect(() => { fetchUserProfile(userToken); }, [userToken]);

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
        userProfile,
        refreshUserProfile: () => fetchUserProfile(userToken),
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