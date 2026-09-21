import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { TERMS_CONTENT } from "../constants/legalContent";

export default function LegalScreen({ navigation, route }) {
  const type = route?.params?.type === "privacy" ? "privacy" : "terms";
  const content = TERMS_CONTENT[type];
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
        <Text style={s.headerTitle} numberOfLines={1}>{content.title.toUpperCase()}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {content.sections.map((sec) => (
          <View key={sec.heading} style={s.section}>
            <Text style={s.sectionHeading}>{sec.heading}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}
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
  headerTitle: { flex: 1, textAlign: "center", color: colors.textPrimary, fontSize: 14, fontFamily: fonts.display, letterSpacing: 1.5 },

  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },

  section: { marginBottom: 20 },
  sectionHeading: { color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 6 },
  sectionBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
});
