import React, { useState, useEffect } from "react";
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
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const NCR_REGION_CODE = "1300000000";
const { width } = Dimensions.get("window");
const isSmall  = width < 380;
const isTablet = width > 768;

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://unlaboured-charise-unmachined.ngrok-free.dev";

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

  const [method, setMethod] = useState("cod");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", street: "", phone: "",
    region: "", province: "", city: "", barangay: "",
    cardName: "", cardNumber: "", expiry: "", cvv: "",
  });

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

  const calculateTotal = () =>
    cart.reduce((total, item) => total + getSizePrice(item) * item.quantity, 0);

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
    if (method === "card") {
      if (!form.cardName.trim()) e.cardName = "Cardholder name required";
      if (!form.cardNumber.trim()) e.cardNumber = "Card number required";
      else if (!/^\d{16}$/.test(form.cardNumber.replace(/\s/g, ""))) e.cardNumber = "Must be 16 digits";
      if (!form.expiry.trim()) e.expiry = "Expiry required";
      else if (!/^\d{2}\/\d{2}$/.test(form.expiry)) e.expiry = "Format: MM/YY";
      if (!form.cvv.trim()) e.cvv = "CVV required";
      else if (!/^\d{3,4}$/.test(form.cvv)) e.cvv = "CVV must be 3-4 digits";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
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

    try {
      const res          = await fetch(`${BASE_URL}/placeorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ items: payload, total, deliveryInfo, paymentMethod: method }),
      });
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } catch {
        Alert.alert("Server Error", `Status ${res.status}: ${responseText}`); return;
      }
      if (data.success) {
        clearCart();
        navigation.reset({ index: 0, routes: [{ name: "CartScreen", params: undefined }] });
        navigation.navigate("Orders", { orderNumber: data.orderNumber, purchasedItems: payload });
      } else {
        Alert.alert("Order Failed", data.error || data.message || JSON.stringify(data));
      }
    } catch (err) {
      Alert.alert("Network Error", err.message || "Could not place order");
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
            <ActivityIndicator size="small" color="#555" />
            <Text style={s.loadingText}>Loading {label.toLowerCase()}…</Text>
          </View>
        ) : (
          <Picker
            style={s.picker}
            dropdownIconColor="#666"
            selectedValue={form[field]}
            onValueChange={(v) => handleChange(field, v)}
            enabled={enabled && !loading}
          >
            <Picker.Item label={`Select ${label}`} value="" color="#555" />
            {items.map((item) => (
              <Picker.Item key={item.code} label={item.name} value={item.code} color="#fff" />
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
              placeholderTextColor="#3A3A3A"
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
              placeholderTextColor="#3A3A3A"
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
            placeholderTextColor="#3A3A3A"
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
            placeholderTextColor="#3A3A3A"
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
              <Picker style={s.picker} selectedValue={NCR_REGION_CODE} enabled={false} dropdownIconColor="#666">
                <Picker.Item label="Metro Manila" value={NCR_REGION_CODE} color="#fff" />
              </Picker>
            ) : loadingProvinces ? (
              <View style={s.pickerLoading}>
                <ActivityIndicator size="small" color="#555" />
                <Text style={s.loadingText}>Loading provinces…</Text>
              </View>
            ) : (
              <Picker
                style={s.picker}
                dropdownIconColor="#666"
                selectedValue={form.province}
                onValueChange={(v) => handleChange("province", v)}
                enabled={!!form.region && !loadingProvinces}
              >
                <Picker.Item label="Select Province" value="" color="#555" />
                {provinces.map((p) => (
                  <Picker.Item key={p.code} label={p.name} value={p.code} color="#fff" />
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
            placeholderTextColor="#3A3A3A"
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
            { key: "card", label: "CARD" },
            { key: "gcash", label: "GCASH" },
            { key: "cod",   label: "Cash on Delivery" },
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

        {/* Card details */}
        {method === "card" && (
          <View style={s.cardDetails}>
            <View style={s.fieldGroup}>
              <Label text="Cardholder Name" />
              <TextInput
                style={[s.input, errors.cardName && s.inputError]}
                value={form.cardName}
                onChangeText={(v) => handleChange("cardName", v)}
                placeholder="Name on card"
                placeholderTextColor="#3A3A3A"
              />
              <FieldError msg={errors.cardName} />
            </View>
            <View style={s.fieldGroup}>
              <Label text="Card Number" />
              <TextInput
                style={[s.input, errors.cardNumber && s.inputError]}
                value={form.cardNumber}
                onChangeText={(v) => handleChange("cardNumber", v)}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor="#3A3A3A"
                keyboardType="number-pad"
                maxLength={19}
              />
              <FieldError msg={errors.cardNumber} />
            </View>
            <View style={s.row}>
              <View style={[s.fieldGroup, { flex: 1 }]}>
                <Label text="Expiry (MM/YY)" />
                <TextInput
                  style={[s.input, errors.expiry && s.inputError]}
                  value={form.expiry}
                  onChangeText={(v) => handleChange("expiry", v)}
                  placeholder="MM/YY"
                  placeholderTextColor="#3A3A3A"
                  maxLength={5}
                />
                <FieldError msg={errors.expiry} />
              </View>
              <View style={[s.fieldGroup, { flex: 1 }]}>
                <Label text="CVV" />
                <TextInput
                  style={[s.input, errors.cvv && s.inputError]}
                  value={form.cvv}
                  onChangeText={(v) => handleChange("cvv", v)}
                  placeholder="•••"
                  placeholderTextColor="#3A3A3A"
                  secureTextEntry
                  maxLength={4}
                  keyboardType="number-pad"
                />
                <FieldError msg={errors.cvv} />
              </View>
            </View>
          </View>
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

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmount}>₱{calculateTotal().toLocaleString()}</Text>
        </View>
      </View>

      {/* ── PLACE ORDER CTA ── */}
      <TouchableOpacity style={s.ctaBtn} onPress={handlePlaceOrder} activeOpacity={0.88}>
        <Text style={s.ctaText}>PLACE ORDER</Text>
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES  — dark premium matching ProductDetailScreen vibe
═══════════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#080808" },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },

  /* ── nav ── */
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backArrow: { color: "#FFFFFF", fontSize: 20, fontWeight: "300" },
  backLabel: { color: "#888",    fontSize: 14, fontWeight: "500" },

  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.4,
    marginBottom: 20,
  },

  /* ── section card ── */
  sectionCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
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
    fontWeight: "700",
    letterSpacing: 2,
    color: "#666",
    textTransform: "uppercase",
  },

  /* ── saved address ── */
  savedBlock: { marginBottom: 16 },
  savedToggleBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: "#141414",
  },
  savedToggleText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.5 },
  savedList: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    overflow: "hidden",
  },
  savedItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    backgroundColor: "#131313",
    gap: 2,
  },
  savedName:  { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  savedMeta:  { fontSize: 12, color: "#555" },
  savedPhone: { fontSize: 12, color: "#888", marginTop: 2 },

  /* ── form ── */
  row:       { flexDirection: "row", gap: 10 },
  fieldGroup:{ marginBottom: 14 },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#555",
    marginBottom: 7,
    textTransform: "uppercase",
  },

  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: isSmall ? 12 : 14,
    fontSize: 14,
    color: "#FFFFFF",
  },
  inputError: { borderColor: "#E84A4A" },
  errorText:  { fontSize: 11, color: "#E84A4A", marginTop: 5, letterSpacing: 0.3 },

  /* ── pickers ── */
  pickerWrapper: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 10,
    overflow: "hidden",
  },
  pickerDisabled: { backgroundColor: "#0D0D0D", opacity: 0.5 },
  picker:         { height: 50, width: "100%", color: "#FFFFFF" },
  pickerLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: "#555" },

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
    borderColor: "#2E2E2E",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141414",
  },
  checkboxOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  checkmark:  { color: "#000", fontSize: 13, fontWeight: "800" },
  checkLabel: { fontSize: 13, color: "#666", flex: 1 },

  /* ── payment methods ── */
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#141414",
  },
  methodChipActive:     { borderColor: "#FFFFFF", backgroundColor: "#FFFFFF" },
  methodChipText:       { fontSize: 12, fontWeight: "700", color: "#555", letterSpacing: 0.5 },
  methodChipTextActive: { color: "#000" },

  /* ── card details ── */
  cardDetails: {
    marginTop: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 14,
    gap: 0,
  },

  /* ── order summary ── */
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#141414",
    gap: 10,
  },
  summaryLeft:  { flex: 1, gap: 3 },
  summaryName:  { fontSize: 13, fontWeight: "600", color: "#CCCCCC" },
  summarySize:  { fontSize: 11, color: "#444", letterSpacing: 0.5 },
  summaryRight: { alignItems: "flex-end", gap: 2 },
  summaryQty:   { fontSize: 11, color: "#555" },
  summaryPrice: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  divider: { height: 1, backgroundColor: "#141414", marginVertical: 14 },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel:  { fontSize: 13, fontWeight: "700", color: "#666", letterSpacing: 1 },
  totalAmount: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.3 },

  /* ── CTA ── */
  ctaBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 6,
  },
  ctaText: {
    color: "#000000",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 3,
  },
});