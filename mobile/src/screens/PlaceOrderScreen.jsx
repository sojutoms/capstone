import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Modal,
  Linking,
  AppState,
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getShippingFee, getShippingTier } from "../services/shippingFee";
import { colors, fonts, radius, typography } from "../theme";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const NCR_REGION_CODE = "1300000000";
const { width } = Dimensions.get("window");
const isSmall  = width < 380;
const isTablet = width > 768;

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */

const Label = ({ text }) => <Text style={s.label}>{text}</Text>;

const FieldError = ({ msg }) =>
  msg ? <Text style={s.errorText}>⚠ {msg}</Text> : null;

const Divider = () => <View style={s.divider} />;

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════════════════════ */

export default function PlaceOrderScreen({ navigation }) {
  const { cart, clearCart } = useCart();
  const { userToken }       = useAuth();

  const [method, setMethod] = useState("online");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", street: "", phone: "",
    region: "", province: "", city: "", barangay: "",
  });

  const [placingOrder, setPlacingOrder] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingOrderNumber, setPendingOrderNumber] = useState(null);
  const pendingOrderRef = useRef(null);

  // When the user comes back to the app after paying in the external
  // browser, verify the payment automatically instead of making them tap
  // something — pendingOrderRef (not state) so the listener always reads
  // the latest value without needing to be re-subscribed on every change.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && pendingOrderRef.current) {
        const orderNumber = pendingOrderRef.current;
        pendingOrderRef.current = null;
        finalizePayment(orderNumber);
      }
    });
    return () => sub.remove();
  }, []);

  const [errors,             setErrors]             = useState({});
  const [saveAddress,        setSaveAddress]        = useState(false);
  const [savedAddresses,     setSavedAddresses]     = useState([]);
  const [showAddressDropdown,setShowAddressDropdown]= useState(false);
  const [isLoadingSavedAddress, setIsLoadingSavedAddress] = useState(false);

  const [regions,   setRegions]   = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities,    setCities]    = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [hasProvinces, setHasProvinces] = useState(true);

  const [loadingRegions,   setLoadingRegions]   = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities,    setLoadingCities]    = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  /* ── helpers ── */
  const findName = (list, code) => {
    if (!code || !Array.isArray(list)) return "";
    const found = list.find((item) => String(item.code) === String(code));
    return found ? found.name : "";
  };

  const getSizePrice = (item) => {
    const sizeKey  = item?.selectedSize || item?.size;
    const sizeData = sizeKey ? item?.sizes?.[sizeKey] : undefined;
    if (typeof sizeData === "object" && sizeData?.price !== undefined) return Number(sizeData.price) || 0;
    if (typeof sizeData === "number" || typeof sizeData === "string") return Number(sizeData) || 0;
    return Number(item?.new_price) || Number(item?.price) || 0;
  };

  const calculateSubtotal = () =>
    cart.reduce((total, item) => total + getSizePrice(item) * item.quantity, 0);

  const shippingFee  = getShippingFee(form.region);
  const shippingTier = getShippingTier(form.region);

  const calculateTotal = () => calculateSubtotal() + shippingFee;

  /* ── mount ── */
  useEffect(() => {
    setLoadingRegions(true);
    axios.get("https://psgc.cloud/api/regions")
      .then((res) => setRegions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRegions([]))
      .finally(() => setLoadingRegions(false));
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/getsavedaddresses`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) setSavedAddresses(data.addresses || []);
    } catch {}
  };

  /* ── region → provinces ── */
  useEffect(() => {
    if (!isLoadingSavedAddress) { setProvinces([]); setCities([]); setBarangays([]); setHasProvinces(true); }
    if (!form.region) return;
    const isNCR = String(form.region) === NCR_REGION_CODE;
    setHasProvinces(!isNCR);
    if (!isNCR) {
      setLoadingProvinces(true);
      axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(form.region)}/provinces`)
        .then((res) => setProvinces((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||""))))
        .catch(() => setProvinces([]))
        .finally(() => setLoadingProvinces(false));
    }
  }, [form.region, isLoadingSavedAddress]);

  /* ── province / NCR → cities ── */
  useEffect(() => {
    if (!isLoadingSavedAddress) { setCities([]); setBarangays([]); setForm((p) => ({ ...p, city: "", barangay: "" })); }
    if (hasProvinces && !form.province) return;
    if (!hasProvinces && !form.region) return;
    setLoadingCities(true);
    const url = hasProvinces
      ? `https://psgc.cloud/api/provinces/${encodeURIComponent(form.province)}/cities-municipalities`
      : `https://psgc.cloud/api/regions/${encodeURIComponent(form.region)}/cities-municipalities`;
    axios.get(url)
      .then((res) => setCities((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||""))))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [form.province, form.region, hasProvinces, isLoadingSavedAddress]);

  /* ── city → barangays ── */
  useEffect(() => {
    if (!isLoadingSavedAddress) { setBarangays([]); setForm((p) => ({ ...p, barangay: "" })); }
    if (!form.city) return;
    setLoadingBarangays(true);
    axios.get(`https://psgc.cloud/api/cities-municipalities/${encodeURIComponent(form.city)}/barangays`)
      .then((res) => setBarangays((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||""))))
      .catch(() => setBarangays([]))
      .finally(() => setLoadingBarangays(false));
  }, [form.city, isLoadingSavedAddress]);

  /* ── input handler ── */
  const handleChange = (name, value) => {
    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[0-9]/g, "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "").slice(0, 54);
    } else if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 11);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  /* ── validation ── */
  const validate = () => {
    const e = {};
    const ft = form.firstName.trim();
    if (!ft) e.firstName = "First name is required";
    else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/.test(ft)) e.firstName = "Invalid characters";
    const lt = form.lastName.trim();
    if (!lt) e.lastName = "Last name is required";
    else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/.test(lt)) e.lastName = "Invalid characters";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.street.trim()) e.street = "Street is required";
    if (!form.region)   e.region   = "Select a region";
    if (hasProvinces && !form.province) e.province = "Select a province";
    if (!form.city)     e.city     = "Select a city / municipality";
    if (!form.barangay) e.barangay = "Select a barangay";
    const ph = (form.phone || "").replace(/\D/g, "");
    if (!ph) e.phone = "Phone is required";
    else if (!/^\d{11}$/.test(ph)) e.phone = "Must be 11 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── payment: PayMongo hosted checkout ── */
  const startPayMongoCheckout = async (orderNumber) => {
    try {
      const res  = await fetch(`${BASE_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json();
      if (data.success && data.checkoutUrl) {
        pendingOrderRef.current = orderNumber;
        setPendingOrderNumber(orderNumber);
        await Linking.openURL(data.checkoutUrl);
      } else {
        Alert.alert("Payment Error", data.error || "Order placed, but payment could not be started. You can retry from Order History.");
        goToOrders(orderNumber);
      }
    } catch {
      Alert.alert("Network Error", "Order placed, but payment could not be started. You can retry from Order History.");
      goToOrders(orderNumber);
    }
  };

  const goToOrders = (orderNumber) => {
    navigation.reset({ index: 0, routes: [{ name: "CartScreen", params: undefined }] });
    navigation.navigate("Orders", { orderNumber });
  };

  const finalizePayment = async (orderNumber) => {
    setPendingOrderNumber(null);
    setVerifying(true);
    try {
      await fetch(`${BASE_URL}/payment/verify/${orderNumber}`, {
        headers: { "auth-token": userToken || "" },
      });
    } catch {}
    setVerifying(false);
    goToOrders(orderNumber);
  };

  /* ── place order ── */
  const handlePlaceOrder = async () => {
    if (!validate()) { Alert.alert("Incomplete", "Please fill in all required fields correctly."); return; }
    if (!cart.length) { Alert.alert("Empty Cart", "Your cart is empty!"); return; }

    const payload = cart.filter((i) => i.quantity > 0).map((item) => ({
      id: item.id, name: item.name, image: item.image,
      price: getSizePrice(item), quantity: item.quantity,
      size: item.selectedSize || item.size || "N/A",
    }));
    const total = calculateTotal();

    const deliveryInfo = {
      firstName: form.firstName, lastName: form.lastName, email: form.email,
      street: form.street, phone: form.phone,
      region: { code: form.region, name: findName(regions, form.region) },
      province: hasProvinces
        ? { code: form.province, name: findName(provinces, form.province) }
        : { code: form.region, name: "Metro Manila" },
      cityOrMunicipality: { code: form.city, name: findName(cities, form.city) },
      barangay: { code: form.barangay, name: findName(barangays, form.barangay) },
    };

    if (saveAddress && userToken) {
      try {
        await fetch(`${BASE_URL}/saveaddress`, {
          method: "POST",
          headers: { "auth-token": userToken, "Content-Type": "application/json" },
          body: JSON.stringify({ address: deliveryInfo }),
        });
        loadSavedAddresses();
      } catch {}
    }

    setPlacingOrder(true);
    try {
      const res          = await fetch(`${BASE_URL}/placeorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ items: payload, total, deliveryInfo, paymentMethod: method, shippingFee }),
      });
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } catch {
        Alert.alert("Server Error", `Status ${res.status}: ${responseText}`); return;
      }
      if (data.success) {
        clearCart();
        if (method === "online") {
          await startPayMongoCheckout(data.orderNumber);
        } else {
          goToOrders(data.orderNumber);
        }
      } else {
        Alert.alert("Order Failed", data.error || data.message || JSON.stringify(data));
      }
    } catch (err) {
      Alert.alert("Network Error", err.message || "Could not place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  /* ── load saved address ── */
  const useSavedAddress = async (address) => {
    setIsLoadingSavedAddress(true);
    try {
      const regionCode   = address.region?.code || "";
      const provinceCode = address.province?.code || "";
      const cityCode     = address.cityOrMunicipality?.code || "";
      const barangayCode = address.barangay?.code || "";
      const isNCR        = regionCode === NCR_REGION_CODE;
      setHasProvinces(!isNCR);

      if (!isNCR && regionCode) {
        setLoadingProvinces(true);
        try {
          const res = await axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(regionCode)}/provinces`);
          setProvinces((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||"")));
        } catch { setProvinces([]); } finally { setLoadingProvinces(false); }
      }

      const pOrR = isNCR ? regionCode : provinceCode;
      if (pOrR) {
        setLoadingCities(true);
        try {
          const url = isNCR
            ? `https://psgc.cloud/api/regions/${encodeURIComponent(pOrR)}/cities-municipalities`
            : `https://psgc.cloud/api/provinces/${encodeURIComponent(pOrR)}/cities-municipalities`;
          const res = await axios.get(url);
          setCities((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||"")));
        } catch { setCities([]); } finally { setLoadingCities(false); }
      }

      if (cityCode) {
        setLoadingBarangays(true);
        try {
          const res = await axios.get(`https://psgc.cloud/api/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);
          setBarangays((Array.isArray(res.data) ? res.data : []).sort((a, b) => (a.name||"").localeCompare(b.name||"")));
        } catch { setBarangays([]); } finally { setLoadingBarangays(false); }
      }

      setForm((prev) => ({
        ...prev,
        firstName: address.firstName || "", lastName: address.lastName || "",
        email: address.email || "", street: address.street || "",
        phone: (address.phone || "").replace(/\D/g, "").slice(0, 11),
        region: regionCode, province: isNCR ? NCR_REGION_CODE : provinceCode,
        city: cityCode, barangay: barangayCode,
      }));
    } catch {} finally {
      setIsLoadingSavedAddress(false);
      setShowAddressDropdown(false);
    }
  };

  /* ── picker field component ── */
  const PickerField = ({ label, field, items, loading, enabled = true }) => (
    <View style={s.fieldGroup}>
      <Label text={label} />
      <View style={[s.pickerWrapper, (!enabled || loading) && s.pickerDisabled]}>
        {loading ? (
          <View style={s.pickerLoading}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={s.loadingText}>Loading {label.toLowerCase()}…</Text>
          </View>
        ) : (
          <Picker
            style={s.picker}
            mode="dropdown"
            dropdownIconColor={colors.textMuted}
            selectedValue={form[field]}
            onValueChange={(v) => handleChange(field, v)}
            enabled={enabled && !loading}
          >
            <Picker.Item
              label={`Select ${label}`}
              value=""
              color={Platform.OS === "android" ? colors.textSecondary : colors.textMuted}
              style={Platform.OS === "android" ? { backgroundColor: colors.bgCard, color: colors.textSecondary } : {}}
            />
            {items.map((item) => (
              <Picker.Item
                key={item.code}
                label={item.name}
                value={item.code}
                color={colors.textPrimary}
                style={Platform.OS === "android" ? { backgroundColor: colors.bgCard, color: colors.textPrimary } : {}}
              />
            ))}
          </Picker>
        )}
      </View>
      <FieldError msg={errors[field]} />
    </View>
  );

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* ── TOP NAV ── */}
      <TouchableOpacity
        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")}
        style={s.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.backArrow}>←</Text>
        <Text style={s.backLabel}>Back</Text>
      </TouchableOpacity>

      <Text style={s.pageTitle}>Place Order</Text>

      {/* ════════════════════════════════
          DELIVERY INFORMATION
      ════════════════════════════════ */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeadRow}>
          <Text style={s.sectionIcon}>📍</Text>
          <Text style={s.sectionTitle}>Delivery Information</Text>
        </View>

        {/* Saved address button */}
        {savedAddresses.length > 0 && (
          <View style={s.savedBlock}>
            <TouchableOpacity
              style={s.savedToggleBtn}
              onPress={() => setShowAddressDropdown(!showAddressDropdown)}
              activeOpacity={0.8}
            >
              <Text style={s.savedToggleText}>
                {showAddressDropdown ? "↑ Hide" : "⊕ Use Saved Address"}
              </Text>
            </TouchableOpacity>

            {showAddressDropdown && (
              <View style={s.savedList}>
                {savedAddresses.map((addr, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={s.savedItem}
                    onPress={() => useSavedAddress(addr)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.savedName}>{addr.firstName} {addr.lastName}</Text>
                    <Text style={s.savedMeta}>
                      {addr.street}, {addr.barangay?.name}, {addr.cityOrMunicipality?.name}
                    </Text>
                    <Text style={s.savedMeta}>{addr.province?.name}, {addr.region?.name}</Text>
                    <Text style={s.savedPhone}>{addr.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Name row */}
        <View style={s.row}>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Label text="First Name" />
            <TextInput
              style={[s.input, errors.firstName && s.inputError]}
              value={form.firstName}
              onChangeText={(v) => handleChange("firstName", v)}
              placeholder="First name"
              placeholderTextColor={colors.bgTertiary}
              maxLength={54}
            />
            <FieldError msg={errors.firstName} />
          </View>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Label text="Last Name" />
            <TextInput
              style={[s.input, errors.lastName && s.inputError]}
              value={form.lastName}
              onChangeText={(v) => handleChange("lastName", v)}
              placeholder="Last name"
              placeholderTextColor={colors.bgTertiary}
              maxLength={54}
            />
            <FieldError msg={errors.lastName} />
          </View>
        </View>

        {/* Email */}
        <View style={s.fieldGroup}>
          <Label text="Email" />
          <TextInput
            style={[s.input, errors.email && s.inputError]}
            value={form.email}
            onChangeText={(v) => handleChange("email", v)}
            placeholder="email@example.com"
            placeholderTextColor={colors.bgTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FieldError msg={errors.email} />
        </View>

        {/* Street */}
        <View style={s.fieldGroup}>
          <Label text="Street Address" />
          <TextInput
            style={[s.input, errors.street && s.inputError]}
            value={form.street}
            onChangeText={(v) => handleChange("street", v)}
            placeholder="House no., Street, Subdivision"
            placeholderTextColor={colors.bgTertiary}
          />
          <FieldError msg={errors.street} />
        </View>

        {/* Region */}
        <PickerField label="Region" field="region" items={regions} loading={loadingRegions} enabled />

        {/* Province */}
        <View style={s.fieldGroup}>
          <Label text="Province" />
          <View style={[s.pickerWrapper, (!hasProvinces || !form.region) && s.pickerDisabled]}>
            {!hasProvinces ? (
              <Picker
                style={s.picker}
                mode="dropdown"
                selectedValue={NCR_REGION_CODE}
                enabled={false}
                dropdownIconColor={colors.textMuted}
              >
                <Picker.Item
                  label="Metro Manila"
                  value={NCR_REGION_CODE}
                  color={colors.textPrimary}
                  style={Platform.OS === "android" ? { backgroundColor: colors.bgCard, color: colors.textPrimary } : {}}
                />
              </Picker>
            ) : loadingProvinces ? (
              <View style={s.pickerLoading}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={s.loadingText}>Loading provinces…</Text>
              </View>
            ) : (
              <Picker
                style={s.picker}
                mode="dropdown"
                dropdownIconColor={colors.textMuted}
                selectedValue={form.province}
                onValueChange={(v) => handleChange("province", v)}
                enabled={!!form.region && !loadingProvinces}
              >
                <Picker.Item
                  label="Select Province"
                  value=""
                  color={Platform.OS === "android" ? colors.textSecondary : colors.textMuted}
                  style={Platform.OS === "android" ? { backgroundColor: colors.bgCard, color: colors.textSecondary } : {}}
                />
                {provinces.map((p) => (
                  <Picker.Item
                    key={p.code}
                    label={p.name}
                    value={p.code}
                    color={colors.textPrimary}
                    style={Platform.OS === "android" ? { backgroundColor: colors.bgCard, color: colors.textPrimary } : {}}
                  />
                ))}
              </Picker>
            )}
          </View>
          <FieldError msg={errors.province} />
        </View>

        {/* City */}
        <PickerField
          label="City / Municipality"
          field="city"
          items={cities}
          loading={loadingCities}
          enabled={!!(form.province || (!hasProvinces && form.region))}
        />

        {/* Barangay */}
        <PickerField
          label="Barangay"
          field="barangay"
          items={barangays}
          loading={loadingBarangays}
          enabled={!!form.city}
        />

        {/* Phone */}
        <View style={s.fieldGroup}>
          <Label text="Phone" />
          <TextInput
            style={[s.input, errors.phone && s.inputError]}
            value={form.phone}
            onChangeText={(v) => handleChange("phone", v)}
            placeholder="09XXXXXXXXX"
            placeholderTextColor={colors.bgTertiary}
            keyboardType="number-pad"
            maxLength={11}
          />
          <FieldError msg={errors.phone} />
        </View>

        {/* Save address checkbox */}
        <TouchableOpacity style={s.checkRow} onPress={() => setSaveAddress(!saveAddress)} activeOpacity={0.7}>
          <View style={[s.checkbox, saveAddress && s.checkboxOn]}>
            {saveAddress && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.checkLabel}>Save this address for future orders</Text>
        </TouchableOpacity>
      </View>

      {/* ════════════════════════════════
          PAYMENT METHOD
      ════════════════════════════════ */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeadRow}>
          <Text style={s.sectionIcon}>💳</Text>
          <Text style={s.sectionTitle}>Payment</Text>
        </View>

        <View style={s.methodRow}>
          {[
            { key: "online", label: "Card / GCash / Maya" },
            { key: "cash on delivery", label: "Cash on Delivery" },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.methodChip, method === key && s.methodChipActive]}
              onPress={() => setMethod(key)}
              activeOpacity={0.8}
            >
              <Text style={[s.methodChipText, method === key && s.methodChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {method === "online" && (
          <Text style={s.methodNote}>
            You'll be taken to a secure PayMongo checkout page to pay by card, GCash, or Maya.
          </Text>
        )}
        {method === "cash on delivery" && (
          <Text style={s.methodNote}>
            Pay in cash when your order arrives — no extra handling fee.
          </Text>
        )}
      </View>

      {/* ════════════════════════════════
          ORDER SUMMARY
      ════════════════════════════════ */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeadRow}>
          <Text style={s.sectionIcon}>🛍</Text>
          <Text style={s.sectionTitle}>Order Summary</Text>
        </View>

        {cart.map((item, idx) => (
          <View key={`${item.id}_${item.selectedSize}_${idx}`} style={s.summaryItem}>
            <View style={s.summaryLeft}>
              <Text style={s.summaryName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.selectedSize && (
                <Text style={s.summarySize}>Size {item.selectedSize}</Text>
              )}
            </View>
            <View style={s.summaryRight}>
              <Text style={s.summaryQty}>×{item.quantity}</Text>
              <Text style={s.summaryPrice}>
                ₱{(getSizePrice(item) * item.quantity).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}

        <Divider />

        <View style={s.subRow}>
          <Text style={s.subLabel}>Subtotal</Text>
          <Text style={s.subValue}>₱{calculateSubtotal().toLocaleString()}</Text>
        </View>
        <View style={s.subRow}>
          <Text style={s.subLabel}>
            Shipping{shippingTier ? ` (${shippingTier.label})` : ""}
          </Text>
          <Text style={s.subValue}>
            {form.region ? (shippingFee > 0 ? `₱${shippingFee.toLocaleString()}` : "FREE") : "Select a region"}
          </Text>
        </View>

        <Divider />

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmount}>₱{calculateTotal().toLocaleString()}</Text>
        </View>
      </View>

      {/* ── PLACE ORDER CTA ── */}
      <TouchableOpacity
        style={[s.ctaBtn, placingOrder && s.ctaBtnDisabled]}
        onPress={handlePlaceOrder}
        activeOpacity={0.88}
        disabled={placingOrder}
      >
        {placingOrder ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Text style={s.ctaText}>PLACE ORDER</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 48 }} />

      {/* ── WAITING ON EXTERNAL BROWSER PAYMENT ── */}
      <Modal visible={!!pendingOrderNumber && !verifying} transparent animationType="fade">
        <View style={s.verifyOverlay}>
          <ActivityIndicator size="large" color={colors.accentGold} />
          <Text style={s.verifyText}>Complete your payment in the browser, then come back here.</Text>
        </View>
      </Modal>

      {/* ── VERIFYING PAYMENT OVERLAY ── */}
      <Modal visible={verifying} transparent animationType="fade">
        <View style={s.verifyOverlay}>
          <ActivityIndicator size="large" color={colors.accentGold} />
          <Text style={s.verifyText}>Confirming your payment…</Text>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES  — dark premium matching ProductDetailScreen vibe
═══════════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_CLEARANCE },

  /* ── nav ── */
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: "300" },
  backLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bodyMedium },

  pageTitle: {
    fontSize: 30,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 20,
  },

  /* ── section card ── */
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
    marginBottom: 14,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  sectionIcon:  { fontSize: 16 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: "uppercase",
  },

  /* ── saved address ── */
  savedBlock: { marginBottom: 16 },
  savedToggleBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.accentGold,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.accentGoldWash,
  },
  savedToggleText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.accentGoldLight, letterSpacing: 0.5 },
  savedList: {
    marginTop: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
  },
  savedItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
    gap: 2,
  },
  savedName:  { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.textPrimary },
  savedMeta:  { fontSize: 12, color: colors.textSecondary },
  savedPhone: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  /* ── form ── */
  row:       { flexDirection: "row", gap: 10 },
  fieldGroup:{ marginBottom: 14 },

  label: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 7,
    textTransform: "uppercase",
  },

  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: isSmall ? 12 : 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  errorText:  { fontSize: 11, color: colors.danger, marginTop: 5, letterSpacing: 0.3 },

  /* ── pickers ── */
  pickerWrapper: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  pickerDisabled: { backgroundColor: colors.bgPrimary, opacity: 0.5 },
  picker:         { height: 50, width: "100%", color: colors.textPrimary, backgroundColor: colors.bgCard },
  pickerLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: colors.textMuted },

  /* ── checkbox ── */
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgCard,
  },
  checkboxOn: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  checkmark:  { color: colors.textInverse, fontSize: 13, fontWeight: "800" },
  checkLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },

  /* ── payment methods ── */
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
  },
  methodChipActive:     { borderColor: colors.accentGold, backgroundColor: colors.accentGoldWash },
  methodChipText:       { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, letterSpacing: 0.5 },
  methodChipTextActive: { color: colors.accentGoldLight },
  methodNote:           { fontSize: 12, color: colors.textMuted, fontFamily: fonts.bodyRegular, marginTop: 12, lineHeight: 18 },

  /* ── order summary ── */
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 10,
  },
  summaryLeft:  { flex: 1, gap: 3 },
  summaryName:  { fontSize: 13, fontFamily: fonts.bodySemibold, color: colors.textSecondary },
  summarySize:  { fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  summaryRight: { alignItems: "flex-end", gap: 2 },
  summaryQty:   { fontSize: 11, color: colors.textMuted },
  summaryPrice: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.textPrimary },

  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 },

  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subLabel: { fontSize: 12, color: colors.textSecondary },
  subValue: { fontSize: 13, fontFamily: fonts.bodySemibold, color: colors.textSecondary },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel:  { fontSize: 14, fontFamily: fonts.display, color: colors.textSecondary, letterSpacing: 1 },
  totalAmount: { fontSize: 22, fontWeight: "900", color: colors.accentGold, letterSpacing: 0.3 },

  /* ── CTA ── */
  ctaBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 6,
  },
  ctaText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 14,
  },
  ctaBtnDisabled: { opacity: 0.6 },

  verifyOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    gap: 14,
    paddingHorizontal: 40,
  },
  verifyText: { color: colors.textSecondary, fontSize: 13, letterSpacing: 0.5, textAlign: "center" },
});