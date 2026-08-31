import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ImageBackground,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme";

// ─── Password rules ────────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { key: "length",  label: "At least 8 characters",          test: (p) => p.length >= 8 },
  { key: "upper",   label: "One uppercase letter (A–Z)",      test: (p) => /[A-Z]/.test(p) },
  { key: "number",  label: "One number (0–9)",                test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const getPwdChecks = (pw) => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(pw) }));

const getPasswordStrength = (pw) => {
  if (!pw) return "";
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw))    s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return "Weak";
  if (s <= 4) return "Medium";
  return "Strong";
};

const STRENGTH_COLOR = { Weak: "#8b2020", Medium: "#7a6200", Strong: "#1a6b2a" };

// ─── Terms & Privacy content ───────────────────────────────────────────────────
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

// ─── Legal Modal ───────────────────────────────────────────────────────────────
const LegalModal = ({ type, visible, onClose, onAgree, alreadyAgreed }) => {
  const content = TERMS_CONTENT[type];
  const scrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(alreadyAgreed);

  useEffect(() => {
    setScrolledToBottom(false);
    setChecked(alreadyAgreed);
  }, [type, visible, alreadyAgreed]);

  useEffect(() => {
    if (scrolledToBottom) setChecked(true);
  }, [scrolledToBottom]);

  const handleScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isBottom) setScrolledToBottom(true);
  };

  const handleConfirm = () => {
    if (checked) { onAgree(true); onClose(); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={lm.backdrop}>
        <View style={lm.card}>
          {/* Header */}
          <View style={lm.header}>
            <Text style={lm.title}>{content.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={lm.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {!scrolledToBottom && (
            <View style={lm.scrollHint}>
              <Text style={lm.scrollHintText}>↓ Scroll to the bottom to unlock agreement</Text>
            </View>
          )}

          {/* Body */}
          <ScrollView
            ref={scrollRef}
            style={lm.body}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {content.sections.map((s) => (
              <View key={s.heading} style={lm.section}>
                <Text style={lm.sectionHeading}>{s.heading}</Text>
                <Text style={lm.sectionBody}>{s.body}</Text>
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer */}
          <View style={lm.footer}>
            <TouchableOpacity
              style={lm.checkRow}
              onPress={() => scrolledToBottom && setChecked((v) => !v)}
              activeOpacity={scrolledToBottom ? 0.7 : 1}
            >
              <View style={[lm.checkbox, checked && lm.checkboxChecked, !scrolledToBottom && lm.checkboxLocked]}>
                {checked && <Text style={lm.checkmark}>✓</Text>}
              </View>
              <Text style={[lm.checkLabel, !scrolledToBottom && lm.checkLabelLocked]}>
                {scrolledToBottom
                  ? `I have read and agree to the ${content.title}`
                  : "Read to the bottom to enable this checkbox"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[lm.confirmBtn, !checked && lm.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!checked}
            >
              <Text style={[lm.confirmBtnText, !checked && lm.confirmBtnTextDisabled]}>
                {checked ? "Confirm & Close" : "Scroll to continue ↓"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const lm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  card: { backgroundColor: "#0e0e0e", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", borderWidth: 0.5, borderColor: "#222" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 0.5, borderBottomColor: "#1a1a1a" },
  title: { color: "#e8e8e8", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  closeBtn: { color: "#555", fontSize: 16 },
  scrollHint: { backgroundColor: "#111", paddingVertical: 8, paddingHorizontal: 18, borderBottomWidth: 0.5, borderBottomColor: "#1a1a1a" },
  scrollHintText: { color: "#444", fontSize: 11, letterSpacing: 0.5 },
  body: { paddingHorizontal: 18, paddingTop: 12 },
  section: { marginBottom: 18 },
  sectionHeading: { color: "#b0b0b0", fontSize: 12, fontWeight: "700", marginBottom: 6, letterSpacing: 0.3 },
  sectionBody: { color: "#555", fontSize: 12, lineHeight: 19 },
  footer: { padding: 18, borderTopWidth: 0.5, borderTopColor: "#1a1a1a", gap: 12 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 0.5, borderColor: "#333", backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { borderColor: "#555", backgroundColor: "#1a1a1a" },
  checkboxLocked: { opacity: 0.35 },
  checkmark: { color: "#aaa", fontSize: 10, fontWeight: "800" },
  checkLabel: { flex: 1, color: "#888", fontSize: 12, lineHeight: 18 },
  checkLabelLocked: { color: "#333" },
  confirmBtn: { backgroundColor: "#e8e8e8", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#111", borderWidth: 0.5, borderColor: "#1e1e1e" },
  confirmBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  confirmBtnTextDisabled: { color: "#2a2a2a" },
});

// ─── OTP Input ─────────────────────────────────────────────────────────────────
const OtpInput = ({ value, length = 6, onChange, error }) => {
  const inputsRef = useRef([]);

  const handleChange = (text, idx) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const arr = value.split("");
    arr[idx] = digit;
    const newVal = arr.join("").slice(0, length);
    onChange(newVal);
    if (digit && idx < length - 1) {
      setTimeout(() => inputsRef.current[idx + 1]?.focus(), 10);
    }
  };

  const handleKeyPress = ({ nativeEvent: { key } }, idx) => {
    if (key === "Backspace" && !value[idx] && idx > 0) {
      const arr = value.split("");
      arr[idx - 1] = "";
      onChange(arr.join("").slice(0, length));
      setTimeout(() => inputsRef.current[idx - 1]?.focus(), 10);
    }
  };

  return (
    <View style={otp.wrapper}>
      <View style={otp.row}>
        {Array.from({ length }).map((_, idx) => (
          <TextInput
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            style={[otp.box, value[idx] ? otp.boxFilled : null, error ? otp.boxError : null]}
            value={value[idx] || ""}
            onChangeText={(t) => handleChange(t, idx)}
            onKeyPress={(e) => handleKeyPress(e, idx)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectionColor="#888"
          />
        ))}
      </View>
      {error ? <Text style={otp.error}>{error}</Text> : null}
    </View>
  );
};

const otp = StyleSheet.create({
  wrapper: { marginVertical: 8 },
  row: { flexDirection: "row", justifyContent: "center", gap: 8 },
  box: { width: 44, height: 52, borderRadius: 10, borderWidth: 0.5, borderColor: "#1e1e1e", backgroundColor: "rgba(8,8,8,0.75)", color: "#d8d8d8", fontSize: 20, fontWeight: "700" },
  boxFilled: { borderColor: "#333" },
  boxError: { borderColor: "#5a1e1e" },
  error: { color: "#8b2020", fontSize: 11, textAlign: "center", marginTop: 6 },
});

// ─── Shared UI atoms ───────────────────────────────────────────────────────────
const FieldInput = ({ placeholder, value, onChangeText, secureTextEntry, keyboardType = "default", editable = true, error, showToggle, toggled, onToggle, maxLength }) => (
  <View style={fi.wrapper}>
    <View style={fi.row}>
      <TextInput
        style={[fi.input, error ? fi.inputError : null, showToggle ? fi.inputWithToggle : null, !editable ? fi.inputDisabled : null]}
        placeholder={placeholder}
        placeholderTextColor="#2e2e2e"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !toggled}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        maxLength={maxLength}
        selectionColor="#888"
      />
      {showToggle && (
        <TouchableOpacity style={fi.toggle} onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={fi.toggleIcon}>{toggled ? "○" : "●"}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={fi.error}>{error}</Text> : null}
  </View>
);

const fi = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  row: { position: "relative" },
  input: { backgroundColor: "rgba(8,8,8,0.75)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, color: "#d8d8d8", fontSize: 13 },
  inputError: { borderColor: "#5a1e1e" },
  inputWithToggle: { paddingRight: 42 },
  inputDisabled: { opacity: 0.45 },
  toggle: { position: "absolute", right: 13, top: 0, bottom: 0, justifyContent: "center" },
  toggleIcon: { color: "#444", fontSize: 14 },
  error: { color: "#8b2020", fontSize: 11, marginTop: 4, marginLeft: 2 },
});

const PrimaryBtn = ({ label, onPress, loading }) => (
  <TouchableOpacity style={pb.btn} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    {loading
      ? <ActivityIndicator color={colors.textInverse} />
      : <Text style={pb.label}>{label}</Text>}
  </TouchableOpacity>
);

const pb = StyleSheet.create({
  btn: { backgroundColor: colors.textPrimary, borderRadius: 11, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  label: { color: colors.textInverse, fontWeight: "700", fontSize: 12, letterSpacing: 2 },
});

const LinkBtn = ({ label, onPress }) => (
  <TouchableOpacity onPress={onPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
    <Text style={{ color: colors.accentGold, fontSize: 12 }}>{label}</Text>
  </TouchableOpacity>
);

const PwdChecklist = ({ checks }) => (
  <View style={{ marginTop: 6, marginLeft: 2, gap: 3 }}>
    {checks.map((c) => (
      <Text key={c.key} style={{ fontSize: 11, color: c.passed ? colors.success : "#555" }}>
        {c.passed ? "✓" : "✗"}  {c.label}
      </Text>
    ))}
  </View>
);

// ─── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = () => {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[av.ring, { transform: [{ scale }] }]}>
      <Image source={require("../../assets/GSPH-removebg.png")} style={av.logo} resizeMode="contain" />
    </Animated.View>
  );
};

const av = StyleSheet.create({
  ring: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(10,10,10,0.6)", borderWidth: 0.5, borderColor: "#2a2a2a", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 },
  logo: { width: 52, height: 52 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { login, signup, confirmOtp, sendForgotOtp, confirmResetPassword } = useAuth();

  const [mode, setMode] = useState("login"); // login | signup | forgot | reset

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    password: "", confirmPassword: "", newPassword: "",
  });

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp]         = useState("");

  const [termsAgreed, setTermsAgreed]     = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const bothAgreed = termsAgreed && privacyAgreed;

  const [legalModal, setLegalModal] = useState(null); // null | "terms" | "privacy"

  const [showPwd, setShowPwd]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [showNewPwd, setShowNewPwd]           = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const pwStrength = getPasswordStrength(mode === "reset" ? formData.newPassword : formData.password);

  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  // Fade card on mode switch
  const switchMode = (next) => {
    Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setMode(next);
      setErrors({});
      setOtpSent(false);
      setOtp("");
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const set = (field) => (value) => {
    setFormData((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const setErr = (field, msg) => setErrors((p) => ({ ...p, [field]: msg }));
  const clearErrors = () => setErrors({});

  const showAlert = (msg) => Alert.alert("GoodSoles PH", msg);

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    clearErrors();
    const email    = formData.email.trim();
    const password = formData.password;
    let bad = false;
    if (!email)    { setErr("email",    "Email is required.");    bad = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); bad = true; }
    if (!password) { setErr("password", "Password is required."); bad = true; }
    if (bad) return;

    setLoading(true);
    try {
      await login(email, password);
      // Navigation is handled by the navigator once userToken is set in context
    } catch (err) {
      const msg = String(err.message || "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("credentials")) {
        setErr("email", err.message);
        setErr("password", err.message);
      } else if (msg.includes("password")) {
        setErr("password", err.message);
      } else {
        setErr("email", err.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── SIGNUP STEP 1 — send OTP ────────────────────────────────────────────────
  const handleSendOtp = async () => {
    clearErrors();
    if (!bothAgreed) { setErr("agreed", "You must read and agree to both documents."); return; }

    const { firstName, lastName, email, phone, password, confirmPassword } = formData;
    let bad = false;

    if (!firstName.trim()) { setErr("firstName", "First name required."); bad = true; }
    else if (/\d/.test(firstName)) { setErr("firstName", "No numbers allowed."); bad = true; }
    else if (firstName.trim().length < 2) { setErr("firstName", "At least 2 characters."); bad = true; }

    if (!lastName.trim()) { setErr("lastName", "Last name required."); bad = true; }
    else if (/\d/.test(lastName)) { setErr("lastName", "No numbers allowed."); bad = true; }
    else if (lastName.trim().length < 2) { setErr("lastName", "At least 2 characters."); bad = true; }

    if (!email.trim()) { setErr("email", "Email is required."); bad = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr("email", "Enter a valid email."); bad = true; }

    if (!phone) { setErr("phone", "Phone number is required."); bad = true; }
    else if (!/^\d{11}$/.test(phone)) { setErr("phone", "Must be exactly 11 digits."); bad = true; }

    if (!password) { setErr("password", "Password is required."); bad = true; }
    else if (getPwdChecks(password).some((c) => !c.passed)) { setErr("password", "Password does not meet all requirements."); bad = true; }

    if (!confirmPassword) { setErr("confirmPassword", "Confirm your password."); bad = true; }
    else if (password !== confirmPassword) { setErr("confirmPassword", "Passwords don't match."); bad = true; }

    if (bad) return;

    setLoading(true);
    try {
      await signup({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone, password });
      setOtpSent(true);
      showAlert("OTP sent to your email!");
    } catch (err) {
      showAlert(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // ─── SIGNUP STEP 2 — verify OTP ─────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    clearErrors();
    if (!/^\d{6}$/.test(otp)) { setErr("otp", "Enter all 6 digits."); return; }
    setLoading(true);
    try {
      await confirmOtp(formData.email.trim(), otp);
    } catch (err) {
      setErr("otp", err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
  const handleForgot = async () => {
    clearErrors();
    const email = formData.email.trim();
    if (!email) { setErr("email", "Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); return; }

    setLoading(true);
    try {
      await sendForgotOtp(email);
      showAlert("Reset OTP sent to your email!");
      switchMode("reset");
    } catch (err) {
      showAlert(err.message || "Failed to send reset OTP");
    } finally {
      setLoading(false);
    }
  };

  // ─── RESET PASSWORD ──────────────────────────────────────────────────────────
  const handleReset = async () => {
    clearErrors();
    if (!/^\d{6}$/.test(otp)) { setErr("otp", "Enter all 6 digits."); return; }
    const { newPassword, confirmPassword } = formData;
    if (!newPassword) { setErr("newPassword", "New password required."); return; }
    if (getPwdChecks(newPassword).some((c) => !c.passed)) { setErr("newPassword", "Password does not meet all requirements."); return; }
    if (!confirmPassword) { setErr("confirmPassword", "Confirm your password."); return; }
    if (newPassword !== confirmPassword) { setErr("confirmPassword", "Passwords don't match."); return; }

    setLoading(true);
    try {
      await confirmResetPassword(formData.email.trim(), otp, newPassword);
      showAlert("Password reset! Please sign in.");
      setFormData({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", newPassword: "" });
      switchMode("login");
    } catch (err) {
      showAlert(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const renderLogin = () => (
    <>
      <Text style={s.eyebrow}>Member Access</Text>
      <Text style={s.heading}>Sign In</Text>
      <Text style={s.subheading}>Welcome back to GoodSoles PH</Text>
      <View style={{ height: 20 }} />

      <FieldInput placeholder="Email address" value={formData.email} onChangeText={set("email")} keyboardType="email-address" error={errors.email} />
      <FieldInput placeholder="Password" value={formData.password} onChangeText={set("password")} secureTextEntry showToggle toggled={showPwd} onToggle={() => setShowPwd((v) => !v)} error={errors.password} />

      <View style={s.forgotRow}>
        <LinkBtn label="Forgot password?" onPress={() => switchMode("forgot")} />
      </View>

      <PrimaryBtn label="SIGN IN" onPress={handleLogin} loading={loading} />

      <View style={s.divider}>
        <View style={s.dividerLine} /><Text style={s.dividerText}>or</Text><View style={s.dividerLine} />
      </View>

      <Text style={s.switchText}>
        Don't have an account?{"  "}
        <Text style={s.switchAccent} onPress={() => switchMode("signup")}>Create one</Text>
      </Text>
    </>
  );

  const renderSignup = () => (
    <>
      <Text style={s.eyebrow}>New Member</Text>
      <Text style={s.heading}>Create Account</Text>
      <Text style={s.subheading}>Join the GoodSoles community</Text>
      <View style={{ height: 16 }} />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <FieldInput placeholder="First name" value={formData.firstName}
            onChangeText={(v) => set("firstName")(v.replace(/[0-9]/g, "").slice(0, 64))}
            error={errors.firstName} editable={!otpSent} />
        </View>
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>
          <FieldInput placeholder="Last name" value={formData.lastName}
            onChangeText={(v) => set("lastName")(v.replace(/[0-9]/g, "").slice(0, 64))}
            error={errors.lastName} editable={!otpSent} />
        </View>
      </View>

      <FieldInput placeholder="Email address" value={formData.email} onChangeText={set("email")} keyboardType="email-address" error={errors.email} editable={!otpSent} />
      <FieldInput placeholder="Phone (09XXXXXXXXX)" value={formData.phone}
        onChangeText={(v) => set("phone")(v.replace(/\D/g, "").slice(0, 11))}
        keyboardType="number-pad" maxLength={11} error={errors.phone} editable={!otpSent} />

      <FieldInput placeholder="Password" value={formData.password} onChangeText={set("password")} secureTextEntry showToggle toggled={showPwd} onToggle={() => setShowPwd((v) => !v)} error={errors.password} />
      {formData.password.length > 0 && <PwdChecklist checks={getPwdChecks(formData.password)} />}
      {pwStrength ? (
        <Text style={[s.strength, { color: STRENGTH_COLOR[pwStrength] || "#555" }]}>{pwStrength}</Text>
      ) : null}

      <View style={{ height: 4 }} />
      <FieldInput placeholder="Confirm password" value={formData.confirmPassword} onChangeText={set("confirmPassword")} secureTextEntry showToggle toggled={showConfirm} onToggle={() => setShowConfirm((v) => !v)} error={errors.confirmPassword} />

      {/* Terms & Privacy */}
      <View style={s.termsRow}>
        <View style={[s.pseudoCheck, bothAgreed && s.pseudoCheckDone]}>
          {bothAgreed && <Text style={s.pseudoCheckMark}>✓</Text>}
        </View>
        <Text style={s.termsText}>
          I agree to the{" "}
          <Text style={[s.termsLink, termsAgreed && s.termsLinkDone]} onPress={() => setLegalModal("terms")}>
            Terms of Use{termsAgreed ? " ✓" : " ↗"}
          </Text>
          {"  &  "}
          <Text style={[s.termsLink, privacyAgreed && s.termsLinkDone]} onPress={() => setLegalModal("privacy")}>
            Privacy Policy{privacyAgreed ? " ✓" : " ↗"}
          </Text>
        </Text>
      </View>
      {errors.agreed ? <Text style={s.fieldError}>{errors.agreed}</Text> : null}

      {!otpSent ? (
        <PrimaryBtn label="CONTINUE" onPress={handleSendOtp} loading={loading} />
      ) : (
        <View style={{ marginTop: 10 }}>
          <Text style={s.otpHint}>Enter the 6-digit code sent to <Text style={{ color: "#aaa" }}>{formData.email}</Text></Text>
          <OtpInput value={otp} onChange={setOtp} error={errors.otp} />
          <PrimaryBtn label="VERIFY & CREATE ACCOUNT" onPress={handleVerifyOtp} loading={loading} />
        </View>
      )}

      <Text style={[s.switchText, { marginTop: 14 }]}>
        Already have an account?{"  "}
        <Text style={s.switchAccent} onPress={() => switchMode("login")}>Sign in</Text>
      </Text>
    </>
  );

  const renderForgot = () => (
    <>
      <TouchableOpacity onPress={() => switchMode("login")} style={{ marginBottom: 12 }}>
        <Text style={s.backBtn}>← Back to sign in</Text>
      </TouchableOpacity>
      <Text style={s.eyebrow}>Account Recovery</Text>
      <Text style={s.heading}>Forgot Password?</Text>
      <Text style={s.subheading}>We'll send a reset code to your email</Text>
      <View style={{ height: 20 }} />

      <FieldInput placeholder="Email address" value={formData.email} onChangeText={set("email")} keyboardType="email-address" error={errors.email} />
      <PrimaryBtn label="SEND RESET CODE" onPress={handleForgot} loading={loading} />
    </>
  );

  const renderReset = () => (
    <>
      <Text style={s.eyebrow}>Account Recovery</Text>
      <Text style={s.heading}>Reset Password</Text>
      <Text style={s.subheading}>Enter the code and your new password</Text>
      <View style={{ height: 16 }} />

      <FieldInput placeholder="New password" value={formData.newPassword} onChangeText={set("newPassword")} secureTextEntry showToggle toggled={showNewPwd} onToggle={() => setShowNewPwd((v) => !v)} error={errors.newPassword} />
      {formData.newPassword.length > 0 && <PwdChecklist checks={getPwdChecks(formData.newPassword)} />}
      {pwStrength ? (
        <Text style={[s.strength, { color: STRENGTH_COLOR[pwStrength] || "#555" }]}>{pwStrength}</Text>
      ) : null}

      <View style={{ height: 4 }} />
      <FieldInput placeholder="Confirm new password" value={formData.confirmPassword} onChangeText={set("confirmPassword")} secureTextEntry showToggle toggled={showResetConfirm} onToggle={() => setShowResetConfirm((v) => !v)} error={errors.confirmPassword} />

      <OtpInput value={otp} onChange={setOtp} error={errors.otp} />
      <PrimaryBtn label="RESET PASSWORD" onPress={handleReset} loading={loading} />
    </>
  );

  const FORM = { login: renderLogin, signup: renderSignup, forgot: renderForgot, reset: renderReset };

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require("../../assets/loginbg.png")}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={s.overlay} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
            <Avatar />
            {FORM[mode]?.()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Legal modals */}
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
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" },
  content: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "rgba(10,10,10,0.85)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 22 },
  eyebrow: { textAlign: "center", fontSize: 9, letterSpacing: 2.5, color: "#383838", textTransform: "uppercase", marginBottom: 4 },
  heading: { textAlign: "center", fontSize: 34, fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 0.5 },
  subheading: { textAlign: "center", color: "#383838", fontSize: 12, marginTop: 4, marginBottom: 2 },
  forgotRow: { alignItems: "flex-end", marginBottom: 10, marginTop: 2 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: "#161616" },
  dividerText: { color: "#2a2a2a", fontSize: 10, letterSpacing: 1.5 },
  switchText: { textAlign: "center", color: "#333", fontSize: 12 },
  switchAccent: { color: colors.accentGold },
  row: { flexDirection: "row" },
  strength: { fontSize: 11, marginTop: 4, marginLeft: 2, fontWeight: "600" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10, marginBottom: 4 },
  pseudoCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 0.5, borderColor: "#222", backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", marginTop: 1 },
  pseudoCheckDone: { borderColor: "#444", backgroundColor: "#161616" },
  pseudoCheckMark: { color: "#aaa", fontSize: 10, fontWeight: "800" },
  termsText: { flex: 1, color: "#555", fontSize: 12, lineHeight: 18 },
  termsLink: { color: colors.accentGoldLight, textDecorationLine: "underline" },
  termsLinkDone: { color: colors.success },
  fieldError: { color: "#8b2020", fontSize: 11, marginBottom: 4, marginLeft: 2 },
  otpHint: { color: "#444", fontSize: 12, textAlign: "center", marginBottom: 8 },
  backBtn: { color: "#555", fontSize: 12 },
});