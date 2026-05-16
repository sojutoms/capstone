import React from "react";
import "./OverviewCard.css";

const Sparkline = ({ data = [], color = "#3b82f6" }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 30;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="sparkline-container">
      <svg width={width} height={height} className="sparkline-svg">
        <defs>
          <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

const OverviewCard = ({ icon, title, value, subtitle, trend, trendUp, sparkData }) => {
  return (
    <div className="overview-card animate-in">
      <div className="card-header">
        <div className="card-title-group">
          <h4 className="card-title">{title}</h4>
          {trend && (
            <span className={`trend-badge ${trendUp ? "trend-up" : "trend-down"}`}>
              {trendUp ? "↗" : "↘"} {trend}
            </span>
          )}
        </div>
        {icon && <div className="card-icon">{icon}</div>}
      </div>

      <div className="card-content">
        <div className="value-row">
          <p className="card-value">{value}</p>
          {sparkData && <Sparkline data={sparkData} color={trendUp ? "#4ade80" : "#f87171"} />}
        </div>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      
      <div className="card-shine"></div>
    </div>
  );
};

export default OverviewCard;
