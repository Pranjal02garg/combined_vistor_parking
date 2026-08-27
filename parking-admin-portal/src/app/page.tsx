import Link from "next/link";

import { getCurrentAuth } from "@/lib/auth/service";

export default async function Home() {
  const auth = await getCurrentAuth();

  return (
    <main className="home-layout">
      <section className="hero-card">
        <p className="eyebrow">Admin Portal</p>
        <h1>Parking Management Admin Portal</h1>
        <p>
          This portal is for admin access only. Admin can sign in to manage
          users, parking eligibility, and account validity.
        </p>

        {auth ? (
          <div className="status-pill">
            Signed in as <strong>{auth.user.email}</strong>
          </div>
        ) : (
          <div className="status-pill">No active session</div>
        )}

        <div className="cta-row">
          {auth ? (
            <Link className="button-primary" href="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="button-primary" href="/login">
                Admin Sign In
              </Link>
            </>
          )}
          <Link
            className="button-primary"
            style={{ background: "#059669", borderColor: "#059669" }}
            href="/faculty"
          >
            📱 Faculty Mobile App
          </Link>
        </div>

        <div className="learning-links">
          <Link href="/faculty">Open Faculty Mobile App (/faculty)</Link>
          <span> • </span>
          <a href="/api/auth/session">Inspect session API</a>
        </div>
      </section>
    </main>
  );
}
