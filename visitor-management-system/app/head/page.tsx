"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import GoogleIcon from "@/components/GoogleIcon";
import {
  fetchAnalyticsDashboard,
  fetchEscalatedVisits,
  fetchVIPQueue,
  decideVIPPass,
  decideVisit,
  fetchSettings,
  updateSettings,
  fetchBlacklist,
  addBlacklist,
  updateBlacklist,
  deleteBlacklist,
  fetchDefaulters,
  editVisit,
  editVIP,
  adminCreateVisit,
  adminCreateVIP,
  fetchFormConfig,
  createFormCategory,
  updateFormCategory,
  deleteFormCategory,
  createFormField,
  updateFormField,
  deleteFormField,
  fetchGates,
  fetchActiveOnCampus,
  fetchGuardFeed,
  fetchActiveOverstays,
  forceExitVisit,
  fetchLockdownStatus,
  setLockdown,
  sendBroadcast,
  clearBroadcast,
  adminSearch,
  bulkDecideVisits,
  bulkDecideVIPs,
  type FeedItem,
  type VIPDTO,
  type VisitDTO,
  type FormCategoryConfig,
  type FormFieldConfig,
  type BlacklistDTO,
  type DefaulterDTO,
  type SearchResult,
  fetchAuditLogs,
  fetchHeadAnalytics,
  fetchUsers,
  createUser,
  updateUser,
  deactivateUser,
  type StaffUserDTO,
  fetchAllVIPPasses,
  fetchAdminHouseHelps,
  decideHouseHelp,
  fetchIncidents,
  createIncident,
  resolveIncident,
  type HouseHelpDTO,
  type IncidentDTO,
} from "@/lib/api";
import {
  Loader2,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  Users,
  DoorOpen,
  Clock,
  Phone,
  Car,
  Check,
  X,
  Eye,
  Settings,
  UsersRound,
  FileSpreadsheet,
  Edit2,
  Trash2,
  PlusCircle,
  QrCode,
  Calendar,
  Search,
  KeyRound,
  ChevronRight,
  Info,
  CheckCircle2,
  CircleHelp,
  Download,
  UserPlus,
  Power,
  Ticket,
  UserCheck,
  AlertOctagon,
  Sparkles,
  Home,
  MessageSquareWarning,
  FileText,
  Printer,
  FileDown,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { CATEGORY_ICON } from "@/lib/icons";
import { printCsvReport } from "@/lib/exportReport";

type TopSection = "dashboard" | "guest_passes" | "house_helps" | "incidents" | "forms" | "blacklist" | "settings" | "search" | "analytics" | "audit" | "users";
type SubTab = "vip" | "alerts" | "active";

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatApiError(err: any, fallback: string): string {
  if (err?.details && Array.isArray(err.details)) {
    const list = err.details
      .map((d: any) => `${d.field || d.path || "Field"}: ${d.message}`)
      .join("\n");
    return `${err.message || fallback}\n\nValidation Errors:\n${list}`;
  }
  return err?.message || fallback;
}

function getCategoryIcon(iconName: string | null): LucideIcons.LucideIcon {
  if (!iconName) return LucideIcons.CircleHelp;
  const legacy = (CATEGORY_ICON as any)[iconName.toLowerCase()];
  if (legacy) return legacy;
  const IconComponent = (LucideIcons as any)[iconName];
  return IconComponent || LucideIcons.CircleHelp;
}

export default function HeadPage() {
  const { status, data: session } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-400">
        <Loader2 className="animate-spin text-slate-900" size={28} />
      </div>
    );
  }

  if (status !== "authenticated" || session?.user?.role !== "HEAD") {
    return <HeadLoginPage />;
  }

  return <HeadConsole userName={session?.user?.name || "HEAD"} />;
}

function HeadLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password. Please try again.");
    }
    // On success, the parent component will re-render with authenticated session
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your HEAD admin credentials</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="head-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="head-email"
            type="email"
            autoComplete="email"
            placeholder="admin@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            required
          />
        </div>

        <div>
          <label htmlFor="head-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="head-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            required
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition active:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/head" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          <GoogleIcon /> Sign in with Google
        </button>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-400 underline-offset-2 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </form>
    </main>
  );
}

