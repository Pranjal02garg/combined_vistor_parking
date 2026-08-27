import { redirect } from "next/navigation";

import { CredentialsForm } from "@/components/credentials-form";
import { getCurrentAuth, clearSessionCookie, invalidateSession, getSessionTokenFromCookie } from "@/lib/auth/service";

export default async function LoginPage() {
  const auth = await getCurrentAuth();
  
  if (auth) {
    if (auth.user.role === "admin") {
      redirect("/dashboard");
    } else {
      // User is logged in but not an admin.
      // We cannot modify cookies during render, so we provide a server action button to logout.
      async function forceLogout() {
        "use server";
        const token = await getSessionTokenFromCookie();
        if (token) {
          await invalidateSession(token);
          await clearSessionCookie();
        }
        redirect("/login");
      }

      return (
        <main className="auth-layout">
          <section className="auth-card" style={{ maxWidth: "500px" }}>
            <h1 className="auth-title" style={{ color: "#ef4444" }}>Unauthorized Access</h1>
            <p className="auth-description" style={{ fontSize: "16px", color: "#1e293b", marginBottom: "20px" }}>
              You do not have permission to access the admin dashboard.
            </p>
            <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "left" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#0f172a" }}>Contact Support</h3>
              <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>Abhinav Sharma (Head Admin)</p>
              <p style={{ margin: "12px 0 4px 0", fontSize: "14px", color: "#64748b" }}>Platform Developers:</p>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "14px", lineHeight: "1.6" }}>
                <li>Bhumit Gupta (bgupta1_be23@thapar.edu)</li>
                <li>Siddharth Sharma (ssharma16_be23@thapar.edu)</li>
              </ul>
            </div>
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <form action={forceLogout}>
                <button type="submit" style={{ background: "none", border: "none", color: "#2563eb", textDecoration: "none", fontWeight: 500, cursor: "pointer", fontSize: "16px" }}>
                  &larr; Sign out & Return to Login
                </button>
              </form>
            </div>
          </section>
        </main>
      );
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-description">
          Sign in to your parking management dashboard.
        </p>
        <CredentialsForm mode="login" />
      </section>
    </main>
  );
}
