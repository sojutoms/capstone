import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "../utils/customAlert";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useAuth } from "../context/AuthContext";
import { fonts, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

export default function AddressesScreen({ navigation }) {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingIdx, setDeletingIdx] = useState(null);

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

  const renderAddress = ({ item: addr, index }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardName}>{addr.firstName} {addr.lastName}</Text>
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

  return (
    <View style={s.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      <View style={s.header}>
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
  cardLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  cardPhone: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
