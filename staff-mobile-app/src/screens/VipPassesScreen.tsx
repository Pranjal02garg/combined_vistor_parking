import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { api } from "../services/api";

export default function VipPassesScreen() {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPasses();
  }, []);

  const loadPasses = async () => {
    try {
      setLoading(true);
      const res = await api.getVIPPasses();
      setPasses(res.passes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreate = async () => {
    if (!guestName || !guestPhone || !purpose) {
      Alert.alert("Error", "Please fill in guest name, phone number, and purpose.");
      return;
    }

    try {
      setSaving(true);
      await api.createVIPPass({
        guestName,
        guestPhone,
        purpose,
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : undefined,
      });
      setShowModal(false);
      setGuestName("");
      setGuestPhone("");
      setPurpose("");
      setVehicleNumber("");
      loadPasses();
      Alert.alert("Pass Created", "VIP Guest Pass issued successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to issue VIP pass");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPasses(); }} tintColor="#818cf8" />}
    >
      <View style={styles.header}>
        <div>
          <Text style={styles.title}>VIP Guest Passes</Text>
          <Text style={styles.sub}>Pre-authorized guest passes with instant QR entry</Text>
        </div>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Issue Pass</Text>
        </TouchableOpacity>
      </View>

      {passes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎟️</Text>
          <Text style={styles.emptyTitle}>No VIP passes issued yet</Text>
          <Text style={styles.emptyDesc}>Create a pass to give your guests fast QR entry at campus gates.</Text>
          <TouchableOpacity style={styles.smallAddBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.smallAddText}>+ Create First VIP Pass</Text>
          </TouchableOpacity>
        </View>
      ) : (
        passes.map((p) => {
          const isApproved = p.status === "APPROVED";
          const isCheckedIn = p.status === "CHECKED_IN";
          return (
            <View key={p.id} style={styles.passCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.guestName}>{p.guestName}</Text>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isCheckedIn ? "#064e3b" : isApproved ? "#1e1b4b" : "#451a03",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: isCheckedIn ? "#34d399" : isApproved ? "#818cf8" : "#fbbf24" },
                    ]}
                  >
                    ● {p.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.purpose}>{p.purpose}</Text>

              <View style={styles.cardMeta}>
                <Text style={styles.metaItem}>📞 {p.guestPhone}</Text>
                {p.vehicleNumber && <Text style={styles.metaItem}>🚗 {p.vehicleNumber}</Text>}
              </View>

              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>PASS TOKEN / QR CODE:</Text>
                <Text style={styles.tokenVal}>{p.token}</Text>
              </View>
            </View>
          );
        })
      )}

      {/* Modal: Issue Pass */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Issue VIP Guest Pass</Text>
            <Text style={styles.modalSub}>
              Generate a digital gate pass for academic guests, examiners, or visitors.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Guest Full Name *</Text>
              <TextInput
                style={styles.input}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="Dr. A. K. Verma"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Guest Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="9876543210"
                keyboardType="phone-pad"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Purpose of Visit *</Text>
              <TextInput
                style={styles.input}
                value={purpose}
                onChangeText={setPurpose}
                placeholder="PhD Viva Voce / Guest Lecture"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Guest Vehicle Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={vehicleNumber}
                onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
                placeholder="PB11AB1234"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveText}>Issue Pass</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16" },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff" },
  sub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  addBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  passCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#1e293b", marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  guestName: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "800" },
  purpose: { fontSize: 13, color: "#cbd5e1", marginBottom: 10 },
  cardMeta: { flexDirection: "row", gap: 12, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 10 },
  metaItem: { fontSize: 11, color: "#94a3b8" },
  tokenBox: { backgroundColor: "#020617", borderRadius: 10, padding: 8, marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tokenLabel: { fontSize: 10, color: "#64748b", fontWeight: "700" },
  tokenVal: { fontSize: 11, color: "#818cf8", fontWeight: "900", fontFamily: "monospace" },
  empty: { backgroundColor: "#0f172a", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", marginTop: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  emptyDesc: { fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4, marginBottom: 16 },
  smallAddBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  smallAddText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#0f172a", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#334155" },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  modalSub: { fontSize: 12, color: "#94a3b8", marginTop: 4, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "700", color: "#cbd5e1", marginBottom: 4 },
  input: { backgroundColor: "#020617", borderWidth: 1, borderColor: "#334155", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#ffffff" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  cancelText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  saveBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  saveText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
});
