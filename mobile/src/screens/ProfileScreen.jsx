import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Image,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { fonts, radius, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useChatSettings } from "../context/ChatSettingsContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

function MenuItem({ icon, label, sublabel, onPress, rightElement, danger, styles, colors }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.menuSublabel}>{sublabel}</Text>
        ) : null}
      </View>
      {rightElement ? rightElement : <Text style={styles.menuArrow}>›</Text>}
    </TouchableOpacity>
  );
}

function Section({ title, children, styles }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { logout, userToken, userProfile: user, refreshUserProfile } = useAuth();
  const { refreshCart } = useCart();
  const { favorites, refreshFavorites } = useFavorites();
  const { colors, isDark, toggleTheme } = useTheme();
  const { showEverywhere, setShowEverywhere } = useChatSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // iOS only: root here is a plain View (no SafeAreaView), so without this
  // the top content renders straight under the status bar/notch.
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // limit=1 — this only needs the `total` count, not the actual order list.
  const fetchOrderCount = async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/orderhistory?page=1&limit=1&status=all`, {
        headers: { "auth-token": userToken },
      });
      const data = await res.json();
      if (data.success) setOrderCount(data.total ?? (data.orders || []).length);
    } catch {}
  };

  const fetchReviewCount = async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/myreviews`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) setReviewCount((data.reviews || []).length);
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrderCount();
      fetchReviewCount();
    }, [userToken])
  );

  const handleAvatarLongPress = () => {
    if (user?.photoURL) setViewingPhoto(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshUserProfile(), refreshCart(), refreshFavorites(), fetchOrderCount(), fetchReviewCount()]);
    setRefreshing(false);
  };

  const validatePhoto = async (asset) => {
    const uri = asset?.uri || asset;
    const filename = String(uri).split("/").pop() || "";
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const mime = String(asset?.mimeType || "").toLowerCase();

    const allowedExts = ["jpg", "jpeg", "png", "webp"];
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const extOk  = allowedExts.includes(ext);
    const mimeOk = mime ? allowedMimes.includes(mime) : true;
    if (!extOk || !mimeOk) {
      Alert.alert("Unsupported file type", "Please upload a JPG, PNG, or WEBP photo.");
      return false;
    }

    let size = Number(asset?.fileSize) || 0;
    if (!size) {
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        size = Number(info?.size) || 0;
      } catch {}
    }
    if (size && size > 5 * 1024 * 1024) {
      Alert.alert("That image is too large", "Please upload a photo up to 5MB.");
      return false;
    }

    return true;
  };

  const uploadAvatar = async (uri) => {
    setUploadingPhoto(true);
    try {
      const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/upload`, uri, {
        fieldName: "product",
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        headers: {
          "auth-token": userToken || "",
          "ngrok-skip-browser-warning": "true",
        },
      });

      let uploadData;
      try {
        uploadData = JSON.parse(uploadResult.body || "{}");
      } catch {
        console.log("Upload non-JSON response:", uploadResult.status, (uploadResult.body || "").slice(0, 200));
        Alert.alert(
          "Upload Failed",
          `Server returned ${uploadResult.status}. ${(uploadResult.body || "").slice(0, 120) || "Empty response."}`
        );
        return;
      }
      if (uploadResult.status < 200 || uploadResult.status >= 300 || !uploadData.success || !uploadData.image_url) {
        Alert.alert("Upload Failed", uploadData.error || `Server returned ${uploadResult.status}.`);
        return;
      }

      const saveRes = await fetch(`${BASE_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "auth-token": userToken || "",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ photo: uploadData.image_url }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (saveData.success) {
        await refreshUserProfile();
      } else {
        Alert.alert("Save Failed", saveData.error || "Could not save your new photo.");
      }
    } catch (err) {
      console.log("uploadAvatar error:", err?.message || err);
      Alert.alert("Network Error", err?.message || "Could not upload your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Needed", "Camera access is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = !result.canceled && result.assets?.[0];
    if (!asset?.uri) return;
    if (!(await validatePhoto(asset))) return;
    uploadAvatar(asset.uri);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Needed", "Photo library access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = !result.canceled && result.assets?.[0];
    if (!asset?.uri) return;
    if (!(await validatePhoto(asset))) return;
    uploadAvatar(asset.uri);
  };

  const handleAvatarPress = () => {
    if (uploadingPhoto) return;
    Alert.alert("Profile Photo", "Choose a source", [
      { text: "Take Photo", onPress: pickFromCamera },
      { text: "Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.confirm) {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) logout();
    } else {
      Alert.alert(
        "LOG OUT",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: logout },
        ],
        { cancelable: true }
      );
    }
  };

  const stats = [
    { label: "ORDERS", value: String(orderCount), onPress: () => navigation.navigate("OrderHistory") },
    { label: "SAVED", value: String(favorites.length), onPress: () => navigation.navigate("Favorites") },
    { label: "REVIEWS", value: String(reviewCount), onPress: () => navigation.navigate("MyReviews") },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          Platform.OS === "ios" && { paddingTop: insets.top + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
        }
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroEyebrow}>MY PROFILE</Text>

          <TouchableOpacity
            style={styles.avatarRing}
            onPress={handleAvatarPress}
            onLongPress={handleAvatarLongPress}
            delayLongPress={350}
            activeOpacity={0.8}
          >
            <View style={styles.avatarInner}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.accentGold} />
              ) : user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {user?.name
                    ? user.name[0].toUpperCase()
                    : user?.email
                    ? user.email[0].toUpperCase()
                    : "U"}
                </Text>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✎</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{user?.name || user?.email || "Account"}</Text>
          <View style={styles.heroInfoBlock}>
            {!!user?.name && <Text style={styles.heroEmail}>{user?.email || ""}</Text>}
            {!!user?.place && <Text style={styles.heroPlace}>📍 {user.place}</Text>}
            {!!user?.bio && <Text style={styles.heroBio}>{user.bio}</Text>}
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.7}
          >
            <Text style={styles.editBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            {stats.map((s, i) => {
              const StatWrapper = s.onPress ? TouchableOpacity : View;
              return (
                <React.Fragment key={s.label}>
                  <StatWrapper
                    style={styles.statItem}
                    {...(s.onPress ? { onPress: s.onPress, activeOpacity: 0.6 } : {})}
                  >
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </StatWrapper>
                  {i < stats.length - 1 && <View style={styles.statDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <Section title="ACCOUNT" styles={styles}>
          <MenuItem styles={styles} colors={colors} icon="home-outline" label="Delivery Addresses" sublabel="Manage saved addresses" onPress={() => navigation.navigate("Addresses")} />
          <View style={styles.itemDivider} />
          <MenuItem styles={styles} colors={colors} icon="pricetag-outline" label="Vouchers & Promos" sublabel="Apply discount codes" onPress={() => navigation.navigate("Vouchers")} />
          <View style={styles.itemDivider} />
          <MenuItem styles={styles} colors={colors} icon="key-outline" label="Change Password" sublabel="Update your account password" onPress={() => navigation.navigate("ChangePassword")} />
        </Section>

        <Section title="PREFERENCES" styles={styles}>
          <MenuItem
            styles={styles}
            colors={colors}
            icon="moon-outline"
            label="Dark Mode"
            sublabel={isDark ? "On" : "Off"}
            onPress={toggleTheme}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.borderLight, true: colors.accentGold }}
                thumbColor={isDark ? colors.textPrimary : colors.textSecondary}
                ios_backgroundColor={colors.borderLight}
              />
            }
          />
          <View style={styles.itemDivider} />
          <MenuItem
            styles={styles}
            colors={colors}
            icon="chatbubble-ellipses-outline"
            label="Chat Widget on Every Screen"
            sublabel={showEverywhere ? "Always visible" : "Hidden on some screens"}
            onPress={() => setShowEverywhere((v) => !v)}
            rightElement={
              <Switch
                value={showEverywhere}
                onValueChange={setShowEverywhere}
                trackColor={{ false: colors.borderLight, true: colors.accentGold }}
                thumbColor={showEverywhere ? colors.textPrimary : colors.textSecondary}
                ios_backgroundColor={colors.borderLight}
              />
            }
          />
          <View style={styles.itemDivider} />
          <MenuItem styles={styles} colors={colors} icon="resize-outline" label="Size Guide" sublabel="Find your perfect fit" onPress={() => navigation.navigate("SizeGuide")} />
        </Section>

        <Section title="SUPPORT" styles={styles}>
          <MenuItem styles={styles} colors={colors} icon="chatbox-ellipses-outline" label="FAQ" onPress={() => navigation.navigate("FAQ")} />
          <View style={styles.itemDivider} />
          <MenuItem styles={styles} colors={colors} icon="lock-closed-outline" label="Privacy Policy" onPress={() => navigation.navigate("Privacy")} />
          <View style={styles.itemDivider} />
          <MenuItem styles={styles} colors={colors} icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate("Terms")} />
        </Section>

        <Section styles={styles}>
          <MenuItem styles={styles} colors={colors} icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
        </Section>

        <Text style={styles.version}>Version 1.0.0 · Built for Sneakerheads</Text>
      </ScrollView>

      <Modal visible={viewingPhoto} transparent animationType="fade" onRequestClose={() => setViewingPhoto(false)}>
        <TouchableOpacity
          style={styles.photoViewerOverlay}
          activeOpacity={1}
          onPress={() => setViewingPhoto(false)}
        >
          {user?.photoURL && (
            <Image source={{ uri: user.photoURL }} style={styles.photoViewerImage} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setViewingPhoto(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { paddingBottom: TAB_BAR_CLEARANCE },
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    marginBottom: 10,
  },
  heroEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 3, marginBottom: 20 },
  avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: colors.accentGold, justifyContent: "center", alignItems: "center", marginBottom: 14, position: "relative" },
  avatarInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.bgTertiary, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: colors.textPrimary, fontSize: 30, fontFamily: fonts.display },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBadgeText: { color: colors.textInverse, fontSize: 12 },
  heroName: { color: colors.textPrimary, fontSize: 24, fontFamily: fonts.display, letterSpacing: 1, marginBottom: 4 },
  heroInfoBlock: { alignItems: "center", marginBottom: 18 },
  heroEmail: { color: colors.textMuted, fontSize: 13, letterSpacing: 0.3, marginBottom: 4 },
  heroPlace: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  heroBio: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 24 },
  editBtn: { borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 8, paddingHorizontal: 24, borderRadius: radius.sm, marginBottom: 28 },
  editBtnText: { color: colors.textSecondary, fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  statsRow: { flexDirection: "row", width: "100%", backgroundColor: colors.bgCard, borderRadius: radius.md, paddingVertical: 18, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: colors.accentGold, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: colors.borderLight, marginVertical: 4 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 3, marginBottom: 10, marginLeft: 2 },
  sectionCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bgTertiary, justifyContent: "center", alignItems: "center" },
  menuIconDanger: { backgroundColor: "rgba(229, 72, 77, 0.1)" },
  menuLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
  menuLabelDanger: { color: colors.danger },
  menuSublabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  menuArrow: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },
  itemDivider: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: 66 },
  version: { color: colors.bgTertiary, fontSize: 10, letterSpacing: 1, textAlign: "center", marginTop: 30 },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerImage: { width: "100%", height: "70%" },
  photoViewerClose: {
    position: "absolute",
    top: 56,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerCloseText: { color: colors.textPrimary, fontSize: 18 },
});