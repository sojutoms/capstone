import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius } from "../theme";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

const Stars = ({ rating }) => (
  <View style={{ flexDirection: "row", gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Text key={i} style={{ fontSize: 14, color: i <= rating ? colors.accentGold : colors.bgTertiary }}>★</Text>
    ))}
  </View>
);

export default function MyReviewsScreen({ navigation }) {
  const { userToken } = useAuth();
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReviews = async () => {
    if (!userToken) return;
    try {
      const res  = await fetch(`${BASE_URL}/myreviews`, { headers: { "auth-token": userToken } });
      const data = await res.json();
      if (data.success) setReviews(data.reviews || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReviews();
    }, [userToken])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReviews();
    setRefreshing(false);
  };

  const renderReview = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Image source={{ uri: item.productImage }} style={s.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={s.productName} numberOfLines={1}>{item.productName}</Text>
          <Stars rating={item.rating} />
        </View>
        <Text style={s.date}>
          {new Date(item.date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
        </Text>
      </View>

      {!!item.title && <Text style={s.reviewTitle}>{item.title}</Text>}
      <Text style={s.reviewText}>{item.review}</Text>

      {(item.fit || item.comfort || item.recommend) && (
        <View style={s.metaRow}>
          {!!item.fit && <Text style={s.metaChip}>Fit: {item.fit}</Text>}
          {!!item.comfort && <Text style={s.metaChip}>Comfort: {item.comfort}</Text>}
          {!!item.recommend && <Text style={s.metaChip}>Recommend: {item.recommend}</Text>}
        </View>
      )}
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ProfileScreen")}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>MY REVIEWS</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.accentGold} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyIcon}>✎</Text>
          <Text style={s.emptyTitle}>NO REVIEWS YET</Text>
          <Text style={s.emptySubtitle}>Reviews you write for products will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGold} />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
  headerTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.display, letterSpacing: 1.5 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, color: colors.bgTertiary, marginBottom: 16 },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontFamily: fonts.display, letterSpacing: 1.5, marginBottom: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },

  listContent: { padding: 16 },

  card: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bgTertiary },
  productName: { color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 4 },
  date: { color: colors.textMuted, fontSize: 10 },

  reviewTitle: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bodyBold, marginBottom: 4 },
  reviewText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  metaChip: {
    color: colors.textSecondary,
    fontSize: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
