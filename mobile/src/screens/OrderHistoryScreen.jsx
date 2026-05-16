import React, { useEffect, useState, useRef, useCallback } from "react";
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
  Alert,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");
const isSmall = width < 380;

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://unlaboured-charise-unmachined.ngrok-free.dev";

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

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }) {
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

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);
  const colors = STATUS_COLORS[normalized] || STATUS_COLORS.pending;
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.pillText, { color: colors.text }]}>{prettyStatus(normalized)}</Text>
    </View>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ status }) {
  const normalized = normalizeStatus(status);
  if (normalized === "cancelled") {
    return (
      <View style={styles.cancelledBanner}>
        <Text style={styles.cancelledText}>ORDER CANCELLED</Text>
      </View>
    );
  }
  const activeIdx = STATUS_STEPS.indexOf(normalized);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
      <View style={styles.timeline}>
        {STATUS_STEPS.map((step, i) => {
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

const REFUND_REASONS = [
  "Item not as described",
  "Wrong item received",
  "Damaged / defective item",
  "Item not received",
  "Changed my mind",
  "Other",
];

function RefundModal({ visible, order, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) { setReason(""); setNotes(""); }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>REQUEST REFUND</Text>
          {order && (
            <Text style={styles.modalSubtitle}>Order #{order.orderNumber}</Text>
          )}

          <Text style={styles.inputLabel}>REASON</Text>
          <ScrollView style={styles.reasonList} nestedScrollEnabled>
            {REFUND_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonOption, reason === r && styles.reasonOptionSelected]}
                onPress={() => setReason(r)}
              >
                <View style={[styles.radioCircle, reason === r && styles.radioCircleFilled]} />
                <Text style={[styles.reasonText, reason === r && styles.reasonTextSelected]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose} disabled={submitting}>
              <Text style={styles.modalBtnSecondaryText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, (!reason || submitting) && styles.modalBtnDisabled]}
              onPress={() => reason && onSubmit(reason, notes)}
              disabled={!reason || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#0a0a0a" />
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

function DetailModal({ order, visible, onClose, onPrintReceipt, onRefund, refundSubmitting }) {
  if (!order) return null;
  const normalized = normalizeStatus(order.status);
  const canRefund = normalized === "completed";

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
              <StatusPill status={order.status} />
            </View>

            {order.items.map((item, i) => (
              <View key={i} style={styles.modalItem}>
                <Image source={{ uri: item.image }} style={styles.modalItemImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.modalItemMeta}>Size: {item.size}  ×{item.quantity}</Text>
                  <Text style={styles.modalItemPrice}>₱{Number(item.price).toLocaleString()}</Text>
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

            {canRefund && (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => onRefund(order)}>
                  <Text style={styles.modalBtnSecondaryText}>REQUEST REFUND</Text>
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

  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingIds, setLoadingIds]   = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  const [selected, setSelected]               = useState(null);
  const [detailVisible, setDetailVisible]     = useState(false);
  const [refundVisible, setRefundVisible]     = useState(false);
  const [refundOrder, setRefundOrder]         = useState(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);

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

  const fetchOrders = useCallback(async (page = 1) => {
    if (!userToken) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/orderhistory?page=${page}&limit=${ORDERS_PER_PAGE}`,
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
      setLoading(false);
    }
  }, [userToken, addToast]);

  useEffect(() => { fetchOrders(currentPage); }, [currentPage]);

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
                fetchOrders(currentPage);
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

  const submitRefund = async (reason, notes) => {
    if (!refundOrder) return;
    setRefundSubmitting(true);
    setLoadingIds((p) => [...p, refundOrder.orderNumber]);
    try {
      const res = await fetch(`${BASE_URL}/order/${refundOrder.orderNumber}/refund`, {
        method: "POST",
        headers: { "auth-token": userToken, "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "Refund request submitted.");
        setRefundVisible(false);
        setRefundOrder(null);
        fetchOrders(currentPage);
      } else {
        addToast("error", data.error || "Refund request failed.");
      }
    } catch {
      addToast("error", "Failed to submit refund request.");
    } finally {
      setRefundSubmitting(false);
      setLoadingIds((p) => p.filter((id) => id !== refundOrder?.orderNumber));
    }
  };

  // ── Render order card ──

  const renderOrder = ({ item: order }) => {
    const normalized   = normalizeStatus(order.status);
    const isCancellable = normalized === "pending";
    const isCompleted  = normalized === "completed";
    const isLoading    = loadingIds.includes(order.orderNumber);

    return (
      <TouchableOpacity
        style={styles.card}
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
          <StatusPill status={order.status} />
        </View>

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

        {/* Timeline */}
        <Timeline status={order.status} />

        {/* Actions */}
        <View style={styles.cardActions}>
          {isCompleted && (
            <TouchableOpacity
              style={styles.btnWarning}
              onPress={(e) => { setRefundOrder(order); setRefundVisible(true); }}
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
                ? <ActivityIndicator size="small" color="#ef5350" />
                : <Text style={styles.btnDangerText}>CANCEL ORDER</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
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
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>YOUR ORDERS</Text>
        {!loading && (
          <TouchableOpacity onPress={() => fetchOrders(currentPage)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.refreshBtn}>↻</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
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
          data={orders}
          keyExtractor={(o) => o._id || o.orderNumber}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={totalPages > 1 ? <Pagination /> : null}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#1a1a1a" }} />}
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
        refundSubmitting={refundSubmitting}
      />

      {/* Refund Modal */}
      <RefundModal
        visible={refundVisible}
        order={refundOrder}
        onClose={() => { setRefundVisible(false); setRefundOrder(null); }}
        onSubmit={submitRefund}
        submitting={refundSubmitting}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },

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
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderLeftWidth: 3,
  },
  toastSuccess: { backgroundColor: "#0d1f0d", borderLeftColor: "#4caf50" },
  toastError:   { backgroundColor: "#1f0d0d", borderLeftColor: "#ef5350" },
  toastIcon:    { fontSize: 14, fontWeight: "900", color: "#fff" },
  toastMsg:     { flex: 1, fontSize: 13, color: "#ddd" },
  toastClose:   { fontSize: 18, color: "#666", lineHeight: 20 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  headerTitle: {
    color: "#fff",
    fontSize: isSmall ? 20 : 24,
    fontWeight: "900",
    letterSpacing: 3,
  },
  refreshBtn: { color: "#555", fontSize: 22 },

  // ── Loading / Empty ──
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  loadingText: { color: "#555", marginTop: 12, fontSize: 13, letterSpacing: 1 },
  emptyIcon:    { fontSize: 52, marginBottom: 20 },
  emptyTitle:   { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 3, marginBottom: 8 },
  emptySubtitle:{ color: "#555", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 32 },
  shopBtn: {
    borderWidth: 1, borderColor: "#fff",
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 2,
  },
  shopBtnText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 2 },

  // ── List ──
  listContent: { padding: 16, paddingBottom: 40 },

  // ── Card ──
  card: {
    backgroundColor: "#111",
    borderRadius: 4,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardOrderNum: { color: "#fff", fontWeight: "900", fontSize: isSmall ? 14 : 16, letterSpacing: 0.5 },
  cardDate:     { color: "#555", fontSize: 11, letterSpacing: 0.5, marginTop: 3 },

  // Status pill
  pill: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Items preview
  itemsPreview: { marginBottom: 12, gap: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemThumb: { width: 48, height: 48, borderRadius: 3, backgroundColor: "#1a1a1a" },
  itemName:  { color: "#ddd", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  itemMeta:  { color: "#555", fontSize: 11, letterSpacing: 0.5 },
  itemPrice: { color: "#aaa", fontSize: 13, fontWeight: "700" },
  moreItems: { color: "#444", fontSize: 11, letterSpacing: 1, marginTop: 4 },

  // Total row
  cardTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
    paddingTop: 12,
    marginBottom: 12,
  },
  cardTotalLabel:  { color: "#444", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  cardTotalAmount: { color: "#fff", fontSize: 16, fontWeight: "900" },

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
    backgroundColor: "#2a2a2a",
  },
  timelineLineActive: { backgroundColor: "#fff" },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#333",
    backgroundColor: "#0a0a0a",
    marginBottom: 6,
  },
  timelineDotActive:  { borderColor: "#fff" },
  timelineDotCurrent: { backgroundColor: "#fff" },
  timelineLabel: {
    color: "#333",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  timelineLabelActive: { color: "#888" },

  cancelledBanner: {
    backgroundColor: "#1a0000",
    borderWidth: 1,
    borderColor: "#ef5350",
    borderRadius: 2,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelledText: { color: "#ef5350", fontSize: 11, fontWeight: "900", letterSpacing: 2 },

  // Card actions
  cardActions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  btnWarning: {
    borderWidth: 1,
    borderColor: "#ff9800",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 2,
  },
  btnWarningText: { color: "#ff9800", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  btnDanger: {
    borderWidth: 1,
    borderColor: "#ef5350",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 2,
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
    borderColor: "#2a2a2a",
    borderRadius: 2,
  },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  pageNumbers: { flexDirection: "row", gap: 6 },
  pageNum: {
    width: 32,
    height: 32,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumActive: { backgroundColor: "#fff", borderColor: "#fff" },
  pageNumText:       { color: "#555", fontSize: 12, fontWeight: "700" },
  pageNumTextActive: { color: "#0a0a0a" },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
  },
  modalHandle: {
    width: 36,
    height: 3,
    backgroundColor: "#333",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 4,
  },
  modalSubtitle: { color: "#555", fontSize: 12, letterSpacing: 1, marginBottom: 16 },

  // Detail modal items
  modalItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    alignItems: "flex-start",
  },
  modalItemImg:   { width: 60, height: 60, borderRadius: 3, backgroundColor: "#1a1a1a" },
  modalItemName:  { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  modalItemMeta:  { color: "#555", fontSize: 11, marginBottom: 2 },
  modalItemPrice: { color: "#888", fontSize: 12 },
  modalItemTotal: { color: "#fff", fontSize: 14, fontWeight: "900", alignSelf: "center" },
  modalTotalRow:  {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: "#fff",
    marginTop: 8,
  },
  modalTotalLabel:  { color: "#444", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  modalTotalAmount: { color: "#fff", fontSize: 18, fontWeight: "900" },
  modalClose: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
    marginTop: 16,
  },
  modalCloseText: { color: "#555", fontSize: 12, fontWeight: "800", letterSpacing: 2 },

  // Refund modal
  inputLabel: {
    color: "#555",
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
    borderBottomColor: "#1a1a1a",
    gap: 12,
  },
  reasonOptionSelected: { borderBottomColor: "#333" },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#333",
  },
  radioCircleFilled: { borderColor: "#fff", backgroundColor: "#fff" },
  reasonText:         { color: "#555", fontSize: 13 },
  reasonTextSelected: { color: "#fff", fontWeight: "700" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
  },
  modalBtnSecondaryText: { color: "#555", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
  },
  modalBtnPrimaryText: { color: "#0a0a0a", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  modalBtnDisabled: { opacity: 0.35 },
});