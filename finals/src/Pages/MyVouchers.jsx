import React, { useState, useEffect, useCallback } from 'react';
import './CSS/MyVouchers.css';
import API_BASE_URL from '../services/api';

const MyVouchers = () => {
  const [points, setPoints] = useState(0);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unused');
  const [pointsToRedeem, setPointsToRedeem] = useState(100);
  const [redeeming, setRedeeming] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchVouchersData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/my-vouchers`, {
        headers: { 'auth-token': localStorage.getItem('auth-token') }
      });
      const data = await res.json();
      if (data.success) {
        setVouchers(data.vouchers || []);
        setPoints(data.points || 0);
      }
    } catch (err) {
      console.error("Error fetching vouchers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchersData();
  }, [fetchVouchersData]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRedeem = async () => {
    if (points < pointsToRedeem) return;
    setRedeeming(true);
    try {
      const res = await fetch(`${API_BASE_URL}/redeempoints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': localStorage.getItem('auth-token')
        },
        body: JSON.stringify({ pointsToRedeem })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchVouchersData();
        setPointsToRedeem(100);
      } else {
        showToast(data.error || "Redemption failed", 'error');
      }
    } catch (err) {
      showToast("Server error", 'error');
    } finally {
      setRedeeming(false);
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    showToast("Voucher code copied!");
  };

  const filteredVouchers = vouchers.filter(v => {
    if (activeTab === 'unused') return v.active && !v.used;
    if (activeTab === 'used') return v.used;
    if (activeTab === 'expired') return v.expired && !v.used;
    return false;
  });

  if (loading) {
    return <div className="my-vouchers-container"><div className="no-vouchers">Loading your rewards...</div></div>;
  }

  return (
    <div className="my-vouchers-container">
      <div className="vouchers-content">
        
        {/* POINTS DASHBOARD */}
        <section className="points-dashboard">
          <div className="points-info">
            <p>Your Balance</p>
            <h1>{points.toLocaleString()} PTS</h1>
            <p className="points-value">Estimated Value: ₱{((points / 100) * 50).toLocaleString()}</p>
          </div>
          
          <div className="redeem-section">
            <h3>Redeem for Voucher</h3>
            <div className="redeem-controls">
              <button 
                className="redeem-btn-circle" 
                onClick={() => setPointsToRedeem(Math.max(100, pointsToRedeem - 100))}
                disabled={pointsToRedeem <= 100}
              >-</button>
              <span className="redeem-amount">{pointsToRedeem}</span>
              <button 
                className="redeem-btn-circle" 
                onClick={() => setPointsToRedeem(pointsToRedeem + 100)}
                disabled={pointsToRedeem + 100 > points}
              >+</button>
            </div>
            <button 
              className="btn-redeem-action" 
              onClick={handleRedeem}
              disabled={redeeming || points < 100 || pointsToRedeem > points}
            >
              {redeeming ? "REDEEMING..." : `REDEEM FOR ₱${(pointsToRedeem / 100) * 50}`}
            </button>
            <span className="redeem-hint">Redeem in increments of 100 points. 100 pts = ₱50.</span>
          </div>
        </section>

        {/* TABS */}
        <div className="voucher-tabs">
          <button className={`v-tab ${activeTab === 'unused' ? 'active' : ''}`} onClick={() => setActiveTab('unused')}>Unused</button>
          <button className={`v-tab ${activeTab === 'used' ? 'active' : ''}`} onClick={() => setActiveTab('used')}>Used</button>
          <button className={`v-tab ${activeTab === 'expired' ? 'active' : ''}`} onClick={() => setActiveTab('expired')}>Expired</button>
        </div>

        {/* VOUCHER GRID */}
        <div className="vouchers-grid">
          {filteredVouchers.length > 0 ? (
            filteredVouchers.map(v => (
              <div key={v._id} className={`voucher-card ${v.expired ? 'expired' : ''}`}>
                <div className="v-header">
                  <h4 className="v-title">{v.title}</h4>
                  <span className="v-status-tag">{v.active ? 'ACTIVE' : v.used ? 'USED' : 'EXPIRED'}</span>
                </div>
                <p className="v-message">{v.message}</p>
                <div className="v-code-box" onClick={() => copyToClipboard(v.code)}>
                  <span className="v-code">{v.code}</span>
                  <span className="copy-hint">Click to copy code</span>
                </div>
                <p className="v-expiry">
                  {v.expiresAt ? `Expires: ${new Date(v.expiresAt).toLocaleDateString()}` : 'No expiry'}
                </p>
              </div>
            ))
          ) : (
            <div className="no-vouchers">No {activeTab} vouchers found.</div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`toast-simple ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Inline styles for toast simple if not in CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        .toast-simple {
          position: fixed;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          color: #000;
          padding: 12px 30px;
          border-radius: 99px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 14px;
          letter-spacing: 0.1em;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          z-index: 10000;
          animation: toastPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .toast-simple.error {
          background: #ff4d4d;
          color: #fff;
        }
        @keyframes toastPop {
          from { bottom: 0; opacity: 0; }
          to { bottom: 40px; opacity: 1; }
        }
      `}} />
    </div>
  );
};

export default MyVouchers;
