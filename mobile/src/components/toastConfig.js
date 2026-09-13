import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fonts, shadows } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Custom react-native-toast-message layout — matches AlertHost's card
// language exactly (light-grey rounded square, same text colors) instead
// of a colored-accent-bar banner, so alerts and toasts read as one
// consistent system rather than two different designs.
const TYPE_META = {
  success: { icon: "checkmark-circle" },
  error:   { icon: "close-circle" },
  info:    { icon: "information-circle" },
};

function ToastCard({ type, text1, text2 }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const meta = TYPE_META[type] || TYPE_META.info;
  return (
    <View style={s.card}>
      <Ionicons name={meta.icon} size={18} color={colors.textPrimary} style={s.icon} />
      <View style={s.textWrap}>
        {text1 ? <Text style={s.text1} numberOfLines={1}>{text1}</Text> : null}
        {text2 ? <Text style={s.text2} numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (props) => <ToastCard type="success" {...props} />,
  error: (props) => <ToastCard type="error" {...props} />,
  info: (props) => <ToastCard type="info" {...props} />,
};

const makeStyles = (colors) => StyleSheet.create({
  card: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgTertiary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.md,
  },
  icon: { marginRight: 10 },
  textWrap: { flex: 1 },
  text1: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  text2: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
    marginTop: 2,
  },
});
