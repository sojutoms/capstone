import { useState, useCallback, useEffect } from "react";
import API_BASE_URL from "../../services/api";

// ─── All supported action keys (must match AuditLog model enum + ACTION_META) ─
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: "login",
  LOGOUT: "logout",

  // Products
  PRODUCT_ADD: "product_add",
  PRODUCT_EDIT: "product_edit",
  PRODUCT_DELETE: "product_delete",
  PRODUCT_RESTORE: "product_restore",

  // Colorways
  COLORWAY_ADD: "colorway_add",

  // Stock & pricing
  STOCK_ADD: "stock_add",
  PRICE_EDIT: "price_edit",

  // SKU / mark sold
  MARK_SOLD: "mark_sold",

  // Orders / transactions
  ORDER_STATUS: "order_status",

  // Refunds
  REFUND_APPROVE: "refund_approve",
  REFUND_REJECT: "refund_reject",
  REFUND_MARK_PAID: "refund_mark_paid",

  // Sales reporting
  SALES_EXPORT: "sales_export",
  SALES_PRINT: "sales_print",

  // Users
  USER_BLOCK: "user_block",
  USER_UNBLOCK: "user_unblock",

  // Vouchers
  VOUCHER_ISSUE: "voucher_issue",

  // Reviews
  REVIEW_DELETE: "review_delete",

  // Staff / roles
  STAFF_CREATE: "staff_create",
  ROLE_ASSIGN: "role_assign",
  ROLE_REMOVE: "role_remove",
  FORCE_LOGOUT: "force_logout",

  // Catalog management
  CATEGORY_ADD: "category_add",
  CATEGORY_DELETE: "category_delete",
  BRAND_ADD: "brand_add",
  BRAND_DELETE: "brand_delete",
  SIZE_ADD: "size_add",
  SIZE_DELETE: "size_delete",
  SUBCATEGORY_ADD: "subcategory_add",
  SUBCATEGORY_DELETE: "subcategory_delete",
};

// ─── Standalone writer — import and call anywhere ─────────────────────────────
// Usage: await logAction(AUDIT_ACTIONS.PRODUCT_ADD, { productName: "...", skuId: 1 })
export const logAction = async (action, details = {}) => {
  try {
    const token = sessionStorage.getItem("admin-token") || "";
    await fetch(`${API_BASE_URL}/admin/audit-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "auth-token": token } : {}),
      },
      body: JSON.stringify({
        action,
        details,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Never crash the UI on audit failures
    console.warn("[AuditLog] Failed to write:", err.message);
  }
};

// ─── Hook for reading/displaying audit logs (used by SecurityPanel) ───────────
export const useAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const fetchLogs = useCallback(async (p = 1, filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("admin-token") || "";
      const params = new URLSearchParams({ page: p, limit, ...filters });
      const res = await fetch(`${API_BASE_URL}/admin/audit-log?${params}`, {
        headers: token ? { "auth-token": token } : {},
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(p);
      } else {
        setError(data.error || "Failed to load audit logs");
      }
    } catch (e) {
      setError("Network error loading audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return { logs, loading, error, page, total, limit, fetchLogs, setPage };
};