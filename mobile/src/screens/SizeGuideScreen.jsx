import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const MEASURE_TIPS = [
  "Measure your feet at the end of the day when they're largest",
  "Stand on a piece of paper and trace your foot",
  "Measure from heel to longest toe",
  "Use the measurement in inches or centimeters",
  "If between sizes, we recommend sizing up",
];

const MENS_CHART = [
  ["7", "6", "40", "25.0"],
  ["8", "7", "41", "25.5"],
  ["9", "8", "42", "26.0"],
  ["10", "9", "43", "27.0"],
  ["11", "10", "44", "27.5"],
  ["12", "11", "45", "28.0"],
];

const WOMENS_CHART = [
  ["6", "4", "36", "22.5"],
  ["7", "5", "37", "23.0"],
  ["8", "6", "38", "23.5"],
  ["9", "7", "39", "24.0"],
  ["10", "8", "40", "25.0"],
  ["11", "9", "41", "25.5"],
];

const WIDTH_GUIDE = [
  { label: "Narrow (B)", desc: "For feet that are slimmer than average" },
  { label: "Medium (D)", desc: "Standard width for most people" },
  { label: "Wide (E/EE)", desc: "For feet that are wider than average" },
];

function SizeTable({ headers, rows, s }) {
  return (
    <View style={s.card}>
      <View style={s.tableHeader}>
        {headers.map((h) => <Text key={h} style={[s.th, s.col]}>{h}</Text>)}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={s.tableRow}>
          {row.map((cell, j) => <Text key={j} style={[s.td, s.col]}>{cell}</Text>)}
        </View>
      ))}
    </View>
  );
}

export default function SizeGuideScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);

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
        <Text style={s.headerTitle}>SIZE GUIDE</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <Text style={s.sectionTitle}>How to Measure Your Feet</Text>
        <View style={s.card}>
          {MEASURE_TIPS.map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipCheck}>✓</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Men's Shoe Size Chart</Text>
        <SizeTable headers={["US", "UK", "EU", "CM"]} rows={MENS_CHART} s={s} />

        <Text style={s.sectionTitle}>Women's Shoe Size Chart</Text>
        <SizeTable headers={["US", "UK", "EU", "CM"]} rows={WOMENS_CHART} s={s} />

        <Text style={s.sectionTitle}>Width Guide</Text>
        <View style={s.widthRow}>
          {WIDTH_GUIDE.map((w, i) => (
            <View key={i} style={s.widthCard}>
              <Text style={s.widthLabel}>{w.label}</Text>
              <Text style={s.widthDesc}>{w.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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

  body: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  sectionTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.3,
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentGold,
  },
  tipCheck: { color: colors.accentGold, fontSize: 13, fontFamily: fonts.bodyBold, marginTop: 1 },
  tipText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fonts.bodyRegular },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.accentGoldWash,
    paddingVertical: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  col: { flex: 1, textAlign: "center" },
  th: { fontSize: 11, color: colors.accentGoldLight, letterSpacing: 1, fontFamily: fonts.bodyBold },
  td: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodyRegular },

  widthRow: { flexDirection: "row", gap: 10 },
  widthCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  widthLabel: { fontSize: 12, color: colors.textPrimary, fontFamily: fonts.bodyBold, marginBottom: 6 },
  widthDesc: { fontSize: 10.5, color: colors.textMuted, lineHeight: 15, fontFamily: fonts.bodyRegular },
});
