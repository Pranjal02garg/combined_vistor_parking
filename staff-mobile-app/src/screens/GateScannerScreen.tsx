import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../services/api";

export default function GateScannerScreen() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const simulateGateScan = async (gateCode: string) => {
    try {
      setLoading(true);
      setStatus("Scanning gate QR code...");
      const res = await api.scanGateQR(`GATE_PASS_GATE_${gateCode}`);
      setStatus(`✅ Success: Barrier Opened at ${res.gateName || "Gate " + gateCode}`);
      Alert.alert("Barrier Opened", `Access granted. Drive through Gate ${gateCode}.`);
    } catch (err: any) {
      setStatus(`❌ ${err.message || "Failed to scan gate QR"}`);
      Alert.alert("Access Denied", err.message || "Could not open gate barrier.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Gate Barrier QR Scanner</Text>
        <Text style={styles.sub}>
          Point your camera at the physical QR code mounted on the security barrier kiosk.
        </Text>

        {/* Viewfinder Target Mock */}
        <View style={styles.viewfinder}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
          <Text style={styles.scannerPrompt}>Align QR code inside box</Text>
        </View>

        {status && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}

        {/* Quick Gate Simulators */}
        <Text style={styles.simTitle}>⚡ Quick Tap Gate Simulators</Text>
        <View style={styles.gatesRow}>
          {["1", "2", "3", "4"].map((g) => (
            <TouchableOpacity
              key={g}
              style={styles.gateBtn}
              onPress={() => simulateGateScan(g)}
              disabled={loading}
            >
              <Text style={styles.gateBtnText}>Gate {g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16", padding: 20, justifyContent: "center" },
  card: { backgroundColor: "#0f172a", borderRadius: 28, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "900", color: "#ffffff", textAlign: "center" },
  sub: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 4, marginBottom: 20 },
  viewfinder: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 20,
  },
  scannerPrompt: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  cornerTL: { position: "absolute", top: 12, left: 12, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#6366f1" },
  cornerTR: { position: "absolute", top: 12, right: 12, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#6366f1" },
  cornerBL: { position: "absolute", bottom: 12, left: 12, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#6366f1" },
  cornerBR: { position: "absolute", bottom: 12, right: 12, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#6366f1" },
  statusBox: { backgroundColor: "#020617", padding: 10, borderRadius: 12, marginBottom: 16, width: "100%" },
  statusText: { color: "#ffffff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  simTitle: { fontSize: 11, fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: 8 },
  gatesRow: { flexDirection: "row", gap: 8, width: "100%" },
  gateBtn: { flex: 1, backgroundColor: "#1e1b4b", borderWidth: 1, borderColor: "#4338ca", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  gateBtnText: { color: "#a5b4fc", fontSize: 12, fontWeight: "800" },
});
