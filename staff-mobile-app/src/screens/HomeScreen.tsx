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

  // Add Vehicle Modal
  const [showAddModal, setShowAddModal] = useState(false);
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
      setBarrierStatus(`✅ Barrier Opened at ${res.gate || "Main Gate"}`);
      setTimeout(() => setBarrierStatus(null), 5000);
    } catch (err: any) {
      setBarrierStatus(`❌ ${err.message || "Failed to open barrier"}`);
      setTimeout(() => setBarrierStatus(null), 5000);
    } finally {
      setTriggeringBarrier(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!newPlate) {
      Alert.alert("Error", "Please enter license plate number");
      return;
    }

    try {
      setSavingCar(true);
      await api.registerCar({
        plateNumber: newPlate.toUpperCase().trim(),
        modelName: newModel,
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

  return (
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
          <View>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.userName}>{user?.name || "Dr. Faculty"}</Text>
            <Text style={styles.userDept}>
              🏢 {user?.department || "Faculty"} • ID: {user?.facultyId || "FAC-001"}
            </Text>
          </View>
          <View style={styles.permitBadge}>
            <Text style={styles.permitBadgeText}>ACTIVE PERMIT</Text>
          </View>
        </View>

        {/* 1-Tap Barrier Remote Open Button */}
        <TouchableOpacity
          style={[styles.barrierBtn, triggeringBarrier && styles.btnDisabled]}
          onPress={handleOpenBarrier}
          disabled={triggeringBarrier}
        >
          {triggeringBarrier ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.barrierBtnIcon}>⚡</Text>
              <Text style={styles.barrierBtnText}>1-Tap Open Gate Barrier</Text>
            </>
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
          <Text style={styles.sectionTitle}>🅿️ Live Campus Parking Lots</Text>
          <Text style={styles.sectionSub}>Live Slot Count</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lotsRow}>
          {lots.map((lot) => (
            <View key={lot.id} style={styles.lotCard}>
              <View style={styles.lotTop}>
                <Text style={styles.lotZone}>{lot.code}</Text>
                <Text style={styles.lotFreeNum}>{lot.freeSlots}</Text>
              </View>
              <Text style={styles.lotName} numberOfLines={1}>
                {lot.name}
              </Text>
              <Text style={styles.lotMeta}>
                {lot.occupied} / {lot.totalCapacity} occupied ({lot.occupancyPercentage}%)
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
            <Text style={styles.actionLink}>+ Add Vehicle</Text>
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
              <View key={car.id} style={styles.carCard}>
                <View style={styles.carInfo}>
                  <Text style={styles.carPlate}>{car.plateNumber}</Text>
                  <Text style={styles.carModel}>{car.modelName || car.vehicleType}</Text>
                </View>
                <View
                  style={[
                    styles.stickerPill,
                    {
                      backgroundColor: isGreen ? "#064e3b" : isBlue ? "#0c4a6e" : "#4c0519",
                      borderColor: isGreen ? "#059669" : isBlue ? "#0284c7" : "#e11d48",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stickerText,
                      { color: isGreen ? "#34d399" : isBlue ? "#38bdf8" : "#fb7185" },
                    ]}
                  >
                    {car.stickerColor.toUpperCase()} STICKER
                  </Text>
                </View>
              </View>
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
          <Text style={styles.quickDesc}>Unlock gate barrier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate("VIPPasses")}
        >
          <Text style={styles.quickIcon}>🎟️</Text>
          <Text style={styles.quickTitle}>VIP Guest Pass</Text>
          <Text style={styles.quickDesc}>Instant QR passes</Text>
        </TouchableOpacity>
      </View>

      {/* Add Vehicle Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Campus Vehicle</Text>
            <Text style={styles.modalSub}>
              Your vehicle plate will be synced directly with Honeywell ANPR cameras.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>License Plate (e.g. PB11BH8820)</Text>
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
              <Text style={styles.label}>Vehicle Model & Color</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  userName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
  },
  userDept: {
    fontSize: 12,
    color: "#cbd5e1",
    marginTop: 4,
  },
  permitBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  permitBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "800",
  },
  barrierBtn: {
    backgroundColor: "#059669",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  barrierBtnIcon: {
    fontSize: 16,
  },
  barrierBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  statusToast: {
    backgroundColor: "#020617",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 10,
  },
  statusToastText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11,
    color: "#64748b",
  },
  actionLink: {
    color: "#818cf8",
    fontSize: 12,
    fontWeight: "700",
  },
  lotsRow: {
    flexDirection: "row",
  },
  lotCard: {
    backgroundColor: "#0f172a",
    width: 170,
    borderRadius: 18,
    padding: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  lotTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  lotZone: {
    fontSize: 10,
    fontWeight: "800",
    color: "#818cf8",
    backgroundColor: "#1e1b4b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lotFreeNum: {
    fontSize: 16,
    fontWeight: "900",
    color: "#34d399",
  },
  lotName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 2,
  },
  lotMeta: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 6,
  },
  progressBg: {
    height: 4,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  carCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  carInfo: {
    flex: 1,
  },
  carPlate: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  carModel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  stickerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  stickerText: {
    fontSize: 10,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 10,
  },
  smallAddBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallAddBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
  },
  quickIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  quickDesc: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  modalSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#ffffff",
  },
  colorRow: {
    flexDirection: "row",
    gap: 8,
  },
  colorChoice: {
    flex: 1,
    backgroundColor: "#020617",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  colorChoiceActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#6366f1",
  },
  colorChoiceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
  },
  colorChoiceTextActive: {
    color: "#ffffff",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCancelText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  modalSaveBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
