import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  Image,
} from "react-native";
import { useAuth } from "../context/AuthContext";

function MenuItem({ icon, label, sublabel, onPress, rightElement, danger }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Text style={styles.menuIconText}>{icon}</Text>
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

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { logout, userToken } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const getUserInfo = () => {
    try {
      if (!userToken) return { name: "Guest", email: "" };
      const payload = JSON.parse(atob(userToken.split(".")[1]));
      return {
        name: payload.name || payload.username || "Sneaker Head",
        email: payload.email || "",
        photoURL: payload.photo || payload.avatar || null,
      };
    } catch {
      return { name: "Sneaker Head", email: "" };
    }
  };

  const user = getUserInfo();

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
    { label: "ORDERS", value: "12" },
    { label: "SAVED", value: "34" },
    { label: "REVIEWS", value: "5" },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroEyebrow}>MY PROFILE</Text>

          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {user?.photoURL ? (
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
          </View>

          <Text style={styles.heroName}>{user?.name || "Sneaker Head"}</Text>
          <Text style={styles.heroEmail}>{user?.email || ""}</Text>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.7}
          >
            <Text style={styles.editBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                {i < stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <Section title="ACCOUNT">
          <MenuItem icon="📦" label="My Orders" sublabel="Track, return or buy again" onPress={() => navigation.navigate("OrderHistory")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="🏠" label="Delivery Addresses" sublabel="Manage saved addresses" onPress={() => navigation.navigate("Addresses")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="💳" label="Payment Methods" sublabel="Cards & wallets" onPress={() => navigation.navigate("PaymentMethods")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="🎟️" label="Vouchers & Promos" sublabel="Apply discount codes" onPress={() => navigation.navigate("Vouchers")} />
        </Section>

        <Section title="PREFERENCES">
          <MenuItem
            icon="🔔"
            label="Notifications"
            sublabel={notificationsEnabled ? "Enabled" : "Disabled"}
            onPress={() => {}}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#2a2a2a", true: "#fff" }}
                thumbColor={notificationsEnabled ? "#0a0a0a" : "#888"}
                ios_backgroundColor="#2a2a2a"
              />
            }
          />
          <View style={styles.itemDivider} />
          <MenuItem icon="📏" label="Size Preferences" sublabel="Set your default shoe size" onPress={() => navigation.navigate("SizePreferences")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="🌐" label="Language & Region" sublabel="English · Philippines" onPress={() => navigation.navigate("Language")} />
        </Section>

        <Section title="SUPPORT">
          <MenuItem icon="💬" label="Help Center" onPress={() => navigation.navigate("HelpCenter")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="⭐" label="Rate the App" onPress={() => Alert.alert("Thanks!", "Redirecting to app store…")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="🔒" label="Privacy Policy" onPress={() => navigation.navigate("Privacy")} />
          <View style={styles.itemDivider} />
          <MenuItem icon="📄" label="Terms of Service" onPress={() => navigation.navigate("Terms")} />
        </Section>

        <Section>
          <MenuItem icon="🚪" label="Log Out" onPress={handleLogout} danger />
        </Section>

        <Text style={styles.version}>Version 1.0.0 · Built for Sneakerheads</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { paddingBottom: 40 },
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    marginBottom: 10,
  },
  heroEyebrow: { color: "#444", fontSize: 10, fontWeight: "900", letterSpacing: 3, marginBottom: 20 },
  avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center", marginBottom: 14 },
  avatarInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#1a1a1a", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 30, fontWeight: "900" },
  heroName: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  heroEmail: { color: "#555", fontSize: 13, letterSpacing: 0.3, marginBottom: 18 },
  editBtn: { borderWidth: 1, borderColor: "#333", paddingVertical: 8, paddingHorizontal: 24, borderRadius: 2, marginBottom: 28 },
  editBtnText: { color: "#aaa", fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  statsRow: { flexDirection: "row", width: "100%", backgroundColor: "#111", borderRadius: 4, paddingVertical: 18, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  statLabel: { color: "#555", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: "#222", marginVertical: 4 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 3, marginBottom: 10, marginLeft: 2 },
  sectionCard: { backgroundColor: "#111", borderRadius: 4, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: 4, backgroundColor: "#1a1a1a", justifyContent: "center", alignItems: "center" },
  menuIconDanger: { backgroundColor: "#1a0a0a" },
  menuIconText: { fontSize: 16 },
  menuLabel: { color: "#e0e0e0", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  menuLabelDanger: { color: "#ff4444" },
  menuSublabel: { color: "#555", fontSize: 11, marginTop: 2 },
  menuArrow: { color: "#444", fontSize: 22, fontWeight: "300" },
  itemDivider: { height: 1, backgroundColor: "#1a1a1a", marginLeft: 66 },
  version: { color: "#2a2a2a", fontSize: 10, letterSpacing: 1, textAlign: "center", marginTop: 30 },
});