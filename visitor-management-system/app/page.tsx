import Link from "next/link";
import { QrCode, ShieldCheck, ArrowRight, LayoutDashboard, Users } from "lucide-react";

const GATES = ["1", "2", "3", "4"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Campus Gate Pass</h1>
        <p className="mt-1 text-sm text-slate-500">
          Multi-gate digital visitor management
        </p>
      </header> 

      {/* Visitor entry — in production this is reached by scanning a per-gate QR. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-700">
          <QrCode size={18} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Visitor check-in
          </h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Pick a gate to open the intake form (simulates a QR scan).
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GATES.map((gate) => (
            <Link
              key={gate}
              href={`/register?gate=${gate}`}
              className="flex h-16 flex-col items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50 active:bg-brand-100"
            >
              <span className="text-lg font-bold leading-none">{gate}</span>
              <span className="mt-1 text-[11px] text-slate-400">Gate</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Staff & admin consoles — sign-in required. */}
      <div className="space-y-3">
        {/* Admin console. */}
        <Link
          href="/head"
          className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-colors hover:bg-slate-800 active:bg-slate-700"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <LayoutDashboard size={18} /> Admin console
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Analytics, approvals &amp; full control
            </span>
          </span>
          <ArrowRight size={20} />
        </Link>

        {/* Staff console. */}
        <Link
          href="/staff"
          className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-colors hover:bg-slate-800 active:bg-slate-700"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Users size={18} /> Staff console
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Issue &amp; track VIP passes
            </span>
          </span>
          <ArrowRight size={20} />
        </Link>

        {/* Guard console. */}
        <Link
          href="/guard"
          className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-colors hover:bg-slate-800 active:bg-slate-700"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={18} /> Guard console
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Review queue &amp; mark exits
            </span>
          </span>
          <ArrowRight size={20} />
        </Link>
      </div>
    </main>
  );
}
