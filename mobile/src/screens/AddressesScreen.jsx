import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BASE_URL } from "../api/config";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../utils/customAlert";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { fonts, radius, shadows } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";

const NCR_REGION_CODE = "1300000000";
const MANILA_CITY_CODE = "1380600000";
const MANILA_GITLAB_CODE = "133900000";

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
  if (ca.startsWith("13806") && cb.startsWith("1339") && ca.slice(5) === cb.slice(4)) return true;
  if (cb.startsWith("13806") && ca.startsWith("1339") && cb.slice(5) === ca.slice(4)) return true;
  return false;
};

const fetchBarangaysForCity = async (cityCode) => {
  if (!cityCode) return [];
  const codeStr = String(cityCode).trim();
  const isManila = codeStr === MANILA_CITY_CODE || codeStr === MANILA_GITLAB_CODE;

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

  try {
    const res = await axios.get(
      `https://psgc.cloud/api/cities-municipalities/${encodeURIComponent(codeStr)}/barangays`
    );
    if (Array.isArray(res.data) && res.data.length > 0) {
      return naturalSortByName(fixList(res.data));
    }
  } catch {}

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
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      if (typeof cb === "function") cb();
    });
  };

  const selectedItem = items.find((i) => codesMatch(i.value, value));
  const displayText = selectedItem ? selectedItem.label : placeholder;
  const isPlaceholder = !selectedItem;

  return (
    <View>
      <Text style={s.fieldLabel}>{label.toUpperCase()}</Text>
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
            <Text style={s.dropdownPlaceholder}>Loading {label.toLowerCase()}…</Text>
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
      {error ? <Text style={s.errorText}>{error}</Text> : null}

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
                  <Text style={s.dropdownPlaceholder}>No options available</Text>
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

export default function AddressesScreen({ navigation }) {
  const { userToken } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const placeholderColor = isDark ? "rgba(255,255,255,0.48)" : colors.textMuted;

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingIdx, setDeletingIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingIdx, setSavingIdx] = useState(null);

  const [regions, setRegions] = useState([]);
  const [editProvinces, setEditProvinces] = useState([]);
  const [editCities, setEditCities] = useState([]);
  const [editBarangays, setEditBarangays] = useState([]);
  const [editHasProvinces, setEditHasProvinces] = useState(true);
  const [editLoading, setEditLoading] = useState({
    regions: false, provinces: false, cities: false, barangays: false,
  });

  useEffect(() => {
    setEditLoading((p) => ({ ...p, regions: true }));
    axios
      .get("https://psgc.cloud/api/regions")
      .then((res) => setRegions(fixList(res.data)))
      .catch(() => setRegions([]))
      .finally(() => setEditLoading((p) => ({ ...p, regions: false })));
  }, []);

  const findName = (list, code, fallback = "") => {
    if (!code) return fallback;
    if (Array.isArray(list)) {
      const found = list.find((item) => codesMatch(item.code, code));
      if (found && found.name) return found.name;
    }
    return fallback;
  };

  const fetchAddresses = useCallback(async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/getsavedaddresses`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) {
        const list = data.addresses || [];
        setAddresses(list);
        // Hydrate any saved addresses that were saved with missing city/barangay names
        list.forEach(async (addr, idx) => {
          const rCode = getLocCode(addr.region);
          const pCode = getLocCode(addr.province);
          const cCode = getLocCode(addr.cityOrMunicipality) || getLocCode(addr.city);
          const bCode = getLocCode(addr.barangay);
          let cName = getLocName(addr.cityOrMunicipality) || getLocName(addr.city);
          let bName = getLocName(addr.barangay);
          if ((cCode && !cName) || (bCode && !bName)) {
            const isNCR = rCode === NCR_REGION_CODE;
            if (cCode && !cName && (rCode || pCode)) {
              try {
                const url = isNCR
                  ? `https://psgc.cloud/api/regions/${encodeURIComponent(rCode)}/cities-municipalities`
                  : `https://psgc.cloud/api/provinces/${encodeURIComponent(pCode)}/cities-municipalities`;
                const resC = await axios.get(url);
                const found = fixList(resC.data).find((c) => codesMatch(c.code, cCode));
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
              const nextAddr = {
                ...addr,
                cityOrMunicipality: { code: cCode, name: cName },
                barangay: { code: bCode, name: bName },
              };
              setAddresses((prev) => prev.map((it, i) => (i === idx ? nextAddr : it)));
              fetch(`${BASE_URL}/updateaddress/${idx}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "auth-token": userToken },
                body: JSON.stringify(nextAddr),
              }).catch(() => {});
            }
          }
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses])
  );

  const confirmDelete = (index) => {
    Alert.alert(
      "Remove Address",
      "Remove this saved address?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteAddress(index) },
      ]
    );
  };

  const deleteAddress = async (index) => {
    setDeletingIdx(index);
    try {
      const res  = await fetch(`${BASE_URL}/deleteaddress/${index}`, {
        method: "DELETE",
        headers: { "auth-token": userToken },
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        Toast.show({ type: "success", text1: "Address removed" });
      } else {
        Toast.show({ type: "error", text1: data.error || "Failed to remove address" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Network error" });
    } finally {
      setDeletingIdx(null);
    }
  };

  const startEdit = async (index) => {
    const addr = addresses[index];
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
    setEditingIdx(index);
    setEditErrors({});
    setEditForm({
      firstName: addr.firstName || "",
      lastName:  addr.lastName || "",
      email:     addr.email || "",
      phone:     addr.phone || "+63",
      street:    addr.street || "",
      region:    resolvedRCode,
      province:  isNCR ? NCR_REGION_CODE : pCode,
      city:      cCode,
      barangay:  bCode,
    });

    setEditLoading((p) => ({
      ...p,
      provinces: !isNCR && !!resolvedRCode,
      cities: !!resolvedRCode,
      barangays: !!cCode,
    }));

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

      setEditForm((prev) =>
        prev
          ? {
              ...prev,
              province: resolvedPCode,
              city: String(resolvedCCode || ""),
              barangay: String(resolvedBCode || ""),
            }
          : prev
      );
    } catch {} finally {
      setEditLoading((p) => ({ ...p, provinces: false, cities: false, barangays: false }));
    }
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditForm(null);
    setEditErrors({});
  };

  const handleEditChange = async (name, value) => {
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
      setEditHasProvinces(!isNCR);
      setEditProvinces([]);
      setEditCities([]);
      setEditBarangays([]);
      setEditForm((p) => ({
        ...p,
        region: value,
        province: isNCR ? NCR_REGION_CODE : "",
        city: "",
        barangay: "",
      }));
      setEditErrors((p) => ({ ...p, region: "", province: "", city: "", barangay: "" }));
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
      setEditForm((p) => ({ ...p, province: value, city: "", barangay: "" }));
      setEditErrors((p) => ({ ...p, province: "", city: "", barangay: "" }));
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

    if (name === "city") {
      setEditBarangays([]);
      setEditForm((p) => ({ ...p, city: value, barangay: "" }));
      setEditErrors((p) => ({ ...p, city: "", barangay: "" }));
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

    setEditForm((p) => ({ ...p, [name]: value }));
    if (editErrors[name]) setEditErrors((p) => ({ ...p, [name]: "" }));
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.firstName.trim()) e.firstName = "First name is required";
    if (!editForm.lastName.trim())  e.lastName  = "Last name is required";
    if (!editForm.email.trim())     e.email     = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(editForm.email)) e.email = "Invalid email";
    if (!editForm.street.trim())    e.street    = "Street is required";
    if (!editForm.region)           e.region    = "Select a region";
    if (editHasProvinces && !editForm.province) e.province = "Select a province";
    if (!editForm.city)             e.city      = "Select a city / municipality";
    if (!editForm.barangay)         e.barangay  = "Select a barangay";
    if (!/^\+63\d{10}$/.test(editForm.phone || "")) e.phone = "Phone must start with +63 followed by 10 digits.";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveEdit = async () => {
    if (!validateEdit()) return;
    setSavingIdx(editingIdx);
    try {
      const current = addresses[editingIdx] || {};
      const merged = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        street: editForm.street.trim(),
        region: {
          code: String(editForm.region),
          name: findName(regions, editForm.region, getLocName(current.region)),
        },
        province: editHasProvinces
          ? {
              code: String(editForm.province),
              name: findName(editProvinces, editForm.province, getLocName(current.province)),
            }
          : { code: String(editForm.region), name: "Metro Manila" },
        cityOrMunicipality: {
          code: String(editForm.city),
          name: findName(
            editCities,
            editForm.city,
            getLocName(current.cityOrMunicipality) || getLocName(current.city)
          ),
        },
        barangay: {
          code: String(editForm.barangay),
          name: findName(editBarangays, editForm.barangay, getLocName(current.barangay)),
        },
      };
      const res  = await fetch(`${BASE_URL}/updateaddress/${editingIdx}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": userToken },
        body: JSON.stringify(merged),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        cancelEdit();
        Toast.show({ type: "success", text1: "Address updated" });
      } else {
        Toast.show({ type: "error", text1: data.error || "Failed to update address" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Network error" });
    } finally {
      setSavingIdx(null);
    }
  };

  const renderAddress = ({ item: addr, index }) => {
    const isEditing = editingIdx === index;
    if (isEditing && editForm) {
      return (
        <View style={s.card}>
          <View style={s.editRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>FIRST NAME</Text>
              <TextInput
                style={[s.input, editErrors.firstName && s.inputError]}
                value={editForm.firstName}
                onChangeText={(v) => handleEditChange("firstName", v)}
                placeholder="First name"
                placeholderTextColor={placeholderColor}
              />
              {editErrors.firstName && <Text style={s.errorText}>{editErrors.firstName}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>LAST NAME</Text>
              <TextInput
                style={[s.input, editErrors.lastName && s.inputError]}
                value={editForm.lastName}
                onChangeText={(v) => handleEditChange("lastName", v)}
                placeholder="Last name"
                placeholderTextColor={placeholderColor}
              />
              {editErrors.lastName && <Text style={s.errorText}>{editErrors.lastName}</Text>}
            </View>
          </View>

          <Text style={s.fieldLabel}>EMAIL</Text>
          <TextInput
            style={[s.input, editErrors.email && s.inputError]}
            value={editForm.email}
            onChangeText={(v) => handleEditChange("email", v)}
            placeholder="email@example.com"
            placeholderTextColor={placeholderColor}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {editErrors.email && <Text style={s.errorText}>{editErrors.email}</Text>}

          <Text style={s.fieldLabel}>PHONE NUMBER</Text>
          <TextInput
            style={[s.input, editErrors.phone && s.inputError]}
            value={editForm.phone}
            onChangeText={(v) => handleEditChange("phone", v)}
            placeholder="+639XXXXXXXXX"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={13}
          />
          {editErrors.phone && <Text style={s.errorText}>{editErrors.phone}</Text>}

          <Text style={s.fieldLabel}>STREET ADDRESS</Text>
          <TextInput
            style={[s.input, editErrors.street && s.inputError]}
            value={editForm.street}
            onChangeText={(v) => handleEditChange("street", v)}
            placeholder="House no., Street, Subdivision"
            placeholderTextColor={placeholderColor}
          />
          {editErrors.street && <Text style={s.errorText}>{editErrors.street}</Text>}

          <Dropdown
            label="Region"
            value={editForm.region}
            items={regions.map((r) => ({ label: r.name, value: r.code }))}
            onSelect={(v) => handleEditChange("region", v)}
            placeholder="Select Region"
            enabled={!editLoading.regions}
            loading={editLoading.regions}
            error={editErrors.region}
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
              error={editErrors.province}
              s={s}
              colors={colors}
            />
          ) : (
            <Dropdown
              label="Province"
              value={editForm.province}
              items={editProvinces.map((p) => ({ label: p.name, value: p.code }))}
              onSelect={(v) => handleEditChange("province", v)}
              placeholder="Select Province"
              enabled={!!editForm.region && !editLoading.provinces}
              loading={editLoading.provinces}
              error={editErrors.province}
              s={s}
              colors={colors}
            />
          )}

          <Dropdown
            label="City / Municipality"
            value={editForm.city}
            items={editCities.map((c) => ({ label: c.name, value: c.code }))}
            onSelect={(v) => handleEditChange("city", v)}
            placeholder="Select City / Municipality"
            enabled={!!(editForm.province || (!editHasProvinces && editForm.region)) && !editLoading.cities}
            loading={editLoading.cities}
            error={editErrors.city}
            s={s}
            colors={colors}
          />

          <Dropdown
            label="Barangay"
            value={editForm.barangay}
            items={editBarangays.map((b) => ({ label: b.name, value: b.code }))}
            onSelect={(v) => handleEditChange("barangay", v)}
            placeholder="Select Barangay"
            enabled={!!editForm.city && !editLoading.barangays}
            loading={editLoading.barangays}
            error={editErrors.barangay}
            s={s}
            colors={colors}
          />

          <View style={s.editActions}>
            <TouchableOpacity
              style={[s.saveBtn, savingIdx === index && s.saveBtnDim]}
              onPress={saveEdit}
              disabled={savingIdx === index}
              activeOpacity={0.85}
            >
              {savingIdx === index
                ? <ActivityIndicator size="small" color={colors.textInverse} />
                : <Text style={s.saveBtnText}>SAVE CHANGES</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={cancelEdit}
              disabled={savingIdx === index}
              activeOpacity={0.85}
            >
              <Text style={s.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const brgyName = getLocName(addr.barangay);
    const cityName = getLocName(addr.cityOrMunicipality) || getLocName(addr.city);
    const provName = getLocName(addr.province);
    const regName  = getLocName(addr.region);
    const brgyCityLine = [brgyName, cityName].filter(Boolean).join(", ");
    const provRegLine  = [provName, regName].filter(Boolean).join(", ");

    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardName}>{addr.firstName} {addr.lastName}</Text>
          <View style={s.cardActions}>
            <TouchableOpacity
              onPress={() => startEdit(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(index)}
              disabled={deletingIdx === index}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {deletingIdx === index
                ? <ActivityIndicator size="small" color={colors.danger} />
                : <Ionicons name="trash-outline" size={18} color={colors.danger} />
              }
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.cardLine}>{addr.street}</Text>
        {!!brgyCityLine && <Text style={s.cardLine}>{brgyCityLine}</Text>}
        {!!provRegLine && <Text style={s.cardLine}>{provRegLine}</Text>}
        <Text style={s.cardPhone}>{addr.phone}</Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgPrimary} />

      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ProfileScreen"))}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>DELIVERY ADDRESSES</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.accentGold} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="home-outline" size={40} color={colors.bgTertiary} />
          <Text style={s.emptyTitle}>NO SAVED ADDRESSES</Text>
          <Text style={s.emptySubtitle}>
            Addresses you save at checkout will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={addresses}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderAddress}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const makeStyles = (colors, isDark = false) => {
  const placeholderCol = isDark ? "rgba(255,255,255,0.48)" : colors.textMuted;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    backBtn: { width: 24 },
    backArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: "300" },
    headerTitle: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.display, letterSpacing: 1.5 },

    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
    emptyTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.display, letterSpacing: 1.5 },
    emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },

    listContent: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE },

    card: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 16 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    cardName: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold },
    cardActions: { flexDirection: "row", gap: 14, alignItems: "center" },
    cardLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    cardPhone: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

    editRow: { flexDirection: "row", gap: 10 },
    fieldLabel: {
      fontSize: 10,
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.4,
      color: colors.textMuted,
      marginTop: 10,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.textPrimary,
    },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 11, marginTop: 4 },

    dropdownField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bgPrimary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 42,
    },
    dropdownFieldDisabled: {
      backgroundColor: colors.bgTertiary,
      opacity: 0.75,
    },
    dropdownText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      marginRight: 8,
    },
    dropdownPlaceholder: {
      fontSize: 13,
      color: placeholderCol,
    },
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

    editActions: { flexDirection: "row", gap: 10, marginTop: 14 },
    saveBtn: {
      flex: 1,
      backgroundColor: colors.accentGold,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnDim: { opacity: 0.6 },
    saveBtnText: {
      color: colors.textInverse,
      fontSize: 12,
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.4,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.4,
    },
  });
};
