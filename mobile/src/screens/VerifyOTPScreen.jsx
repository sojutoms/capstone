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
  ImageBackground,
} from "react-native";
import { BASE_URL } from "../api/config";

export default function VerifyOTPScreen({ navigation, route }) {
  const email = route?.params?.email || "";

  const [otp,         setOtp]         = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [resendMsg,   setResendMsg]   = useState("");
  const [countdown,   setCountdown]   = useState(60);
  const [canResend,   setCanResend]   = useState(false);
  const [focusOtp,    setFocusOtp]    = useState(false);

  const cardOpacity   = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(40)).current;
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const slideAnim     = useRef(new Animated.Value(24)).current;
  const shakeAnim     = useRef(new Animated.Value(0)).current;

  // Card entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity,    { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(fadeAnim,       { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim,      { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  /* ── VERIFY OTP ── */
  const handleVerify = async () => {
    setError("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      shake();
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg = String(data.errors || "").toLowerCase();
        setError(
          msg.includes("invalid") ? "Incorrect code. Please try again." :
          msg.includes("expired") ? "Code has expired. Request a new one." :
          data.errors || "Verification failed. Please try again."
        );
        shake();
        return;
      }
      navigation.replace("LoginScreen");
    } catch {
      setError("Unable to reach the server. Check your connection.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  /* ── RESEND OTP ── */
  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setResendMsg("");
    setError("");
    try {
      const res  = await fetch(`${BASE_URL}/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.errors || "Failed to resend code.");
        return;
      }
      setResendMsg("A new code has been sent.");
      setOtp("");
      setCanResend(false);
      setCountdown(60);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2}).+(@.+)/, "$1•••$2")
    : "your email";

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              s.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            {/* ── ICON ── */}
            <Animated.View
              style={[
                s.iconWrap,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={s.iconCircle}>
                <Text style={s.iconText}>✉</Text>
              </View>
            </Animated.View>

            {/* ── HEADING ── */}
            <Animated.View
              style={[
                s.headingBlock,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={s.eyebrow}>VERIFY YOUR ACCOUNT</Text>
              <Text style={s.title}>Check your{"\n"}inbox</Text>
              <Text style={s.subtitle}>
                We sent a 6-digit code to{"\n"}
                <Text style={s.subtitleEmail}>{maskedEmail}</Text>
              </Text>
            </Animated.View>

            {/* ── OTP INPUT ── */}
            <Animated.View
              style={[
                s.fields,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { translateX: shakeAnim },
                  ],
                },
              ]}
            >
              <View style={s.fieldGroup}>
                <Text style={s.label}>ONE-TIME CODE</Text>
                <View style={[s.inputWrap, focusOtp && s.inputWrapFocused]}>
                  <TextInput
                    style={[s.input, s.inputOtp]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#2a2a2a"
                    keyboardType="numeric"
                    maxLength={6}
                    value={otp}
                    onChangeText={(v) => { setOtp(v); setError(""); }}
                    onFocus={() => setFocusOtp(true)}
                    onBlur={() => setFocusOtp(false)}
                    textAlign="center"
                    returnKeyType="done"
                    onSubmitEditing={handleVerify}
                  />
                </View>
              </View>

              {/* Error / Resend message */}
              {error     ? <Text style={s.error}>{error}</Text>     : null}
              {resendMsg ? <Text style={s.success}>{resendMsg}</Text> : null}

              {/* Verify button */}
              <TouchableOpacity
                style={[s.primaryBtn, (loading || otp.length !== 6) && s.primaryBtnDim]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={s.primaryBtnText}>VERIFY CODE</Text>
                }
              </TouchableOpacity>

              {/* Resend */}
              <View style={s.resendRow}>
                <Text style={s.resendLabel}>Didn't receive it? </Text>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend} disabled={resending}>
                    {resending
                      ? <ActivityIndicator color="#888" size="small" />
                      : <Text style={s.resendLink}>Resend code</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <Text style={s.resendTimer}>Resend in {countdown}s</Text>
                )}
              </View>

              {/* Divider */}
              <View style={s.divider} />

              {/* Back to login */}
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={() => navigation.replace("LoginScreen")}
              >
                <Text style={s.ghostBtnText}>← Back to sign in</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  // ── Card ──
  card: {
    width: "100%",
    backgroundColor: "rgba(10,10,10,0.82)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 24,
    paddingBottom: 28,
  },

  // ── Icon ──
  iconWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(20,20,20,0.8)",
    borderWidth: 0.5,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
    color: "#888",
  },

  // ── Heading ──
  headingBlock: { marginBottom: 28 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#444",
    marginBottom: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#f0f0f0",
    letterSpacing: -0.5,
    lineHeight: 42,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    lineHeight: 19,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitleEmail: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
  },

  // ── Fields ──
  fields:     { gap: 14 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1.8,
    color: "#505050",
    textAlign: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,8,8,0.75)",
    borderWidth: 0.5,
    borderColor: "#1e1e1e",
    borderRadius: 10,
    paddingHorizontal: 13,
    height: 58,
  },
  inputWrapFocused: { borderColor: "#3a3a3a" },
  input: {
    flex: 1,
    color: "#d8d8d8",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  inputOtp: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 12,
    color: "#f0f0f0",
  },

  // ── Error / Success ──
  error: {
    fontSize: 11,
    color: "#888",
    letterSpacing: 0.3,
    textAlign: "center",
    marginTop: -4,
  },
  success: {
    fontSize: 11,
    color: "#666",
    letterSpacing: 0.3,
    textAlign: "center",
    marginTop: -4,
  },

  // ── Primary button ──
  primaryBtn: {
    backgroundColor: "#f5f5f5",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnDim: { opacity: 0.45 },
  primaryBtnText: {
    color: "#0a0a0a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
  },

  // ── Resend ──
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -2,
  },
  resendLabel: { color: "#333", fontSize: 12 },
  resendLink:  { color: "#c0c0c0", fontSize: 12, fontWeight: "700" },
  resendTimer: { color: "#3a3a3a", fontSize: 12 },

  // ── Divider ──
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 4,
  },

  // ── Ghost button ──
  ghostBtn: {
    height: 46,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
  },
  ghostBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
});