import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  GestureResponderEvent,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, fonts, typography } from "../theme";

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);

  // double-tap detection
  const lastTap = useRef(null);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) {
      // double tap — flip camera
      setFacing((prev) => (prev === "back" ? "front" : "back"));
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const takePicture = async () => {
    if (cameraRef.current && !capturing) {
      setCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync();
        Alert.alert("📸 Captured", "Your photo has been taken.");
      } catch {
        Alert.alert("Error", "Could not take photo.");
      } finally {
        setCapturing(false);
      }
    }
  };

  // ── PERMISSION NOT LOADED ──
  if (!permission) return <View style={styles.container} />;

  // ── PERMISSION DENIED ──
  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>CAMERA ACCESS</Text>
        <Text style={styles.permMessage}>
          We need access to your camera to continue.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>GRANT PERMISSION</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permBack}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.permBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" hidden />

      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        onTouchEnd={handleDoubleTap}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.navigate("Home")}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── DOUBLE TAP HINT ── */}
        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>Double tap to flip</Text>
        </View>

        {/* ── BOTTOM BAR ── */}
        <View style={styles.bottomBar}>

          {/* Flip / switch camera button — left side like Instagram */}
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={toggleFacing}
            activeOpacity={0.75}
          >
            {/* Two arrows forming a circle — flip icon */}
            <Text style={styles.flipIcon}>↺</Text>
          </TouchableOpacity>

          {/* Shutter button — center */}
          <TouchableOpacity
            onPress={takePicture}
            activeOpacity={0.85}
            disabled={capturing}
            style={styles.shutterWrap}
          >
            <View style={[styles.shutterRing, capturing && styles.shutterRingCapturing]}>
              <View style={[styles.shutterCore, capturing && styles.shutterCoreCapturing]} />
            </View>
          </TouchableOpacity>

          {/* Empty right side to balance */}
          <View style={styles.flipBtn} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    width: "100%",
  },

  // ── PERMISSION ──
  permContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  permIcon: { fontSize: 48, marginBottom: 20 },
  permTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: 2,
    marginBottom: 12,
  },
  permMessage: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  permBtn: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 6,
    marginBottom: 14,
  },
  permBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 11,
  },
  permBack: { paddingVertical: 10 },
  permBackText: { color: colors.textMuted, fontSize: 12, letterSpacing: 1 },

  // ── TOP BAR ──
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    // dark gradient from top
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },

  // ── HINT ──
  hintWrap: {
    position: "absolute",
    top: 120,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
  },

  // ── BOTTOM BAR ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingTop: 24,
    paddingHorizontal: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  // FLIP BUTTON
  flipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  flipIcon: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 28,
  },

  // SHUTTER
  shutterWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterRingCapturing: {
    borderColor: "rgba(255,255,255,0.3)",
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
  },
  shutterCoreCapturing: {
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});