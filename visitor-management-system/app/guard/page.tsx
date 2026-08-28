"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Search,
  LogOut,
  ShieldCheck,
  Loader2,
  QrCode,
  LogIn,
  DoorOpen,
  Megaphone,
  Star,
  User,
  Lock,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  Sparkles,
  Camera,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import {
  fetchGates,
  fetchGuardFeed,
  fetchGuardLookup,
  decideVisit,
  exitVisit,
  checkinVIPPass,
  exitVIPPass,
  actionHouseHelp,
  ApiError,
  type FeedItem,
  type GateDTO,
} from "@/lib/api";
import { categoryColor } from "@/lib/categoryColors";
import { playGuardSound } from "@/lib/audio";

// ===========================================================================
// Auth wrapper (unchanged) — routes STAFF/HEAD to their portals; GUARD → console.
// ===========================================================================
export default function GuardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "STAFF") router.push("/staff");
      // Allow HEAD to stay on the guard panel to test/view it
    }
  }, [status, session, router]);

  if (status === "loading")
    return <FullScreenSpinner />;
  if (status !== "authenticated") return <LoginScreen />;
  if (session?.user?.role !== "GUARD" && session?.user?.role !== "HEAD") return <FullScreenSpinner />;
  return <Console />;
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("gate1@campus.edu");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const GATES = [1, 2, 3, 4];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) return setError("Enter PIN");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid PIN");
        setPin("");
        setBusy(false);
        return;
      }
      window.location.href = "/guard";
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
      setPin("");
      setBusy(false);
    }
  }

  function handleDigit(d: string) {
    if (pin.length < 6) setPin(p => p + d);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Guard Station</h1>
        
        <div className="mt-6">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Gate</label>
          <div className="mt-2 flex justify-center gap-2">
            {GATES.map(g => (
              <button
                key={g} type="button"
                onClick={() => { setEmail(`gate${g}@campus.edu`); setPin(""); setError(""); }}
                className={`h-10 w-12 rounded-xl text-sm font-bold transition-colors ${
                  email === `gate${g}@campus.edu` ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 active:bg-slate-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                i < pin.length ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-transparent"
              }`}
            />
          ))}
        </div>
        
        {error && <p className="mt-4 text-sm font-bold text-rose-500">{error}</p>}

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button
              key={d} type="button" onClick={() => handleDigit(d.toString())}
              className="flex h-14 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-800 active:bg-slate-200"
            >
              {d}
            </button>
          ))}
          <button type="button" className="flex h-14 items-center justify-center rounded-2xl bg-transparent" />
          <button
            type="button" onClick={() => handleDigit("0")}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-800 active:bg-slate-200"
          >
            0
          </button>
          <button
            type="button" onClick={() => setPin(p => p.slice(0, -1))}
            className="flex h-14 items-center justify-center rounded-2xl text-slate-400 active:bg-slate-100"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        <button
          type="submit" disabled={busy || pin.length < 4}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-bold text-white active:bg-slate-800 disabled:opacity-50"
        >
          {busy ? <Loader2 size={20} className="animate-spin" /> : "Unlock"}
        </button>
      </form>
      <Link href="/forgot-password" className="mt-4 text-xs font-semibold text-slate-400 underline-offset-2 hover:underline">
        Forgot password?
      </Link>
      <Link href="/" className="mt-6 inline-flex items-center justify-center gap-1 text-sm font-bold text-slate-400">
        <ArrowLeft size={16} /> Home
      </Link>
    </main>
  );
}

// ===========================================================================
// Console — exactly two tabs.
// ===========================================================================
type Tab = "requests" | "inside" | "past" | "scan";

