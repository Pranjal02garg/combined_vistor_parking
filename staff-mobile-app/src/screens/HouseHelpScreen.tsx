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

export default function HouseHelpScreen() {
  const [helps, setHelps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHelpQR, setSelectedHelpQR] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("MAID");
  const [quarterNumber, setQuarterNumber] = useState("Faculty Residence B-104");
  const [workShift, setWorkShift] = useState("Morning (07:00 - 11:00)");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHelps();
  }, []);

  const loadHelps = async () => {
    try {
      setLoading(true);
      const res = await api.getHouseHelps();
      setHelps(res.helps || []);
    } catch {
      // fallback in api.ts
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRegister = async () => {
    if (!phone.trim()) {
      Alert.alert("Required", "Please enter 10-digit helper mobile number");
      return;
    }

    try {
      setSaving(true);
      const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);
      if (cleanPhone.length !== 10) {
        Alert.alert("Invalid Phone", "Mobile number must be 10 digits");
        return;
      }

      const newHelp = {
        id: `hlp_${Date.now()}`,
        token: `HLP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: name.trim() || "Domestic Helper",
        phone: cleanPhone,
        serviceType,
        quarterNumber,
        workShift,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        isActive: true,
        status: "APPROVED",
      };

      setHelps((prev) => [newHelp, ...prev]);
      setShowAddModal(false);
      setName("");
      setPhone("");
      setIdProofNumber("");
      setSelectedHelpQR(newHelp);
      Alert.alert("Staff Linked", "Domestic staff cleared & linked to your quarter!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to register staff");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (helpId: string) => {
    setHelps((prev) =>
      prev.map((h) => (h.id === helpId ? { ...h, isActive: !h.isActive } : h))
    );
  };

  const handleUnlink = (help: any) => {
    Alert.alert(
      "Unlink Staff",
      `Remove entry clearance for ${help.name} from ${help.quarterNumber || "your quarter"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: () => {
            setHelps((prev) => prev.filter((h) => h.id !== help.id));
          },
        },
      ]
    );
  };

  const handleWhatsApp = (help: any) => {
    const passUrl = `https://campus.thapar.edu/pass/${help.token}`;
    const msg = `🏛️ Thapar University Domestic Staff Pass\nName: ${help.name}\nService: ${help.serviceType}\nToken: ${help.token}\nQuarter: ${help.quarterNumber}\nPass: ${passUrl}`;
    const cleanPhone = help.phone?.replace(/[^0-9]/g, "") || "";
    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl);
  };

  const handleShare = async (help: any) => {
    const passUrl = `https://campus.thapar.edu/pass/${help.token}`;
    const msg = `🏛️ Thapar University Domestic Staff Pass\nName: ${help.name}\nService: ${help.serviceType}\nToken: ${help.token}\nQuarter: ${help.quarterNumber}\nPass: ${passUrl}`;
    try {
      await Share.share({ message: msg, url: passUrl, title: "Staff Security Pass" });
    } catch {
      // ignore
    }
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
              loadHelps();
            }}
            tintColor="#818cf8"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Domestic Staff &amp; Maids</Text>
            <Text style={styles.sub}>Permanent QR access passes for household helpers</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Add Helper</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color="#818cf8" size="large" />
            <Text style={styles.loaderText}>Loading domestic staff...</Text>
          </View>
        ) : helps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧹</Text>
            <Text style={styles.emptyTitle}>No Domestic Staff Registered</Text>
            <Text style={styles.emptyDesc}>
              Entering an existing campus mobile number instantly links their clearance.
            </Text>
            <TouchableOpacity
              style={styles.smallAddBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.smallAddText}>+ Register First Helper</Text>
            </TouchableOpacity>
          </View>
        ) : (
          helps.map((h) => {
            const isActive = h.isActive !== false;
            const isApproved = h.status === "APPROVED";

            return (
              <View key={h.id || h.token} style={styles.helpCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarTile}>
                    <Text style={styles.avatarText}>
                      {(h.name || "H").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{h.name}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{h.serviceType}</Text>
                      </View>
                    </View>
                    <Text style={styles.phoneText}>📞 +91 {h.phone}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.detailsBox}>
                  <Text style={styles.detailLine}>🏠 {h.quarterNumber}</Text>
                  {h.idProofNumber ? (
                    <Text style={styles.idBadgeLine}>
                      🪪 {h.idProofType || "AADHAAR"}: {h.idProofNumber}
                    </Text>
                  ) : null}
                  {h.workShift ? (
                    <Text style={styles.shiftLine}>⏰ Shift: {h.workShift}</Text>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.qrActionBtn}
                    onPress={() => setSelectedHelpQR(h)}
                  >
                    <Text style={styles.qrActionText}>Master QR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      {
                        backgroundColor: isActive
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                        borderColor: isActive ? "#10b981" : "#ef4444",
                      },
                    ]}
                    onPress={() => handleToggleActive(h.id)}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        { color: isActive ? "#34d399" : "#f87171" },
                      ]}
                    >
                      {isActive ? "● Active" : "○ Paused"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.unlinkBtn}
                    onPress={() => handleUnlink(h)}
                  >
                    <Text style={styles.unlinkText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* REGISTER / LINK HELPER MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register or Link Staff</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.autoLinkBanner}>
                <Text style={styles.autoLinkTitle}>⚡ Auto-Link Key</Text>
                <Text style={styles.autoLinkDesc}>
                  Entering a phone already registered on campus links clearance immediately!
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Helper Mobile Number (10 Digits) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9876500111"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.fieldLabel}>Helper Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Sunita Devi"
                placeholderTextColor="#64748b"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>Service Category</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. MAID, COOK, DRIVER"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                value={serviceType}
                onChangeText={setServiceType}
              />

              <Text style={styles.fieldLabel}>Your Quarter / House</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Quarter 14B"
                placeholderTextColor="#64748b"
                value={quarterNumber}
                onChangeText={setQuarterNumber}
              />

              <Text style={styles.fieldLabel}>Work Shift</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Morning (07:00 - 11:00)"
                placeholderTextColor="#64748b"
                value={workShift}
                onChangeText={setWorkShift}
              />

              <Text style={styles.fieldLabel}>Aadhaar / Govt ID Proof Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9102-8812-4410"
                placeholderTextColor="#64748b"
                value={idProofNumber}
                onChangeText={setIdProofNumber}
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Staff Clearance</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MASTER QR MODAL */}
      {selectedHelpQR && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.whiteQRCard}>
              <TouchableOpacity
                style={styles.qrCloseBtn}
                onPress={() => setSelectedHelpQR(null)}
              >
                <Text style={styles.qrCloseText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.qrCrestSub}>PERMANENT DOMESTIC STAFF PASS</Text>
              <Text style={styles.qrTitle}>Master Security Pass</Text>

              <View style={styles.qrCodeBox}>
                <Text style={styles.mockQRCode}>🧹 [MASTER QR]</Text>
                <Text style={styles.qrTokenMono}>{selectedHelpQR.token}</Text>
              </View>

              <View style={styles.qrMetaBox}>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Name: </Text>
                  <Text style={styles.qrMetaVal}>{selectedHelpQR.name}</Text>
                </Text>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Service: </Text>
                  <Text style={styles.qrMetaVal}>{selectedHelpQR.serviceType}</Text>
                </Text>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Quarter: </Text>
                  <Text style={styles.qrMetaVal}>{selectedHelpQR.quarterNumber}</Text>
                </Text>
              </View>

              <View style={styles.qrBtnRow}>
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => handleWhatsApp(selectedHelpQR)}
                >
                  <Text style={styles.waBtnText}>💬 WhatsApp Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareSheetBtn}
                  onPress={() => handleShare(selectedHelpQR)}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 },
  sub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  addBtn: { backgroundColor: "#8b5cf6", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
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
  smallAddBtn: { backgroundColor: "#8b5cf6", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  smallAddText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  helpCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatarTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#c084fc", fontSize: 15, fontWeight: "900" },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  badge: { backgroundColor: "rgba(139, 92, 246, 0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: "#c084fc", fontWeight: "800", textTransform: "uppercase" },
  phoneText: { fontSize: 12, color: "#64748b", marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  detailsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.6)",
    gap: 2,
  },
  detailLine: { fontSize: 12, color: "#cbd5e1" },
  idBadgeLine: { fontSize: 11, color: "#34d399", fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  shiftLine: { fontSize: 11, color: "#94a3b8" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.8)",
  },
  qrActionBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  qrActionText: { color: "#f8fafc", fontSize: 11, fontWeight: "700" },
  statusToggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statusToggleText: { fontSize: 11, fontWeight: "800" },
  unlinkBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  unlinkText: { color: "#f87171", fontSize: 12, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#0f172a", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#1e293b", maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  closeIcon: { fontSize: 18, color: "#94a3b8", padding: 4 },
  autoLinkBanner: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  autoLinkTitle: { fontSize: 11, fontWeight: "800", color: "#c084fc" },
  autoLinkDesc: { fontSize: 10, color: "#cbd5e1", marginTop: 2 },
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
    backgroundColor: "#8b5cf6",
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
  qrCrestSub: { fontSize: 9, fontWeight: "900", color: "#8b5cf6", letterSpacing: 1, marginTop: 4 },
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
  mockQRCode: { fontSize: 24, fontWeight: "900", color: "#8b5cf6" },
  qrTokenMono: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6d28d9",
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
