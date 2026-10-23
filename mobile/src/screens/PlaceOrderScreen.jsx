import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BASE_URL } from "../api/config";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Modal,
  Linking,
  AppState,
  Animated,
  Easing,
  FlatList,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "../utils/customAlert";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getShippingFee, getShippingTier } from "../services/shippingFee";
import { fonts, radius, shadows, typography } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const NCR_REGION_CODE = "1300000000";
const MANILA_CITY_CODE = "1380600000";
const MANILA_GITLAB_CODE = "133900000";
const { width } = Dimensions.get("window");
const isSmall  = width < 380;
const isTablet = width > 768;

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */

// Converts a legacy 09XXXXXXXXX (or bare 10-digit) number into the
// +63XXXXXXXXXX format the register form now produces, so a saved address
// loaded back into this field doesn't show a mismatched prefix. Leaves an
// already-+63 value alone, defaults an empty one to the bare prefix.
// Matches web's PlaceOrder.jsx exactly.
const normalizePhone = (raw) => {
  const value = (raw || "").trim();
  if (value.startsWith("+63")) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return "+63" + digits.slice(1);
  if (digits.length === 10) return "+63" + digits;
  if (!digits) return "+63";
  return value;
};

// PSGC returns UTF-8 bytes but RN's HTTP layer sometimes decodes them as
// Latin-1, turning "ñ" (0xC3 0xB1) into "Ã±" ("Parañaque" → "ParaÃ±aque",
// "Las Piñas" → "Las PiÃ±as"). Reinterpret each char as its byte value and
// UTF-8-decode; if the platform lacks TextDecoder, fall back to targeted
// replacements for the Spanish chars actually present in PH place names.
const decodeMojibake = (str) => {
  if (!str || typeof str !== "string") return str;
  if (!/Ã[\x80-\xBF]/.test(str)) return str;
  if (typeof TextDecoder !== "undefined") {
    try {
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
      return new TextDecoder("utf-8").decode(bytes);
    } catch {}
  }
  return str
    .replace(/Ã±/g, "ñ").replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í").replace(/Ã³/g, "ó").replace(/Ãº/g, "ú")
    .replace(/Ã/g, "Á").replace(/Ã‰/g, "É").replace(/Ã/g, "Í").replace(/Ã“/g, "Ó").replace(/Ãš/g, "Ú");
};

const naturalSortByName = (list) =>
  [...list].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })
  );

const fixList = (list) =>
  (Array.isArray(list) ? list : []).map((it) => ({
    ...it,
    code: String(it?.psgc10DigitCode || it?.code || ""),
    name: decodeMojibake(it?.name || ""),
  }));

const getLocName = (loc) => {
  if (!loc) return "";
  if (typeof loc === "string") return decodeMojibake(loc.trim());
  return decodeMojibake(String(loc.name || "").trim());
};

const getLocCode = (loc) => {
  if (!loc) return "";
  if (typeof loc === "string") return "";
  return String(loc.code || "").trim();
};

const codesMatch = (a, b) => {
  const ca = String(a || "").trim();
  const cb = String(b || "").trim();
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if ((ca === MANILA_CITY_CODE && cb === MANILA_GITLAB_CODE) || (ca === MANILA_GITLAB_CODE && cb === MANILA_CITY_CODE)) {
    return true;
  }
  // 10-digit vs 9-digit PSGC code comparison (e.g. Manila barangays 1380601001 vs 133901001)
  if (ca.startsWith("13806") && cb.startsWith("1339") && ca.slice(5) === cb.slice(4)) return true;
  if (cb.startsWith("13806") && ca.startsWith("1339") && cb.slice(5) === ca.slice(4)) return true;
  return false;
};

// Fetches barangays for a given city/municipality code, with direct support for
// City of Manila (1380600000) where psgc.cloud's city barangay endpoint returns [].
const fetchBarangaysForCity = async (cityCode) => {
  if (!cityCode) return [];
  const codeStr = String(cityCode).trim();
  const isManila = codeStr === MANILA_CITY_CODE || codeStr === MANILA_GITLAB_CODE;

  // For City of Manila, psgc.cloud/api/cities-municipalities/1380600000/barangays returns [].
  // Fetch directly from psgc.gitlab.io (all 897 barangays in one fast request) or NCR sub-municipalities.
  if (isManila) {
    try {
      const manilaRes = await axios.get(
        `https://psgc.gitlab.io/api/cities-municipalities/${MANILA_GITLAB_CODE}/barangays.json`
      );
      if (Array.isArray(manilaRes.data) && manilaRes.data.length > 0) {
        return naturalSortByName(fixList(manilaRes.data));
      }
    } catch {}

    try {
      const subRes = await axios.get(`https://psgc.cloud/api/regions/${NCR_REGION_CODE}/sub-municipalities`);
      if (Array.isArray(subRes.data) && subRes.data.length > 0) {
        const allBrgys = await Promise.all(
          subRes.data.map((sub) =>
            axios
              .get(`https://psgc.cloud/api/sub-municipalities/${encodeURIComponent(sub.code)}/barangays`)
              .then((r) => (Array.isArray(r.data) ? r.data : []))
              .catch(() => [])
          )
        );
        const flattened = allBrgys.flat();
        if (flattened.length > 0) {
          return naturalSortByName(fixList(flattened));
        }
      }
    } catch {}
  }

  // Standard PSGC cities-municipalities endpoint
  try {
    const res = await axios.get(
      `https://psgc.cloud/api/cities-municipalities/${encodeURIComponent(codeStr)}/barangays`
    );
    if (Array.isArray(res.data) && res.data.length > 0) {
      return naturalSortByName(fixList(res.data));
    }
  } catch {}

  // Fallback: psgc.gitlab.io static JSON API
  try {
    const gitlabCode = isManila ? MANILA_GITLAB_CODE : codeStr.slice(0, 9);
    const fallbackRes = await axios.get(
      `https://psgc.gitlab.io/api/cities-municipalities/${encodeURIComponent(gitlabCode)}/barangays.json`
    );
    if (Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
      return naturalSortByName(fixList(fallbackRes.data));
    }
  } catch {}

  return [];
};

const Label = ({ text, s }) => <Text style={s.label}>{text}</Text>;

const FieldError = ({ msg, s }) =>
  msg ? <Text style={s.errorText}>⚠ {msg}</Text> : null;

const Divider = ({ s }) => <View style={s.divider} />;

