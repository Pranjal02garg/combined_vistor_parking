"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getClientCsrfToken } from "@/lib/auth/client-csrf";
import { CSRF_HEADER_NAME } from "@/lib/auth/constants";

export function LogoutButton() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isCsrfLoading, setIsCsrfLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCsrfToken() {
      setIsCsrfLoading(true);

      try {
        const token = await getClientCsrfToken();
        if (active) {
          setCsrfToken(token);
        }
      } catch {
        if (active) {
          setCsrfToken(null);
          setError("Could not initialize sign out token.");
        }
      } finally {
        if (active) {
          setIsCsrfLoading(false);
        }
      }
    }

    void loadCsrfToken();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    if (!csrfToken) {
      setError("Missing sign out token. Refresh and try again.");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          [CSRF_HEADER_NAME]: csrfToken,
        },
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Unable to sign out.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Network error while signing out.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {error ? (
        <p
          style={{
            color: "#b91c1c",
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      ) : null}

      <button
        className="button-secondary"
        type="button"
        onClick={handleLogout}
        disabled={isPending || isCsrfLoading || !csrfToken}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
