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
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import { useLanguage, LANGUAGES } from "../i18n";

const BRAND_SERIF = Platform.OS === "ios" ? "Georgia" : "serif";

// Official multi-color Google "G" mark (per Google branding guidelines).
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail] = useState("staff1@campus.edu");
  const [password, setPassword] = useState("staff123");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (eUser?: string, ePass?: string) => {
    const useEmail = eUser || email;
    const usePassword = ePass || password;

    if (!useEmail || !usePassword) {
      setError(t("login.errFill"));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      await login(useEmail, usePassword);
    } catch (err: any) {
      setError(err.message || t("login.invalid"));
    } finally {
      setLoading(false);
    }
  };

  // NOTE: Real institutional Google SSO requires expo-auth-session + an OAuth
  // client. For this demo build, "Continue with Google" signs in the faculty
  // account so the flow can be demonstrated end-to-end.
  const handleGoogle = () => handleLogin("staff1@campus.edu", "staff123");

  const handleForgot = () => {
    if (!email) {
      setError(t("login.errEmailFirst"));
      return;
    }
    setError("");
    setNotice(t("login.resetSent", { email }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Language switcher */}
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => {
              const on = lang === l.id;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.langChip, on && styles.langChipOn]}
                  onPress={() => setLang(l.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.langChipText, on && styles.langChipTextOn]}>{l.short}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Crest Header */}
          <View style={styles.header}>
            <View style={styles.crestBadge}>
              <Text style={styles.crestText}>TU</Text>
            </View>
            <Text style={styles.title}>{t("login.title")}</Text>
            <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {notice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t("login.email")}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="faculty@thapar.edu"
                placeholderTextColor="#a89a8c"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t("login.password")}</Text>
                <TouchableOpacity onPress={handleForgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.forgotLink}>{t("login.forgot")}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#a89a8c"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={() => handleLogin()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fdf6ea" />
              ) : (
                <Text style={styles.loginBtnText}>{t("login.signIn")}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("login.or")}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google SSO */}
            <TouchableOpacity
              style={[styles.googleBtn, loading && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={loading}
              activeOpacity={0.85}
            >
              <GoogleIcon size={18} />
              <Text style={styles.googleBtnText}>{t("login.google")}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Demo 1-Tap Logins */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>{t("login.demo")}</Text>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleLogin("staff1@campus.edu", "staff123")}
              activeOpacity={0.85}
            >
              <Text style={styles.demoBtnText}>Dr. Rajesh Sharma — HOD, Computer Science</Text>
              <Text style={styles.demoBtnSub}>staff1@campus.edu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleLogin("prof.kaur@thapar.edu", "staff123")}
              activeOpacity={0.85}
            >
              <Text style={styles.demoBtnText}>Dr. Simran Kaur — Dean of Sciences</Text>
              <Text style={styles.demoBtnSub}>prof.kaur@thapar.edu</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4ede1" },
  inner: { flex: 1 },
  scroll: { padding: 24, justifyContent: "center", minHeight: "100%" },
  langRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e0d3b8",
    backgroundColor: "#fffdf7",
    minWidth: 46,
    alignItems: "center",
  },
  langChipOn: { backgroundColor: "#7a1f2b", borderColor: "#7a1f2b" },
  langChipText: { fontSize: 13, fontWeight: "700", color: "#8a6420" },
  langChipTextOn: { color: "#fdf6ea" },
  header: { alignItems: "center", marginBottom: 26 },
  crestBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#c9a24b",
    borderWidth: 1,
    borderColor: "#e0c684",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  crestText: { fontSize: 24, fontWeight: "700", color: "#5e1720", fontFamily: BRAND_SERIF, letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: "700", color: "#7a1f2b", fontFamily: BRAND_SERIF, letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: "#766358", marginTop: 5, textAlign: "center", fontWeight: "500" },
  card: {
    backgroundColor: "#fffdf7",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e7dcc8",
    borderTopWidth: 3,
    borderTopColor: "#c9a24b",
    shadowColor: "#2c1015",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: "#f7e8e5",
    borderWidth: 1,
    borderColor: "#e8c7c0",
    padding: 11,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: { color: "#b23025", fontSize: 12, fontWeight: "600" },
  noticeBox: {
    backgroundColor: "#f7edd6",
    borderWidth: 1,
    borderColor: "#e2c987",
    padding: 11,
    borderRadius: 12,
    marginBottom: 14,
  },
  noticeText: { color: "#8a6420", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  fieldGroup: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8a6420",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  forgotLink: { fontSize: 12, fontWeight: "700", color: "#7a1f2b" },
  input: {
    backgroundColor: "#f7f1e6",
    borderWidth: 1,
    borderColor: "#ddceb4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#2c2320",
  },
  loginBtn: {
    backgroundColor: "#7a1f2b",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#5e1720",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.55 },
  loginBtnText: { color: "#fdf6ea", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e7dcc8" },
  dividerText: { fontSize: 11, color: "#a89a8c", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    paddingVertical: 13,
  },
  googleBtnText: { color: "#3c4043", fontSize: 14, fontWeight: "500", letterSpacing: 0.1 },
  demoSection: { marginTop: 24, gap: 8 },
  demoTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8a6420",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  demoBtn: {
    backgroundColor: "#fffdf7",
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7dcc8",
  },
  demoBtnText: { color: "#2c2320", fontSize: 13, fontWeight: "700" },
  demoBtnSub: { color: "#766358", fontSize: 11, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
});
