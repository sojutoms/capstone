import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  Easing,
  StatusBar,
} from "react-native";
import { colors } from "../theme";

const SplashScreen = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Smooth, unhurried grow-in — no bouncy spring — then a brief hold so
    // the logo actually registers, then a gentle continued grow + fade out
    // (not the old abrupt zoom-past-camera to scale 20).
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 700,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 700);
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <Animated.Image
        source={require("../../assets/GSPH-removebg.png")}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            tintColor: colors.white,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Fixed black, not colors.bgPrimary — the splash brand background
    // stays black regardless of the app's light/dark theme.
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
  },
});