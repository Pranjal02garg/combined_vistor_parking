import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("staff1@campus.edu");
  const [password, setPassword] = useState("staff123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (eUser?: string, ePass?: string) => {
    const useEmail = eUser || email;
    const usePassword = ePass || password;

    if (!useEmail || !usePassword) {
      setError("Please fill in email and password");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await login(useEmail, usePassword);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>🅿️</Text>
            </View>
            <Text style={styles.title}>Campus Staff Pass</Text>
            <Text style={styles.subtitle}>
              University Faculty & Staff Parking & Gate Hub
            </Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Official University Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="faculty@thapar.edu"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={() => handleLogin()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In to Mobile Hub</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Demo 1-Tap Login Buttons */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>⚡ Quick 1-Tap Demo Logins</Text>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleLogin("staff1@campus.edu", "staff123")}
            >
              <Text style={styles.demoBtnText}>👨‍🏫 Dr. Rajesh Sharma (HOD CSE)</Text>
              <Text style={styles.demoBtnSub}>staff1@campus.edu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleLogin("prof.kaur@thapar.edu", "staff123")}
            >
              <Text style={styles.demoBtnText}>👩‍🏫 Dr. Simran Kaur (Dean)</Text>
              <Text style={styles.demoBtnSub}>prof.kaur@thapar.edu</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  inner: {
    flex: 1,
  },
  scroll: {
    padding: 24,
    justifyContent: "center",
    minHeight: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#4338ca",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#ffffff",
  },
  loginBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  demoSection: {
    marginTop: 24,
    gap: 8,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  demoBtn: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  demoBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  demoBtnSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
});
