import React, { useEffect, useState, useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { subscribeAlert } from "../utils/alertBus";
import { fonts } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Renders whatever gets published on alertBus as the app's own styled
// modal, instead of the native OS Alert.alert dialog. Mounted once at the
// navigation root (see App.js) alongside ChatWidget/FlyToCartOverlay.
//
// Layout follows the classic compact iOS alert (centered title + message,
// a thin divider, plain-text buttons split into columns) so it reads as
// familiar system UI — but set in the app's own Bebas/Outfit fonts and
// theme colors instead of San Francisco/iOS blue, so it stays uniform with
// the rest of the app.
export default function AlertHost() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [config, setConfig] = useState(null);

  useEffect(() => subscribeAlert(setConfig), []);

  if (!config) return null;

  const buttons = config.buttons?.length ? config.buttons : [{ text: "OK" }];
  const cancelable = config.options?.cancelable !== false;

  const close = () => setConfig(null);

  const handlePress = (btn) => {
    close();
    btn.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancelable ? close : undefined}>
      <View style={s.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={cancelable ? close : undefined}
        />
        <View style={s.card}>
          <View style={s.body}>
            {config.title ? <Text style={s.title}>{config.title}</Text> : null}
            {config.message ? <Text style={s.message}>{config.message}</Text> : null}
          </View>

          <View style={[s.buttonRow, buttons.length > 2 && s.buttonColumn]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.button,
                  buttons.length <= 2 && s.buttonInRow,
                  i > 0 && (buttons.length > 2 ? s.buttonDividerTop : s.buttonDividerLeft),
                ]}
                activeOpacity={0.5}
                onPress={() => handlePress(btn)}
              >
                <Text
                  style={[
                    s.buttonText,
                    btn.style === "destructive" && s.buttonTextDestructive,
                    btn.style === "cancel" && s.buttonTextCancel,
                  ]}
                >
                  {btn.text || "OK"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => {
const DIVIDER = colors.borderLight;

return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  card: {
    width: "100%",
    maxWidth: 270,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  message: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  buttonColumn: {
    flexDirection: "column",
  },
  button: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buttonInRow: {
    // no extra styling needed — flex:1 on `button` already splits the row
    // evenly; kept as a hook in case row-only spacing is needed later.
  },
  buttonDividerLeft: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: DIVIDER,
  },
  buttonDividerTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  buttonTextCancel: {
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
  },
  buttonTextDestructive: {
    color: colors.danger,
  },
});
};
