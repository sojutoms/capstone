import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from "chart.js";

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

const MonthlySales = React.memo(({ data }) => {
  const { labels, totals } = useMemo(() => {
    let l = [], t = [];
    if (Array.isArray(data)) {
      l = data.map(d => d.month ?? d.label ?? "");
      t = data.map(d => Number(d.sales ?? d.revenue ?? d.total ?? 0));
    }
    return { labels: l, totals: t };
  }, [data]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      data: totals,
      fill: true,
      borderColor: "#10b981",
      backgroundColor: "rgba(16, 185, 129, 0.05)",
      tension: 0.4,
      pointRadius: ctx => (ctx.parsed?.y > 0 ? 5 : 0),
      pointHoverRadius: 8,
      pointBackgroundColor: "#10b981",
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      borderWidth: 3,
    }]
  }), [labels, totals]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: { label: ctx => ` ₱${Number(ctx.parsed.y).toLocaleString()}` }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(255,255,255,0.03)", borderDash: [5, 5] },
        border: { display: false },
        ticks: { color: "rgba(255,255,255,0.4)", font: { size: 10, weight: "600" }, callback: v => `₱${Number(v).toLocaleString()}` }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "rgba(255,255,255,0.4)", font: { size: 10, weight: "600" } }
      }
    }
  }), []);

  if (!labels.length) return null;

  return (
    <div className="chart-card" style={{ height: "100%", width: "100%" }}>
      <Line data={chartData} options={options} redraw={false} />
    </div>
  );
});

export default MonthlySales;
