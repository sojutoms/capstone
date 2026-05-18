import React, { useEffect, useState, useCallback } from "react";
import MonthlySales from "../MonthlySales/MonthlySales";
import OverviewCard from "../OverviewCard/OverviewCard";
import SalesChart from "../SalesChart/SalesChart";
import InsightModal from "../InsightModal/InsightModal";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns { percent, direction, currentMonth, previousMonth, currentSales, previousSales } */
const computeSalesTrend = (monthlySales) => {
  const arr = Array.isArray(monthlySales)
    ? monthlySales
    : Array.isArray(monthlySales?.data)
      ? monthlySales.data
      : null;

  if (!arr || arr.length === 0) return null;

  // Only consider months that have sales > 0
  const sorted = [...arr]
    .filter((m) => Number(m.sales ?? m.revenue ?? 0) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  if (sorted.length === 0) return null;

  // Only one month with sales — compare against 0
  if (sorted.length === 1) {
    const only = sorted[0];
    const currVal = Number(only.sales ?? only.revenue ?? 0);
    return {
      percent: 100,
      direction: "up",
      currentMonth: only.month,
      previousMonth: "Previous",
      currentSales: currVal,
      previousSales: 0,
    };
  }

  // Two or more months — compare last two
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];
  const prevVal = Number(prev.sales ?? prev.revenue ?? 0);
  const currVal = Number(curr.sales ?? curr.revenue ?? 0);

  const percent = (((currVal - prevVal) / prevVal) * 100).toFixed(1);
  return {
    percent: Math.abs(percent),
    direction: currVal >= prevVal ? "up" : "down",
    currentMonth: curr.month,
    previousMonth: prev.month,
    currentSales: currVal,
    previousSales: prevVal,
  };
};

/** Ask Claude why sales went up (or down) and get a short plain-text reason */
const fetchAISalesReason = async (trend, categorySales) => {
  const response = await authorizedFetch("/admin/ai/sales-analysis", {
    method: "POST",
    body: JSON.stringify({ trend, categorySales }),
  });
  const data = await response.json();
  return data.analysis || "No analysis available.";
};

// ─── Modal Content Renderers ─────────────────────────────────────────────────

const SalesInsightContent = ({ trend, aiReason, aiLoading }) => {
  if (!trend) return <p style={{ color: "rgba(255,255,255,0.5)" }}>Not enough monthly data to compute trend.</p>;

  return (
    <>
      <div className="sales-trend-hero">
        <span className={`sales-trend-percent ${trend.direction}`}>
          {trend.direction === "up" ? "▲" : "▼"} {trend.percent}%
        </span>
        <span className="sales-trend-label">vs last month</span>
      </div>

      <div className="sales-month-comparison">
        <div className="sales-month-card">
          <div className="month-label">{trend.previousMonth}</div>
          <div className="month-value">₱{Number(trend.previousSales).toLocaleString()}</div>
        </div>
        <div className="sales-month-card current">
          <div className="month-label">{trend.currentMonth} (current)</div>
          <div className="month-value">₱{Number(trend.currentSales).toLocaleString()}</div>
        </div>
      </div>

      <div className="ai-analysis-box">
        <div className="ai-analysis-label">✦ AI Analysis</div>
        {aiLoading ? (
          <p className="ai-analysis-text" style={{ color: "rgba(255,255,255,0.8)", fontStyle: "italic" }}>
            Generating analysis…
          </p>
        ) : (
          <p className="ai-analysis-text">{aiReason}</p>
        )}
      </div>
    </>
  );
};

