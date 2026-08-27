"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { mobileClient, MobileUser } from "@/lib/mobile-client";
import styles from "./faculty.module.css";

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);

  const isLoginPage = pathname === "/faculty/login";

  useEffect(() => {
    const token = mobileClient.getToken();
    if (!token && !isLoginPage) {
      router.push("/faculty/login");
      return;
    }

    if (token) {
      const cached = mobileClient.getUser();
      if (cached) setUser(cached);

      mobileClient.getMe().then((res) => {
        if (res.data?.user) {
          setUser(res.data.user);
        }
      });
    }
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b1120", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    );
  }

  const navItems = [
    { href: "/faculty", label: "Home", icon: "🏠" },
    { href: "/faculty/vehicles", label: "Vehicles", icon: "🚗" },
    { href: "/faculty/scanner", label: "Gate QR", icon: "📷" },
    { href: "/faculty/profile", label: "Profile", icon: "👤" },
  ];

  return (
    <div className={styles.mobileContainer}>
      {/* Top Mobile Header */}
      <header className={styles.mobileHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            🅿️
          </div>
          <div>
            <h1 style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff", lineHeight: "1.2", margin: 0 }}>
              Thapar Smart Parking
            </h1>
            <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>Faculty Mobile Access</p>
          </div>
        </div>

        {user && (
          <span className={user.allowed ? styles.badgeGreen : styles.badgeRed}>
            ● {user.allowed ? "Permit Active" : "No Permit"}
          </span>
        )}
      </header>

      {/* Main Screen Content */}
      <main className={styles.mobileMain}>{children}</main>

      {/* Bottom Mobile Navigation Bar */}
      <nav className={styles.bottomNav}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            >
              <span style={{ fontSize: "20px", lineHeight: "1" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
