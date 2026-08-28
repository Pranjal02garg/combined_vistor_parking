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
  Share,
  Linking,
  Platform,
} from "react-native";
import { api } from "../services/api";

export default function VipPassesScreen() {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPassQR, setSelectedPassQR] = useState<any | null>(null);

  // Form states
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [purpose, setPurpose] = useState("Academic Guest / Faculty Visit");
  const [visitType, setVisitType] = useState<"OFFICIAL" | "PERSONAL">("OFFICIAL");
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
      // fallback handled in api.ts
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreate = async () => {
    if (!guestName.trim()) {
      Alert.alert("Required", "Please enter guest full name");
      return;
    }

    try {
      setSaving(true);
      const res = await api.createVIPPass({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        purpose: purpose.trim() || "Campus Visit",
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : undefined,
      });

      setShowCreateModal(false);
      setGuestName("");
      setGuestPhone("");
      setVehicleNumber("");
      loadPasses();
      setSelectedPassQR(res.pass);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to issue pass");
    } finally {
      setSaving(false);
    }
  };

  const handleSharePass = async (pass: any) => {
    const passUrl = `https://campus.thapar.edu/pass/${pass.token}`;
    const msg = `🏛️ Thapar University Guest Pass\nGuest: ${pass.guestName}\nToken: ${pass.token}\nPurpose: ${pass.purpose || "Campus Visit"}\nDigital Pass: ${passUrl}`;

    try {
      await Share.share({
        message: msg,
        url: passUrl,
        title: "Campus Gate Pass",
      });
    } catch {
      // ignore
    }
  };

  const handleWhatsApp = (pass: any) => {
    const passUrl = `https://campus.thapar.edu/pass/${pass.token}`;
    const msg = `🏛️ Thapar University Guest Pass\nGuest: ${pass.guestName}\nToken: ${pass.token}\nPurpose: ${pass.purpose || "Campus Visit"}\nDigital Pass: ${passUrl}`;
    const cleanPhone = pass.guestPhone?.replace(/[^0-9]/g, "") || "";
    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPasses();
            }}
            tintColor="#818cf8"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Visitor &amp; Guest Passes</Text>
            <Text style={styles.sub}>Pre-authorized passes with instant 1-scan QR entry</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Issue Pass</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color="#818cf8" size="large" />
            <Text style={styles.loaderText}>Loading passes...</Text>
          </View>
        ) : passes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎟️</Text>
            <Text style={styles.emptyTitle}>No VIP Passes Issued</Text>
            <Text style={styles.emptyDesc}>
              Create a pass to grant pre-authorized QR gate clearance at Gates 1–4.
            </Text>
            <TouchableOpacity
              style={styles.smallAddBtn}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.smallAddText}>+ Issue First Guest Pass</Text>
            </TouchableOpacity>
          </View>
        ) : (
          passes.map((p) => {
            const isCheckedIn = p.status === "CHECKED_IN";
            const isApproved = p.status === "APPROVED";

            return (
              <View key={p.id || p.token} style={styles.passCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.guestName}>{p.guestName}</Text>
                    <Text style={styles.purposeText}>{p.purpose || "Official Visit"}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isCheckedIn
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(99, 102, 241, 0.15)",
                        borderColor: isCheckedIn ? "#10b981" : "#6366f1",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: isCheckedIn ? "#34d399" : "#818cf8" },
                      ]}
                    >
                      {isCheckedIn ? "● On Campus" : p.status}
                    </Text>
                  </View>
                </View>

                {p.guestPhone ? (
                  <Text style={styles.metaPhone}>📞 +91 {p.guestPhone}</Text>
                ) : null}

                {p.vehicleNumber ? (
                  <View style={styles.vehicleBadge}>
                    <Text style={styles.vehicleBadgeText}>🚗 {p.vehicleNumber}</Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.tokenText}>Code: {p.token}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.qrActionBtn}
                      onPress={() => setSelectedPassQR(p)}
                    >
                      <Text style={styles.qrActionText}>View QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shareActionBtn}
                      onPress={() => handleWhatsApp(p)}
                    >
                      <Text style={styles.shareActionText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE PASS MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Visitor Gate Pass</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Guest Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dr. Arvind Subramanian"
                placeholderTextColor="#64748b"
                value={guestName}
                onChangeText={setGuestName}
              />

              <Text style={styles.fieldLabel}>Guest Mobile Number (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={guestPhone}
                onChangeText={setGuestPhone}
              />

              <Text style={styles.fieldLabel}>Purpose of Visit</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Ph.D. Examiner Meeting"
                placeholderTextColor="#64748b"
                value={purpose}
                onChangeText={setPurpose}
              />

              <Text style={styles.fieldLabel}>Vehicle License Plate (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. PB11BH8820"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Issue Gate Pass</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR PASS MODAL */}
      {selectedPassQR && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.whiteQRCard}>
              <TouchableOpacity
                style={styles.qrCloseBtn}
                onPress={() => setSelectedPassQR(null)}
              >
                <Text style={styles.qrCloseText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.qrCrestSub}>THAPAR UNIVERSITY GATE CLEARANCE</Text>
              <Text style={styles.qrTitle}>Digital Guest Pass</Text>

              {/* QR Mock / Display Box */}
              <View style={styles.qrCodeBox}>
                <Text style={styles.mockQRCode}>🏁 [QR CODE]</Text>
                <Text style={styles.qrTokenMono}>{selectedPassQR.token}</Text>
              </View>

              <View style={styles.qrMetaBox}>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Guest: </Text>
                  <Text style={styles.qrMetaVal}>{selectedPassQR.guestName}</Text>
                </Text>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Purpose: </Text>
                  <Text style={styles.qrMetaVal}>{selectedPassQR.purpose}</Text>
                </Text>
                {selectedPassQR.vehicleNumber ? (
                  <Text style={styles.qrMetaLine}>
                    <Text style={styles.qrMetaLabel}>Vehicle: </Text>
                    <Text style={styles.qrMetaVal}>{selectedPassQR.vehicleNumber}</Text>
                  </Text>
                ) : null}
              </View>

              <View style={styles.qrBtnRow}>
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => handleWhatsApp(selectedPassQR)}
                >
                  <Text style={styles.waBtnText}>💬 WhatsApp Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareSheetBtn}
                  onPress={() => handleSharePass(selectedPassQR)}
                >
                  <Text style={styles.shareSheetText}>📤 Share Pass</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16" },
  scroll: { padding: 16, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 },
  sub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  addBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  loaderBox: { padding: 40, alignItems: "center" },
  loaderText: { color: "#64748b", fontSize: 12, marginTop: 8 },
  empty: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    marginTop: 20,
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  emptyDesc: { fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4, marginBottom: 16 },
  smallAddBtn: { backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  smallAddText: { color: "#0f172a", fontSize: 12, fontWeight: "800" },
  passCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  guestName: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  purposeText: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  metaPhone: { fontSize: 12, color: "#64748b", marginTop: 6, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  vehicleBadge: {
    backgroundColor: "#020617",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 8,
  },
  vehicleBadgeText: { color: "#f8fafc", fontSize: 11, fontWeight: "700" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.8)",
  },
  tokenText: { fontSize: 11, color: "#64748b", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  actionRow: { flexDirection: "row", gap: 8 },
  qrActionBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  qrActionText: { color: "#f8fafc", fontSize: 11, fontWeight: "700" },
  shareActionBtn: { backgroundColor: "#059669", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  shareActionText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#0f172a", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#1e293b", maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  closeIcon: { fontSize: 18, color: "#94a3b8", padding: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#cbd5e1", marginTop: 10, marginBottom: 4 },
  modalInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#ffffff",
  },
  submitBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 8,
  },
  submitBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  btnDisabled: { opacity: 0.5 },
  whiteQRCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  qrCloseBtn: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  qrCloseText: { fontSize: 14, color: "#64748b", fontWeight: "bold" },
  qrCrestSub: { fontSize: 9, fontWeight: "900", color: "#64748b", letterSpacing: 1, marginTop: 4 },
  qrTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", marginTop: 2, marginBottom: 12 },
  qrCodeBox: {
    backgroundColor: "#f8fafc",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  mockQRCode: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  qrTokenMono: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4338ca",
    marginTop: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  qrMetaBox: { width: "100%", backgroundColor: "#f8fafc", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  qrMetaLine: { fontSize: 12, color: "#334155", marginBottom: 3 },
  qrMetaLabel: { fontWeight: "700", color: "#64748b" },
  qrMetaVal: { fontWeight: "800", color: "#0f172a" },
  qrBtnRow: { flexDirection: "row", gap: 10, width: "100%" },
  waBtn: { flex: 1, backgroundColor: "#059669", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  waBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  shareSheetBtn: { flex: 1, backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  shareSheetText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
});
