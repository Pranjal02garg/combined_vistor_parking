"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setDevLink(res.devLink ?? null);
      setSent(true);
    } catch {
      // Still show the generic success state — never reveal whether the
      // request actually failed vs. the email simply doesn't exist.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot Password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your account email and we'll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <MailCheck className="mx-auto text-emerald-600" size={32} />
          <p className="text-sm text-slate-600">
            If an account exists for <strong>{email}</strong>, a password reset link has been
            sent. It expires in 30 minutes.
          </p>
          {devLink && (
            <p className="rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-700">
              Dev mode (no email provider configured):{" "}
              <a className="underline break-all" href={devLink}>
                {devLink}
              </a>
            </p>
          )}
          <Link href="/head" className="text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition active:bg-slate-800 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Sending…" : "Send reset link"}
          </button>

          <div className="text-center">
            <Link href="/head" className="text-xs text-slate-400 underline-offset-2 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
