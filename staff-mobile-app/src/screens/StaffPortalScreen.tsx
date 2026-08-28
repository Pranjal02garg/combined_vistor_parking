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
      {/* Top Large Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.crestBox}>
            <Text style={styles.crestText}>TU</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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

        {/* Large 4-Tab Navigation Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollBar}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {[
            { id: "parking", label: "Parking & Access", count: cars.length },
            { id: "guests", label: "Guest Passes", count: passes.length },
            { id: "house_helps", label: "Domestic Staff", count: helps.length },
            { id: "notices", label: "Security Notices", count: notices.length },
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
            tintColor="#3b82f6"
          />
        }
      >
        {/* TAB 1: PARKING & GATE ACCESS */}
        {activeTab === "parking" && (
          <View style={styles.sectionSpace}>
            {/* Faculty Permit Large Card */}
            <View style={styles.cardDark}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSuperTitle}>FACULTY PARKING PERMIT</Text>
                  <Text style={styles.cardBigTitle}>{user?.name || "Prof. Rajesh Sharma"}</Text>
                  <Text style={styles.cardMetaText}>
                    {user?.department || "Computer Science"} • ID: {user?.facultyId || "FAC-4092"}
                  </Text>
                </View>
                <View style={styles.activePermitPill}>
                  <Text style={styles.activePermitText}>PERMIT ACTIVE</Text>
                </View>
              </View>

              {/* Gate Selector Buttons */}
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

              {/* 1-Tap Pulse Button (Large) */}
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
                          <Text style={{ fontSize: 12, color: "#34d399", marginTop: 4, fontWeight: "600" }}>
                            RC Document Attached
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
                        <Text style={styles.viewBadgeHint}>View QR Badge ➔</Text>
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
              <Text style={{ color: "#3b82f6", fontSize: 15, fontWeight: "bold" }}>Scan ➔</Text>
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
                              : "rgba(59, 130, 246, 0.15)",
                            borderColor: isCheckedIn ? "#10b981" : "#3b82f6",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            { color: isCheckedIn ? "#34d399" : "#60a5fa" },
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
                      <Text style={styles.itemCodeMono}>Code: {p.token}</Text>
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

                    <View style={styles.itemFooterRow}>
                      <TouchableOpacity
                        style={styles.masterQRBtn}
                        onPress={() => setSelectedHelpQR(h)}
                      >
                        <Text style={styles.masterQRBtnText}>Master QR Pass</Text>
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
                          {isActive ? "Active" : "Paused"}
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
                        <Text style={{ color: "#f87171", fontSize: 14 }}>✕</Text>
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

      {/* 5. VEHICLE SECURITY BADGE QR MODAL (LARGE) */}
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

      {/* 6. GUEST PASS QR MODAL (LARGE) */}
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

      {/* 7. HOUSE HELP MASTER QR MODAL (LARGE) */}
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
// Sub-Modals (Large, Roomy, Clean)
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
                <Text style={modalStyles.uploadAttachedText}>RC Attached</Text>
                <TouchableOpacity onPress={() => setRcDocUrl(null)} style={{ marginLeft: "auto" }}>
                  <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "bold" }}>✕</Text>
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
              <Text style={modalStyles.closeIcon}>✕</Text>
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
              <Text style={modalStyles.closeIcon}>✕</Text>
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
              placeholderTextColor="#64748b"
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
              placeholderTextColor="#64748b"
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
                      <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "bold" }}>✕</Text>
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
                      <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "bold" }}>✕</Text>
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
              style={[modalStyles.submitBtn, { backgroundColor: "#2563eb" }]}
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
              <Text style={modalStyles.closeIcon}>✕</Text>
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

  // Global scannable QR image link that opens on ANY phone/network in the world
  const universalQRImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    token
  )}`;

  // 1. Export actual PNG file and share it via Share Sheet into WhatsApp / Photos
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

  // 2. Direct WhatsApp text message with the working universal QR link
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
            <Text style={modalStyles.whiteCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={modalStyles.whiteCrestSub}>{sub}</Text>
          <Text style={modalStyles.whiteTitle}>{title}</Text>

          {/* Large 220px Vector Scannable QR Matrix */}
          <View style={modalStyles.qrBox}>
            <QRCode
              value={token}
              size={210}
              color="#0f172a"
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

          {/* Dual Action Buttons (Large) */}
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
// Large, Readable Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#020617" },
  topHeader: { backgroundColor: "#090d16", borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  crestBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  crestText: { fontSize: 16, fontWeight: "900", color: "#f8fafc" },
  mainTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff", letterSpacing: -0.3 },
  facultyPill: {
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  facultyPillText: { color: "#bfdbfe", fontSize: 10, fontWeight: "800" },
  facultySub: { fontSize: 13, color: "#94a3b8", marginTop: 2, fontWeight: "500" },
  signOutBtn: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  signOutText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  tabsScrollBar: { borderTopWidth: 1, borderTopColor: "#1e293b" },
  tabsScrollContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  tabButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  tabLabel: { fontSize: 13, fontWeight: "700", color: "#94a3b8" },
  tabLabelActive: { color: "#ffffff" },
  tabBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: { backgroundColor: "#ffffff" },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: "#94a3b8" },
  tabBadgeTextActive: { color: "#1e3a8a" },
  mainContent: { flex: 1, backgroundColor: "#020617" },
  scrollPadding: { padding: 18, paddingBottom: 70 },
  sectionSpace: { gap: 18 },
  cardDark: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardSuperTitle: { fontSize: 11, fontWeight: "900", color: "#3b82f6", letterSpacing: 0.5 },
  cardBigTitle: { fontSize: 22, fontWeight: "900", color: "#ffffff", marginTop: 4 },
  cardMetaText: { fontSize: 13, color: "#94a3b8", marginTop: 4, fontWeight: "500" },
  activePermitPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activePermitText: { color: "#34d399", fontSize: 10, fontWeight: "900" },
  gatePillsRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 12 },
  gatePill: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  gatePillActive: { backgroundColor: "#1e3a8a", borderColor: "#2563eb" },
  gatePillText: { color: "#94a3b8", fontSize: 13, fontWeight: "700" },
  gatePillTextActive: { color: "#ffffff" },
  barrierPulseBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  barrierPulseText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  barrierPulseSub: { color: "#bfdbfe", fontSize: 11, marginTop: 2 },
  btnDisabled: { opacity: 0.5 },
  barrierToast: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  barrierToastText: { color: "#34d399", fontSize: 13, fontWeight: "700", textAlign: "center" },
  blockSection: { marginTop: 6 },
  blockSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  blockTitle: { fontSize: 15, fontWeight: "900", color: "#f8fafc" },
  blockSub: { fontSize: 12, color: "#64748b" },
  accentLink: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },
  lotMeterCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    width: 170,
    marginRight: 10,
  },
  lotMeterTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  lotCodeText: { color: "#3b82f6", fontSize: 12, fontWeight: "900" },
  lotFreeText: { color: "#34d399", fontSize: 12, fontWeight: "800" },
  lotNameText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  lotOccupancyText: { color: "#94a3b8", fontSize: 11, marginTop: 4, marginBottom: 8 },
  lotProgressTrack: { height: 6, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden" },
  lotProgressBar: { height: "100%", borderRadius: 3 },
  carRowCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carPlateMono: { color: "#ffffff", fontSize: 16, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  carModelText: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  stickerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  stickerBadgeText: { fontSize: 10, fontWeight: "800" },
  viewBadgeHint: { color: "#3b82f6", fontSize: 12, fontWeight: "700", marginTop: 4 },
  scannerPromptCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
  },
  scannerCardTitle: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  scannerCardSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  tabSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tabSectionBigTitle: { fontSize: 20, fontWeight: "900", color: "#ffffff" },
  tabSectionDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  primaryAddBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryAddBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  itemCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  categoryTag: { backgroundColor: "#1e293b", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryTagText: { color: "#cbd5e1", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusTagText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  purpleTag: { backgroundColor: "rgba(59, 130, 246, 0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  purpleTagText: { color: "#60a5fa", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  itemName: { fontSize: 17, fontWeight: "800", color: "#ffffff" },
  itemPhone: { fontSize: 13, color: "#94a3b8", marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  vehiclePlateTag: {
    backgroundColor: "#020617",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 8,
  },
  vehiclePlateTagText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  itemFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.8)",
  },
  itemCodeMono: { fontSize: 12, color: "#64748b", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  itemActionBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  itemActionBtnText: { color: "#93c5fd", fontSize: 12, fontWeight: "800" },
  helpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  helpAvatarText: { color: "#60a5fa", fontSize: 16, fontWeight: "900" },
  helpDetailsSubBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(30, 41, 59, 0.6)", gap: 4 },
  helpDetailLine: { fontSize: 13, color: "#cbd5e1" },
  helpIdLine: { fontSize: 12, color: "#34d399", fontWeight: "700" },
  helpShiftLine: { fontSize: 12, color: "#94a3b8" },
  masterQRBtn: { backgroundColor: "#1e293b", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#334155" },
  masterQRBtnText: { color: "#93c5fd", fontSize: 12, fontWeight: "800" },
  toggleActiveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  toggleActiveText: { fontSize: 12, fontWeight: "800" },
  trashBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1e293b" },
  noticeCard: { backgroundColor: "#0f172a", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#1e293b" },
  noticeTitle: { fontSize: 16, fontWeight: "800", color: "#ffffff", flex: 1 },
  severityTag: { backgroundColor: "rgba(245, 158, 11, 0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  severityTagText: { color: "#fbbf24", fontSize: 11, fontWeight: "800" },
  noticeDate: { fontSize: 12, color: "#64748b", marginTop: 4 },
  noticeDesc: { fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 18 },
  resolutionBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  resolutionTitle: { fontSize: 12, fontWeight: "800", color: "#34d399" },
  resolutionText: { fontSize: 12, color: "#a7f3d0", marginTop: 2 },
  emptyBox: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  emptySub: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 4, marginBottom: 16 },
  emptyActionBtn: { backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyActionText: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#0f172a", borderRadius: 24, padding: 22, borderWidth: 1, borderColor: "#1e293b", maxHeight: "90%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "900", color: "#ffffff" },
  closeIcon: { fontSize: 18, color: "#94a3b8", padding: 4 },
  label: { fontSize: 12, fontWeight: "800", color: "#cbd5e1", marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#ffffff",
    fontSize: 14,
  },
  tierRow: { flexDirection: "row", gap: 8 },
  tierBtn: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  tierBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#2563eb" },
  tierText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tierTextActive: { color: "#ffffff" },
  submitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 8,
  },
  submitBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  autoLinkBanner: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  autoLinkTitle: { fontSize: 12, fontWeight: "800", color: "#60a5fa" },
  autoLinkDesc: { fontSize: 11, color: "#cbd5e1", marginTop: 2 },
  uploadBtn: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  uploadBtnText: { color: "#60a5fa", fontSize: 13, fontWeight: "700" },
  uploadPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 8,
  },
  uploadThumb: { width: 40, height: 40, borderRadius: 10 },
  uploadAttachedText: { color: "#34d399", fontSize: 12, fontWeight: "700" },
  viewfinder: { height: 180, backgroundColor: "#020617", borderRadius: 16, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  toastBox: { backgroundColor: "rgba(16, 185, 129, 0.15)", padding: 10, borderRadius: 10, marginBottom: 10 },
  toastText: { color: "#34d399", fontSize: 13, fontWeight: "700", textAlign: "center" },
  gateSimBtn: { flex: 1, backgroundColor: "#1e293b", paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#334155" },
  gateSimText: { color: "#93c5fd", fontSize: 13, fontWeight: "800" },
  whiteCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  whiteCloseBtn: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  whiteCloseText: { fontSize: 14, color: "#64748b", fontWeight: "bold" },
  whiteCrestSub: { fontSize: 9, fontWeight: "900", color: "#64748b", letterSpacing: 0.5 },
  whiteTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", marginTop: 4, marginBottom: 14 },
  qrBox: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeBigMono: { fontSize: 18, fontWeight: "900", color: "#1e3a8a", marginTop: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
  metaContainer: { width: "100%", backgroundColor: "#f8fafc", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 14 },
  metaLineRow: { fontSize: 13, color: "#334155", marginBottom: 3 },
  metaLineLabel: { fontWeight: "700", color: "#64748b" },
  metaLineVal: { fontWeight: "800", color: "#0f172a" },
  shareImgMainBtn: {
    backgroundColor: "#059669",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
  },
  shareImgMainBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  waTextBtn: {
    backgroundColor: "#0f172a",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
  },
  waTextBtnText: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
});
