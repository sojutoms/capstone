import React, { useEffect, useState, useCallback } from "react";
import "./AdminSales.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtFull = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toISOWeek = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

// ─── Channel helpers ───────────────────────────────────────────────────────────
const getChannel = (r) => {
  if (r.channel) return r.channel;
  if (r.soldBy && !r.buyer) return "store";
  if (r.buyer && !r.soldBy) return "online";
  if ((r.orderId || "").startsWith("STORE-")) return "store";
  return "online";
};

const getWhoValue = (r, channelTab) => {
  const ch = getChannel(r);
  if (channelTab === "store" || ch === "store") return r.soldBy || "—";
  if (channelTab === "online" || ch === "online") return r.buyer || "—";
  if (r.soldBy) return { label: r.soldBy, tag: "Staff" };
  if (r.buyer) return { label: r.buyer, tag: "Customer" };
  return { label: "—", tag: null };
};

const getWhoHeader = (channelTab) => {
  if (channelTab === "store") return "Sold By";
  if (channelTab === "online") return "Buyer";
  return "Buyer / Sold By";
};

const AdminSales = () => {
  const now = new Date();

  const [period, setPeriod] = useState("year");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(toISOWeek(now));
  const [selectedDay, setSelectedDay] = useState(todayStr());

  const [channelTab, setChannelTab] = useState("all");

  const [periodSummary, setPeriodSummary] = useState([]);
  const [brandPerformance, setBrandPerformance] = useState([]);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterVoucher, setFilterVoucher] = useState("all");
  const [sortKey, setSortKey] = useState("soldAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const logsPerPage = 15;

  const periodLabel = {
    year: `Year ${selectedYear}`,
    month: selectedMonth
      ? `${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(selectedMonth)]} ${selectedYear}`
      : `Year ${selectedYear}`,
    week: `Week ${selectedWeek}`,
    day: `Day ${selectedDay}`,
  }[period] || "";

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const params = new URLSearchParams({ period, year: selectedYear, t: Date.now() });
      if (period === "month" && selectedMonth) params.set("month", selectedMonth);
      if (period === "week") params.set("week", selectedWeek);
      if (period === "day") params.set("day", selectedDay);

      const data = await authorizedFetch(`/saleslog?${params}`).then((r) => r.json());
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        setLogsError("Could not load sales log data.");
      }
    } catch (err) {
      console.error("Fetch sales log error:", err);
      setLogsError("Network error while fetching sales log.");
    } finally {
      setLogsLoading(false);
    }
  }, [period, selectedYear, selectedMonth, selectedWeek, selectedDay]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period, year: selectedYear, t: Date.now() });
      if (period === "month" && selectedMonth) params.set("month", selectedMonth);
      if (period === "week") params.set("week", selectedWeek);
      if (period === "day") params.set("day", selectedDay);
      const data = await authorizedFetch(`/salesdata?${params}`).then((r) => r.json());
      if (data.success) {
        setPeriodSummary(data.periodSummary || data.monthlySummary || []);
        setBrandPerformance(data.brandPerformance || []);
      }
    } catch (err) {
      console.error("Fetch summary error:", err);
    }
  }, [period, selectedYear, selectedMonth, selectedWeek, selectedDay]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [fetchLogs, fetchSummary]);

  const handleSort = (key) => {
    setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
    setSortKey(key);
    setPage(1);
  };
  const sortInd = (key) => sortKey !== key ? "⇅" : sortDir === "asc" ? "↑" : "↓";

  const filtered = logs
    .filter((r) => {
      if (channelTab !== "all" && getChannel(r) !== channelTab) return false;
      if (search && ![r.product, r.buyer, r.soldBy, r.orderId, r.brand, r.category]
        .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterVoucher === "with" && !(r.voucherCode || r.voucher)) return false;
      if (filterVoucher === "without" && (r.voucherCode || r.voucher)) return false;
      return true;
    })
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "soldAt") { av = new Date(av); bv = new Date(bv); }
      else if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / logsPerPage));
  const paginated = filtered.slice((page - 1) * logsPerPage, page * logsPerPage);

  const grossRevenue = filtered.reduce((s, r) => s + (Number(r.unitPrice) * Number(r.qty) || 0), 0);
  const totalDiscount = filtered.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const netRevenue = filtered.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const totalUnits = filtered.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const allChannelCounts = logs.reduce((acc, r) => {
    const ch = getChannel(r);
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});

  const topBrand = brandPerformance[0] || null;

  const exportCSV = () => {
    const whoHeader = getWhoHeader(channelTab);
    const rows = [["Transaction ID", "Order ID", "Date & Time", "Channel", "Product", "Category", "Brand", "Size", "Unit Price", "Qty", "Discount", "Total", "Status", "Voucher", whoHeader, "Payment Method"]];
    filtered.forEach((r) => {
      const who = getWhoValue(r, channelTab);
      const whoLabel = typeof who === "object" ? who.label : who;
      rows.push([
        r.id, r.orderId, formatDateTime(r.soldAt), getChannel(r).toUpperCase(),
        r.product, r.category, r.brand,
        r.size, Number(r.unitPrice).toFixed(2), r.qty,
        Number(r.discount).toFixed(2), Number(r.total).toFixed(2),
        r.status, r.voucherCode || r.voucher || "—", whoLabel, r.payment,
      ]);
    });
    const csv = rows.map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `sales-log-${channelTab}-${periodLabel.replace(/\s+/g, "-")}.csv`,
    });
    a.click();
  };

  return (
    <div className="admin-sales">
      <div className="panel-header" style={{ marginBottom: 32 }}>
        <h1 className="chrome-text">Sales Analytics</h1>
      </div>

      {/* ── KPI Cards ── */}
      <div className="stats-grid stagger-in">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Gross Revenue</div>
            <div className="stat-value">{fmtFull(grossRevenue)}</div>
            <div className="stat-subtext">Cumulative across filters</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ borderColor: "rgba(248, 113, 113, 0.3)" }}>🏷️</div>
          <div className="stat-content">
            <div className="stat-label">Discounts</div>
            <div className="stat-value" style={{ color: "#f87171" }}>−{fmtFull(totalDiscount)}</div>
            <div className="stat-subtext">Total savings applied</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ borderColor: "rgba(74, 222, 128, 0.3)" }}>✅</div>
          <div className="stat-content">
            <div className="stat-label">Net Revenue</div>
            <div className="stat-value" style={{ color: "#4ade80" }}>{fmtFull(netRevenue)}</div>
            <div className="stat-subtext">Actual funds received</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">Units Sold</div>
            <div className="stat-value">{totalUnits.toLocaleString()}</div>
            <div className="stat-subtext">Quantity of items</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-label">Top Brand</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {topBrand ? (topBrand.brand || "—").toUpperCase() : "N/A"}
            </div>
            <div className="stat-subtext">
              {topBrand ? `${fmt(topBrand.salesTotal)} Revenue` : "No data"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Control Bar ── */}
      <div className="sales-control-bar animate-in">
        <div className="filter-group">
          <label>View Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>

        {(period === "year" || period === "month") && (
          <div className="filter-group">
            <label>Select Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {period === "month" && (
          <div className="filter-group">
            <label>Select Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">Full Year</option>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {period === "week" && (
          <div className="filter-group">
            <label>Select Week</label>
            <input type="week" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} />
          </div>
        )}

        {period === "day" && (
          <div className="filter-group">
            <label>Select Date</label>
            <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
          </div>
        )}

        <button className="refresh-btn" onClick={() => { fetchLogs(); fetchSummary(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 8 }}><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Sync Data
        </button>
      </div>

      <div className="sales-grid-layout" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 32, alignItems: "start", width: "100%" }}>
        
        <div className="sales-left-col">
          {/* ── Transaction Log ── */}
          <div className="sales-section animate-in">
            <div className="section-header">
              <div>
                <h2>Transaction Log</h2>
                <p className="section-hint">{filtered.length} matching entries for {periodLabel}</p>
              </div>
              <div className="log-controls">
                <div className="sl-search-wrapper">
                  <svg className="sl-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input
                    type="text"
                    placeholder="Search orders, customers, products..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <button className="action-btn-luxe" onClick={exportCSV}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Export
                </button>
              </div>
            </div>

            <div className="channel-tabs">
              {["all", "online", "store"].map((tab) => (
                <button 
                  key={tab} 
                  className={`channel-tab ${channelTab === tab ? `active ${tab}` : ""}`} 
                  onClick={() => { setChannelTab(tab); setPage(1); }}
                >
                  {tab === "all" ? `All Sales (${logs.length})` : tab === "online" ? `🌐 Online` : `🏪 Store`}
                </button>
              ))}
            </div>

            <div className="sl-summary-strip">
              <div className="sl-summary-item">
                <span className="sl-summary-label">Filtered Volume</span>
                <span className="sl-summary-value">{filtered.length} TXN</span>
              </div>
              <div className="sl-summary-item">
                <span className="sl-summary-label">Filtered Revenue</span>
                <span className="sl-summary-value" style={{ color: "#4ade80" }}>{fmt(netRevenue)}</span>
              </div>
              <div className="sl-summary-item">
                <span className="sl-summary-label">Average Ticket</span>
                <span className="sl-summary-value">{fmt(filtered.length > 0 ? netRevenue / filtered.length : 0)}</span>
              </div>
            </div>

            <div className="table-wrapper">
              {logsLoading ? (
                <div style={{ padding: 100, textAlign: "center", opacity: 0.5 }}>Syncing logs...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 100, textAlign: "center", opacity: 0.5 }}>No transactions found for this selection.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "130px" }} onClick={() => handleSort("orderId")}>Order {sortInd("orderId")}</th>
                      <th style={{ width: "160px" }} onClick={() => handleSort("soldAt")}>Timestamp {sortInd("soldAt")}</th>
                      <th style={{ minWidth: "200px" }}>Product Details</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Total</th>
                      <th style={{ width: "150px" }}>{getWhoHeader(channelTab)}</th>
                      <th style={{ width: "90px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row) => {
                      const ch = getChannel(row);
                      const who = getWhoValue(row, channelTab);
                      return (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "12px" }}>{row.orderId}</td>
                          <td style={{ fontSize: "11px", opacity: 0.7 }}>{formatDateTime(row.soldAt)}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "300px" }} title={row.product}>{row.product}</div>
                            <div style={{ fontSize: "10px", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {row.brand} · {row.size}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: "#4ade80", fontFamily: "var(--font-mono)" }}>
                            {fmtFull(row.total)}
                          </td>
                          <td style={{ fontSize: "12px" }}>
                            {typeof who === "object" ? (
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                                <span style={{ fontWeight: 500 }}>{who.label}</span>
                                {who.tag && <span className="badge badge-staff" style={{ fontSize: "8px", padding: "2px 6px" }}>{who.tag}</span>}
                              </div>
                            ) : <span style={{ fontWeight: 500 }}>{who}</span>}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge badge-${ch}`}>
                              {ch}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!logsLoading && filtered.length > 0 && (
              <div className="pagination">
                <button className="page-btn" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>PREV</button>
                <span className="page-info">{page} / {totalPages}</span>
                <button className="page-btn" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}>NEXT</button>
              </div>
            )}
          </div>
        </div>

        <div className="sales-right-col">
          {/* ── Performance Section ── */}
          <div className="sales-section animate-in" style={{ animationDelay: "0.2s" }}>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <h2>Performance</h2>
            </div>
            <div className="table-wrapper">
              <table style={{ background: "rgba(0,0,0,0.1)", borderRadius: 12 }}>
                <thead>
                  <tr>
                    <th>{period === "day" ? "Hour" : period === "week" ? "Day" : "Period"}</th>
                    <th style={{ textAlign: "right" }}>Rev</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {periodSummary.length === 0
                    ? <tr><td colSpan="3" style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>No data</td></tr>
                    : periodSummary.slice(0, 12).map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{m.label || m.month || "—"}</td>
                        <td style={{ textAlign: "right", color: "#4ade80", fontWeight: 700 }}>{fmt(m.amount)}</td>
                        <td style={{ textAlign: "right", opacity: 0.7 }}>{m.units}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="section-hint" style={{ textAlign: "center", marginTop: 12 }}>Detailed {period} breakdown</p>
          </div>

          {/* ── Brand Leaderboard ── */}
          <div className="sales-section animate-in" style={{ animationDelay: "0.3s" }}>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <h2>Brand Share</h2>
            </div>
            <div className="brand-performance-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {brandPerformance.slice(0, 5).map((b, idx) => (
                <div key={idx} className="brand-share-item" style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{b.brand}</span>
                    <span style={{ fontWeight: 800, color: "#4ade80" }}>{fmt(b.salesTotal)}</span>
                  </div>
                  <div className="progress-bg" style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                    <div className="progress-fill" style={{ height: "100%", background: "var(--text-primary)", width: `${Math.min(100, (b.salesTotal / (netRevenue || 1)) * 100)}%`, borderRadius: 2 }}></div>
                  </div>
                </div>
              ))}
              {brandPerformance.length === 0 && <p style={{ opacity: 0.5, textAlign: "center" }}>No brand data</p>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminSales;