const CategoryInsightContent = ({ categorySales }) => {
  if (!categorySales || categorySales.length === 0)
    return <p style={{ color: "rgba(255, 255, 255, 1)" }}>No category data available.</p>;

  const sorted = [...categorySales].sort((a, b) => b.sales - a.sales);
  const max = sorted[0].sales;
  const rankClass = ["gold", "silver", "bronze"];

  return (
    <div className="category-list">
      {sorted.map((cat, i) => (
        <div className="category-row" key={cat.category}>
          <div className={`category-rank ${rankClass[i] || ""}`}>
            <span className="rank-text" style={{ fontSize: "14px" }}>{i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `#${i + 1}`}</span>
          </div>
          <div className="category-bar-wrap">
            <div className="category-name-row">
              <span className="category-name">{cat.category}</span>
              <span className="category-sales-val">₱{Number(cat.sales).toLocaleString()}</span>
            </div>
            <div className="category-bar-bg">
              <div
                className={`category-bar-fill ${i === 0 ? "top" : ""}`}
                style={{ width: `${Math.round((cat.sales / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const LowStockInsightContent = ({ lowStockItems }) => {
  const items = lowStockItems || [];
  return (
    <>
      <div className="stock-summary">
        <span className="stock-summary-icon">📦</span>
        <div className="stock-summary-text">
          <h4>{items.length > 0 ? `${items.length} product${items.length !== 1 ? "s" : ""} with low stock` : "All products stocked"}</h4>
          <p>{items.length > 0 ? "Review and reorder soon to avoid stockouts." : "No immediate restocking needed."}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="stock-list">
          {items.map((item) => (
            <div className="stock-item" key={item.id ?? item.name} style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span className="stock-item-name">{item.name}</span>
                <span className="stock-item-qty">
                  {item.sizes ? `${item.quantity} size${item.quantity !== 1 ? "s" : ""} low` : `${item.quantity} left`}
                </span>
              </div>
              {item.sizes && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-primary)", opacity: 0.8, background: "rgba(255,255,255,0.05)", borderRadius: "6px", padding: "2px 8px", fontWeight: 600 }}>
                  Sizes: {item.sizes}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="stock-no-data">✅ Everything looks good!</p>
      )}
    </>
  );
};

// ─── Derive monthly sales chart data from raw saleslog rows ─────────────────
// Groups by "YYYY-MM" and sums totals → [{ month: "Jan 2025", sales: 12000 }, ...]
// Always returns all 12 months of the current year so the chart has a full shape.
const deriveMonthlyFromLogs = (logs) => {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();

  // Seed all 12 months with 0 so the line always spans the full year
  const buckets = {};
  MONTHS.forEach((m, i) => {
    const key = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
    buckets[key] = { key, month: `${m} ${currentYear}`, sales: 0 };
  });

  if (Array.isArray(logs)) {
    logs.forEach((r) => {
      if (!r.soldAt) return;
      const d = new Date(r.soldAt);
      if (isNaN(d)) return;
      // Only include sales from the current year
      if (d.getFullYear() !== currentYear) return;
      const key = `${currentYear}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (buckets[key]) buckets[key].sales += Number(r.total ?? r.unitPrice ?? 0);
    });
  }

  return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
};

// ─── Derive category sales from raw saleslog rows ────────────────────────────
// Groups by category and sums totals → [{ category: "Sneakers", sales: 8000 }, ...]
const deriveCategoryFromLogs = (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  const buckets = {};
  logs.forEach((r) => {
    const cat = r.category || "Uncategorized";
    if (!buckets[cat]) buckets[cat] = { category: cat, sales: 0 };
    buckets[cat].sales += Number(r.total ?? r.unitPrice ?? 0);
  });
  return Object.values(buckets).sort((a, b) => b.sales - a.sales);
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [monthlySales, setMonthlySales] = useState([]);
  const [categorySales, setCategorySales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [totalNetRevenue, setTotalNetRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  // AI state
  const [salesTrend, setSalesTrend] = useState(null);
  const [aiReason, setAiReason] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Modal state
  const [activeInsight, setActiveInsight] = useState(null);

  const navigate = useNavigate();

  // ── Fetch dashboard data ──
  // Uses the SAME /saleslog endpoint as AdminSales so both pages always show
  // identical numbers. Monthly and category data are derived from those logs.
  useEffect(() => {
    setLoading(true);

    const toArray = (v) =>
      Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

    const currentYear = new Date().getFullYear();

    Promise.all([
      // Overview stats (totals, top spender, etc.)
      authorizedFetch("/admin/stats/overview")
        .then((r) => r.json())
        .catch(() => null),

      // Same saleslog AdminSales uses — year view for full 12-month picture
      authorizedFetch(`/saleslog?period=year&year=${currentYear}`)
        .then((r) => r.json())
        .then((d) => {
          // Handle { success, logs: [...] } OR { data: [...] } OR plain array
          if (d && d.success && Array.isArray(d.logs)) return d.logs;
          return toArray(d.data ?? d);
        })
        .catch(() => []),

      // Products + sequences — same source as ProductManagement for accurate low-stock
      authorizedFetch("/allproducts?showDeleted=false")
        .then((r) => r.json())
        .then((d) => toArray(d))
        .catch(() => []),
      authorizedFetch("/allsequences")
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : []))
        .catch(() => []),
    ])
      .then(([statsData, logs, products, sequences]) => {
        setStats(statsData);
        setMonthlySales(deriveMonthlyFromLogs(logs));
        setCategorySales(deriveCategoryFromLogs(logs));
        setTotalNetRevenue(logs.reduce((s, r) => s + (Number(r.total) || 0), 0));

        // ── Derive low stock from the same data ProductManagement uses ──
        const SIMPLE = ["bags", "collectibles"];
        const seqByProduct = {};
        sequences.forEach((s) => {
          const pid = String(s.productId);
          if (!seqByProduct[pid]) seqByProduct[pid] = [];
          seqByProduct[pid].push(s);
        });

        const lowStock = [];
        products.forEach((p) => {
          if (p.isDeleted) return;
          const isSimpleCat = SIMPLE.includes((p.category || "").toLowerCase());
          const seqs = seqByProduct[String(p.id)] || [];

          if (isSimpleCat) {
            const availQty = seqs.filter((s) => s.status === "available").length || Number(p.stock || 0);
            if (availQty > 0 && availQty <= 3) {
              lowStock.push({ name: p.name, quantity: availQty, id: p.id });
            }
          } else {
            // Group by size
            const sizeQty = {};
            seqs.forEach((s) => {
              if (s.status !== "available") return;
              const sz = String(s.size || "—");
              sizeQty[sz] = (sizeQty[sz] || 0) + 1;
            });
            const lowSizes = Object.entries(sizeQty)
              .filter(([, q]) => q > 0 && q <= 3)
              .map(([sz, q]) => `${sz}(${q})`);
            if (lowSizes.length > 0) {
              lowStock.push({
                name: p.name,
                quantity: lowSizes.length,
                id: p.id,
                sizes: lowSizes.join(", "),
              });
            }
          }
        });
        setLowStockItems(lowStock);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
      });
  }, []);

  // ── Compute trend once monthly data arrives ──
  useEffect(() => {
    if (monthlySales) {
      const trend = computeSalesTrend(monthlySales);
      setSalesTrend(trend);
    }
  }, [monthlySales]);

  // ── Fetch AI reason once trend + categories are ready ──
  useEffect(() => {
    if (!salesTrend || !categorySales) return;
    setAiLoading(true);
    fetchAISalesReason(salesTrend, categorySales)
      .then((reason) => setAiReason(reason))
      .catch(() => setAiReason("Unable to generate analysis at this time."))
      .finally(() => setAiLoading(false));
  }, [salesTrend, categorySales]);

  // ── Build insight configs ──
  const bestCategory =
    categorySales && categorySales.length > 0
      ? categorySales.reduce((max, c) => (c.sales > max.sales ? c : max)).category
      : "N/A";

  const trendLabel = salesTrend
    ? `${salesTrend.direction === "up" ? "+" : "-"}${salesTrend.percent}% vs last month`
    : "Not enough data";

  const insights = [
    {
      id: "sales",
      type: "success",
      icon: "📈",
      title: "Sales Trending " + (salesTrend?.direction === "down" ? "Down" : "Up"),
      summary: trendLabel,
      content: (
        <SalesInsightContent trend={salesTrend} aiReason={aiReason} aiLoading={aiLoading} />
      ),
    },
    {
      id: "category",
      type: "info",
      icon: "📊",
      title: "Best Performing Category",
      summary: `Top category: ${bestCategory}`,
      content: <CategoryInsightContent categorySales={categorySales} />,
    },
    {
      id: "stock",
      type: "warning",
      icon: "⚠️",
      title: "Low Stock Alert",
      summary:
        lowStockItems.length > 0
          ? `${lowStockItems.length} products need restocking`
          : "All products are stocked",
      content: <LowStockInsightContent lowStockItems={lowStockItems} />,
    },
  ];

  const openInsight = useCallback((insight) => setActiveInsight(insight), []);
  const closeInsight = useCallback(() => setActiveInsight(null), []);

  // ── Render ──
  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header stagger-in">
        <h1 className="chrome-text">Dashboard</h1>
        <p className="dashboard-subtitle">Welcome back! Here's what's happening with your store.</p>
      </div>

      {stats && (
        <div className="overview-grid">
          <OverviewCard
            icon="💰"
            title="Total Sales"
            value={`₱${totalNetRevenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`}
            trend={salesTrend ? `${salesTrend.direction === "up" ? "+" : "-"}${salesTrend.percent}% vs last month` : null}
            trendUp={salesTrend ? salesTrend.direction === "up" : true}
            sparkData={monthlySales.map(m => m.sales)}
          />
          <OverviewCard
            icon="👥"
            title="Total Users"
            value={`${stats.totalUsers || 0}`}
            subtitle="registered accounts"
            trend="+8 this month"
            trendUp={true}
            sparkData={[2, 5, 4, 8, 12, 10, 15, 18, 20]} // Dummy trend for users
          />
          <OverviewCard
            icon="📦"
            title="Products on Sale"
            value={`${stats.totalProducts || 0}`}
            subtitle="active products"
            sparkData={[45, 48, 50, 52, 55, 60, 58, 62]} // Dummy trend for inventory
          />
          <OverviewCard
            icon="🏆"
            title="Top Spender"
            value={stats.topSpender ? stats.topSpender.name : "—"}
            subtitle={stats.topSpender ? `₱${Number(stats.topSpender.totalSpent).toLocaleString()}` : "No data"}
          />
        </div>
      )}

      <div className="charts-container stagger-in">
        <div className="chart-section main-chart">
          <h3>Monthly Performance <span style={{ fontSize: "10px", opacity: 0.5, fontWeight: 500 }}>YEAR VIEW</span></h3>
          {monthlySales && <MonthlySales data={monthlySales} />}
        </div>
        <div className="chart-section side-chart">
          <h3>Category Share</h3>
          {categorySales && <SalesChart data={categorySales} />}
        </div>
      </div>

      <div className="insights-section stagger-in">
        <h3>Quick Insights <span style={{ fontSize: "10px", opacity: 0.5, fontWeight: 500, marginLeft: 8 }}>AI ASSISTED</span></h3>
        <div className="insights-grid">
          {insights.map((insight) => (
            <button
              key={insight.id}
              className="insight-card insight-card--clickable"
              onClick={() => openInsight(insight)}
              aria-label={`View details for ${insight.title}`}
            >
              <div className={`insight-icon ${insight.type}`}>{insight.icon}</div>
              <div className="insight-content">
                <h4>{insight.title}</h4>
                <p>{insight.summary}</p>
              </div>
              <span className="insight-chevron">›</span>
            </button>
          ))}
        </div>
      </div>

      {activeInsight && (
        <InsightModal insight={activeInsight} onClose={closeInsight} />
      )}
    </div>
  );
};

export default Dashboard;
