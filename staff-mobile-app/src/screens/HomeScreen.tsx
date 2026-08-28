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
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [cars, setCars] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barrierStatus, setBarrierStatus] = useState<string | null>(null);
  const [triggeringBarrier, setTriggeringBarrier] = useState(false);
  const [selectedGate, setSelectedGate] = useState("Gate 1");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicleQR, setSelectedVehicleQR] = useState<any | null>(null);
  const [newPlate, setNewPlate] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newColor, setNewColor] = useState("green");
  const [savingCar, setSavingCar] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [carsRes, lotsRes] = await Promise.all([
        api.getCars().catch(() => ({ cars: [] })),
        api.getLots().catch(() => ({ lots: [] })),
      ]);
      setCars(carsRes.cars || []);
      setLots(lotsRes.lots || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenBarrier = async () => {
    try {
      setTriggeringBarrier(true);
      const res = await api.openBarrier();
      setBarrierStatus(`✅ Barrier Opened at ${res.gate || selectedGate} (12s Pulse)`);
      setTimeout(() => setBarrierStatus(null), 6000);
    } catch (err: any) {
      setBarrierStatus(`❌ ${err.message || "Failed to open barrier"}`);
      setTimeout(() => setBarrierStatus(null), 5000);
    } finally {
      setTriggeringBarrier(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!newPlate.trim()) {
      Alert.alert("Error", "Please enter license plate number");
      return;
    }

    try {
      setSavingCar(true);
      const res = await api.registerCar({
        plateNumber: newPlate.toUpperCase().trim(),
        modelName: newModel.trim() || undefined,
        stickerColor: newColor,
        vehicleType: "CAR",
      });
      setShowAddModal(false);
      setNewPlate("");
      setNewModel("");
      loadData();
      Alert.alert("Success", "Vehicle registered & synced with ANPR cameras!");
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message || "Could not register vehicle");
    } finally {
      setSavingCar(false);
    }
  };

  const handleShareVehicleBadge = async (car: any) => {
    const msg = `🏛️ Thapar University Vehicle Security Badge\nPlate: ${car.plateNumber}\nModel: ${car.modelName || "Registered Vehicle"}\nTier: ${car.stickerColor.toUpperCase()} STICKER\nFaculty: ${user?.name || "Prof. Rajesh Sharma"}`;
    try {
      await Share.share({ message: msg, title: "Vehicle Security Pass" });
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Faculty Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>Faculty Member</Text>
              <Text style={styles.userName}>{user?.name || "Prof. Rajesh Sharma"}</Text>
              <Text style={styles.userDept}>
                🏢 {user?.department || "Computer Science"} • ID: {user?.facultyId || "FAC-4092"}
              </Text>
            </View>
            <View style={styles.permitBadge}>
              <Text style={styles.permitBadgeText}>● ACTIVE</Text>
            </View>
          </View>

          {/* Gate Selector Row */}
          <View style={styles.gateSelectorRow}>
            {["Gate 1", "Gate 2", "Gate 3", "Gate 4"].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.gatePill, selectedGate === g && styles.gatePillActive]}
                onPress={() => setSelectedGate(g)}
              >
                <Text
                  style={[
                    styles.gatePillText,
                    selectedGate === g && styles.gatePillTextActive,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 1-Tap Barrier Remote Open Button */}
          <TouchableOpacity
            style={[styles.barrierBtn, triggeringBarrier && styles.btnDisabled]}
            onPress={handleOpenBarrier}
            disabled={triggeringBarrier}
            activeOpacity={0.85}
          >
            {triggeringBarrier ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.barrierBtnContent}>
                <Text style={styles.barrierBtnIcon}>⚡</Text>
                <View>
                  <Text style={styles.barrierBtnText}>1-Tap Open {selectedGate}</Text>
                  <Text style={styles.barrierBtnSub}>Direct relay pulse • 12s opening</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {barrierStatus && (
            <View style={styles.statusToast}>
              <Text style={styles.statusToastText}>{barrierStatus}</Text>
            </View>
          )}
        </View>

        {/* Live Parking Lots Availability */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🅿️ Live Campus Parking Zones</Text>
            <Text style={styles.sectionSub}>Auto-Refresh 10s</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lotsRow}>
            {lots.map((lot) => (
              <View key={lot.id} style={styles.lotCard}>
                <View style={styles.lotTop}>
                  <Text style={styles.lotZone}>{lot.code || lot.zone}</Text>
                  <Text style={styles.lotFreeNum}>{lot.freeSlots} Free</Text>
                </View>
                <Text style={styles.lotName} numberOfLines={1}>
                  {lot.name}
                </Text>
                <Text style={styles.lotMeta}>
                  {lot.occupied} / {lot.totalCapacity} slots ({lot.occupancyPercentage}%)
                </Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(100, lot.occupancyPercentage)}%`,
                        backgroundColor:
                          lot.occupancyPercentage >= 90
                            ? "#ef4444"
                            : lot.occupancyPercentage >= 70
                            ? "#f59e0b"
                            : "#10b981",
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* My Registered Vehicles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚗 My Registered Vehicles ({cars.length})</Text>
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={styles.actionLink}>+ Register Car</Text>
            </TouchableOpacity>
          </View>

          {cars.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No vehicles linked yet</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.smallAddBtnText}>+ Register Car / Bike</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cars.map((car) => {
              const isGreen = car.stickerColor === "green";
              const isBlue = car.stickerColor === "blue";
              return (
                <TouchableOpacity
                  key={car.id}
                  style={styles.carCard}
                  onPress={() => setSelectedVehicleQR(car)}
                  activeOpacity={0.8}
                >
                  <View style={styles.carInfo}>
                    <Text style={styles.carPlate}>{car.plateNumber}</Text>
                    <Text style={styles.carModel}>{car.modelName || car.vehicleType}</Text>
                  </View>

                  <View style={styles.carRightCol}>
                    <View
                      style={[
                        styles.stickerPill,
                        {
                          backgroundColor: isGreen
                            ? "rgba(16, 185, 129, 0.15)"
                            : isBlue
                            ? "rgba(14, 165, 233, 0.15)"
                            : "rgba(244, 63, 94, 0.15)",
                          borderColor: isGreen ? "#10b981" : isBlue ? "#0ea5e9" : "#f43f5e",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stickerText,
                          { color: isGreen ? "#34d399" : isBlue ? "#38bdf8" : "#fb7185" },
                        ]}
                      >
                        {car.stickerColor.toUpperCase()} TIER
                      </Text>
                    </View>
                    <Text style={styles.viewBadgeHint}>View QR ➔</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Quick Access Grid */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate("GateScanner")}
          >
            <Text style={styles.quickIcon}>📷</Text>
            <Text style={styles.quickTitle}>Scan Gate QR</Text>
            <Text style={styles.quickDesc}>Camera barrier trigger</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate("VIPPasses")}
          >
            <Text style={styles.quickIcon}>🎟️</Text>
            <Text style={styles.quickTitle}>VIP Passes</Text>
            <Text style={styles.quickDesc}>Issue guest passes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ADD VEHICLE MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Campus Vehicle</Text>
            <Text style={styles.modalSub}>
              Synced instantly with Honeywell ANPR camera allowlist.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>License Plate (e.g. PB11BH8820) *</Text>
              <TextInput
                style={styles.modalInput}
                value={newPlate}
                onChangeText={(t) => setNewPlate(t.toUpperCase())}
                placeholder="PB11BH8820"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Vehicle Model &amp; Color</Text>
              <TextInput
                style={styles.modalInput}
                value={newModel}
                onChangeText={setNewModel}
                placeholder="Honda City (Pearl White)"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Sticker Tier</Text>
              <View style={styles.colorRow}>
                {["green", "blue", "red"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorChoice,
                      newColor === c && styles.colorChoiceActive,
                    ]}
                    onPress={() => setNewColor(c)}
                  >
                    <Text
                      style={[
                        styles.colorChoiceText,
                        newColor === c && styles.colorChoiceTextActive,
                      ]}
                    >
                      {c.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddVehicle}
                disabled={savingCar}
              >
                {savingCar ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Vehicle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VEHICLE DIGITAL SECURITY BADGE QR MODAL */}
      {selectedVehicleQR && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.modalBg}>
            <View style={styles.whiteQRCard}>
              <TouchableOpacity
                style={styles.qrCloseBtn}
                onPress={() => setSelectedVehicleQR(null)}
              >
                <Text style={styles.qrCloseText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.qrCrestSub}>THAPAR UNIVERSITY VEHICLE BADGE</Text>
              <Text style={styles.qrTitle}>Security Clearance QR</Text>

              <View style={styles.qrCodeBox}>
                <Text style={styles.mockQRCode}>🚗 [VEHICLE QR]</Text>
                <Text style={styles.qrTokenMono}>{selectedVehicleQR.plateNumber}</Text>
              </View>

              <View style={styles.qrMetaBox}>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Model: </Text>
                  <Text style={styles.qrMetaVal}>
                    {selectedVehicleQR.modelName || selectedVehicleQR.vehicleType}
                  </Text>
                </Text>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Tier: </Text>
                  <Text style={styles.qrMetaVal}>
                    {selectedVehicleQR.stickerColor.toUpperCase()} PERMIT
                  </Text>
                </Text>
                <Text style={styles.qrMetaLine}>
                  <Text style={styles.qrMetaLabel}>Owner: </Text>
                  <Text style={styles.qrMetaVal}>{user?.name || "Faculty Member"}</Text>
                </Text>
              </View>

              <View style={styles.qrBtnRow}>
                <TouchableOpacity
                  style={styles.shareSheetBtn}
                  onPress={() => handleShareVehicleBadge(selectedVehicleQR)}
                >
                  <Text style={styles.shareSheetText}>📤 Share Security Badge</Text>
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
  profileCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 16,
  },
  profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  welcomeText: { fontSize: 11, color: "#818cf8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  userName: { fontSize: 18, fontWeight: "900", color: "#ffffff", marginTop: 2 },
  userDept: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  permitBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  permitBadgeText: { color: "#34d399", fontSize: 10, fontWeight: "900" },
  gateSelectorRow: { flexDirection: "row", gap: 6, marginTop: 14, marginBottom: 10 },
  gatePill: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  gatePillActive: { backgroundColor: "#312e81", borderColor: "#6366f1" },
  gatePillText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  gatePillTextActive: { color: "#ffffff" },
  barrierBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  barrierBtnContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  barrierBtnIcon: { fontSize: 22 },
  barrierBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  barrierBtnSub: { color: "#c7d2fe", fontSize: 10, marginTop: 1 },
  btnDisabled: { opacity: 0.5 },
  statusToast: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  statusToastText: { color: "#34d399", fontSize: 12, fontWeight: "700", textAlign: "center" },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#f8fafc" },
  sectionSub: { fontSize: 11, color: "#64748b" },
  actionLink: { color: "#818cf8", fontSize: 12, fontWeight: "700" },
  lotsRow: { flexDirection: "row" },
  lotCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    width: 170,
    marginRight: 10,
  },
  lotTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  lotZone: { color: "#818cf8", fontSize: 11, fontWeight: "900" },
  lotFreeNum: { color: "#34d399", fontSize: 11, fontWeight: "800" },
  lotName: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  lotMeta: { color: "#64748b", fontSize: 10, marginTop: 4, marginBottom: 8 },
  progressBg: { height: 5, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 3 },
  carCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carInfo: { flex: 1 },
  carPlate: { color: "#ffffff", fontSize: 15, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  carModel: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  carRightCol: { alignItems: "flex-end" },
  stickerPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  stickerText: { fontSize: 10, fontWeight: "800" },
  viewBadgeHint: { color: "#64748b", fontSize: 10, marginTop: 4 },
  emptyCard: { backgroundColor: "#0f172a", padding: 20, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  emptyText: { color: "#64748b", fontSize: 12, marginBottom: 8 },
  smallAddBtn: { backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  smallAddBtnText: { color: "#818cf8", fontSize: 11, fontWeight: "700" },
  quickGrid: { flexDirection: "row", gap: 10, marginTop: 6 },
  quickCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
  },
  quickIcon: { fontSize: 24, marginBottom: 4 },
  quickTitle: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  quickDesc: { color: "#64748b", fontSize: 10, marginTop: 1 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#0f172a", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#1e293b" },
  modalTitle: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  modalSub: { color: "#64748b", fontSize: 11, marginTop: 2, marginBottom: 14 },
  fieldGroup: { marginBottom: 12 },
  label: { color: "#cbd5e1", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  modalInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 13,
  },
  colorRow: { flexDirection: "row", gap: 8 },
  colorChoice: { flex: 1, backgroundColor: "#020617", borderWidth: 1, borderColor: "#334155", paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  colorChoiceActive: { backgroundColor: "#312e81", borderColor: "#6366f1" },
  colorChoiceText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  colorChoiceTextActive: { color: "#ffffff" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: "#1e293b", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalCancelText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  modalSaveBtn: { flex: 1, backgroundColor: "#4f46e5", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalSaveText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
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
    fontSize: 16,
    fontWeight: "900",
    color: "#4338ca",
    marginTop: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  qrMetaBox: { width: "100%", backgroundColor: "#f8fafc", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  qrMetaLine: { fontSize: 12, color: "#334155", marginBottom: 3 },
  qrMetaLabel: { fontWeight: "700", color: "#64748b" },
  qrMetaVal: { fontWeight: "800", color: "#0f172a" },
  qrBtnRow: { width: "100%" },
  shareSheetBtn: { backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  shareSheetText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
});
