import React, { useEffect, useState, useMemo } from "react";
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
import { Alert } from "../utils/customAlert";
import { useAuth } from "../context/AuthContext";
import { fonts, radius, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

// Converts a legacy 09XXXXXXXXX number (still the format most existing
// accounts have saved) into the +63XXXXXXXXXX format the register form now
// produces, so this field always matches it. Matches web's Settings.jsx.
const normalizePhone = (raw) => {
  const value = (raw || "").trim();
  if (value.startsWith("+63")) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return "+63" + digits.slice(1);
  if (!digits) return "+63";
  return value;
};

const Label = ({ text, s }) => <Text style={s.label}>{text}</Text>;
const FieldError = ({ msg, s }) => (msg ? <Text style={s.errorText}>⚠ {msg}</Text> : null);

export default function EditProfileScreen({ navigation }) {
  const { userToken, refreshUserProfile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", place: "", bio: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [emailEditing,    setEmailEditing]    = useState(false);
  const [emailStep,       setEmailStep]       = useState("form"); // "form" | "otp"
  const [newEmailValue,   setNewEmailValue]   = useState("");
  const [emailError,      setEmailError]      = useState("");
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtp,        setEmailOtp]        = useState("");
  const [emailOtpError,   setEmailOtpError]   = useState("");
  const [emailVerifying,  setEmailVerifying]  = useState(false);
  const pendingEmailRef = React.useRef("");

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${BASE_URL}/user/profile`, { headers: { "auth-token": userToken || "" } });
        const data = await res.json();
        if (data.success && data.user) {
          const u = data.user;
          let firstName = u.firstName || "";
          let lastName  = u.lastName || "";
          if (!firstName && u.name) {
            const parts = u.name.trim().split(" ");
            firstName = parts[0] || "";
            lastName  = parts.slice(1).join(" ") || "";
          }
          setForm({
            firstName, lastName,
            email: u.email || "",
            phone: normalizePhone(u.phone || ""),
            place: u.place || "",
            bio: u.bio || "",
          });
        }
      } catch {
        Alert.alert("Error", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (name, value) => {
    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[0-9]/g, "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "").slice(0, 54);
    } else if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits.replace(/^6?3?/, "");
      digits = digits.slice(0, 12);
      value = "+" + digits;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (form.phone && !/^\+63\d{10}$/.test(form.phone)) e.phone = "Phone number must start with +63 and be followed by exactly 10 digits.";
    if (countWords(form.bio) > 15) e.bio = `15 words max (currently ${countWords(form.bio)})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRequestEmailOtp = async () => {
    setEmailError("");
    const trimmed = (newEmailValue || "").trim();
    if (!trimmed) { setEmailError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError("Enter a valid email address."); return; }
    if (trimmed.toLowerCase() === form.email.toLowerCase()) { setEmailError("This is already your current email."); return; }

    setEmailOtpSending(true);
    try {
      const res  = await fetch(`${BASE_URL}/user/send-email-change-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ newEmail: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        pendingEmailRef.current = trimmed;
        setEmailStep("otp");
        setEmailOtp("");
        setEmailOtpError("");
        Alert.alert("Code Sent", "OTP sent to your current email.");
      } else {
        setEmailError(data.message || "Failed to send OTP");
      }
    } catch {
      setEmailError("Request failed. Please try again.");
    } finally {
      setEmailOtpSending(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setEmailOtpError("");
    if (!/^\d{6}$/.test(emailOtp)) { setEmailOtpError("Enter all 6 digits."); return; }
    setEmailVerifying(true);
    try {
      const res  = await fetch(`${BASE_URL}/user/confirm-email-change`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ newEmail: pendingEmailRef.current, otp: emailOtp }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedEmail = data.email || pendingEmailRef.current;
        setForm((p) => ({ ...p, email: updatedEmail }));
        setEmailEditing(false);
        setEmailStep("form");
        setNewEmailValue("");
        setEmailOtp("");
        await refreshUserProfile();
        Alert.alert("Email Updated", "Your contact email has been changed.");
      } else {
        setEmailOtpError(data.message || "Invalid OTP. Please try again.");
      }
    } catch {
      setEmailOtpError("Verification failed. Please try again.");
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleCancelEmailEdit = () => {
    setEmailEditing(false);
    setEmailStep("form");
    setNewEmailValue("");
    setEmailError("");
    setEmailOtp("");
    setEmailOtpError("");
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res  = await fetch(`${BASE_URL}/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        await refreshUserProfile();
        Alert.alert("Saved", "Your profile has been updated.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Update Failed", data.error || "Something went wrong.");
      }
    } catch {
      Alert.alert("Network Error", "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.accentGold} />
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={s.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.backArrow}>←</Text>
        <Text style={s.backLabel}>Back</Text>
      </TouchableOpacity>

      <Text style={s.pageTitle}>Edit Profile</Text>

      <View style={s.row}>
        <View style={[s.fieldGroup, { flex: 1 }]}>
          <Label text="First Name" s={s} />
          <TextInput
            style={[s.input, errors.firstName && s.inputError]}
            value={form.firstName}
            onChangeText={(v) => handleChange("firstName", v)}
            placeholder="First name"
            placeholderTextColor={colors.bgTertiary}
            maxLength={54}
          />
          <FieldError msg={errors.firstName} s={s} />
        </View>
        <View style={[s.fieldGroup, { flex: 1 }]}>
          <Label text="Last Name" s={s} />
          <TextInput
            style={[s.input, errors.lastName && s.inputError]}
            value={form.lastName}
            onChangeText={(v) => handleChange("lastName", v)}
            placeholder="Last name"
            placeholderTextColor={colors.bgTertiary}
            maxLength={54}
          />
          <FieldError msg={errors.lastName} s={s} />
        </View>
      </View>

      <View style={s.fieldGroup}>
        <View style={s.labelRow}>
          <Label text="Contact Email" s={s} />
          {!emailEditing && (
            <View style={s.lockedBadge}>
              <Text style={s.lockedBadgeText}>LOCKED</Text>
            </View>
          )}
        </View>

        {emailStep === "form" ? (
          <>
            <TextInput
              style={[s.input, !emailEditing && s.inputDisabled, emailError && s.inputError]}
              value={emailEditing ? newEmailValue : form.email}
              editable={emailEditing}
              onChangeText={(v) => { setNewEmailValue(v); setEmailError(""); }}
              placeholder="email@example.com"
              placeholderTextColor={colors.bgTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FieldError msg={emailError} s={s} />

            {!emailEditing ? (
              <TouchableOpacity
                onPress={() => { setEmailEditing(true); setNewEmailValue(form.email); setEmailError(""); }}
                style={s.emailChangeBtn}
                activeOpacity={0.85}
              >
                <Text style={s.emailChangeBtnText}>CHANGE EMAIL</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.emailActionsRow}>
                <TouchableOpacity
                  style={[s.emailSendBtn, emailOtpSending && s.saveBtnDisabled]}
                  onPress={handleRequestEmailOtp}
                  disabled={emailOtpSending}
                  activeOpacity={0.85}
                >
                  {emailOtpSending
                    ? <ActivityIndicator size="small" color={colors.textInverse} />
                    : <Text style={s.emailSendBtnText}>SEND CODE</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.emailCancelBtn}
                  onPress={handleCancelEmailEdit}
                  disabled={emailOtpSending}
                  activeOpacity={0.85}
                >
                  <Text style={s.emailCancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={s.otpBlock}>
            <Text style={s.otpHint}>
              A 6-digit code was sent to{" "}
              <Text style={s.otpHintStrong}>{form.email}</Text>{" "}
              to confirm changing it to{" "}
              <Text style={s.otpHintStrong}>{pendingEmailRef.current}</Text>.
            </Text>

            <TextInput
              style={[s.input, s.otpInput, emailOtpError && s.inputError]}
              value={emailOtp}
              onChangeText={(v) => { setEmailOtp(v.replace(/\D/g, "").slice(0, 6)); setEmailOtpError(""); }}
              placeholder="000000"
              placeholderTextColor={colors.bgTertiary}
              keyboardType="number-pad"
              maxLength={6}
            />
            <FieldError msg={emailOtpError} s={s} />

            <TouchableOpacity
              style={[s.emailSendBtn, { marginTop: 10 }, emailVerifying && s.saveBtnDisabled]}
              onPress={handleVerifyEmailOtp}
              disabled={emailVerifying}
              activeOpacity={0.85}
            >
              {emailVerifying
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={s.emailSendBtnText}>VERIFY & UPDATE EMAIL</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancelEmailEdit}
              style={s.otpBackBtn}
              disabled={emailVerifying}
            >
              <Text style={s.otpBackBtnText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.fieldGroup}>
        <Label text="Phone Number" s={s} />
        <TextInput
          style={[s.input, errors.phone && s.inputError]}
          value={form.phone}
          onChangeText={(v) => handleChange("phone", v)}
          placeholder="+639XXXXXXXXX"
          placeholderTextColor={colors.bgTertiary}
          keyboardType="number-pad"
          maxLength={13}
        />
        <FieldError msg={errors.phone} s={s} />
      </View>

      <View style={s.fieldGroup}>
        <Label text="Place (City / Province)" s={s} />
        <TextInput
          style={s.input}
          value={form.place}
          onChangeText={(v) => handleChange("place", v)}
          placeholder="e.g. Quezon City"
          placeholderTextColor={colors.bgTertiary}
          maxLength={80}
        />
      </View>

      <View style={s.fieldGroup}>
        <View style={s.bioLabelRow}>
          <Label text="Bio" s={s} />
          <Text style={[s.wordCount, countWords(form.bio) > 15 && s.wordCountLow]}>
            {countWords(form.bio)}/15 words
          </Text>
        </View>
        <TextInput
          style={[s.input, s.bioInput, errors.bio && s.inputError]}
          value={form.bio}
          onChangeText={(v) => handleChange("bio", v)}
          placeholder="Tell us a bit about yourself (max. 15 words)…"
          placeholderTextColor={colors.bgTertiary}
          multiline
          textAlignVertical="top"
        />
        <FieldError msg={errors.bio} s={s} />
      </View>

      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.88}
        disabled={saving}
      >
        {saving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={s.saveText}>SAVE CHANGES</Text>}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  center: { flex: 1, backgroundColor: colors.bgPrimary, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_CLEARANCE },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
  backArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: "300" },
  backLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bodyMedium },

  pageTitle: { fontSize: 30, fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 1, marginBottom: 20 },

  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { marginBottom: 14 },

  bioLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wordCount: { fontSize: 11, color: colors.textMuted, marginBottom: 7 },
  wordCountLow: { color: colors.danger },
  bioInput: { minHeight: 96, paddingTop: 14 },

  label: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 7,
    textTransform: "uppercase",
  },

  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  lockedBadge: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 7,
  },
  lockedBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 1, color: colors.textMuted },
  lockedHint: { fontSize: 11, color: colors.textMuted, marginTop: 5, letterSpacing: 0.3 },

  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputDisabled: { color: colors.textMuted, opacity: 0.6 },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 11, color: colors.danger, marginTop: 5, letterSpacing: 0.3 },

  saveBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { ...typography.button, color: colors.textInverse, fontSize: 14 },

  emailChangeBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  emailChangeBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
  },

  emailActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  emailSendBtn: {
    flex: 1,
    backgroundColor: colors.accentGold,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  emailSendBtnText: {
    color: colors.textInverse,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
  },
  emailCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  emailCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
  },

  otpBlock: { marginTop: 4 },
  otpHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  otpHintStrong: { color: colors.textPrimary, fontFamily: fonts.bodyBold },
  otpInput: {
    letterSpacing: 6,
    fontSize: 18,
    fontFamily: fonts.display,
    textAlign: "center",
  },
  otpBackBtn: { alignItems: "center", marginTop: 12 },
  otpBackBtnText: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.4 },
});
