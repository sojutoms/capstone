import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius, typography } from "../theme";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

const Label = ({ text }) => <Text style={s.label}>{text}</Text>;
const FieldError = ({ msg }) => (msg ? <Text style={s.errorText}>⚠ {msg}</Text> : null);

export default function EditProfileScreen({ navigation }) {
  const { userToken, refreshUserProfile } = useAuth();

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", place: "", bio: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            phone: u.phone || "",
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
      value = value.replace(/\D/g, "").slice(0, 11);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (form.phone && !/^\d{11}$/.test(form.phone)) e.phone = "Must be 11 digits";
    if (countWords(form.bio) > 15) e.bio = `15 words max (currently ${countWords(form.bio)})`;
    setErrors(e);
    return Object.keys(e).length === 0;
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
          <Label text="First Name" />
          <TextInput
            style={[s.input, errors.firstName && s.inputError]}
            value={form.firstName}
            onChangeText={(v) => handleChange("firstName", v)}
            placeholder="First name"
            placeholderTextColor={colors.bgTertiary}
            maxLength={54}
          />
          <FieldError msg={errors.firstName} />
        </View>
        <View style={[s.fieldGroup, { flex: 1 }]}>
          <Label text="Last Name" />
          <TextInput
            style={[s.input, errors.lastName && s.inputError]}
            value={form.lastName}
            onChangeText={(v) => handleChange("lastName", v)}
            placeholder="Last name"
            placeholderTextColor={colors.bgTertiary}
            maxLength={54}
          />
          <FieldError msg={errors.lastName} />
        </View>
      </View>

      <View style={s.fieldGroup}>
        <View style={s.labelRow}>
          <Label text="Contact Email" />
          <View style={s.lockedBadge}>
            <Text style={s.lockedBadgeText}>LOCKED</Text>
          </View>
        </View>
        <TextInput
          style={[s.input, s.inputDisabled]}
          value={form.email}
          editable={false}
          placeholder="email@example.com"
          placeholderTextColor={colors.bgTertiary}
        />
        <Text style={s.lockedHint}>Email cannot be changed</Text>
      </View>

      <View style={s.fieldGroup}>
        <Label text="Phone" />
        <TextInput
          style={[s.input, errors.phone && s.inputError]}
          value={form.phone}
          onChangeText={(v) => handleChange("phone", v)}
          placeholder="09XXXXXXXXX"
          placeholderTextColor={colors.bgTertiary}
          keyboardType="number-pad"
          maxLength={11}
        />
        <FieldError msg={errors.phone} />
      </View>

      <View style={s.fieldGroup}>
        <Label text="Place (City / Province)" />
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
          <Label text="Bio" />
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
        <FieldError msg={errors.bio} />
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

const s = StyleSheet.create({
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
});
