import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fonts, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const FAQ_SECTIONS = [
  {
    title: "Orders & Shipping",
    items: [
      { q: "How long does delivery take?", a: "Metro Manila orders typically arrive within 2-3 business days. Provincial orders take 3-7 business days depending on the shipping tier. You'll see an estimate at checkout once you select your address." },
      { q: "Can I track my order?", a: "Yes — open Profile > Your Orders and tap any order to see its current status (Pending, Confirmed, Shipping, Completed)." },
      { q: "Can I cancel my order?", a: "Orders can be cancelled only while they're still in Pending status. Once an order moves to Confirmed or later, cancellation is no longer available — you can request a refund instead after delivery." },
    ],
  },
  {
    title: "Returns & Refunds",
    items: [
      { q: "What's your return policy?", a: "Returns are accepted within 7 days of receipt for items that are defective or not as described. Items must be unworn, in original packaging, with all tags attached." },
      { q: "How do I request a refund?", a: "Go to Profile > Your Orders, open the delivered order, and tap Request Refund. Our team will review it and get back to you." },
      { q: "How long do refunds take?", a: "Once approved, refunds are processed within 5-10 business days." },
    ],
  },
  {
    title: "Sizing & Authenticity",
    items: [
      { q: "How do I know what size to order?", a: "Each product page lists available sizes with stock counts. You can also set a default size under Profile > Size Preferences so it's pre-selected on every product." },
      { q: "Are all products authentic?", a: "Yes. Every item sold on GoodSoles PH goes through a verification process before it's listed. Any item found to be inauthentic is removed immediately." },
    ],
  },
  {
    title: "Payments & Vouchers",
    items: [
      { q: "What payment methods are accepted?", a: "We accept Card, GCash, and Maya through our secure PayMongo checkout, as well as Cash on Delivery." },
      { q: "How do vouchers and points work?", a: "You earn points on purchases, which you can redeem for vouchers under Profile > Vouchers & Promos. Applied vouchers are entered during checkout and discount your order total automatically." },
    ],
  },
  {
    title: "Account",
    items: [
      { q: "How do I change my password?", a: "Go to Profile > Edit Profile > Change Password. You'll need to verify your current password first." },
      { q: "How do I delete my account?", a: "Contact our support team through Help Center to request account deletion." },
    ],
  },
];

function FAQItem({ q, a, open, onToggle, s, colors }) {
  return (
    <TouchableOpacity style={s.faqItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={s.faqRow}>
        <Text style={s.faqQuestion}>{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </View>
      {open && <Text style={s.faqAnswer}>{a}</Text>}
    </TouchableOpacity>
  );
}

export default function FAQScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [openKey, setOpenKey] = useState(null);

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
        <Text style={s.headerTitle}>FAQ</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {FAQ_SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.card}>
              {section.items.map((item, idx) => {
                const key = `${section.title}-${idx}`;
                return (
                  <React.Fragment key={key}>
                    {idx > 0 && <View style={s.divider} />}
                    <FAQItem
                      q={item.q}
                      a={item.a}
                      open={openKey === key}
                      onToggle={() => setOpenKey(openKey === key ? null : key)}
                      s={s}
                      colors={colors}
                    />
                  </React.Fragment>
                );
              })}
            </View>
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
  headerTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.display, letterSpacing: 1.5 },

  content: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

  faqItem: { padding: 16 },
  faqRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  faqQuestion: { flex: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodySemibold },
  faqAnswer: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10 },
});
