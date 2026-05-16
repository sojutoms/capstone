import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { Video } from "expo-av";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    title: "Step into\nthe Game",
    subtitle: "Discover elite basketball shoes built for performance.",
    counter: 1,
    color: "#989794",
    brand: "KICKS",     // 👈 add this
  },
  {
    id: "2",
    title: "Built for\nSpeed",
    subtitle: "Lightweight comfort for explosive movement.",
    counter: 2,
    color: "#525251",
    brand: "LUXURY",    // 👈 add this
  },
  {
    id: "3",
    title: "Own Every\nCourt",
    subtitle: "Dominate with style and confidence.",
    counter: 3,
    color: "#ffffff",
    brand: "LIFESTYLE", // 👈 add this
  },
];

export default function Onboarding({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { completeOnboarding } = useAuth();

  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslateY = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const counterScale = useRef(new Animated.Value(1)).current;

  // Animate line in on mount
  useEffect(() => {
    Animated.timing(lineWidth, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  // Animate on slide change
  useEffect(() => {
    lineWidth.setValue(0);
    titleOpacity.setValue(0);
    titleTranslateY.setValue(12);

    // Counter pill pop
    counterScale.setValue(0.7);
    Animated.spring(counterScale, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();

    if (currentIndex === slides.length - 1) {
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        delay: 300,
        useNativeDriver: true,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [currentIndex]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.floor(offsetX / width + 0.5);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const currentSlide = slides[currentIndex];

  const renderItem = ({ item }) => <View style={styles.slide} />;

  return (
    <View style={styles.container}>

      {/* VIDEO */}
      {Platform.OS === "web" ? (
        <video
          src={require("../../assets/onboarding.mp4")}
          autoPlay
          loop
          muted
          playsInline
          style={styles.webVideo}
        />
      ) : (
        <Video
          source={require("../../assets/onboarding.mp4")}
          style={styles.video}
          resizeMode="cover"
          shouldPlay
          isLooping
          isMuted
        />
      )}

      {/* Top overlay — keeps brand + counter readable */}
      
      {/* Bottom overlay */}
      <View style={styles.overlayBottom} />

      {/* Brand mark — top left, colored dot matches accent */}
      <View style={styles.brandMark}>
        <View style={[styles.brandDot, { backgroundColor: currentSlide.color }]} />
        <Text style={styles.brandText}>{currentSlide.brand}</Text>
      </View>

      {/* Counter — top right, white circle, current number only, pops on change */}
      <Animated.View style={[styles.counterPill, { transform: [{ scale: counterScale }] }]}>
        <Text style={styles.counterNumber}>{currentSlide.counter}</Text>
      </Animated.View>

      {/* FlatList — invisible slides for scroll/paging */}
      <FlatList
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      />

      {/* Bottom content */}
      <View style={styles.bottomContent} pointerEvents="box-none">

        {/* Accent line — grey shade per slide, coordinates with KICKS dot */}
        <Animated.View
          style={[
            styles.accentLine,
            {
              backgroundColor: currentSlide.color,
              width: lineWidth.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 28],
              }),
            },
          ]}
        />

        {/* Title + Subtitle */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
        </Animated.View>

        {/* Progress pills — grey shade per slide */}
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.pill,
                {
                  width: currentIndex === i ? 24 : 6,
                  backgroundColor: currentSlide.color,
                  opacity: currentIndex === i ? 1 : 0.3,
                },
              ]}
            />
          ))}
        </View>

        {/* Swipe hint */}
        {currentIndex < slides.length - 1 && (
          <Text style={styles.swipeHint}>SWIPE TO EXPLORE  →</Text>
        )}

        {/* Get Started — plain white, centered black text, no arrow */}
        {currentIndex === slides.length - 1 && (
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={async () => {
                await completeOnboarding();
                navigation.replace("AuthChoice");
              }}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  video: {
    position: "absolute",
    width,
    height,
  },

  webVideo: {
    position: "absolute",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  // Top overlay
  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.22,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  // Bottom overlay
  overlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 100,
    backgroundColor: "rgba(0,0,0,0.78)",
  },

  slide: {
    width,
    height,
  },

  // Brand mark
  brandMark: {
    position: "absolute",
    top: 52,
    left: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },

  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  brandText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 4,
  },

  // White circle counter — current slide number only
  counterPill: {
    position: "absolute",
    top: 44,
    right: 28,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  counterNumber: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },

  // Bottom content — sits above overlay
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === "ios" ? 52 : 36,
    zIndex: 10,
  },

  // Accent line — color comes from currentSlide.color
  accentLine: {
    height: 2,
    borderRadius: 1,
    marginBottom: 14,
  },

  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 260,
  },

  // Pagination pills
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },

  pill: {
    height: 4,
    borderRadius: 2,
  },

  swipeHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    marginTop: 8,
  },

  // Plain white button, black text, centered, no arrow
  button: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 1,
  },
});