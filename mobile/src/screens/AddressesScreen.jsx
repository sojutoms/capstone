import React, { useCallback, useMemo, useState } from "react";
import { BASE_URL } from "../api/config";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../utils/customAlert";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useAuth } from "../context/AuthContext";
import { fonts, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

export default function AddressesScreen({ navigation }) {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingIdx, setDeletingIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingIdx, setSavingIdx] = useState(null);

  const fetchAddresses = useCallback(async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/getsavedaddresses`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) setAddresses(data.addresses || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses])
  );

  const confirmDelete = (index) => {
    Alert.alert(
      "Remove Address",
      "Remove this saved address?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteAddress(index) },
      ]
    );
  };

  const deleteAddress = async (index) => {
    setDeletingIdx(index);
    try {
      const res  = await fetch(`${BASE_URL}/deleteaddress/${index}`, {
        method: "DELETE",
        headers: { "auth-token": userToken },
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        Toast.show({ type: "success", text1: "Address removed" });
      } else {
        Toast.show({ type: "error", text1: data.error || "Failed to remove address" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Network error" });
    } finally {
      setDeletingIdx(null);
    }
  };

  const startEdit = (index) => {
    const addr = addresses[index];
    setEditingIdx(index);
    setEditErrors({});
    setEditForm({
      firstName: addr.firstName || "",
      lastName:  addr.lastName || "",
      email:     addr.email || "",
      phone:     addr.phone || "+63",
      street:    addr.street || "",
    });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditForm(null);
    setEditErrors({});
  };

  const handleEditChange = (name, value) => {
    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[0-9]/g, "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "").slice(0, 54);
    } else if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits.replace(/^6?3?/, "");
      digits = digits.slice(0, 12);
      value = "+" + digits;
    }
    setEditForm((p) => ({ ...p, [name]: value }));
    if (editErrors[name]) setEditErrors((p) => ({ ...p, [name]: "" }));
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.firstName.trim()) e.firstName = "First name is required";
    if (!editForm.lastName.trim())  e.lastName  = "Last name is required";
    if (!editForm.email.trim())     e.email     = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(editForm.email)) e.email = "Invalid email";
    if (!editForm.street.trim())    e.street    = "Street is required";
    if (!/^\+63\d{10}$/.test(editForm.phone || "")) e.phone = "Phone must start with +63 followed by 10 digits.";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveEdit = async () => {
    if (!validateEdit()) return;
    setSavingIdx(editingIdx);
    try {
      const current = addresses[editingIdx];
      const merged  = { ...current, ...editForm };
      const res  = await fetch(`${BASE_URL}/updateaddress/${editingIdx}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken },
        body: JSON.stringify(merged),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        cancelEdit();
        Toast.show({ type: "success", text1: "Address updated" });
      } else {
        Toast.show({ type: "error", text1: data.error || "Failed to update address" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Network error" });
    } finally {
      setSavingIdx(null);
    }
  };

  const renderAddress = ({ item: addr, index }) => {
    const isEditing = editingIdx === index;
    if (isEditing && editForm) {
      return (
        <View style={s.card}>
          <View style={s.editRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>FIRST NAME</Text>
              <TextInput
                style={[s.input, editErrors.firstName && s.inputError]}
                value={editForm.firstName}
                onChangeText={(v) => handleEditChange("firstName", v)}
                placeholderTextColor={colors.bgTertiary}
              />
              {editErrors.firstName && <Text style={s.errorText}>{editErrors.firstName}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>LAST NAME</Text>
              <TextInput
                style={[s.input, editErrors.lastName && s.inputError]}
                value={editForm.lastName}
                onChangeText={(v) => handleEditChange("lastName", v)}
                placeholderTextColor={colors.bgTertiary}
              />
              {editErrors.lastName && <Text style={s.errorText}>{editErrors.lastName}</Text>}
            </View>
          </View>

          <Text style={s.fieldLabel}>EMAIL</Text>
          <TextInput
            style={[s.input, editErrors.email && s.inputError]}
            value={editForm.email}
            onChangeText={(v) => handleEditChange("email", v)}
            placeholderTextColor={colors.bgTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {editErrors.email && <Text style={s.errorText}>{editErrors.email}</Text>}

          <Text style={s.fieldLabel}>PHONE NUMBER</Text>
          <TextInput
            style={[s.input, editErrors.phone && s.inputError]}
            value={editForm.phone}
            onChangeText={(v) => handleEditChange("phone", v)}
            placeholder="+639XXXXXXXXX"
            placeholderTextColor={colors.bgTertiary}
            keyboardType="number-pad"
            maxLength={13}
          />
          {editErrors.phone && <Text style={s.errorText}>{editErrors.phone}</Text>}

          <Text style={s.fieldLabel}>STREET ADDRESS</Text>
          <TextInput
            style={[s.input, editErrors.street && s.inputError]}
            value={editForm.street}
            onChangeText={(v) => handleEditChange("street", v)}
            placeholderTextColor={colors.bgTertiary}
          />
          {editErrors.street && <Text style={s.errorText}>{editErrors.street}</Text>}

          <Text style={s.locationNote}>
            To change region/province/city/barangay, delete this address and add a new one at checkout.
          </Text>

          <View style={s.editActions}>
            <TouchableOpacity
              style={[s.saveBtn, savingIdx === index && s.saveBtnDim]}
              onPress={saveEdit}
              disabled={savingIdx === index}
              activeOpacity={0.85}
            >
              {savingIdx === index
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={s.saveBtnText}>SAVE CHANGES</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={cancelEdit}
              disabled={savingIdx === index}
              activeOpacity={0.85}
            >
              <Text style={s.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardName}>{addr.firstName} {addr.lastName}</Text>
          <View style={s.cardActions}>
            <TouchableOpacity
              onPress={() => startEdit(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(index)}
              disabled={deletingIdx === index}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {deletingIdx === index
                ? <ActivityIndicator size="small" color={colors.danger} />
                : <Ionicons name="trash-outline" size={18} color={colors.danger} />
              }
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.cardLine}>{addr.street}</Text>
        <Text style={s.cardLine}>
          {[addr.barangay?.name, addr.cityOrMunicipality?.name].filter(Boolean).join(", ")}
        </Text>
        <Text style={s.cardLine}>
          {[addr.province?.name, addr.region?.name].filter(Boolean).join(", ")}
        </Text>
        <Text style={s.cardPhone}>{addr.phone}</Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ProfileScreen"))}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>DELIVERY ADDRESSES</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.accentGold} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="home-outline" size={40} color={colors.bgTertiary} />
          <Text style={s.emptyTitle}>NO SAVED ADDRESSES</Text>
          <Text style={s.emptySubtitle}>
            Addresses you save at checkout will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={addresses}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderAddress}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: { width: 24 },
  backArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: "300" },
  headerTitle: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.display, letterSpacing: 1.5 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.display, letterSpacing: 1.5 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },

  listContent: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE },

  card: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardName: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold },
  cardActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  cardLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  cardPhone: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  editRow: { flexDirection: "row", gap: 10 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 4 },
  locationNote: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 10,
    lineHeight: 15,
  },
  editActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accentGold,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDim: { opacity: 0.6 },
  saveBtnText: {
    color: colors.textInverse,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
  },
});
