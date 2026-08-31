import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { BASE_URL } from "../api/config";
import { colors, fonts } from "../theme";

export default function ForgotPasswordScreen({ navigation }) {
  const [step,        setStep]        = useState(1);
  const [email,       setEmail]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const [focusEmail, setFocusEmail] = useState(false);
  const [focusOtp,   setFocusOtp]   = useState(false);
  const [focusPass,  setFocusPass]  = useState(false);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(24)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim,   { toValue: 0, duration: 450, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(cardSlide,   { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const resetEntrance = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
  };

  /* ── STEP 1: SEND OTP ── */
  const handleSendOTP = async () => {
    setError("");
    if (!email.trim()) { setError("Please enter your email"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.errors || "Failed to send OTP"); return; }
      resetEntrance();
      setStep(2);
    } catch {
      setError("Unable to reach server");
    } finally {
      setLoading(false);
    }
  };

  /* ── STEP 2: RESET PASSWORD ── */
  const handleResetPassword = async () => {
    setError("");
    if (otp.length !== 6) { setError("OTP must be 6 digits"); return; }
    if (!newPassword)     { setError("Enter a new password"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg = String(data.errors || "").toLowerCase();
        setError(
          msg.includes("invalid") ? "Incorrect OTP" :
          msg.includes("expired") ? "OTP expired" :
          data.errors || "Reset failed"
        );
        return;
      }
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "LoginScreen" }] })
      );
    } catch {
      setError("Unable to reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── FLOATING CARD ── */}
          <Animated.View
            style={[
              s.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardSlide }],
              },
            ]}
          >
            {/* ── STEP INDICATOR (inside card, top) ── */}
            <View style={s.stepRow}>
              {/* Step 1 */}
              <View style={[s.stepCircle, step >= 1 && s.stepCircleActive]}>
                <Text style={[s.stepCircleText, step >= 1 && s.stepCircleTextActive]}>1</Text>
              </View>

              {/* Connector */}
              <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />

              {/* Step 2 */}
              <View style={[s.stepCircle, step >= 2 && s.stepCircleActive]}>
                <Text style={[s.stepCircleText, step >= 2 && s.stepCircleTextActive]}>2</Text>
              </View>
            </View>

            {/* Heading */}
            <Animated.View
              style={[
                s.headingBlock,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={s.eyebrow}>{step === 1 ? "STEP 1 OF 2" : "STEP 2 OF 2"}</Text>
              <Text style={s.title}>
                {step === 1 ? "Forgot\nPassword" : "Reset\nPassword"}
              </Text>
              <Text style={s.subtitle}>
                {step === 1
                  ? "Enter the email linked to your account.\nWe'll send you a one-time code."
                  : `OTP sent to ${email}.\nEnter the code and your new password.`}
              </Text>
            </Animated.View>

            {/* ── STEP 1 FIELDS ── */}
            {step === 1 && (
              <Animated.View
                style={[
                  s.fields,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={s.fieldGroup}>
                  <Text style={s.label}>EMAIL</Text>
                  <View style={[s.inputWrap, focusEmail && s.inputWrapFocused]}>
                    <TextInput
                      style={s.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#555"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusEmail(true)}
                      onBlur={() => setFocusEmail(false)}
                    />
                  </View>
                </View>

                {error ? <Text style={s.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.primaryBtn, loading && s.primaryBtnDim]}
                  onPress={handleSendOTP}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color={colors.textInverse} size="small" />
                    : <Text style={s.primaryBtnText}>SEND OTP</Text>
                  }
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── STEP 2 FIELDS ── */}
            {step === 2 && (
              <Animated.View
                style={[
                  s.fields,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={s.fieldGroup}>
                  <Text style={s.label}>ONE-TIME CODE</Text>
                  <View style={[s.inputWrap, focusOtp && s.inputWrapFocused]}>
                    <TextInput
                      style={[s.input, s.inputOtp]}
                      placeholder="6-digit OTP"
                      placeholderTextColor="#555"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      onFocus={() => setFocusOtp(true)}
                      onBlur={() => setFocusOtp(false)}
                    />
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>NEW PASSWORD</Text>
                  <View style={[s.inputWrap, focusPass && s.inputWrapFocused]}>
                    <TextInput
                      style={s.input}
                      placeholder="••••••••"
                      placeholderTextColor="#555"
                      secureTextEntry={!showPass}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusPass(true)}
                      onBlur={() => setFocusPass(false)}
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                      <Text style={s.eyeText}>{showPass ? "HIDE" : "SHOW"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {error ? <Text style={s.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.primaryBtn, loading && s.primaryBtnDim]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color={colors.textInverse} size="small" />
                    : <Text style={s.primaryBtnText}>RESET PASSWORD</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.ghostBtn}
                  onPress={() => { resetEntrance(); setStep(1); setError(""); }}
                >
                  <Text style={s.ghostBtnText}>← Change email</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── BOTTOM HINT ── */}
            <View style={s.bottomRow}>
              <Text style={s.bottomText}>Remembered it? </Text>
              <TouchableOpacity onPress={() =>
                navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "LoginScreen" }] }))
              }>
                <Text style={s.bottomLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  // ── Floating dark card (matches sign-up) ──
  card: {
    width: "100%",
    backgroundColor: "rgba(8,8,8,0.75)",
    borderRadius: 20,
    padding: 24,
    paddingBottom: 28,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },

  // ── Step indicator (inside card, top) ──
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  stepCircleActive: {
    borderColor: colors.accentGold,
    backgroundColor: "transparent",
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3a3a3a",
  },
  stepCircleTextActive: {
    color: colors.accentGold,
  },
  stepLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: colors.accentGold,
  },

  // ── Heading ──
  headingBlock: { marginBottom: 28 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#444",
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    lineHeight: 42,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 19,
    letterSpacing: 0.2,
  },

  // ── Fields ──
  fields:     { gap: 14 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1.8,
    color: "#505050",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(8,8,8,0.75)",
    borderWidth: 0.5,
    borderColor: "#1e1e1e",
    borderRadius: 10,
    paddingHorizontal: 13,
    height: 46,
  },
  inputWrapFocused: { borderColor: "#3a3a3a" },
  input: {
    flex: 1,
    color: "#d8d8d8",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  inputOtp: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 8,
  },
  eyeBtn:  { paddingLeft: 12 },
  eyeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#505050",
  },

  // ── Error ──
  error: {
    fontSize: 11,
    color: "#888",
    letterSpacing: 0.3,
    marginTop: -4,
  },

  // ── Primary button ──
  primaryBtn: {
    backgroundColor: colors.textPrimary,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnDim: { opacity: 0.6 },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
  },

  // ── Ghost button ──
  ghostBtn: {
    height: 46,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  ghostBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },

  // ── Bottom ──
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  bottomText: { color: "#333", fontSize: 12 },
  bottomLink: { color: colors.accentGold, fontSize: 12, fontWeight: "700" },
});