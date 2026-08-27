"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CSRF_HEADER_NAME } from "@/lib/auth/constants";
import { getClientCsrfToken } from "@/lib/auth/client-csrf";
import {
  getPasswordChecklist,
  getPasswordValidationErrors,
} from "@/lib/auth/password-policy";

type CredentialsFormMode = "login" | "register";

const modeMap: Record<
  CredentialsFormMode,
  { endpoint: string; buttonLabel: string; pendingLabel: string }
> = {
  login: {
    endpoint: "/api/auth/login",
    buttonLabel: "Sign in",
    pendingLabel: "Signing in...",
  },
  register: {
    endpoint: "/api/auth/register",
    buttonLabel: "Create account",
    pendingLabel: "Creating account...",
  },
};

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath) {
    return "/dashboard";
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}

export function CredentialsForm({ mode }: { mode: CredentialsFormMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isCsrfLoading, setIsCsrfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const passwordChecklist = useMemo(
    () => getPasswordChecklist(password),
    [password],
  );

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
          setError(
            "Could not initialize secure form token. Refresh and retry.",
          );
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken) {
      setError("Secure form token missing. Refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (mode === "register") {
      const passwordError = getPasswordValidationErrors(password)[0] ?? null;
      if (passwordError) {
        setError(passwordError);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch(modeMap[mode].endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        user?: {
          role?: "admin" | "user";
        };
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Authentication request failed.");
        return;
      }

      if (mode === "login" && data?.user?.role !== "admin") {
        setError("Only admin access is allowed on this portal.");
        return;
      }

      router.replace(mode === "login" ? nextPath : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <label className="form-label" htmlFor={`${mode}-email`}>
        Email
      </label>
      <input
        id={`${mode}-email`}
        className="form-input"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />

      <label className="form-label" htmlFor={`${mode}-password`}>
        Password
      </label>
      <input
        id={`${mode}-password`}
        className="form-input"
        type="password"
        name="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />

      {mode === "register" ? (
        <div className="password-checklist" aria-live="polite">
          <p className="field-note">Password requirements:</p>
          <ul className="checklist-list">
            <li className={passwordChecklist.minLength ? "valid" : "invalid"}>
              At least 12 characters
            </li>
            <li className={passwordChecklist.uppercase ? "valid" : "invalid"}>
              At least one uppercase letter
            </li>
            <li className={passwordChecklist.lowercase ? "valid" : "invalid"}>
              At least one lowercase letter
            </li>
            <li className={passwordChecklist.number ? "valid" : "invalid"}>
              At least one number
            </li>
            <li className={passwordChecklist.symbol ? "valid" : "invalid"}>
              At least one symbol
            </li>
          </ul>
        </div>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}

      <button
        className="button-primary"
        type="submit"
        disabled={isSubmitting || isCsrfLoading || !csrfToken}
      >
        {isSubmitting ? modeMap[mode].pendingLabel : modeMap[mode].buttonLabel}
      </button>
    </form>
  );
}
