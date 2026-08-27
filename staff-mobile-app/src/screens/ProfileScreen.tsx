import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarIcon}>👨‍🏫</Text>
        </View>

        <Text style={styles.name}>{user?.name || "Dr. Faculty"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.dept}>{user?.department || "Computer Science & Engineering"}</Text>

        <View style={styles.infoCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Faculty ID</Text>
            <Text style={styles.rowVal}>{user?.facultyId || "FAC-4092"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Parking Permit</Text>
            <Text style={[styles.rowVal, { color: "#34d399" }]}>
              {user?.parkingEligible ? "ACTIVE (Authorized)" : "SUSPENDED"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Role</Text>
            <Text style={styles.rowVal}>{user?.role?.toUpperCase()}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>ANPR Sync</Text>
            <Text style={[styles.rowVal, { color: "#818cf8" }]}>Connected</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out from App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16" },
  scroll: { padding: 20, alignItems: "center" },
  avatarBox: { width: 80, height: 80, borderRadius: 28, backgroundColor: "#1e1b4b", justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#4338ca" },
  avatarIcon: { fontSize: 38 },
  name: { fontSize: 20, fontWeight: "900", color: "#ffffff" },
  email: { fontSize: 13, color: "#818cf8", marginTop: 2 },
  dept: { fontSize: 12, color: "#94a3b8", marginTop: 4, marginBottom: 24 },
  infoCard: { width: "100%", backgroundColor: "#0f172a", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "#1e293b", marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  rowLabel: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  rowVal: { fontSize: 13, color: "#ffffff", fontWeight: "800" },
  logoutBtn: { width: "100%", backgroundColor: "rgba(239, 68, 68, 0.15)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  logoutText: { color: "#f87171", fontSize: 14, fontWeight: "800" },
});
