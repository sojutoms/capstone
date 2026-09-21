import React, { useMemo, useState } from "react";
import { BASE_URL } from "../api/config";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../utils/customAlert";
import { useAuth } from "../context/AuthContext";
import { fonts, radius, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

// Same rules as the web Settings page, so a password accepted here is
// accepted there too.
const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Matches web's ResendOtpButton formatTime exactly.
const formatCountdown = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
};

const Label = ({ text, s }) => <Text style={s.label}>{text}</Text>;
const FieldError = ({ msg, s }) => (msg ? <Text style={s.errorText}>⚠ {msg}</Text> : null);

function PasswordField({ label, value, onChangeText, visible, onToggleVisible, error, s, colors }) {
  return (
    <View style={s.fieldGroup}>
      <Label text={label} s={s} />
      <View style={[s.inputWrap, error && s.inputError]}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={onToggleVisible} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <FieldError msg={error} s={s} />
    </View>
  );
}

export default function ChangePasswordScreen({ navigation }) {
  const { userToken, userProfile, resendOtp } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState("form"); // "form" | "otp"
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [sendingOtp, setSendingOtp] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pending = React.useRef({ current: "", newPass: "" });

  // Resend cooldown — same 60s -> 120s -> 180s escalation as signup/forgot.
  const [otpResendAttempts, setOtpResendAttempts] = useState(0);
  const [otpCountdown, setOtpCountdown]           = useState(60);
  const [otpCanResend, setOtpCanResend]           = useState(false);
  const [otpResending, setOtpResending]           = useState(false);

  React.useEffect(() => {
    if (step !== "otp") return;
    if (otpCountdown <= 0) { setOtpCanResend(true); return; }
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown, step]);

  const resetOtpResendState = () => {
    setOtpResendAttempts(0);
    setOtpCountdown(60);
    setOtpCanResend(false);
  };

  const handleResendOtp = async () => {
    if (!otpCanResend || otpResending) return;
    setOtpResending(true);
    try {
      await resendOtp(userProfile?.email, "change-password");
      Alert.alert("Sent", "A new code has been sent to your email.");
      setOtp("");
      setOtpError("");
      setOtpCanResend(false);
      const newAttempts = otpResendAttempts + 1;
      setOtpResendAttempts(newAttempts);
      setOtpCountdown(newAttempts === 1 ? 120 : 180);
    } catch (err) {
      if (err.remainingSeconds) {
        setOtpCanResend(false);
        setOtpCountdown(err.remainingSeconds);
      }
      Alert.alert("Error", err.message || "Failed to resend code");
    } finally {
      setOtpResending(false);
    }
  };

  const checks = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(newPass) }));

  const handleRequestOtp = async () => {
    const e = {};
    if (!current) e.current = "Current password is required.";
    if (!newPass) e.newPass = "New password is required.";
    else if (newPass === current) e.newPass = "New password must be different from your current password.";
    else if (checks.some((c) => !c.passed)) e.newPass = "Password does not meet all requirements.";
    if (!confirm) e.confirm = "Please confirm your new password.";
    else if (newPass !== confirm) e.confirm = "Passwords do not match.";

    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSendingOtp(true);
    try {
      const verifyRes = await fetch(`${BASE_URL}/user/verify-current-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ currentPassword: current }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setErrors({ current: verifyData.message || "Incorrect current password." });
        return;
      }

      const otpRes = await fetch(`${BASE_URL}/user/send-change-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
      });
      const otpData = await otpRes.json();
      if (otpData.success) {
        pending.current = { current, newPass };
        setStep("otp");
        setOtp("");
        setOtpError("");
        resetOtpResendState();
      } else {
        Alert.alert("Error", otpData.message || "Failed to send OTP");
      }
    } catch {
      Alert.alert("Network Error", "Request failed. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    if (!/^\d{6}$/.test(otp)) { setOtpError("Enter all 6 digits."); return; }
    setVerifying(true);
    try {
      const res  = await fetch(`${BASE_URL}/user/changepassword`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({
          currentPassword: pending.current.current,
          newPassword: pending.current.newPass,
          otp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Password updated successfully.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        setOtpError(data.message || "Invalid OTP. Please try again.");
      }
    } catch {
      setOtpError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 14 }]} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={s.backArrow}>←</Text>
        <Text style={s.backLabel}>Back</Text>
      </TouchableOpacity>

      <Text style={s.pageTitle}>Change Password</Text>

      {step === "form" ? (
        <>
          <PasswordField
            label="Current Password" value={current} onChangeText={(v) => { setCurrent(v); setErrors((p) => ({ ...p, current: "" })); }}
            visible={showCurrent} onToggleVisible={() => setShowCurrent((v) => !v)}
            error={errors.current} s={s} colors={colors}
          />
          <PasswordField
            label="New Password" value={newPass} onChangeText={(v) => { setNewPass(v); setErrors((p) => ({ ...p, newPass: "" })); }}
            visible={showNew} onToggleVisible={() => setShowNew((v) => !v)}
            error={errors.newPass} s={s} colors={colors}
          />
          {newPass.length > 0 && (
            <View style={s.checklist}>
              {checks.map((c) => (
                <View key={c.key} style={s.checkRow}>
                  <Text style={[s.checkIcon, c.passed ? s.checkPass : s.checkFail]}>{c.passed ? "✓" : "✗"}</Text>
                  <Text style={[s.checkLabel, c.passed && s.checkLabelPass]}>{c.label}</Text>
                </View>
              ))}
            </View>
          )}
          <PasswordField
            label="Confirm New Password" value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: "" })); }}
            visible={showConfirm} onToggleVisible={() => setShowConfirm((v) => !v)}
            error={errors.confirm} s={s} colors={colors}
          />

          <TouchableOpacity
            style={[s.saveBtn, sendingOtp && s.saveBtnDisabled]}
            onPress={handleRequestOtp}
            disabled={sendingOtp}
          >
            {sendingOtp
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={s.saveText}>CONTINUE</Text>
            }
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={s.otpHint}>
            A 6-digit verification code was sent to{" "}
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.textPrimary }}>{userProfile?.email}</Text>.
            Enter it below to confirm the password change.
          </Text>

          <View style={s.fieldGroup}>
            <Label text="Verification Code" s={s} />
            <View style={[s.inputWrap, otpError && s.inputError]}>
              <TextInput
                style={[s.input, s.otpInput]}
                value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <FieldError msg={otpError} s={s} />
          </View>

          <View style={s.resendRow}>
            <Text style={s.resendLabel}>Didn't receive it? </Text>
            {otpCanResend ? (
              <TouchableOpacity onPress={handleResendOtp} disabled={otpResending}>
                <Text style={s.resendLink}>Resend code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.resendTimer}>
                {otpResending ? "Sending…" : `Resend in ${formatCountdown(otpCountdown)}`}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, verifying && s.saveBtnDisabled]}
            onPress={handleVerifyOtp}
            disabled={verifying}
          >
            {verifying
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={s.saveText}>VERIFY & UPDATE PASSWORD</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelOtpBtn} onPress={() => setStep("form")}>
            <Text style={s.cancelOtpText}>← Back to form</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_CLEARANCE },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
  backArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: "300" },
  backLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bodyMedium },

  pageTitle: { fontSize: 30, fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 1, marginBottom: 20 },

  fieldGroup: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, paddingVertical: 14, fontSize: 14, color: colors.textPrimary },
  otpInput: { letterSpacing: 6, fontSize: 18, fontFamily: fonts.display, textAlign: "center" },
  errorText: { fontSize: 11, color: colors.danger, marginTop: 5, letterSpacing: 0.3 },

  checklist: { marginTop: -6, marginBottom: 14, gap: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkIcon: { fontSize: 11, width: 14 },
  checkPass: { color: colors.success },
  checkFail: { color: colors.textMuted },
  checkLabel: { fontSize: 12, color: colors.textMuted },
  checkLabelPass: { color: colors.textSecondary },

  otpHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },

  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4, marginBottom: 8 },
  resendLabel: { color: colors.textMuted, fontSize: 12 },
  resendLink: { color: colors.accentGold, fontSize: 12, fontWeight: "700" },
  resendTimer: { color: colors.textMuted, fontSize: 12 },

  saveBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { ...typography.button, color: colors.textInverse, fontSize: 14 },

  cancelOtpBtn: { alignItems: "center", marginTop: 16 },
  cancelOtpText: { color: colors.textMuted, fontSize: 13 },
});
