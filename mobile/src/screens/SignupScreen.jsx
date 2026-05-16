import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import { BlurView } from "expo-blur";
import { BASE_URL, API_HEADERS } from "../api/config";

// ─── Floating Label Input ────────────────────────────────────────────────────
function FloatingInput({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  valid,
  keyboardType = "default",
  maxLength,
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? "#3a3a3a" : valid ? "#252525" : "#1e1e1e";

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label.toUpperCase()}</Text>
      <View style={fieldStyles.inputRow}>
        <TextInput
          style={[fieldStyles.input, { borderColor }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          placeholderTextColor="#242424"
          placeholder={secureTextEntry ? "••••••••" : `Enter your ${label.toLowerCase()}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
        />
        {valid && <CheckBadge />}
      </View>
    </View>
  );
}

// ─── Check Badge ─────────────────────────────────────────────────────────────
function CheckBadge() {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[fieldStyles.checkBadge, { transform: [{ scale }] }]}>
      <Text style={fieldStyles.checkTick}>✓</Text>
    </Animated.View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: {
    color: "#505050",
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  inputRow: { position: "relative", justifyContent: "center" },
  input: {
    backgroundColor: "rgba(8,8,8,0.75)",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    paddingRight: 38,
    color: "#d8d8d8",
    fontSize: 12,
  },
  checkBadge: {
    position: "absolute",
    right: 11,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#181818",
    borderWidth: 0.5,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  checkTick: { color: "#777", fontSize: 9, fontWeight: "700", lineHeight: 11 },
});

// ─── Rule Item ───────────────────────────────────────────────────────────────
function RuleItem({ label, met }) {
  const dotScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (met) {
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
        Animated.spring(dotScale, { toValue: 1.3, friction: 4, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(dotScale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [met]);
  return (
    <View style={ruleStyles.row}>
      <Animated.View
        style={[
          ruleStyles.dot,
          met && ruleStyles.dotMet,
          { transform: [{ scale: dotScale }] },
        ]}
      />
      <Text style={[ruleStyles.text, met && ruleStyles.textMet]}>{label}</Text>
    </View>
  );
}

const ruleStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#282828" },
  dotMet: { backgroundColor: "#888" },
  text: { color: "#383838", fontSize: 10 },
  textMet: { color: "#666" },
});

// ─── Strength Bar ────────────────────────────────────────────────────────────
function StrengthBar({ password }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const hasLen = password.length >= 8;
  const hasUp = /[A-Z]/.test(password);
  const hasNum = /\d/.test(password);
  const strong = hasLen && hasUp && hasNum;
  const fair = password.length >= 6;
  const targetWidth = strong ? 1 : fair ? 0.55 : 0.22;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: targetWidth,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [password]);

  const barColor = strong ? "#e0e0e0" : fair ? "#555" : "#2e2e2e";
  const label = strong ? "STRONG" : fair ? "FAIR" : "WEAK";
  const labelColor = strong ? "#aaa" : fair ? "#666" : "#3a3a3a";

  if (!password.length) return null;

  return (
    <View style={strStyles.row}>
      <View style={strStyles.bg}>
        <Animated.View
          style={[
            strStyles.fill,
            {
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <Text style={[strStyles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const strStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: -4 },
  bg: { flex: 1, height: 2, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" },
  fill: { height: 2, borderRadius: 2 },
  label: { fontSize: 8, letterSpacing: 1.5, minWidth: 36, textAlign: "right" },
});

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ initials }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevInitials = useRef(initials);
  useEffect(() => {
    if (initials !== prevInitials.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, friction: 4, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
      prevInitials.current = initials;
    }
  }, [initials]);
  const hasInitials = initials && initials !== "?";
  return (
    <Animated.View
      style={[
        avatarStyles.ring,
        hasInitials && avatarStyles.live,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[avatarStyles.text, hasInitials && avatarStyles.textLive]}>
        {initials || "?"}
      </Text>
    </Animated.View>
  );
}

const avatarStyles = StyleSheet.create({
  ring: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(10,10,10,0.6)",
    borderWidth: 0.5,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  live: { backgroundColor: "rgba(20,20,20,0.8)", borderColor: "#3a3a3a" },
  text: { fontSize: 14, fontWeight: "700", color: "#444", letterSpacing: 0.5 },
  textLive: { color: "#ccc" },
});

// ─── Hero Title ───────────────────────────────────────────────────────────────
function HeroTitle({ word }) {
  return (
    <View style={heroStyles.row}>
      {word.split("").map((c, i) => (
        <AnimatedChar key={`${word}-${i}`} char={c} delay={i * 45} />
      ))}
    </View>
  );
}

function AnimatedChar({ char, delay }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 80, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.Text style={[heroStyles.char, { opacity, transform: [{ translateY }] }]}>
      {char === " " ? "\u00A0" : char}
    </Animated.Text>
  );
}

const heroStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
    height: 56,
    alignItems: "flex-end",
  },
  char: {
    fontSize: 50,
    fontWeight: "900",
    color: "#f0f0f0",
    letterSpacing: -3,
    lineHeight: 56,
  },
});

// ─── Step Bar ─────────────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <View style={stepStyles.row}>
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <View
            style={[
              stepStyles.dot,
              i < step && stepStyles.dotDone,
              i === step && stepStyles.dotActive,
              i > step && stepStyles.dotIdle,
            ]}
          >
            <Text style={[stepStyles.dotText, i === step && stepStyles.dotTextActive]}>
              {i + 1}
            </Text>
          </View>
          {i < 2 && (
            <View style={[stepStyles.line, i < step && stepStyles.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dotActive: { backgroundColor: "#fff" },
  dotDone: { backgroundColor: "rgba(28,28,28,0.8)", borderWidth: 0.5, borderColor: "#2e2e2e" },
  dotIdle: { backgroundColor: "rgba(17,17,17,0.6)", borderWidth: 0.5, borderColor: "#1a1a1a" },
  dotText: { fontSize: 9, fontWeight: "700", color: "#2a2a2a" },
  dotTextActive: { color: "#000" },
  line: { flex: 1, height: 1, backgroundColor: "#1a1a1a" },
  lineDone: { backgroundColor: "#2a2a2a" },
});

// ─── Animated Panel ───────────────────────────────────────────────────────────
function AnimatedPanel({ visible, children }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 44)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -44, duration: 300, useNativeDriver: true }),
      ]).start();
      translateY.setValue(44);
    }
  }, [visible]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Shimmer Button ────────────────────────────────────────────────────────────
function ShimmerButton({ label, onPress, disabled, loading }) {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (disabled) {
      const anim = Animated.loop(
        Animated.timing(shimmerX, { toValue: 2, duration: 2600, useNativeDriver: true })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [disabled]);

  return (
    <Pressable
      style={({ pressed }) => [
        btnStyles.btn,
        disabled ? btnStyles.off : btnStyles.on,
        !disabled && pressed && { transform: [{ scale: 0.97 }] },
      ]}
      onPress={!disabled ? onPress : undefined}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={[btnStyles.text, disabled && btnStyles.textOff]}>{label}</Text>
      )}
      {disabled && (
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
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    overflow: "hidden",
  },
  on: { backgroundColor: "#fff" },
  off: { backgroundColor: "rgba(14,14,14,0.7)" },
  text: { color: "#000", fontWeight: "700", fontSize: 11, letterSpacing: 2 },
  textOff: { color: "#2a2a2a" },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});

// ─── Review Row ───────────────────────────────────────────────────────────────
function ReviewRow({ label, value, last }) {
  return (
    <View style={[rvStyles.row, !last && rvStyles.border]}>
      <Text style={rvStyles.key}>{label}</Text>
      <Text style={rvStyles.val} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const rvStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  border: { borderBottomWidth: 0.5, borderBottomColor: "#1e1e1e" },
  key: { fontSize: 10, color: "#383838", letterSpacing: 1 },
  val: { fontSize: 11, color: "#666", maxWidth: 160 },
});

// ─── Terms & Privacy content ──────────────────────────────────────────────────
const TERMS_CONTENT = {
  terms: {
    title: "Terms of Use",
    sections: [
      { heading: "1. Acceptance of Terms", body: "By accessing and using GoodSoles PH, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using GoodSoles PH's particular services, you shall be subject to any posted guidelines or rules applicable to such services." },
      { heading: "2. Description of Service", body: "GoodSoles PH provides users with access to an online marketplace for authentic sneakers and streetwear products. You understand and agree that the service is provided 'as-is' and that GoodSoles PH assumes no responsibility for the timeliness, deletion, mis-delivery, or failure to store any user communications or personalization settings." },
      { heading: "3. Registration & Account", body: "To access certain features of the service, you will need to register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. GoodSoles PH reserves the right to suspend or terminate your account if any information provided proves inaccurate, not current, or incomplete." },
      { heading: "4. User Conduct", body: "You agree not to use the service to: (a) upload, post, or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable; (b) impersonate any person or entity; (c) forge or manipulate identifiers to disguise the origin of any content; (d) upload or transmit any material that infringes any patent, trademark, copyright, or other proprietary rights." },
      { heading: "5. Product Authenticity", body: "GoodSoles PH is committed to selling only 100% authentic products. Every item undergoes a rigorous verification process before being listed or shipped. Any item found to be inauthentic will be immediately removed, and the seller will be permanently banned from the platform." },
      { heading: "6. Payments & Pricing", body: "All prices displayed are in Philippine Pesos (PHP) unless otherwise stated. GoodSoles PH reserves the right to modify pricing at any time. Transactions are processed through secure payment gateways. You agree to pay all charges incurred by you or any users of your account at the price(s) in effect when such charges are incurred." },
      { heading: "7. Shipping & Delivery", body: "GoodSoles PH ships nationwide across the Philippines. Delivery times are estimates and are not guaranteed. GoodSoles PH shall not be liable for delays caused by the shipping carrier, natural disasters, or other circumstances beyond our reasonable control." },
      { heading: "8. Returns & Refunds", body: "Returns are accepted within 7 days of receipt for items that are defective or not as described. Items must be returned in their original, unworn condition with all original packaging and tags. Refunds will be processed within 5–10 business days after we receive and inspect the returned item." },
      { heading: "9. Limitation of Liability", body: "GoodSoles PH shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) the service." },
      { heading: "10. Changes to Terms", body: "GoodSoles PH reserves the right to modify these terms at any time. We will provide notice of significant changes by updating the date at the top of this page. Your continued use of the service after such modifications constitutes your acceptance of the revised terms." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "1. Information We Collect", body: "We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, phone number, shipping address, and payment information." },
      { heading: "2. How We Use Your Information", body: "We use the information we collect to process transactions, send transactional and promotional communications, provide customer support, and improve our services. We may also use your information to personalize your experience and send you relevant product recommendations." },
      { heading: "3. Information Sharing", body: "We do not sell, trade, or otherwise transfer your personally identifiable information to third parties without your consent, except to trusted third parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential." },
      { heading: "4. Data Security", body: "We implement a variety of security measures to maintain the safety of your personal information. Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems." },
      { heading: "5. Cookies", body: "GoodSoles PH uses cookies to enhance your experience, gather general visitor information, and track visits to our website. You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies via your browser settings." },
      { heading: "6. Third-Party Links", body: "Occasionally, at our discretion, we may include or offer third-party products or services on our website. These third-party sites have separate and independent privacy policies. We have no responsibility or liability for the content and activities of these linked sites." },
      { heading: "7. Children's Privacy", body: "Our service is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information." },
      { heading: "8. Your Rights", body: "You have the right to access, correct, or delete your personal information at any time. You may also object to or restrict the processing of your personal information. To exercise these rights, please contact us at privacy@goodsolesph.com." },
      { heading: "9. Data Retention", body: "We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it." },
      { heading: "10. Contact Us", body: "If you have any questions about this Privacy Policy or our data practices, please contact us at privacy@goodsolesph.com or write to us at GoodSoles PH, Manila, Philippines. We will respond to your inquiry within 30 days." },
    ],
  },
};

// ─── Legal Modal (scroll-to-unlock, same style as old modal) ─────────────────
const LegalModal = ({ type, visible, onClose, onAgree, alreadyAgreed }) => {
  const content = TERMS_CONTENT[type];
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [scrollProgress, setScrollProgress]     = useState(0);
  const [checked, setChecked]                   = useState(alreadyAgreed);

  const modalScale   = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setScrolledToBottom(false);
      setScrollProgress(0);
      setChecked(alreadyAgreed);
      Animated.parallel([
        Animated.timing(modalOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(modalScale,   { toValue: 1, friction: 6,   useNativeDriver: true }),
      ]).start();
    } else {
      modalOpacity.setValue(0);
      modalScale.setValue(0.9);
    }
  }, [visible]);

  useEffect(() => { if (scrolledToBottom) setChecked(true); }, [scrolledToBottom]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={lm.modalOverlay}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        <Animated.View style={[lm.modalCard, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>

          {/* Header */}
          <View style={lm.header}>
            <Text style={lm.modalTitle}>{content.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={lm.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scroll hint */}
          {!scrolledToBottom && (
            <View style={lm.scrollHint}>
              <Text style={lm.scrollHintText}>↓ Scroll to the bottom to unlock agreement</Text>
            </View>
          )}

          {/* Progress bar */}
          <View style={lm.progressBg}>
            <View style={[lm.progressFill, { width: `${scrollProgress * 100}%` }]} />
          </View>

          {/* Body */}
          <ScrollView
            style={lm.termsBox}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const progress = contentOffset.y / (contentSize.height - layoutMeasurement.height);
              setScrollProgress(Math.min(progress, 1));
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
                setScrolledToBottom(true);
              }
            }}
            scrollEventThrottle={16}
          >
            {content.sections.map((sec) => (
              <View key={sec.heading} style={lm.section}>
                <Text style={lm.sectionHeading}>{sec.heading}</Text>
                <Text style={lm.sectionBody}>{sec.body}</Text>
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Footer actions */}
          <View style={lm.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={lm.declineText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!scrolledToBottom}
              style={[lm.acceptBtn, !scrolledToBottom && lm.acceptBtnOff]}
              onPress={() => { if (scrolledToBottom) { onAgree(true); onClose(); } }}
            >
              <Text style={[lm.acceptText, !scrolledToBottom && lm.acceptTextOff]}>
                {scrolledToBottom ? "Accept" : "Scroll to continue ↓"}
              </Text>
            </Pressable>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
};

const lm = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "rgba(10,10,10,0.96)", borderWidth: 0.5, borderColor: "#222", borderRadius: 20, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { color: "#e0e0e0", fontSize: 15, fontWeight: "600", letterSpacing: 0.5 },
  closeBtn: { color: "#555", fontSize: 16 },
  scrollHint: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  scrollHintText: { color: "#444", fontSize: 10, letterSpacing: 0.5 },
  progressBg: { height: 2, backgroundColor: "#1a1a1a", borderRadius: 2, marginBottom: 12, overflow: "hidden" },
  progressFill: { height: 2, backgroundColor: "#fff" },
  termsBox: { maxHeight: 260 },
  section: { marginBottom: 14 },
  sectionHeading: { color: "#b0b0b0", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  sectionBody: { color: "#555", fontSize: 11, lineHeight: 18 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  declineText: { color: "#555", fontSize: 13 },
  acceptBtn: { backgroundColor: "#fff", paddingVertical: 11, paddingHorizontal: 24, borderRadius: 99 },
  acceptBtnOff: { backgroundColor: "#1a1a1a" },
  acceptText: { color: "#000", fontWeight: "600", fontSize: 12 },
  acceptTextOff: { color: "#2a2a2a" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SignupScreen({ navigation }) {
  const [step, setStep]                         = useState(0);
  const [firstName, setFirstName]               = useState("");
  const [lastName, setLastName]                 = useState("");
  const [email, setEmail]                       = useState("");
  const [phone, setPhone]                       = useState(""); // ← added
  const [password, setPassword]                 = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [loading, setLoading]                   = useState(false);
  const [serverError, setServerError]           = useState("");

  // Two separate agreements (Terms + Privacy)
  const [termsAgreed,   setTermsAgreed]   = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const bothAgreed = termsAgreed && privacyAgreed;

  const [legalModal, setLegalModal] = useState(null); // null | "terms" | "privacy"

  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity,    { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const fnValid  = firstName.trim().length >= 2 && !/\d/.test(firstName);
  const lnValid  = lastName.trim().length >= 2 && !/\d/.test(lastName);
  const emValid  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phValid  = /^\d{11}$/.test(phone); // ← added
  const hasLen   = password.length >= 8;
  const hasUp    = /[A-Z]/.test(password);
  const hasNum   = /\d/.test(password);
  const pwValid  = hasLen && hasUp && hasNum;
  const matchOk  = password === confirmPassword && confirmPassword.length > 0;

  const step0Ready = fnValid && lnValid && emValid && phValid; // ← phone required
  const step1Ready = pwValid && matchOk;

  const initials = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase() || "?";

  const goNext = () => {
    if (step === 0 && !step0Ready) return;
    if (step === 1 && !step1Ready) return;
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSignup = async () => {
    if (!bothAgreed) return;
    setLoading(true);
    setServerError("");
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          email:     email.trim(),
          phone:     phone.trim(), // ← added
          password,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg = String(data.errors || "").toLowerCase();
        setServerError(
          msg.includes("already") ? "An account with this email already exists." :
          msg.includes("invalid") ? "The email address is not valid." :
          data.errors || "Something went wrong. Please try again."
        );
        return;
      }
      navigation.replace("VerifyOTP", { email: email.trim() });
    } catch {
      setServerError("Unable to reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ["Welcome", "Security", "Confirm"];
  const stepMeta   = ["Create your account", "Set your password", "Almost there"];

  return (
    <>
      <View style={{ flex: 1, width: "100%", overflow: "hidden" }}>
        <ImageBackground
          source={require("../../assets/signlog-bg.png")}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          imageStyle={{ width: "100%", height: "100%" }}
        />
        <View style={s.overlay} pointerEvents="none" />

        <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
              <StepBar step={step} />
              <Avatar initials={initials} />
              <Text style={s.heroMeta}>{stepMeta[step]}</Text>
              <HeroTitle key={step} word={stepTitles[step]} />
              <View style={s.accentLine} />

              {/* ── Step 0: Identity ── */}
              {step === 0 && (
                <AnimatedPanel visible={step === 0}>
                  {serverError ? (
                    <View style={s.errorBanner}><Text style={s.errorText}>{serverError}</Text></View>
                  ) : null}
                  <View style={s.nameRow}>
                    <View style={s.nameField}>
                      <FloatingInput label="First Name" value={firstName}
                        onChangeText={(v) => { setFirstName(v.replace(/[0-9]/g, "")); setServerError(""); }}
                        valid={fnValid}
                      />
                    </View>
                    <View style={s.nameField}>
                      <FloatingInput label="Last Name" value={lastName}
                        onChangeText={(v) => { setLastName(v.replace(/[0-9]/g, "")); setServerError(""); }}
                        valid={lnValid}
                      />
                    </View>
                  </View>
                  <FloatingInput label="Email" value={email}
                    onChangeText={(v) => { setEmail(v); setServerError(""); }}
                    valid={emValid} keyboardType="email-address"
                  />
                  {/* ── Phone field (new) ── */}
                  <FloatingInput label="Phone Number (e.g. 09XXXXXXXXX)" value={phone}
                    onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 11))}
                    valid={phValid} keyboardType="number-pad" maxLength={11}
                  />
                  <ShimmerButton label="CONTINUE" onPress={goNext} disabled={!step0Ready} />
                  <Text style={s.signinLink}>
                    Already have an account?{" "}
                    <Text style={s.signinAccent} onPress={() => navigation.navigate("LoginScreen")}>Sign in</Text>
                  </Text>
                </AnimatedPanel>
              )}

              {/* ── Step 1: Security ── */}
              {step === 1 && (
                <AnimatedPanel visible={step === 1}>
                  <FloatingInput label="Password" value={password} onChangeText={setPassword} secureTextEntry valid={pwValid} />
                  <StrengthBar password={password} />
                  <FloatingInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry valid={matchOk} />
                  <View style={s.rulesGrid}>
                    <View style={s.rulesCol}>
                      <RuleItem label="8+ characters"   met={hasLen} />
                      <RuleItem label="Uppercase letter" met={hasUp} />
                    </View>
                    <View style={s.rulesCol}>
                      <RuleItem label="Contains number" met={hasNum} />
                      <RuleItem label="Passwords match" met={matchOk} />
                    </View>
                  </View>
                  <ShimmerButton label="CONTINUE" onPress={goNext} disabled={!step1Ready} />
                  <Text style={s.backLink} onPress={goBack}>← Back</Text>
                </AnimatedPanel>
              )}

              {/* ── Step 2: Confirm ── */}
              {step === 2 && (
                <AnimatedPanel visible={step === 2}>
                  <View style={s.reviewCard}>
                    <ReviewRow label="NAME"  value={`${firstName.trim()} ${lastName.trim()}`} />
                    <ReviewRow label="EMAIL" value={email.trim()} />
                    <ReviewRow label="PHONE" value={phone} />
                    <ReviewRow label="PASSWORD" value="••••••••" last />
                  </View>

                  <View style={s.divider} />

                  {/* Two separate legal links replacing old single checkbox */}
                  <View style={s.termsRow}>
                    <View style={[s.pseudoCheck, bothAgreed && s.pseudoCheckDone]}>
                      {bothAgreed && <Text style={s.pseudoCheckMark}>✓</Text>}
                    </View>
                    <Text style={s.cboxText}>
                      I agree to the{" "}
                      <Text style={[s.cboxLink, termsAgreed && s.cboxLinkDone]} onPress={() => setLegalModal("terms")}>
                        Terms of Use{termsAgreed ? " ✓" : " ↗"}
                      </Text>
                      {"  &  "}
                      <Text style={[s.cboxLink, privacyAgreed && s.cboxLinkDone]} onPress={() => setLegalModal("privacy")}>
                        Privacy Policy{privacyAgreed ? " ✓" : " ↗"}
                      </Text>
                    </Text>
                  </View>

                  {serverError ? (
                    <View style={s.errorBanner}><Text style={s.errorText}>{serverError}</Text></View>
                  ) : null}

                  <ShimmerButton label="SIGN UP" onPress={handleSignup} disabled={!bothAgreed} loading={loading} />
                  <Text style={s.backLink} onPress={goBack}>← Back</Text>
                </AnimatedPanel>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Two separate legal modals */}
      <LegalModal
        type="terms"
        visible={legalModal === "terms"}
        alreadyAgreed={termsAgreed}
        onClose={() => setLegalModal(null)}
        onAgree={(v) => setTermsAgreed(v)}
      />
      <LegalModal
        type="privacy"
        visible={legalModal === "privacy"}
        alreadyAgreed={privacyAgreed}
        onClose={() => setLegalModal(null)}
        onAgree={(v) => setPrivacyAgreed(v)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" },
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "rgba(10,10,10,0.82)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 22 },
  heroMeta: { textAlign: "center", fontSize: 9, letterSpacing: 2.5, color: "#383838", textTransform: "uppercase", marginBottom: 4 },
  accentLine: { height: 0.5, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 20 },
  nameRow: { flexDirection: "row", gap: 9 },
  nameField: { flex: 1 },
  rulesGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  rulesCol: { flex: 1 },
  divider: { height: 0.5, backgroundColor: "rgba(255,255,255,0.05)", marginVertical: 14 },
  reviewCard: { backgroundColor: "rgba(8,8,8,0.6)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)", borderRadius: 11, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14 },
  // Terms row (replaces old cboxRow)
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 14 },
  pseudoCheck: { width: 17, height: 17, borderRadius: 4, borderWidth: 0.5, borderColor: "#2a2a2a", backgroundColor: "rgba(8,8,8,0.7)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  pseudoCheckDone: { backgroundColor: "#1a1a1a", borderColor: "#444" },
  pseudoCheckMark: { color: "#aaa", fontSize: 9, fontWeight: "800" },
  cboxText: { color: "#444", fontSize: 11, flex: 1, lineHeight: 18 },
  cboxLink: { color: "#666", textDecorationLine: "underline" },
  cboxLinkDone: { color: "#4a8a4a" },
  errorBanner: { backgroundColor: "rgba(20,20,20,0.8)", borderWidth: 0.5, borderColor: "#2a2a2a", borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: "#666", fontSize: 11, lineHeight: 17 },
  signinLink: { textAlign: "center", color: "#333", fontSize: 11, marginTop: 14 },
  signinAccent: { color: "#c0c0c0" },
  backLink: { textAlign: "center", color: "#555", fontSize: 11, marginTop: 14 },
});