function Dropdown({
  label,
  value,
  items,
  onSelect,
  placeholder = "Select…",
  enabled = true,
  loading = false,
  error,
  s,
  colors,
}) {
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const backdropFade = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    if (!enabled || loading) return;
    setOpen(true);
  };

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(backdropFade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const closeSheet = (cb) => {
    Animated.parallel([
      Animated.timing(backdropFade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(fade,         { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale,        { toValue: 0.96, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      if (typeof cb === "function") cb();
    });
  };

  const selectedItem = items.find((i) => codesMatch(i.value, value));
  const displayText = selectedItem ? selectedItem.label : placeholder;
  const isPlaceholder = !selectedItem;

  return (
    <View style={s.fieldGroup}>
      <Label text={label} s={s} />
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={openSheet}
        disabled={!enabled || loading}
        style={[
          s.dropdownField,
          (!enabled || loading) && s.dropdownFieldDisabled,
          error && s.inputError,
        ]}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={s.loadingText}>Loading {label.toLowerCase()}…</Text>
          </View>
        ) : (
          <Text
            style={[s.dropdownText, isPlaceholder && s.dropdownPlaceholder]}
            numberOfLines={1}
          >
            {displayText}
          </Text>
        )}
        <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
      </TouchableOpacity>
      <FieldError msg={error} s={s} />

      <Modal visible={open} transparent animationType="none" onRequestClose={() => closeSheet()}>
        <Animated.View style={[s.dropdownBackdrop, { opacity: backdropFade }]}>
          <Pressable style={{ flex: 1 }} onPress={() => closeSheet()} />
        </Animated.View>

        <View pointerEvents="box-none" style={s.dropdownSheetContainer}>
          <Animated.View
            style={[
              s.dropdownSheet,
              { opacity: fade, transform: [{ scale }] },
            ]}
          >
            <View style={s.dropdownSheetHeader}>
              <Text style={s.dropdownSheetTitle}>{label.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => closeSheet()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={items}
              keyExtractor={(it, idx) => `${it.value}_${idx}`}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={s.dropdownItemSep} />}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={s.loadingText}>No options available</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSel = codesMatch(item.value, value);
                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[s.dropdownItem, isSel && s.dropdownItemSelected]}
                    onPress={() => closeSheet(() => onSelect(item.value))}
                  >
                    <Text style={[s.dropdownItemText, isSel && s.dropdownItemTextSelected]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isSel && <Ionicons name="checkmark" size={18} color={colors.accentGold} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════════════════════ */

export default function PlaceOrderScreen({ navigation, route }) {
  const { cart, clearCart } = useCart();
  const { userToken }       = useAuth();
  const { colors, isDark }  = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const placeholderColor = isDark ? "rgba(255,255,255,0.48)" : colors.textMuted;

  // "Buy Now" from ProductDetail passes a single item here directly,
  // bypassing the cart entirely — checkout works off that instead of the
  // real cart, and clearCart() never runs since nothing was added to it.
  const buyNowItem = route?.params?.buyNowItem || null;
  const items = buyNowItem ? [buyNowItem] : cart;

  const [method, setMethod] = useState("online");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", street: "", phone: "+63",
    region: "", province: "", city: "", barangay: "",
  });

  // Fallback names loaded from a saved address in case an API list is still loading or codes differ slightly
  const [savedNamesFallback, setSavedNamesFallback] = useState({
    region: "", province: "", city: "", barangay: "",
  });

  const [placingOrder, setPlacingOrder] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingOrderNumber, setPendingOrderNumber] = useState(null);
  const pendingOrderRef = useRef(null);

  // Prevents the cascading fetch effects from overwriting lists that useSavedAddress just loaded.
  const applyingSavedRef = useRef(false);

  // Inline edit state for saved addresses in the checkout dropdown (matches web's PlaceOrder.jsx)
  const [editingIndex, setEditingIndex] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editProvinces, setEditProvinces] = useState([]);
  const [editCities, setEditCities] = useState([]);
  const [editBarangays, setEditBarangays] = useState([]);
  const [editHasProvinces, setEditHasProvinces] = useState(true);
  const [editLoading, setEditLoading] = useState({
    provinces: false, cities: false, barangays: false, saving: false,
  });

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

  const [appliedVoucher,     setAppliedVoucher]     = useState(null);
  const [voucherOpen,        setVoucherOpen]        = useState(false);
  const [vouchers,           setVouchers]           = useState([]);
  const [loadingVouchers,    setLoadingVouchers]    = useState(false);
  const [applyingCode,       setApplyingCode]       = useState(null);
  const [voucherError,       setVoucherError]       = useState("");

  const [errors,             setErrors]             = useState({});
  const [saveAddress,        setSaveAddress]        = useState(false);
  const [savedAddresses,     setSavedAddresses]     = useState([]);
  const [showAddressDropdown,setShowAddressDropdown]= useState(false);

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
  const findName = (list, code, fallback = "") => {
    if (!code) return fallback;
    if (Array.isArray(list)) {
      const found = list.find((item) => codesMatch(item.code, code));
      if (found && found.name) return found.name;
    }
    return fallback;
  };

  // Auto-detect if the current address (street + city/municipality + barangay) is already in savedAddresses
  // Matches web's PlaceOrder.jsx and backend's saveAddress check.
  const isAddressAlreadySaved = useMemo(() => {
    if (
      !savedAddresses.length ||
      !form.street.trim() ||
      !form.city ||
      !form.barangay
    ) {
      return false;
    }
    const norm = (str) => decodeMojibake(str || "").trim().toLowerCase();
    const currentStreet   = norm(form.street);
    const currentCityName = norm(findName(cities, form.city, savedNamesFallback.city));
    const currentBrgyName = norm(findName(barangays, form.barangay, savedNamesFallback.barangay));

    return savedAddresses.some((addr) => {
      if (norm(addr.street) !== currentStreet) return false;

      const addrCityCode = getLocCode(addr.cityOrMunicipality) || getLocCode(addr.city);
      const addrCityName = norm(getLocName(addr.cityOrMunicipality) || getLocName(addr.city));
      const addrBrgyCode = getLocCode(addr.barangay);
      const addrBrgyName = norm(getLocName(addr.barangay));

      const cityMatch =
        codesMatch(addrCityCode, form.city) ||
        (currentCityName && addrCityName && addrCityName === currentCityName);
      const brgyMatch =
        codesMatch(addrBrgyCode, form.barangay) ||
        (currentBrgyName && addrBrgyName && addrBrgyName === currentBrgyName);

      return cityMatch && brgyMatch;
    });
  }, [form.street, form.city, form.barangay, savedAddresses, cities, barangays, savedNamesFallback]);

  // Automatically uncheck saveAddress when the current form matches a saved address
  useEffect(() => {
    if (isAddressAlreadySaved && saveAddress) {
      setSaveAddress(false);
    }
  }, [isAddressAlreadySaved, saveAddress]);

  const getSizePrice = (item) => {
    const sizeKey  = item?.selectedSize || item?.size;
    const sizeData = sizeKey ? item?.sizes?.[sizeKey] : undefined;
    if (typeof sizeData === "object" && sizeData?.price !== undefined) return Number(sizeData.price) || 0;
    if (typeof sizeData === "number" || typeof sizeData === "string") return Number(sizeData) || 0;
    return Number(item?.new_price) || Number(item?.price) || 0;
  };

  const calculateSubtotal = () =>
    items.reduce((total, item) => total + getSizePrice(item) * item.quantity, 0);

  const shippingFee  = getShippingFee(form.region);
  const shippingTier = getShippingTier(form.region);

  const calculateTotal = () =>
    Math.max(0, calculateSubtotal() - (appliedVoucher?.discountAmount || 0)) + shippingFee;

  /* ── vouchers ── */
  const fetchVouchers = async () => {
    if (!userToken) return;
    setLoadingVouchers(true);
    try {
      const res  = await fetch(`${BASE_URL}/my-vouchers`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) setVouchers(data.vouchers || []);
    } catch {} finally {
      setLoadingVouchers(false);
    }
  };

  const toggleVoucherPanel = () => {
    const next = !voucherOpen;
    setVoucherOpen(next);
    if (next) fetchVouchers();
  };

  const handleApplyVoucher = async (code) => {
    if (applyingCode) return;
    setVoucherError("");
    setApplyingCode(code);
    try {
      const res  = await fetch(`${BASE_URL}/apply-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": userToken || "" },
        body: JSON.stringify({ code, subtotal: calculateSubtotal() }),
      });
      const data = await res.json();
      if (data.success) {
        setAppliedVoucher({
          code,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          voucher: data.voucher,
        });
        setVoucherOpen(false);
      } else {
        setVoucherError(data.error || "Could not apply voucher.");
      }
    } catch {
      setVoucherError("Network error. Please try again.");
    } finally {
      setApplyingCode(null);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherError("");
    setAppliedVoucher(null);
  };

  /* ── hydrate saved addresses that were saved with missing city/barangay names ── */
  const hydrateMissingAddressNames = useCallback(async (rawList) => {
    if (!Array.isArray(rawList) || !rawList.length) return;
    let changed = false;
    const updated = await Promise.all(
      rawList.map(async (addr, idx) => {
        const rCode = getLocCode(addr.region);
        const pCode = getLocCode(addr.province);
        const cCode = getLocCode(addr.cityOrMunicipality) || getLocCode(addr.city);
        const bCode = getLocCode(addr.barangay);

        let rName = getLocName(addr.region);
        let pName = getLocName(addr.province);
        let cName = getLocName(addr.cityOrMunicipality) || getLocName(addr.city);
        let bName = getLocName(addr.barangay);

        if ((cCode && !cName) || (bCode && !bName)) {
          const isNCR = rCode === NCR_REGION_CODE;
          if (cCode && !cName && (rCode || pCode)) {
            try {
              const url = isNCR
                ? `https://psgc.cloud/api/regions/${encodeURIComponent(rCode)}/cities-municipalities`
                : `https://psgc.cloud/api/provinces/${encodeURIComponent(pCode)}/cities-municipalities`;
              const res = await axios.get(url);
              const list = fixList(res.data);
              const found = list.find((c) => codesMatch(c.code, cCode));
              if (found?.name) cName = found.name;
            } catch {}
          }
          if (bCode && !bName && cCode) {
            try {
              const bList = await fetchBarangaysForCity(cCode);
              const found = bList.find((b) => codesMatch(b.code, bCode));
              if (found?.name) bName = found.name;
            } catch {}
          }
          if (cName || bName) {
            changed = true;
            const nextAddr = {
              ...addr,
              region: { code: rCode, name: rName },
              province: { code: pCode || (isNCR ? NCR_REGION_CODE : ""), name: pName || (isNCR ? "Metro Manila" : "") },
              cityOrMunicipality: { code: cCode, name: cName },
              barangay: { code: bCode, name: bName },
            };
            if (userToken) {
              fetch(`${BASE_URL}/updateaddress/${idx}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "auth-token": userToken },
                body: JSON.stringify(nextAddr),
              }).catch(() => {});
            }
            return nextAddr;
          }
        }
        return addr;
      })
    );
    if (changed) {
      setSavedAddresses(updated);
    }
  }, [userToken]);

  const loadSavedAddresses = useCallback(async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/getsavedaddresses`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) {
        const list = data.addresses || [];
        setSavedAddresses(list);
        hydrateMissingAddressNames(list);
      }
    } catch {}
  }, [userToken, hydrateMissingAddressNames]);

  /* ── mount & focus ── */
  useEffect(() => {
    setLoadingRegions(true);
    axios.get("https://psgc.cloud/api/regions")
      .then((res) => setRegions(fixList(res.data)))
      .catch(() => setRegions([]))
      .finally(() => setLoadingRegions(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedAddresses();
    }, [loadSavedAddresses])
  );

  /* ── region → provinces (fetch only; never wipes form fields) ── */
  useEffect(() => {
    if (applyingSavedRef.current) return;
    if (!form.region) {
      setHasProvinces(true);
      setProvinces([]);
      return;
    }
    const isNCR = String(form.region) === NCR_REGION_CODE;
    setHasProvinces(!isNCR);
    if (!isNCR) {
      setLoadingProvinces(true);
      axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(form.region)}/provinces`)
        .then((res) => setProvinces(naturalSortByName(fixList(res.data))))
        .catch(() => setProvinces([]))
        .finally(() => setLoadingProvinces(false));
    } else {
      setProvinces([]);
    }
  }, [form.region]);

  /* ── province / NCR → cities (fetch only; never wipes form fields) ── */
  useEffect(() => {
    if (applyingSavedRef.current) return;
    if (!form.region) {
      setCities([]);
      return;
    }
    const isNCR = String(form.region) === NCR_REGION_CODE;
    if (!isNCR && !form.province) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    const url = !isNCR
      ? `https://psgc.cloud/api/provinces/${encodeURIComponent(form.province)}/cities-municipalities`
      : `https://psgc.cloud/api/regions/${encodeURIComponent(form.region)}/cities-municipalities`;
    axios.get(url)
      .then((res) => setCities(naturalSortByName(fixList(res.data))))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [form.province, form.region]);

  /* ── city → barangays (fetch only; never wipes form fields) ── */
  useEffect(() => {
    if (applyingSavedRef.current) return;
    if (!form.city) {
      setBarangays([]);
      return;
    }
    setLoadingBarangays(true);
    fetchBarangaysForCity(form.city)
      .then((list) => setBarangays(list))
      .finally(() => setLoadingBarangays(false));
  }, [form.city]);

  /* ── input handler (resets child dropdowns only on explicit user change, matching web) ── */
  const handleChange = (name, value) => {
    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[0-9]/g, "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "").slice(0, 54);
    } else if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits.replace(/^6?3?/, "");
      digits = digits.slice(0, 12);
      value = "+" + digits;
    }

    if (name === "region") {
      const isNCR = String(value) === NCR_REGION_CODE;
      setHasProvinces(!isNCR);
      setProvinces([]);
      setCities([]);
      setBarangays([]);
      setSavedNamesFallback({ region: "", province: "", city: "", barangay: "" });
      setForm((prev) => ({
        ...prev,
        region: value,
        province: isNCR ? NCR_REGION_CODE : "",
        city: "",
        barangay: "",
      }));
      setErrors((prev) => ({ ...prev, region: "", province: "", city: "", barangay: "" }));
      return;
    }

    if (name === "province") {
      setCities([]);
      setBarangays([]);
      setSavedNamesFallback((prev) => ({ ...prev, province: "", city: "", barangay: "" }));
      setForm((prev) => ({ ...prev, province: value, city: "", barangay: "" }));
      setErrors((prev) => ({ ...prev, province: "", city: "", barangay: "" }));
      return;
    }

    if (name === "city") {
      setBarangays([]);
      setSavedNamesFallback((prev) => ({ ...prev, city: "", barangay: "" }));
      setForm((prev) => ({ ...prev, city: value, barangay: "" }));
      setErrors((prev) => ({ ...prev, city: "", barangay: "" }));
      return;
    }

    if (name === "barangay") {
      setSavedNamesFallback((prev) => ({ ...prev, barangay: "" }));
    }

    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  /* ── inline saved-address editing (matches web's PlaceOrder.jsx) ── */
  const startEditAddress = async (idx) => {
    const addr = savedAddresses[idx];
    if (!addr) return;
    const rCode = getLocCode(addr.region);
    const pCode = getLocCode(addr.province);
    const cCode = getLocCode(addr.cityOrMunicipality) || getLocCode(addr.city);
    const bCode = getLocCode(addr.barangay);
    const rName = getLocName(addr.region);
    const pName = getLocName(addr.province);
    const cName = getLocName(addr.cityOrMunicipality) || getLocName(addr.city);
    const bName = getLocName(addr.barangay);

    const resolvedRCode =
      regions.find((r) => codesMatch(r.code, rCode))?.code ||
      regions.find((r) => (r.name || "").toLowerCase() === rName.toLowerCase())?.code ||
      rCode;
    const isNCR = String(resolvedRCode) === NCR_REGION_CODE;

    setEditHasProvinces(!isNCR);
    setEditingIndex(idx);
    setEditFormData({
      firstName: addr.firstName || "",
      lastName: addr.lastName || "",
      email: addr.email || "",
      street: addr.street || "",
      phone: normalizePhone(addr.phone || ""),
      region: resolvedRCode,
      province: isNCR ? NCR_REGION_CODE : pCode,
      cityOrMunicipality: cCode,
      barangay: bCode,
    });

    setEditLoading({ provinces: !isNCR && !!resolvedRCode, cities: !!resolvedRCode, barangays: !!cCode, saving: false });
    try {
      let provList = [];
      if (!isNCR && resolvedRCode) {
        const pRes = await axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(resolvedRCode)}/provinces`);
        provList = naturalSortByName(fixList(pRes.data));
      }
      setEditProvinces(provList);

      const resolvedPCode = isNCR
        ? NCR_REGION_CODE
        : (provList.find((p) => codesMatch(p.code, pCode))?.code ||
           provList.find((p) => (p.name || "").toLowerCase() === pName.toLowerCase())?.code ||
           pCode);

      let cityList = [];
      const pOrR = isNCR ? resolvedRCode : resolvedPCode;
      if (pOrR) {
        const cityUrl = isNCR
          ? `https://psgc.cloud/api/regions/${encodeURIComponent(pOrR)}/cities-municipalities`
          : `https://psgc.cloud/api/provinces/${encodeURIComponent(pOrR)}/cities-municipalities`;
        const cRes = await axios.get(cityUrl);
        cityList = naturalSortByName(fixList(cRes.data));
      }

      const resolvedCCode =
        cityList.find((c) => codesMatch(c.code, cCode))?.code ||
        cityList.find((c) => (c.name || "").toLowerCase() === cName.toLowerCase())?.code ||
        cCode;
      if (resolvedCCode && cName && !cityList.some((c) => codesMatch(c.code, resolvedCCode))) {
        cityList = [...cityList, { code: resolvedCCode, name: cName }];
      }
      setEditCities(cityList);

      let brgyList = [];
      if (resolvedCCode) {
        brgyList = await fetchBarangaysForCity(resolvedCCode);
      }
      const resolvedBCode =
        brgyList.find((b) => codesMatch(b.code, bCode))?.code ||
        brgyList.find((b) => (b.name || "").toLowerCase() === bName.toLowerCase())?.code ||
        bCode;
      if (resolvedBCode && bName && !brgyList.some((b) => codesMatch(b.code, resolvedBCode))) {
        brgyList = [...brgyList, { code: resolvedBCode, name: bName }];
      }
      setEditBarangays(brgyList);

      setEditFormData((prev) =>
        prev
          ? {
              ...prev,
              province: resolvedPCode,
              cityOrMunicipality: String(resolvedCCode || ""),
              barangay: String(resolvedBCode || ""),
            }
          : prev
      );
    } catch {} finally {
      setEditLoading({ provinces: false, cities: false, barangays: false, saving: false });
    }
  };

  const handleEditChange = async (name, value) => {
    if (name === "firstName" || name === "lastName") {
      value = value.replace(/[0-9]/g, "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "").slice(0, 54);
      setEditFormData((p) => ({ ...p, [name]: value }));
      return;
    }
    if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits.replace(/^6?3?/, "");
      digits = digits.slice(0, 12);
      setEditFormData((p) => ({ ...p, phone: "+" + digits }));
      return;
    }
    if (name === "region") {
      const isNCR = String(value) === NCR_REGION_CODE;
      setEditHasProvinces(!isNCR);
      setEditProvinces([]);
      setEditCities([]);
      setEditBarangays([]);
      setEditFormData((p) => ({
        ...p,
        region: value,
        province: isNCR ? NCR_REGION_CODE : "",
        cityOrMunicipality: "",
        barangay: "",
      }));
      if (isNCR) {
        setEditLoading((p) => ({ ...p, cities: true }));
        try {
          const res = await axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(value)}/cities-municipalities`);
          setEditCities(naturalSortByName(fixList(res.data)));
        } catch {} finally {
          setEditLoading((p) => ({ ...p, cities: false }));
        }
      } else if (value) {
        setEditLoading((p) => ({ ...p, provinces: true }));
        try {
          const res = await axios.get(`https://psgc.cloud/api/regions/${encodeURIComponent(value)}/provinces`);
          setEditProvinces(naturalSortByName(fixList(res.data)));
        } catch {} finally {
          setEditLoading((p) => ({ ...p, provinces: false }));
        }
      }
      return;
    }
    if (name === "province") {
      setEditCities([]);
      setEditBarangays([]);
      setEditFormData((p) => ({ ...p, province: value, cityOrMunicipality: "", barangay: "" }));
      if (value) {
        setEditLoading((p) => ({ ...p, cities: true }));
        try {
          const res = await axios.get(`https://psgc.cloud/api/provinces/${encodeURIComponent(value)}/cities-municipalities`);
          setEditCities(naturalSortByName(fixList(res.data)));
        } catch {} finally {
          setEditLoading((p) => ({ ...p, cities: false }));
        }
      }
      return;
    }
    if (name === "cityOrMunicipality") {
      setEditBarangays([]);
      setEditFormData((p) => ({ ...p, cityOrMunicipality: value, barangay: "" }));
      if (value) {
        setEditLoading((p) => ({ ...p, barangays: true }));
        try {
          const list = await fetchBarangaysForCity(value);
          setEditBarangays(list);
        } catch {} finally {
          setEditLoading((p) => ({ ...p, barangays: false }));
        }
      }
      return;
    }
    setEditFormData((p) => ({ ...p, [name]: value }));
  };

  const saveEditedAddress = async () => {
    if (!userToken || editingIndex === null || !editFormData) return;
    if (
      !editFormData.firstName.trim() ||
      !editFormData.lastName.trim() ||
      !editFormData.email.trim() ||
      !editFormData.street.trim() ||
      !editFormData.region ||
      (editHasProvinces && !editFormData.province) ||
      !editFormData.cityOrMunicipality ||
      !editFormData.barangay ||
      !/^\+63\d{10}$/.test(editFormData.phone || "")
    ) {
      Alert.alert("Incomplete", "Please complete all address fields including City / Municipality and Barangay.");
      return;
    }
    setEditLoading((p) => ({ ...p, saving: true }));
    try {
      const current = savedAddresses[editingIndex] || {};
      const payload = {
        firstName: editFormData.firstName.trim(),
        lastName: editFormData.lastName.trim(),
        email: editFormData.email.trim(),
        street: editFormData.street.trim(),
        phone: editFormData.phone.trim(),
        region: {
          code: editFormData.region,
          name: findName(regions, editFormData.region, getLocName(current.region)),
        },
        province: editHasProvinces
          ? {
              code: editFormData.province,
              name: findName(editProvinces, editFormData.province, getLocName(current.province)),
            }
          : { code: editFormData.region, name: "Metro Manila" },
        cityOrMunicipality: {
          code: editFormData.cityOrMunicipality,
          name: findName(
            editCities,
            editFormData.cityOrMunicipality,
            getLocName(current.cityOrMunicipality) || getLocName(current.city)
          ),
        },
        barangay: {
          code: editFormData.barangay,
          name: findName(editBarangays, editFormData.barangay, getLocName(current.barangay)),
        },
      };
      const res = await fetch(`${BASE_URL}/updateaddress/${editingIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSavedAddresses(data.addresses || []);
        setEditingIndex(null);
        setEditFormData(null);
      } else {
        Alert.alert("Error", data.error || "Failed to update address.");
      }
    } catch {
      Alert.alert("Network Error", "Failed to update address.");
    } finally {
      setEditLoading((p) => ({ ...p, saving: false }));
    }
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
    if (!/^\+63\d{10}$/.test(form.phone || "")) e.phone = "Phone number must start with +63 and be followed by exactly 10 digits.";
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

  const goToOrders = (orderNumber, purchasedItems = []) => {
    navigation.reset({ index: 0, routes: [{ name: "CartScreen", params: undefined }] });
    navigation.navigate("Orders", { orderNumber, purchasedItems });
  };

  const finalizePayment = async (orderNumber) => {
    setPendingOrderNumber(null);
    setVerifying(true);
    let paid = false;
    let purchasedItems = [];
    try {
      await fetch(`${BASE_URL}/payment/verify/${orderNumber}`, {
        headers: { "auth-token": userToken || "" },
      });

      const orderRes = await fetch(`${BASE_URL}/order/${orderNumber}`, {
        headers: { "auth-token": userToken || "" },
      });
      const orderData = await orderRes.json();
      if (orderData.success) {
        paid = orderData.order.paymentStatus === "paid";
        purchasedItems = orderData.order.items || [];
      }
    } catch {}
    setVerifying(false);

    if (paid) {
      goToOrders(orderNumber, purchasedItems);
    } else {
      Alert.alert("Payment Not Completed", "We couldn't confirm your payment. You can retry from Order History.");
      navigation.reset({ index: 0, routes: [{ name: "CartScreen", params: undefined }] });
      navigation.navigate("Profile", { screen: "OrderHistory" });
    }
  };

  /* ── place order ── */
  const handlePlaceOrder = async () => {
    if (!validate()) { Alert.alert("Incomplete", "Please fill in all required fields correctly."); return; }
    if (!items.length) { Alert.alert("Empty Cart", "Your cart is empty!"); return; }

    const payload = items.filter((i) => i.quantity > 0).map((item) => ({
      id: item.id, name: item.name, image: item.image,
      price: getSizePrice(item), quantity: item.quantity,
      size: item.selectedSize || item.size || "N/A",
    }));
    const total = calculateTotal();

    const deliveryInfo = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      street: form.street.trim(),
      phone: form.phone.trim(),
      region: {
        code: String(form.region),
        name: findName(regions, form.region, savedNamesFallback.region),
      },
      province: hasProvinces
        ? {
            code: String(form.province),
            name: findName(provinces, form.province, savedNamesFallback.province),
          }
        : { code: String(form.region), name: "Metro Manila" },
      cityOrMunicipality: {
        code: String(form.city),
        name: findName(cities, form.city, savedNamesFallback.city),
      },
      barangay: {
        code: String(form.barangay),
        name: findName(barangays, form.barangay, savedNamesFallback.barangay),
      },
    };

    if (saveAddress && !isAddressAlreadySaved && userToken) {
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
        body: JSON.stringify({
          items: payload, total, deliveryInfo, paymentMethod: method, shippingFee,
          voucherCode: appliedVoucher?.code || null,
        }),
      });
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } catch {
        Alert.alert("Server Error", `Status ${res.status}: ${responseText}`); return;
      }
      if (data.success) {
        if (!buyNowItem) clearCart();
        if (method === "online") {
          await startPayMongoCheckout(data.orderNumber);
        } else {
          goToOrders(data.orderNumber, payload);
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
    applyingSavedRef.current = true;
    setShowAddressDropdown(false);
    setEditingIndex(null);
    setEditFormData(null);
    try {
      const rawRegionCode   = getLocCode(address.region);
      const rawProvinceCode = getLocCode(address.province);
      const rawCityCode     = getLocCode(address.cityOrMunicipality) || getLocCode(address.city);
      const rawBrgyCode     = getLocCode(address.barangay);

      const regionName   = getLocName(address.region);
      const provinceName = getLocName(address.province);
      const cityName     = getLocName(address.cityOrMunicipality) || getLocName(address.city);
      const brgyName     = getLocName(address.barangay);

      const resolvedRegionCode =
        regions.find((r) => codesMatch(r.code, rawRegionCode))?.code ||
        regions.find((r) => (r.name || "").toLowerCase() === regionName.toLowerCase())?.code ||
        rawRegionCode;

      const isNCR = String(resolvedRegionCode) === NCR_REGION_CODE;
      setHasProvinces(!isNCR);

      let loadedProvinces = [];
      if (!isNCR && resolvedRegionCode) {
        setLoadingProvinces(true);
        try {
          const res = await axios.get(
            `https://psgc.cloud/api/regions/${encodeURIComponent(resolvedRegionCode)}/provinces`
          );
          loadedProvinces = naturalSortByName(fixList(res.data));
        } catch {
          loadedProvinces = [];
        } finally {
          setLoadingProvinces(false);
        }
      }

      const resolvedProvinceCode = isNCR
        ? NCR_REGION_CODE
        : (loadedProvinces.find((p) => codesMatch(p.code, rawProvinceCode))?.code ||
           loadedProvinces.find((p) => (p.name || "").toLowerCase() === provinceName.toLowerCase())?.code ||
           rawProvinceCode);

      if (!isNCR && resolvedProvinceCode && provinceName && !loadedProvinces.some((p) => codesMatch(p.code, resolvedProvinceCode))) {
        loadedProvinces = [...loadedProvinces, { code: resolvedProvinceCode, name: provinceName }];
      }
      setProvinces(loadedProvinces);

      const pOrR = isNCR ? resolvedRegionCode : resolvedProvinceCode;
      let loadedCities = [];
      if (pOrR) {
        setLoadingCities(true);
        try {
          const url = isNCR
            ? `https://psgc.cloud/api/regions/${encodeURIComponent(pOrR)}/cities-municipalities`
            : `https://psgc.cloud/api/provinces/${encodeURIComponent(pOrR)}/cities-municipalities`;
          const res = await axios.get(url);
          loadedCities = naturalSortByName(fixList(res.data));
        } catch {
          loadedCities = [];
        } finally {
          setLoadingCities(false);
        }
      }

      const resolvedCityObj =
        loadedCities.find((c) => codesMatch(c.code, rawCityCode)) ||
        loadedCities.find((c) => (c.name || "").toLowerCase() === cityName.toLowerCase());
      const resolvedCityCode = resolvedCityObj?.code || rawCityCode;
      const resolvedCityName = resolvedCityObj?.name || cityName;

      if (resolvedCityCode && resolvedCityName && !loadedCities.some((c) => codesMatch(c.code, resolvedCityCode))) {
        loadedCities = [...loadedCities, { code: resolvedCityCode, name: resolvedCityName }];
      }
      setCities(loadedCities);

      let loadedBarangays = [];
      if (resolvedCityCode) {
        setLoadingBarangays(true);
        try {
          loadedBarangays = await fetchBarangaysForCity(resolvedCityCode);
        } catch {
          loadedBarangays = [];
        } finally {
          setLoadingBarangays(false);
        }
      }

      const resolvedBrgyObj =
        loadedBarangays.find((b) => codesMatch(b.code, rawBrgyCode)) ||
        loadedBarangays.find((b) => (b.name || "").toLowerCase() === brgyName.toLowerCase());
      const resolvedBrgyCode = resolvedBrgyObj?.code || rawBrgyCode;
      const resolvedBrgyName = resolvedBrgyObj?.name || brgyName;

      if (resolvedBrgyCode && resolvedBrgyName && !loadedBarangays.some((b) => codesMatch(b.code, resolvedBrgyCode))) {
        loadedBarangays = [...loadedBarangays, { code: resolvedBrgyCode, name: resolvedBrgyName }];
      }
      setBarangays(loadedBarangays);

      setSavedNamesFallback({
        region: regionName || findName(regions, resolvedRegionCode),
        province: isNCR ? "Metro Manila" : (provinceName || findName(loadedProvinces, resolvedProvinceCode)),
        city: resolvedCityName,
        barangay: resolvedBrgyName,
      });

      setForm({
        firstName: address.firstName || "",
        lastName: address.lastName || "",
        email: address.email || "",
        street: address.street || "",
        phone: normalizePhone(address.phone || ""),
        region: String(resolvedRegionCode || ""),
        province: String(resolvedProvinceCode || ""),
        city: String(resolvedCityCode || ""),
        barangay: String(resolvedBrgyCode || ""),
      });
      setErrors({});
    } catch {} finally {
      setTimeout(() => {
        applyingSavedRef.current = false;
      }, 150);
    }
  };

  const PickerField = ({ label, field, items, loading, enabled = true }) => (
    <Dropdown
      label={label}
      value={form[field]}
      items={items.map((item) => ({ label: item.name, value: item.code }))}
      onSelect={(v) => handleChange(field, v)}
      placeholder={`Select ${label}`}
      enabled={enabled}
      loading={loading}
      error={errors[field]}
      s={s}
      colors={colors}
    />
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

      <Text style={s.pageTitle}>Place Order</Text>

      {/* ════════════════════════════════
          DELIVERY INFORMATION
      ════════════════════════════════ */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeadRow}>
          <Ionicons name="location-outline" size={16} color={colors.textPrimary} />
          <Text style={s.sectionTitle}>Delivery Information</Text>
        </View>

        {/* Saved address button */}
        {savedAddresses.length > 0 && (
          <View style={s.savedBlock}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[s.savedToggleBtn, { flex: 1 }]}
                onPress={() => {
                  setShowAddressDropdown(!showAddressDropdown);
                  setEditingIndex(null);
                  setEditFormData(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.savedToggleText}>
                  {showAddressDropdown ? "↑ Hide Saved Addresses" : "⊕ Use Saved Address"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.clearFormBtn}
                onPress={() => {
                  applyingSavedRef.current = true;
                  setForm({ firstName: "", lastName: "", email: "", street: "", phone: "+63", region: "", province: "", city: "", barangay: "" });
                  setSavedNamesFallback({ region: "", province: "", city: "", barangay: "" });
                  setErrors({});
                  setProvinces([]); setCities([]); setBarangays([]);
                  setHasProvinces(true);
                  setSaveAddress(false);
                  setTimeout(() => {
                    applyingSavedRef.current = false;
                  }, 100);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.clearFormText}>⤬ Clear Form</Text>
              </TouchableOpacity>
            </View>

            {showAddressDropdown && (
              <View style={s.savedList}>
                {savedAddresses.map((addr, idx) => {
                  const brgyLabel = getLocName(addr.barangay);
                  const cityLabel = getLocName(addr.cityOrMunicipality) || getLocName(addr.city);
                  const provLabel = getLocName(addr.province);
                  const regLabel  = getLocName(addr.region);
                  const line1Parts = [addr.street, brgyLabel, cityLabel].filter(Boolean);
                  const line2Parts = [provLabel, regLabel].filter(Boolean);
                  const isEditingThis = editingIndex === idx && !!editFormData;

                  return (
                    <View key={idx} style={s.savedItem}>
                      {!isEditingThis ? (
                        <>
                          <TouchableOpacity onPress={() => useSavedAddress(addr)} activeOpacity={0.8}>
                            <Text style={s.savedName}>{addr.firstName} {addr.lastName}</Text>
                            <Text style={s.savedMeta}>
                              {line1Parts.join(", ")}
                            </Text>
                            {line2Parts.length > 0 && (
                              <Text style={s.savedMeta}>{line2Parts.join(", ")}</Text>
                            )}
                            <Text style={s.savedPhone}>{addr.phone}</Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                            <TouchableOpacity
                              style={s.savedActionBtn}
                              onPress={() => startEditAddress(idx)}
                            >
                              <Ionicons name="create-outline" size={14} color={colors.textPrimary} />
                              <Text style={s.savedActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.savedActionBtn, { borderColor: colors.danger }]}
                              onPress={() => {
                                Alert.alert("Remove Address", "Remove this saved address?", [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Remove", style: "destructive", onPress: async () => {
                                    try {
                                      const res = await fetch(`${BASE_URL}/deleteaddress/${idx}`, {
                                        method: "DELETE",
                                        headers: { "auth-token": userToken },
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setSavedAddresses(data.addresses || []);
                                        if (editingIndex === idx) {
                                          setEditingIndex(null);
                                          setEditFormData(null);
                                        }
                                      }
                                    } catch {}
                                  }},
                                ]);
                              }}
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.danger} />
                              <Text style={[s.savedActionText, { color: colors.danger }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <View style={{ gap: 4 }}>
                          <View style={s.row}>
                            <View style={[s.fieldGroup, { flex: 1 }]}>
                              <Label text="First Name" s={s} />
                              <TextInput
                                style={s.input}
                                value={editFormData.firstName}
                                onChangeText={(v) => handleEditChange("firstName", v)}
                                placeholder="First name"
                                placeholderTextColor={placeholderColor}
                                maxLength={54}
                              />
                            </View>
                            <View style={[s.fieldGroup, { flex: 1 }]}>
                              <Label text="Last Name" s={s} />
                              <TextInput
                                style={s.input}
                                value={editFormData.lastName}
                                onChangeText={(v) => handleEditChange("lastName", v)}
                                placeholder="Last name"
                                placeholderTextColor={placeholderColor}
                                maxLength={54}
                              />
                            </View>
                          </View>

                          <View style={s.fieldGroup}>
                            <Label text="Email" s={s} />
                            <TextInput
                              style={s.input}
                              value={editFormData.email}
                              onChangeText={(v) => handleEditChange("email", v)}
                              placeholder="email@example.com"
                              placeholderTextColor={placeholderColor}
                              keyboardType="email-address"
                              autoCapitalize="none"
                            />
                          </View>

                          <View style={s.fieldGroup}>
                            <Label text="Street Address" s={s} />
                            <TextInput
                              style={s.input}
                              value={editFormData.street}
                              onChangeText={(v) => handleEditChange("street", v)}
                              placeholder="House no., Street, Subdivision"
                              placeholderTextColor={placeholderColor}
                            />
                          </View>

                          <Dropdown
                            label="Region"
                            value={editFormData.region}
                            items={regions.map((r) => ({ label: r.name, value: r.code }))}
                            onSelect={(v) => handleEditChange("region", v)}
                            placeholder="Select Region"
                            enabled={!loadingRegions}
                            loading={loadingRegions}
                            s={s}
                            colors={colors}
                          />

                          {!editHasProvinces ? (
                            <Dropdown
                              label="Province"
                              value={NCR_REGION_CODE}
                              items={[{ label: "Metro Manila", value: NCR_REGION_CODE }]}
                              onSelect={() => {}}
                              placeholder="Metro Manila"
                              enabled={false}
                              loading={false}
                              s={s}
                              colors={colors}
                            />
                          ) : (
                            <Dropdown
                              label="Province"
                              value={editFormData.province}
                              items={editProvinces.map((p) => ({ label: p.name, value: p.code }))}
                              onSelect={(v) => handleEditChange("province", v)}
                              placeholder="Select Province"
                              enabled={!!editFormData.region && !editLoading.provinces}
                              loading={editLoading.provinces}
                              s={s}
                              colors={colors}
                            />
                          )}

                          <Dropdown
                            label="City / Municipality"
                            value={editFormData.cityOrMunicipality}
                            items={editCities.map((c) => ({ label: c.name, value: c.code }))}
                            onSelect={(v) => handleEditChange("cityOrMunicipality", v)}
                            placeholder="Select City / Municipality"
                            enabled={!!(editFormData.province || (!editHasProvinces && editFormData.region)) && !editLoading.cities}
                            loading={editLoading.cities}
                            s={s}
                            colors={colors}
                          />

                          <Dropdown
                            label="Barangay"
                            value={editFormData.barangay}
                            items={editBarangays.map((b) => ({ label: b.name, value: b.code }))}
                            onSelect={(v) => handleEditChange("barangay", v)}
                            placeholder="Select Barangay"
                            enabled={!!editFormData.cityOrMunicipality && !editLoading.barangays}
                            loading={editLoading.barangays}
                            s={s}
                            colors={colors}
                          />

                          <View style={s.fieldGroup}>
                            <Label text="Phone" s={s} />
                            <TextInput
                              style={s.input}
                              value={editFormData.phone}
                              onChangeText={(v) => handleEditChange("phone", v)}
                              placeholder="+639XXXXXXXXX"
                              placeholderTextColor={placeholderColor}
                              keyboardType="number-pad"
                              maxLength={13}
                            />
                          </View>

                          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                            <TouchableOpacity
                              style={[s.editSaveBtn, editLoading.saving && { opacity: 0.6 }]}
                              onPress={saveEditedAddress}
                              disabled={editLoading.saving}
                              activeOpacity={0.85}
                            >
                              {editLoading.saving ? (
                                <ActivityIndicator size="small" color={colors.textInverse} />
                              ) : (
                                <Text style={s.editSaveBtnText}>SAVE CHANGES</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.editCancelBtn}
                              onPress={() => {
                                setEditingIndex(null);
                                setEditFormData(null);
                              }}
                              disabled={editLoading.saving}
                              activeOpacity={0.85}
                            >
                              <Text style={s.editCancelBtnText}>CANCEL</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Name row */}
        <View style={s.row}>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Label text="First Name" s={s} />
            <TextInput
              style={[s.input, errors.firstName && s.inputError]}
              value={form.firstName}
              onChangeText={(v) => handleChange("firstName", v)}
              placeholder="First name"
              placeholderTextColor={placeholderColor}
              maxLength={54}
            />
            <FieldError msg={errors.firstName} s={s} />
          </View>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Label text="Last Name" s={s} />
            <TextInput
              style={[s.input, errors.lastName && s.inputError]}
              value={form.lastName}
              onChangeText={(v) => handleChange("lastName", v)}
              placeholder="Last name"
              placeholderTextColor={placeholderColor}
              maxLength={54}
            />
            <FieldError msg={errors.lastName} s={s} />
          </View>
        </View>

        {/* Email */}
        <View style={s.fieldGroup}>
          <Label text="Email" s={s} />
          <TextInput
            style={[s.input, errors.email && s.inputError]}
            value={form.email}
            onChangeText={(v) => handleChange("email", v)}
            placeholder="email@example.com"
            placeholderTextColor={placeholderColor}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FieldError msg={errors.email} s={s} />
        </View>

        {/* Street */}
        <View style={s.fieldGroup}>
          <Label text="Street Address" s={s} />
          <TextInput
            style={[s.input, errors.street && s.inputError]}
            value={form.street}
            onChangeText={(v) => handleChange("street", v)}
            placeholder="House no., Street, Subdivision"
            placeholderTextColor={placeholderColor}
          />
          <FieldError msg={errors.street} s={s} />
        </View>

        {/* Region */}
        <PickerField label="Region" field="region" items={regions} loading={loadingRegions} enabled />

        {!hasProvinces ? (
          <Dropdown
            label="Province"
            value={NCR_REGION_CODE}
            items={[{ label: "Metro Manila", value: NCR_REGION_CODE }]}
            onSelect={() => {}}
            placeholder="Metro Manila"
            enabled={false}
            loading={false}
            error={errors.province}
            s={s}
            colors={colors}
          />
        ) : (
          <Dropdown
            label="Province"
            value={form.province}
            items={provinces.map((p) => ({ label: p.name, value: p.code }))}
            onSelect={(v) => handleChange("province", v)}
            placeholder="Select Province"
            enabled={!!form.region && !loadingProvinces}
            loading={loadingProvinces}
            error={errors.province}
            s={s}
            colors={colors}
          />
        )}

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
          <Label text="Phone" s={s} />
          <TextInput
            style={[s.input, errors.phone && s.inputError]}
            value={form.phone}
            onChangeText={(v) => handleChange("phone", v)}
            placeholder="+639XXXXXXXXX"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={13}
          />
          <FieldError msg={errors.phone} s={s} />
        </View>

        {/* Shipping tier & ETA hint banner (matches web's ShippingBanner) */}
        {shippingTier && (
          <View style={[s.shippingBanner, shippingTier.fee === 0 && s.shippingBannerFree]}>
            <Text style={s.shippingBannerTitle}>
              {shippingTier.fee === 0
                ? "COMPLIMENTARY SHIPPING"
                : `PREMIUM SHIPPING: ₱${shippingTier.fee.toLocaleString("en-PH")}`}
            </Text>
            <Text style={s.shippingBannerSub}>
              {shippingTier.label} · Est. {shippingTier.eta}
            </Text>
          </View>
        )}

        {/* Save address checkbox / auto-detected saved note */}
        <TouchableOpacity
          style={[s.checkRow, isAddressAlreadySaved && s.checkRowSaved]}
          onPress={() => !isAddressAlreadySaved && setSaveAddress(!saveAddress)}
          activeOpacity={isAddressAlreadySaved ? 1 : 0.7}
          disabled={isAddressAlreadySaved}
        >
          <View style={[s.checkbox, (saveAddress || isAddressAlreadySaved) && s.checkboxOn]}>
            {(saveAddress || isAddressAlreadySaved) && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={[s.checkLabel, isAddressAlreadySaved && s.checkLabelSaved]}>
            {isAddressAlreadySaved
              ? "This address is already saved"
              : "Save this address for future orders"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ════════════════════════════════
          VOUCHERS
      ════════════════════════════════ */}
      {!!userToken && (
        <View style={s.sectionCard}>
          <View style={s.sectionHeadRow}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textPrimary} />
            <Text style={s.sectionTitle}>Vouchers</Text>
          </View>

          <TouchableOpacity style={[s.voucherTrigger, appliedVoucher && s.voucherTriggerApplied]} onPress={toggleVoucherPanel} activeOpacity={0.8}>
            <Text style={s.voucherTriggerLabel}>{appliedVoucher ? "Voucher Applied" : "Available Vouchers"}</Text>
            <Text style={s.voucherTriggerValue}>
              {appliedVoucher ? appliedVoucher.code : loadingVouchers ? "Loading…" : voucherOpen ? `${vouchers.length} available` : "Tap to view"}
            </Text>
          </TouchableOpacity>

          {voucherOpen && (
            <View style={s.voucherDropdown}>
              {loadingVouchers ? (
                <ActivityIndicator size="small" color={colors.textPrimary} style={{ paddingVertical: 14 }} />
              ) : voucherError ? (
                <Text style={s.voucherEmptyText}>{voucherError}</Text>
              ) : vouchers.length === 0 ? (
                <Text style={s.voucherEmptyText}>You don't have any vouchers yet.</Text>
              ) : (
                vouchers.map((v) => (
                  <TouchableOpacity
                    key={v._id}
                    style={[s.voucherItem, appliedVoucher?.code === v.code && s.voucherItemActive, v.used && s.voucherItemUsed]}
                    onPress={() => !v.used && handleApplyVoucher(v.code)}
                    disabled={v.used}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.voucherItemDiscount}>
                        {v.discountPercent > 0 ? `${v.discountPercent}% OFF` : `₱${v.maxDiscount} OFF`}
                      </Text>
                      <Text style={s.voucherItemTitle}>{v.title}</Text>
                    </View>
                    <Text style={s.voucherItemAction}>
                      {applyingCode === v.code ? "…" : appliedVoucher?.code === v.code ? "Applied" : "Apply"}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {appliedVoucher && (
            <TouchableOpacity onPress={handleRemoveVoucher} style={{ marginTop: 10 }}>
              <Text style={s.voucherRemoveText}>Remove Applied Voucher</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ════════════════════════════════
          PAYMENT METHOD
      ════════════════════════════════ */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeadRow}>
          <Ionicons name="card-outline" size={16} color={colors.textPrimary} />
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
          <Ionicons name="receipt-outline" size={16} color={colors.textPrimary} />
          <Text style={s.sectionTitle}>Order Summary</Text>
        </View>

        {items.map((item, idx) => (
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

        <Divider s={s} />

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
        {appliedVoucher && (
          <View style={s.subRow}>
            <Text style={s.subLabel}>
              Voucher discount{appliedVoucher.discountPercent > 0 ? ` (${appliedVoucher.discountPercent}% off)` : ""}
            </Text>
            <Text style={s.discountValue}>
              −₱{appliedVoucher.discountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        <Divider s={s} />

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

      {/* ── BACK — same shape/style as the Place Order CTA above it ── */}
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")}
        activeOpacity={0.88}
      >
        <Text style={s.backText}>BACK</Text>
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

const makeStyles = (colors, isDark = false) => {
  // In dark mode, swap dim greys for readable whites so text isn't lost
  // against the dark surfaces.
  const dim = isDark ? "#ffffff" : colors.textMuted;
  const body = isDark ? "#ffffff" : colors.textSecondary;
  const placeholderCol = isDark ? "rgba(255,255,255,0.48)" : colors.textMuted;
  return StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgPrimary },
  // No SafeAreaView on this screen — paddingTop covers the status bar/notch
  // clearance that used to come "for free" from the Back button sitting
  // above the title (now moved to the bottom of the page).
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_CLEARANCE },

  /* ── nav ── */
  // Same shape and fill as ctaBtn (radius.lg, same padding, solid black)
  // so it reads as the exact same button style, not a lesser variant.
  backBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  backText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 14,
  },

  pageTitle: {
    fontSize: 30,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 20,
  },

  /* ── section card ── */
  // No border — just a soft shadow for a "risen card" premium feel,
  // matching AlertHost/About This Item's card treatment instead of an
  // outlined box.
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    ...shadows.sm,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
    color: dim,
    textTransform: "uppercase",
  },

  /* ── saved address ── */
  savedBlock: { marginBottom: 16 },
  savedToggleBtn: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.accentGoldWash,
  },
  savedToggleText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.accentGoldLight, letterSpacing: 0.5 },
  clearFormBtn: { borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: "transparent" },
  clearFormText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, letterSpacing: 0.5 },
  savedActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  savedActionText: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.textPrimary, letterSpacing: 0.5 },
  savedList: {
    marginTop: 10,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.bgTertiary,
  },
  savedItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 2,
  },
  savedName:  { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.textPrimary },
  savedMeta:  { fontSize: 12, color: body },
  savedPhone: { fontSize: 12, color: body, marginTop: 2 },
  editSaveBtn: {
    flex: 1,
    backgroundColor: colors.accentGold,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveBtnText: {
    color: colors.textInverse,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
  },
  editCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelBtnText: {
    color: body,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
  },

  /* ── form ── */
  row:       { flexDirection: "row", gap: 10 },
  fieldGroup:{ marginBottom: 14 },

  label: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.5,
    color: dim,
    marginBottom: 7,
    textTransform: "uppercase",
  },

  // Filled, no border — a tinted background distinguishes the field from
  // the card behind it instead of an outline, matching the borderless
  // "premium card" look used elsewhere (AlertHost, About This Item).
  input: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: isSmall ? 12 : 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputError: { borderWidth: 1.5, borderColor: colors.danger },
  errorText:  { fontSize: 11, color: colors.danger, marginTop: 5, letterSpacing: 0.3 },

  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: isSmall ? 12 : 14,
    minHeight: 48,
  },
  dropdownFieldDisabled: {
    backgroundColor: colors.bgTertiary,
    opacity: 0.75,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 8,
  },
  dropdownPlaceholder: {
    color: placeholderCol,
  },
  loadingText: { fontSize: 13, color: dim },

  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  dropdownSheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
    ...(shadows?.md || {}),
  },
  dropdownSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownSheetTitle: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.4,
    color: colors.textPrimary,
    textTransform: "uppercase",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.bgPrimary,
  },
  dropdownItemSelected: {
    backgroundColor: colors.bgCard,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 10,
  },
  dropdownItemTextSelected: {
    color: colors.accentGold,
    fontFamily: fonts.bodyBold,
  },
  dropdownItemSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },

  /* ── shipping banner ── */
  shippingBanner: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentGold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 2,
  },
  shippingBannerFree: {
    borderLeftColor: colors.success || colors.accentGold,
  },
  shippingBannerTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  shippingBannerSub: {
    fontSize: 12,
    color: body,
  },

  /* ── checkbox ── */
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  checkRowSaved: {
    backgroundColor: colors.accentGoldWash,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  checkLabel: { fontSize: 13, color: body, flex: 1 },
  checkLabelSaved: { fontFamily: fonts.bodyBold, color: colors.textPrimary },

  /* ── payment methods ── */
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.bgTertiary,
  },
  methodChipActive:     { borderWidth: 1, borderColor: colors.accentGold, backgroundColor: colors.accentGoldWash },
  methodChipText:       { fontSize: 12, fontFamily: fonts.bodyBold, color: body, letterSpacing: 0.5 },
  methodChipTextActive: { color: colors.accentGoldLight },
  methodNote:           { fontSize: 12, color: dim, fontFamily: fonts.bodyRegular, marginTop: 12, lineHeight: 18 },

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
  summaryName:  { fontSize: 13, fontFamily: fonts.bodySemibold, color: body },
  summarySize:  { fontSize: 11, color: dim, letterSpacing: 0.5 },
  summaryRight: { alignItems: "flex-end", gap: 2 },
  summaryQty:   { fontSize: 11, color: dim },
  summaryPrice: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.textPrimary },

  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 },

  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subLabel: { fontSize: 12, color: body },
  subValue: { fontSize: 13, fontFamily: fonts.bodySemibold, color: body },
  discountValue: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.danger },

  /* ── vouchers ── */
  voucherTrigger: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  voucherTriggerApplied: { borderWidth: 1, borderColor: colors.accentGold, backgroundColor: colors.accentGoldWash },
  voucherTriggerLabel: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: dim },
  voucherTriggerValue: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.textPrimary, marginTop: 3 },
  voucherDropdown: {
    marginTop: 10,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.bgTertiary,
  },
  voucherEmptyText: { fontSize: 12, color: dim, padding: 14, textAlign: "center" },
  voucherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  voucherItemActive: { backgroundColor: colors.accentGoldWash },
  voucherItemUsed: { opacity: 0.4 },
  voucherItemDiscount: { fontSize: 13, fontFamily: fonts.display, color: colors.accentGoldLight, letterSpacing: 0.5 },
  voucherItemTitle: { fontSize: 12, color: body, marginTop: 2 },
  voucherItemAction: { fontSize: 11, fontFamily: fonts.bodyBold, color: dim, letterSpacing: 0.5 },
  voucherRemoveText: { fontSize: 12, color: colors.danger, textAlign: "center", fontFamily: fonts.bodyBold },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel:  { fontSize: 14, fontFamily: fonts.display, color: body, letterSpacing: 1 },
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
  verifyText: { color: body, fontSize: 13, letterSpacing: 0.5, textAlign: "center" },
});
};
