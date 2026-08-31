import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { useEffect, useRef } from "react";
import { Video } from "expo-av";
import { useFonts, BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { BlurView } from "expo-blur";
import { colors, fonts } from "../theme";

const { width, height } = Dimensions.get("window");
const videoWidth = height * (16 / 9);

// ─── Shimmer Button ───────────────────────────────────────────────────────────
function ShimmerButton({ label, onPress, ghost }) {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (!ghost) {
      const anim = Animated.loop(
        Animated.timing(shimmerX, { toValue: 2, duration: 2600, useNativeDriver: true })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [ghost]);

  return (
    <Pressable
      style={({ pressed }) => [
        btnStyles.btn,
        ghost ? btnStyles.ghost : btnStyles.solid,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.88 },
      ]}
      onPress={onPress}
    >
      <Text style={[btnStyles.text, ghost && btnStyles.ghostText]}>{label}</Text>
      {!ghost && (
        <Animated.View
          style={[
            btnStyles.shimmer,
            {
              transform: [
                {
                  translateX: shimmerX.interpolate({
                    inputRange: [-1, 2],
                    outputRange: ["-100%", "200%"],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  solid: { backgroundColor: "#f5f5f5" },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  text: {
    color: "#0a0a0a",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 2.5,
  },
  ghostText: { color: "rgba(255,255,255,0.7)" },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AuthChoice = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.1)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;
  const buttonTranslate = useRef(new Animated.Value(30)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const watermarkAnim = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(40)).current;
  const [fontsLoaded] = useFonts({ BebasNeue_400Regular });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslate, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslate, {
        toValue: 0,
        duration: 700,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: false,
      }),
      Animated.timing(watermarkAnim, {
        toValue: 1,
        duration: 1400,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 700,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>

      {/* ── VIDEO ── */}
      {Platform.OS === "web" ? (
        <video
          src={require("../../assets/authchoice.mp4")}
          autoPlay
          loop
          muted
          playsInline
          style={styles.webVideo}
        />
      ) : (
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            position: "absolute",
          }}
        >
          <Video
            source={require("../../assets/authchoice.mp4")}
            style={{
              width: videoWidth,
              height: height,
              transform: [{ translateX: -(videoWidth - width) / 2 }],
            }}
            resizeMode="cover"
            shouldPlay
            isLooping
            isMuted
            useNativeControls={false}
            playsInSilentModeIOS
          />
        </Animated.View>
      )}

      {/* ── SHADOW OVERLAY ── */}
      <BlurView
        intensity={18}
        tint="dark"
        style={styles.blurOverlay}
      />
      <View style={styles.darkOverlay} />
      {/* ── GHOST WATERMARK ── */}
      <Animated.View
        style={[
          styles.watermarkContainer,
          {
            opacity: watermarkAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.06],
            }),
            transform: [
              {
                translateY: watermarkAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.watermark}>GOOD{"\n"}SOLES</Text>
      </Animated.View>

      {/* ── BOTTOM CARD ── */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
       
        {/* Title */}
        <Animated.View style={{ transform: [{ translateY: titleTranslate }], marginBottom: 20 }}>
          <Text style={styles.title}>Welcome to{"\n"}Goodsoles</Text>
          <Text style={styles.subtitle}>Where your next pair begins.</Text>
          </Animated.View>

        
        {/* Buttons */}
        <Animated.View style={{ transform: [{ translateY: buttonTranslate }] }}>
  <ShimmerButton
    label="SIGN IN"
    onPress={() => navigation.navigate("LoginScreen")}
    ghost={false}
  />
  <View style={{ marginTop: 10 }}>
    <ShimmerButton
      label="CREATE ACCOUNT"
      onPress={() => navigation.navigate("SignupScreen")}
      ghost={true}
    />
  </View>
</Animated.View>

        
      </Animated.View>
    </View>
  );
};

export default AuthChoice;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },

  webVideo: {
    position: "absolute",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  blurOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1,
},
darkOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.55)",
  zIndex: 1,
},
  // ── Watermark ──
  watermarkContainer: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2,
},

  watermark: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: width * 0.72,
    color: "#fff",
    lineHeight: width * 0.68,
    textAlign: "center",
    letterSpacing: -2,
  },


  // ── Bottom card ──
  card: {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  paddingHorizontal: 26,
  paddingTop: 28,
  paddingBottom: Platform.OS === "ios" ? 52 : 36,
  backgroundColor: "rgba(8,8,8,0.75)",
  borderTopWidth: 0.3,
  borderTopColor: "rgba(255,255,255,0.08)",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  zIndex: 10,
},

  // ── Title ──
title: {
  color: colors.textPrimary,
  fontFamily: fonts.display,
  fontSize: 30,
  lineHeight: 32,
  letterSpacing: 0.5,
  marginBottom: 4,
},
subtitle: {
  color: "rgba(255,255,255,0.35)",
  fontSize: 11,
  letterSpacing: 0.3,
  marginBottom: 22,
},

  // ── Card divider ──
  cardDivider: {
    height: 0,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 12,
  },

  // ── Or divider ──
  btnDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },

  btnDividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  btnDividerText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 10,
    letterSpacing: 1.5,
  },

  // ── Footer ──
  footerNote: {
    textAlign: "center",
    color: "rgba(255,255,255,0.18)",
    fontSize: 10,
    marginTop: 20,
    letterSpacing: 0.3,
  },

  footerLink: {
    color: "rgba(255,255,255,0.35)",
    textDecorationLine: "underline",
  },
});