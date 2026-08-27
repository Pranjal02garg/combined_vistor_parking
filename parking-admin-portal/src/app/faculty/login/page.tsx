"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { mobileClient } from "@/lib/mobile-client";
import styles from "../faculty.module.css";

export default function FacultyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("bgupta1_be23@thapar.edu");
  const [password, setPassword] = useState("faculty123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await mobileClient.login(email.trim(), password);
      if (res.data?.token) {
        router.push("/faculty");
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "420px", padding: "16px", margin: "0 auto" }}>
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "18px",
            background: "#2563eb",
            boxShadow: "0 12px 24px rgba(37, 99, 235, 0.35)",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
          }}
        >
          🚗
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.5px" }}>
          Thapar Smart Parking
        </h1>
        <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
          Faculty & Staff Access Portal
        </p>
      </div>

      {/* Card */}
      <div className={styles.card} style={{ background: "#0f172a", borderColor: "#1e293b", padding: "24px" }}>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && <div className={styles.alertError}>{error}</div>}

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: "6px" }}>
              University Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. bgupta1_be23@thapar.edu"
              className={styles.inputField}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.inputField}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.btnPrimary} style={{ marginTop: "8px" }}>
            {loading ? "Signing in..." : "Sign In to Mobile App ➔"}
          </button>
        </form>

        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #1e293b", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.5" }}>
            Authorized university faculty & staff access only.
          </p>
        </div>
      </div>
    </div>
  );
}
