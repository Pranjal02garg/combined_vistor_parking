import React, { useState, useEffect, useRef } from "react";
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
  SafeAreaView,
  Image,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

type StaffTab = "parking" | "guests" | "house_helps" | "notices";

const SERVICE_CATEGORIES = [
  { id: "MAID", label: "Maid / Domestic Help", icon: "🧹" },
  { id: "COOK", label: "Cook / Chef", icon: "🍳" },
  { id: "DRIVER", label: "Driver", icon: "🚗" },
  { id: "CLEANER", label: "Cleaner", icon: "🧼" },
  { id: "GARDENER", label: "Gardener", icon: "🌱" },
  { id: "OTHER", label: "Other Staff", icon: "👤" },
];

const ID_PROOF_TYPES = [
  { id: "AADHAAR", label: "Aadhaar Card" },
  { id: "VOTER_ID", label: "Voter ID Card" },
  { id: "DRIVING_LICENSE", label: "Driving License" },
  { id: "PASSPORT", label: "Passport" },
  { id: "OTHER", label: "Other Govt Photo ID" },
];

const VEHICLE_TYPES = [
  { id: "CAR", label: "Car (4-Wheeler)", icon: "🚗" },
  { id: "BIKE", label: "Motorcycle / Scooter (2-Wheeler)", icon: "🛵" },
  { id: "EV", label: "Electric Vehicle (EV)", icon: "⚡" },
];

