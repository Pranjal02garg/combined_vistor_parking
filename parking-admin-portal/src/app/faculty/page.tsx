"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { mobileClient, MobileUser, AllowedCar } from "@/lib/mobile-client";
import styles from "./faculty.module.css";

export default function FacultyHomePage() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [cars, setCars] = useState<AllowedCar[]>([]);
  const [barrierStatus, setBarrierStatus] = useState<string | null>(null);
  const [triggeringBarrier, setTriggeringBarrier] = useState(false);

  useEffect(() => {
    const cachedUser = mobileClient.getUser();
    if (cachedUser) setUser(cachedUser);

    Promise.all([mobileClient.getMe(), mobileClient.getCars()]).then(
      ([meRes, carsRes]) => {
        if (meRes.data?.user) setUser(meRes.data.user);
        if (carsRes.data?.cars) setCars(carsRes.data.cars);
      }
    );
  }, []);

  const handleDirectBarrierOpen = async () => {
    setTriggeringBarrier(true);
    setBarrierStatus(null);
    try {
      const res = await mobileClient.openBarrier("GATE_1", "Faculty Mobile Quick Trigger");
      if (res.data?.success) {
        setBarrierStatus("✅ Barrier Opened Successfully!");
      } else {
        setBarrierStatus(`⚠️ ${res.error || "Unable to trigger barrier"}`);
      }
    } catch (err: any) {
      setBarrierStatus(`❌ Error: ${err?.message || "Failed to trigger barrier"}`);
    } finally {
      setTriggeringBarrier(false);
      setTimeout(() => setBarrierStatus(null), 5000);
    }
  };

  const getStickerBadge = (color: string) => {
    switch (color?.toLowerCase()) {
      case "green":
        return { label: "GREEN STICKER (S4)", className: styles.badgeGreen };
      case "red":
        return { label: "RED STICKER (S4)", className: styles.badgeRed };
      case "blue":
        return { label: "BLUE STICKER (E4)", className: styles.badgeBlue };
      default:
        return { label: "STANDARD PERMIT", className: styles.badgeGreen };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Faculty Greeting Card */}
      <div className={`${styles.card} ${styles.cardHero}`}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#38bdf8", letterSpacing: "1px" }}>
              Welcome Back
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", margin: "4px 0 0 0" }}>
              {user?.name || "Professor"}
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
              🏢 {user?.department || "Thapar Faculty"} • {user?.faculty_id ? `ID: #${user.faculty_id}` : "Permit #4092"}
            </p>
          </div>
          <div style={{ fontSize: "28px" }}>🎓</div>
        </div>

        {/* Permit Expiry */}
        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className={styles.badgeGreen}>● PERMIT ACTIVE</span>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Valid till: Dec 2027
          </span>
        </div>
      </div>

      {/* Quick Gate Actions */}
      <div>
        <h3 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: "8px" }}>
          Quick Gate Access
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <Link
            href="/faculty/scanner"
            className={styles.card}
            style={{ textAlign: "center", textDecoration: "none", padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
          >
            <div style={{ fontSize: "26px" }}>📷</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#ffffff" }}>Scan Gate QR</div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>Use camera at booth</div>
          </Link>

          <button
            onClick={handleDirectBarrierOpen}
            disabled={triggeringBarrier}
            className={styles.card}
            style={{ textAlign: "center", padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer", border: "1px solid #1e293b" }}
          >
            <div style={{ fontSize: "26px" }}>🚪</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#ffffff" }}>Open Barrier</div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              {triggeringBarrier ? "Opening..." : "1-Tap gate pulse"}
            </div>
          </button>
        </div>

        {barrierStatus && (
          <div className={styles.alertSuccess} style={{ marginTop: "10px", textAlign: "center" }}>
            {barrierStatus}
          </div>
        )}
      </div>

      {/* Registered Vehicles */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>
            Registered Vehicles ({cars.length})
          </h3>
          <Link href="/faculty/vehicles" style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700" }}>
            + Manage
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {cars.map((car, idx) => {
            const badge = getStickerBadge(car.stickerColor);
            return (
              <div
                key={idx}
                className={styles.card}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "24px" }}>🚘</div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "15px", fontWeight: "900", color: "#ffffff", letterSpacing: "1px" }}>
                      {car.plateNumber}
                    </div>
                    <span className={badge.className} style={{ marginTop: "4px" }}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: "11px", color: "#34d399", fontWeight: "700" }}>
                  ● ANPR Fast-Lane
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Parking Availability Widget */}
      <div className={styles.card} style={{ background: "#090e1a" }}>
        <h4 style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: "10px" }}>
          🅿️ Live Campus Parking Slots
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div style={{ background: "#131d33", padding: "10px", borderRadius: "10px" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>Faculty Lot S4</span>
            <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399" }}>24 Slots Free</span>
          </div>
          <div style={{ background: "#131d33", padding: "10px", borderRadius: "10px" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>Main Admin Lot</span>
            <span style={{ fontSize: "16px", fontWeight: "900", color: "#38bdf8" }}>12 Slots Free</span>
          </div>
        </div>
      </div>
    </div>
  );
}