function Console() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("requests");
  const [activeGateId, setActiveGateId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedItem | null>(null);
  const gatesQuery = useQuery({ queryKey: ["gates"], queryFn: fetchGates });
  const gates: GateDTO[] = useMemo(() => {
    const all = gatesQuery.data?.gates ?? [];
    if (session?.user?.role === "HEAD") return all;
    if (session?.user?.gateIds) {
      return all.filter((g) => session.user.gateIds!.includes(g.id));
    }
    return [];
  }, [gatesQuery.data, session]);

  useEffect(() => {
    if (!activeGateId && gates.length) setActiveGateId(gates[0].id);
  }, [gates, activeGateId]);
  const activeGate = gates.find((g) => g.id === activeGateId) ?? null;

  // The single live master feed — polled every 5s.
  const feedQuery = useQuery({
    queryKey: ["guard-feed"],
    queryFn: fetchGuardFeed,
    refetchInterval: 5000,
  });
  const items = feedQuery.data?.items ?? [];
  const broadcast = feedQuery.data?.broadcast ?? null;
  const lockdown = feedQuery.data?.lockdown ?? null;

  // Broadcast Dismissal & Audio State
  const [dismissedBroadcastMsg, setDismissedBroadcastMsg] = useState<string | null>(null);
  const lastBroadcastRef = useRef<string | null>(null);

  useEffect(() => {
    if (broadcast?.message && broadcast.message !== lastBroadcastRef.current) {
      // New broadcast arrived!
      lastBroadcastRef.current = broadcast.message;
      setDismissedBroadcastMsg(null); // Un-dismiss
      
      // Play sound and vibrate
      try {
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        const audio = new Audio("/notify.mp3"); // Assuming standard notification sound exists or browser beep
        audio.play().catch(() => {});
      } catch (e) {}
    }
  }, [broadcast?.message]);

  // Lockdown Exit-Only Mode State
  const [exitOnlyMode, setExitOnlyMode] = useState(false);
  const lastLockdownRef = useRef<boolean>(false);

  useEffect(() => {
    if (lockdown?.active && !lastLockdownRef.current) {
      // Lockdown just activated
      setExitOnlyMode(false);
      try {
        if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500]);
        const audio = new Audio("/siren.mp3"); 
        audio.play().catch(() => {});
      } catch (e) {}
    }
    lastLockdownRef.current = lockdown?.active ?? false;
    
    // Auto-switch away from restricted tabs during lockdown
    if (lockdown?.active && !exitOnlyMode && (tab === "requests" || tab === "scan")) {
      setTab("inside");
    }
  }, [lockdown?.active, exitOnlyMode, tab]);

  // Guard Audio Feedback State (persisted in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("guardSoundEnabled");
    if (saved !== null) {
      setSoundEnabled(saved !== "false");
    }
  }, []);

  // Guard Name Prompt Logic (P0.6)
  const [onDutyGuard, setOnDutyGuard] = useState<string | null>(null);
  const [isPromptingName, setIsPromptingName] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("onDutyGuard");
    if (saved) {
      setOnDutyGuard(saved);
      setIsPromptingName(false);
    }
  }, []);

  function saveGuardName(name: string) {
    const finalName = name.trim() || "unnamed";
    localStorage.setItem("onDutyGuard", finalName);
    setOnDutyGuard(finalName);
    setIsPromptingName(false);
  }

  // Guard Session Heartbeat
  useEffect(() => {
    if (!activeGateId || !onDutyGuard) return;
    
    // Ping immediately and then every 30 seconds
    const ping = () => {
      fetch("/api/guard/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateId: activeGateId, guardName: onDutyGuard })
      }).catch(() => {});
    };
    
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [activeGateId, onDutyGuard]);

  // Actions (shared by the feed + the scanner result card).
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusyKey(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["guard-feed"] });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Action failed. Try again.");
    } finally {
      setBusyKey(null);
    }
  }
  const onApprove = (i: FeedItem) => {
    playGuardSound("success", soundEnabled);
    return run(i.key, () =>
      i.category === "HOUSE_HELP"
        ? actionHouseHelp({ token: i.ref, action: "CHECK_IN", gateId: activeGateId! })
        : i.kind === "VIP" 
        ? checkinVIPPass(i.ref, activeGateId!, onDutyGuard || "unnamed") 
        : decideVisit(i.visitId!, "approve", onDutyGuard || "unnamed")
    );
  };
  const onExit = (i: FeedItem) => {
    playGuardSound("success", soundEnabled);
    return run(i.key, () =>
      i.category === "HOUSE_HELP"
        ? actionHouseHelp({ token: i.ref, action: "CHECK_OUT", gateId: activeGateId! })
        : i.kind === "VIP" 
        ? exitVIPPass(i.ref, activeGateId!, onDutyGuard || "unnamed") 
        : exitVisit(i.ref, activeGateId!, onDutyGuard || "unnamed")
    );
  };
  const onReject = (i: FeedItem) => {
    playGuardSound("warning", soundEnabled);
    return run(i.key, () => {
      if (i.kind === "VIP" || i.category === "HOUSE_HELP") throw new Error("Cannot reject a VIP / House Help pass");
      return decideVisit(i.visitId!, "reject", onDutyGuard || "unnamed");
    });
  };
  const onEscalate = (i: FeedItem) => {
    playGuardSound("escalate", soundEnabled);
    return run(i.key, () => {
      if (i.kind === "VIP") throw new Error("Cannot escalate a VIP pass");
      return decideVisit(i.visitId!, "escalate", onDutyGuard || "unnamed");
    });
  };

  if (isPromptingName) {
    return <GuardNamePrompt onSave={saveGuardName} />;
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-slate-800" />
            <div>
              <p className="text-sm font-bold leading-tight">Gate Console</p>
              <p className="text-[11px] font-medium text-slate-500">
                Manning {activeGate ? activeGate.name : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Feedback Toggle */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                localStorage.setItem("guardSoundEnabled", String(next));
                if (next) playGuardSound("scan", true);
              }}
              className={
                "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition border " +
                (soundEnabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-slate-100 text-slate-400 border-slate-200")
              }
              title={soundEnabled ? "Audio alerts enabled" : "Audio muted"}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
            </button>

            <button
              onClick={() => setIsPromptingName(true)}
              className="text-xs font-bold text-slate-500 underline decoration-slate-300 underline-offset-4"
            >
              {onDutyGuard === "unnamed" ? "Set Name" : onDutyGuard}
            </button>
            <button
              onClick={() => signOut({ redirect: false })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 active:bg-slate-50"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* Operating-gate selector (sets the gate stamped on entry/exit) */}
        {gates.length > 1 && (
          <div className="mx-auto flex max-w-2xl items-center gap-1.5 overflow-x-auto px-4 pb-2">
            <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              At gate
            </span>
            {gates.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGateId(g.id)}
                className={
                  "shrink-0 rounded-lg px-3 py-1 text-xs font-bold " +
                  (g.id === activeGateId ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")
                }
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {/* Four tabs (Requests, Inside, Past, Scan) */}
        <div className="mx-auto flex max-w-2xl overflow-x-auto no-scrollbar border-b border-slate-100">
          {!lockdown?.active && (
            <BigTab active={tab === "requests"} onClick={() => setTab("requests")} label="Requests" count={items.filter(i => i.state === "PENDING" && (i.kind === "VIP" || i.entryGateId === activeGateId)).length} />
          )}
          <BigTab active={tab === "inside"} onClick={() => setTab("inside")} label="Inside" count={items.filter(i => i.state === "ACTIVE").length} />
          <BigTab active={tab === "past"} onClick={() => setTab("past")} label="Past" count={items.filter(i => i.state === "PAST").length} />
          {!lockdown?.active && (
            <BigTab active={tab === "scan"} onClick={() => setTab("scan")} label="Scan" icon />
          )}
        </div>
      </header>

      {/* Broadcast Banner (Pinned) */}
      {broadcast?.message && broadcast.message !== dismissedBroadcastMsg && (
        <div className={`px-4 py-3 flex items-start gap-3 relative shadow-md z-40 ${broadcast.priority === "urgent" ? "bg-amber-500 text-white" : "bg-blue-50 text-blue-800 border-b border-blue-200"}`}>
          <Megaphone size={20} className="shrink-0 mt-0.5" />
          <div className="flex-1 pr-6">
            <p className="text-sm font-semibold">{broadcast.message}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-75 mt-1">Broadcast Alert</p>
          </div>
          <button 
            onClick={() => setDismissedBroadcastMsg(broadcast.message)}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Full-Screen Lockdown Overlay */}
      {lockdown?.active && !exitOnlyMode && (
        <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center p-6 text-center text-white">
          <Lock size={80} className="animate-pulse mb-6" />
          <h1 className="text-4xl font-black uppercase tracking-widest mb-4">Lockdown Active</h1>
          <p className="text-xl font-bold mb-8">NO NEW ENTRIES PERMITTED</p>
          {lockdown.reason && (
            <div className="bg-red-900/50 p-6 rounded-2xl max-w-lg mb-12">
              <p className="text-lg font-medium">{lockdown.reason}</p>
            </div>
          )}
          <button 
            onClick={() => setExitOnlyMode(true)}
            className="px-8 py-4 bg-white text-red-600 font-bold rounded-2xl text-lg shadow-xl active:scale-95 transition-transform"
          >
            Process Exits Only
          </button>
        </div>
      )}

      {/* Exit-Only Mode Banner */}
      {lockdown?.active && exitOnlyMode && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md relative z-40">
          <div className="flex items-center gap-2">
            <Lock size={16} className="animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wide">Lockdown: Exit-Only Mode</p>
          </div>
          <button onClick={() => setExitOnlyMode(false)} className="text-xs font-bold underline">View Full Screen</button>
        </div>
      )}

      {tab === "scan" ? (
        <ScannerTab
          busyKey={busyKey}
          soundEnabled={soundEnabled}
          onApprove={onApprove}
          onReject={onReject}
          onExit={onExit}
          onEscalate={onEscalate}
          onOpenDetails={setDetail}
        />
      ) : (
        <LiveTraffic
          items={items}
          loading={feedQuery.isLoading}
          gateName={activeGate?.name ?? "this gate"}
          activeGateId={activeGateId}
          filterState={tab === "requests" ? "PENDING" : tab === "inside" ? "ACTIVE" : "PAST"}
          busyKey={busyKey}
          onApprove={onApprove}
          onReject={onReject}
          onExit={onExit}
          onEscalate={onEscalate}
          onOpenDetails={setDetail}
        />
      )}

      {detail && <DetailsModal item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function BigTab({
  active, onClick, label, count, icon,
}: { active: boolean; onClick: () => void; label: string; count?: number; icon?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-2 border-b-4 py-4 text-sm font-bold transition-colors " +
        (active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400")
      }
    >
      {icon && <QrCode size={18} />}
      {label}
      {count != null && (
        <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ===========================================================================
// Tab 1 — Live Traffic (master feed)
// ===========================================================================
function LiveTraffic({
  items, loading, gateName, activeGateId, filterState, busyKey, onApprove, onReject, onExit, onEscalate, onOpenDetails,
}: {
  items: FeedItem[];
  loading: boolean;
  gateName: string;
  activeGateId: string | null;
  filterState: "PENDING" | "ACTIVE" | "PAST";
  busyKey: string | null;
  onApprove: (i: FeedItem) => void;
  onReject: (i: FeedItem) => void;
  onExit: (i: FeedItem) => void;
  onEscalate: (i: FeedItem) => void;
  onOpenDetails: (i: FeedItem) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    let list = items;
    if (activeGateId) {
      list = list.filter((i) => {
        if (i.state === "PENDING" && i.kind === "NORMAL" && i.entryGateId !== activeGateId) {
          return false;
        }
        return true;
      });
    }
    list = list.filter((i) => i.state === filterState);

    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.phone.toLowerCase().includes(s) ||
        (i.vehicleNumber ?? "").toLowerCase().includes(s)
    );
  }, [q, items, activeGateId, filterState]);

  return (
    <div>
      {/* Sticky, massive search */}
      <div className="sticky top-[104px] z-10 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <div className="relative mx-auto max-w-2xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone or vehicle…"
            className="w-full rounded-2xl border-2 border-slate-300 bg-white py-4 pl-12 pr-4 text-base font-medium outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm font-medium text-slate-400">
            {q ? "No matches." : "No traffic right now."}
          </p>
        ) : (
          filtered.map((i) => (
            <FeedCard
              key={i.key}
              item={i}
              busy={busyKey === i.key}
              onApprove={() => onApprove(i)}
              onReject={() => onReject(i)}
              onExit={() => onExit(i)}
              onEscalate={() => onEscalate(i)}
              onOpenDetails={() => onOpenDetails(i)}
            />
          ))
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// The card — vehicle plate dominant, giant buttons.
// ===========================================================================
function fmtDur(mins: number | null): string {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const TERMINAL = ["EXITED", "REJECTED", "EXPIRED"];

function FeedCard({
  item, busy, onApprove, onReject, onExit, onEscalate, onOpenDetails,
}: {
  item: FeedItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onExit: () => void;
  onEscalate: () => void;
  onOpenDetails: () => void;
}) {
  const isHelp = item.category === "HOUSE_HELP";
  const isVip = item.kind === "VIP" && !isHelp;
  const isDayPass = item.category === "DELIVERY" || item.category === "VENDOR" || item.category === "DELIVERY_VENDOR";
  const terminal = TERMINAL.includes(item.status);
  const overstayRed = item.state === "ACTIVE" && item.overstaying;
  const color = categoryColor(item.category);

  return (
    <div
      className={
        // The whole card is tinted with the category color so a guard can identify
        // the category at a glance. Overstay still forces the bold red border.
        "overflow-hidden rounded-2xl shadow-sm " + color.bg + " " +
        (overstayRed ? "border-4 border-red-600" : "border-2 " + color.border)
      }
    >
      {/* Alert bars (blacklist warn-only, preserved) */}
      {item.blacklisted && (
        <div className="bg-rose-600 py-2 flex items-center justify-center gap-1.5 text-sm font-black tracking-wide text-white">
          <AlertTriangle size={14} /> BLACKLISTED
        </div>
      )}
      {isHelp && item.status === "EXPIRED" && (
        <div className="bg-amber-600 py-2 flex items-center justify-center gap-1.5 text-sm font-black tracking-wide text-white">
          <AlertTriangle size={14} /> EXPIRED / PAUSED BY RESIDENT STAFF
        </div>
      )}
      {isHelp && item.awaitingHead && (
        <div className="bg-amber-500 py-2 flex items-center justify-center gap-1.5 text-sm font-black tracking-wide text-white">
          <AlertTriangle size={14} /> AWAITING HEAD ADMIN CLEARANCE
        </div>
      )}
      {overstayRed && (
        <div className="bg-red-600 py-2 flex items-center justify-center gap-1.5 text-sm font-black tracking-wide text-white">
          <AlertTriangle size={14} /> OVERSTAY (&gt; 120 MINS)
        </div>
      )}

      {/* Tap the header to open full details */}
      <button onClick={onOpenDetails} className="block w-full p-4 text-left">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {item.selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.selfieUrl}
                alt={item.name}
                className="h-32 w-32 rounded-xl border-2 border-slate-900 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                {isHelp ? <User size={40} /> : isVip ? <Star size={40} /> : <User size={40} />}
              </div>
            )}
            {isDayPass && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                VERIFY FACE
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold leading-tight text-slate-900">
              {item.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={
                  "rounded-full px-2.5 py-0.5 text-xs font-bold " + color.badge
                }
              >
                {isHelp ? item.categoryLabel : isVip ? "OFFICIAL GUEST" : isDayPass ? `🛵 ${item.categoryLabel} Day Pass` : item.categoryLabel}
              </span>
              {item.entryGateName && (
                <span className="text-xs font-medium text-slate-400">{item.entryGateName}</span>
              )}
            </div>

            {/* Requested-at timestamp */}
            <p className="mt-2 text-xs font-medium text-slate-500">
              Requested at: {fmtClock(item.createdAt)}
            </p>

            {/* Duration inside for active visitors */}
            {item.state === "ACTIVE" && item.minutesInside != null && (
              <p
                className={
                  "mt-0.5 text-sm font-bold " +
                  (item.overstaying ? "text-red-600" : "text-slate-700")
                }
              >
                Inside for: {fmtDur(item.minutesInside)} {isDayPass ? "(120m limit)" : ""}
              </p>
            )}

            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Tap for full details →
            </p>
          </div>
        </div>

        {/* Massive license-plate vehicle number */}
        {item.vehicleNumber && (
          <div className="mt-3 rounded-lg border-4 border-slate-900 bg-yellow-300 px-3 py-2 text-center">
            <span className="font-mono text-3xl font-black tracking-[0.15em] text-slate-900">
              {item.vehicleNumber}
            </span>
          </div>
        )}
      </button>

      {/* Action buttons */}
      <div className="px-4 pb-4">
        {terminal ? (
          <p className="rounded-xl bg-slate-100 py-3 text-center text-sm font-bold uppercase text-slate-500">
            Already {item.status.toLowerCase()}
          </p>
        ) : item.state === "ACTIVE" ? (
          <button
            onClick={onExit}
            disabled={busy}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 text-lg font-black text-white active:bg-slate-900 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" /> : <DoorOpen size={24} />} MARK EXIT
          </button>
        ) : isHelp && item.status === "EXPIRED" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-sm font-bold text-amber-700">
            ⛔ Pass Expired / Paused by Resident Staff
          </p>
        ) : isHelp && item.awaitingHead ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-sm font-bold text-amber-700">
            ⚠️ Awaiting One-Time Head Admin Clearance
          </p>
        ) : item.awaitingHead ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-sm font-bold text-amber-700">
            Awaiting HEAD approval
          </p>
        ) : (
          <div className="flex gap-2">
            {!isHelp && (
              <button
                onClick={onReject}
                disabled={busy}
                className="flex h-16 w-1/3 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 text-xs font-black text-red-600 active:bg-red-100 disabled:opacity-50"
                title="Reject entry or report impersonator / QR sharing"
              >
                <X size={20} /> {isDayPass ? "REJECT / FRAUD" : "REJECT"}
              </button>
            )}
            <button
              onClick={onApprove}
              disabled={busy}
              className="flex h-16 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-black text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Check size={26} />} {isHelp ? "CHECK IN" : "APPROVE"}
            </button>
          </div>
        )}
        
        {/* Escalate button for pending regular visits */}
        {!terminal && item.state === "PENDING" && !isVip && !isHelp && (
          <button
            onClick={onEscalate}
            disabled={busy}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-200 bg-rose-50 text-base font-bold text-rose-700 active:bg-rose-100 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" /> : <AlertTriangle size={20} />} FLAG / ESCALATE
          </button>
        )}
      </div>
    </div>
  );
}

// Full-details bottom sheet — shows the entire parsed form the visitor submitted.
function DetailsModal({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const qc = useQueryClient();

  const handleEdit = () => {
    const initial: Record<string, string> = {};
    if (item.vehicleNumber) initial["Vehicle"] = item.vehicleNumber;
    item.fields.forEach(f => {
      if (f.label !== "Approved by Guard") initial[f.label] = f.value;
    });
    setEditValues(initial);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const url = item.kind === "VIP" ? `/api/vip/${item.visitId}` : `/api/visits/${item.visitId}`;
      const payload: any = {};
      if (item.kind === "VIP") {
        payload.purpose = editValues["Purpose"] || undefined;
        payload.vehicleNumber = editValues["Vehicle"] || undefined;
      } else {
        payload.detailsByLabel = { ...editValues };
        if (editValues["Vehicle"] !== undefined) {
          payload.vehicleNumber = editValues["Vehicle"];
        }
      }
      
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e) {}
        throw new Error(msg);
      }
      qc.invalidateQueries({ queryKey: ["guard-feed"] });
      setIsEditing(false);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-bold">
            {item.kind === "VIP" ? "Official Guest" : item.categoryLabel} details
          </h2>
          <div className="flex gap-3">
            {!isEditing && (
              <button onClick={handleEdit} className="text-sm font-bold text-brand-600 active:text-brand-700">
                Edit
              </button>
            )}
            {isEditing && (
              <button onClick={handleSave} disabled={isSaving} className="text-sm font-bold text-brand-600 active:text-brand-700 disabled:opacity-50">
                {isSaving ? "Saving..." : "Save"}
              </button>
            )}
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {item.selfieUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.selfieUrl} alt={item.name} className="mx-auto h-44 w-44 rounded-xl border border-slate-200 object-cover" />
          )}

          <div className="rounded-xl bg-slate-900 py-3 text-center text-white">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Reference</p>
            <p className="font-mono text-lg font-bold tracking-wider">{item.ref}</p>
          </div>

          <dl className="overflow-hidden rounded-xl border border-slate-200 text-sm">
            <Row label="Name" value={item.name} />
            <Row label="Phone" value={item.phone} />
            {item.entryGateName && <Row label="Entry gate" value={item.entryGateName} />}
            <Row label="Requested at" value={new Date(item.createdAt).toLocaleString()} />
            {item.state === "ACTIVE" && item.minutesInside != null && (
              <Row label="Inside for" value={fmtDur(item.minutesInside)} />
            )}
            <Row label="Status" value={item.status} />
            
            {/* Editable fields */}
            {(!isEditing && item.vehicleNumber) && <Row label="Vehicle" value={item.vehicleNumber} />}
            {isEditing && (
              <div className="flex flex-col gap-1 border-b border-slate-100 px-3 py-2.5">
                <label className="text-xs text-slate-500">Vehicle</label>
                <input 
                  type="text" 
                  value={editValues["Vehicle"] || ""} 
                  onChange={e => setEditValues({ ...editValues, Vehicle: e.target.value })}
                  className="rounded bg-slate-50 px-2 py-1 outline-none focus:ring-1 focus:ring-brand-500" 
                />
              </div>
            )}

            {/* The full submitted form */}
            {item.fields.map((f, i) => {
              if (f.label === "Approved by Guard") {
                 return <Row key={`f-${i}`} label={f.label} value={f.value} />;
              }
              if (isEditing) {
                return (
                  <div key={`f-${i}`} className="flex flex-col gap-1 border-b border-slate-100 px-3 py-2.5">
                    <label className="text-xs text-slate-500">{f.label}</label>
                    <input 
                      type="text" 
                      value={editValues[f.label] || ""} 
                      onChange={e => setEditValues({ ...editValues, [f.label]: e.target.value })}
                      className="rounded bg-slate-50 px-2 py-1 outline-none focus:ring-1 focus:ring-brand-500" 
                    />
                  </div>
                );
              }
              return <Row key={`f-${i}`} label={f.label} value={f.value} />;
            })}
          </dl>

          {item.blacklisted && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm font-bold text-rose-700">
              ⚠ This phone is BLACKLISTED
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

// ===========================================================================
// Tab 2 — Universal QR scanner
// ===========================================================================
function ScannerTab({
  busyKey, soundEnabled, onApprove, onReject, onExit, onEscalate, onOpenDetails,
}: {
  busyKey: string | null;
  soundEnabled: boolean;
  onApprove: (i: FeedItem) => void;
  onReject: (i: FeedItem) => void;
  onExit: (i: FeedItem) => void;
  onEscalate: (i: FeedItem) => void;
  onOpenDetails: (i: FeedItem) => void;
}) {
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<FeedItem | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);

  async function stopCamera() {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (nativeStreamRef.current) {
      nativeStreamRef.current.getTracks().forEach((t) => t.stop());
      nativeStreamRef.current = null;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {}
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
    setCameraOn(false);
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function toggleTorch() {
    if (!nativeStreamRef.current) return;
    const track = nativeStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {}
    }
  }

  async function startCamera() {
    setError(null);
    setScanned(null);
    setCameraOn(true);
    isScanningRef.current = true;

    // Check if native BarcodeDetector API is supported (GPU/NPU hardware accelerated, sub-15ms)
    const hasNativeBarcodeDetector =
      typeof window !== "undefined" && "BarcodeDetector" in window;

    setTimeout(async () => {
      if (hasNativeBarcodeDetector) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "data_matrix", "aztec"],
          });

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          nativeStreamRef.current = stream;

          const track = stream.getVideoTracks()[0];
          if (track) {
            const capabilities = (track as any).getCapabilities?.() || {};
            if (capabilities.torch) setHasTorch(true);
            try {
              await (track as any).applyConstraints?.({
                advanced: [{ focusMode: "continuous" }],
              });
            } catch (e) {}
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const scanFrame = async () => {
              if (!isScanningRef.current) return;
              if (videoRef.current && videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    if (code) {
                      isScanningRef.current = false;
                      if (typeof navigator !== "undefined" && navigator.vibrate) {
                        navigator.vibrate([40, 20, 40]);
                      }
                      playGuardSound("scan", soundEnabled);
                      stopCamera();
                      lookup(code);
                      return;
                    }
                  }
                } catch (e) {}
              }
              if (isScanningRef.current) {
                animFrameRef.current = requestAnimationFrame(scanFrame);
              }
            };
            animFrameRef.current = requestAnimationFrame(scanFrame);
          }
          return;
        } catch (nativeErr) {
          // Fallback to high-speed Html5Qrcode
        }
      }

      // High-speed Html5Qrcode fallback (30fps full-sensor)
      try {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 30, // Turbo 30 FPS for instant frame capture
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return { width: Math.floor(minEdge * 0.9), height: Math.floor(minEdge * 0.9) };
            },
            aspectRatio: 1.0,
            disableFlip: true,
          },
          (decodedText) => {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([40, 20, 40]);
            }
            playGuardSound("scan", soundEnabled);
            stopCamera();
            lookup(decodedText);
          },
          () => {} // silent frame discard
        );
      } catch (err) {
        setError("Camera unavailable — enter the code manually.");
        setCameraOn(false);
      }
    }, 120);
  }

  async function lookup(code: string) {
    let c = code.trim();
    if (!c) return;
    if (c.includes("/pass/")) {
      c = c.split("/pass/").pop()?.split("?")[0]?.split("#")[0] ?? c;
    }
    setLoading(true);
    setError(null);
    setScanned(null);
    try {
      const { item } = await fetchGuardLookup(c);
      setScanned(item);
      if (item.blacklisted || item.status === "EXPIRED" || item.status === "REJECTED") {
        playGuardSound("warning", soundEnabled);
      } else if (item.status === "APPROVED") {
        playGuardSound("success", soundEnabled);
      } else {
        playGuardSound("scan", soundEnabled);
      }
    } catch (e) {
      playGuardSound("warning", soundEnabled);
      setError(e instanceof ApiError ? e.message : "Not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      {/* Camera */}
      {cameraOn ? (
        <div className="overflow-hidden rounded-2xl border border-slate-900 bg-black">
          <div className="relative w-full bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full bg-black object-cover"
            />
            <div id="reader" className="w-full bg-black"></div>
          </div>
          <button onClick={stopCamera} className="w-full bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition">
            Stop camera
          </button>
        </div>
      ) : (
        <button
          onClick={startCamera}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-bold text-white active:bg-slate-800"
        >
          <QrCode size={20} /> Open Camera Scanner
        </button>
      )}

      {/* Manual fallback */}
      <form onSubmit={(e) => { e.preventDefault(); lookup(manual); }} className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Or enter code (VMS-…, GST-…, or HLP-…)
        </p>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="VMS-XXXXX"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono text-base outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !manual.trim()}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Find
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      )}

      {/* Result card */}
      {scanned && (
        <FeedCard
          item={scanned}
          busy={busyKey === scanned.key}
          onApprove={() => { onApprove(scanned); setScanned(null); }}
          onReject={() => { onReject(scanned); setScanned(null); }}
          onExit={() => { onExit(scanned); setScanned(null); }}
          onEscalate={() => { onEscalate(scanned); setScanned(null); }}
          onOpenDetails={() => onOpenDetails(scanned)}
        />
      )}
    </main>
  );
}

// ===========================================================================
// Guard Name Prompt
// ===========================================================================
function GuardNamePrompt({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 px-6 text-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-6">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Who is on duty?</h2>
        <p className="mt-2 text-sm text-slate-500 mb-6">
          Please enter your name for the shift audit log. This is required before accessing the gate console.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); onSave(name); }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Singh"
            required
            autoFocus
            className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-center text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 mb-4"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white disabled:opacity-50 active:bg-indigo-700"
          >
            Start Shift
          </button>
        </form>
      </div>
    </div>
  );
}
