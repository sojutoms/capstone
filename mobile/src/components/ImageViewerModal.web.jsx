import React from "react";
import { Modal, View, Image, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

// react-native-image-viewing has no web build (only .ios.js/.android.js
// internals), so Metro can't bundle it for `expo start --web`. This is the
// web-only counterpart Metro picks up automatically via the .web.jsx
// extension — a plain, non-zoomable full-screen viewer with prev/next taps.
export default function ImageViewerModal({ images, imageIndex, visible, onRequestClose, onImageIndexChange }) {
  if (!images?.length) return null;

  const goTo = (delta) => {
    const next = (imageIndex + delta + images.length) % images.length;
    onImageIndexChange?.(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.closeBtn} onPress={onRequestClose} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <Image source={images[imageIndex]} style={s.image} resizeMode="contain" />

        {images.length > 1 && (
          <>
            <TouchableOpacity style={[s.navBtn, s.navLeft]} onPress={() => goTo(-1)} hitSlop={12}>
              <Ionicons name="chevron-back" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.navBtn, s.navRight]} onPress={() => goTo(1)} hitSlop={12}>
              <Ionicons name="chevron-forward" size={30} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "90%",
    height: "80%",
  },
  closeBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    zIndex: 2,
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    padding: 8,
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
});
