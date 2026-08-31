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
        <ActivityIndicator size="large" color="#fff" />
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
            placeholderTextColor="#3A3A3A"
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
            placeholderTextColor="#3A3A3A"
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
          placeholderTextColor="#3A3A3A"
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
          placeholderTextColor="#3A3A3A"
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
          placeholderTextColor="#3A3A3A"
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
          placeholderTextColor="#3A3A3A"
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
        {saving ? <ActivityIndicator size="small" color="#000000" /> : <Text style={s.saveText}>SAVE CHANGES</Text>}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  center: { flex: 1, backgroundColor: "#080808", alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
  backArrow: { color: "#FFFFFF", fontSize: 20, fontWeight: "300" },
  backLabel: { color: "#888", fontSize: 14, fontWeight: "500" },

  pageTitle: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.4, marginBottom: 20 },

  row: { flexDirection: "row", gap: 10 },
  fieldGroup: { marginBottom: 14 },

  bioLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wordCount: { fontSize: 11, color: "#555", marginBottom: 7 },
  wordCountLow: { color: "#E84A4A" },
  bioInput: { minHeight: 96, paddingTop: 14 },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#555",
    marginBottom: 7,
    textTransform: "uppercase",
  },

  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  lockedBadge: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 7,
  },
  lockedBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 1, color: "#666" },
  lockedHint: { fontSize: 11, color: "#555", marginTop: 5, letterSpacing: 0.3 },

  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: "#FFFFFF",
  },
  inputDisabled: { color: "#666", opacity: 0.6 },
  inputError: { borderColor: "#E84A4A" },
  errorText: { fontSize: 11, color: "#E84A4A", marginTop: 5, letterSpacing: 0.3 },

  saveBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: "#000000", fontWeight: "900", fontSize: 14, letterSpacing: 3 },
});
