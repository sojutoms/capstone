import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart, ArcElement, Tooltip, Legend } from "chart.js";

Chart.register(ArcElement, Tooltip, Legend);

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#84cc16"];

const SalesChart = React.memo(({ data }) => {
  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      labels: data.map(d => d.category ?? d.label ?? "Unknown"),
      datasets: [{
        data: data.map(d => Number(d.total ?? d.sales ?? d.revenue ?? 0)),
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 15,
        borderRadius: 4,
        spacing: 2,
      }]
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 8, usePointStyle: true, padding: 20, color: "rgba(255,255,255,0.5)", font: { size: 11, weight: "600" } }
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
            return ` ₱${Number(ctx.parsed).toLocaleString()} (${pct}%)`;
          }
        }
      }
    }
  }), []);

  if (!chartData) return null;

  return (
    <div className="chart-card" style={{ height: "100%", width: "100%" }}>
      <div className="pie-wrapper" style={{ position: "relative", height: "100%" }}>
        <Doughnut data={chartData} options={options} redraw={false} />
        <div className="doughnut-center" style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>Categories</span>
        </div>
      </div>
    </div>
  );
});

export default SalesChart;
