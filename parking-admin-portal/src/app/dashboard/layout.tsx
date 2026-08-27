import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAuth } from "@/lib/auth/service";
import styles from "./dashboard.module.css";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/login?next=/dashboard");
  }

  if (auth.user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className={styles.dashboardContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>Parking Pilot</div>
        <nav className={styles.navMenu}>
          <Link href="/dashboard" className={styles.navItem}>
            Overview
          </Link>
          <Link href="/dashboard/users" className={styles.navItem}>
            Users
          </Link>
          <Link href="/dashboard/logs" className={styles.navItem}>
            System Logs
          </Link>
        </nav>
      </aside>
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.pageTitle}>Admin Dashboard</div>
          <div className={styles.userProfile}>
            <div className={styles.userAvatar}>
              {auth.user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>
              {auth.user.name}
            </div>
            <LogoutButton />
          </div>
        </header>
        <div className={styles.scrollArea}>{children}</div>
      </main>
    </div>
  );
}
