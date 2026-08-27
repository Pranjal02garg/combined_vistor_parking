"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { resetPassword, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">This reset link is missing or malformed.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
        <p className="text-sm text-slate-600">Your password has been reset. You can now sign in.</p>
        <Link href="/head" className="inline-block text-xs font-semibold text-slate-900 underline-offset-2 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="rp-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="rp-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          required
        />
      </div>

      <div>
        <label htmlFor="rp-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <input
          id="rp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          required
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition active:bg-slate-800 disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
      </div>
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
