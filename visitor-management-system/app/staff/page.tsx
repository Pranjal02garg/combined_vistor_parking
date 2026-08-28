"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import Link from "next/link";
import {
  Car,
  QrCode,
  UserCheck,
  AlertOctagon,
  LogOut,
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Phone,
  Trash2,
  Loader2,
  ShieldCheck,
  FileText,
  Clock,
  Home,
  User,
  Download,
  Calendar,
  X,
  Upload,
  ExternalLink,
  MessageSquare,
  Search,
  CheckCircle2,
  Building,
  AlertCircle,
  Briefcase,
  Share2,
} from "lucide-react";
import StaffParkingSection from "@/components/StaffParkingSection";
import {
  fetchMyVIPPasses,
  createVIPPass,
  fetchStaffHouseHelps,
  createStaffHouseHelp,
  updateStaffHouseHelp,
  deleteStaffHouseHelp,
  fetchIncidents,
  fetchFacultyDashboard,
  VIPDTO,
  HouseHelpDTO,
  IncidentDTO,
} from "@/lib/api";

type StaffTab = "parking" | "guests" | "house_helps" | "notices";

const SERVICE_CATEGORIES = [
  { id: "MAID", label: "Maid / Domestic Help" },
  { id: "COOK", label: "Cook / Chef" },
  { id: "DRIVER", label: "Driver" },
  { id: "CLEANER", label: "Cleaner" },
  { id: "GARDENER", label: "Gardener" },
  { id: "OTHER", label: "Other Domestic Staff" },
];

const ID_PROOF_TYPES = [
  { id: "AADHAAR", label: "Aadhaar Card" },
  { id: "VOTER_ID", label: "Voter ID Card" },
  { id: "DRIVING_LICENSE", label: "Driving License" },
  { id: "PASSPORT", label: "Passport" },
  { id: "OTHER", label: "Govt Photo ID" },
];

export default function StaffPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Authenticating Faculty &amp; Resident Console...
        </p>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return <StaffLoginPage />;
  }

  return <StaffConsole userName={session.user.name || "Faculty Member"} />;
}

