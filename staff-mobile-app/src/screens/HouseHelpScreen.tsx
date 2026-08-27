import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { api } from "../services/api";

export default function HouseHelpScreen() {
  const [helps, setHelps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHelps();
  }, []);

  const loadHelps = async () => {
    try {
      setLoading(true);
      const res = await api.getHouseHelps();
      setHelps(res.helps || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHelps(); }} tintColor="#818cf8" />}
    >
      <Text style={styles.title}>Domestic Staff &amp; House Helps</Text>
      <Text style={styles.sub}>Maids, cooks, and drivers registered to your staff quarter.</Text>

      {helps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧹</Text>
          <Text style={styles.emptyTitle}>No House Helps Registered</Text>
          <Text style={styles.emptyDesc}>Contact University Admin to register domestic help passes.</Text>
        </View>
      ) : (
        helps.map((h) => (
          <View key={h.linkId} style={styles.helpCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{h.helper.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{h.helper.serviceType}</Text>
              </View>
            </View>
            <Text style={styles.meta}>📞 {h.helper.phone} • 🏠 {h.quarterNumber}</Text>
            <Text style={styles.valid}>Status: {h.helper.status} • Token: {h.helper.token}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16" },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff" },
  sub: { fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 16 },
  helpCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#1e293b", marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  badge: { backgroundColor: "#1e1b4b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: "#818cf8", fontWeight: "800" },
  meta: { fontSize: 12, color: "#cbd5e1", marginTop: 4 },
  valid: { fontSize: 11, color: "#64748b", marginTop: 6 },
  empty: { backgroundColor: "#0f172a", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", marginTop: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  emptyDesc: { fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4 },
});