function HeadConsole({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState("");
  const [section, setSection] = useState<TopSection>("dashboard");
  const [activeTab, setActiveTab] = useState<SubTab>("vip");

  // Selection states
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [selectedVIP, setSelectedVIP] = useState<VIPDTO | null>(null);
  const [editVisitMode, setEditVisitMode] = useState<VisitDTO | null>(null);
  const [editVIPMode, setEditVIPMode] = useState<VIPDTO | null>(null);

  // Modal display states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBlacklistPrompt, setShowBlacklistPrompt] = useState<{ phone: string; name?: string } | null>(null);

  // Search states
  const [vipSearch, setVipSearch] = useState("");
  const [alertsSearch, setAlertsSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [trafficFilter, setTrafficFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "PAST">("ALL");
  const [globalSearch, setGlobalSearch] = useState("");
  const [broadcastInput, setBroadcastInput] = useState("");
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastScheduledTime, setBroadcastScheduledTime] = useState("");
  const [clock, setClock] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerBlock = (phone: string, name?: string) => {
    setShowBlacklistPrompt({ phone, name });
    setSection("blacklist");
  };

  // ── New Features Queries ──
  const lockdownQuery = useQuery({
    queryKey: ["lockdown"],
    queryFn: fetchLockdownStatus,
    refetchInterval: 5_000,
  });

  const searchResultsQuery = useQuery({
    queryKey: ["adminSearch", globalSearch],
    queryFn: () => adminSearch(globalSearch),
    enabled: globalSearch.length > 2,
  });

  // Queries
  const analyticsQuery = useQuery({
    queryKey: ["analytics", selectedDate],
    queryFn: () => fetchAnalyticsDashboard(selectedDate || undefined),
    refetchInterval: 15_000,
  });

  const vipQueueQuery = useQuery({
    queryKey: ["vip-queue"],
    queryFn: fetchVIPQueue,
    refetchInterval: 10_000,
  });

  const escalatedQuery = useQuery({
    queryKey: ["escalated-visits"],
    queryFn: fetchEscalatedVisits,
    refetchInterval: 10_000,
  });

  const activeCampusQuery = useQuery({
    queryKey: ["active-campus"],
    queryFn: fetchActiveOnCampus,
    refetchInterval: 10_000,
  });

  // Unified live feed — standard + VIP, pending + active (fixes "VIP-only" admin view).
  const feedQuery = useQuery({
    queryKey: ["guard-feed"],
    queryFn: fetchGuardFeed,
    refetchInterval: 5_000,
    enabled: section === "dashboard",
  });
  const feed: FeedItem[] = feedQuery.data?.items ?? [];

  const defaultersQuery = useQuery({
    queryKey: ["defaulters"],
    queryFn: fetchDefaulters,
    refetchInterval: 15_000,
  });

  // P1.5: Active overstays
  const overstaysQuery = useQuery({
    queryKey: ["active-overstays"],
    queryFn: fetchActiveOverstays,
    refetchInterval: 15_000,
  });

  // Global Badge Queries for Admin Overwatch
  const houseHelpsBadgeQuery = useQuery({
    queryKey: ["admin-house-helps-badge"],
    queryFn: () => fetchAdminHouseHelps("ALL"),
    refetchInterval: 10_000,
  });

  const incidentsBadgeQuery = useQuery({
    queryKey: ["admin-incidents-badge"],
    queryFn: () => fetchIncidents(),
    refetchInterval: 10_000,
  });

  // Decisions
  const decideVIP = useMutation({
    mutationFn: (a: { id: string; action: "approve" | "reject" }) => decideVIPPass(a.id, a.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-queue"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const decideStd = useMutation({
    mutationFn: (a: { id: string; action: "approve" | "reject" }) => decideVisit(a.id, a.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalated-visits"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["guard-feed"] });
      setSelectedVisit(null);
    },
  });

  const forceExitMutation = useMutation({
    mutationFn: (id: string) => forceExitVisit(id, "Force exited by Admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-overstays"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["active-campus"] });
      queryClient.invalidateQueries({ queryKey: ["guard-feed"] });
    },
  });

  const toggleLockdownMutation = useMutation({
    mutationFn: (active: boolean) => setLockdown(active, "Emergency Lockdown Triggered"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lockdown"] }),
  });

  const broadcastMutation = useMutation({
    mutationFn: (args: { msg: string; priority: "normal" | "urgent"; scheduledFor?: string }) => sendBroadcast(args.msg, args.priority, args.scheduledFor),
    onSuccess: () => {
      setShowBroadcastModal(false);
      setBroadcastInput("");
      setBroadcastScheduledTime("");
      alert("Broadcast sent to all guards.");
    },
  });

  const bulkApproveVipMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDecideVIPs(ids, "approve"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-queue"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const dash = analyticsQuery.data;
  const vipPending = vipQueueQuery.data?.items ?? [];
  const escalated = escalatedQuery.data?.items ?? [];
  const activeCampus = activeCampusQuery.data?.items ?? [];
  const defaulters = defaultersQuery.data?.items ?? [];
  const activeOverstays = overstaysQuery.data ?? [];

  // Live Notification Counts for Tabs
  const pendingHouseHelpsCount =
    houseHelpsBadgeQuery.data?.items?.filter((h) => h.status === "PENDING_APPROVAL").length ?? 0;
  const openIncidentsCount =
    incidentsBadgeQuery.data?.items?.filter((i) => i.status === "FLAGGED").length ?? 0;
  const repeatDefaultersCount = defaulters.length;
  const dashboardAlertsCount = escalated.length + activeOverstays.length;
  const pendingVipsCount = vipPending.filter((v) => v.status === "PENDING").length;

  const totalCat = dash?.categoryBreakdown?.reduce((s, i) => s + i.count, 0) ?? 0;
  const maxThroughput = Math.max(
    1,
    ...(dash?.gateThroughput?.map((g) => g.entries + g.exits) ?? [1])
  );

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-900">Head Command</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Executive Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <SidebarNavButton
            active={section === "dashboard"}
            onClick={() => setSection("dashboard")}
            label="Command Board"
            icon={<Users size={17} />}
          />
          <SidebarNavButton
            active={section === "guest_passes"}
            onClick={() => setSection("guest_passes")}
            label="Guest Overwatch"
            icon={<Ticket size={17} />}
          />
          <SidebarNavButton
            active={section === "house_helps"}
            onClick={() => setSection("house_helps")}
            label="House Helps Registry"
            icon={<UserCheck size={17} />}
            badge={pendingHouseHelpsCount}
          />
          <SidebarNavButton
            active={section === "incidents"}
            onClick={() => setSection("incidents")}
            label="Residence Incidents"
            icon={<AlertOctagon size={17} />}
            badge={openIncidentsCount}
          />
          <SidebarNavButton
            active={section === "search"}
            onClick={() => setSection("search")}
            label="Global Search"
            icon={<Search size={17} />}
          />
          <SidebarNavButton
            active={section === "forms"}
            onClick={() => setSection("forms")}
            label="Dynamic Forms"
            icon={<FileSpreadsheet size={17} />}
          />
          <SidebarNavButton
            active={section === "blacklist"}
            onClick={() => setSection("blacklist")}
            label="Blacklist Registry"
            icon={<UsersRound size={17} />}
            badge={repeatDefaultersCount}
          />
          <SidebarNavButton
            active={section === "users"}
            onClick={() => setSection("users")}
            label="Staff Accounts"
            icon={<UserPlus size={17} />}
          />
          <SidebarNavButton
            active={section === "analytics"}
            onClick={() => setSection("analytics")}
            label="System Analytics"
            icon={<LucideIcons.BarChart3 size={17} />}
          />
          <SidebarNavButton
            active={section === "audit"}
            onClick={() => setSection("audit")}
            label="Audit Trail"
            icon={<LucideIcons.History size={17} />}
          />
          <SidebarNavButton
            active={section === "settings"}
            onClick={() => setSection("settings")}
            label="System Settings"
            icon={<Settings size={17} />}
          />
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 bg-white rounded-lg py-2 border border-slate-200 shadow-sm">
            <Clock size={14} className="text-slate-400" />
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0 shadow-sm z-10">
          <h2 className="text-xl font-black tracking-tight text-slate-900 capitalize">
            {section.replace("-", " ")}
          </h2>
          
          <div className="flex items-center gap-3">
            {section === "dashboard" && (
              <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-slate-400"
                />
                <button
                  onClick={() => {
                    const url = selectedDate ? `/api/analytics/export?date=${selectedDate}` : '/api/analytics/export';
                    window.open(url, '_blank');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition shadow-sm"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            )}
            
            {lockdownQuery.data?.lockdownActive && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-black tracking-wider text-red-700 animate-pulse border border-red-200">
                <AlertTriangle size={14} /> LOCKDOWN ACTIVE
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 relative">
          {section === "dashboard" && (
          <>
            {/* KPI Block */}
            {analyticsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-slate-400" size={26} />
              </div>
            ) : dash ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <Kpi
                    label="On Campus"
                    value={dash.summary.currentlyOnCampus}
                    icon={<Users size={16} className="text-slate-400" />}
                  />
                  <Kpi
                    label="Today's Entries"
                    value={dash.summary.totalCheckedIn}
                    icon={<DoorOpen size={16} className="text-emerald-500" />}
                  />
                  <Kpi
                    label="Overstay Defaulters"
                    value={dash.summary.currentlyOverstaying ?? 0}
                    icon={<Clock size={16} className="text-amber-500" />}
                    danger={(dash.summary.currentlyOverstaying ?? 0) > 0}
                  />
                  <Kpi
                    label="Expected Guests"
                    value={dash.vipMetrics.approvedUnscanned + dash.vipMetrics.pending}
                    icon={<QrCode size={16} className="text-purple-550" />}
                  />
                  <Kpi
                    label="Incident Alerts"
                    value={dash.summary.escalatedAlerts}
                    icon={
                      <AlertTriangle
                        size={16}
                        className={dash.summary.escalatedAlerts > 0 ? "text-rose-500" : "text-slate-400"}
                      />
                    }
                    danger={dash.summary.escalatedAlerts > 0}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition shadow-sm uppercase tracking-wider"
                  >
                    <PlusCircle size={14} /> Generate Custom Pass
                  </button>
                </div>

                {activeOverstays.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle size={16} className="animate-pulse" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider">
                        Active Overstays Alert
                      </h3>
                    </div>
                    <p className="text-xs text-rose-700">
                      The following visitors are currently on campus and have exceeded their allowed time.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {activeOverstays.map((overstay) => (
                        <div
                          key={overstay.id}
                          className="bg-white rounded-lg border border-rose-200/60 p-3 flex justify-between items-center shadow-sm"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{overstay.visitorName}</p>
                            <p className="text-[10px] text-slate-500">
                              📞 {overstay.visitorPhone} • Gate: {overstay.gateName}
                            </p>
                            <p className="text-[10px] font-semibold text-rose-600 mt-0.5">
                              Overstaying by {overstay.overstayMinutes} mins ({overstay.thresholdMinutes}m limit)
                            </p>
                          </div>
                          {overstay.repeatDefaulter && (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-2 py-1 rounded uppercase">
                              Repeat
                            </span>
                          )}
                          <button
                            onClick={() => {
                              if (confirm("Force exit this visitor?")) {
                                forceExitMutation.mutate(overstay.id);
                              }
                            }}
                            disabled={forceExitMutation.isPending}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded uppercase tracking-wider ml-2"
                          >
                            Force Exit
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Panel title="Visitor Traffic Breakdowns (Today)">
                    {totalCat === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        No registrations recorded today.
                      </p>
                    ) : (
                      <div className="space-y-3.5">
                        {dash.categoryBreakdown
                          ?.filter((c) => c.count > 0)
                          ?.sort((a, b) => b.count - a.count)
                          ?.map((item) => {
                            const pct = (item.count / totalCat) * 100;
                            return (
                              <div key={item.category}>
                                <div className="mb-1.5 flex justify-between text-xs font-semibold">
                                  <span className="text-slate-700">{item.category}</span>
                                  <span className="text-slate-400">
                                    {item.count} · {pct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/50">
                                  <div
                                    className="h-full rounded-full bg-slate-900"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Gate Flow Distribution (Today)">
                    <div className="space-y-4">
                      {dash.gateThroughput?.map((g) => (
                        <div key={g.gateCode} className="flex items-center gap-3">
                          <span className="w-16 text-xs font-extrabold text-slate-500 uppercase">
                            Gate {g.gateCode}
                          </span>
                          <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 border border-slate-200/50">
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${(g.entries / maxThroughput) * 100}%` }}
                            />
                            <div
                              className="h-full bg-slate-400"
                              style={{ width: `${(g.exits / maxThroughput) * 100}%` }}
                            />
                          </div>
                          <span className="w-24 text-right text-[11px] font-extrabold text-slate-500">
                            <span className="text-emerald-700">{g.entries} in</span>
                            {" · "}
                            <span className="text-slate-500">{g.exits} out</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
                
                {/* Command Board */}
                <Panel title="Command Board">
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Emergency & Alerts</label>
                      <button
                        onClick={() => setShowBroadcastModal(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        <Users size={16} /> Broadcast Message to Guards
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to ${lockdownQuery.data?.lockdownActive ? "lift" : "trigger"} the campus lockdown?`)) {
                            toggleLockdownMutation.mutate(!lockdownQuery.data?.lockdownActive);
                          }
                        }}
                        disabled={toggleLockdownMutation.isPending}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition shadow-sm border ${
                          lockdownQuery.data?.lockdownActive 
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300' 
                            : 'bg-red-600 text-white hover:bg-red-700 border-red-700'
                        }`}
                      >
                        <AlertTriangle size={16} />
                        {lockdownQuery.data?.lockdownActive ? "Lift Emergency Lockdown" : "Trigger Emergency Lockdown"}
                      </button>
                    </div>
                  </div>
                </Panel>

              </>
            ) : (
              <Panel title="Dashboard">
                <p className="py-6 text-center text-xs text-slate-400">
                  Analytics panel failed to load.
                </p>
              </Panel>
            )}

            {/* Live Operational queues */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-200 bg-slate-50">
                <QTab
                  active={activeTab === "vip"}
                  onClick={() => setActiveTab("vip")}
                  label="Guest Clearance Pool"
                  count={vipPending.length}
                />
                <QTab
                  active={activeTab === "alerts"}
                  onClick={() => setActiveTab("alerts")}
                  label="Escalated Incidents"
                  count={escalated.length}
                />
                <QTab
                  active={activeTab === "active"}
                  onClick={() => setActiveTab("active")}
                  label="Live Traffic (All)"
                  count={feed.length}
                />
              </div>

              <div className="p-4">
                {activeTab === "vip" ? (
                  vipQueueQuery.isLoading ? (
                    <Loading />
                  ) : (
                    <div className="space-y-4">
                      <div className="relative max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={vipSearch}
                          onChange={(e) => setVipSearch(e.target.value)}
                          placeholder="Search guest name or phone..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-slate-400"
                        />
                      </div>
                      {(() => {
                        const filtered = vipPending.filter(
                          (p) =>
                            p.guestName.toLowerCase().includes(vipSearch.toLowerCase()) ||
                            p.guestPhone.includes(vipSearch)
                        );
                        if (filtered.length === 0) {
                          return <EmptyRow label="No matching guest passes awaiting clearance." />;
                        }
                        return (
                          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {filtered.map((pass) => (
                              <VipCard
                                key={pass.id}
                                pass={pass}
                                busy={decideVIP.isPending && decideVIP.variables?.id === pass.id}
                                onDecide={(action) => decideVIP.mutate({ id: pass.id, action })}
                                onEdit={() => setEditVIPMode(pass)}
                                onBlock={() => triggerBlock(pass.guestPhone, pass.guestName)}
                              />
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )
                ) : activeTab === "alerts" ? (
                  escalatedQuery.isLoading ? (
                    <Loading />
                  ) : (
                    <div className="space-y-4">
                      <div className="relative max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={alertsSearch}
                          onChange={(e) => setAlertsSearch(e.target.value)}
                          placeholder="Search incident name or phone..."
                          className="w-full rounded-lg border border-slate-205 bg-slate-50 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-slate-400"
                        />
                      </div>
                      {(() => {
                        const filtered = escalated.filter(
                          (v) =>
                            v.name.toLowerCase().includes(alertsSearch.toLowerCase()) ||
                            v.phone.includes(alertsSearch)
                        );
                        if (filtered.length === 0) {
                          return <EmptyRow label="No matching incident alerts found." />;
                        }
                        return (
                          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {filtered.map((visit) => (
                              <EscalationCard
                                key={visit.id}
                                visit={visit}
                                busy={decideStd.isPending && decideStd.variables?.id === visit.id}
                                onView={() => setSelectedVisit(visit)}
                                onDecide={(action) => decideStd.mutate({ id: visit.id, action })}
                                onEdit={() => setEditVisitMode(visit)}
                                onBlock={() => triggerBlock(visit.phone, visit.name)}
                              />
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )
                ) : feedQuery.isLoading ? (
                  <Loading />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative max-w-xs w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={activeSearch}
                          onChange={(e) => setActiveSearch(e.target.value)}
                          placeholder="Search name, phone, or vehicle..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold">
                        <button
                          onClick={() => setTrafficFilter("ALL")}
                          className={`rounded-lg px-2.5 py-1 transition ${
                            trafficFilter === "ALL"
                              ? "bg-slate-900 text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          All ({feed.length})
                        </button>
                        <button
                          onClick={() => setTrafficFilter("ACTIVE")}
                          className={`rounded-lg px-2.5 py-1 transition ${
                            trafficFilter === "ACTIVE"
                              ? "bg-emerald-600 text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Active ({feed.filter((x) => x.state === "ACTIVE").length})
                        </button>
                        <button
                          onClick={() => setTrafficFilter("PENDING")}
                          className={`rounded-lg px-2.5 py-1 transition ${
                            trafficFilter === "PENDING"
                              ? "bg-amber-600 text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Pending ({feed.filter((x) => x.state === "PENDING" && x.status === "PENDING").length})
                        </button>
                        <button
                          onClick={() => setTrafficFilter("PAST")}
                          className={`rounded-lg px-2.5 py-1 transition ${
                            trafficFilter === "PAST"
                              ? "bg-rose-700 text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Exited / Rejected ({feed.filter((x) => x.state === "PAST" || x.status === "REJECTED" || x.status === "EXITED").length})
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const s = activeSearch.toLowerCase();
                      let list = feed;
                      if (trafficFilter === "ACTIVE") {
                        list = list.filter((v) => v.state === "ACTIVE" && v.status !== "REJECTED" && v.status !== "EXITED");
                      } else if (trafficFilter === "PENDING") {
                        list = list.filter((v) => v.state === "PENDING" && v.status === "PENDING");
                      } else if (trafficFilter === "PAST") {
                        list = list.filter((v) => v.state === "PAST" || v.status === "REJECTED" || v.status === "EXITED");
                      }

                      const filtered = list.filter(
                        (v) =>
                          v.name.toLowerCase().includes(s) ||
                          v.phone.includes(activeSearch) ||
                          (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(s))
                      );
                      if (filtered.length === 0) {
                        return <EmptyRow label="No requests match your filter or search." />;
                      }
                      return (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                <th className="p-3 font-semibold">Guest</th>
                                <th className="p-3 font-semibold">Vehicle</th>
                                <th className="p-3 font-semibold">Type</th>
                                <th className="p-3 font-semibold">State</th>
                                <th className="p-3 font-semibold">Requested At</th>
                                <th className="p-3 font-semibold">Duration Inside</th>
                                <th className="p-3 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {filtered.map((v) => {
                                const overstayRed = v.state === "ACTIVE" && v.overstaying;
                                return (
                                  <tr
                                    key={v.key}
                                    onClick={() => setSelectedVisit(v)}
                                    className={
                                      (overstayRed
                                        ? "bg-red-50/70 border-l-4 border-red-600"
                                        : "hover:bg-slate-50/50 transition") + " cursor-pointer"
                                    }
                                  >
                                    <td className="p-3">
                                      <span className="font-bold text-slate-900">{v.name}</span>
                                      {v.blacklisted && (
                                        <span className="ml-1.5 rounded bg-rose-600 px-1 py-0.5 text-[8px] font-black text-white">
                                          ⚠ BLACKLISTED
                                        </span>
                                      )}
                                      <span className="block text-[10px] text-slate-400 mt-0.5">📞 {v.phone}</span>
                                    </td>
                                    <td className="p-3 font-mono font-bold uppercase">{v.vehicleNumber || "None"}</td>
                                    <td className="p-3">
                                      <span
                                        className={
                                          v.kind === "VIP"
                                            ? "bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                                            : "bg-slate-100 text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] font-medium"
                                        }
                                      >
                                        {v.kind === "VIP" ? "Guest" : v.categoryLabel}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      {v.status === "REJECTED" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          Rejected
                                        </span>
                                      ) : v.status === "EXITED" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                          Exited
                                        </span>
                                      ) : v.status === "ESCALATED" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                          Escalated
                                        </span>
                                      ) : v.state === "ACTIVE" || v.status === "APPROVED" || v.status === "CHECKED_IN" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          On campus
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          {v.awaitingHead ? "Awaiting HEAD" : "Pending"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-slate-600">
                                      {new Date(v.createdAt).toLocaleString([], {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </td>
                                    <td className="p-3">
                                      {v.state === "ACTIVE" && v.minutesInside != null ? (
                                        <span className={overstayRed ? "text-red-600 font-black" : "text-slate-700 font-semibold"}>
                                          {Math.floor(v.minutesInside / 60)}h {v.minutesInside % 60}m
                                          {overstayRed && " ⚠ >2 HRS"}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {v.kind === "NORMAL" && v.status === "PENDING" && v.visitId ? (
                                        <span className="inline-flex gap-1.5">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              decideStd.mutate({ id: v.visitId!, action: "approve" });
                                            }}
                                            disabled={decideStd.isPending && decideStd.variables?.id === v.visitId}
                                            className="rounded bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1"
                                          >
                                            <Check size={11} /> Approve
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              decideStd.mutate({ id: v.visitId!, action: "reject" });
                                            }}
                                            disabled={decideStd.isPending && decideStd.variables?.id === v.visitId}
                                            className="rounded bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1"
                                          >
                                            <X size={11} /> Reject
                                          </button>
                                        </span>
                                      ) : v.kind === "VIP" && v.awaitingHead && v.status === "PENDING" ? (
                                        <span className="text-[10px] font-semibold text-slate-400">Use Guest tab</span>
                                      ) : v.status === "REJECTED" ? (
                                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Rejected</span>
                                      ) : v.status === "EXITED" ? (
                                        <span className="text-[10px] font-medium text-slate-400">Checked Out</span>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (v.kind === "VIP") setEditVIPMode({ ...v, id: v.visitId, guestName: v.name, guestPhone: v.phone } as any);
                                            else setEditVisitMode({ ...v, id: v.visitId } as any);
                                          }}
                                          className="rounded bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
                                          title="Edit Record"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {section === "search" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="relative max-w-2xl mx-auto">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search globally by name, phone, vehicle, or reference code..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200 transition"
                />
              </div>
            </div>

            {searchResultsQuery.isLoading ? (
              <Loading />
            ) : globalSearch.length <= 2 ? (
              <EmptyRow label="Type at least 3 characters to search entire database..." />
            ) : searchResultsQuery.data ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title={`Visitor Logs (${searchResultsQuery.data.visits.length})`}>
                  {searchResultsQuery.data.visits.length === 0 ? (
                    <EmptyRow label="No visitors found." />
                  ) : (
                    <div className="space-y-3">
                      {searchResultsQuery.data.visits.map((v) => (
                        <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-900">{v.name}</p>
                              <p className="text-xs text-slate-500">📞 {v.phone}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">
                              {v.status}
                            </span>
                          </div>
                          <div className="mt-3 text-[11px] font-semibold text-slate-400 flex justify-between">
                            <span>Gate: {v.gate}</span>
                            <span>{new Date(v.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title={`Guest Passes (${searchResultsQuery.data.vips.length})`}>
                  {searchResultsQuery.data.vips.length === 0 ? (
                    <EmptyRow label="No guest passes found." />
                  ) : (
                    <div className="space-y-3">
                      {searchResultsQuery.data.vips.map((v) => (
                        <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-900">{v.name}</p>
                              <p className="text-xs text-slate-500">📞 {v.phone}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-100 text-purple-700 border border-purple-200">
                              {v.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-600">Purpose: {v.purpose}</p>
                          <div className="mt-3 text-[11px] font-semibold text-slate-400 text-right">
                            {new Date(v.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            ) : null}
          </div>
        )}

        {section === "guest_passes" && <GuestPassesOverwatchPanel onEditPass={(p) => setEditVIPMode(p)} />}

        {section === "house_helps" && <HouseHelpsAdminPanel />}

        {section === "incidents" && <IncidentsAdminPanel />}

        {section === "forms" && <FormBuilderPanel />}

        {section === "blacklist" && <BlacklistManagerPanel presetPhone={showBlacklistPrompt} onClosePreset={() => setShowBlacklistPrompt(null)} />}

        {section === "users" && <UserManagementPanel />}

        {section === "settings" && <SettingsPanel />}
        {section === "analytics" && <AnalyticsPanel />}
        {section === "audit" && <AuditPanel />}
        </div>
      </main>

      {/* Detail overlay */}
      {selectedVisit && (
        <DetailOverlay
          visit={selectedVisit}
          busy={decideStd.isPending && decideStd.variables?.id === selectedVisit.id}
          onClose={() => setSelectedVisit(null)}
          onDecide={(action) => decideStd.mutate({ id: selectedVisit.id, action })}
          onForceExit={() => forceExitMutation.mutate(selectedVisit.id)}
        />
      )}

      {/* Edit standard visit modal */}
      {editVisitMode && (
        <EditVisitModal visit={editVisitMode} onClose={() => setEditVisitMode(null)} />
      )}

      {/* Edit VIP pass modal */}
      {editVIPMode && (
        <EditVIPModal pass={editVIPMode} onClose={() => setEditVIPMode(null)} />
      )}

      {/* Create visit/VIP overrides */}
      {showCreateModal && (
        <CreatePassModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-slate-900 px-5 py-4 flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={18} />
              <h3 className="text-sm font-black tracking-wide text-white uppercase">Broadcast to Guards</h3>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-slate-600 mb-4">
                Send an urgent message that will appear as a banner on every guard's tablet.
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                rows={3}
                placeholder="e.g. VIP Convoy arriving at Gate 1 in 10 minutes. Hold standard traffic."
                value={broadcastInput}
                onChange={(e) => setBroadcastInput(e.target.value)}
              />
              <div className="mt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={broadcastScheduledTime}
                  onChange={(e) => setBroadcastScheduledTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={async () => {
                    await clearBroadcast();
                    setShowBroadcastModal(false);
                    setBroadcastInput("");
                    setBroadcastScheduledTime("");
                  }}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                >
                  Clear Current
                </button>
                <button
                  onClick={() => setShowBroadcastModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => broadcastMutation.mutate({ 
                    msg: broadcastInput, 
                    priority: "urgent", 
                    scheduledFor: broadcastScheduledTime ? new Date(broadcastScheduledTime).toISOString() : undefined 
                  })}
                  disabled={!broadcastInput.trim() || broadcastMutation.isPending}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarNavButton({
  active,
  onClick,
  label,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
        active
          ? "bg-slate-900 text-white shadow-md"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {typeof badge === "number" && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black shadow-xs bg-red-600 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

// Helpers to get full DTO parameters from cache if available or fill placeholders for active logs
function getVisitDetailsPlaceholder(id: string, cacheList: VisitDTO[]): VisitDTO | null {
  const found = cacheList.find((c) => c.id === id);
  if (found) return found;
  return {
    id,
    referenceCode: "",
    category: "PARENT",
    categoryLabel: "Parent / Guardian",
    name: "",
    phone: "",
    vehicleNumber: "",
    details: {},
    selfieUrl: "",
    status: "APPROVED",
    entryGateId: "",
    entryGateCode: "1",
    entryGateName: "Gate 1",
    exitGateId: null,
    exitGateCode: null,
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    exitedAt: null,
  };
}

function getVIPDetailsPlaceholder(id: string, cacheList: VIPDTO[]): VIPDTO | null {
  const found = cacheList.find((c) => c.id === id);
  if (found) return found;
  return {
    id,
    token: "",
    guestName: "",
    guestPhone: "",
    purpose: "",
    vehicleNumber: "",
    status: "CHECKED_IN",
    hostStaffName: "",
    approver: null,
    entryGateCode: "1",
    exitGateCode: null,
    validFrom: new Date().toISOString(),
    validUntil: new Date().toISOString(),
    enteredAt: new Date().toISOString(),
    exitedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function TopNavButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3.5 text-xs font-extrabold transition-colors " +
        (active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-655")
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Kpi({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 shadow-sm transition " +
        (danger ? "border-rose-250 bg-rose-50" : "border-slate-200 bg-white")
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon}
      </div>
      <p className={"mt-2 text-3xl font-extrabold " + (danger ? "text-rose-600" : "text-slate-900")}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

function QTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-xs font-extrabold transition " +
        (active ? "border-slate-900 bg-white text-slate-900" : "border-transparent text-slate-450 hover:text-slate-600")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-2 py-0.5 text-[9px] font-extrabold " +
          (active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")
        }
      >
        {count}
      </span>
    </button>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="animate-spin text-slate-400" size={22} />
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="py-10 text-center text-xs text-slate-400 font-semibold">{label}</p>;
}

function VipCard({
  pass,
  busy,
  onDecide,
  onEdit,
  onBlock,
}: {
  pass: VIPDTO;
  busy: boolean;
  onDecide: (a: "approve" | "reject") => void;
  onEdit: () => void;
  onBlock: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-extrabold text-slate-900">{pass.guestName}</h3>
            {pass.blacklisted && (
              <span className="bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase animate-pulse">
                Blacklisted
              </span>
            )}
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-550 border border-slate-200">
            {pass.token}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-550 font-medium">Host: {pass.hostStaffName}</p>
        <p className="text-xs text-slate-650 mt-0.5">Purpose: {pass.purpose}</p>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
          <span className="inline-flex items-center gap-1">
            <Phone size={11} /> {pass.guestPhone}
          </span>
          {pass.vehicleNumber && (
            <span className="inline-flex items-center gap-1">
              <Car size={11} /> {pass.vehicleNumber}
            </span>
          )}
          {pass.validUntil && (
            <span>Valid to {new Date(pass.validUntil).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onDecide("approve")}
          disabled={busy}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition active:bg-emerald-800 disabled:opacity-50 uppercase tracking-wider"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />} Approve
        </button>
        <button
          onClick={() => onDecide("reject")}
          disabled={busy}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition active:bg-rose-800 disabled:opacity-50 uppercase tracking-wider"
        >
          <X size={14} /> Reject
        </button>
        <button
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          title="Edit Record"
        >
          <Edit2 size={13} className="text-slate-500" />
        </button>
        <button
          type="button"
          onClick={onBlock}
          className="flex h-9 px-3 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition gap-1 text-[11px] font-bold"
          title="Block guest"
        >
          <AlertTriangle size={12} /> Block
        </button>
      </div>
    </li>
  );
}

function EscalationCard({
  visit,
  busy,
  onView,
  onDecide,
  onEdit,
  onBlock,
}: {
  visit: VisitDTO;
  busy: boolean;
  onView: () => void;
  onDecide: (a: "approve" | "reject") => void;
  onEdit: () => void;
  onBlock: () => void;
}) {
  return (
    <li className="rounded-xl border border-rose-250 bg-rose-50/20 p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold text-slate-900">{visit.name}</h3>
              {visit.blacklisted && (
                <span className="bg-rose-100 text-rose-750 border border-rose-200 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase animate-pulse">
                  Blacklisted
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-rose-700 mt-0.5">{visit.category}</p>
          </div>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[9px] font-extrabold uppercase text-rose-700 border border-rose-200">
            Escalated
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
          <span className="inline-flex items-center gap-1">
            <Phone size={11} /> {visit.phone}
          </span>
          {visit.vehicleNumber && (
            <span className="inline-flex items-center gap-1">
              <Car size={11} /> {visit.vehicleNumber}
            </span>
          )}
          <span>Gate: {visit.entryGateName}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t border-slate-200/50 pt-3">
        <button
          onClick={onView}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <Eye size={14} /> Details
        </button>
        <button
          onClick={() => onDecide("approve")}
          disabled={busy}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition active:bg-emerald-800 disabled:opacity-50 uppercase tracking-wider"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />} Approve
        </button>
        <button
          onClick={() => onDecide("reject")}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50"
          title="Reject"
        >
          <X size={15} />
        </button>
        <button
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-205 hover:bg-slate-50 transition"
          title="Edit"
        >
          <Edit2 size={13} className="text-slate-500" />
        </button>
        <button
          type="button"
          onClick={onBlock}
          className="flex h-9 px-3 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition gap-1 text-[11px] font-bold"
          title="Block guest"
        >
          <AlertTriangle size={12} /> Block
        </button>
      </div>
    </li>
  );
}

function DetailOverlay({
  visit,
  busy,
  onClose,
  onDecide,
  onForceExit,
}: {
  visit: any;
  busy: boolean;
  onClose: () => void;
  onDecide: (a: "approve" | "reject") => void;
  onForceExit?: () => void;
}) {
  const details = (visit.details ?? {}) as Record<string, string>;
  const mappedDetails = visit.kind && visit.fields 
    ? visit.fields.reduce((acc: any, f: any) => ({ ...acc, [f.label]: f.value }), {})
    : details;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider">{visit.category || visit.categoryLabel || "Pass"} Details</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
          >
            <X size={15} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {(visit.selfieUrl || visit.photoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visit.selfieUrl || visit.photoUrl}
              alt="Selfie"
              className="mx-auto aspect-square w-32 rounded-xl border border-slate-200 object-cover shadow-sm"
            />
          ) : (
            <div className="mx-auto flex aspect-square w-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[10px] text-slate-400 font-bold">
              No Photo
            </div>
          )}
          {visit.referenceCode && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">
                Reference
              </p>
              <p className="font-mono text-base font-bold text-slate-800 mt-0.5">{visit.referenceCode}</p>
            </div>
          )}
          <dl className="overflow-hidden rounded-xl border border-slate-200 text-xs">
            <div className="flex justify-between gap-4 border-b border-slate-100 p-2.5 bg-white">
              <dt className="text-slate-550 font-medium">Guest Name</dt>
              <dd className="text-right font-bold text-slate-900">{visit.name}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 p-2.5 bg-white">
              <dt className="text-slate-555 font-medium">Phone</dt>
              <dd className="text-right font-bold text-slate-900">{visit.phone}</dd>
            </div>
            {Object.entries(mappedDetails).map(([key, val]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-slate-100 p-2.5 bg-white">
                <dt className="text-slate-500 uppercase text-[10px] font-bold">{key}</dt>
                <dd className="text-right font-bold text-slate-900">{val as string}</dd>
              </div>
            ))}
            {visit.entryGateName && (
              <div className="flex justify-between gap-4 p-2.5 bg-white">
                <dt className="text-slate-500 font-medium">Entry Gate</dt>
                <dd className="text-right font-bold text-slate-900">{visit.entryGateName}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          {visit.status === "PENDING" || visit.status === "ESCALATED" ? (
            <>
              <button
                onClick={() => onDecide("approve")}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white transition active:bg-emerald-700 disabled:opacity-50 uppercase tracking-wider animate-pulse"
              >
                <Check size={14} /> Approve
              </button>
              <button
                onClick={() => onDecide("reject")}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white transition active:bg-rose-700 disabled:opacity-50 uppercase tracking-wider"
              >
                <X size={14} /> Reject
              </button>
            </>
          ) : visit.status === "REJECTED" ? (
            <div className="w-full text-center py-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-300 px-4 py-1.5 text-xs font-bold text-rose-700">
                <X size={14} /> Entry Rejected
              </span>
            </div>
          ) : visit.status === "EXITED" ? (
            <div className="w-full text-center py-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600">
                <LogOut size={14} /> Guest Exited Campus
              </span>
            </div>
          ) : (visit.state === "ACTIVE" || visit.status === "APPROVED" || visit.status === "CHECKED_IN") && onForceExit ? (
            <button
              onClick={() => {
                if (confirm("FORCE EXIT: This will immediately mark the guest as exited and remove them from active tracking. Continue?")) {
                  onForceExit();
                }
              }}
              disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white transition active:bg-amber-700 disabled:opacity-50 uppercase tracking-wider shadow-sm border border-amber-700"
            >
              <LogOut size={14} /> Force Exit
            </button>
          ) : (
            <p className="text-xs font-bold text-slate-400 text-center w-full uppercase tracking-widest">
              Pass State: {visit.status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. DYNAMIC FORM BUILDER PANEL
// ---------------------------------------------------------------------------
function FormBuilderPanel() {
  const queryClient = useQueryClient();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Modal triggers
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddVal, setShowAddVal] = useState<string | null>(null); // maps categoryId
  const [editingField, setEditingField] = useState<FormFieldConfig | null>(null);

  // Dynamic config query
  const formsQuery = useQuery({
    queryKey: ["form-config"],
    queryFn: fetchFormConfig,
  });

  const categories = formsQuery.data?.categories ?? [];
  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  // Mutations
  const addCatMut = useMutation({
    mutationFn: createFormCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-config"] });
      setShowAddCat(false);
    },
  });

  const archiveCatMut = useMutation({
    mutationFn: deleteFormCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-config"] });
      setSelectedCatId(null);
    },
  });

  const addFieldMut = useMutation({
    mutationFn: createFormField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-config"] });
      setShowAddVal(null);
    },
  });

  const editFieldMut = useMutation({
    mutationFn: (a: { id: string; body: any }) => updateFormField(a.id, a.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-config"] });
      setEditingField(null);
    },
  });

  const archiveFieldMut = useMutation({
    mutationFn: deleteFormField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-config"] });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Category selector */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Form Categories
          </h3>
          <button
            onClick={() => setShowAddCat(true)}
            className="text-slate-900 hover:text-slate-700 flex items-center gap-1 text-[11px] font-bold border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition"
          >
            <PlusCircle size={12} /> Add
          </button>
        </div>

        {formsQuery.isLoading ? (
          <Loading />
        ) : categories.length === 0 ? (
          <EmptyRow label="No form categories setup." />
        ) : (
          <div className="space-y-1.5">
            {categories.map((c) => {
              const Icon = getCategoryIcon(c.icon || null);
              const isActiveSelection = c.id === selectedCatId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCatId(c.id ?? null)}
                  className={
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition " +
                    (isActiveSelection
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <div>
                      <p className="text-xs font-bold leading-tight">{c.label}</p>
                      <p className={"text-[10px] mt-0.5 " + (isActiveSelection ? "text-slate-300" : "text-slate-400")}>
                        {c.key} • {c.fields?.length || 0} fields
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={13} className={isActiveSelection ? "text-white" : "text-slate-400"} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fields manager & Form live preview */}
      <div className="lg:col-span-8 space-y-6">
        {selectedCat ? (
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {selectedCat.label} Fields Config
                  </h3>
                  <p className="text-xs text-slate-550 mt-0.5">
                    Managing inputs for machine key <code>{selectedCat.key}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddVal(selectedCat.id ?? null)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition uppercase tracking-wider"
                  >
                    <PlusCircle size={13} /> Add Field
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Archive this category? Historical logs will be preserved but no new registrations can be made.")) {
                        archiveCatMut.mutate(selectedCat.id!);
                      }
                    }}
                    className="border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition uppercase tracking-wider"
                  >
                    <Trash2 size={13} /> Archive
                  </button>
                </div>
              </div>

              {selectedCat.fields?.length === 0 ? (
                <EmptyRow label="This category has no custom fields config. Add one to start!" />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="p-3 font-semibold">Label / Name</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Validation</th>
                        <th className="p-3 font-semibold">Options</th>
                        <th className="p-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedCat.fields?.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3">
                            <span className="font-bold text-slate-900">{f.label}</span>
                            {f.required && (
                              <span className="ml-1 text-rose-600 font-extrabold">*</span>
                            )}
                            <span className="block font-mono text-[9px] text-slate-400 mt-0.5">
                              {f.name} (order: {f.sortOrder ?? 0})
                            </span>
                          </td>
                          <td className="p-3 uppercase font-semibold text-slate-650">{f.type}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-500">
                            {f.pattern ? `Regex: ${f.pattern}` : "None"}
                            {f.requiredWhenField && (
                              <span className="block text-[9px] text-amber-600 font-bold mt-0.5">
                                Conditional: {f.requiredWhenField}={f.requiredWhenValue}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {Array.isArray(f.options) && f.options.length > 0 ? (
                              <span className="bg-slate-100 text-slate-650 px-2 py-0.5 rounded text-[10px] font-bold">
                                {f.options.length} options
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => setEditingField(f)}
                              className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-100 inline-flex items-center justify-center"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Soft delete this field? History remains untouched.")) {
                                  archiveFieldMut.mutate(f.id!);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-650 p-1 rounded hover:bg-rose-50 inline-flex items-center justify-center"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Simulated Live preview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Info size={13} /> Mobile Intake Preview (Interactive)
              </h4>
              <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 max-w-sm mx-auto shadow-inner space-y-4">
                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center">
                    {(() => {
                      const Icon = getCategoryIcon(selectedCat.icon || null);
                      return <Icon size={16} />;
                    })()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedCat.label}</p>
                    <p className="text-[10px] text-slate-500">{selectedCat.description || "Simulated intake form"}</p>
                  </div>
                </div>

                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                  {selectedCat.fields?.map((f) => (
                    <div key={f.name} className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-650">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </label>
                      {f.type === "select" ? (
                        <select className="w-full text-xs rounded border border-slate-200 p-1.5 outline-none bg-slate-50">
                          <option value="">Select...</option>
                          {Array.isArray(f.options) &&
                            f.options.map((opt: any) => {
                              const v = typeof opt === "object" ? opt.value : opt;
                              return <option key={v} value={v}>{v}</option>;
                            })}
                        </select>
                      ) : (
                        <input
                          type={f.type === "tel" ? "tel" : "text"}
                          placeholder={f.placeholder || ""}
                          className="w-full text-xs rounded border border-slate-205 p-1.5 outline-none bg-slate-50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 font-semibold shadow-sm">
            Please choose a Category from the list on the left to edit its custom fields.
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCat && (
        <AddCatModal
          onClose={() => setShowAddCat(false)}
          onSubmit={(d) => addCatMut.mutate(d)}
          loading={addCatMut.isPending}
        />
      )}

      {/* Add Field Modal */}
      {showAddVal && (
        <AddFieldModal
          categoryId={showAddVal}
          onClose={() => setShowAddVal(null)}
          onSubmit={(d) => addFieldMut.mutate(d)}
          loading={addFieldMut.isPending}
        />
      )}

      {/* Edit Field Modal */}
      {editingField && (
        <EditFieldModal
          field={editingField}
          onClose={() => setEditingField(null)}
          onSubmit={(body) => editFieldMut.mutate({ id: editingField.id!, body })}
          loading={editFieldMut.isPending}
        />
      )}
    </div>
  );
}

function AddCatModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Users");
  const [sortOrder, setSortOrder] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      key: key.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
      label,
      description,
      icon,
      sortOrder,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
      >
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Create Form Category
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-650">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">Stable Machine Key (e.g. PARENT)</label>
            <input
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="LETTERS_AND_UNDERSCORE"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-mono text-xs uppercase"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Display Label (e.g. Parent / Guardian)</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Parent / Guardian"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Description Hint</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description details..."
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Lucide Icon String</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Users, Truck, Car, Home"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Display Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />} Create
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 rounded text-slate-650 px-4 h-9 font-bold hover:bg-white text-xs transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function AddFieldModal({
  categoryId,
  onClose,
  onSubmit,
  loading,
}: {
  categoryId: string;
  onClose: () => void;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"text" | "tel" | "select" | "number">("text");
  const [required, setRequired] = useState(true);
  const [placeholder, setPlaceholder] = useState("");
  const [pattern, setPattern] = useState("");
  const [maxLength, setMaxLength] = useState<number | null>(100);
  const [sortOrder, setSortOrder] = useState(0);
  const [requiredWhenField, setRequiredWhenField] = useState("");
  const [requiredWhenValue, setRequiredWhenValue] = useState("");

  const [optionsStr, setOptionsStr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();

    let optionsList = undefined;
    if (type === "select" && optionsStr) {
      optionsList = optionsStr
        .split(",")
        .map((str) => str.trim())
        .filter((str) => str.length > 0)
        .map((str) => ({ value: str, label: str }));
    }

    onSubmit({
      categoryId,
      name,
      label,
      type,
      required,
      placeholder: placeholder || null,
      pattern: pattern || null,
      maxLength: maxLength ? Number(maxLength) : null,
      sortOrder,
      requiredWhenField: requiredWhenField || null,
      requiredWhenValue: requiredWhenValue || null,
      options: optionsList,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Create Custom Field
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-655">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">Machine Key Name (e.g. hostel)</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
              placeholder="e.g. hostPerson"
              className="w-full rounded border border-slate-305 p-2 outline-none focus:border-slate-500 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Input Label (e.g. Room Number)</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Room Number"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Field Type</label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none bg-white"
            >
              <option value="text">Plain Text</option>
              <option value="tel">Phone number (numeric format)</option>
              <option value="number">Quantity / Integer</option>
              <option value="select">Dropdown Choice</option>
            </select>
          </div>

          {type === "select" && (
            <div>
              <label className="block font-bold text-slate-650 mb-1">
                Dropdown options (comma-separated, e.g. Staff, Faculty, Official)
              </label>
              <input
                required
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                placeholder="Option 1, Option 2..."
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="req"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded text-slate-900 outline-none"
            />
            <label htmlFor="req" className="font-bold text-slate-650">Mandatory / Required field</label>
          </div>

          <div>
            <label className="block font-bold text-slate-650 mb-1">Placeholder hint</label>
            <input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Placeholder hint text..."
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Validation Regex pattern (Optional)</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. ^[0-9]{4,10}$"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Max Character Length limit</label>
            <input
              type="number"
              value={maxLength || ""}
              onChange={(e) => setMaxLength(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-655 mb-1">Required When: Parent Field (e.g. purpose)</label>
            <input
              value={requiredWhenField}
              onChange={(e) => setRequiredWhenField(e.target.value)}
              placeholder="Parent Field machine key"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Required When: Equals Value (e.g. Pickup)</label>
            <input
              value={requiredWhenValue}
              onChange={(e) => setRequiredWhenValue(e.target.value)}
              placeholder="Value that triggers required state"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Field Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />} Create
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 rounded text-slate-650 px-4 h-9 font-bold hover:bg-white text-xs transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditFieldModal({
  field,
  onClose,
  onSubmit,
  loading,
}: {
  field: FormFieldConfig;
  onClose: () => void;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<"text" | "tel" | "select" | "number">(field.type);
  const [required, setRequired] = useState(field.required ?? true);
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [pattern, setPattern] = useState(field.pattern ?? "");
  const [maxLength, setMaxLength] = useState<number | null>(field.maxLength ?? null);
  const [sortOrder, setSortOrder] = useState(field.sortOrder ?? 0);
  const [requiredWhenField, setRequiredWhenField] = useState(field.requiredWhenField ?? "");
  const [requiredWhenValue, setRequiredWhenValue] = useState(field.requiredWhenValue ?? "");

  // Options map
  const initialOptionsStr = Array.isArray(field.options)
    ? field.options.map((opt: any) => (typeof opt === "object" ? opt.value : opt)).join(", ")
    : "";
  const [optionsStr, setOptionsStr] = useState(initialOptionsStr);

  function submit(e: React.FormEvent) {
    e.preventDefault();

    let optionsList = undefined;
    if (type === "select" && optionsStr) {
      optionsList = optionsStr
        .split(",")
        .map((str) => str.trim())
        .filter((str) => str.length > 0)
        .map((str) => ({ value: str, label: str }));
    }

    onSubmit({
      label,
      type,
      required,
      placeholder: placeholder || null,
      pattern: pattern || null,
      maxLength: maxLength ? Number(maxLength) : null,
      sortOrder,
      requiredWhenField: requiredWhenField || null,
      requiredWhenValue: requiredWhenValue || null,
      options: optionsList || [],
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Edit Custom Field
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-655">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 text-xs">
          <div>
            <p className="block font-bold text-slate-400 mb-1">Field Machine Key (Read-Only)</p>
            <p className="p-2 bg-slate-100 rounded border border-slate-200 font-mono text-xs text-slate-600">{field.name}</p>
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Input Label (e.g. Room Number)</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Field Type</label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none bg-white font-semibold"
            >
              <option value="text">Plain Text</option>
              <option value="tel">Phone number (numeric format)</option>
              <option value="number">Quantity / Integer</option>
              <option value="select">Dropdown Choice</option>
            </select>
          </div>

          {type === "select" && (
            <div>
              <label className="block font-bold text-slate-655 mb-1">
                Dropdown options (comma-separated, e.g. Staff, Faculty, Official)
              </label>
              <input
                required
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="req-edit"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded text-slate-900 outline-none font-bold"
            />
            <label htmlFor="req-edit" className="font-bold text-slate-650">Mandatory / Required field</label>
          </div>

          <div>
            <label className="block font-bold text-slate-650 mb-1">Placeholder hint</label>
            <input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-655 mb-1">Validation Regex pattern (Optional)</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Max Character Length limit</label>
            <input
              type="number"
              value={maxLength || ""}
              onChange={(e) => setMaxLength(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-655 mb-1">Required When: Parent Field (e.g. purpose)</label>
            <input
              value={requiredWhenField}
              onChange={(e) => setRequiredWhenField(e.target.value)}
              placeholder="Parent Field machine key"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Required When: Equals Value (e.g. Pickup)</label>
            <input
              value={requiredWhenValue}
              onChange={(e) => setRequiredWhenValue(e.target.value)}
              placeholder="Value that triggers required state"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Field Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />} Update
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 rounded text-slate-650 px-4 h-9 font-bold hover:bg-white text-xs transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1b. STAFF ACCOUNTS PANEL — HEAD-exclusive create/deactivate for Staff/Guard.
// ---------------------------------------------------------------------------
function UserManagementPanel() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"STAFF" | "GUARD">("STAFF");
  const [password, setPassword] = useState("");
  const [gateIds, setGateIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  const usersQuery = useQuery({ queryKey: ["staff-users"], queryFn: fetchUsers });
  const gatesQuery = useQuery({ queryKey: ["gates"], queryFn: fetchGates });
  const list = usersQuery.data?.items ?? [];
  const gates = gatesQuery.data?.gates ?? [];

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setEmail("");
      setName("");
      setPassword("");
      setGateIds([]);
      setFormError("");
    },
    onError: (err: any) => setFormError(formatApiError(err, "Could not create account")),
  });

  const updateMut = useMutation({
    mutationFn: (a: { id: string; body: any }) => updateUser(a.id, a.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name) return;
    createMut.mutate({
      email: email.trim(),
      name: name.trim(),
      role,
      password: password.trim() || undefined,
      gateIds: role === "GUARD" && gateIds.length ? gateIds : undefined,
    });
  }

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return list;
    return list.filter(
      (u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
    );
  }, [q, list]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Create account form */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 pb-2 border-b border-slate-100">
          Add Staff / Guard Account
        </h3>
        <form onSubmit={submit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">Full Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prof. Sharma"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@campus.edu"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "STAFF" | "GUARD")}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold bg-white"
            >
              <option value="STAFF">Staff</option>
              <option value="GUARD">Guard</option>
            </select>
          </div>
          {role === "GUARD" && (
            <div>
              <label className="block font-bold text-slate-650 mb-1">Assigned Gate(s)</label>
              <div className="flex flex-wrap gap-1.5">
                {gates.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setGateIds((prev) =>
                        prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                      )
                    }
                    className={`rounded px-2.5 py-1 text-[11px] font-bold border transition ${
                      gateIds.includes(g.id)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Gate {g.code}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-650 mb-1">
              Temporary Password (optional)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to email a set-password link"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
            />
          </div>

          {formError && (
            <p className="rounded bg-rose-50 px-2.5 py-2 text-rose-600 font-semibold whitespace-pre-line">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 size={13} className="animate-spin" />} Create Account
          </button>
        </form>
      </div>

      {/* Account directory */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-850">
              Staff &amp; Guard Directory
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Deactivating revokes sign-in immediately; history is preserved.
            </p>
          </div>
          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {usersQuery.isLoading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyRow label="No staff or guard accounts yet." />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{u.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border bg-slate-100 text-slate-700 border-slate-200">
                      {u.role}
                    </span>
                    <span
                      className={
                        "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border " +
                        (u.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200")
                      }
                    >
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <p className="text-slate-650 font-semibold mt-1">{u.email}</p>
                  {u.gates.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Gates: {u.gates.map((g) => g.code).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 items-center w-full sm:w-auto justify-end">
                  {u.isActive ? (
                    <button
                      onClick={() => {
                        if (confirm(`Deactivate ${u.name}'s account? They will be signed out immediately.`)) {
                          deactivateMut.mutate(u.id);
                        }
                      }}
                      disabled={deactivateMut.isPending}
                      className="border border-rose-200 text-rose-700 hover:bg-rose-50 rounded px-2.5 py-1.5 transition text-[10px] font-bold inline-flex items-center gap-1"
                    >
                      <Power size={11} /> Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => updateMut.mutate({ id: u.id, body: { isActive: true } })}
                      disabled={updateMut.isPending}
                      className="border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded px-2.5 py-1.5 transition text-[10px] font-bold inline-flex items-center gap-1"
                    >
                      <Power size={11} /> Reactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. BLACKLIST MANAGER PANEL
// ---------------------------------------------------------------------------
function BlacklistManagerPanel({
  presetPhone,
  onClosePreset,
}: {
  presetPhone: { phone: string; name?: string } | null;
  onClosePreset: () => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    if (presetPhone) {
      setPhone(presetPhone.phone);
      setName(presetPhone.name || "");
      setReason("Promoted from repeat overstay defaulters");
    }
  }, [presetPhone]);

  // Queries
  const blacklistQuery = useQuery({
    queryKey: ["blacklist"],
    queryFn: fetchBlacklist,
  });

  const defaultersQuery = useQuery({
    queryKey: ["defaulters"],
    queryFn: fetchDefaulters,
  });

  const list = blacklistQuery.data?.items ?? [];
  const defaulters = defaultersQuery.data?.items ?? [];

  // Mutations
  const addMut = useMutation({
    mutationFn: addBlacklist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      queryClient.invalidateQueries({ queryKey: ["defaulters"] });
      setPhone("");
      setName("");
      setReason("");
      setExpiry("");
      onClosePreset();
    },
  });

  const updateMut = useMutation({
    mutationFn: (a: { id: string; body: any }) => updateBlacklist(a.id, a.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteBlacklist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      queryClient.invalidateQueries({ queryKey: ["defaulters"] });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !reason) return;
    addMut.mutate({
      phone: phone.trim(),
      name: name.trim() || undefined,
      reason: reason.trim(),
      expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
    });
  }

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return list;
    return list.filter(
      (b) =>
        b.phone.includes(query) ||
        (b.name && b.name.toLowerCase().includes(query)) ||
        b.reason.toLowerCase().includes(query)
    );
  }, [q, list]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Create Blacklist form + System settings */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 pb-2 border-b border-slate-100">
            Create Blacklist Log
          </h3>
          <form onSubmit={submit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-650 mb-1">Phone Number (10-digits)</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 9876543210"
                maxLength={10}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-650 mb-1">Name (Optional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Visitor name"
                className="w-full rounded border border-slate-305 p-2 outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-655 mb-1">Block / Defaulter Reason</label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe block parameters..."
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-650 mb-1">Auto-Expiry Expiration (Optional)</label>
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={addMut.isPending}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {addMut.isPending && <Loader2 size={13} className="animate-spin" />} Save Rule
              </button>
              {presetPhone && (
                <button
                  type="button"
                  onClick={onClosePreset}
                  className="border border-slate-300 rounded text-slate-650 px-3.5 h-9 font-bold hover:bg-slate-50 text-xs transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <SettingsPanel />
      </div>

      {/* Directory database list */}
      <div className="lg:col-span-8 space-y-4">
        {/* Overstay & Repeat Defaulters Promotion Banner */}
        {defaulters.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-amber-800">
              <Clock size={16} className="animate-pulse" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider">
                Flagged Repeat Defaulters ({defaulters.length})
              </h3>
            </div>
            <p className="text-xs text-amber-750">
              The following visitors have overstayed past settings thresholds multiple times. Review and promote to Blacklist.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {defaulters.map((def) => (
                <div
                  key={def.id}
                  className="bg-white rounded-lg border border-amber-200 p-3 flex justify-between items-center shadow-xs"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{def.name}</p>
                    <p className="text-[10px] text-slate-500">
                      📞 {def.phone} • Overstayed <strong>{def.overstayCount} times</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhone(def.phone);
                      setName(def.name || "");
                      setReason(`Repeat overstay defaulter (${def.overstayCount} overstays)`);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold px-3 py-1.5 rounded uppercase tracking-wider transition"
                  >
                    Block
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-850">
                Active Blacklisted Log Database
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Checked-in registrations with matched phones will alert guards.</p>
            </div>
          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phone, reasons..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {blacklistQuery.isLoading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyRow label="Blacklist database is clear. No active blocks logged." />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{b.phone}</span>
                    {b.name && <span className="text-slate-550 font-bold">({b.name})</span>}
                    <span
                      className={
                        "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border " +
                        (b.active
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-500 border-slate-200")
                      }
                    >
                      {b.active ? "Blocked" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-slate-650 font-semibold mt-1">Reason: {b.reason}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Logged: {new Date(b.createdAt).toLocaleDateString()}
                    {b.expiresAt && ` • Expiry: ${new Date(b.expiresAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-1.5 items-center w-full sm:w-auto justify-end">
                  <button
                    onClick={() => updateMut.mutate({ id: b.id, body: { active: !b.active } })}
                    className="border border-slate-200 rounded px-2.5 py-1.5 hover:bg-white transition text-[10px] font-bold text-slate-700"
                  >
                    Toggle active
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Remove phone from blacklist?")) {
                        deleteMut.mutate(b.id);
                      }
                    }}
                    className="border border-rose-200 text-rose-700 hover:bg-rose-50 rounded px-2.5 py-1.5 transition text-[10px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. SYSTEM SETTINGS PANEL
// ---------------------------------------------------------------------------
function SettingsPanel() {
  const queryClient = useQueryClient();
  const [overstayMinutes, setOverstayMinutes] = useState(120);
  const [defaulterThreshold, setDefaulterThreshold] = useState(3);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});

  // Query
  const settingsQuery = useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setOverstayMinutes(settingsQuery.data.overstayMinutes);
      setDefaulterThreshold(settingsQuery.data.defaulterThreshold);
      setFeatureFlags(settingsQuery.data.featureFlags ?? {});
    }
  }, [settingsQuery.data]);

  // Mutation
  const updateMut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      alert("Settings saved successfully.");
    },
  });

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateMut.mutate({
      overstayMinutes,
      defaulterThreshold,
      featureFlags,
    });
  }

  function toggleFlag(flag: string) {
    setFeatureFlags((prev) => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
          Executive Settings Portal
        </h3>
      </div>
      {settingsQuery.isLoading ? (
        <Loading />
      ) : (
        <form onSubmit={save} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">
              Max Permitted Duration (Minutes)
            </label>
            <input
              type="number"
              required
              min={1}
              value={overstayMinutes}
              onChange={(e) => setOverstayMinutes(Number(e.target.value))}
              className="w-full rounded border border-slate-300 p-2.5 outline-none focus:border-slate-500 font-semibold"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Guards active trackers alert when visitor stays exceed this window.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-650 mb-1">
              Defaulter Promotion Threshold
            </label>
            <input
              type="number"
              required
              min={1}
              value={defaulterThreshold}
              onChange={(e) => setDefaulterThreshold(Number(e.target.value))}
              className="w-full rounded border border-slate-300 p-2.5 outline-none focus:border-slate-500 font-semibold"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Minimum count of overstays before surfacing visitor to promotion feed.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h4 className="font-extrabold uppercase tracking-wide text-slate-400 text-[10px] mb-2">
              Feature Flag Controls
            </h4>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150">
              <div>
                <p className="font-bold text-slate-850">Mandatory Selfie Photos</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Force mobile registers to capture webcam photos.</p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.requireSelfies !== false}
                onChange={() => toggleFlag("requireSelfies")}
                className="rounded text-slate-900 outline-none cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMut.isPending}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-11 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50 mt-4"
          >
            {updateMut.isPending && <Loader2 size={13} className="animate-spin" />} Save Settings
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. OVERRIDE EDIT MODALS
// ---------------------------------------------------------------------------
function EditVisitModal({ visit, onClose }: { visit: VisitDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(visit.name);
  const [phone, setPhone] = useState(visit.phone);
  const [vehicle, setVehicle] = useState(visit.vehicleNumber || "");
  const [status, setStatus] = useState(visit.status);
  const [entryCode, setEntryCode] = useState(visit.entryGateCode || "1");
  const [exitCode, setExitCode] = useState(visit.exitGateCode || "");

  const [details, setDetails] = useState<Record<string, string>>(
    (visit.details || {}) as Record<string, string>
  );

  const editMut = useMutation({
    mutationFn: (body: any) => editVisit(visit.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalated-visits"] });
      queryClient.invalidateQueries({ queryKey: ["active-campus"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onClose();
    },
    onError: (err: any) => {
      alert(formatApiError(err, "Failed to update visit details"));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    editMut.mutate({
      name,
      phone,
      vehicleNumber: vehicle || null,
      status,
      entryGateCode: entryCode,
      exitGateCode: exitCode || null,
      details,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Edit Standard Visit Override
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-655">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">Guest Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Phone Number</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Vehicle Number</label>
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="None"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550 font-mono text-xs uppercase"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Visit Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none bg-white font-semibold"
            >
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED (Inside)</option>
              <option value="REJECTED">REJECTED</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="EXITED">EXITED</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-650 mb-1">Entry Gate Code</label>
              <input
                required
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-650 mb-1">Exit Gate Code</label>
              <input
                value={exitCode}
                onChange={(e) => setExitCode(e.target.value)}
                placeholder="Not exited"
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550 font-mono"
              />
            </div>
          </div>

          {/* Dynamic details editing */}
          {Object.keys(details).length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <h4 className="font-extrabold uppercase tracking-wide text-slate-400 text-[10px]">
                Dynamic Form Fields Details
              </h4>
              {Object.entries(details).map(([k, v]) => (
                <div key={k}>
                  <label className="block font-bold text-slate-500 uppercase text-[9px] mb-0.5">{k}</label>
                  <input
                    value={v}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 p-1.5 outline-none focus:border-slate-550"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="submit"
            disabled={editMut.isPending}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {editMut.isPending && <Loader2 size={13} className="animate-spin" />} Update Record
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 rounded text-slate-655 px-4 h-9 font-bold hover:bg-white text-xs transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditVIPModal({ pass, onClose }: { pass: VIPDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(pass.guestName);
  const [phone, setPhone] = useState(pass.guestPhone);
  const [purpose, setPurpose] = useState(pass.purpose);
  const [vehicle, setVehicle] = useState(pass.vehicleNumber || "");
  const [status, setStatus] = useState(pass.status);
  const [validFrom, setValidFrom] = useState(
    pass.validFrom ? new Date(pass.validFrom).toISOString().slice(0, 16) : ""
  );
  const [validUntil, setValidUntil] = useState(
    pass.validUntil ? new Date(pass.validUntil).toISOString().slice(0, 16) : ""
  );

  const editMut = useMutation({
    mutationFn: (body: any) => editVIP(pass.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-queue"] });
      queryClient.invalidateQueries({ queryKey: ["active-campus"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onClose();
    },
    onError: (err: any) => {
      alert(formatApiError(err, "Failed to update VIP pass"));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    editMut.mutate({
      guestName: name,
      guestPhone: phone,
      purpose,
      vehicleNumber: vehicle || null,
      status,
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            Edit Guest Pass Override
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-655">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-650 mb-1">Guest Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Phone Number</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Purpose of Visit</label>
            <input
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Vehicle Number</label>
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="None"
              className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550 font-mono text-xs uppercase"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-650 mb-1">Pass Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-slate-300 p-2 outline-none bg-white font-semibold"
            >
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CHECKED_IN">CHECKED_IN (Inside)</option>
              <option value="EXITED">EXITED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-650 mb-1">Valid From</label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-655 mb-1">Valid Until</label>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="submit"
            disabled={editMut.isPending}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-9 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {editMut.isPending && <Loader2 size={13} className="animate-spin" />} Update Record
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 rounded text-slate-655 px-4 h-9 font-bold hover:bg-white text-xs transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. PASS CREATION OVERRIDES MODAL (＋ Generate Pass)
// ---------------------------------------------------------------------------
function CreatePassModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"STANDARD" | "VIP">("STANDARD");
  const [createdResult, setCreatedResult] = useState<{ referenceCode: string; token?: string } | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  const gatesQuery = useQuery({ queryKey: ["gates"], queryFn: fetchGates });
  const gates = gatesQuery.data?.gates ?? [];

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [entryGateCode, setEntryGateCode] = useState("1");
  const [category, setCategory] = useState("PARENT");

  // Dynamic fields
  const [fields, setFields] = useState<Record<string, string>>({});

  const formsQuery = useQuery({
    queryKey: ["form-config"],
    queryFn: fetchFormConfig,
    enabled: mode === "STANDARD",
  });
  const categoriesList = formsQuery.data?.categories ?? [];
  const activeCat = categoriesList.find((c) => c.key === category) ?? null;

  // Mutations
  const createStdMut = useMutation({
    mutationFn: adminCreateVisit,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["active-campus"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setCreatedResult({ referenceCode: data.referenceCode });
    },
    onError: (err: any) => {
      alert(formatApiError(err, "Failed to create visit pass"));
    },
  });

  const createVipMut = useMutation({
    mutationFn: adminCreateVIP,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["vip-queue"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setCreatedResult({ referenceCode: data.token, token: data.token });
      const dataUrl = await QRCode.toDataURL(data.token);
      setQrUrl(dataUrl);
    },
    onError: (err: any) => {
      alert(formatApiError(err, "Failed to create VIP pass"));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "STANDARD") {
      const mergedFields = { ...fields, vehicleNumber: vehicle };
      createStdMut.mutate({
        category,
        name: name.trim(),
        phone: phone.trim(),
        entryGateCode,
        fields: mergedFields,
      });
    } else {
      createVipMut.mutate({
        guestName: name.trim(),
        guestPhone: phone.trim(),
        purpose: purpose.trim(),
        vehicleNumber: vehicle ? vehicle.toUpperCase().trim() : undefined,
        validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      });
    }
  }

  function handleFieldChange(fName: string, val: string) {
    setFields((prev) => ({ ...prev, [fName]: val }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-205 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
            {createdResult ? "Generation Successful" : "Generate Authority Pass"}
          </h3>
          {!createdResult && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-655">
              <X size={15} />
            </button>
          )}
        </div>

        {createdResult ? (
          <div className="p-5 text-center space-y-4">
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
            <div>
              <p className="text-xs font-bold text-slate-550 uppercase tracking-wide">
                Pass Reference Code
              </p>
              <p className="text-2xl font-mono font-extrabold text-slate-900 mt-1">
                {createdResult.referenceCode}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Authority approved pass successfully compiled.
              </p>
            </div>

            {qrUrl && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl max-w-[200px] mx-auto shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="VIP Pass QR" className="w-full h-auto" />
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-10 font-bold text-xs uppercase tracking-wider transition shadow-sm"
            >
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3.5 text-xs">
            <div className="flex border border-slate-200 rounded-lg overflow-hidden font-extrabold bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setMode("STANDARD")}
                className={
                  "flex-1 py-1.5 text-[10px] uppercase rounded transition " +
                  (mode === "STANDARD" ? "bg-white text-slate-900 shadow-sm" : "text-slate-450 hover:text-slate-600")
                }
              >
                Standard pass
              </button>
              <button
                type="button"
                onClick={() => setMode("VIP")}
                className={
                  "flex-1 py-1.5 text-[10px] uppercase rounded transition " +
                  (mode === "VIP" ? "bg-white text-slate-900 shadow-sm" : "text-slate-450 hover:text-slate-600")
                }
              >
                Guest Pass QR
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-650 mb-1">Guest Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Guest name"
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-650 mb-1">Guest Phone Number</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit number"
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-500 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-650 mb-1">Vehicle Plate (Optional)</label>
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="🚗 Optional"
                className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550 font-mono text-xs uppercase"
              />
            </div>

            {mode === "STANDARD" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-650 mb-1">Entry Gate</label>
                    <select
                      value={entryGateCode}
                      onChange={(e) => setEntryGateCode(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 outline-none bg-white font-semibold"
                    >
                      {gates.map((g) => (
                        <option key={g.id} value={g.code}>
                          Gate {g.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-650 mb-1">Intake Category</label>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setFields({});
                      }}
                      className="w-full rounded border border-slate-300 p-2 outline-none bg-white font-semibold"
                    >
                      {categoriesList.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeCat && activeCat.fields && activeCat.fields.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <h4 className="font-extrabold uppercase tracking-wide text-slate-400 text-[9px] mb-1">
                      Dynamic Category Information
                    </h4>
                    {activeCat.fields
                      .filter((f) => f.name !== "vehicleNumber" && f.name !== "phone" && f.name !== "name")
                      .map((f) => (
                        <div key={f.name}>
                          <label className="block font-bold text-slate-600 mb-0.5">{f.label}</label>
                          {f.type === "select" ? (
                            <select
                              value={fields[f.name] || ""}
                              onChange={(e) => handleFieldChange(f.name, e.target.value)}
                              className="w-full rounded border border-slate-300 p-1.5 outline-none bg-white"
                            >
                              <option value="">Select...</option>
                              {Array.isArray(f.options) &&
                                f.options.map((opt: any) => {
                                  const v = typeof opt === "object" ? opt.value : opt;
                                  return (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  );
                                })}
                            </select>
                          ) : (
                            <input
                              value={fields[f.name] || ""}
                              placeholder={f.placeholder || ""}
                              onChange={(e) => handleFieldChange(f.name, e.target.value)}
                              className="w-full rounded border border-slate-300 p-1.5 outline-none focus:border-slate-500"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block font-bold text-slate-650 mb-1">Purpose of visit</label>
                  <input
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Describe purpose of visit..."
                    className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-650 mb-1">Valid From</label>
                    <input
                      type="datetime-local"
                      required
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-655 mb-1">Valid Until</label>
                    <input
                      type="datetime-local"
                      required
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 outline-none focus:border-slate-550"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 -mx-5 -mb-5">
              <button
                type="submit"
                disabled={createStdMut.isPending || createVipMut.isPending}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold h-10 flex items-center justify-center gap-1.5 transition text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {(createStdMut.isPending || createVipMut.isPending) && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Generate Pass
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-slate-300 rounded text-slate-650 px-4 h-10 font-bold hover:bg-white text-xs transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. REDESIGNED SYSTEM ANALYTICS PANEL (With Date & Time Filters)
// ---------------------------------------------------------------------------
function AnalyticsPanel() {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [showExportModal, setShowExportModal] = useState(false);

  const q = useQuery({
    queryKey: ["head-analytics", range],
    queryFn: () => fetchHeadAnalytics(range),
    refetchInterval: 15_000,
  });

  const data = q.data;

  return (
    <div className="space-y-6">
      {/* Header with time-range selector & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">System Analytics & Gate Intelligence</h2>
          <p className="text-xs text-slate-500">Live campus traffic flow, processing speeds, and historical distributions</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Report Action */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
          >
            <FileDown size={14} />
            <span>Export Reports</span>
          </button>

          {/* Time-range filter pills */}
          <div className="flex items-center rounded-xl bg-slate-200/70 p-1 text-xs font-bold text-slate-600">
            {(
              [
                { key: "today", label: "Today" },
                { key: "7d", label: "Last 7 Days" },
                { key: "30d", label: "This Month" },
                { key: "all", label: "All Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setRange(t.key)}
                className={
                  "rounded-lg px-3 py-1.5 transition " +
                  (range === t.key
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          Failed to load analytics data. Please check network connectivity.
        </div>
      ) : (
        <>
          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {range === "today" ? "Today's Entries" : `Entries (${range.toUpperCase()})`}
                </span>
                <Users size={18} className="text-brand-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">{data?.totalEntriesInRange ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Total recorded check-ins</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Active On Campus
                </span>
                <DoorOpen size={18} className="text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-700">{data?.totalActiveOnCampus ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Standard + Guest passes inside</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Check-In Speed
                </span>
                <Clock size={18} className="text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {data?.avgCampusWaitSeconds ?? 0}s
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                {data?.avgCampusWaitSeconds <= 30 ? "🟢 Optimal Speed" : "🟡 Normal Speed"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Active Guard Stations
                </span>
                <ShieldCheck size={18} className="text-purple-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {data?.activeGuardCount ?? 0} <span className="text-sm font-semibold text-slate-400">/ {data?.activeGateCount ?? 0} gates</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Guards currently online</p>
            </div>
          </div>

          {/* Gate Occupancy & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Gate Occupancy */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-800">
                    Live Gate Traffic Channels
                  </h3>
                  <p className="text-[11px] text-slate-400">Currently active visitors by entry checkpoint</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {data?.gateOccupancy?.map((g: any) => {
                  const maxTraffic = Math.max(1, ...(data.gateOccupancy.map((x: any) => x.totalInside) || [1]));
                  const pct = Math.round((g.totalInside / maxTraffic) * 100);
                  return (
                    <div key={g.gateId} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">
                            {g.gateCode}
                          </span>
                          <span className="font-bold text-sm text-slate-900">{g.gateName}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          {g.totalInside} Inside
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>Standard: {g.standardInside}</span>
                        <span>Official Guests: {g.guestsInside}</span>
                      </div>
                    </div>
                  );
                })}

                {(!data?.gateOccupancy || data.gateOccupancy.length === 0) && (
                  <p className="text-xs text-slate-400 py-4 text-center">No active gates configured.</p>
                )}
              </div>
            </div>

            {/* Entries by Category */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-800">
                    Visitor Category Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400">Distribution of visits in selected time window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {range.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                {data?.categoryStats?.map((c: any) => (
                  <div key={c.categoryLabel} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-800">{c.categoryLabel}</span>
                      <span className="text-slate-500 font-mono">
                        {c.count} ({c.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}

                {(!data?.categoryStats || data.categoryStats.length === 0) && (
                  <p className="text-xs text-slate-400 py-6 text-center">No visit records in this time range.</p>
                )}
              </div>
            </div>
          </div>

          {/* Guard Processing Latency Benchmarks & Active Sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Guard Processing Latency */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 pb-2 border-b border-slate-100">
                Gate Processing Latency Benchmarks
              </h3>
              <div className="divide-y divide-slate-100">
                {data?.gatePerformance?.map((p: any) => (
                  <div key={p.gateCode} className="flex justify-between items-center py-2.5">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{p.gateName}</p>
                      <p className="text-[10px] text-slate-400">{p.count} visitors processed</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-black text-slate-800">{p.avgSeconds}s avg</p>
                      <span
                        className={
                          "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold " +
                          (p.avgSeconds <= 30
                            ? "bg-emerald-50 text-emerald-700"
                            : p.avgSeconds <= 60
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700")
                        }
                      >
                        {p.speedRating}
                      </span>
                    </div>
                  </div>
                ))}
                {(!data?.gatePerformance || data.gatePerformance.length === 0) && (
                  <p className="text-xs text-slate-400 py-4 text-center">No processing logs recorded yet.</p>
                )}
              </div>
            </div>

            {/* Active Guard Sessions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 pb-2 border-b border-slate-100">
                Active Guard Duty Sessions
              </h3>
              <div className="divide-y divide-slate-100">
                {data?.guardSessions?.map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center py-2.5">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{s.guardName}</p>
                      <p className="text-[10px] text-slate-400">Assigned: {s.gateName}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-emerald-600">Online</span>
                    </div>
                  </div>
                ))}
                {(!data?.guardSessions || data.guardSessions.length === 0) && (
                  <p className="text-xs text-slate-400 py-4 text-center">No active guard sessions in last 5 mins.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Report Modal */}
      {showExportModal && (
        <ExportReportModal
          initialRange={range}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXPORT REPORT MODAL (CSV & Printable PDF Generator)
// ---------------------------------------------------------------------------
function ExportReportModal({
  onClose,
  initialRange = "today",
}: {
  onClose: () => void;
  initialRange?: string;
}) {
  const [reportType, setReportType] = useState<"visits" | "house_helps" | "incidents">("visits");
  const [range, setRange] = useState(initialRange);
  const [isExporting, setIsExporting] = useState(false);

  function handleDownloadCSV() {
    window.location.href = `/api/analytics/export?type=${reportType}&range=${range}`;
  }

  function handlePrintPDF() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to open the printable PDF report.");
      return;
    }

    setIsExporting(true);
    fetch(`/api/analytics/export?type=${reportType}&range=${range}`)
      .then((res) => res.text())
      .then((csvText) => {
        setIsExporting(false);
        printCsvReport(reportType, range, csvText, printWindow);
      })
      .catch((err) => {
        setIsExporting(false);
        alert("Failed to generate report: " + err.message);
      });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Export Security Reports</h3>
            <p className="text-xs text-slate-500">1-Click CSV data download and printable PDF</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-bold text-slate-700">Select Report Category</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
            >
              <option value="visits">🚗 Gate Traffic & Passes Log</option>
              <option value="house_helps">🧹 Domestic Staff & House Helps Directory</option>
              <option value="incidents">🚨 Residence Security Incidents & Notices</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold text-slate-700">Time Range Scope</label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1 font-bold text-[11px] text-slate-600">
              {(
                [
                  { key: "today", label: "Today" },
                  { key: "7d", label: "7 Days" },
                  { key: "30d", label: "Month" },
                  { key: "all", label: "All Time" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setRange(t.key)}
                  className={
                    "rounded-lg py-1.5 transition " +
                    (range === t.key ? "bg-white text-slate-900 shadow-sm font-black" : "hover:text-slate-900")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
            <p className="text-[11px] font-bold text-slate-700">Export Information:</p>
            <p className="text-[10px] text-slate-500">
              CSV downloads are compatible with Excel and Sheets. Printable PDF reports format neatly on landscape letterhead.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white py-3 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
            >
              <FileDown size={15} /> Download CSV
            </button>
            <button
              type="button"
              onClick={handlePrintPDF}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. HOUSE HELPS & DOMESTIC STAFF ADMIN PANEL (Clearance & Registry)
// ---------------------------------------------------------------------------
function HouseHelpsAdminPanel() {
  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");
  const [search, setSearch] = useState("");
  const [inspectingHelp, setInspectingHelp] = useState<HouseHelpDTO | null>(null);

  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-house-helps"],
    queryFn: () => fetchAdminHouseHelps("ALL"),
    refetchInterval: 10_000,
  });

  const decideMut = useMutation({
    mutationFn: (a: { id: string; action: "approve" | "reject" | "suspend" }) =>
      decideHouseHelp(a.id, a.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-house-helps"] });
      setInspectingHelp(null);
    },
    onError: (err) => {
      alert(formatApiError(err, "Failed to update house help status"));
    },
  });

  const items = q.data?.items || [];
  const pendingCount = items.filter((h) => h.status === "PENDING_APPROVAL").length;

  const filtered = items.filter((h) => {
    if (tab === "pending" && h.status !== "PENDING_APPROVAL") return false;
    if (tab === "approved" && h.status !== "APPROVED") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(s) ||
      h.phone.includes(s) ||
      h.serviceType.toLowerCase().includes(s) ||
      h.employers?.some((e) => e.staffName.toLowerCase().includes(s) || e.quarterNumber.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Domestic Staff & House Helps Overwatch</h2>
          <p className="text-xs text-slate-500">
            One-time campus helper clearance, Aadhaar document verification, and multi-employer quarter roster
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search helper, phone, quarter..."
              className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab("pending")}
          className={
            "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition " +
            (tab === "pending"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")
          }
        >
          <span>Pending Clearances</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("approved")}
          className={
            "rounded-xl px-3 py-1.5 text-xs font-bold transition " +
            (tab === "approved"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")
          }
        >
          Active Domestic Helpers ({items.filter((h) => h.status === "APPROVED").length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={
            "rounded-xl px-3 py-1.5 text-xs font-bold transition " +
            (tab === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200")
          }
        >
          All Registered ({items.length})
        </button>
      </div>

      {/* Helper Cards Grid */}
      {q.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          <UserCheck size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs font-bold">No house help records found in this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((h) => (
            <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {h.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={h.photoUrl}
                        alt={h.name}
                        className="h-12 w-12 rounded-xl object-cover border border-slate-300"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 font-black text-sm">
                        {h.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{h.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">📞 {h.phone}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                          {h.serviceType}
                        </span>
                        {h.idProofDocUrl ? (
                          <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                            📄 ID Attached
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                            No ID Doc
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-black uppercase " +
                      (h.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-700"
                        : h.status === "PENDING_APPROVAL"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700")
                    }
                  >
                    {h.status === "PENDING_APPROVAL" ? "Awaiting Head" : h.status}
                  </span>
                </div>

                {/* Multi-Employer & Quarter details */}
                <div className="rounded-xl bg-slate-50 p-2.5 text-xs space-y-1.5 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Works For ({h.employers?.length || 0} Staff Residences)
                  </p>
                  {h.employers && h.employers.length > 0 ? (
                    <div className="space-y-1">
                      {h.employers.map((emp, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100 last:border-0">
                          <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                            👤 {emp.staffName} <span className="font-normal text-slate-500">• 🏠 {emp.quarterNumber}</span>
                          </span>
                          <span
                            className={
                              "text-[10px] font-bold px-1.5 py-0.2 rounded " +
                              (emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")
                            }
                          >
                            {emp.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">Registered by: {h.registeredByName || "Staff"}</p>
                  )}
                </div>
              </div>

              {/* Action buttons & Document Inspector */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  onClick={() => setInspectingHelp(h)}
                  className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition"
                >
                  <FileText size={13} /> Inspect ID
                </button>

                {h.status === "PENDING_APPROVAL" ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => decideMut.mutate({ id: h.id, action: "approve" })}
                      disabled={decideMut.isPending}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decideMut.mutate({ id: h.id, action: "reject" })}
                      disabled={decideMut.isPending}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : h.status === "APPROVED" ? (
                  <button
                    onClick={() => decideMut.mutate({ id: h.id, action: "suspend" })}
                    disabled={decideMut.isPending}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >
                    Suspend Pass
                  </button>
                ) : (
                  <button
                    onClick={() => decideMut.mutate({ id: h.id, action: "approve" })}
                    disabled={decideMut.isPending}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Re-Activate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect ID Documents & Employer Details Modal */}
      {inspectingHelp && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setInspectingHelp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700 uppercase">
                  Identity Clearance Review
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{inspectingHelp.name}</h3>
                <p className="text-xs text-slate-500">Service: {inspectingHelp.serviceType} • Token: {inspectingHelp.token}</p>
              </div>
              <button
                onClick={() => setInspectingHelp(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Document and Face Photo Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Aadhaar / ID Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">📄 {inspectingHelp.idProofType || "AADHAAR"} Document</span>
                  {inspectingHelp.idProofNumber && (
                    <span className="font-mono font-bold text-slate-600">{inspectingHelp.idProofNumber}</span>
                  )}
                </div>
                {inspectingHelp.idProofDocUrl ? (
                  <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[160px] max-h-[220px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={inspectingHelp.idProofDocUrl}
                      alt="Uploaded ID Document"
                      className="max-h-[220px] max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-400">
                    No Document Scan Uploaded
                  </div>
                )}
              </div>

              {/* Face Photo */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-xs font-bold text-slate-800">📸 Registered Face Photo</div>
                {inspectingHelp.photoUrl ? (
                  <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[160px] max-h-[220px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={inspectingHelp.photoUrl}
                      alt="Helper Photo"
                      className="max-h-[220px] max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-400">
                    No Photo Uploaded
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Employer Quarter Roster */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900">Associated Faculty & Quarter Residences</h4>
              {inspectingHelp.employers && inspectingHelp.employers.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-400 font-bold uppercase">
                      <th className="pb-1.5">Staff Employer</th>
                      <th className="pb-1.5">Quarter / House</th>
                      <th className="pb-1.5">Validity Date</th>
                      <th className="pb-1.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectingHelp.employers.map((emp, i) => (
                      <tr key={i} className="py-2">
                        <td className="py-2 font-semibold text-slate-800">{emp.staffName}</td>
                        <td className="py-2 text-slate-600">{emp.quarterNumber}</td>
                        <td className="py-2 text-slate-600">{new Date(emp.validUntil).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                              (emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")
                            }
                          >
                            {emp.isActive ? "Active" : "Paused"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-400">No linked employers yet.</p>
              )}
            </div>

            {/* Admin Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setInspectingHelp(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
              {inspectingHelp.status === "PENDING_APPROVAL" && (
                <>
                  <button
                    onClick={() => decideMut.mutate({ id: inspectingHelp.id, action: "reject" })}
                    disabled={decideMut.isPending}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject Registration
                  </button>
                  <button
                    onClick={() => decideMut.mutate({ id: inspectingHelp.id, action: "approve" })}
                    disabled={decideMut.isPending}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                  >
                    ✓ Verify & Approve Clearance
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. RESIDENCE & STAFF MISCONDUCT / INCIDENT AUDIT (Admin & Staff Exclusive)
// ---------------------------------------------------------------------------
function IncidentsAdminPanel() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [quarterNumber, setQuarterNumber] = useState("");
  const [staffId, setStaffId] = useState("");

  const queryClient = useQueryClient();
  const staffQuery = useQuery({ queryKey: ["admin-users-list"], queryFn: fetchUsers });
  const q = useQuery({ queryKey: ["admin-incidents"], queryFn: () => fetchIncidents(false), refetchInterval: 10_000 });

  const createMut = useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setQuarterNumber("");
      setStaffId("");
    },
    onError: (err) => alert(formatApiError(err, "Failed to log incident")),
  });

  const resolveMut = useMutation({
    mutationFn: (a: { id: string; status: "RESOLVED" | "DISMISSED"; resolution: string }) =>
      resolveIncident(a.id, { status: a.status, resolution: a.resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
    },
  });

  const items = q.data?.items || [];
  const staffList = staffQuery.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Residence & Staff Misconduct Incident Audit</h2>
          <p className="text-xs text-slate-500">
            Record, track, and notify staff of guest nuisances, unauthorized visitors, or residence security flags
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition flex items-center gap-1.5"
        >
          <PlusCircle size={15} /> Log Residence Incident
        </button>
      </div>

      {q.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-80" />
          <p className="text-xs font-bold">No active incident reports on record. Campus is clear.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((inc) => (
            <div key={inc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase " +
                        (inc.severity === "CRITICAL"
                          ? "bg-rose-100 text-rose-700"
                          : inc.severity === "HIGH"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700")
                      }
                    >
                      {inc.severity} Severity
                    </span>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase " +
                        (inc.status === "FLAGGED" ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-700")
                      }
                    >
                      {inc.status}
                    </span>
                  </div>
                  <h4 className="mt-1 font-black text-sm text-slate-900">{inc.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{inc.description}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p className="font-bold text-slate-700">Quarter: {inc.quarterNumber || "Campus General"}</p>
                  {inc.staffName && <p>Host Staff: {inc.staffName}</p>}
                  <p className="mt-1">{new Date(inc.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>

              {inc.resolution && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
                  <span className="font-bold text-slate-900">Resolution Note: </span>
                  {inc.resolution}
                </div>
              )}

              {inc.status === "FLAGGED" && (
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => {
                      const res = prompt("Enter resolution remarks (e.g. Warning issued / Resolved with resident):");
                      if (res) resolveMut.mutate({ id: inc.id, status: "RESOLVED", resolution: res });
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Dismiss this incident?")) {
                        resolveMut.mutate({ id: inc.id, status: "DISMISSED", resolution: "Dismissed by Head" });
                      }
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Log Staff / Residence Incident</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate({
                  title,
                  description,
                  severity,
                  quarterNumber: quarterNumber || undefined,
                  staffId: staffId || undefined,
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Incident Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Unauthorized guest group / Disturbance at Hostel 4"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description & Evidence *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of the event (e.g. Children of staff invited external friends who caused disturbance...)"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Residence Quarter</label>
                  <input
                    value={quarterNumber}
                    onChange={(e) => setQuarterNumber(e.target.value)}
                    placeholder="e.g. Quarter 14B"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-slate-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Staff Member</label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-slate-500"
                >
                  <option value="">-- Optional / General Staff --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {createMut.isPending ? "Logging..." : "Log Incident"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditPanel() {
  const q = useQuery({
    queryKey: ["head-audit"],
    queryFn: () => fetchAuditLogs(100),
  });

  if (q.isLoading) return <Loading />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
          System Audit Trail
        </h3>
        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(q.data?.items, null, 2));
            const downloadAnchorNode = document.createElement("a");
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "audit_export.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
          }}
          className="bg-slate-900 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold shadow flex items-center gap-1 hover:bg-slate-800 transition"
        >
          <Download size={12} /> Export JSON
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
              <th className="p-3">Time</th>
              <th className="p-3">Action</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {q.data?.items?.map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50/50">
                <td className="p-3 text-slate-500 font-mono text-[10px]">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="p-3 font-bold text-slate-800">{log.action}</td>
                <td className="p-3">
                  {log.actor?.name || log.actorId}
                </td>
                <td className="p-3">
                  {log.entityType} ({log.entityId.slice(0, 8)}...)
                </td>
                <td className="p-3 text-slate-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                  {JSON.stringify(log.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuestPassesOverwatchPanel({ onEditPass }: { onEditPass: (pass: VIPDTO) => void }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [qrModalPass, setQrModalPass] = useState<VIPDTO | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const passesQuery = useQuery({
    queryKey: ["admin-guest-overwatch", statusFilter],
    queryFn: () => fetchAllVIPPasses(statusFilter),
    refetchInterval: 10_000,
  });

  const passes = passesQuery.data?.items ?? [];

  const filteredPasses = useMemo(() => {
    if (!search.trim()) return passes;
    const q = search.toLowerCase().trim();
    return passes.filter(
      (p) =>
        p.guestName.toLowerCase().includes(q) ||
        p.guestPhone.includes(q) ||
        p.hostStaffName.toLowerCase().includes(q) ||
        p.token.toLowerCase().includes(q) ||
        (p.vehicleNumber && p.vehicleNumber.toLowerCase().includes(q)) ||
        p.purpose.toLowerCase().includes(q)
    );
  }, [passes, search]);

  async function showQR(pass: VIPDTO) {
    setQrModalPass(pass);
    try {
      const url = await QRCode.toDataURL(pass.token, {
        width: 300,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    }
  }

  const statusBadge = (st: string) => {
    switch (st) {
      case "APPROVED":
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">APPROVED / EXPECTED</span>;
      case "CHECKED_IN":
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">ON CAMPUS</span>;
      case "EXITED":
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">EXITED</span>;
      case "EXPIRED":
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">EXPIRED</span>;
      case "REJECTED":
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">REJECTED</span>;
      case "PENDING":
        return <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">PENDING</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{st}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="text-brand-600" size={22} /> Official Guest Passes Overwatch
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time live monitoring of all guest & staff-invited visitors across all campus gates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest, host, vehicle, token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 w-64"
            />
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-guest-overwatch"] })}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <LucideIcons.RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "All Passes" },
          { key: "APPROVED", label: "Approved / Expected" },
          { key: "CHECKED_IN", label: "On Campus (Active)" },
          { key: "EXITED", label: "Exited" },
          { key: "EXPIRED", label: "Expired" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === tab.key
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Passes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {passesQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={28} />
          </div>
        ) : filteredPasses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Ticket className="mx-auto text-slate-300 mb-2" size={36} />
            <p className="text-sm font-semibold">No guest passes found.</p>
            <p className="text-xs text-slate-400 mt-0.5">Guest passes issued by staff will appear here in real time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <th className="p-3.5">Guest Details</th>
                  <th className="p-3.5">Host Staff</th>
                  <th className="p-3.5">Type & Purpose</th>
                  <th className="p-3.5">Vehicle</th>
                  <th className="p-3.5">Validity Window</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 text-sm">{pass.guestName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {pass.guestPhone || "No phone"} • <span className="font-mono text-slate-400">{pass.token}</span>
                      </p>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {pass.hostStaffName}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <p className="font-medium text-slate-700">{pass.purpose}</p>
                    </td>
                    <td className="p-3.5">
                      {pass.vehicleNumber ? (
                        <span className="font-mono font-bold text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          {pass.vehicleNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {pass.validFrom || pass.validUntil ? (
                        <span>
                          {pass.validFrom ? new Date(pass.validFrom).toLocaleDateString() : "Anytime"} →{" "}
                          {pass.validUntil ? new Date(pass.validUntil).toLocaleDateString() : "Open"}
                        </span>
                      ) : (
                        <span>Issued {new Date(pass.createdAt).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {statusBadge(pass.status)}
                      {pass.enteredAt && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Entered: {new Date(pass.enteredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          {pass.entryGateCode ? ` (Gate ${pass.entryGateCode})` : ""}
                        </p>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => showQR(pass)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          <QrCode size={12} /> QR
                        </button>
                        <button
                          onClick={() => onEditPass(pass)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Edit Pass"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrModalPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Official Guest Pass QR</h3>
              <button
                onClick={() => { setQrModalPass(null); setQrDataUrl(null); }}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {qrDataUrl ? (
              <div className="mx-auto w-56 h-56 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-center mb-4">
                <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            )}

            <div className="bg-slate-900 text-white rounded-2xl p-4 text-center mb-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Pass Reference</p>
              <p className="text-lg font-bold font-mono tracking-wider mt-0.5">{qrModalPass.token}</p>
            </div>

            <p className="text-xs font-semibold text-slate-800">{qrModalPass.guestName}</p>
            <p className="text-[11px] text-slate-500">Host: {qrModalPass.hostStaffName} • {qrModalPass.purpose}</p>
          </div>
        </div>
      )}
    </div>
  );
}

