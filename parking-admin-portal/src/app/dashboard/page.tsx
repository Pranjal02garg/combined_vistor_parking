import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/service";
import { getDb } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";
import styles from "./dashboard.module.css";

async function toggleManualAlarm(formData: FormData) {
  "use server";
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const nextState = String(formData.get("nextState") || "") === "true";
  const db = await getDb();

  await db.collection("settings").updateOne(
    { _id: "manual_alarm" as any },
    { $set: { is_on: nextState, updatedAt: new Date() } },
    { upsert: true }
  );

  const changeDoc = {
    action: nextState ? "alarm_on" : "alarm_off",
    userId: auth.user.id,
    userEmail: auth.user.email,
    timestamp: new Date(),
  };

  await db.collection("car_changes").insertOne({ ...changeDoc });
  await db.collection("system_logs").insertOne({ ...changeDoc });

  revalidatePath("/dashboard");
}

export default async function DashboardOverviewPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") {
    redirect("/login");
  }

  const db = await getDb();
  const alarmSetting = await db.collection("settings").findOne({ _id: "manual_alarm" as any });
  const isAlarmOn = alarmSetting?.is_on || false;

  const totalUsers = await db.collection("users").countDocuments();
  const activeUsers = await db.collection("users").countDocuments({ isActive: true });
  const parkingUsers = await db.collection("users").countDocuments({ parkingEligible: true });

  return (
    <div>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>System Overview</h1>
        <p className={styles.cardSubtitle}>Key metrics and system controls</p>
      </div>

      <div className={styles.statGrid} style={{ marginBottom: "40px" }}>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{totalUsers}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Active Accounts</div>
          <div className={styles.statValue}>{activeUsers}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Parking Eligible</div>
          <div className={styles.statValue}>{parkingUsers}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Manual Camera Alarm</h2>
          <p className={styles.cardSubtitle}>Toggle the physical alarm on the camera system</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: isAlarmOn ? "#ef4444" : "#94a3b8",
              boxShadow: isAlarmOn ? "0 0 16px rgba(239, 68, 68, 0.6)" : "none",
              transition: "all 0.3s ease"
          }} />
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
            Status: {isAlarmOn ? "ON" : "OFF"}
          </span>
          <form action={toggleManualAlarm} style={{ marginLeft: "auto" }}>
            <input type="hidden" name="nextState" value={(!isAlarmOn).toString()} />
            <button
              type="submit"
              className={isAlarmOn ? styles.buttonDanger : styles.buttonPrimary}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "15px"
              }}
            >
              Turn {isAlarmOn ? "OFF" : "ON"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
