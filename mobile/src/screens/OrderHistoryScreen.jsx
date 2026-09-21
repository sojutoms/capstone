import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BASE_URL } from "../api/config";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  TextInput,
  Linking,
  AppState,
  RefreshControl,
} from "react-native";
import { Alert } from "../utils/customAlert";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import { fonts, radius, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

const ORDERS_PER_PAGE = 5;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "shipping",
  "completed",
  "refund_requested",
  "refunded",
];

const STATUS_COLORS = {
  pending:          { bg: "#2a2000", text: "#f5c518", border: "#f5c518" },
  confirmed:        { bg: "#001a2a", text: "#4fc3f7", border: "#4fc3f7" },
  shipping:         { bg: "#001a10", text: "#4caf50", border: "#4caf50" },
  completed:        { bg: "#0a0a0a", text: "#fff",    border: "#fff"    },
  refund_requested: { bg: "#2a1000", text: "#ff9800", border: "#ff9800" },
  refunded:         { bg: "#1a0020", text: "#ce93d8", border: "#ce93d8" },
  cancelled:        { bg: "#1a0000", text: "#ef5350", border: "#ef5350" },
};

const normalizeStatus = (s) =>
  String(s || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");

const prettyStatus = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Delivered → Completed auto-transition + refund window (matches web) ──────
// A "delivered" order counts as "completed" once this many days have passed,
// even though the DB status field itself never changes until the customer
// taps "Confirm Received" (or the refund endpoint promotes it as a side
// effect). This is purely a client-side display/gating computation.
const DELIVERED_AUTO_COMPLETE_DAYS = 3;
// How long after completion a refund can still be requested. Web's own
// client enforces 1 day here even though the backend allows 3 — matching
// web's actual behavior means matching its (stricter) client constant.
const REFUND_WINDOW_DAYS = 1;

const daysElapsed = (isoTimestamp, days) => {
  if (!isoTimestamp) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(isoTimestamp).getTime() >= ms;
};

const escapeHtml = (str) => String(str ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const buildReceiptHtml = (order) => {
  const subtotal = order.subtotal || order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingFee = Number(order.shippingFee) || 0;
  const total = order.total || 0;
  const rows = order.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.name)}<div class="meta">Size: ${escapeHtml(it.size)}</div></td>
      <td class="c">${it.quantity}</td>
      <td class="r">₱${Number(it.price).toLocaleString()}</td>
    </tr>`).join("");
  return `
<!doctype html><html><head><meta charset="utf-8" />
<title>Receipt - Order ${escapeHtml(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; }
  h1 { margin: 0 0 4px; letter-spacing: 4px; }
  .sub { color: #666; font-size: 12px; letter-spacing: 1px; }
  .header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #666; border-bottom: 1px solid #ccc; padding: 10px 8px; }
  td { padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  .meta { font-size: 11px; color: #888; margin-top: 3px; }
  .c { text-align: center; } .r { text-align: right; }
  .summary td { border: none; padding: 6px 8px; font-size: 13px; }
  .summary tr.total td { border-top: 2px solid #111; font-weight: 700; font-size: 15px; padding-top: 12px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; letter-spacing: 0.5px; }
</style></head><body>
  <div class="header">
    <h1>GOODSOLES.PH</h1>
    <div class="sub">ORDER RECEIPT · #${escapeHtml(order.orderNumber)}</div>
    <div class="sub">${new Date(order.timestamp).toLocaleString()}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="summary">
    <tr><td>Subtotal</td><td class="r">₱${subtotal.toLocaleString()}</td></tr>
    <tr><td>Shipping</td><td class="r">₱${shippingFee.toLocaleString()}</td></tr>
    <tr class="total"><td>TOTAL PAID</td><td class="r">₱${total.toLocaleString()}</td></tr>
  </table>
  <div class="footer">
    Thank you for choosing GoodSoles PH.<br/>
    This is a digitally generated receipt.
  </div>
</body></html>`;
};

const buildCertificateHtml = (order) => {
  const serial = `GS-${String(order.orderNumber).padStart(6, "0")}-${String(order.timestamp).slice(-4)}`;
  const item = order.items?.[0]?.name || "Premium Selection";
  const date = new Date(order.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `
<!doctype html><html><head><meta charset="utf-8" />
<title>Certificate - Order ${escapeHtml(order.orderNumber)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; padding: 0; color: #111; margin: 0; }
  .wrap { padding: 48px; }
  .frame { border: 3px double #111; padding: 40px; position: relative; }
  .frame::before { content: ''; position: absolute; inset: 8px; border: 1px solid #111; pointer-events: none; }
  .brand { text-align: center; letter-spacing: 6px; font-size: 12px; color: #666; margin-bottom: 8px; }
  h1 { text-align: center; font-size: 26px; letter-spacing: 6px; margin: 0 0 6px; }
  .subtitle { text-align: center; letter-spacing: 4px; font-size: 11px; color: #888; margin-bottom: 32px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ccc; font-size: 13px; }
  .row .k { text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #666; }
  .row .v { font-weight: 600; }
  .statement { margin-top: 24px; font-size: 12px; line-height: 1.6; color: #333; text-align: center; padding: 0 12px; }
  .footer { display: flex; justify-content: space-between; margin-top: 40px; align-items: end; }
  .sig-line { border-top: 1px solid #111; width: 180px; padding-top: 6px; text-align: center; font-size: 10px; letter-spacing: 2px; color: #666; }
  .seal { border: 2px solid #111; border-radius: 50%; width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
</style></head><body>
  <div class="wrap">
    <div class="frame">
      <div class="brand">GOODSOLES.PH</div>
      <h1>CERTIFICATE OF AUTHENTICITY</h1>
      <div class="subtitle">PREMIUM COLLECTOR SERIES</div>
      <div class="row"><span class="k">Item Identifier</span><span class="v">${escapeHtml(item)}</span></div>
      <div class="row"><span class="k">Acquisition Date</span><span class="v">${escapeHtml(date)}</span></div>
      <div class="row"><span class="k">Verification ID</span><span class="v">${escapeHtml(serial)}</span></div>
      <p class="statement">
        This digital certificate verifies that the aforementioned item has undergone a rigorous
        multi-point inspection by GoodSoles experts and is guaranteed 100% authentic.
      </p>
      <div class="footer">
        <div class="sig-line">AUTHORIZED SIGNATURE</div>
        <div class="seal">AUTHENTIC</div>
      </div>
    </div>
  </div>
</body></html>`;
};

const shareGeneratedPdf = async (html, filename) => {
  const { uri: printedUri } = await Print.printToFileAsync({ html, base64: false });

  // On Android, Print writes to a system-owned Print cache path that
  // FileProvider refuses to expose to other apps ("Not allowed to read file
  // under given URL"). Copy into our own cache directory first — that path
  // IS covered by the FileProvider config, so shareAsync can hand it off.
  let shareUri = printedUri;
  try {
    const targetDir = FileSystem.cacheDirectory;
    if (targetDir) {
      const safeName = filename.replace(/[^\w.-]/g, "_");
      const dest = `${targetDir}${safeName}`;
      try { await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
      await FileSystem.copyAsync({ from: printedUri, to: dest });
      shareUri = dest;
    }
  } catch (err) {
    console.log("PDF copy fallback:", err?.message || err);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }
  return shareUri;
};

const effectiveStatus = (order) => {
  const raw = normalizeStatus(order.displayStatus || order.status);
  if (raw === "delivered") {
    const deliveredAt = order.deliveredAt || order.updatedAt;
    if (daysElapsed(deliveredAt, DELIVERED_AUTO_COMPLETE_DAYS)) return "completed";
    return "shipping";
  }
  return raw;
};

const canRequestRefund = (order) => {
  if (effectiveStatus(order) !== "completed") return false;
  if (order.refundStatus || order.refundReason) return false;
  const completedAt = order.completedAt || order.updatedAt;
  return !daysElapsed(completedAt, REFUND_WINDOW_DAYS);
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove, styles }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onRemove(toast.id));
  }, []);

  const isSuccess = toast.type === "success";

  return (
    <Animated.View style={[styles.toast, isSuccess ? styles.toastSuccess : styles.toastError, { opacity }]}>
      <Text style={styles.toastIcon}>{isSuccess ? "✓" : "!"}</Text>
      <Text style={styles.toastMsg} numberOfLines={2}>{toast.message}</Text>
      <TouchableOpacity onPress={() => onRemove(toast.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.toastClose}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, styles }) {
  const normalized = normalizeStatus(status);
  const statusColors = STATUS_COLORS[normalized] || STATUS_COLORS.pending;
  return (
    <View style={[styles.pill, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
      <Text style={[styles.pillText, { color: statusColors.text }]}>{prettyStatus(normalized)}</Text>
    </View>
  );
}

// ─── Payment pending helpers ────────────────────────────────────────────────

const isAwaitingPayment = (order) =>
  order.paymentMethod === "online" &&
  order.paymentStatus &&
  order.paymentStatus !== "paid" &&
  !["cancelled", "refunded"].includes(normalizeStatus(order.status));

// Formats ms remaining as "M:SS". Returns null until a checkout attempt has
// actually started a reservation window.
const formatCountdown = (order, nowTick) => {
  if (!order.checkoutReservedUntil) return null;
  const remainingMs = new Date(order.checkoutReservedUntil).getTime() - nowTick;
  if (remainingMs <= 0) return "0:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

function PaymentPendingPill({ order, nowTick, styles }) {
  if (!isAwaitingPayment(order)) return null;
  const countdown = formatCountdown(order, nowTick);
  return (
    <View style={styles.paymentPill}>
      <Text style={styles.paymentPillText}>
        ⚠ AWAITING PAYMENT{countdown ? ` · ${countdown}` : ""}
      </Text>
    </View>
  );
}

function PaymentPendingBanner({ order, nowTick, onRetry, retrying, styles, colors }) {
  if (!isAwaitingPayment(order)) return null;
  const countdown = formatCountdown(order, nowTick);
  const expired = countdown === "0:00";
  return (
    <View style={styles.paymentBanner}>
      <Text style={styles.paymentBannerText}>
        ⚠ Payment not completed for this order — it won't be processed until payment goes through, and the item(s) may sell out to someone else in the meantime.
      </Text>
      {countdown && (
        <Text style={[styles.paymentCountdown, expired && styles.paymentCountdownExpired]}>
          {expired ? "Cancelling — payment window expired" : `Time left to pay: ${countdown}`}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.paymentRetryBtn, retrying && styles.btnDisabled]}
        onPress={() => onRetry(order)}
        disabled={retrying}
      >
        {retrying
          ? <ActivityIndicator size="small" color={colors.textInverse} />
          : <Text style={styles.paymentRetryBtnText}>COMPLETE PAYMENT</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ status, styles }) {
  const normalized = normalizeStatus(status);
  if (normalized === "cancelled") {
    return (
      <View style={styles.cancelledBanner}>
        <Text style={styles.cancelledText}>ORDER CANCELLED</Text>
      </View>
    );
  }
  // Refund steps only matter (and only render) once an order actually
  // enters that flow — showing them on every normal order just pushed
  // "Completed" off the edge for no reason.
  const isRefundFlow = normalized === "refund_requested" || normalized === "refunded";
  const steps = isRefundFlow ? STATUS_STEPS : STATUS_STEPS.slice(0, 4);
  const activeIdx = steps.indexOf(normalized);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
      <View style={styles.timeline}>
        {steps.map((step, i) => {
          const isActive = i <= activeIdx;
          const isCurrent = i === activeIdx;
          return (
            <View key={step} style={styles.timelineStep}>
              {/* connector line before dot */}
              {i > 0 && (
                <View style={[styles.timelineLine, isActive && styles.timelineLineActive]} />
              )}
              <View style={[
                styles.timelineDot,
                isActive && styles.timelineDotActive,
                isCurrent && styles.timelineDotCurrent,
              ]} />
              <Text style={[styles.timelineLabel, isActive && styles.timelineLabelActive]}>
                {prettyStatus(step)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Refund Modal ─────────────────────────────────────────────────────────────

// Matches web's RefundModal.jsx select options exactly.
const REFUND_REASONS = [
  "Item not as described",
  "Wrong item received",
  "Damaged or defective",
  "Size/fit issue",
  "Other",
];

const MAX_REFUND_MEDIA = 6;

function RefundModal({ visible, order, onClose, onSubmit, submitting, styles, colors }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [media, setMedia] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (visible) { setReason(""); setNotes(""); setMedia([]); setErrors({}); }
  }, [visible]);

  const addPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Needed", "Photo library access is required to attach evidence.");
      return;
    }
    const remaining = MAX_REFUND_MEDIA - media.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      setMedia((prev) => [...prev, ...result.assets.slice(0, remaining)].slice(0, MAX_REFUND_MEDIA));
      if (errors.media) setErrors((p) => { const n = { ...p }; delete n.media; return n; });
    }
  };

  const removePhoto = (idx) => setMedia((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e = {};
    if (!reason) e.reason = "Please select an item in the list.";
    if (media.length === 0) e.media = "Please attach at least one photo or video showing the issue.";
    return e;
  };

  const handleSubmit = () => {
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit(reason, notes, media);
  };

  const clearError = (field) => {
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>REQUEST REFUND</Text>
            {order && (
              <Text style={styles.modalSubtitle}>Order #{order.orderNumber}</Text>
            )}

            <Text style={styles.inputLabel}>REASON *</Text>
            <View style={styles.reasonList}>
              {REFUND_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonOption, reason === r && styles.reasonOptionSelected]}
                  onPress={() => { setReason(r); clearError("reason"); }}
                >
                  <View style={[styles.radioCircle, reason === r && styles.radioCircleFilled]} />
                  <Text style={[styles.reasonText, reason === r && styles.reasonTextSelected]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.reason && <Text style={styles.reviewErrorText}>{errors.reason}</Text>}

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>ADDITIONAL DETAILS (OPTIONAL)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Anything else we should know…"
              placeholderTextColor={colors.bgTertiary}
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>PHOTO EVIDENCE * ({media.length}/{MAX_REFUND_MEDIA})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {media.map((m, i) => (
                <View key={m.uri} style={styles.refundThumbWrap}>
                  <Image source={{ uri: m.uri }} style={styles.refundThumb} />
                  <TouchableOpacity style={styles.refundThumbRemove} onPress={() => removePhoto(i)}>
                    <Text style={styles.refundThumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {media.length < MAX_REFUND_MEDIA && (
                <TouchableOpacity
                  style={[styles.refundAddPhoto, errors.media && { borderColor: colors.danger }]}
                  onPress={addPhotos}
                >
                  <Text style={styles.refundAddPhotoText}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <Text style={styles.refundMediaHint}>At least one photo of the item is required.</Text>
            {errors.media && <Text style={styles.reviewErrorText}>{errors.media}</Text>}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose} disabled={submitting}>
              <Text style={styles.modalBtnSecondaryText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, submitting && styles.modalBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={styles.modalBtnPrimaryText}>SUBMIT</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Review Modal (per-item, matches web's ReviewModal.jsx fields) ────────────

const REVIEW_FIT_OPTIONS = ["Runs Small", "True to Size", "Runs Big"];
const REVIEW_COMFORT_OPTIONS = ["Uncomfortable", "Average", "Very Comfortable"];

function RadioGroup({ options, value, onChange, styles }) {
  return (
    <View style={styles.radioGroupRow}>
      {options.map((opt) => (
        <TouchableOpacity key={opt} style={styles.radioPill} onPress={() => onChange(opt)}>
          <View style={[styles.radioCircle, value === opt && styles.radioCircleFilled]} />
          <Text style={[styles.reasonText, value === opt && styles.reasonTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewModal({ visible, product, onClose, onSubmit, submitting, styles, colors, isDark }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [fit, setFit] = useState("");
  const [comfort, setComfort] = useState("");
  const [recommend, setRecommend] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (visible) {
      setRating(0); setReview("");
      setFit(""); setComfort(""); setRecommend(""); setAgreed(false);
      setErrors({});
    }
  }, [visible]);

  const validate = () => {
    const e = {};
    if (rating === 0) e.rating = "Please select a rating.";
    const trimmed = review.trim();
    if (!trimmed) e.review = "Please write your review.";
    else if (trimmed.length < 10) e.review = "Review must be at least 10 characters.";
    if (!agreed) e.agreed = "Please agree to the terms.";
    return e;
  };

  const handleSubmit = () => {
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit({ rating, review: review.trim(), fit, comfort, recommend });
  };

  const clearError = (field) => {
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: "88%" }]}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>WRITE A REVIEW</Text>
            {product && (
              <View style={styles.modalItem}>
                <Image source={{ uri: product.image }} style={styles.modalItemImg} />
                <Text style={styles.modalItemName} numberOfLines={2}>{product.name}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>OVERALL RATING *</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: errors.rating ? 4 : 14 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => { setRating(i); clearError("rating"); }}>
                  <Text style={{ fontSize: 28, color: i <= rating ? colors.accentGold : (isDark ? colors.textMuted : colors.bgTertiary) }}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.rating && <Text style={styles.reviewErrorText}>{errors.rating}</Text>}

            <Text style={styles.inputLabel}>YOUR REVIEW * (min. 10 characters)</Text>
            <TextInput
              style={[styles.reviewInput, errors.review && styles.reviewInputError]}
              placeholder="Describe what you liked, what you didn't, and other key things shoppers should know."
              placeholderTextColor={colors.bgTertiary}
              multiline
              maxLength={5000}
              value={review}
              onChangeText={(v) => { setReview(v); clearError("review"); }}
            />
            <Text style={styles.writeMuted}>{review.length}/5000</Text>
            {errors.review && <Text style={styles.reviewErrorText}>{errors.review}</Text>}

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>HOW DID THIS PRODUCT FIT?</Text>
            <RadioGroup options={REVIEW_FIT_OPTIONS} value={fit} onChange={setFit} styles={styles} />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>HOW COMFORTABLE WAS IT?</Text>
            <RadioGroup options={REVIEW_COMFORT_OPTIONS} value={comfort} onChange={setComfort} styles={styles} />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>WOULD YOU RECOMMEND IT?</Text>
            <RadioGroup options={["Yes", "No"]} value={recommend} onChange={setRecommend} styles={styles} />

            <TouchableOpacity style={styles.agreeRow} onPress={() => { setAgreed(!agreed); clearError("agreed"); }}>
              <View style={[styles.radioCircle, agreed && styles.radioCircleFilled, { borderRadius: 4 }]} />
              <Text style={styles.writeMuted}>
                I agree to the terms and understand my review may be used for marketing purposes.
              </Text>
            </TouchableOpacity>
            {errors.agreed && <Text style={styles.reviewErrorText}>{errors.agreed}</Text>}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose} disabled={submitting}>
              <Text style={styles.modalBtnSecondaryText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, submitting && styles.modalBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={styles.modalBtnPrimaryText}>SUBMIT</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  order, visible, onClose, onRefund, onReviewItem, onConfirmReceived,
  confirmingReceived, nowTick, onRetryPayment, retryingId, onCancel, cancelling, styles, colors,
}) {
  if (!order) return null;
  const rawIsDelivered = normalizeStatus(order.status) === "delivered";
  const isCompleted = effectiveStatus(order) === "completed";
  const canReview = isCompleted;
  const canRefund = canRequestRefund(order);
  const isCancellable = normalizeStatus(order.status) === "pending";
  const alreadyRefunded = !!(order.refundStatus || order.refundReason);

  const [receiptBusy, setReceiptBusy] = useState(false);
  const [certBusy, setCertBusy]       = useState(false);

  const handleReceipt = async () => {
    if (receiptBusy) return;
    setReceiptBusy(true);
    try {
      await shareGeneratedPdf(buildReceiptHtml(order), `Receipt-${order.orderNumber}.pdf`);
    } catch (err) {
      Alert.alert("Receipt", err?.message || "Could not generate receipt.");
    } finally {
      setReceiptBusy(false);
    }
  };

  const handleCertificate = async () => {
    if (certBusy) return;
    setCertBusy(true);
    try {
      await shareGeneratedPdf(buildCertificateHtml(order), `Certificate-${order.orderNumber}.pdf`);
    } catch (err) {
      Alert.alert("Certificate", err?.message || "Could not generate certificate.");
    } finally {
      setCertBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>ORDER #{order.orderNumber}</Text>
            <Text style={styles.modalSubtitle}>
              {new Date(order.timestamp).toLocaleString()}
            </Text>
            <View style={{ marginBottom: 12 }}>
              <StatusPill status={order.status} styles={styles} />
            </View>

            <PaymentPendingBanner
              order={order}
              nowTick={nowTick}
              onRetry={onRetryPayment}
              retrying={retryingId === order.orderNumber}
              styles={styles}
              colors={colors}
            />

            {rawIsDelivered && (
              <View style={styles.confirmReceivedBanner}>
                <Text style={styles.confirmReceivedText}>
                  Received your order? Confirming lets you write reviews and request a refund if needed.
                </Text>
                <TouchableOpacity
                  style={[styles.paymentRetryBtn, confirmingReceived && styles.btnDisabled]}
                  onPress={() => onConfirmReceived(order)}
                  disabled={confirmingReceived}
                >
                  {confirmingReceived
                    ? <ActivityIndicator size="small" color={colors.textInverse} />
                    : <Text style={styles.paymentRetryBtnText}>CONFIRM RECEIVED</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {order.items.map((item, i) => (
              <View key={i} style={styles.modalItem}>
                <Image source={{ uri: item.image }} style={styles.modalItemImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.modalItemMeta}>Size: {item.size}  ×{item.quantity}</Text>
                  <Text style={styles.modalItemPrice}>₱{Number(item.price).toLocaleString()}</Text>
                  {canReview && (
                    <TouchableOpacity style={styles.btnReviewSmall} onPress={() => onReviewItem(item)}>
                      <Text style={styles.btnReviewText}>WRITE REVIEW</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.modalItemTotal}>
                  ₱{(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>TOTAL PAID</Text>
              <Text style={styles.modalTotalAmount}>₱{Number(order.total).toLocaleString()}</Text>
            </View>

            {alreadyRefunded && (
              <Text style={styles.refundAlreadyText}>
                ↩ A refund has already been requested for this order.
              </Text>
            )}

            {isCompleted && (
              <View style={styles.detailUtilRow}>
                <TouchableOpacity
                  style={[styles.detailUtilBtn, certBusy && styles.btnDisabled]}
                  onPress={handleCertificate}
                  disabled={certBusy}
                  activeOpacity={0.85}
                >
                  {certBusy
                    ? <ActivityIndicator size="small" color={colors.textPrimary} />
                    : <Text style={styles.detailUtilBtnText}>🛡  CERTIFICATE</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailUtilBtn, receiptBusy && styles.btnDisabled]}
                  onPress={handleReceipt}
                  disabled={receiptBusy}
                  activeOpacity={0.85}
                >
                  {receiptBusy
                    ? <ActivityIndicator size="small" color={colors.textPrimary} />
                    : <Text style={styles.detailUtilBtnText}>📄  RECEIPT</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {canRefund && (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => onRefund(order)}>
                  <Text style={styles.modalBtnSecondaryText}>REQUEST REFUND</Text>
                </TouchableOpacity>
              </View>
            )}

            {isCancellable && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtnDanger, cancelling && styles.btnDisabled]}
                  onPress={() => onCancel(order)}
                  disabled={cancelling}
                >
                  {cancelling
                    ? <ActivityIndicator size="small" color="#ef5350" />
                    : <Text style={styles.modalBtnDangerText}>CANCEL ORDER</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrderHistoryScreen({ navigation }) {
  const { userToken } = useAuth();
  const { refreshCart } = useCart();
  const { refreshFavorites } = useFavorites();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [reviewVisible, setReviewVisible]       = useState(false);
  const [reviewProduct, setReviewProduct]       = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);

  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingIds, setLoadingIds]   = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected]               = useState(null);
  const [detailVisible, setDetailVisible]     = useState(false);
  const [refundVisible, setRefundVisible]     = useState(false);
  const [refundOrder, setRefundOrder]         = useState(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Payment retry (PayMongo hosted checkout) — opened in the external
  // browser rather than an in-app WebView (that native module isn't linked
  // in this dev build); auto-verifies once the user comes back to the app.
  const [verifying, setVerifying]             = useState(false);
  const [pendingOrderNumber, setPendingOrderNumber] = useState(null);
  const [retryingId, setRetryingId]           = useState(null);
  const pendingOrderRef = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && pendingOrderRef.current) {
        const orderNumber = pendingOrderRef.current;
        pendingOrderRef.current = null;
        finalizePayment(orderNumber);
      }
    });
    return () => sub.remove();
  }, []);

  // Ticks once a second so "time left to pay" countdowns stay live without refetching.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [toasts, setToasts]   = useState([]);
  const toastIdRef            = useRef(0);

  const addToast = useCallback((type, message) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // ── Fetch ──

  // `silent` skips the full-screen loading state — used by pull-to-refresh,
  // which shows its own small spinner and shouldn't swap the whole list out.
  const fetchOrders = useCallback(async (page = 1, status = "all", silent = false) => {
    if (!userToken) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/orderhistory?page=${page}&limit=${ORDERS_PER_PAGE}&status=${status}`,
        { headers: { "auth-token": userToken } }
      );
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        setCurrentPage(data.page || page);
        setTotalPages(
          Math.max(1, Math.ceil((data.total || (data.orders || []).length) / (data.limit || ORDERS_PER_PAGE)))
        );
      } else {
        addToast("error", data.error || "Failed to load orders.");
      }
    } catch {
      addToast("error", "Failed to load orders.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userToken, addToast]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(currentPage, statusFilter, true), refreshCart(), refreshFavorites()]);
    setRefreshing(false);
  };

  useEffect(() => { fetchOrders(currentPage, statusFilter); }, [currentPage, statusFilter]);

  // ── Retry payment (PayMongo hosted checkout) ──

  const retryPayment = async (order) => {
    setRetryingId(order.orderNumber);
    try {
      const res = await fetch(`${BASE_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "auth-token": userToken, "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: order.orderNumber }),
      });
      const data = await res.json();
      if (data.success && data.checkoutUrl) {
        pendingOrderRef.current = order.orderNumber;
        setPendingOrderNumber(order.orderNumber);
        setRetryingId(null);
        await Linking.openURL(data.checkoutUrl);
      } else {
        addToast("error", data.error || "Could not start payment.");
        setRetryingId(null);
        // A sold-out item or an expired payment window means the server
        // already auto-cancelled this order — reflect that immediately.
        if (data.soldOut || data.expired) {
          const patch = (o) => (o.orderNumber === order.orderNumber ? { ...o, status: "cancelled" } : o);
          setOrders((prev) => prev.map(patch));
          setSelected((prev) => (prev && prev.orderNumber === order.orderNumber ? patch(prev) : prev));
        }
      }
    } catch {
      addToast("error", "Could not start payment.");
      setRetryingId(null);
    }
  };

  const finalizePayment = async (orderNumber) => {
    setPendingOrderNumber(null);
    setVerifying(true);
    let paid = false;
    let purchasedItems = [];
    try {
      await fetch(`${BASE_URL}/payment/verify/${orderNumber}`, {
        headers: { "auth-token": userToken },
      });

      const orderRes = await fetch(`${BASE_URL}/order/${orderNumber}`, {
        headers: { "auth-token": userToken },
      });
      const orderData = await orderRes.json();
      if (orderData.success) {
        paid = orderData.order.paymentStatus === "paid";
        purchasedItems = orderData.order.items || [];
      }
    } catch {}
    setVerifying(false);

    if (paid) {
      navigation.navigate("Cart", { screen: "Orders", params: { orderNumber, purchasedItems } });
    }
    fetchOrders(currentPage, statusFilter);
  };

  // ── Cancel ──

  const cancelOrder = async (order) => {
    Alert.alert(
      "Cancel Order",
      `Cancel Order #${order.orderNumber}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setLoadingIds((p) => [...p, order.orderNumber]);
            try {
              const res = await fetch(`${BASE_URL}/order/${order.orderNumber}/cancel`, {
                method: "PUT",
                headers: { "auth-token": userToken, "Content-Type": "application/json" },
              });
              const data = await res.json();
              if (data.success) {
                addToast("success", "Order cancelled successfully.");
                fetchOrders(currentPage, statusFilter);
              } else {
                addToast("error", data.error || "Failed to cancel.");
              }
            } catch {
              addToast("error", "Failed to cancel order.");
            } finally {
              setLoadingIds((p) => p.filter((id) => id !== order.orderNumber));
            }
          },
        },
      ]
    );
  };

  // ── Refund ──

  const submitRefund = async (reason, notes, media) => {
    if (!refundOrder) return;
    setRefundSubmitting(true);
    setLoadingIds((p) => [...p, refundOrder.orderNumber]);
    try {
      const formData = new FormData();
      formData.append("reason", reason);
      if (notes) formData.append("notes", notes);
      media.forEach((asset, i) => {
        const filename = asset.uri.split("/").pop() || `refund-${i}.jpg`;
        const ext = (filename.split(".").pop() || "jpg").toLowerCase();
        formData.append("media", {
          uri: asset.uri,
          name: filename,
          type: `image/${ext === "jpg" ? "jpeg" : ext}`,
        });
      });

      const { status, body } = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${BASE_URL}/order/${refundOrder.orderNumber}/refund`);
        xhr.setRequestHeader("auth-token", userToken || "");
        xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.ontimeout = () => reject(new Error("Request timed out"));
        xhr.send(formData);
      });

      let data;
      try { data = JSON.parse(body || "{}"); }
      catch { data = { success: false, error: `Server returned ${status}.` }; }

      if (data.success) {
        addToast("success", "Refund request submitted.");
        setRefundVisible(false);
        setRefundOrder(null);
        fetchOrders(currentPage, statusFilter);
      } else {
        addToast("error", data.error || data.message || `Refund request failed (${status}).`);
      }
    } catch (err) {
      console.log("submitRefund error:", err?.message || err);
      addToast("error", err?.message || "Failed to submit refund request.");
    } finally {
      setRefundSubmitting(false);
      setLoadingIds((p) => p.filter((id) => id !== refundOrder?.orderNumber));
    }
  };

  const openReviewModal = (item) => {
    setReviewProduct(item);
    setReviewVisible(true);
  };

  // Reviews are per-product, not tied to the order — matches web's
  // ReviewModal, which never sends an orderId to the backend either.
  const submitReviewForm = async (payload) => {
    if (!reviewProduct) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/addreview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken },
        body: JSON.stringify({
          productId: reviewProduct.productId || reviewProduct.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (data.success !== false) {
        addToast("success", "Review submitted!");
        setReviewVisible(false);
        setReviewProduct(null);
      } else {
        addToast("error", data.error || data.message || "Failed to submit review.");
      }
    } catch {
      addToast("error", "Failed to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const confirmOrderReceived = async (order) => {
    setConfirmingReceived(true);
    try {
      const res = await fetch(`${BASE_URL}/order/${order.orderNumber}/confirm-received`, {
        method: "POST",
        headers: { "auth-token": userToken, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "Order marked as received. Thank you!");
        fetchOrders(currentPage, statusFilter);
      } else {
        addToast("error", data.error || "Failed to confirm receipt.");
      }
    } catch {
      addToast("error", "Failed to confirm receipt.");
    } finally {
      setConfirmingReceived(false);
    }
  };

  // ── Render order card ──

  const renderOrder = ({ item: order }) => {
    const normalized   = normalizeStatus(order.status);
    const isCancellable = normalized === "pending";
    const canRefund    = canRequestRefund(order);
    const isLoading    = loadingIds.includes(order.orderNumber);

    return (
      <View style={styles.card}>
        {/* Everything that opens the details modal lives in its own
            TouchableOpacity — the Timeline below is a plain sibling, not
            nested inside it, so swiping the status steps can never get
            mistaken for a tap that pops the modal open. */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setSelected(order); setDetailVisible(true); }}
        >
          {/* Card header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardOrderNum}>#{order.orderNumber}</Text>
              <Text style={styles.cardDate}>
                {new Date(order.timestamp).toLocaleDateString("en-PH", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </Text>
            </View>
            <StatusPill status={order.status} styles={styles} />
          </View>

          <PaymentPendingPill order={order} nowTick={nowTick} styles={styles} />

          {/* Items preview */}
          <View style={styles.itemsPreview}>
            {order.items.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Image source={{ uri: item.image }} style={styles.itemThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemMeta}>Size {item.size}  ×{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  ₱{(Number(item.price) * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
            {order.items.length > 3 && (
              <Text style={styles.moreItems}>+{order.items.length - 3} more item{order.items.length - 3 !== 1 ? "s" : ""}</Text>
            )}
          </View>

          {/* Total */}
          <View style={styles.cardTotalRow}>
            <Text style={styles.cardTotalLabel}>ORDER TOTAL</Text>
            <Text style={styles.cardTotalAmount}>₱{Number(order.total).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>

        {/* Timeline — swipeable, sits outside the tap-to-open-details area */}
        <Timeline status={order.status} styles={styles} />

        {/* Actions */}
        <View style={styles.cardActions}>
          {canRefund && (
            <TouchableOpacity
              style={styles.btnWarning}
              onPress={() => { setRefundOrder(order); setRefundVisible(true); }}
              disabled={isLoading || refundSubmitting}
            >
              <Text style={styles.btnWarningText}>
                {isLoading ? "PROCESSING..." : "REQUEST REFUND"}
              </Text>
            </TouchableOpacity>
          )}

          {isCancellable && (
            <TouchableOpacity
              style={[styles.btnDanger, isLoading && styles.btnDisabled]}
              onPress={() => cancelOrder(order)}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={colors.danger} />
                : <Text style={styles.btnDangerText}>CANCEL ORDER</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Pagination ──

  const Pagination = () => (
    <View style={styles.pagination}>
      <TouchableOpacity
        style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
        onPress={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        disabled={currentPage === 1}
      >
        <Text style={styles.pageBtnText}>← PREV</Text>
      </TouchableOpacity>

      <View style={styles.pageNumbers}>
        {Array.from({ length: totalPages }, (_, i) => (
          <TouchableOpacity
            key={i + 1}
            style={[styles.pageNum, currentPage === i + 1 && styles.pageNumActive]}
            onPress={() => setCurrentPage(i + 1)}
          >
            <Text style={[styles.pageNumText, currentPage === i + 1 && styles.pageNumTextActive]}>
              {i + 1}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
        onPress={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        <Text style={styles.pageBtnText}>NEXT →</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main render ──

  return (
    <View style={styles.root}>

      {/* Toast stack */}
      <View style={styles.toastStack} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} styles={styles} />
        ))}
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>YOUR ORDERS</Text>
        {!loading && (
          <TouchableOpacity onPress={() => fetchOrders(currentPage, statusFilter)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.refreshBtn}>↻</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {["all", "pending", "confirmed", "shipping", "delivered", "cancelled"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, statusFilter === f && styles.filterBtnActive]}
            onPress={() => { setStatusFilter(f); setCurrentPage(1); setSelected(null); }}
          >
            <Text style={[styles.filterBtnText, statusFilter === f && styles.filterBtnTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentGold} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>NO ORDERS YET</Text>
          <Text style={styles.emptySubtitle}>Your order history will appear here.</Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.shopBtnText}>START SHOPPING →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={orders}
          keyExtractor={(o) => o._id || o.orderNumber}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
          }
          ListFooterComponent={totalPages > 1 ? <Pagination /> : null}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        />
      )}

      {/* Detail Modal */}
      <DetailModal
        order={selected}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onRefund={(order) => {
          setDetailVisible(false);
          setRefundOrder(order);
          setRefundVisible(true);
        }}
        onReviewItem={(item) => {
          setDetailVisible(false);
          openReviewModal(item);
        }}
        onConfirmReceived={confirmOrderReceived}
        confirmingReceived={confirmingReceived}
        nowTick={nowTick}
        onRetryPayment={retryPayment}
        retryingId={retryingId}
        onCancel={cancelOrder}
        cancelling={!!selected && loadingIds.includes(selected.orderNumber)}
        styles={styles}
        colors={colors}
      />

      {/* Refund Modal */}
      <RefundModal
        visible={refundVisible}
        order={refundOrder}
        onClose={() => { setRefundVisible(false); setRefundOrder(null); }}
        onSubmit={submitRefund}
        submitting={refundSubmitting}
        styles={styles}
        colors={colors}
      />

      {/* Review Modal */}
      <ReviewModal
        visible={reviewVisible}
        product={reviewProduct}
        onClose={() => { setReviewVisible(false); setReviewProduct(null); }}
        onSubmit={submitReviewForm}
        submitting={reviewSubmitting}
        styles={styles}
        colors={colors}
        isDark={isDark}
      />

      {/* Waiting on external browser payment */}
      <Modal visible={!!pendingOrderNumber && !verifying} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <ActivityIndicator size="large" color={colors.accentGold} />
          <Text style={styles.verifyText}>Complete your payment in the browser, then come back here.</Text>
        </View>
      </Modal>

      {/* Verifying payment overlay */}
      <Modal visible={verifying} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <ActivityIndicator size="large" color={colors.accentGold} />
          <Text style={styles.verifyText}>Confirming your payment…</Text>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors, isDark = false) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },

  // ── Toast ──
  toastStack: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    zIndex: 999,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderLeftWidth: 3,
  },
  toastSuccess: { backgroundColor: "#0d1f0d", borderLeftColor: colors.success },
  toastError:   { backgroundColor: "#1f0d0d", borderLeftColor: "#ef5350" },
  toastIcon:    { fontSize: 14, fontWeight: "900", color: colors.textPrimary },
  toastMsg:     { flex: 1, fontSize: 13, color: colors.textSecondary },
  toastClose:   { fontSize: 18, color: colors.textMuted, lineHeight: 20 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: isSmall ? 22 : 26,
    fontFamily: fonts.display,
    letterSpacing: 1.5,
  },
  refreshBtn: { color: colors.textMuted, fontSize: 22 },

  // ── Loading / Empty ──
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 13, letterSpacing: 1 },
  emptyIcon:    { fontSize: 52, marginBottom: 20 },
  emptyTitle:   { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.display, letterSpacing: 2, marginBottom: 8 },
  emptySubtitle:{ color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 32 },
  shopBtn: {
    borderWidth: 1, borderColor: colors.textPrimary,
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.sm,
  },
  shopBtnText: { ...typography.button, color: colors.textPrimary, fontSize: 13 },

  // ── List ──
  listContent: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE },

  // ── Card ──
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardOrderNum: { color: colors.textPrimary, fontWeight: "900", fontSize: isSmall ? 14 : 16, letterSpacing: 0.5 },
  cardDate:     { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, marginTop: 3 },

  // Status pill
  pill: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Items preview
  itemsPreview: { marginBottom: 12, gap: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.bgTertiary },
  itemName:  { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 2 },
  itemMeta:  { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5 },
  itemPrice: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bodyBold },
  moreItems: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginTop: 4 },

  // Total row
  cardTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 12,
    marginBottom: 12,
  },
  cardTotalLabel:  { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  cardTotalAmount: { color: colors.accentGold, fontSize: 16, fontWeight: "900" },

  // Timeline
  timelineScroll: { marginBottom: 12 },
  timeline: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 4 },
  timelineStep: { alignItems: "center", minWidth: 72, position: "relative" },
  timelineLine: {
    position: "absolute",
    top: 5,
    right: "50%",
    width: 72,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  timelineLineActive: { backgroundColor: colors.accentGold },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.bgPrimary,
    marginBottom: 6,
  },
  timelineDotActive:  { borderColor: colors.accentGold },
  timelineDotCurrent: { backgroundColor: colors.accentGold },
  timelineLabel: {
    color: colors.bgTertiary,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  timelineLabelActive: { color: colors.textSecondary },

  cancelledBanner: {
    backgroundColor: "#1a0000",
    borderWidth: 1,
    borderColor: "#ef5350",
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelledText: { color: "#ef5350", fontSize: 11, fontWeight: "900", letterSpacing: 2 },

  // Card actions
  cardActions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  btnWarning: {
    borderWidth: 1,
    borderColor: colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  btnWarningText: { color: colors.warning, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  btnDanger: {
    borderWidth: 1,
    borderColor: "#ef5350",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btnDangerText: { color: "#ef5350", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.5 },

  // ── Pagination ──
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
  },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnText: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  pageNumbers: { flexDirection: "row", gap: 6 },
  pageNum: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumActive: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  pageNumText:       { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  pageNumTextActive: { color: colors.textInverse },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  modalHandle: {
    width: 36,
    height: 3,
    backgroundColor: colors.borderLight,
    borderRadius: radius.sm,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: 2,
    marginBottom: 4,
  },
  modalSubtitle: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, marginBottom: 16 },

  // Detail modal items
  modalItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    alignItems: "flex-start",
  },
  modalItemImg:   { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bgTertiary },
  modalItemName:  { color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 4 },
  modalItemMeta:  { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  modalItemPrice: { color: colors.textSecondary, fontSize: 12 },
  modalItemTotal: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", alignSelf: "center" },
  modalTotalRow:  {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: colors.accentGold,
    marginTop: 8,
  },
  modalTotalLabel:  { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  modalTotalAmount: { color: colors.accentGold, fontSize: 18, fontWeight: "900" },
  modalClose: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.sm,
    marginTop: 16,
  },
  modalCloseText: { color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 2 },

  // Refund modal
  inputLabel: {
    color: isDark ? colors.textPrimary : colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
  },
  reasonList:   { maxHeight: 220, marginBottom: 16 },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  reasonOptionSelected: { borderBottomColor: colors.borderLight },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  radioCircleFilled: { borderColor: colors.accentGold, backgroundColor: colors.accentGold },
  reasonText:         { color: isDark ? colors.textPrimary : colors.textMuted, fontSize: 13 },
  reasonTextSelected: { color: colors.textPrimary, fontWeight: "700" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  modalBtnSecondaryText: { color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  modalBtnDanger: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ef5350",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  modalBtnDangerText: { color: "#ef5350", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  modalBtnPrimaryText: { color: colors.textInverse, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  modalBtnDisabled: { opacity: 0.35 },


  // ── Write review (order history) ──
writeReview: {
  backgroundColor: colors.bgCard,
  borderRadius: radius.sm,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  padding: 14,
  gap: 12,
  marginTop: 4,
},
writeTitle: {
  color: colors.textMuted,
  fontSize: 9,
  fontWeight: "700",
  letterSpacing: 2.5,
},
writeRatingRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
writeMuted: { color: isDark ? colors.textPrimary : colors.textMuted, fontSize: 12 },
reviewInput: {
  backgroundColor: colors.bgPrimary,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  borderRadius: radius.sm,
  padding: 10,
  minHeight: 72,
  color: colors.textPrimary,
  fontSize: 13,
  textAlignVertical: "top",
},
reviewInputError: {
  borderColor: colors.danger,
},
reviewErrorText: {
  color: colors.danger,
  fontSize: 11,
  marginTop: 6,
  marginBottom: 8,
  letterSpacing: 0.3,
},
submitBtn: {
  backgroundColor: colors.textPrimary,
  paddingVertical: 12,
  borderRadius: radius.sm,
  alignItems: "center",
},
submitText: {
  color: colors.textInverse,
  fontWeight: "800",
  fontSize: 11,
  letterSpacing: 2,
},
btnReview: {
  borderWidth: 1,
  borderColor: colors.success,
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: radius.sm,
  alignSelf: "flex-start",
},
btnReviewText: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },

  // ── Status filter ──
  // No border here anymore — the header right above already has a
  // bottom border, so this row was sandwiched between two divider lines
  // barely 18px apart, which read as a cramped clipped box rather than
  // a normal row with room to breathe.
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterBtnActive: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  filterBtnText: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  filterBtnTextActive: { color: colors.textInverse },

  // ── Payment pending ──
  paymentPill: {
    alignSelf: "flex-start",
    backgroundColor: "#2a1a00",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  paymentPillText: { color: colors.warning, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  paymentBanner: {
    backgroundColor: "#1a1200",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  paymentBannerText: { color: "#e8a852", fontSize: 12, lineHeight: 18 },
  paymentCountdown: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  paymentCountdownExpired: { color: "#ef5350" },
  paymentRetryBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  paymentRetryBtnText: { color: colors.textInverse, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },

  verifyOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    gap: 14,
    paddingHorizontal: 40,
  },
  verifyText: { color: colors.textSecondary, fontSize: 13, letterSpacing: 0.5, textAlign: "center" },

  // ── Refund photo evidence ──
  refundThumbWrap: { position: "relative", marginRight: 10 },
  refundThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.bgTertiary },
  refundThumbRemove: {
    position: "absolute", top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#ef5350", alignItems: "center", justifyContent: "center",
  },
  refundThumbRemoveText: { color: colors.textPrimary, fontSize: 10, fontWeight: "800" },
  refundAddPhoto: {
    width: 64, height: 64, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderLight, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  refundAddPhotoText: { color: colors.textMuted, fontSize: 24, fontWeight: "300" },
  refundMediaHint: { color: colors.textMuted, fontSize: 11, marginBottom: 10 },
  refundAlreadyText: { color: "#ce93d8", fontSize: 12, marginBottom: 10, textAlign: "center" },

  detailUtilRow: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 8 },
  detailUtilBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPrimary,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  detailUtilBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
  },

  // ── Review form (per-item) ──
  radioGroupRow: { gap: 8, marginBottom: 4 },
  radioPill: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm,
    padding: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 16, marginBottom: 8 },
  btnReviewSmall: {
    borderWidth: 1,
    borderColor: colors.success,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginTop: 6,
  },

  // ── Confirm received ──
  confirmReceivedBanner: {
    backgroundColor: "#0d1f0d",
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  confirmReceivedText: { color: "#8fd08f", fontSize: 12, lineHeight: 18 },
});