/**
 * Skeletons.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated skeleton loaders for each major admin view.
 * Replace plain "Loading..." text with these components.
 *
 * Usage examples:
 *   // In Dashboard.jsx, replace loading div with:
 *   if (loading) return <DashboardSkeleton />;
 *
 *   // In productManagement.jsx:
 *   if (!allproducts.length && loading) return <ProductListSkeleton count={6} />;
 *
 *   // In SKUViewer.jsx:
 *   if (loading && !allSequences.length) return <SKUSkeleton count={8} />;
 *
 *   // In Transactions.jsx:
 *   {loading && <TransactionListSkeleton count={8} />}
 */

import React from "react";
import "./Skeletons.css";

// ─── Base shimmer block ───────────────────────────────────────────────────────
export const Shimmer = ({ w = "100%", h = 16, r = 6, style = {} }) => (
  <div
    className="sk-shimmer"
    style={{ width: w, height: h, borderRadius: r, ...style }}
  />
);

// ─── Dashboard skeleton ───────────────────────────────────────────────────────
export const DashboardSkeleton = () => (
  <div className="sk-dashboard">
    {/* Header */}
    <div className="sk-row" style={{ marginBottom: 28 }}>
      <Shimmer w={240} h={32} r={8} />
      <Shimmer w={160} h={18} r={6} style={{ marginTop: 8 }} />
    </div>

    {/* KPI cards */}
    <div className="sk-kpi-grid">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="sk-card">
          <Shimmer w={40} h={40} r={10} />
          <div style={{ flex: 1 }}>
            <Shimmer w="60%" h={14} r={4} />
            <Shimmer w="80%" h={28} r={6} style={{ marginTop: 8 }} />
            <Shimmer w="40%" h={12} r={4} style={{ marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>

    {/* Charts */}
    <div className="sk-charts">
      <div className="sk-chart-main">
        <Shimmer w={180} h={20} r={6} style={{ marginBottom: 20 }} />
        <Shimmer w="100%" h={220} r={10} />
      </div>
      <div className="sk-chart-side">
        <Shimmer w={140} h={20} r={6} style={{ marginBottom: 20 }} />
        <Shimmer w="100%" h={220} r={10} />
      </div>
    </div>

    {/* Insights */}
    <div style={{ marginTop: 28 }}>
      <Shimmer w={160} h={22} r={6} style={{ marginBottom: 16 }} />
      <div className="sk-insights">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="sk-card" style={{ flexDirection: "row", gap: 14 }}>
            <Shimmer w={40} h={40} r={10} />
            <div style={{ flex: 1 }}>
              <Shimmer w="70%" h={14} r={4} />
              <Shimmer w="90%" h={12} r={4} style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Product list skeleton ────────────────────────────────────────────────────
export const ProductListSkeleton = ({ count = 6 }) => (
  <div className="sk-product-grid">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="sk-product-card">
        <Shimmer w="100%" h={160} r={0} />
        <div style={{ padding: "14px 16px" }}>
          <Shimmer w="80%" h={16} r={5} />
          <div className="sk-chips">
            <Shimmer w={60} h={20} r={20} />
            <Shimmer w={70} h={20} r={20} />
          </div>
          <Shimmer w="60%" h={13} r={4} style={{ marginTop: 10 }} />
          <Shimmer w="100%" h={60} r={8} style={{ marginTop: 12 }} />
        </div>
      </div>
    ))}
  </div>
);

// ─── SKU viewer skeleton ──────────────────────────────────────────────────────
export const SKUSkeleton = ({ count = 8 }) => (
  <div className="sk-sku-grid">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="sk-sku-card">
        <div className="sk-sku-header">
          <Shimmer w={80} h={16} r={4} />
          <Shimmer w={60} h={20} r={20} />
        </div>
        <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
          <Shimmer w={72} h={72} r={8} />
          <div style={{ flex: 1 }}>
            <Shimmer w="75%" h={15} r={4} />
            <div className="sk-chips" style={{ marginTop: 8 }}>
              <Shimmer w={55} h={18} r={20} />
              <Shimmer w={65} h={18} r={20} />
            </div>
            <Shimmer w="50%" h={12} r={4} style={{ marginTop: 8 }} />
          </div>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <Shimmer w="40%" h={14} r={4} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Transaction list skeleton ────────────────────────────────────────────────
export const TransactionListSkeleton = ({ count = 8 }) => (
  <div className="sk-txn-list">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="sk-txn-row">
        <div style={{ flex: 1 }}>
          <Shimmer w={120} h={14} r={4} />
          <Shimmer w={180} h={12} r={4} style={{ marginTop: 6 }} />
        </div>
        <div style={{ textAlign: "right" }}>
          <Shimmer w={80} h={14} r={4} />
          <Shimmer w={60} h={20} r={20} style={{ marginTop: 6 }} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Sales table skeleton ─────────────────────────────────────────────────────
export const SalesTableSkeleton = ({ rows = 10, cols = 8 }) => (
  <div className="sk-table">
    {/* Header */}
    <div className="sk-table-head">
      {[...Array(cols)].map((_, i) => (
        <Shimmer key={i} w={`${60 + i * 10}px`} h={14} r={4} />
      ))}
    </div>
    {/* Rows */}
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="sk-table-row">
        {[...Array(cols)].map((_, j) => (
          <Shimmer key={j} w={`${50 + Math.random() * 80}px`} h={13} r={3} />
        ))}
      </div>
    ))}
  </div>
);

// ─── Generic card skeleton ────────────────────────────────────────────────────
export const CardSkeleton = ({ lines = 3 }) => (
  <div className="sk-card">
    <Shimmer w={48} h={48} r={12} />
    <div style={{ flex: 1 }}>
      {[...Array(lines)].map((_, i) => (
        <Shimmer
          key={i}
          w={`${90 - i * 20}%`}
          h={i === 0 ? 16 : 13}
          r={4}
          style={{ marginTop: i === 0 ? 0 : 6 }}
        />
      ))}
    </div>
  </div>
);

export default {
  DashboardSkeleton,
  ProductListSkeleton,
  SKUSkeleton,
  TransactionListSkeleton,
  SalesTableSkeleton,
  CardSkeleton,
  Shimmer,
};
