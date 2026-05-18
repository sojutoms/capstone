import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import './PlaceOrder.css';
import CartTotal from '../CartTotal/CartTotal';
import { ShopContext } from '../../Context/ShopContext';
import API_BASE_URL from '../../services/api';
import { getShippingFee, getShippingTier, getCodFee } from '../../services/shippingFee';

const NCR_REGION_CODE = '1300000000';
const SIMPLE_CATEGORIES = ['bags', 'collectibles'];

// ─── PSGC fetch helper ────────────────────────────────────────────────────────
const fixEncoding = (str) => {
  try {
    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
};

const fixNames = (arr) =>
  arr.map((item) => ({ ...item, name: fixEncoding(item.name) }));

const psgcGet = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PSGC ${res.status}`);
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? fixNames(data) : data;
  } catch {
    const latin1 = new TextDecoder('iso-8859-1').decode(buffer);
    const data = JSON.parse(latin1);
    return Array.isArray(data) ? fixNames(data) : data;
  }
};

// ─── Voucher Panel ────────────────────────────────────────────────────────────
const VoucherPanel = ({ subtotal, onApply, onRemove, appliedCode }) => {
  const [open, setOpen] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(null);
  const [error, setError] = useState("");

  const fetchVouchers = useCallback(async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/my-vouchers`, { headers: { 'auth-token': token } });
      const data = await res.json();
      if (data.success) setVouchers(data.vouchers || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchVouchers(); }, [open, fetchVouchers]);

  const handleApply = async (code) => {
    if (applying) return;
    setError("");
    setApplying(code);
    const token = localStorage.getItem('auth-token');
    try {
      const res = await fetch(`${API_BASE_URL}/apply-voucher`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'auth-token': token },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (data.success) {
        onApply({ code, discountAmount: data.discountAmount, discountPercent: data.discountPercent, newTotal: data.newTotal, voucher: data.voucher });
        setOpen(false);
      } else {
        setError(data.error || "Could not apply voucher.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setApplying(null);
    }
  };

  const handleRemove = () => { setError(""); onRemove(); };

  return (
    <div className="voucher-dropdown-root" style={{ position: 'relative', marginTop: '24px', zIndex: 100 }}>
      <div className={`voucher-select-trigger ${appliedCode ? 'applied' : ''}`} onClick={() => setOpen(!open)}>
        <div className="trigger-content">
          <div className="trigger-text-group">
            <span className="trigger-label">{appliedCode ? "Voucher Applied" : "Available Vouchers"}</span>
            <span className="trigger-value">{appliedCode ? appliedCode : (loading ? "Loading..." : `${vouchers.length} available`)}</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="voucher-dropdown-menu">
          {loading ? (
            <div className="dropdown-loading">Scanning for rewards...</div>
          ) : error ? (
            <div className="dropdown-error">{error}</div>
          ) : vouchers.length === 0 ? (
            <div className="dropdown-empty">You don't have any vouchers yet.</div>
          ) : (
            <div className="dropdown-vouchers-list">
              {vouchers.map((v) => (
                <div 
                  key={v._id} 
                  className={`dropdown-voucher-item ${appliedCode === v.code ? 'active' : ''} ${v.used ? 'used' : ''}`}
                  onClick={() => !v.used && handleApply(v.code)}
                >
                  <div className="v-item-left">
                    <span className="v-item-discount">{v.discountPercent}% OFF</span>
                    <span className="v-item-title">{v.title}</span>
                  </div>
                  <div className="v-item-right">
                    {applying === v.code ? "..." : (appliedCode === v.code ? "Applied" : "Apply")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {appliedCode && (
        <button className="remove-voucher-btn" onClick={handleRemove}>
          Remove Applied Voucher
        </button>
      )}
    </div>
  );
};

// ─── Points Panel ─────────────────────────────────────────────────────────────
const PointsPanel = ({ subtotal, onDeductionChange, currentDeductionPoints, userPoints }) => {
  const [usePoints, setUsePoints] = useState(false);
  
  const conversionRate = 50 / 100; // ₱50 per 100 points = ₱0.5 per point
  const maxDeductionValue = subtotal * 0.7; // Max 70% off
  const maxPointsPossible = Math.min(userPoints, Math.floor(maxDeductionValue / conversionRate));
  
  const handleToggle = (e) => {
    const active = e.target.checked;
    setUsePoints(active);
    if (!active) onDeductionChange(0);
    else onDeductionChange(maxPointsPossible);
  };

  const handleSliderChange = (e) => {
    onDeductionChange(Number(e.target.value));
  };

  const deductionValue = currentDeductionPoints * conversionRate;

  if (userPoints < 100) return null;

  return (
    <div className="points-panel terminal-section">
      <div className="section-header-innovative">
        <div className="indicator-dot"></div>
        <h3>REWARD POINTS</h3>
        <span className="points-balance-label">{userPoints.toLocaleString()} PTS AVAILABLE</span>
      </div>
      
      <div className="points-toggle-wrap">
        <label className="save-checkbox-innovative">
          <input type="checkbox" checked={usePoints} onChange={handleToggle} />
          <span>USE POINTS FOR DISCOUNTS</span>
        </label>
      </div>

      {usePoints && (
        <div className="points-slider-wrap content-fade-in">
          <div className="points-slider-header">
            <span>Points to use: <strong>{currentDeductionPoints}</strong></span>
            <span>Value: <strong>−₱{deductionValue.toLocaleString()}</strong></span>
          </div>
          <input 
            type="range" 
            min="0" 
            max={maxPointsPossible} 
            step="100" 
            value={currentDeductionPoints} 
            onChange={handleSliderChange}
            className="points-range-slider"
          />
          <p className="points-disclaimer">You can deduct up to 70% of your order value using points.</p>
        </div>
      )}
    </div>
  );
};
// const calculateTier = (total) => {
//   if (total >= 100000) return { name: "PRESTIGE LEGEND", color: "#FFD700", next: null, min: 100000 };
//   if (total >= 10000) return { name: "ELITE COLLECTOR", color: "#C0C0C0", next: "PRESTIGE LEGEND", min: 10000, nextMin: 100000 };
//   return { name: "ROOKIE", color: "#CD7F32", next: "ELITE COLLECTOR", min: 0, nextMin: 10000 };
// };


// ─── Shipping Info Banner ──────────────────────────────────────────────────────
const ShippingBanner = ({ regionCode, subtotal }) => {
  if (!regionCode) return null;
  const tier = getShippingTier(regionCode);
  if (!tier) return null;

  const isFree = tier.fee === 0 || subtotal >= 5000;
  return (
    <div className={`shipping-banner ${isFree ? 'shipping-banner--free' : 'shipping-banner--paid'}`}>
      <div className="shipping-banner-text">
        <span className="shipping-banner-label">
          {isFree ? 'COMPLIMENTARY SHIPPING' : `PREMIUM SHIPPING: ₱${tier.fee.toLocaleString('en-PH')}`}
        </span>
        <span className="shipping-banner-sub">
          {tier.label} · Est. {tier.eta}
        </span>
      </div>
    </div>
  );
};

// ─── PlaceOrder ───────────────────────────────────────────────────────────────
const PlaceOrder = () => {
  const [method, setMethod] = useState('card');
  const navigate = useNavigate();
  const { cartItems, all_product, clearCart } = useContext(ShopContext);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', street: '',
    region: '', province: '', cityOrMunicipality: '', barangay: '',
    phone: '', cardName: '', cardNumber: '', expiry: '', cvv: '',
  });

  const [errors, setErrors] = useState({});
  const [saveAddress, setSaveAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showSaved, setShowSaved] = useState(false);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editRegions, setEditRegions] = useState([]);
  const [editProvinces, setEditProvinces] = useState([]);
  const [editCities, setEditCities] = useState([]);
  const [editBarangays, setEditBarangays] = useState([]);
  const [editHasProvinces, setEditHasProvinces] = useState(true);
  const [editLoading, setEditLoading] = useState({ provinces: false, cities: false, barangays: false, saving: false });
  const [deletingIndex, setDeletingIndex] = useState(null);

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [loadingStates, setLoadingStates] = useState({
    regions: false, provinces: false, cities: false, barangays: false, addressAction: false
  });
  const [hasProvinces, setHasProvinces] = useState(true);

  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [pointsUsed, setPointsUsed] = useState(0);

  const normalizeSizeToken = (sizeToken) => {
    const s = String(sizeToken);
    if (!sizeToken || s === 'null' || s === 'undefined' || s.trim() === '') return '';
    return s;
  };

  const getNumericPrice = (product, sizeToken) => {
    if (!product) return 0;
    const category = String(product.category || '').toLowerCase();
    const isSimple = SIMPLE_CATEGORIES.includes(category);
    const normalizedSize = normalizeSizeToken(sizeToken);
    if (isSimple) return Number(product.price ?? product.new_price ?? 0);
    const sizeData = product.sizes?.[normalizedSize];
    if (sizeData) {
      const p = typeof sizeData === 'object' ? (sizeData.price ?? 0) : sizeData;
      return Number(p);
    }
    return Number(product.new_price ?? product.price ?? 0);
  };

  const cartSubtotal = Object.entries(cartItems).reduce((sum, [key, quantity]) => {
    const [id, size] = key.split('_');
    const product = all_product.find((p) => p.id === Number(id));
    if (!product || quantity <= 0) return sum;
    return sum + getNumericPrice(product, size) * quantity;
  }, 0);

  // ── Derived shipping values ────────────────────────────────────────────────
  const shippingFee = getShippingFee(formData.region, cartSubtotal);
  const shippingTier = getShippingTier(formData.region, cartSubtotal);
  const codFee = method === 'cash on delivery' ? getCodFee(formData.region) : 0;

  const isAlreadySaved = savedAddresses.some(
    (addr) =>
      addr.street?.trim().toLowerCase() === formData.street?.trim().toLowerCase() &&
      addr.barangay?.code === formData.barangay &&
      addr.cityOrMunicipality?.code === formData.cityOrMunicipality
  );

  const findName = (list, code) => {
    if (!code || !Array.isArray(list)) return '';
    const found = list.find((item) => String(item.code) === String(code));
    return found ? found.name : '';
  };

  const loadSavedAddresses = useCallback(async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/getsavedaddresses`, { headers: { 'auth-token': token } });
      const data = await res.json();
      if (data.success) setSavedAddresses(data.addresses || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const fetchRegions = async () => {
      setLoadingStates((p) => ({ ...p, regions: true }));
      try {
        const data = await psgcGet('https://psgc.cloud/api/regions');
        setRegions(data || []);
        setEditRegions(data || []);
      } catch (err) { console.error(err); }
      finally { setLoadingStates((p) => ({ ...p, regions: false })); }
    };
    fetchRegions();
    loadSavedAddresses();

    const fetchPoints = async () => {
      const token = localStorage.getItem('auth-token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/my-vouchers`, { headers: { 'auth-token': token } });
        const data = await res.json();
        if (data.success) setUserPoints(data.points || 0);
      } catch {}
    };
    fetchPoints();
  }, [loadSavedAddresses]);

  useEffect(() => {
    if (!formData.region || loadingStates.addressAction) return;
    const fetchProvinces = async () => {
      setLoadingStates((p) => ({ ...p, provinces: true }));
      try {
        if (formData.region === NCR_REGION_CODE) {
          setHasProvinces(false); setProvinces([]);
        } else {
          setHasProvinces(true);
          const data = await psgcGet(`https://psgc.cloud/api/regions/${formData.region}/provinces`);
          setProvinces(data.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
        }
      } catch { setProvinces([]); }
      finally { setLoadingStates((p) => ({ ...p, provinces: false })); }
    };
    fetchProvinces();
  }, [formData.region, loadingStates.addressAction]);

  useEffect(() => {
    if ((hasProvinces && !formData.province) || (!hasProvinces && !formData.region) || loadingStates.addressAction) return;
    const fetchCities = async () => {
      setLoadingStates((p) => ({ ...p, cities: true }));
      try {
        const url = hasProvinces
          ? `https://psgc.cloud/api/provinces/${formData.province}/cities-municipalities`
          : `https://psgc.cloud/api/regions/${formData.region}/cities-municipalities`;
        const data = await psgcGet(url);
        setCities(data.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      } catch { setCities([]); }
      finally { setLoadingStates((p) => ({ ...p, cities: false })); }
    };
    fetchCities();
  }, [formData.province, formData.region, hasProvinces, loadingStates.addressAction]);

  useEffect(() => {
    if (!formData.cityOrMunicipality || loadingStates.addressAction) return;
    const fetchBarangays = async () => {
      setLoadingStates((p) => ({ ...p, barangays: true }));
      try {
        const data = await psgcGet(`https://psgc.cloud/api/cities-municipalities/${formData.cityOrMunicipality}/barangays`);
        setBarangays(data.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      } catch { setBarangays([]); }
      finally { setLoadingStates((p) => ({ ...p, barangays: false })); }
    };
    fetchBarangays();
  }, [formData.cityOrMunicipality, loadingStates.addressAction]);

  useEffect(() => {
    if (!editFormData?.region) return;
    const regionCode = editFormData.region;
    const fetchProvinces = async () => {
      setEditLoading((p) => ({ ...p, provinces: true }));
      try {
        if (regionCode === NCR_REGION_CODE) { setEditHasProvinces(false); setEditProvinces([]); }
        else { setEditHasProvinces(true); const data = await psgcGet(`https://psgc.cloud/api/regions/${regionCode}/provinces`); setEditProvinces(data.sort((a, b) => a.name.localeCompare(b.name, 'fil'))); }
      } catch { setEditProvinces([]); }
      finally { setEditLoading((p) => ({ ...p, provinces: false })); }
    };
    fetchProvinces();
  }, [editFormData?.region]);

  useEffect(() => {
    const province = editFormData?.province;
    const region = editFormData?.region;
    if (!region) return;
    if ((editHasProvinces && !province) || (!editHasProvinces && !region)) return;
    const fetchCities = async () => {
      setEditLoading((p) => ({ ...p, cities: true }));
      try {
        const url = editHasProvinces
          ? `https://psgc.cloud/api/provinces/${province}/cities-municipalities`
          : `https://psgc.cloud/api/regions/${region}/cities-municipalities`;
        const data = await psgcGet(url);
        setEditCities(data.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      } catch { setEditCities([]); }
      finally { setEditLoading((p) => ({ ...p, cities: false })); }
    };
    fetchCities();
  }, [editFormData?.province, editFormData?.region, editHasProvinces]);

  useEffect(() => {
    if (!editFormData?.cityOrMunicipality) return;
    const cityCode = editFormData.cityOrMunicipality;
    const fetchBarangays = async () => {
      setEditLoading((p) => ({ ...p, barangays: true }));
      try {
        const data = await psgcGet(`https://psgc.cloud/api/cities-municipalities/${cityCode}/barangays`);
        setEditBarangays(data.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      } catch { setEditBarangays([]); }
      finally { setEditLoading((p) => ({ ...p, barangays: false })); }
    };
    fetchBarangays();
  }, [editFormData?.cityOrMunicipality]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'firstName' || name === 'lastName') {
      const filtered = value
        .replace(/[0-9]/g, '')
        .replace(/[^\p{L}' -]/gu, '')
        .slice(0, 54);
      setFormData((p) => ({ ...p, [name]: filtered }));
      return;
    }

    if (name === 'phone') {
      let digits = value.replace(/\D/g, '');
      if (digits.length >= 1 && digits[0] !== '0') digits = '0' + digits;
      if (digits.length >= 2 && digits[1] !== '9') digits = '09' + digits.replace(/^0*/, '');
      digits = digits.slice(0, 11);
      setFormData((p) => ({ ...p, phone: digits }));
      return;
    }

    // Reset downstream address fields when region changes
    if (name === 'region') {
      setFormData((p) => ({
        ...p,
        region: value,
        province: '',
        cityOrMunicipality: '',
        barangay: '',
      }));
      setProvinces([]);
      setCities([]);
      setBarangays([]);
      if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
      return;
    }

    if (name === 'province') {
      setFormData((p) => ({ ...p, province: value, cityOrMunicipality: '', barangay: '' }));
      setCities([]);
      setBarangays([]);
      return;
    }

    if (name === 'cityOrMunicipality') {
      setFormData((p) => ({ ...p, cityOrMunicipality: value, barangay: '' }));
      setBarangays([]);
      return;
    }

    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
  };

  const applySavedAddress = async (address) => {
    setLoadingStates((p) => ({ ...p, addressAction: true }));
    try {
      const rCode = address.region?.code || '';
      const pCode = address.province?.code || '';
      const cCode = address.cityOrMunicipality?.code || '';
      const isNCR = rCode === NCR_REGION_CODE;
      setHasProvinces(!isNCR);
      const cityUrl = isNCR
        ? `https://psgc.cloud/api/regions/${rCode}/cities-municipalities`
        : `https://psgc.cloud/api/provinces/${pCode}/cities-municipalities`;
      const [cityRes, brgyRes] = await Promise.all([
        psgcGet(cityUrl),
        psgcGet(`https://psgc.cloud/api/cities-municipalities/${cCode}/barangays`),
      ]);
      setCities(cityRes.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      setBarangays(brgyRes.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      setFormData((p) => ({
        ...p, ...address,
        region: rCode,
        province: isNCR ? NCR_REGION_CODE : pCode,
        cityOrMunicipality: cCode,
        barangay: address.barangay?.code || '',
      }));
    } catch (err) { console.error(err); }
    finally { setLoadingStates((p) => ({ ...p, addressAction: false })); setShowSaved(false); }
  };

  const startEditAddress = async (idx) => {
    const addr = savedAddresses[idx];
    const rCode = addr.region?.code || '';
    const pCode = addr.province?.code || '';
    const cCode = addr.cityOrMunicipality?.code || '';
    const isNCR = rCode === NCR_REGION_CODE;
    setEditHasProvinces(!isNCR);
    setEditingIndex(idx);
    setEditFormData({
      firstName: addr.firstName || '', lastName: addr.lastName || '', email: addr.email || '',
      street: addr.street || '', phone: addr.phone || '',
      region: rCode, province: isNCR ? '' : pCode, cityOrMunicipality: cCode, barangay: addr.barangay?.code || '',
    });
    try {
      const cityUrl = isNCR
        ? `https://psgc.cloud/api/regions/${rCode}/cities-municipalities`
        : `https://psgc.cloud/api/provinces/${pCode}/cities-municipalities`;
      const [provRes, cityRes, brgyRes] = await Promise.all([
        isNCR ? Promise.resolve([]) : psgcGet(`https://psgc.cloud/api/regions/${rCode}/provinces`),
        psgcGet(cityUrl),
        psgcGet(`https://psgc.cloud/api/cities-municipalities/${cCode}/barangays`),
      ]);
      setEditProvinces(provRes.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      setEditCities(cityRes.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
      setEditBarangays(brgyRes.sort((a, b) => a.name.localeCompare(b.name, 'fil')));
    } catch (err) { console.error(err); }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name === 'region') {
      setEditFormData((p) => ({ ...p, region: value, province: '', cityOrMunicipality: '', barangay: '' }));
      setEditCities([]); setEditBarangays([]);
    } else if (name === 'province') {
      setEditFormData((p) => ({ ...p, province: value, cityOrMunicipality: '', barangay: '' }));
      setEditBarangays([]);
    } else if (name === 'cityOrMunicipality') {
      setEditFormData((p) => ({ ...p, cityOrMunicipality: value, barangay: '' }));
    } else if (name === 'firstName' || name === 'lastName') {
      const filtered = value
        .replace(/[0-9]/g, '')
        .replace(/[^\p{L}' -]/gu, '')
        .slice(0, 54);
      setEditFormData((p) => ({ ...p, [name]: filtered }));
    } else if (name === 'phone') {
      let digits = value.replace(/\D/g, '');
      if (digits.length >= 1 && digits[0] !== '0') digits = '0' + digits;
      if (digits.length >= 2 && digits[1] !== '9') digits = '09' + digits.replace(/^0*/, '');
      digits = digits.slice(0, 11);
      setEditFormData((p) => ({ ...p, phone: digits }));
    } else {
      setEditFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const saveEditedAddress = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token || editingIndex === null) return;
    setEditLoading((p) => ({ ...p, saving: true }));
    try {
      const payload = {
        ...editFormData,
        region: { code: editFormData.region, name: findName(editRegions, editFormData.region) },
        province: { code: editFormData.province, name: editHasProvinces ? findName(editProvinces, editFormData.province) : 'Metro Manila' },
        cityOrMunicipality: { code: editFormData.cityOrMunicipality, name: findName(editCities, editFormData.cityOrMunicipality) },
        barangay: { code: editFormData.barangay, name: findName(editBarangays, editFormData.barangay) },
      };
      const res = await fetch(`${API_BASE_URL}/updateaddress/${editingIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'auth-token': token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { setSavedAddresses(data.addresses || []); setEditingIndex(null); setEditFormData(null); }
      else alert(data.error || 'Failed to update address.');
    } catch (err) { console.error(err); alert('Failed to update address.'); }
    finally { setEditLoading((p) => ({ ...p, saving: false })); }
  };

  const deleteAddress = async (idx) => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    setDeletingIndex(idx);
    try {
      const res = await fetch(`${API_BASE_URL}/deleteaddress/${idx}`, { method: 'DELETE', headers: { 'auth-token': token } });
      const data = await res.json();
      if (data.success) { setSavedAddresses(data.addresses || []); if (editingIndex === idx) { setEditingIndex(null); setEditFormData(null); } }
      else alert(data.error || 'Failed to delete address.');
    } catch (err) { console.error(err); alert('Failed to delete address.'); }
    finally { setDeletingIndex(null); }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    const orderItems = Object.entries(cartItems).map(([key, quantity]) => {
      const [id, size] = key.split('_');
      const product = all_product.find((p) => p.id === Number(id));
      if (!product || quantity <= 0) return null;
      return {
        id: product.id, name: product.name, image: product.image,
        price: getNumericPrice(product, size), quantity,
        size: normalizeSizeToken(size) || null,
      };
    }).filter(Boolean);

    const deliveryInfo = {
      ...formData,
      region: { code: formData.region, name: findName(regions, formData.region) },
      province: { code: formData.province, name: hasProvinces ? findName(provinces, formData.province) : 'Metro Manila' },
      cityOrMunicipality: { code: formData.cityOrMunicipality, name: findName(cities, formData.cityOrMunicipality) },
      barangay: { code: formData.barangay, name: findName(barangays, formData.barangay) },
    };

    const authToken = localStorage.getItem('auth-token');
    try {
      if (saveAddress && authToken) {
        try {
          await fetch(`${API_BASE_URL}/saveaddress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'auth-token': authToken },
            body: JSON.stringify({ address: deliveryInfo }),
          });
        } catch (err) { console.error('Failed to save address:', err); }
      }

      const res = await fetch(`${API_BASE_URL}/placeorder`, {
        method: 'POST',
        headers: { 'auth-token': authToken || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          deliveryInfo,
          paymentMethod: method,
          voucherCode: appliedVoucher?.code || null,
          pointsUsed: pointsUsed > 0 ? pointsUsed : null,
          shippingFee,
          codFee,
        }),
      });
      const data = await res.json();
      if (data.success) {
        clearCart();
        navigate('/orders', {
          state: {
            orderNumber: data.orderNumber,
            purchasedItems: orderItems,
            discountAmount: appliedVoucher?.discountAmount || 0,
            discountPercent: appliedVoucher?.discountPercent || 0,
            voucherCode: appliedVoucher?.code || null,
            shippingFee,
            shippingTierLabel: shippingTier?.label || '',
            codFee,
            paymentMethod: method,
          }
        });
      } else {
        alert(data.error);
      }
    } catch (err) { alert('Checkout failed.'); }
  };

  return (
    <div className="checkout-terminal">
      <div className="terminal-wrapper">
        <main className="checkout-main">
          <header className="checkout-header">
            <h1 className="checkout-title">SECURE CHECKOUT</h1>
            <p className="checkout-subtitle">Identity & Payment Verification</p>
          </header>

          <form onSubmit={handlePlaceOrder}>
            <section className="terminal-section">
              <div className="section-header-innovative">
                <div className="indicator-dot"></div>
                <h3>Shipping Details</h3>
                {savedAddresses.length > 0 && (
                  <button type="button" className="utility-btn" onClick={() => { setShowSaved(!showSaved); setEditingIndex(null); setEditFormData(null); }}>
                    {showSaved ? '[ CLOSE ]' : '[ STORED ADDRESSES ]'}
                  </button>
                )}
              </div>

              {showSaved && (
                <div className="innovative-dropdown content-fade-in">
                  {savedAddresses.map((addr, idx) => (
                    <div key={idx}>
                      {editingIndex !== idx && (
                        <div className="dropdown-item saved-address-row">
                          <div className="saved-address-info" onClick={() => applySavedAddress(addr)}>
                            <p className="strong">{addr.firstName} {addr.lastName}</p>
                            <p className="small">{addr.street}, {addr.barangay?.name}, {addr.cityOrMunicipality?.name}</p>
                          </div>
                          <div className="saved-address-actions">
                            <button type="button" className="addr-action-btn addr-edit-btn" onClick={(e) => { e.stopPropagation(); startEditAddress(idx); }}>Edit</button>
                            <button type="button" className="addr-action-btn addr-delete-btn" onClick={(e) => { e.stopPropagation(); deleteAddress(idx); }} disabled={deletingIndex === idx}>{deletingIndex === idx ? '...' : 'Delete'}</button>
                          </div>
                        </div>
                      )}

                      {editingIndex === idx && editFormData && (
                        <div className="saved-address-edit-panel content-fade-in">
                          <div className="input-grid">
                            <div className="field-group"><label>First Name</label><input name="firstName" value={editFormData.firstName} onChange={handleEditChange} placeholder="NAME" /></div>
                            <div className="field-group"><label>Last Name</label><input name="lastName" value={editFormData.lastName} onChange={handleEditChange} placeholder="SURNAME" /></div>
                          </div>
                          <div className="field-group"><label>Email</label><input name="email" type="email" value={editFormData.email} onChange={handleEditChange} placeholder="EMAIL ADDRESS" /></div>
                          <div className="field-group"><label>Street</label><input name="street" value={editFormData.street} onChange={handleEditChange} placeholder="STREET / UNIT" /></div>
                          <div className="input-grid">
                            <div className="field-group">
                              <label>Region</label>
                              <select name="region" value={editFormData.region} onChange={handleEditChange}>
                                <option value="">SELECT REGION</option>
                                {editRegions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                              </select>
                            </div>
                            <div className="field-group">
                              <label>Province</label>
                              {editHasProvinces ? (
                                <select name="province" value={editFormData.province} onChange={handleEditChange} disabled={!editFormData.region}>
                                  <option value="">{editLoading.provinces ? 'SYNCING...' : 'SELECT PROVINCE'}</option>
                                  {editProvinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                                </select>
                              ) : <input value="METRO MANILA" disabled className="disabled-input" />}
                            </div>
                          </div>
                          <div className="input-grid">
                            <div className="field-group">
                              <label>City / Municipality</label>
                              <select name="cityOrMunicipality" value={editFormData.cityOrMunicipality} onChange={handleEditChange} disabled={!editFormData.region}>
                                <option value="">{editLoading.cities ? 'SYNCING...' : 'SELECT CITY'}</option>
                                {editCities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="field-group">
                              <label>Barangay</label>
                              <select name="barangay" value={editFormData.barangay} onChange={handleEditChange} disabled={!editFormData.cityOrMunicipality}>
                                <option value="">{editLoading.barangays ? 'SYNCING...' : 'SELECT BARANGAY'}</option>
                                {editBarangays.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="field-group"><label>Phone</label><input name="phone" value={editFormData.phone} onChange={handleEditChange} placeholder="09XXXXXXXXX" /></div>
                          <div className="saved-address-edit-actions">
                            <button type="button" className="addr-save-btn" onClick={saveEditedAddress} disabled={editLoading.saving}>{editLoading.saving ? 'SAVING...' : 'SAVE CHANGES'}</button>
                            <button type="button" className="addr-cancel-btn" onClick={() => { setEditingIndex(null); setEditFormData(null); }}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="input-grid">
                <div className="field-group"><label>First Name</label><input name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="GIVEN NAME" required /></div>
                <div className="field-group"><label>Last Name</label><input name="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="SURNAME" required /></div>
              </div>
              <div className="field-group"><label>Email Address</label><input name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="AUTHORIZED EMAIL" required /></div>
              <div className="field-group"><label>Street Address</label><input name="street" value={formData.street} onChange={handleInputChange} placeholder="RESIDENCE / UNIT / STREET" required /></div>
              <div className="input-grid">
                <div className="field-group">
                  <label>Region</label>
                  <select name="region" value={formData.region} onChange={handleInputChange} required>
                    <option value="">{loadingStates.regions ? 'SYNCING...' : 'SELECT REGION'}</option>
                    {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Province</label>
                  {hasProvinces ? (
                    <select name="province" value={formData.province} onChange={handleInputChange} disabled={!formData.region} required>
                      <option value="">{loadingStates.provinces ? 'SYNCING...' : 'SELECT PROVINCE'}</option>
                      {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                  ) : <input value="METRO MANILA" disabled className="disabled-input" />}
                </div>
              </div>
              <div className="input-grid">
                <div className="field-group">
                  <label>City / Municipality</label>
                  <select name="cityOrMunicipality" value={formData.cityOrMunicipality} onChange={handleInputChange} disabled={!formData.region} required>
                    <option value="">{loadingStates.cities ? 'SYNCING...' : 'SELECT CITY'}</option>
                    {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Barangay</label>
                  <select name="barangay" value={formData.barangay} onChange={handleInputChange} disabled={!formData.cityOrMunicipality} required>
                    <option value="">{loadingStates.barangays ? 'SYNCING...' : 'SELECT BARANGAY'}</option>
                    {barangays.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="field-group"><label>Phone Number</label><input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="09XXXXXXXXX" required /></div>

              {/* ── Dynamic shipping banner ── */}
              <ShippingBanner regionCode={formData.region} subtotal={cartSubtotal} />

              {isAlreadySaved ? (
                <p className="address-already-saved-note">✓ This address is already saved</p>
              ) : (
                <label className="save-checkbox-innovative">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                  <span>SAVE ADDRESS FOR LATER</span>
                </label>
              )}
            </section>

            {localStorage.getItem('auth-token') && (
              <section className="terminal-section">
                <div className="section-header-innovative">
                  <div className="indicator-dot"></div>
                  <h3>Vouchers</h3>
                </div>
                <VoucherPanel
                  subtotal={cartSubtotal}
                  appliedCode={appliedVoucher?.code || null}
                  onApply={(v) => setAppliedVoucher(v)}
                  onRemove={() => setAppliedVoucher(null)}
                />
                {appliedVoucher && (
                  <div className="voucher-discount-summary">
                    <span>Voucher discount ({appliedVoucher.discountPercent}% off)</span>
                    <span className="voucher-discount-amount">−₱{appliedVoucher.discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </section>
            )}

            {localStorage.getItem('auth-token') && (
              <PointsPanel 
                subtotal={cartSubtotal}
                userPoints={userPoints}
                currentDeductionPoints={pointsUsed}
                onDeductionChange={setPointsUsed}
              />
            )}

            <section className="terminal-section">
              <div className="section-header-innovative">
                <div className="indicator-dot"></div>
                <h3>Payment Method</h3>
              </div>
              <div className="innovative-payment-grid">
                {['card', 'gcash', 'cash on delivery'].map((m) => (
                  <label key={m} className={`payment-pill ${method === m ? 'active' : ''}`}>
                    <input type="radio" value={m} checked={method === m} onChange={() => setMethod(m)} />
                    <span className="pill-text">{m === 'cod' ? 'C.O.D' : m.toUpperCase()}</span>
                  </label>
                ))}
              </div>
              {method === 'cash on delivery' && (
                <div className="cod-fee-notice content-fade-in">
                  <span className="cod-fee-icon">💵</span>
                  <span>
                    COD handling fee for <strong>{shippingTier?.label || 'your area'}</strong>:{' '}
                    <strong>₱{codFee.toLocaleString('en-PH')}</strong>
                  </span>
                </div>
              )}
              {method === 'card' && (
                <div className="card-console content-fade-in">
                  <div className="field-group"><label>Card Name</label><input name="cardName" placeholder="NAME ON CARD" onChange={handleInputChange} /></div>
                  <div className="field-group"><label>Card Number</label><input name="cardNumber" maxLength="16" placeholder="0000 0000 0000 0000" onChange={handleInputChange} /></div>
                </div>
              )}
            </section>

            <button type="submit" className="authorize-btn">Proceed Checkout</button>
          </form>
        </main>

        <aside className="checkout-summary">
          <div className="summary-sticker">
            <CartTotal
              paymentMethod={method}
              discountAmount={(appliedVoucher?.discountAmount || 0) + (pointsUsed * 0.5)}
              discountPercent={appliedVoucher?.discountPercent || 0}
              voucherCode={appliedVoucher?.code || null}
              shippingFee={shippingFee}
              shippingTierLabel={shippingTier?.label || ''}
              shippingEta={shippingTier?.eta || ''}
              codFee={codFee}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PlaceOrder;