function StaffConsole({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StaffTab>("parking");

  // Modals state
  const [showCreatePassModal, setShowCreatePassModal] = useState(false);
  const [showAddHelpModal, setShowAddHelpModal] = useState(false);
  const [selectedPassForQR, setSelectedPassForQR] = useState<VIPDTO | null>(null);
  const [selectedHelpForQR, setSelectedHelpForQR] = useState<HouseHelpDTO | null>(null);

  // Search queries
  const [guestSearch, setGuestSearch] = useState("");
  const [guestStatusFilter, setGuestStatusFilter] = useState("ALL");
  const [helpSearch, setHelpSearch] = useState("");

  // Queries (10s auto-refresh)
  const parkingQuery = useQuery({
    queryKey: ["faculty-dashboard"],
    queryFn: fetchFacultyDashboard,
    refetchInterval: 10_000,
  });
  const carsCount = parkingQuery.data?.cars?.length ?? 0;

  const passesQuery = useQuery({
    queryKey: ["my-vip-passes"],
    queryFn: fetchMyVIPPasses,
    refetchInterval: 10_000,
  });
  const passes = passesQuery.data?.items ?? [];

  const helpsQuery = useQuery({
    queryKey: ["my-house-helps"],
    queryFn: fetchStaffHouseHelps,
    refetchInterval: 10_000,
  });
  const helps = helpsQuery.data?.helps ?? [];

  const noticesQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: fetchIncidents,
    refetchInterval: 30_000,
  });
  const notices = noticesQuery.data?.incidents ?? [];

  // Filtered passes
  const filteredPasses = passes.filter((p) => {
    const matchesQuery =
      p.guestName.toLowerCase().includes(guestSearch.toLowerCase()) ||
      p.token.toLowerCase().includes(guestSearch.toLowerCase()) ||
      (p.vehicleNumber && p.vehicleNumber.toLowerCase().includes(guestSearch.toLowerCase()));
    if (!matchesQuery) return false;
    if (guestStatusFilter === "ALL") return true;
    if (guestStatusFilter === "CHECKED_IN") return p.status === "CHECKED_IN";
    if (guestStatusFilter === "APPROVED") return p.status === "APPROVED" || p.status === "VALID";
    if (guestStatusFilter === "EXPIRED") return p.status === "EXPIRED" || p.status === "EXITED";
    return true;
  });

  // Filtered helpers
  const filteredHelps = helps.filter(
    (h) =>
      h.helper.name.toLowerCase().includes(helpSearch.toLowerCase()) ||
      h.helper.phone.includes(helpSearch) ||
      h.helper.serviceType.toLowerCase().includes(helpSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Top Professional Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                title="Back to Campus Portal"
              >
                <ArrowLeft size={16} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">Thapar Staff Hub</h1>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700 font-mono">
                    Faculty Console
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Campus Parking, Visitor Passes &amp; Domestic Staff Clearance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                <User size={13} className="text-slate-500" />
                <span className="font-semibold text-white">{userName}</span>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/staff" })}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4-Tab Navigation Ribbon */}
        <div className="border-t border-slate-800/80 bg-slate-950/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-2 overflow-x-auto py-2 no-scrollbar">
              {[
                { id: "parking", label: "Parking & Access", icon: Car, count: carsCount },
                { id: "guests", label: "Visitor Passes", icon: QrCode, count: passes.length },
                { id: "house_helps", label: "Domestic Staff & Maids", icon: UserCheck, count: helps.length },
                { id: "notices", label: "Security Notices", icon: AlertOctagon, count: notices.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as StaffTab)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={14} className={active ? "text-blue-400" : "text-slate-500"} />
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono ${
                          active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* TAB 1: PARKING & ACCESS */}
        {activeTab === "parking" && <StaffParkingSection userName={userName} />}

        {/* TAB 2: VISITOR & GUEST PASSES */}
        {activeTab === "guests" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Visitor &amp; Guest Passes</h2>
                <p className="text-xs text-slate-400">
                  Pre-cleared digital gate passes for seamless 1-scan QR entry at Gates 1–4
                </p>
              </div>

              <button
                onClick={() => setShowCreatePassModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <Plus size={14} />
                <span>Issue Guest Pass</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search guest name, phone, or token code..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Passes" },
                  { id: "CHECKED_IN", label: "On Campus" },
                  { id: "APPROVED", label: "Authorized" },
                  { id: "EXPIRED", label: "Expired" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setGuestStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      guestStatusFilter === f.id
                        ? "bg-slate-800 text-white border border-slate-700"
                        : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Passes Matrix */}
            {filteredPasses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
                <QrCode className="mx-auto h-8 w-8 text-slate-600" />
                <h3 className="mt-2 text-sm font-bold text-white">No Guest Passes Found</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Create pre-authorized digital passes for family, academic visitors, or vendors.
                </p>
                <button
                  onClick={() => setShowCreatePassModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 text-xs font-bold transition shadow-sm"
                >
                  <Plus size={14} /> Issue First Pass
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPasses.map((p) => {
                  const isCheckedIn = p.status === "CHECKED_IN";
                  const isApproved = p.status === "APPROVED" || p.status === "VALID";

                  return (
                    <div
                      key={p.id || p.token}
                      className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-sm transition hover:border-slate-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 uppercase">
                            {p.purpose || "Official Guest"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase font-mono border ${
                              isCheckedIn
                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                                : isApproved
                                ? "bg-blue-950/60 text-blue-400 border-blue-800/60"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {isCheckedIn ? "● On Campus" : p.status}
                          </span>
                        </div>

                        <h4 className="mt-2.5 text-base font-bold text-white tracking-tight">{p.guestName}</h4>

                        {p.guestPhone && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <Phone size={12} className="text-slate-500" />
                            <span>+91 {p.guestPhone}</span>
                          </div>
                        )}

                        {p.vehicleNumber && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-mono font-bold text-slate-300 border border-slate-800">
                            <Car size={13} className="text-slate-400" />
                            <span>{p.vehicleNumber}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-slate-500 font-semibold">{p.token}</span>

                        <button
                          onClick={() => setSelectedPassForQR(p)}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-700 transition"
                        >
                          <QrCode size={13} className="text-slate-400" />
                          <span>View QR Pass</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOMESTIC STAFF & MAIDS */}
        {activeTab === "house_helps" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Domestic Staff &amp; Maids</h2>
                <p className="text-xs text-slate-400">
                  Permanent QR gate passes for maids, cooks, drivers, cleaners, and caregivers
                </p>
              </div>

              <button
                onClick={() => setShowAddHelpModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <Plus size={14} />
                <span>Register Helper</span>
              </button>
            </div>

            {/* 10-Digit Mobile Auto-Linking Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 flex items-start gap-3">
              <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">10-Digit Mobile Auto-Linking: </span>
                If your helper already works for another faculty residence, entering their 10-digit mobile number instantly links their existing verified campus clearance without redundant background re-verification.
              </div>
            </div>

            {/* Helpers List */}
            {filteredHelps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
                <UserCheck className="mx-auto h-8 w-8 text-slate-600" />
                <h3 className="mt-2 text-sm font-bold text-white">No Domestic Staff Registered</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Add domestic staff to grant them permanent QR gate barrier entry into your faculty quarter.
                </p>
                <button
                  onClick={() => setShowAddHelpModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 text-xs font-bold transition shadow-sm"
                >
                  <Plus size={14} /> Register Helper
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredHelps.map((h) => {
                  const isActive = h.isActive !== false;

                  return (
                    <div
                      key={h.linkId}
                      className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-sm transition hover:border-slate-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 uppercase">
                            {h.helper.serviceType}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase font-mono border ${
                              isActive
                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                                : "bg-rose-950/60 text-rose-400 border-rose-800/60"
                            }`}
                          >
                            {isActive ? "Active" : "Paused"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          {h.helper.photoUrl ? (
                            <img
                              src={h.helper.photoUrl}
                              alt={h.helper.name}
                              className="h-11 w-11 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">
                              {h.helper.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <h4 className="text-base font-bold text-white tracking-tight">{h.helper.name}</h4>
                            <div className="text-xs text-slate-400 font-mono">+91 {h.helper.phone}</div>
                          </div>
                        </div>

                        <div className="mt-3.5 space-y-1 rounded-xl bg-slate-950 p-2.5 text-xs text-slate-400 border border-slate-800/80">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Quarter:</span>
                            <span className="font-semibold text-slate-200">{h.quarterNumber}</span>
                          </div>
                          {h.workShift && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Shift:</span>
                              <span className="text-slate-300">{h.workShift}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedHelpForQR(h)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-700 transition"
                        >
                          <QrCode size={13} className="text-slate-400" />
                          <span>Master Pass</span>
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              await updateStaffHouseHelp(h.linkId, { isActive: !isActive });
                              queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            isActive
                              ? "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                              : "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                          }`}
                        >
                          {isActive ? "Pause" : "Activate"}
                        </button>

                        <button
                          onClick={async () => {
                            if (confirm(`Unlink helper ${h.helper.name} from your quarter?`)) {
                              await deleteStaffHouseHelp(h.linkId);
                              queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 border border-slate-800 transition"
                          title="Unlink Staff"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SECURITY NOTICES */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Campus Security Notices</h2>
              <p className="text-xs text-slate-400">
                Official security updates, safety advisories, and residence notifications
              </p>
            </div>

            {notices.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/80 mb-2" />
                No active security alerts or pending advisories for faculty residence blocks.
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => {
                  const isHigh = n.severity === "HIGH" || n.severity === "CRITICAL";

                  return (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white">{n.title}</h4>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase font-mono border ${
                            isHigh
                              ? "bg-rose-950/60 text-rose-400 border-rose-800/60"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {n.severity} Priority
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                        <Clock size={12} className="text-slate-500" />
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{n.description}</p>

                      {n.resolution && (
                        <div className="mt-2 rounded-xl bg-slate-950 border border-slate-800/80 p-3 text-xs text-emerald-400">
                          <span className="font-bold">Resolution Advisory: </span>
                          <span className="text-slate-300">{n.resolution}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 1. Create Guest Pass Modal */}
      {showCreatePassModal && (
        <CreateGuestPassModal
          onClose={() => setShowCreatePassModal(false)}
          onCreated={(newPass) => {
            queryClient.invalidateQueries({ queryKey: ["my-vip-passes"] });
            setShowCreatePassModal(false);
            setSelectedPassForQR(newPass);
          }}
        />
      )}

      {/* 2. Add Domestic Staff Modal */}
      {showAddHelpModal && (
        <AddDomesticStaffModal
          onClose={() => setShowAddHelpModal(false)}
          onCreated={(newHelp) => {
            queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
            setShowAddHelpModal(false);
            setSelectedHelpForQR(newHelp);
          }}
        />
      )}

      {/* 3. Universal Vector QR Modal for Guest Passes */}
      {selectedPassForQR && (
        <UniversalQRModal
          title="Official Visitor Gate Pass"
          sub="THAPAR GATE CLEARANCE PASS"
          name={selectedPassForQR.guestName}
          token={selectedPassForQR.token}
          phone={selectedPassForQR.guestPhone}
          meta={[
            { label: "Guest Name", value: selectedPassForQR.guestName },
            { label: "Purpose", value: selectedPassForQR.purpose || "Campus Visit" },
            { label: "Vehicle", value: selectedPassForQR.vehicleNumber || "Pedestrian Entry" },
            { label: "Status", value: selectedPassForQR.status },
          ]}
          onClose={() => setSelectedPassForQR(null)}
        />
      )}

      {/* 4. Universal Vector QR Modal for Domestic Staff */}
      {selectedHelpForQR && (
        <UniversalQRModal
          title="Domestic Staff Master Pass"
          sub="PERMANENT DOMESTIC STAFF CLEARANCE"
          name={selectedHelpForQR.helper.name}
          token={selectedHelpForQR.helper.token}
          phone={selectedHelpForQR.helper.phone}
          meta={[
            { label: "Staff Name", value: selectedHelpForQR.helper.name },
            { label: "Service", value: selectedHelpForQR.helper.serviceType },
            { label: "Quarter", value: selectedHelpForQR.quarterNumber },
            { label: "Clearance", value: selectedHelpForQR.isActive ? "ACTIVE & VERIFIED" : "PAUSED" },
          ]}
          onClose={() => setSelectedHelpForQR(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Modals
// ─────────────────────────────────────────────────────────────────────────────

function CreateGuestPassModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (pass: VIPDTO) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [purpose, setPurpose] = useState("Academic Guest / Faculty Visit");
  const [visitType, setVisitType] = useState<"OFFICIAL" | "PERSONAL">("OFFICIAL");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Please enter the guest full name");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await createVIPPass({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        visitType,
        purpose: purpose.trim() || "Campus Visit",
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : undefined,
      });
      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to create pass");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white tracking-tight">Issue Visitor Gate Pass</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-400">Purpose Category</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setVisitType("OFFICIAL");
                  setPurpose("Official Academic Meeting");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  visitType === "OFFICIAL"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                }`}
              >
                Official / Academic
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisitType("PERSONAL");
                  setPurpose("Personal Guest / Relative Visit");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  visitType === "PERSONAL"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                }`}
              >
                Personal / Relative
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">
              Guest Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Arvind Subramanian"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Mobile Phone Number (Optional)</label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Purpose Description</label>
            <input
              type="text"
              placeholder="e.g. PhD Defense External Examiner"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Vehicle License Plate (Optional)</label>
            <input
              type="text"
              placeholder="e.g. PB11BH8820"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 font-mono uppercase focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !guestName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Issue Gate Pass
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddDomesticStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (help: HouseHelpDTO) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("MAID");
  const [quarterNumber, setQuarterNumber] = useState("Faculty Residence Block B");
  const [workShift, setWorkShift] = useState("Morning (07:00 - 11:00)");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [idProofDocUrl, setIdProofDocUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter the 10-digit helper mobile phone");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await createStaffHouseHelp({
        phone: phone.trim(),
        name: name.trim() || undefined,
        serviceType,
        quarterNumber,
        workShift,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        idProofDocUrl: idProofDocUrl || undefined,
        photoUrl: photoUrl || undefined,
      });
      onCreated(res.help);
    } catch (err: any) {
      setError(err?.message || "Failed to register helper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white tracking-tight">Register or Link Domestic Staff</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-400">
              Helper Mobile Phone (10 Digits) <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              placeholder="e.g. 9876500111"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Helper Full Name</label>
            <input
              type="text"
              placeholder="e.g. Sunita Devi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Service Category</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setServiceType(cat.id)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold text-left transition ${
                    serviceType === cat.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Residence Quarter</label>
              <input
                type="text"
                value={quarterNumber}
                onChange={(e) => setQuarterNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400">Work Shift</label>
              <input
                type="text"
                value={workShift}
                onChange={(e) => setWorkShift(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Document & Face Uploads */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-400">Govt ID Scan (Optional)</label>
              {idProofDocUrl ? (
                <div className="mt-1 flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
                  <span>Attached</span>
                  <button type="button" onClick={() => setIdProofDocUrl(null)} className="text-slate-400 hover:text-rose-400">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-2.5 text-xs text-slate-400 hover:text-slate-300">
                  <Upload size={13} />
                  <span>Upload Scan</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setIdProofDocUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400">Helper Photo (Optional)</label>
              {photoUrl ? (
                <div className="mt-1 flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
                  <span>Attached</span>
                  <button type="button" onClick={() => setPhotoUrl(null)} className="text-slate-400 hover:text-rose-400">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-2.5 text-xs text-slate-400 hover:text-slate-300">
                  <Upload size={13} />
                  <span>Upload Selfie</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setPhotoUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Submit Staff Clearance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UniversalQRModal({
  title,
  sub,
  name,
  token,
  phone,
  meta,
  onClose,
}: {
  title: string;
  sub: string;
  name: string;
  token: string;
  phone?: string;
  meta: { label: string; value: string }[];
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // High-reliability global scannable QR link
  const universalQRImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    token
  )}`;

  useEffect(() => {
    QRCode.toDataURL(token, {
      width: 320,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [token]);

  const handleWhatsApp = () => {
    const msg = `THAPAR UNIVERSITY CAMPUS PASS\n\nPass Type: ${title}\nIssued For: ${name}\nPass Code: ${token}\n\nDigital Scannable QR Pass:\n${universalQRImageUrl}\n\nPresent this QR code at Campus Gates 1–4 for 1-scan barrier clearance.`;
    const cleanPhone = phone?.replace(/[^0-9]/g, "") || "";
    const waUrl =
      cleanPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 text-center relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">{sub}</div>
          <h3 className="text-lg font-black text-slate-900 mt-0.5">{title}</h3>
        </div>

        <div className="mx-auto flex justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {qrUrl ? (
            <img src={qrUrl} alt="Pass QR" className="h-44 w-44 rounded-lg" />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center text-xs text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>

        <div className="font-mono text-base font-black text-blue-700 tracking-wider">{token}</div>

        <div className="rounded-xl bg-slate-50 p-3 text-left text-xs space-y-1.5 border border-slate-100">
          {meta.map((m, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-slate-500 font-medium">{m.label}:</span>
              <span className="font-bold text-slate-900">{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleWhatsApp}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Share2 size={14} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(token);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy Code"}</span>
          </button>

          {qrUrl && (
            <a
              href={qrUrl}
              download={`Pass_${token}.png`}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center transition"
              title="Download PNG QR"
            >
              <Download size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffLoginPage() {
  const [email, setEmail] = useState("staff1@campus.edu");
  const [password, setPassword] = useState("staff123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        setError("Invalid faculty credentials.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Login service unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-2">
            <Building size={24} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Thapar Staff Portal</h2>
          <p className="text-xs text-slate-400">Faculty, Staff &amp; Residence Management</p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400">Faculty Campus Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Password / PIN</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            <span>Sign In to Console</span>
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setEmail("staff1@campus.edu");
              setPassword("staff123");
            }}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
          >
            Fill Demo Faculty Account (staff1@campus.edu)
          </button>
        </div>
      </div>
    </div>
  );
}