export default function StaffPortalScreen() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<StaffTab>("parking");
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [cars, setCars] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);
  const [helps, setHelps] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Barrier state
  const [barrierStatus, setBarrierStatus] = useState<string | null>(null);
  const [triggeringBarrier, setTriggeringBarrier] = useState(false);
  const [selectedGate, setSelectedGate] = useState("Gate 1");

  // Modals
  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [showCreatePassModal, setShowCreatePassModal] = useState(false);
  const [showAddHelpModal, setShowAddHelpModal] = useState(false);
  const [showGateScannerModal, setShowGateScannerModal] = useState(false);
  const [selectedVehicleQR, setSelectedVehicleQR] = useState<any | null>(null);
  const [selectedPassQR, setSelectedPassQR] = useState<any | null>(null);
  const [selectedHelpQR, setSelectedHelpQR] = useState<any | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [carsRes, lotsRes, passesRes, helpsRes] = await Promise.all([
        api.getCars().catch(() => ({ cars: [] })),
        api.getLots().catch(() => ({ lots: [] })),
        api.getVIPPasses().catch(() => ({ passes: [] })),
        api.getHouseHelps().catch(() => ({ helps: [] })),
      ]);

      setCars(carsRes?.cars || []);
      setLots(lotsRes?.lots || []);
      setPasses(passesRes?.passes || []);
      setHelps(helpsRes?.helps || []);

      setNotices([
        {
          id: "not_1",
          title: "Annual Faculty Parking Sticker Verification",
          severity: "MEDIUM",
          createdAt: new Date().toISOString(),
          description: "All faculty vehicles must verify their Fast-Lane ANPR / RFID sticker at Gate 1 security office.",
          resolution: "Active notice for Faculty Residence Block B.",
        },
      ]);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top Sticky Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.crestBox}>
            <Text style={styles.crestText}>🏛️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.mainTitle}>Thapar Staff Hub</Text>
              <View style={styles.facultyPill}>
                <Text style={styles.facultyPillText}>Faculty Console</Text>
              </View>
            </View>
            <Text style={styles.facultySub} numberOfLines={1}>
              {user?.name || "Prof. Rajesh Sharma"}
            </Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* 4-Tab Navigation Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollBar}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {[
            { id: "parking", label: "Parking & Access", icon: "🚗", count: cars.length },
            { id: "guests", label: "Guest Passes", icon: "🎟️", count: passes.length },
            { id: "house_helps", label: "House Helps & Maids", icon: "🧹", count: helps.length },
            { id: "notices", label: "Security Notices", icon: "⚠️", count: notices.length },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as StaffTab)}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Tab Content */}
      <ScrollView
        style={styles.mainContent}
        contentContainerStyle={styles.scrollPadding}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAllData();
            }}
            tintColor="#818cf8"
          />
        }
      >
        {/* TAB 1: PARKING & GATE ACCESS */}
        {activeTab === "parking" && (
          <View style={styles.sectionSpace}>
            {/* Faculty Permit Card */}
            <View style={styles.cardDark}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSuperTitle}>FACULTY PARKING PERMIT</Text>
                  <Text style={styles.cardBigTitle}>{user?.name || "Prof. Rajesh Sharma"}</Text>
                  <Text style={styles.cardMetaText}>
                    🏢 {user?.department || "Computer Science"} • ID: {user?.facultyId || "FAC-4092"}
                  </Text>
                </View>
                <View style={styles.activePermitPill}>
                  <Text style={styles.activePermitText}>● PERMIT ACTIVE</Text>
                </View>
              </View>

              {/* Gate Selector */}
              <View style={styles.gatePillsRow}>
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

              {/* 1-Tap Pulse Button */}
              <TouchableOpacity
                style={[styles.barrierPulseBtn, triggeringBarrier && styles.btnDisabled]}
                onPress={handleOpenBarrier}
                disabled={triggeringBarrier}
                activeOpacity={0.85}
              >
                {triggeringBarrier ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View style={styles.barrierBtnInner}>
                    <Text style={styles.barrierZap}>⚡</Text>
                    <View>
                      <Text style={styles.barrierPulseText}>1-Tap Open {selectedGate}</Text>
                      <Text style={styles.barrierPulseSub}>Remote pulse • 12s opening</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {barrierStatus && (
                <View style={styles.barrierToast}>
                  <Text style={styles.barrierToastText}>{barrierStatus}</Text>
                </View>
              )}
            </View>

            {/* Live Lots Availability Meter */}
            <View style={styles.blockSection}>
              <View style={styles.blockSectionHeader}>
                <Text style={styles.blockTitle}>🅿️ Live Campus Parking Zones</Text>
                <Text style={styles.blockSub}>Auto-Refresh 10s</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
                {lots.map((lot) => (
                  <View key={lot.id} style={styles.lotMeterCard}>
                    <View style={styles.lotMeterTop}>
                      <Text style={styles.lotCodeText}>{lot.code || lot.zone}</Text>
                      <Text style={styles.lotFreeText}>{lot.freeSlots} Free</Text>
                    </View>
                    <Text style={styles.lotNameText} numberOfLines={1}>
                      {lot.name}
                    </Text>
                    <Text style={styles.lotOccupancyText}>
                      {lot.occupied} / {lot.totalCapacity} ({lot.occupancyPercentage}%)
                    </Text>
                    <View style={styles.lotProgressTrack}>
                      <View
                        style={[
                          styles.lotProgressBar,
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

            {/* Registered Vehicles List */}
            <View style={styles.blockSection}>
              <View style={styles.blockSectionHeader}>
                <Text style={styles.blockTitle}>🚗 Registered Vehicles ({cars.length})</Text>
                <TouchableOpacity onPress={() => setShowAddCarModal(true)}>
                  <Text style={styles.accentLink}>+ Register Car</Text>
                </TouchableOpacity>
              </View>

              {cars.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🚗</Text>
                  <Text style={styles.emptyTitle}>No Vehicles Registered</Text>
                  <Text style={styles.emptySub}>Add your license plate for Fast-Lane ANPR auto-entry.</Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setShowAddCarModal(true)}
                  >
                    <Text style={styles.emptyActionText}>+ Register First Vehicle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                cars.map((car) => {
                  const isGreen = car.stickerColor === "green";
                  const isBlue = car.stickerColor === "blue";
                  return (
                    <TouchableOpacity
                      key={car.id}
                      style={styles.carRowCard}
                      onPress={() => setSelectedVehicleQR(car)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.carPlateMono}>{car.plateNumber}</Text>
                        <Text style={styles.carModelText}>{car.modelName || car.vehicleType}</Text>
                        {car.rcDocUrl && (
                          <Text style={{ fontSize: 10, color: "#34d399", marginTop: 2 }}>
                            ✓ RC Document Attached
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={[
                            styles.stickerBadge,
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
                              styles.stickerBadgeText,
                              { color: isGreen ? "#34d399" : isBlue ? "#38bdf8" : "#fb7185" },
                            ]}
                          >
                            {car.stickerColor.toUpperCase()} TIER
                          </Text>
                        </View>
                        <Text style={styles.viewBadgeHint}>▦ View QR Badge ➔</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Quick Gate Scanner Button */}
            <TouchableOpacity
              style={styles.scannerPromptCard}
              onPress={() => setShowGateScannerModal(true)}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 24 }}>📷</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.scannerCardTitle}>Scan Physical Gate Barrier QR</Text>
                <Text style={styles.scannerCardSub}>Point camera at gate barrier QR code to unlock</Text>
              </View>
              <Text style={{ color: "#818cf8", fontSize: 16, fontWeight: "bold" }}>➔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 2: GUEST PASSES */}
        {activeTab === "guests" && (
          <View style={styles.sectionSpace}>
            <View style={styles.tabSectionHeaderRow}>
              <View>
                <Text style={styles.tabSectionBigTitle}>Visitor &amp; Guest Passes</Text>
                <Text style={styles.tabSectionDesc}>
                  Pre-authorized digital passes with instant 1-scan QR entry
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryAddBtn}
                onPress={() => setShowCreatePassModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryAddBtnText}>+ Issue Pass</Text>
              </TouchableOpacity>
            </View>

            {passes.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🎟️</Text>
                <Text style={styles.emptyTitle}>No Guest Passes Created</Text>
                <Text style={styles.emptySub}>
                  Issue self-cleared digital gate passes. Visitors scan QR at Gates 1–4.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setShowCreatePassModal(true)}
                >
                  <Text style={styles.emptyActionText}>+ Issue First Pass</Text>
                </TouchableOpacity>
              </View>
            ) : (
              passes.map((p) => {
                const isCheckedIn = p.status === "CHECKED_IN";

                return (
                  <View key={p.id || p.token} style={styles.itemCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>{p.purpose || "Official Guest"}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
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
                            styles.statusTagText,
                            { color: isCheckedIn ? "#34d399" : "#818cf8" },
                          ]}
                        >
                          {isCheckedIn ? "● On Campus" : p.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.itemName}>{p.guestName}</Text>
                    {p.guestPhone ? (
                      <Text style={styles.itemPhone}>📞 +91 {p.guestPhone}</Text>
                    ) : null}

                    {p.vehicleNumber ? (
                      <View style={styles.vehiclePlateTag}>
                        <Text style={styles.vehiclePlateTagText}>🚗 {p.vehicleNumber}</Text>
                      </View>
                    ) : null}

                    <View style={styles.itemFooterRow}>
                      <Text style={styles.itemCodeMono}>Code: {p.token}</Text>
                      <TouchableOpacity
                        style={styles.itemActionBtn}
                        onPress={() => setSelectedPassQR(p)}
                      >
                        <Text style={styles.itemActionBtnText}>▦ View QR Pass</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: HOUSE HELPS & MAIDS */}
        {activeTab === "house_helps" && (
          <View style={styles.sectionSpace}>
            <View style={styles.tabSectionHeaderRow}>
              <View>
                <Text style={styles.tabSectionBigTitle}>Domestic Staff &amp; Maids</Text>
                <Text style={styles.tabSectionDesc}>
                  Permanent QR passes for maids, cooks, drivers, and assistants
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryAddBtn}
                onPress={() => setShowAddHelpModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryAddBtnText}>+ Add Helper</Text>
              </TouchableOpacity>
            </View>

            {helps.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🧹</Text>
                <Text style={styles.emptyTitle}>No Domestic Staff Registered</Text>
                <Text style={styles.emptySub}>
                  Entering an existing campus mobile number instantly links clearance!
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setShowAddHelpModal(true)}
                >
                  <Text style={styles.emptyActionText}>+ Register First Helper</Text>
                </TouchableOpacity>
              </View>
            ) : (
              helps.map((h) => {
                const isActive = h.isActive !== false;

                return (
                  <View key={h.id || h.token} style={styles.itemCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.purpleTag}>
                        <Text style={styles.purpleTagText}>{h.serviceType}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          {
                            backgroundColor: isActive
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                            borderColor: isActive ? "#10b981" : "#ef4444",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            { color: isActive ? "#34d399" : "#f87171" },
                          ]}
                        >
                          {isActive ? "Active" : "Paused"}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
                      {h.photoUrl ? (
                        <Image source={{ uri: h.photoUrl }} style={styles.helpAvatarImg} />
                      ) : (
                        <View style={styles.helpAvatar}>
                          <Text style={styles.helpAvatarText}>
                            {(h.name || "H").slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{h.name}</Text>
                        <Text style={styles.itemPhone}>📞 +91 {h.phone}</Text>
                      </View>
                    </View>

                    <View style={styles.helpDetailsSubBox}>
                      <Text style={styles.helpDetailLine}>🏠 {h.quarterNumber || "Faculty Quarter"}</Text>
                      {h.idProofNumber ? (
                        <Text style={styles.helpIdLine}>
                          🪪 {h.idProofType || "AADHAAR"}: {h.idProofNumber}
                        </Text>
                      ) : null}
                      {h.idProofDocUrl && (
                        <Text style={{ fontSize: 10, color: "#34d399" }}>✓ ID Proof Scan Attached</Text>
                      )}
                      {h.workShift ? (
                        <Text style={styles.helpShiftLine}>⏰ Shift: {h.workShift}</Text>
                      ) : null}
                    </View>

                    <View style={styles.itemFooterRow}>
                      <TouchableOpacity
                        style={styles.masterQRBtn}
                        onPress={() => setSelectedHelpQR(h)}
                      >
                        <Text style={styles.masterQRBtnText}>▦ Master QR Pass</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.toggleActiveBtn,
                          {
                            backgroundColor: isActive
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                            borderColor: isActive ? "#10b981" : "#ef4444",
                          },
                        ]}
                        onPress={() => {
                          setHelps((prev) =>
                            prev.map((item) =>
                              item.id === h.id ? { ...item, isActive: !item.isActive } : item
                            )
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.toggleActiveText,
                            { color: isActive ? "#34d399" : "#f87171" },
                          ]}
                        >
                          {isActive ? "● Active" : "○ Paused"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.trashBtn}
                        onPress={() => {
                          Alert.alert("Unlink Helper", `Remove ${h.name} from your quarter?`, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Unlink",
                              style: "destructive",
                              onPress: () => {
                                setHelps((prev) => prev.filter((item) => item.id !== h.id));
                              },
                            },
                          ]);
                        }}
                      >
                        <Text style={{ color: "#f87171", fontSize: 13 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: SECURITY NOTICES */}
        {activeTab === "notices" && (
          <View style={styles.sectionSpace}>
            <View>
              <Text style={styles.tabSectionBigTitle}>Campus Security Notices</Text>
              <Text style={styles.tabSectionDesc}>
                Official security updates, incident reports, and residence notices
              </Text>
            </View>

            {notices.map((n) => (
              <View key={n.id} style={styles.noticeCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={styles.noticeTitle}>{n.title}</Text>
                  <View style={styles.severityTag}>
                    <Text style={styles.severityTagText}>{n.severity}</Text>
                  </View>
                </View>
                <Text style={styles.noticeDate}>
                  {new Date(n.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.noticeDesc}>{n.description}</Text>
                {n.resolution ? (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionTitle}>✓ Resolution Status:</Text>
                    <Text style={styles.resolutionText}>{n.resolution}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 1. ADD VEHICLE MODAL */}
      <AddVehicleModal
        visible={showAddCarModal}
        onClose={() => setShowAddCarModal(false)}
        onSaved={(car) => {
          setCars((prev) => [car, ...prev]);
          setShowAddCarModal(false);
        }}
      />

      {/* 2. CREATE GUEST PASS MODAL */}
      <CreateGuestPassModal
        visible={showCreatePassModal}
        onClose={() => setShowCreatePassModal(false)}
        onCreated={(pass) => {
          setPasses((prev) => [pass, ...prev]);
          setShowCreatePassModal(false);
          setSelectedPassQR(pass);
        }}
      />

      {/* 3. ADD HOUSE HELP MODAL */}
      <AddHouseHelpModal
        visible={showAddHelpModal}
        onClose={() => setShowAddHelpModal(false)}
        onCreated={(help) => {
          setHelps((prev) => [help, ...prev]);
          setShowAddHelpModal(false);
          setSelectedHelpQR(help);
        }}
      />

      {/* 4. GATE BARRIER SCANNER MODAL */}
      <GateScannerModal
        visible={showGateScannerModal}
        onClose={() => setShowGateScannerModal(false)}
      />

      {/* 5. VEHICLE SECURITY BADGE QR MODAL */}
      {selectedVehicleQR && (
        <WhiteQRModal
          visible={true}
          title="Vehicle Security Badge"
          sub="THAPAR UNIVERSITY VEHICLE BADGE"
          name={user?.name || "Faculty Member"}
          token={selectedVehicleQR.plateNumber}
          qrValue={`https://campus.thapar.edu/vehicle/${selectedVehicleQR.plateNumber}`}
          meta={[
            { label: "Model", value: selectedVehicleQR.modelName || selectedVehicleQR.vehicleType },
            { label: "Tier", value: `${selectedVehicleQR.stickerColor.toUpperCase()} PERMIT` },
            { label: "Faculty", value: user?.name || "Faculty Member" },
          ]}
          onClose={() => setSelectedVehicleQR(null)}
        />
      )}

      {/* 6. GUEST PASS QR MODAL */}
      {selectedPassQR && (
        <WhiteQRModal
          visible={true}
          title="Digital Guest Pass"
          sub="THAPAR GATE CLEARANCE"
          name={selectedPassQR.guestName}
          token={selectedPassQR.token}
          phone={selectedPassQR.guestPhone}
          qrValue={`https://campus.thapar.edu/pass/${selectedPassQR.token}`}
          meta={[
            { label: "Guest", value: selectedPassQR.guestName },
            { label: "Purpose", value: selectedPassQR.purpose || "Campus Visit" },
            { label: "Phone", value: selectedPassQR.guestPhone || "N/A" },
          ]}
          onClose={() => setSelectedPassQR(null)}
        />
      )}

      {/* 7. HOUSE HELP MASTER QR MODAL */}
      {selectedHelpQR && (
        <WhiteQRModal
          visible={true}
          title="Master Security Pass"
          sub="PERMANENT DOMESTIC STAFF CLEARANCE"
          name={selectedHelpQR.name}
          token={selectedHelpQR.token}
          phone={selectedHelpQR.phone}
          qrValue={`https://campus.thapar.edu/pass/${selectedHelpQR.token}`}
          meta={[
            { label: "Name", value: selectedHelpQR.name },
            { label: "Service", value: selectedHelpQR.serviceType },
            { label: "Quarter", value: selectedHelpQR.quarterNumber },
          ]}
          onClose={() => setSelectedHelpQR(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Modals
// ─────────────────────────────────────────────────────────────────────────────

function AddVehicleModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (car: any) => void;
}) {
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("green");
  const [vehicleType, setVehicleType] = useState("CAR");
  const [rcDocUrl, setRcDocUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickRCDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setRcDocUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Notice", "Photo library access needed for document upload.");
    }
  };

  const handleSubmit = async () => {
    if (!plate.trim()) {
      Alert.alert("Error", "Please enter license plate");
      return;
    }
    setSaving(true);
    try {
      const res = await api.registerCar({
        plateNumber: plate.toUpperCase().trim(),
        modelName: model.trim() || undefined,
        stickerColor: color,
        vehicleType,
      });
      onSaved(res.car || { id: `car_${Date.now()}`, plateNumber: plate.toUpperCase().trim(), modelName: model, stickerColor: color, vehicleType, rcDocUrl });
      setPlate("");
      setModel("");
      setRcDocUrl(null);
    } catch {
      onSaved({ id: `car_${Date.now()}`, plateNumber: plate.toUpperCase().trim(), modelName: model, stickerColor: color, vehicleType, rcDocUrl });
      setPlate("");
      setModel("");
      setRcDocUrl(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Register Campus Vehicle</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Vehicle Type</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    modalStyles.tierBtn,
                    vehicleType === v.id && modalStyles.tierBtnActive,
                  ]}
                  onPress={() => setVehicleType(v.id)}
                >
                  <Text style={{ fontSize: 12 }}>{v.icon}</Text>
                  <Text style={[modalStyles.tierText, vehicleType === v.id && modalStyles.tierTextActive]}>
                    {v.label.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modalStyles.label}>License Plate (e.g. PB11BH8820) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="PB11BH8820"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
            />

            <Text style={modalStyles.label}>Model &amp; Color</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="Honda City (White)"
              placeholderTextColor="#64748b"
              value={model}
              onChangeText={setModel}
            />

            <Text style={modalStyles.label}>Sticker Tier</Text>
            <View style={modalStyles.tierRow}>
              {["green", "blue", "red"].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[modalStyles.tierBtn, color === c && modalStyles.tierBtnActive]}
                  onPress={() => setColor(c)}
                >
                  <Text style={[modalStyles.tierText, color === c && modalStyles.tierTextActive]}>
                    {c.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Document Upload */}
            <Text style={modalStyles.label}>Vehicle RC Document (Optional)</Text>
            {rcDocUrl ? (
              <View style={modalStyles.uploadPreviewBox}>
                <Image source={{ uri: rcDocUrl }} style={modalStyles.uploadThumb} />
                <Text style={modalStyles.uploadAttachedText}>✓ RC Attached</Text>
                <TouchableOpacity onPress={() => setRcDocUrl(null)} style={{ marginLeft: "auto" }}>
                  <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "bold" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickRCDocument}>
                <Text style={modalStyles.uploadBtnText}>📄 Upload RC Scan</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={modalStyles.submitBtn}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={modalStyles.submitBtnText}>Save Vehicle</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CreateGuestPassModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (pass: any) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [purpose, setPurpose] = useState("Academic Guest / Faculty Visit");
  const [visitType, setVisitType] = useState<"OFFICIAL" | "PERSONAL">("OFFICIAL");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      Alert.alert("Required", "Please enter guest full name");
      return;
    }
    setSaving(true);
    try {
      const res = await api.createVIPPass({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        purpose,
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : undefined,
      });
      onCreated(res.pass || {
        id: `vip_${Date.now()}`,
        token: `VIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        guestName,
        guestPhone,
        purpose,
        vehicleNumber,
        status: "APPROVED",
      });
    } catch {
      onCreated({
        id: `vip_${Date.now()}`,
        token: `VIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        guestName,
        guestPhone,
        purpose,
        vehicleNumber,
        status: "APPROVED",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Issue Visitor Gate Pass</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Toggle */}
            <Text style={modalStyles.label}>Purpose Category</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
              <TouchableOpacity
                style={[
                  modalStyles.tierBtn,
                  visitType === "OFFICIAL" && modalStyles.tierBtnActive,
                ]}
                onPress={() => {
                  setVisitType("OFFICIAL");
                  setPurpose("Official Academic Meeting");
                }}
              >
                <Text style={[modalStyles.tierText, visitType === "OFFICIAL" && modalStyles.tierTextActive]}>
                  Official / Academic
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  modalStyles.tierBtn,
                  visitType === "PERSONAL" && modalStyles.tierBtnActive,
                ]}
                onPress={() => {
                  setVisitType("PERSONAL");
                  setPurpose("Personal Guest / Relative Visit");
                }}
              >
                <Text style={[modalStyles.tierText, visitType === "PERSONAL" && modalStyles.tierTextActive]}>
                  Personal / Relative
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={modalStyles.label}>Guest Full Name *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Dr. Arvind Subramanian"
              placeholderTextColor="#64748b"
              value={guestName}
              onChangeText={setGuestName}
            />

            <Text style={modalStyles.label}>Mobile Number (10 Digits, Optional)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={guestPhone}
              onChangeText={setGuestPhone}
            />

            <Text style={modalStyles.label}>Purpose Description</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. External Reviewer Meeting"
              placeholderTextColor="#64748b"
              value={purpose}
              onChangeText={setPurpose}
            />

            <Text style={modalStyles.label}>Vehicle License Plate (Optional)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. PB11BH8820"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />

            <TouchableOpacity
              style={modalStyles.submitBtn}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={modalStyles.submitBtnText}>Issue Gate Pass</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddHouseHelpModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (help: any) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("MAID");
  const [quarterNumber, setQuarterNumber] = useState("Faculty Residence B-104");
  const [workShift, setWorkShift] = useState("Morning (07:00 - 11:00)");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [idProofDocUrl, setIdProofDocUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIdProofDocUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Notice", "Photo library access needed for ID scan upload.");
    }
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Notice", "Photo library access needed for helper selfie upload.");
    }
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert("Required", "Please enter 10-digit mobile number");
      return;
    }
    const clean = phone.replace(/[^0-9]/g, "").slice(-10);
    const newH = {
      id: `hlp_${Date.now()}`,
      token: `HLP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      name: name.trim() || "Domestic Helper",
      phone: clean,
      serviceType,
      quarterNumber,
      workShift,
      idProofType,
      idProofNumber: idProofNumber.trim() || undefined,
      idProofDocUrl: idProofDocUrl || undefined,
      photoUrl: photoUrl || undefined,
      isActive: true,
      status: "APPROVED",
    };
    onCreated(newH);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Register or Link Staff</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={modalStyles.autoLinkBanner}>
              <Text style={modalStyles.autoLinkTitle}>⚡ 10-Digit Mobile Auto-Link</Text>
              <Text style={modalStyles.autoLinkDesc}>
                Entering an existing campus mobile links clearance immediately!
              </Text>
            </View>

            <Text style={modalStyles.label}>Helper Mobile (10 Digits) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 9876500111"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={modalStyles.label}>Helper Full Name *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Sunita Devi"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />

            {/* Service Category Buttons */}
            <Text style={modalStyles.label}>Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {SERVICE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      modalStyles.tierBtn,
                      serviceType === cat.id && modalStyles.tierBtnActive,
                      { paddingHorizontal: 10 },
                    ]}
                    onPress={() => setServiceType(cat.id)}
                  >
                    <Text style={{ fontSize: 11 }}>{cat.icon}</Text>
                    <Text style={[modalStyles.tierText, serviceType === cat.id && modalStyles.tierTextActive]}>
                      {cat.label.split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalStyles.label}>Your Quarter / House</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Quarter 14B"
              placeholderTextColor="#64748b"
              value={quarterNumber}
              onChangeText={setQuarterNumber}
            />

            {/* ID Proof Type Selector */}
            <Text style={modalStyles.label}>Government ID Proof Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {ID_PROOF_TYPES.map((idType) => (
                  <TouchableOpacity
                    key={idType.id}
                    style={[
                      modalStyles.tierBtn,
                      idProofType === idType.id && modalStyles.tierBtnActive,
                      { paddingHorizontal: 10 },
                    ]}
                    onPress={() => setIdProofType(idType.id)}
                  >
                    <Text style={[modalStyles.tierText, idProofType === idType.id && modalStyles.tierTextActive]}>
                      {idType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalStyles.label}>ID Proof Number</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 9102-8812-4410"
              placeholderTextColor="#64748b"
              value={idProofNumber}
              onChangeText={setIdProofNumber}
            />

            {/* Document and Face Photo Uploads */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {/* ID Scan */}
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>Aadhaar/ID Scan</Text>
                {idProofDocUrl ? (
                  <View style={modalStyles.uploadPreviewBox}>
                    <Image source={{ uri: idProofDocUrl }} style={modalStyles.uploadThumb} />
                    <Text style={modalStyles.uploadAttachedText}>✓ Attached</Text>
                    <TouchableOpacity onPress={() => setIdProofDocUrl(null)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "bold" }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickDocument}>
                    <Text style={modalStyles.uploadBtnText}>📄 Upload ID</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Face Photo */}
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>Helper Photo</Text>
                {photoUrl ? (
                  <View style={modalStyles.uploadPreviewBox}>
                    <Image source={{ uri: photoUrl }} style={modalStyles.uploadThumb} />
                    <Text style={modalStyles.uploadAttachedText}>✓ Attached</Text>
                    <TouchableOpacity onPress={() => setPhotoUrl(null)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "bold" }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickPhoto}>
                    <Text style={modalStyles.uploadBtnText}>📷 Upload Selfie</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[modalStyles.submitBtn, { backgroundColor: "#8b5cf6" }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={modalStyles.submitBtnText}>Submit Staff Clearance</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function GateScannerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<string | null>(null);

  const simulateGate = (g: string) => {
    setStatus(`✅ Success: Barrier Opened at Gate ${g}`);
    setTimeout(() => {
      setStatus(null);
      onClose();
    }, 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Gate Barrier QR Scanner</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.viewfinder}>
            <Text style={{ color: "#64748b", fontSize: 12 }}>Point camera at barrier QR</Text>
          </View>

          {status && (
            <View style={modalStyles.toastBox}>
              <Text style={modalStyles.toastText}>{status}</Text>
            </View>
          )}

          <Text style={modalStyles.label}>⚡ Quick Gate Simulators</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["1", "2", "3", "4"].map((g) => (
              <TouchableOpacity
                key={g}
                style={modalStyles.gateSimBtn}
                onPress={() => simulateGate(g)}
              >
                <Text style={modalStyles.gateSimText}>Gate {g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WhiteQRModal({
  visible,
  title,
  sub,
  name,
  token,
  phone,
  qrValue,
  meta,
  onClose,
}: {
  visible: boolean;
  title: string;
  sub: string;
  name: string;
  token: string;
  phone?: string;
  qrValue?: string;
  meta: { label: string; value: string }[];
  onClose: () => void;
}) {
  const finalQRData = qrValue || `https://campus.thapar.edu/pass/${token}`;
  const [sharingImg, setSharingImg] = useState(false);
  const qrSvgRef = useRef<any>(null);

  const handleWhatsApp = async () => {
    const msg = `🏛️ *THAPAR UNIVERSITY GATE PASS*\n\n📋 *Pass Type:* ${title}\n👤 *Issued For:* ${name}\n🔑 *Token Code:* ${token}\n\n🔗 *Digital QR Pass:* ${finalQRData}\n\n_Show this QR at Campus Gate 1–4 for 1-scan barrier entry._`;
    const cleanPhone = phone?.replace(/[^0-9]/g, "") || "";
    const waUrl = cleanPhone.length >= 10
      ? `whatsapp://send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const webFallback = cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL(webFallback);
      }
    } catch {
      await Share.share({
        message: msg,
        title: `Gate Pass - ${name}`,
      });
    }
  };

  const handleSharePass = async () => {
    const msg = `🏛️ Thapar University Gate Pass\nPass Type: ${title}\nIssued For: ${name}\nToken: ${token}\nDigital Pass Link: ${finalQRData}`;
    try {
      setSharingImg(true);
      if (qrSvgRef.current && qrSvgRef.current.toDataURL) {
        qrSvgRef.current.toDataURL(async (data: string) => {
          try {
            const filename = `${FileSystem.cacheDirectory}pass_${token}.png`;
            await FileSystem.writeAsStringAsync(filename, data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filename, {
                mimeType: "image/png",
                dialogTitle: `Share Gate Pass: ${name}`,
              });
              setSharingImg(false);
              return;
            }
          } catch {}
          await Share.share({ message: msg, title: `Gate Pass - ${name}` });
          setSharingImg(false);
        });
      } else {
        await Share.share({ message: msg, title: `Gate Pass - ${name}` });
        setSharingImg(false);
      }
    } catch {
      await Share.share({ message: msg, title: `Gate Pass - ${name}` });
      setSharingImg(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.whiteCard}>
          <TouchableOpacity style={modalStyles.whiteCloseBtn} onPress={onClose}>
            <Text style={modalStyles.whiteCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={modalStyles.whiteCrestSub}>{sub}</Text>
          <Text style={modalStyles.whiteTitle}>{title}</Text>

          {/* Genuine 2D Vector Scannable QR Matrix with ref */}
          <View style={modalStyles.qrBox}>
            <QRCode
              value={finalQRData}
              size={180}
              color="#0f172a"
              backgroundColor="#ffffff"
              quietZone={10}
              getRef={(c) => (qrSvgRef.current = c)}
            />
            <Text style={modalStyles.qrCodeBigMono}>{token}</Text>
          </View>

          <View style={modalStyles.metaContainer}>
            {meta.map((m, idx) => (
              <View key={idx} style={modalStyles.metaLineRow}>
                <Text style={modalStyles.metaLineLabel}>{m.label}: </Text>
                <Text style={modalStyles.metaLineVal}>{m.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
            <TouchableOpacity style={modalStyles.waBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
              <Text style={modalStyles.waBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalStyles.shareBtn} onPress={handleSharePass} activeOpacity={0.85}>
              {sharingImg ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={modalStyles.shareBtnText}>📤 Share QR Image</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#020617" },
  topHeader: { backgroundColor: "#090d16", borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  crestBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  crestText: { fontSize: 18 },
  mainTitle: { fontSize: 15, fontWeight: "900", color: "#ffffff", letterSpacing: -0.3 },
  facultyPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  facultyPillText: { color: "#94a3b8", fontSize: 9, fontWeight: "800" },
  facultySub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  signOutBtn: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  signOutText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  tabsScrollBar: { borderTopWidth: 1, borderTopColor: "#1e293b" },
  tabsScrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tabIcon: { fontSize: 13 },
  tabLabel: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  tabLabelActive: { color: "#ffffff" },
  tabBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeActive: { backgroundColor: "#ffffff" },
  tabBadgeText: { fontSize: 9, fontWeight: "800", color: "#64748b" },
  tabBadgeTextActive: { color: "#0f172a" },
  mainContent: { flex: 1, backgroundColor: "#020617" },
  scrollPadding: { padding: 16, paddingBottom: 60 },
  sectionSpace: { gap: 14 },
  cardDark: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardSuperTitle: { fontSize: 10, fontWeight: "900", color: "#818cf8", letterSpacing: 0.5 },
  cardBigTitle: { fontSize: 17, fontWeight: "900", color: "#ffffff", marginTop: 2 },
  cardMetaText: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  activePermitPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activePermitText: { color: "#34d399", fontSize: 9, fontWeight: "900" },
  gatePillsRow: { flexDirection: "row", gap: 6, marginTop: 12, marginBottom: 8 },
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
  barrierPulseBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 4,
  },
  barrierBtnInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  barrierZap: { fontSize: 20 },
  barrierPulseText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  barrierPulseSub: { color: "#c7d2fe", fontSize: 9 },
  btnDisabled: { opacity: 0.5 },
  barrierToast: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    padding: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  barrierToastText: { color: "#34d399", fontSize: 11, fontWeight: "700", textAlign: "center" },
  blockSection: { marginTop: 4 },
  blockSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  blockTitle: { fontSize: 13, fontWeight: "800", color: "#f8fafc" },
  blockSub: { fontSize: 10, color: "#64748b" },
  accentLink: { color: "#818cf8", fontSize: 11, fontWeight: "700" },
  lotMeterCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    width: 150,
    marginRight: 8,
  },
  lotMeterTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  lotCodeText: { color: "#818cf8", fontSize: 10, fontWeight: "900" },
  lotFreeText: { color: "#34d399", fontSize: 10, fontWeight: "800" },
  lotNameText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  lotOccupancyText: { color: "#64748b", fontSize: 9, marginTop: 2, marginBottom: 6 },
  lotProgressTrack: { height: 4, backgroundColor: "#1e293b", borderRadius: 2, overflow: "hidden" },
  lotProgressBar: { height: "100%", borderRadius: 2 },
  carRowCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carPlateMono: { color: "#ffffff", fontSize: 14, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  carModelText: { color: "#94a3b8", fontSize: 10, marginTop: 1 },
  stickerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  stickerBadgeText: { fontSize: 9, fontWeight: "800" },
  viewBadgeHint: { color: "#818cf8", fontSize: 10, fontWeight: "700", marginTop: 2 },
  scannerPromptCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
  },
  scannerCardTitle: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  scannerCardSub: { color: "#64748b", fontSize: 10, marginTop: 1 },
  tabSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tabSectionBigTitle: { fontSize: 16, fontWeight: "900", color: "#ffffff" },
  tabSectionDesc: { fontSize: 10, color: "#64748b", marginTop: 1 },
  primaryAddBtn: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  primaryAddBtnText: { color: "#0f172a", fontSize: 11, fontWeight: "800" },
  itemCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  categoryTag: { backgroundColor: "#1e293b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryTagText: { color: "#cbd5e1", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusTagText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  purpleTag: { backgroundColor: "rgba(139, 92, 246, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  purpleTagText: { color: "#c084fc", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  itemName: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  itemPhone: { fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  vehiclePlateTag: {
    backgroundColor: "#020617",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 6,
  },
  vehiclePlateTagText: { color: "#cbd5e1", fontSize: 10, fontWeight: "700" },
  itemFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.8)",
  },
  itemCodeMono: { fontSize: 10, color: "#64748b", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  itemActionBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4338ca",
  },
  itemActionBtnText: { color: "#a5b4fc", fontSize: 10, fontWeight: "800" },
  helpAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  helpAvatarText: { color: "#c084fc", fontSize: 13, fontWeight: "900" },
  helpDetailsSubBox: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "rgba(30, 41, 59, 0.6)", gap: 2 },
  helpDetailLine: { fontSize: 11, color: "#cbd5e1" },
  helpIdLine: { fontSize: 10, color: "#34d399", fontWeight: "700" },
  helpShiftLine: { fontSize: 10, color: "#94a3b8" },
  masterQRBtn: { backgroundColor: "#1e1b4b", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#4338ca" },
  masterQRBtnText: { color: "#a5b4fc", fontSize: 10, fontWeight: "800" },
  toggleActiveBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  toggleActiveText: { fontSize: 10, fontWeight: "800" },
  trashBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#1e293b" },
  noticeCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#1e293b" },
  noticeTitle: { fontSize: 14, fontWeight: "800", color: "#ffffff", flex: 1 },
  severityTag: { backgroundColor: "rgba(245, 158, 11, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  severityTagText: { color: "#fbbf24", fontSize: 9, fontWeight: "800" },
  noticeDate: { fontSize: 10, color: "#64748b", marginTop: 2 },
  noticeDesc: { fontSize: 11, color: "#cbd5e1", marginTop: 6, lineHeight: 16 },
  resolutionBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  resolutionTitle: { fontSize: 10, fontWeight: "800", color: "#34d399" },
  resolutionText: { fontSize: 10, color: "#a7f3d0", marginTop: 1 },
  emptyBox: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
  },
  emptyIcon: { fontSize: 32, marginBottom: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: "#ffffff" },
  emptySub: { fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 2, marginBottom: 12 },
  emptyActionBtn: { backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  emptyActionText: { color: "#0f172a", fontSize: 11, fontWeight: "800" },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#0f172a", borderRadius: 22, padding: 18, borderWidth: 1, borderColor: "#1e293b", maxHeight: "90%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "900", color: "#ffffff" },
  closeIcon: { fontSize: 16, color: "#94a3b8", padding: 4 },
  label: { fontSize: 11, fontWeight: "700", color: "#cbd5e1", marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
    fontSize: 12,
  },
  tierRow: { flexDirection: "row", gap: 6 },
  tierBtn: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  tierBtnActive: { backgroundColor: "#312e81", borderColor: "#6366f1" },
  tierText: { color: "#94a3b8", fontSize: 10, fontWeight: "700" },
  tierTextActive: { color: "#ffffff" },
  submitBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  submitBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  autoLinkBanner: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  autoLinkTitle: { fontSize: 10, fontWeight: "800", color: "#c084fc" },
  autoLinkDesc: { fontSize: 9, color: "#cbd5e1", marginTop: 1 },
  uploadBtn: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  uploadBtnText: { color: "#818cf8", fontSize: 11, fontWeight: "700" },
  uploadPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 6,
  },
  uploadThumb: { width: 34, height: 34, borderRadius: 8 },
  uploadAttachedText: { color: "#34d399", fontSize: 10, fontWeight: "700" },
  viewfinder: { height: 160, backgroundColor: "#020617", borderRadius: 16, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  toastBox: { backgroundColor: "rgba(16, 185, 129, 0.15)", padding: 8, borderRadius: 8, marginBottom: 8 },
  toastText: { color: "#34d399", fontSize: 11, fontWeight: "700", textAlign: "center" },
  gateSimBtn: { flex: 1, backgroundColor: "#1e1b4b", paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#4338ca" },
  gateSimText: { color: "#a5b4fc", fontSize: 11, fontWeight: "800" },
  whiteCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  whiteCloseBtn: { position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  whiteCloseText: { fontSize: 12, color: "#64748b", fontWeight: "bold" },
  whiteCrestSub: { fontSize: 8, fontWeight: "900", color: "#64748b", letterSpacing: 0.5 },
  whiteTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a", marginTop: 2, marginBottom: 12 },
  qrBox: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeBigMono: { fontSize: 15, fontWeight: "900", color: "#4338ca", marginTop: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
  metaContainer: { width: "100%", backgroundColor: "#f8fafc", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 12 },
  metaLineRow: { fontSize: 11, color: "#334155", marginBottom: 2 },
  metaLineLabel: { fontWeight: "700", color: "#64748b" },
  metaLineVal: { fontWeight: "800", color: "#0f172a" },
  waBtn: { flex: 1, backgroundColor: "#059669", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  waBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  shareBtn: { flex: 1, backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  shareBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
});
