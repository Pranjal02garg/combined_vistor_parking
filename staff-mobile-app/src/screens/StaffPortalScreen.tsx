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
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { api } from "../services/api";

type StaffTab = "parking" | "guests" | "house_helps" | "notices";

const SERVICE_CATEGORIES = [
  { id: "MAID", label: "Maid / Domestic Help" },
  { id: "COOK", label: "Cook / Chef" },
  { id: "DRIVER", label: "Driver" },
  { id: "CLEANER", label: "Cleaner" },
  { id: "GARDENER", label: "Gardener" },
  { id: "OTHER", label: "Other Domestic Staff" },
];

const ID_PROOF_TYPES = [
  { id: "AADHAAR", label: "Aadhaar Card" },
  { id: "VOTER_ID", label: "Voter ID Card" },
  { id: "DRIVING_LICENSE", label: "Driving License" },
  { id: "PASSPORT", label: "Passport" },
  { id: "OTHER", label: "Govt Photo ID" },
];

const VEHICLE_TYPES = [
  { id: "CAR", label: "Car" },
  { id: "BIKE", label: "Two-Wheeler" },
  { id: "EV", label: "Electric EV" },
];

export default function StaffPortalScreen() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
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
  const [passSubTab, setPassSubTab] = useState<"active" | "history">("active");

  // A pass drops into History once the visit is over (exited/rejected) or its
  // validity window has passed; everything else is Active/Recent.
  const isPassHistory = (p: any) => {
    const s = String(p?.status || "").toUpperCase();
    if (s === "EXITED" || s === "REJECTED") return true;
    if (p?.validUntil && new Date(p.validUntil).getTime() < Date.now()) return true;
    return false;
  };

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
          description: "All faculty vehicles must verify their Fast-Lane ANPR RFID sticker at Gate 1 security office.",
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
      setBarrierStatus(`Barrier Opened at ${res.gate || selectedGate} (12s Pulse)`);
      setTimeout(() => setBarrierStatus(null), 6000);
    } catch (err: any) {
      setBarrierStatus(`Error: ${err.message || "Failed to open barrier"}`);
      setTimeout(() => setBarrierStatus(null), 5000);
    } finally {
      setTriggeringBarrier(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.crestBox}>
            <Text style={styles.crestText}>TU</Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.mainTitle} numberOfLines={1}>Thapar Staff Hub</Text>
              <View style={styles.facultyPill}>
                <Text style={styles.facultyPillText}>{t("hdr.faculty")}</Text>
              </View>
            </View>
            <Text style={styles.facultySub} numberOfLines={1}>
              {user?.name || "Prof. Rajesh Sharma"}
            </Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
            <Text style={styles.signOutText} numberOfLines={1}>{t("hdr.signOut")}</Text>
          </TouchableOpacity>
        </View>

        {/* Executive Tab Navigation Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollBar}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {[
            { id: "parking", label: t("tab.parking"), count: cars.length },
            { id: "guests", label: t("tab.guests"), count: passes.length },
            { id: "house_helps", label: t("tab.staff"), count: helps.length },
            { id: "notices", label: t("tab.notices"), count: notices.length },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as StaffTab)}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                activeOpacity={0.8}
              >
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
            tintColor="#7a1f2b"
          />
        }
      >
        {/* TAB 1: PARKING & GATE ACCESS */}
        {activeTab === "parking" && (
          <View style={styles.sectionSpace}>
            {/* Faculty Permit Card */}
            <View style={styles.cardLight}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardSuperTitle}>FACULTY PARKING PERMIT</Text>
                  <Text style={styles.cardBigTitle} numberOfLines={2}>{user?.name || "Prof. Rajesh Sharma"}</Text>
                  <Text style={styles.cardMetaText}>
                    {user?.department || "Computer Science"} • ID: {user?.facultyId || "FAC-4092"}
                  </Text>
                </View>
                <View style={styles.activePermitPill}>
                  <Text style={styles.activePermitText}>PERMIT ACTIVE</Text>
                </View>
              </View>

              {/* 2x2 Gate Selector Grid */}
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
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.barrierPulseText}>1-Tap Open {selectedGate}</Text>
                    <Text style={styles.barrierPulseSub}>Remote pulse • 12s opening</Text>
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
                <Text style={styles.blockTitle}>Campus Parking Zones</Text>
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
                                ? "#b23025"
                                : lot.occupancyPercentage >= 70
                                ? "#a8721f"
                                : "#2e7d4f",
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
                <Text style={styles.blockTitle}>Registered Vehicles ({cars.length})</Text>
                <TouchableOpacity onPress={() => setShowAddCarModal(true)}>
                  <Text style={styles.accentLink}>+ Register Vehicle</Text>
                </TouchableOpacity>
              </View>

              {cars.length === 0 ? (
                <View style={styles.emptyBox}>
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
                          <Text style={{ fontSize: 12, color: "#2e7d4f", marginTop: 4, fontWeight: "600" }}>
                            RC Document Attached
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={[
                            styles.stickerBadge,
                            {
                              backgroundColor: isGreen ? "#e9f2ea" : isBlue ? "#e8eef6" : "#f7e8e5",
                              borderColor: isGreen ? "#c6dfcc" : isBlue ? "#c3d1e4" : "#e8c7c0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stickerBadgeText,
                              { color: isGreen ? "#2e7d4f" : isBlue ? "#33578f" : "#b23025" },
                            ]}
                          >
                            {car.stickerColor.toUpperCase()} TIER
                          </Text>
                        </View>
                        <Text style={styles.viewBadgeHint}>View Badge ›</Text>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.scannerCardTitle}>Scan Gate Barrier Camera QR</Text>
                <Text style={styles.scannerCardSub}>Point phone camera at gate barrier QR code</Text>
              </View>
              <Text style={{ color: "#7a1f2b", fontSize: 14, fontWeight: "700" }}>Scan ›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 2: GUEST PASSES */}
        {activeTab === "guests" && (
          <View style={styles.sectionSpace}>
            <View style={styles.tabSectionHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
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

            {/* Active / History segmented filter */}
            <View style={styles.segRow}>
              {([
                { id: "active", label: "Active", count: passes.filter((p) => !isPassHistory(p)).length },
                { id: "history", label: "History", count: passes.filter(isPassHistory).length },
              ] as const).map((seg) => {
                const on = passSubTab === seg.id;
                return (
                  <TouchableOpacity
                    key={seg.id}
                    style={[styles.segBtn, on && styles.segBtnActive]}
                    onPress={() => setPassSubTab(seg.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.segText, on && styles.segTextActive]}>
                      {seg.label} ({seg.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {(() => {
              const shownPasses =
                passSubTab === "active" ? passes.filter((p) => !isPassHistory(p)) : passes.filter(isPassHistory);
              return shownPasses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  {passSubTab === "active" ? "No Active Passes" : "No Past Passes Yet"}
                </Text>
                <Text style={styles.emptySub}>
                  {passSubTab === "active"
                    ? "Issue self-cleared digital gate passes. Visitors scan QR at Gates 1–4."
                    : "Passes appear here once they expire or the visitor has exited campus."}
                </Text>
                {passSubTab === "active" ? (
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setShowCreatePassModal(true)}
                  >
                    <Text style={styles.emptyActionText}>+ Issue First Pass</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              shownPasses.map((p) => {
                const isCheckedIn = p.status === "CHECKED_IN";

                return (
                  <View key={p.id || p.token} style={styles.itemCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText} numberOfLines={1}>{p.purpose || "Official Guest"}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          {
                            backgroundColor: isCheckedIn ? "#e9f2ea" : "#f2ead9",
                            borderColor: isCheckedIn ? "#c6dfcc" : "#e2c987",
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.statusTagText,
                            { color: isCheckedIn ? "#2e7d4f" : "#8a6420" },
                          ]}
                        >
                          {isCheckedIn ? "● On Campus" : p.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.itemName}>{p.guestName}</Text>
                    {p.guestPhone ? (
                      <Text style={styles.itemPhone}>+91 {p.guestPhone}</Text>
                    ) : null}

                    {p.vehicleNumber ? (
                      <View style={styles.vehiclePlateTag}>
                        <Text style={styles.vehiclePlateTagText}>{p.vehicleNumber}</Text>
                      </View>
                    ) : null}

                    <View style={styles.itemFooterRow}>
                      <Text style={styles.itemCodeMono} numberOfLines={1}>Code: {p.token}</Text>
                      <TouchableOpacity
                        style={styles.itemActionBtn}
                        onPress={() => setSelectedPassQR(p)}
                      >
                        <Text style={styles.itemActionBtnText}>View QR Pass</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            );
            })()}
          </View>
        )}

        {/* TAB 3: HOUSE HELPS & MAIDS */}
        {activeTab === "house_helps" && (
          <View style={styles.sectionSpace}>
            <View style={styles.tabSectionHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
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
              helps.map((h, idx) => {
                const isActive = h.isActive !== false;

                return (
                  <View key={h.id || h.token || `help-${idx}`} style={styles.itemCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.purpleTag}>
                        <Text style={styles.purpleTagText} numberOfLines={1}>{h.serviceType}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          {
                            backgroundColor: isActive ? "#e9f2ea" : "#f7e8e5",
                            borderColor: isActive ? "#c6dfcc" : "#e8c7c0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            { color: isActive ? "#2e7d4f" : "#b23025" },
                          ]}
                        >
                          {isActive ? "Active" : "Paused"}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }}>
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
                        <Text style={styles.itemPhone}>+91 {h.phone}</Text>
                      </View>
                    </View>

                    <View style={styles.helpDetailsSubBox}>
                      <Text style={styles.helpDetailLine}>{h.quarterNumber || "Faculty Quarter"}</Text>
                      {h.idProofNumber ? (
                        <Text style={styles.helpIdLine}>
                          {h.idProofType || "AADHAAR"}: {h.idProofNumber}
                        </Text>
                      ) : null}
                      {h.workShift ? (
                        <Text style={styles.helpShiftLine}>Shift: {h.workShift}</Text>
                      ) : null}
                    </View>

                    {/* 2-Row Stacked Actions */}
                    <View style={styles.itemFooterCol}>
                      <TouchableOpacity
                        style={styles.masterQRBtnFull}
                        onPress={() => setSelectedHelpQR(h)}
                      >
                        <Text style={styles.masterQRBtnText}>Master QR Pass</Text>
                      </TouchableOpacity>

                      <View style={styles.helperActionsSubRow}>
                        <TouchableOpacity
                          style={[
                            styles.toggleActiveBtn,
                            {
                              backgroundColor: isActive ? "#e9f2ea" : "#f7e8e5",
                              borderColor: isActive ? "#c6dfcc" : "#e8c7c0",
                            },
                          ]}
                          onPress={async () => {
                            const next = !isActive;
                            setHelps((prev) =>
                              prev.map((item) =>
                                item.id === h.id ? { ...item, isActive: next } : item
                              )
                            );
                            try {
                              await api.updateHouseHelp(h.id, { isActive: next });
                            } catch {
                              setHelps((prev) =>
                                prev.map((item) =>
                                  item.id === h.id ? { ...item, isActive: isActive } : item
                                )
                              );
                              Alert.alert("Couldn't update", "Please check your connection and try again.");
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.toggleActiveText,
                              { color: isActive ? "#2e7d4f" : "#b23025" },
                            ]}
                          >
                            {isActive ? "Pause Clearance" : "Activate Clearance"}
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
                                onPress: async () => {
                                  const removed = h;
                                  setHelps((prev) => prev.filter((item) => item.id !== h.id));
                                  try {
                                    await api.unlinkHouseHelp(h.id);
                                  } catch {
                                    setHelps((prev) => [removed, ...prev]);
                                    Alert.alert("Couldn't unlink", "Please check your connection and try again.");
                                  }
                                },
                              },
                            ]);
                          }}
                        >
                          <Text style={{ color: "#b23025", fontSize: 16, fontWeight: "600" }}>×</Text>
                        </TouchableOpacity>
                      </View>
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
                    <Text style={styles.resolutionTitle}>Resolution Advisory:</Text>
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
// Sub-Modals (Clean Executive Light)
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
              <Text style={modalStyles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Vehicle Type</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    modalStyles.tierBtn,
                    vehicleType === v.id && modalStyles.tierBtnActive,
                  ]}
                  onPress={() => setVehicleType(v.id)}
                >
                  <Text style={[modalStyles.tierText, vehicleType === v.id && modalStyles.tierTextActive]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modalStyles.label}>License Plate (e.g. PB11BH8820) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="PB11BH8820"
              placeholderTextColor="#a89a8c"
              autoCapitalize="characters"
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
            />

            <Text style={modalStyles.label}>Model &amp; Color</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="Honda City (White)"
              placeholderTextColor="#a89a8c"
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
                <Text style={modalStyles.uploadAttachedText}>RC Attached</Text>
                <TouchableOpacity onPress={() => setRcDocUrl(null)} style={{ marginLeft: "auto" }}>
                  <Text style={{ color: "#b23025", fontSize: 16, fontWeight: "600" }}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickRCDocument}>
                <Text style={modalStyles.uploadBtnText}>Upload RC Scan</Text>
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
      if (res?.pass) {
        onCreated(res.pass);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create pass");
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
              <Text style={modalStyles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Toggle */}
            <Text style={modalStyles.label}>Purpose Category</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
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
              placeholderTextColor="#a89a8c"
              value={guestName}
              onChangeText={setGuestName}
            />

            <Text style={modalStyles.label}>Mobile Number (10 Digits, Optional)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#a89a8c"
              keyboardType="phone-pad"
              value={guestPhone}
              onChangeText={setGuestPhone}
            />

            <Text style={modalStyles.label}>Purpose Description</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. External Reviewer Meeting"
              placeholderTextColor="#a89a8c"
              value={purpose}
              onChangeText={setPurpose}
            />

            <Text style={modalStyles.label}>Vehicle License Plate (Optional)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. PB11BH8820"
              placeholderTextColor="#a89a8c"
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
    setSaving(true);
    try {
      const res = await api.registerHouseHelp({
        phone: phone.trim(),
        name: name.trim() || undefined,
        serviceType,
        quarterNumber,
        workShift,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        idProofDocUrl: idProofDocUrl || undefined,
        photoUrl: photoUrl || undefined,
      });
      if (res?.help) {
        onCreated(res.help);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to register staff");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Register or Link Staff</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={modalStyles.autoLinkBanner}>
              <Text style={modalStyles.autoLinkTitle}>10-Digit Mobile Auto-Link</Text>
              <Text style={modalStyles.autoLinkDesc}>
                Entering an existing campus mobile links clearance immediately.
              </Text>
            </View>

            <Text style={modalStyles.label}>Helper Mobile (10 Digits) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 9876500111"
              placeholderTextColor="#a89a8c"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={modalStyles.label}>Helper Full Name *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Sunita Devi"
              placeholderTextColor="#a89a8c"
              value={name}
              onChangeText={setName}
            />

            {/* Service Category Buttons */}
            <Text style={modalStyles.label}>Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SERVICE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      modalStyles.tierBtn,
                      serviceType === cat.id && modalStyles.tierBtnActive,
                      { paddingHorizontal: 14 },
                    ]}
                    onPress={() => setServiceType(cat.id)}
                  >
                    <Text style={[modalStyles.tierText, serviceType === cat.id && modalStyles.tierTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalStyles.label}>Your Quarter / House</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Quarter 14B"
              placeholderTextColor="#a89a8c"
              value={quarterNumber}
              onChangeText={setQuarterNumber}
            />

            {/* ID Proof Type Selector */}
            <Text style={modalStyles.label}>Government ID Proof Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ID_PROOF_TYPES.map((idType) => (
                  <TouchableOpacity
                    key={idType.id}
                    style={[
                      modalStyles.tierBtn,
                      idProofType === idType.id && modalStyles.tierBtnActive,
                      { paddingHorizontal: 14 },
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
              placeholderTextColor="#a89a8c"
              value={idProofNumber}
              onChangeText={setIdProofNumber}
            />

            {/* Document and Face Photo Uploads */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              {/* ID Scan */}
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>Aadhaar/ID Scan</Text>
                {idProofDocUrl ? (
                  <View style={modalStyles.uploadPreviewBox}>
                    <Image source={{ uri: idProofDocUrl }} style={modalStyles.uploadThumb} />
                    <Text style={modalStyles.uploadAttachedText}>Attached</Text>
                    <TouchableOpacity onPress={() => setIdProofDocUrl(null)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: "#b23025", fontSize: 16, fontWeight: "600" }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickDocument}>
                    <Text style={modalStyles.uploadBtnText}>Upload ID</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Face Photo */}
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>Helper Photo</Text>
                {photoUrl ? (
                  <View style={modalStyles.uploadPreviewBox}>
                    <Image source={{ uri: photoUrl }} style={modalStyles.uploadThumb} />
                    <Text style={modalStyles.uploadAttachedText}>Attached</Text>
                    <TouchableOpacity onPress={() => setPhotoUrl(null)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: "#b23025", fontSize: 16, fontWeight: "600" }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={modalStyles.uploadBtn} onPress={pickPhoto}>
                    <Text style={modalStyles.uploadBtnText}>Upload Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={modalStyles.submitBtn}
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
    setStatus(`Barrier Opened at Gate ${g}`);
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
              <Text style={modalStyles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.viewfinder}>
            <Text style={{ color: "#64748b", fontSize: 14 }}>Point camera at barrier QR</Text>
          </View>

          {status && (
            <View style={modalStyles.toastBox}>
              <Text style={modalStyles.toastText}>{status}</Text>
            </View>
          )}

          <Text style={modalStyles.label}>Quick Gate Emulators</Text>
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
  meta,
  onClose,
}: {
  visible: boolean;
  title: string;
  sub: string;
  name: string;
  token: string;
  phone?: string;
  meta: { label: string; value: string }[];
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const qrSvgRef = useRef<any>(null);

  // Global scannable QR image link
  const universalQRImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    token
  )}`;

  const handleShareQRImageFile = async () => {
    try {
      setSharing(true);
      if (qrSvgRef.current && qrSvgRef.current.toDataURL) {
        qrSvgRef.current.toDataURL(async (base64Raw: string) => {
          try {
            const cleanBase64 = base64Raw.includes(",") ? base64Raw.split(",")[1] : base64Raw;
            const fileUri = `${FileSystem.cacheDirectory}Pass_${token.replace(/[^a-zA-Z0-9]/g, "_")}.png`;

            await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });

            const isAvail = await Sharing.isAvailableAsync();
            if (isAvail) {
              await Sharing.shareAsync(fileUri, {
                mimeType: "image/png",
                dialogTitle: `Share Gate Pass: ${name}`,
                UTI: "public.png",
              });
            } else {
              await Share.share({
                message: `Thapar University Gate Pass\n${name}\nCode: ${token}\nView QR: ${universalQRImageUrl}`,
              });
            }
          } catch {
            await Share.share({
              message: `Thapar University Gate Pass\n${name}\nCode: ${token}\nView QR: ${universalQRImageUrl}`,
            });
          } finally {
            setSharing(false);
          }
        });
      } else {
        await Share.share({
          message: `Thapar University Gate Pass\n${name}\nCode: ${token}\nView QR: ${universalQRImageUrl}`,
        });
        setSharing(false);
      }
    } catch {
      setSharing(false);
    }
  };

  const handleWhatsAppMessage = async () => {
    const msg = `THAPAR UNIVERSITY GATE CLEARANCE\n\nPass: ${title}\nIssued For: ${name}\nToken Code: ${token}\n\nInstant Scannable QR Pass:\n${universalQRImageUrl}\n\nPresent this QR code to security at Gate 1–4 for 1-scan barrier entry.`;
    const cleanPhone = phone?.replace(/[^0-9]/g, "") || "";
    const nativeWa = cleanPhone.length >= 10
      ? `whatsapp://send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const webWa = cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    try {
      const canOpen = await Linking.canOpenURL(nativeWa);
      if (canOpen) {
        await Linking.openURL(nativeWa);
      } else {
        await Linking.openURL(webWa);
      }
    } catch {
      await Share.share({
        message: msg,
        title: `Gate Pass - ${name}`,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.whiteCard}>
          <TouchableOpacity style={modalStyles.whiteCloseBtn} onPress={onClose}>
            <Text style={modalStyles.whiteCloseText}>×</Text>
          </TouchableOpacity>

          <Text style={modalStyles.whiteCrestSub}>{sub}</Text>
          <Text style={modalStyles.whiteTitle}>{title}</Text>

          {/* Large 210px Vector Scannable QR Matrix */}
          <View style={modalStyles.qrBox}>
            <QRCode
              value={token}
              size={210}
              color="#5e1720"
              backgroundColor="#ffffff"
              quietZone={12}
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

          {/* Dual Action Buttons */}
          <View style={{ gap: 10, width: "100%" }}>
            <TouchableOpacity
              style={modalStyles.shareImgMainBtn}
              onPress={handleShareQRImageFile}
              disabled={sharing}
              activeOpacity={0.85}
            >
              {sharing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={modalStyles.shareImgMainBtnText}>Send QR Image to WhatsApp / Contacts</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={modalStyles.waTextBtn}
              onPress={handleWhatsAppMessage}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.waTextBtnText}>Send WhatsApp Text &amp; QR Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Light Styles
// ─────────────────────────────────────────────────────────────────────────────
/*
 * THAPAR BRAND THEME — institutional crest identity
 *   brand maroon  #7a1f2b   header band · primary buttons · active states
 *   brand deep    #5e1720   crest text / pressed
 *   gold          #a8792e   eyebrow labels · crest badge · permit seal (secondary, sparing)
 *   gold soft     #c9a24b   crest badge fill
 *   cream bg      #f4ede1   warm canvas (no pure white)
 *   surface       #fffdf7   warm white cards
 *   hairline      #e7dcc8   warm gold-gray border (borders do the work)
 *   ink           #2c2320   warm near-black text
 *   sub           #766358   warm taupe secondary
 *   faint         #a89a8c   tertiary / codes
 *   success #2e7d4f  warning #a8721f  danger #b23025  (muted, meaning only)
 *   radius   controls 12 · cards 16 · modal 20
 *   type     serif display (Georgia/serif) for titles · sans for body/labels · mono for codes
 *   shadow   one warm soft token (brown tint, low opacity) — hairlines lead
 */
const BRAND_SERIF = Platform.OS === "ios" ? "Georgia" : "serif";
const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#7a1f2b" },
  topHeader: { backgroundColor: "#7a1f2b", borderBottomWidth: 3, borderBottomColor: "#c9a24b" },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  crestBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#c9a24b",
    borderWidth: 1,
    borderColor: "#e0c684",
    alignItems: "center",
    justifyContent: "center",
  },
  crestText: { fontSize: 17, fontWeight: "700", color: "#5e1720", fontFamily: BRAND_SERIF, letterSpacing: 0.5 },
  mainTitle: { fontSize: 19, fontWeight: "700", color: "#fdf6ea", fontFamily: BRAND_SERIF, letterSpacing: 0.2, flexShrink: 1 },
  facultyPill: {
    backgroundColor: "rgba(201,162,75,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(224,198,132,0.5)",
    flexShrink: 0,
  },
  facultyPillText: { color: "#f0dcac", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  facultySub: { fontSize: 13, color: "#e7cdb8", marginTop: 3, fontWeight: "500" },
  signOutBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(253,246,234,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexShrink: 0,
  },
  signOutText: { color: "#f3e7d6", fontSize: 12, fontWeight: "600" },
  tabsScrollBar: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.18)" },
  tabsScrollContent: { paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  tabButtonActive: {
    backgroundColor: "#f4ede1",
    borderColor: "#f4ede1",
  },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#eccfb9" },
  tabLabelActive: { color: "#7a1f2b", fontWeight: "700" },
  tabBadge: {
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: { backgroundColor: "#7a1f2b" },
  tabBadgeText: { fontSize: 11, fontWeight: "700", color: "#f0dcac" },
  tabBadgeTextActive: { color: "#fdf6ea" },
  mainContent: { flex: 1, backgroundColor: "#f4ede1" },
  scrollPadding: { padding: 16, paddingBottom: 70 },
  sectionSpace: { gap: 16 },
  cardLight: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    shadowColor: "#4a2c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardSuperTitle: { fontSize: 11, fontWeight: "700", color: "#a8792e", letterSpacing: 1.2, textTransform: "uppercase" },
  cardBigTitle: { fontSize: 23, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, marginTop: 5, letterSpacing: -0.2 },
  cardMetaText: { fontSize: 13, color: "#766358", marginTop: 5, fontWeight: "500" },
  activePermitPill: {
    backgroundColor: "#f7edd6",
    borderWidth: 1,
    borderColor: "#e2c987",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activePermitText: { color: "#8a6420", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  gatePillsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginTop: 18, marginBottom: 14 },
  gatePill: {
    width: "48%",
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#e7dcc8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  gatePillActive: { backgroundColor: "#7a1f2b", borderColor: "#7a1f2b" },
  gatePillText: { color: "#766358", fontSize: 13, fontWeight: "600" },
  gatePillTextActive: { color: "#fdf6ea", fontWeight: "700" },
  barrierPulseBtn: {
    backgroundColor: "#7a1f2b",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#5e1720",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  barrierPulseText: { color: "#fdf6ea", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  barrierPulseSub: { color: "#e7c9b0", fontSize: 11, marginTop: 2, fontWeight: "500" },
  btnDisabled: { opacity: 0.5 },
  barrierToast: {
    backgroundColor: "#e9f2ea",
    borderWidth: 1,
    borderColor: "#c6dfcc",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  barrierToastText: { color: "#2e7d4f", fontSize: 13, fontWeight: "600", textAlign: "center" },
  blockSection: { marginTop: 6 },
  blockSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  blockTitle: { fontSize: 16, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, letterSpacing: -0.2 },
  blockSub: { fontSize: 12, color: "#a8792e", fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  accentLink: { color: "#7a1f2b", fontSize: 13, fontWeight: "700" },
  lotMeterCard: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    width: 170,
    marginRight: 10,
    shadowColor: "#4a2c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  lotMeterTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  lotCodeText: { color: "#7a1f2b", fontSize: 12, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
  lotFreeText: { color: "#2e7d4f", fontSize: 12, fontWeight: "700" },
  lotNameText: { color: "#2c2320", fontSize: 13, fontWeight: "600" },
  lotOccupancyText: { color: "#766358", fontSize: 11, marginTop: 4, marginBottom: 8 },
  lotProgressTrack: { height: 6, backgroundColor: "#efe6d5", borderRadius: 3, overflow: "hidden" },
  lotProgressBar: { height: "100%", borderRadius: 3 },
  carRowCard: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#4a2c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  carPlateMono: { color: "#2c2320", fontSize: 16, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
  carModelText: { color: "#766358", fontSize: 12, marginTop: 2 },
  stickerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  stickerBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  viewBadgeHint: { color: "#7a1f2b", fontSize: 12, fontWeight: "700", marginTop: 6 },
  scannerPromptCard: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    flexDirection: "row",
    alignItems: "center",
  },
  scannerCardTitle: { color: "#2c2320", fontSize: 14, fontWeight: "700" },
  scannerCardSub: { color: "#766358", fontSize: 12, marginTop: 2 },
  tabSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tabSectionBigTitle: { fontSize: 22, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, letterSpacing: -0.3 },
  tabSectionDesc: { fontSize: 12, color: "#766358", marginTop: 3 },
  primaryAddBtn: {
    backgroundColor: "#7a1f2b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryAddBtnText: { color: "#fdf6ea", fontSize: 13, fontWeight: "700" },
  segRow: { flexDirection: "row", gap: 6, backgroundColor: "#f2ead9", padding: 4, borderRadius: 12, borderWidth: 1, borderColor: "#e7dcc8" },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segBtnActive: { backgroundColor: "#7a1f2b" },
  segText: { fontSize: 13, fontWeight: "600", color: "#8a6420" },
  segTextActive: { color: "#fdf6ea", fontWeight: "700" },
  itemCard: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    shadowColor: "#4a2c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 },
  categoryTag: { backgroundColor: "#f2ead9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 1 },
  categoryTagText: { color: "#8a6420", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  statusTagText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  purpleTag: { backgroundColor: "#f2ead9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 1 },
  purpleTagText: { color: "#8a6420", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  itemName: { fontSize: 18, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, letterSpacing: -0.2 },
  itemPhone: { fontSize: 13, color: "#766358", marginTop: 3, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  vehiclePlateTag: {
    backgroundColor: "#f7f1e6",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    marginTop: 8,
  },
  vehiclePlateTagText: { color: "#5b4a40", fontSize: 12, fontWeight: "600", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  itemFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe6d5",
    gap: 12,
  },
  itemFooterCol: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe6d5",
    gap: 8,
  },
  itemCodeMono: { flex: 1, fontSize: 12, color: "#a89a8c", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  itemActionBtn: {
    backgroundColor: "#f7f1e6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    flexShrink: 0,
  },
  itemActionBtnText: { color: "#2c2320", fontSize: 12, fontWeight: "700" },
  helpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f2ead9",
    borderWidth: 1,
    borderColor: "#e2c987",
    alignItems: "center",
    justifyContent: "center",
  },
  helpAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2c987",
  },
  helpAvatarText: { color: "#8a6420", fontSize: 16, fontWeight: "700", fontFamily: BRAND_SERIF },
  helpDetailsSubBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#efe6d5", gap: 4 },
  helpDetailLine: { fontSize: 13, color: "#5b4a40" },
  helpIdLine: { fontSize: 12, color: "#2e7d4f", fontWeight: "600" },
  helpShiftLine: { fontSize: 12, color: "#766358" },
  masterQRBtnFull: {
    backgroundColor: "#7a1f2b",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  masterQRBtnText: { color: "#fdf6ea", fontSize: 13, fontWeight: "700" },
  helperActionsSubRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  toggleActiveBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  toggleActiveText: { fontSize: 12, fontWeight: "700" },
  trashBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#fffdf7", borderWidth: 1, borderColor: "#e7dcc8", alignItems: "center" },
  noticeCard: { backgroundColor: "#fffdf7", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#e7dcc8", borderLeftWidth: 3, borderLeftColor: "#7a1f2b" },
  noticeTitle: { fontSize: 17, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, flex: 1, letterSpacing: -0.2 },
  severityTag: { backgroundColor: "#f8eeda", borderWidth: 1, borderColor: "#ead4a6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  severityTagText: { color: "#a8721f", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  noticeDate: { fontSize: 12, color: "#a89a8c", marginTop: 4 },
  noticeDesc: { fontSize: 13, color: "#5b4a40", marginTop: 8, lineHeight: 20 },
  resolutionBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#e9f2ea",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c6dfcc",
  },
  resolutionTitle: { fontSize: 12, fontWeight: "700", color: "#2e7d4f" },
  resolutionText: { fontSize: 12, color: "#27633f", marginTop: 2 },
  emptyBox: {
    backgroundColor: "#fffdf7",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dccbae",
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF },
  emptySub: { fontSize: 13, color: "#766358", textAlign: "center", marginTop: 4, marginBottom: 16 },
  emptyActionBtn: { backgroundColor: "#7a1f2b", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyActionText: { color: "#fdf6ea", fontSize: 13, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(44, 16, 21, 0.6)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fffdf7", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "#e7dcc8", borderTopWidth: 3, borderTopColor: "#c9a24b", maxHeight: "90%", shadowColor: "#2c1015", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 19, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, letterSpacing: -0.2 },
  closeIcon: { fontSize: 20, color: "#766358", padding: 4 },
  label: { fontSize: 11, fontWeight: "700", color: "#8a6420", marginTop: 12, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" },
  input: {
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#ddceb4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2c2320",
    fontSize: 14,
  },
  tierRow: { flexDirection: "row", gap: 8 },
  tierBtn: {
    flex: 1,
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#e7dcc8",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  tierBtnActive: { backgroundColor: "#7a1f2b", borderColor: "#7a1f2b" },
  tierText: { color: "#766358", fontSize: 12, fontWeight: "600" },
  tierTextActive: { color: "#fdf6ea", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#7a1f2b",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
    shadowColor: "#5e1720",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: { color: "#fdf6ea", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  autoLinkBanner: {
    backgroundColor: "#f7edd6",
    borderWidth: 1,
    borderColor: "#e2c987",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  autoLinkTitle: { fontSize: 12, fontWeight: "700", color: "#8a6420" },
  autoLinkDesc: { fontSize: 11, color: "#9a7530", marginTop: 2 },
  uploadBtn: {
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#ddceb4",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  uploadBtnText: { color: "#7a1f2b", fontSize: 13, fontWeight: "700" },
  uploadPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#e7dcc8",
    borderRadius: 12,
    padding: 8,
  },
  uploadThumb: { width: 40, height: 40, borderRadius: 10 },
  uploadAttachedText: { color: "#2e7d4f", fontSize: 12, fontWeight: "600" },
  viewfinder: { height: 180, backgroundColor: "#2c2320", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  toastBox: { backgroundColor: "#e9f2ea", borderWidth: 1, borderColor: "#c6dfcc", padding: 10, borderRadius: 12, marginBottom: 10 },
  toastText: { color: "#2e7d4f", fontSize: 13, fontWeight: "600", textAlign: "center" },
  gateSimBtn: { flex: 1, backgroundColor: "#f2ead9", paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#e2c987" },
  gateSimText: { color: "#8a6420", fontSize: 13, fontWeight: "700" },
  whiteCard: {
    backgroundColor: "#fffdf7",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderTopWidth: 3,
    borderTopColor: "#c9a24b",
    shadowColor: "#2c1015",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  whiteCloseBtn: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "#f2ead9", borderWidth: 1, borderColor: "#e2c987", alignItems: "center", justifyContent: "center" },
  whiteCloseText: { fontSize: 16, color: "#766358", fontWeight: "600" },
  whiteCrestSub: { fontSize: 9, fontWeight: "700", color: "#a8792e", letterSpacing: 1.0, textTransform: "uppercase" },
  whiteTitle: { fontSize: 19, fontWeight: "700", color: "#2c2320", fontFamily: BRAND_SERIF, marginTop: 4, marginBottom: 14, letterSpacing: -0.2 },
  qrBox: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
    shadowColor: "#4a2c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  qrCodeBigMono: { fontSize: 18, fontWeight: "700", color: "#2c2320", marginTop: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
  metaContainer: { width: "100%", backgroundColor: "#f7f1e6", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e7dcc8", marginBottom: 14 },
  metaLineRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", marginBottom: 4 },
  metaLineLabel: { fontSize: 13, fontWeight: "600", color: "#766358" },
  metaLineVal: { fontSize: 13, fontWeight: "700", color: "#2c2320" },
  shareImgMainBtn: {
    backgroundColor: "#7a1f2b",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    shadowColor: "#5e1720",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  shareImgMainBtnText: { color: "#fdf6ea", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  waTextBtn: {
    backgroundColor: "#fffdf7",
    borderWidth: 1,
    borderColor: "#ddceb4",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  waTextBtnText: { color: "#7a1f2b", fontSize: 13, fontWeight: "700" },
});
