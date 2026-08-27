import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/service";
import { getSystemLogsAction } from "@/app/dashboard/users/actions";
import styles from "../dashboard.module.css";

export default async function LogsPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") {
    redirect("/login");
  }

  const logs = await getSystemLogsAction();

  return (
    <div>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>System Logs</h1>
        <p className={styles.cardSubtitle}>Recent activity and changes to the system</p>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Vehicle Number</th>
              <th>User / Admin</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No system logs available.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${
                      log.action === "add" ? styles.badgeSuccess : 
                      log.action === "delete" ? styles.badgeDanger : 
                      log.action === "alarm_on" ? styles.badgeDanger : ""
                    }`}>
                      {log.action.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.carNumber || "-"}</td>
                  <td>{log.userEmail || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
