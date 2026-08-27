import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  Users,
  Car,
  Building,
} from "lucide-react";

const GATES = [
  { code: "1", name: "Gate 1", tag: "Main Gate & ANPR" },
  { code: "2", name: "Gate 2", tag: "Faculty & Staff" },
  { code: "3", name: "Gate 3", tag: "Hostel Zone" },
  { code: "4", name: "Gate 4", tag: "Service & Vendor" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <header className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Campus Gate Pass &amp; Parking System
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Digital visitor management, automated license plate recognition, faculty parking permits, and security control.
        </p>
      </header>

      {/* Visitor Check-in Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <QrCode size={16} />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Visitor Digital Check-in
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
            Scan Gate QR
          </span>
        </div>
        <p className="mb-3.5 text-xs text-slate-500">
          Select an entry gate to open the intake form (simulates a visitor scanning gate QR):
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {GATES.map((gate) => (
            <Link
              key={gate.code}
              href={`/register?gate=${gate.code}`}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-slate-700 transition-all hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm active:scale-95"
            >
              <span className="text-xl font-bold text-brand-600">{gate.code}</span>
              <span className="mt-0.5 text-xs font-semibold">{gate.name}</span>
              <span className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                {gate.tag}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Official Portals */}
      <div className="space-y-3">
        {/* Staff & Faculty Portal */}
        <Link
          href="/staff"
          className="group flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-all hover:bg-slate-850 hover:ring-1 hover:ring-slate-700"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-brand-400 border border-slate-700">
              <Car size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Faculty &amp; Staff Portal</span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  Staff / Faculty
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Registered vehicles, live parking slots, barrier access, VIP guest passes &amp; house helps
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
        </Link>

        {/* Guard Console */}
        <Link
          href="/guard"
          className="group flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-all hover:bg-slate-850 hover:ring-1 hover:ring-slate-700"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-emerald-400 border border-slate-700">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Guard Security Console</span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Gate Security
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Visitor approval queue, cross-gate tracking, QR scanner &amp; Fast-Lane ANPR barrier feed
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
        </Link>

        {/* Head Admin Console */}
        <Link
          href="/head"
          className="group flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-all hover:bg-slate-850 hover:ring-1 hover:ring-slate-700"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-amber-400 border border-slate-700">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Head Admin Command Center</span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Security Chief
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Campus analytics, VIP approvals, parking lot &amp; permit manager, form builder &amp; blacklist
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
        </Link>
      </div>
    </main>
  );
}
