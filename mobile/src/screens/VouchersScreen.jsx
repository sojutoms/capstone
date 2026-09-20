import React, { useCallback, useMemo, useState } from "react";
import { BASE_URL } from "../api/config";
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
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { useAuth } from "../context/AuthContext";
import { fonts, radius, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const TABS = ["unused", "used", "expired"];

export default function VouchersScreen({ navigation }) {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [points, setPoints] = useState(0);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unused");
  const [pointsToRedeem, setPointsToRedeem] = useState(100);
  const [redeeming, setRedeeming] = useState(false);

  const fetchVouchers = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch(`${BASE_URL}/my-vouchers`, {
        headers: { "auth-token": userToken },
      });
      const data = await res.json();
      if (data.success) {
        setVouchers(data.vouchers || []);
        setPoints(data.points || 0);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      fetchVouchers();
    }, [fetchVouchers])
  );

  const handleRedeem = async () => {
    if (points < pointsToRedeem) return;
    setRedeeming(true);
    try {
      const res = await fetch(`${BASE_URL}/redeempoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken },
        body: JSON.stringify({ pointsToRedeem }),
      });
      const data = await res.json();
      if (data.success) {
        Toast.show({ type: "success", text1: data.message || "Voucher redeemed" });
        await fetchVouchers();
        setPointsToRedeem(100);
      } else {
        Toast.show({ type: "error", text1: data.error || "Redemption failed" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Server error" });
    } finally {
      setRedeeming(false);
    }
  };

  const copyCode = async (code) => {
    await Clipboard.setStringAsync(code);
    Toast.show({ type: "success", text1: "Voucher code copied!" });
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (activeTab === "unused") return v.active && !v.used;
    if (activeTab === "used") return v.used;
    if (activeTab === "expired") return v.expired && !v.used;
    return false;
  });

  const renderVoucher = ({ item: v }) => (
    <View style={[s.card, v.expired && s.cardExpired]}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={1}>{v.title}</Text>
        <View style={[s.statusTag, v.active ? s.statusActive : s.statusInactive]}>
          <Text style={s.statusText}>{v.active ? "ACTIVE" : v.used ? "USED" : "EXPIRED"}</Text>
        </View>
      </View>

      {!!v.message && <Text style={s.cardMessage}>{v.message}</Text>}

      <TouchableOpacity style={s.codeBox} onPress={() => copyCode(v.code)} activeOpacity={0.7}>
        <Text style={s.codeText}>{v.code}</Text>
        <Text style={s.copyHint}>Tap to copy code</Text>
      </TouchableOpacity>

      <Text style={s.expiryText}>
        {v.expiresAt ? `Expires: ${new Date(v.expiresAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}` : "No expiry"}
      </Text>
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
        <Text style={s.headerTitle}>VOUCHERS & PROMOS</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.accentGold} />
        </View>
      ) : (
        <FlatList
          data={filteredVouchers}
          keyExtractor={(item) => item._id}
          renderItem={renderVoucher}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <>
              {/* ── POINTS DASHBOARD ── */}
              <View style={s.pointsCard}>
                <Text style={s.balanceLabel}>Your Balance</Text>
                <Text style={s.balanceValue}>{points.toLocaleString()} PTS</Text>
                <Text style={s.balanceEstimate}>
                  Estimated Value: ₱{((points / 100) * 50).toLocaleString()}
                </Text>

                <View style={s.divider} />

                <Text style={s.redeemTitle}>Redeem for Voucher</Text>
                <View style={s.redeemRow}>
                  <TouchableOpacity
                    style={s.stepBtn}
                    disabled={pointsToRedeem <= 100}
                    onPress={() => setPointsToRedeem(Math.max(100, pointsToRedeem - 100))}
                  >
                    <Text style={[s.stepBtnText, pointsToRedeem <= 100 && s.stepBtnTextDim]}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.redeemAmount}>{pointsToRedeem}</Text>
                  <TouchableOpacity
                    style={s.stepBtn}
                    disabled={pointsToRedeem + 100 > points}
                    onPress={() => setPointsToRedeem(pointsToRedeem + 100)}
                  >
                    <Text style={[s.stepBtnText, pointsToRedeem + 100 > points && s.stepBtnTextDim]}>+</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.redeemBtn, (redeeming || points < 100 || pointsToRedeem > points) && s.redeemBtnDim]}
                  onPress={handleRedeem}
                  disabled={redeeming || points < 100 || pointsToRedeem > points}
                >
                  <Text style={s.redeemBtnText}>
                    {redeeming ? "REDEEMING…" : `REDEEM FOR ₱${(pointsToRedeem / 100) * 50}`}
                  </Text>
                </TouchableOpacity>
                <Text style={s.redeemHint}>Redeem in increments of 100 points. 100 pts = ₱50.</Text>
              </View>

              {/* ── TABS ── */}
              <View style={s.tabsRow}>
                {TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tab, activeTab === tab && s.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>No {activeTab} vouchers found.</Text>
            </View>
          }
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
  headerTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.display, letterSpacing: 1.5 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  listContent: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE },

  /* ── points dashboard ── */
  pointsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  balanceValue: { color: colors.textPrimary, fontSize: 32, fontFamily: fonts.display, letterSpacing: 1, marginTop: 4 },
  balanceEstimate: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 16 },
  redeemTitle: { color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 12 },
  redeemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
  },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { color: colors.textPrimary, fontSize: 18, fontFamily: fonts.bodyBold },
  stepBtnTextDim: { color: colors.textMuted },
  redeemAmount: { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.display, minWidth: 60, textAlign: "center" },
  redeemBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  redeemBtnDim: { backgroundColor: colors.bgTertiary },
  redeemBtnText: { ...typography.button, color: colors.textInverse, fontSize: 12 },
  redeemHint: { color: colors.textMuted, fontSize: 10, textAlign: "center", marginTop: 10 },

  /* ── tabs ── */
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  tabText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.bodyBold },
  tabTextActive: { color: colors.textInverse },

  /* ── voucher card ── */
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },
  cardExpired: { opacity: 0.55 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bodyBold },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  statusActive: { backgroundColor: colors.accentGoldWash },
  statusInactive: { backgroundColor: colors.bgTertiary },
  statusText: { color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, fontFamily: fonts.bodyBold },
  cardMessage: { color: colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 19 },
  codeBox: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderLight,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  codeText: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.display, letterSpacing: 2 },
  copyHint: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  expiryText: { color: colors.textMuted, fontSize: 11, marginTop: 10 },

  emptyWrap: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
