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
  Share2,
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
  Image as ImageIcon,
  ExternalLink,
  MessageSquare,
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

export default function StaffPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Authenticating Staff &amp; Resident Portal...
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
  const helps = helpsQuery.data?.items ?? [];

  const noticesQuery = useQuery({
    queryKey: ["my-notices"],
    queryFn: () => fetchIncidents(true),
    refetchInterval: 10_000,
  });
  const notices = noticesQuery.data?.items ?? [];

  // Mutations
  const toggleHelpMut = useMutation({
    mutationFn: (a: { id: string; isActive: boolean }) =>
      updateStaffHouseHelp(a.id, { isActive: a.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
    },
  });

  const extendHelpMut = useMutation({
    mutationFn: (a: { id: string; validUntil: string }) =>
      updateStaffHouseHelp(a.id, { validUntil: a.validUntil }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
    },
  });

  const deleteHelpMut = useMutation({
    mutationFn: (id: string) => deleteStaffHouseHelp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col pb-20">
      {/* Sticky Blurred Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 transition-colors"
              title="Back to Campus Portal"
            >
              <ArrowLeft size={17} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                  Thapar Staff &amp; Resident Hub
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800 rounded-md">
                  Faculty Console
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {userName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: "/staff" })}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Tab Navigation Bar with Live Badges */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 border-t border-slate-800/80 flex space-x-1.5 py-2 overflow-x-auto no-scrollbar">
          {[
            { id: "parking", label: "Parking & Access", icon: Car, badge: carsCount },
            { id: "guests", label: "Guest Passes", icon: QrCode, badge: passes.length },
            { id: "house_helps", label: "House Helps & Maids", icon: UserCheck, badge: helps.length },
            { id: "notices", label: "Security Notices", icon: AlertOctagon, badge: notices.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as StaffTab)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap active:scale-95 ${
                  active
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      active ? "bg-white text-slate-900" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* TAB 1: PARKING & GATE ACCESS */}
        {activeTab === "parking" && <StaffParkingSection userName={userName} />}

        {/* TAB 2: GUEST PASSES */}
        {activeTab === "guests" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Visitor &amp; Guest Passes</h1>
                <p className="text-xs text-slate-400">
                  Pre-authorized digital gate passes for visitors, official guests, and meetings.
                </p>
              </div>
              <button
                onClick={() => setShowCreatePassModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <Plus size={15} />
                <span>+ Issue Guest Pass</span>
              </button>
            </div>

            {passesQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-500" size={28} />
                <p className="text-xs font-medium">Loading guest passes...</p>
              </div>
            ) : passes.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🎟️
                </div>
                <h3 className="text-base font-bold text-white">No Guest Passes Created</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Issue digital gate passes with auto-approval. Visitors scan their pass QR code at Gates 1–4.
                </p>
                <button
                  onClick={() => setShowCreatePassModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all shadow-sm"
                >
                  + Issue First Pass
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passes.map((p) => (
                  <PassCard
                    key={p.id}
                    pass={p}
                    onViewQR={() => setSelectedPassForQR(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HOUSE HELPS & MAIDS */}
        {activeTab === "house_helps" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Domestic Staff &amp; Maids</h1>
                <p className="text-xs text-slate-400">
                  Permanent QR access passes for maids, cooks, drivers, and household assistants.
                </p>
              </div>
              <button
                onClick={() => setShowAddHelpModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <Plus size={15} />
                <span>+ Register Helper</span>
              </button>
            </div>

            {helpsQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-500" size={28} />
                <p className="text-xs font-medium">Loading domestic staff...</p>
              </div>
            ) : helps.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🧹
                </div>
                <h3 className="text-base font-bold text-white">No Domestic Staff Registered</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Add maids, cooks, or drivers. Entering an existing campus mobile number instantly links their clearance.
                </p>
                <button
                  onClick={() => setShowAddHelpModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all shadow-sm"
                >
                  + Register First Helper
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {helps.map((h) => (
                  <HouseHelpCard
                    key={h.id}
                    help={h}
                    onViewQR={() => setSelectedHelpForQR(h)}
                    onToggleActive={(isActive) => toggleHelpMut.mutate({ id: h.id, isActive })}
                    onExtendValidity={(validUntil) => extendHelpMut.mutate({ id: h.id, validUntil })}
                    onUnlink={() => {
                      if (confirm(`Remove domestic staff clearance for ${h.name} from your quarter?`)) {
                        deleteHelpMut.mutate(h.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SECURITY NOTICES */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Campus Security &amp; Residence Notices</h1>
              <p className="text-xs text-slate-400">
                Official security warnings, incident reports, and residence log updates.
              </p>
            </div>

            {notices.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🛡️
                </div>
                <h3 className="text-base font-bold text-white">Clean Security Record</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  No security incidents or warnings are currently active against your quarter.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => {
                  const isCritical = n.severity === "CRITICAL";
                  const isHigh = n.severity === "HIGH";

                  return (
                    <div
                      key={n.id}
                      className={`bg-slate-900 border rounded-2xl p-5 shadow-sm flex items-start gap-4 ${
                        isCritical
                          ? "border-rose-500/40 bg-rose-500/5"
                          : isHigh
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-slate-800"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-xl text-lg shrink-0 border ${
                          isCritical
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : isHigh
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        }`}
                      >
                        ⚠️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm">{n.title}</h3>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                                isCritical
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                  : isHigh
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {n.severity}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                          {n.description}
                        </p>
                        {n.resolution && (
                          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                            <strong className="block text-emerald-300 font-semibold mb-0.5">
                              ✓ Resolution:
                            </strong>
                            {n.resolution}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE VIP PASS MODAL */}
      {showCreatePassModal && (
        <CreatePassModal
          onClose={() => setShowCreatePassModal(false)}
          onCreated={(pass) => {
            setShowCreatePassModal(false);
            setSelectedPassForQR(pass);
            queryClient.invalidateQueries({ queryKey: ["my-vip-passes"] });
          }}
        />
      )}

      {/* ADD HOUSE HELP MODAL */}
      {showAddHelpModal && (
        <AddHouseHelpModal
          onClose={() => setShowAddHelpModal(false)}
          onCreated={(help) => {
            setShowAddHelpModal(false);
            setSelectedHelpForQR(help);
            queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
          }}
        />
      )}

      {/* VIP QR MODAL */}
      {selectedPassForQR && (
        <QRModal
          pass={selectedPassForQR}
          onClose={() => setSelectedPassForQR(null)}
        />
      )}

      {/* HOUSE HELP MASTER QR MODAL */}
      {selectedHelpForQR && (
        <HouseHelpQRModal
          help={selectedHelpForQR}
          onClose={() => setSelectedHelpForQR(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PassCard Component
// ─────────────────────────────────────────────────────────────────────────────
function PassCard({ pass, onViewQR }: { pass: VIPDTO; onViewQR: () => void }) {
  const isCheckedIn = pass.status === "CHECKED_IN";
  const isApproved = pass.status === "APPROVED";
  const isExited = pass.status === "EXITED";
  const isPending = pass.status === "PENDING";
  const isRejected = pass.status === "REJECTED";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            {pass.purpose || "Official Guest"}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
              isCheckedIn
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isApproved
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : isExited
                ? "bg-slate-800 text-slate-400 border-slate-700"
                : isRejected
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {isCheckedIn ? "● On Campus" : pass.status}
          </span>
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">{pass.guestName}</h3>
        {pass.guestPhone && (
          <p className="text-xs text-slate-400 mt-0.5 font-mono">📞 +91 {pass.guestPhone}</p>
        )}
        {pass.vehicleNumber && (
          <div className="mt-2.5 inline-block px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-200 uppercase">
            🚗 {pass.vehicleNumber}
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">
          Code: {pass.token}
        </span>
        <button
          onClick={onViewQR}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 active:scale-95"
        >
          <QrCode size={14} />
          <span>View QR Pass</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HouseHelpCard Component
// ─────────────────────────────────────────────────────────────────────────────
function HouseHelpCard({
  help,
  onViewQR,
  onToggleActive,
  onExtendValidity,
  onUnlink,
}: {
  help: HouseHelpDTO;
  onViewQR: () => void;
  onToggleActive: (isActive: boolean) => void;
  onExtendValidity: (validUntil: string) => void;
  onUnlink: () => void;
}) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [validDate, setValidDate] = useState(
    help.validUntil ? help.validUntil.split("T")[0] : ""
  );

  const isApproved = help.status === "APPROVED";
  const isPending = help.status === "PENDING_APPROVAL";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {help.serviceType}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
              isApproved && help.isActive !== false
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isPending
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            {isPending ? "Awaiting Head" : help.isActive === false ? "Paused" : "Active"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center text-sm shrink-0">
            {help.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{help.name}</h3>
            <p className="text-xs text-slate-400 font-mono">📞 +91 {help.phone}</p>
          </div>
        </div>

        {/* Details & Proofs */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Home size={13} className="text-slate-500 shrink-0" />
            <span className="truncate">{help.quarterNumber || "Faculty Residence"}</span>
          </div>

          {help.idProofNumber && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
              <span className="truncate">
                <strong className="text-slate-300">{help.idProofType || "ID"}:</strong>{" "}
                {help.idProofNumber}
              </span>
            </div>
          )}

          {help.workShift && (
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500 shrink-0" />
              <span>Shift: {help.workShift}</span>
            </div>
          )}

          {/* Validity Row */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Valid Till:{" "}
              {help.validUntil
                ? new Date(help.validUntil).toLocaleDateString()
                : "Permanent"}
            </span>
            <button
              onClick={() => setIsEditingDate(!isEditingDate)}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
            >
              {isEditingDate ? "Done" : "Extend"}
            </button>
          </div>

          {isEditingDate && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="date"
                value={validDate}
                onChange={(e) => setValidDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
              />
              <button
                onClick={() => {
                  if (validDate) {
                    onExtendValidity(new Date(validDate).toISOString());
                    setIsEditingDate(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        {isApproved ? (
          <button
            onClick={onViewQR}
            className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors active:scale-95"
          >
            <QrCode size={14} />
            <span>Master QR Pass</span>
          </button>
        ) : (
          <div className="flex-1 py-1.5 px-2 text-center text-[11px] font-semibold text-amber-400/80 bg-amber-500/5 rounded-xl border border-amber-500/10">
            QR Locked • Awaiting Head
          </div>
        )}

        <button
          onClick={() => onToggleActive(!help.isActive)}
          className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
            help.isActive !== false
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
          }`}
          title="Toggle Staff Active/Paused"
        >
          {help.isActive !== false ? "● Active" : "○ Paused"}
        </button>

        <button
          onClick={onUnlink}
          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors active:scale-95"
          title="Unlink from Quarter"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Shared PassShareBox Toolkit Component
// ─────────────────────────────────────────────────────────────────────────────
function PassShareBox({
  token,
  title,
  guestName,
  purpose,
  phone,
  qrDataUrl,
}: {
  token: string;
  title: string;
  guestName: string;
  purpose?: string;
  phone?: string;
  qrDataUrl: string | null;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/pass/${token}`;
  };

  const getShareMessage = () => {
    const url = getShareUrl();
    return `🏛️ Thapar University Campus Pass\n${title}: ${guestName}\nToken: ${token}\nPurpose: ${purpose || "Campus Entry"}\nDigital Pass: ${url}`;
  };

  // 1. Share QR Image (native sheet)
  const handleShareImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `Thapar-Pass-${token}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Thapar Gate Pass",
          text: getShareMessage(),
        });
      } else if (navigator.share) {
        await navigator.share({
          title: "Thapar Gate Pass",
          text: getShareMessage(),
          url: getShareUrl(),
        });
      } else {
        handleCopyLink();
      }
    } catch {
      handleCopyLink();
    }
  };

  // 2. WhatsApp Text
  const handleWhatsApp = () => {
    const msg = getShareMessage();
    const cleanPhone = phone?.replace(/[^0-9]/g, "") || "";
    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  // 3. Copy PNG Image to Clipboard
  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      if ((window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ "image/png": blob }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        handleCopyLink();
      }
    } catch {
      handleCopyLink();
    }
  };

  // 4. Copy Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // 5. Download PNG
  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Thapar-Gate-Pass-${token}.png`;
    a.click();
  };

  return (
    <div className="space-y-2.5 mt-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleWhatsApp}
          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          <MessageSquare size={14} />
          <span>WhatsApp</span>
        </button>

        <button
          onClick={handleShareImage}
          className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          <Share2 size={14} />
          <span>Share Pass</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={handleCopyLink}
          className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          <span>{copiedLink ? "Copied" : "Copy Link"}</span>
        </button>

        <button
          onClick={handleCopyImage}
          className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          {copiedImage ? <Check size={13} className="text-emerald-600" /> : <ImageIcon size={13} />}
          <span>{copiedImage ? "Copied" : "Copy PNG"}</span>
        </button>

        <button
          onClick={handleDownload}
          className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          <Download size={13} />
          <span>Save QR</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. White QRModal (Guest Passes)
// ─────────────────────────────────────────────────────────────────────────────
function QRModal({ pass, onClose }: { pass: VIPDTO; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(pass.token, {
      width: 380,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [pass.token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
        >
          ✕
        </button>

        <div className="mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">
            Thapar University Gate Clearance
          </span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Digital Guest Pass
          </h3>
        </div>

        {/* High-Contrast Crisp QR */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 inline-block mb-3 shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Gate Pass QR" className="w-48 h-48 mx-auto" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-slate-800" size={28} />
            </div>
          )}
        </div>

        {/* Token Code */}
        <div className="font-mono text-base font-black text-slate-900 bg-slate-100 py-1.5 px-3 rounded-xl inline-block mb-3 border border-slate-200">
          {pass.token}
        </div>

        <div className="space-y-1 text-left bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Guest:</span>
            <span className="font-bold text-slate-900">{pass.guestName}</span>
          </div>
          {pass.purpose && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Purpose:</span>
              <span className="font-semibold text-slate-800">{pass.purpose}</span>
            </div>
          )}
          {pass.vehicleNumber && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Vehicle:</span>
              <span className="font-mono font-bold text-slate-900 uppercase">
                {pass.vehicleNumber}
              </span>
            </div>
          )}
          {pass.validUntil && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Valid Till:</span>
              <span className="font-semibold text-slate-800">
                {new Date(pass.validUntil).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <PassShareBox
          token={pass.token}
          title="Guest Pass"
          guestName={pass.guestName}
          purpose={pass.purpose}
          phone={pass.guestPhone}
          qrDataUrl={qrDataUrl}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. White HouseHelpQRModal (Domestic Staff)
// ─────────────────────────────────────────────────────────────────────────────
function HouseHelpQRModal({ help, onClose }: { help: HouseHelpDTO; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(help.token, {
      width: 380,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [help.token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
        >
          ✕
        </button>

        <div className="mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-600 block mb-0.5">
            Permanent Domestic Staff Clearance
          </span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Master Security QR Pass
          </h3>
        </div>

        {/* High-Contrast Crisp QR */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 inline-block mb-3 shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Domestic Staff QR" className="w-48 h-48 mx-auto" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-purple-700" size={28} />
            </div>
          )}
        </div>

        {/* Token Code */}
        <div className="font-mono text-base font-black text-slate-900 bg-purple-50 text-purple-900 py-1.5 px-3 rounded-xl inline-block mb-3 border border-purple-200">
          {help.token}
        </div>

        <div className="space-y-1 text-left bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Name:</span>
            <span className="font-bold text-slate-900">{help.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Service:</span>
            <span className="font-bold text-purple-700 uppercase">{help.serviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Quarter:</span>
            <span className="font-semibold text-slate-800">{help.quarterNumber}</span>
          </div>
          {help.idProofNumber && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">{help.idProofType || "Govt ID"}:</span>
              <span className="font-mono font-bold text-slate-900">{help.idProofNumber}</span>
            </div>
          )}
        </div>

        <PassShareBox
          token={help.token}
          title="Domestic Staff Security Pass"
          guestName={help.name}
          purpose={`${help.serviceType} • Quarter ${help.quarterNumber}`}
          phone={help.phone}
          qrDataUrl={qrDataUrl}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CreatePassModal Component
// ─────────────────────────────────────────────────────────────────────────────
function CreatePassModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (pass: VIPDTO) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [purpose, setPurpose] = useState("Academic Guest / Faculty Visit");
  const [visitType, setVisitType] = useState<"OFFICIAL" | "PERSONAL">("OFFICIAL");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const digitsOnly = guestPhone.replace(/[^0-9]/g, "");
      const cleanPhone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : "";

      if (guestPhone.trim() && cleanPhone.length !== 10) {
        throw new Error("Guest mobile number must be exactly 10 digits");
      }

      const fromDate = new Date(`${validFrom}T00:00:00.000Z`);
      const toDate = new Date(`${validUntil}T23:59:59.999Z`);

      const res = await createVIPPass({
        guestName: guestName.trim(),
        guestPhone: cleanPhone || undefined,
        visitType,
        purpose: purpose.trim(),
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().replace(/\s+/g, "").trim() : undefined,
        validFrom: fromDate.toISOString(),
        validUntil: toDate.toISOString(),
      });
      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to generate pass.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Issue Visitor Gate Pass</h3>
            <p className="text-xs text-slate-400">Direct Guard Access • Instant 1-Scan Gate Entry</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Visit Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Purpose Category</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setVisitType("OFFICIAL");
                  setPurpose("Official Meeting / Academic Guest");
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition ${
                  visitType === "OFFICIAL"
                    ? "bg-slate-800 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Official / Meeting
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisitType("PERSONAL");
                  setPurpose("Personal Guest / Relative Visit");
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition ${
                  visitType === "PERSONAL"
                    ? "bg-slate-800 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Personal / Visitor
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Guest Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Arvind Subramanian"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mobile Number (10 Digits, Optional)
            </label>
            <input
              type="tel"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vehicle Plate (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. PB11BH8820"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Purpose of Visit</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. External Reviewer"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>

          {/* Full-Day Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Valid From</label>
              <input
                type="date"
                required
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Valid Until</label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !guestName.trim()}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? "Issuing..." : "Issue Guest Pass"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. AddHouseHelpModal (with Base64 Document & Selfie Uploads)
// ─────────────────────────────────────────────────────────────────────────────
function AddHouseHelpModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (help: HouseHelpDTO) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("MAID");
  const [quarterNumber, setQuarterNumber] = useState("Faculty Residence B-104");
  const [workShift, setWorkShift] = useState("Morning (07:00 - 11:00)");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [idProofDocUrl, setIdProofDocUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const SERVICE_TYPES = [
    { id: "MAID", label: "Maid / Domestic Help" },
    { id: "COOK", label: "Cook / Chef" },
    { id: "DRIVER", label: "Driver" },
    { id: "CLEANER", label: "Cleaner" },
    { id: "GARDENER", label: "Gardener" },
    { id: "OTHER", label: "Other Staff" },
  ];

  const ID_PROOF_TYPES = [
    { id: "AADHAAR", label: "Aadhaar Card" },
    { id: "VOTER_ID", label: "Voter ID Card" },
    { id: "DRIVING_LICENSE", label: "Driving License" },
    { id: "PASSPORT", label: "Passport" },
    { id: "OTHER", label: "Other Govt Photo ID" },
  ];

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be under 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);
      if (cleanPhone.length !== 10) {
        throw new Error("Valid 10-digit mobile number is required");
      }
      if (!quarterNumber.trim()) throw new Error("Quarter / residence is required");

      const res = await createStaffHouseHelp({
        phone: cleanPhone,
        name: name.trim() || undefined,
        serviceType,
        quarterNumber: quarterNumber.trim(),
        workShift,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        idProofDocUrl: idProofDocUrl || undefined,
        photoUrl: photoUrl || undefined,
        validUntil: new Date(`${validUntil}T23:59:59.999Z`).toISOString(),
      });

      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to register or link staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Register or Link Domestic Staff</h3>
            <p className="text-xs text-slate-400">
              Entering an existing campus mobile number instantly links clearance
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Mobile Number is the linking key */}
          <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-1">
            <label className="block text-xs font-bold text-purple-300">
              Helper Mobile Number (10 Digits) *
            </label>
            <input
              type="tel"
              required
              maxLength={10}
              placeholder="e.g. 9876500111"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-purple-300/70">
              Auto-Link: If helper is already cleared on campus, they link immediately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Helper Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sunita Devi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Service Category *
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Your Quarter / Residence *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Quarter 14B"
                value={quarterNumber}
                onChange={(e) => setQuarterNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Work Shift</label>
              <input
                type="text"
                value={workShift}
                onChange={(e) => setWorkShift(e.target.value)}
                placeholder="e.g. Morning (07:00 - 11:00)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>

          {/* Government ID Proof Details */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Government ID Proof Verification
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  ID Proof Type
                </label>
                <select
                  value={idProofType}
                  onChange={(e) => setIdProofType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {ID_PROOF_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  ID Proof Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9102-8812-4410"
                  value={idProofNumber}
                  onChange={(e) => setIdProofNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Document & Selfie Uploads */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Aadhaar / ID Scan (≤ 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={docInputRef}
                  onChange={(e) => handleFileUpload(e, setIdProofDocUrl)}
                  className="hidden"
                />
                {idProofDocUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-700 rounded-xl">
                    <img
                      src={idProofDocUrl}
                      alt="ID Scan"
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="text-[10px] text-emerald-400 font-bold truncate">
                      Document Attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setIdProofDocUrl("")}
                      className="text-slate-500 hover:text-rose-400 ml-auto"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Upload size={13} />
                    <span>Upload ID Scan</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Helper Face Photo (≤ 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={photoInputRef}
                  onChange={(e) => handleFileUpload(e, setPhotoUrl)}
                  className="hidden"
                />
                {photoUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-700 rounded-xl">
                    <img
                      src={photoUrl}
                      alt="Selfie"
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="text-[10px] text-emerald-400 font-bold truncate">
                      Photo Attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhotoUrl("")}
                      className="text-slate-500 hover:text-rose-400 ml-auto"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Upload size={13} />
                    <span>Upload Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Pass Validity Expiration
            </label>
            <input
              type="date"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? "Registering..." : "Submit Staff Clearance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. StaffLoginPage Component
// ─────────────────────────────────────────────────────────────────────────────
function StaffLoginPage() {
  const [email, setEmail] = useState("staff1@campus.edu");
  const [password, setPassword] = useState("staff123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (eUser?: string, ePass?: string) => {
    const useEmail = (eUser || email).toLowerCase().trim();
    const usePass = ePass || password;

    if (!useEmail || !usePass) {
      setError("Please provide your university email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: useEmail, password: usePass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials.");
        setLoading(false);
        return;
      }
      window.location.href = "/staff";
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-2xl shadow mx-auto mb-3 font-bold">
            🎓
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Faculty &amp; Resident Portal</h2>
          <p className="text-xs text-slate-400 mt-1">
            University Campus Parking, Gate Passes &amp; Residence System
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* 1-Tap Demo Accounts */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            ⚡ Quick 1-Tap Faculty Sign-In
          </p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setEmail("staff1@campus.edu");
                setPassword("staff123");
                handleLogin("staff1@campus.edu", "staff123");
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition active:scale-98"
            >
              <div>
                <div className="text-xs font-bold text-white">Prof. Rajesh Sharma (HOD CSE)</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  staff1@campus.edu • Pass: staff123
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                Sign In
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail("prof.kaur@thapar.edu");
                setPassword("staff123");
                handleLogin("prof.kaur@thapar.edu", "staff123");
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition active:scale-98"
            >
              <div>
                <div className="text-xs font-bold text-white">Dr. Simran Kaur (Dean)</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  prof.kaur@thapar.edu • Pass: staff123
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                Sign In
              </span>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Official University Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="faculty@thapar.edu"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <Link href="/forgot-password" className="text-[11px] text-blue-400 hover:text-blue-300">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition shadow-sm mt-2 flex items-center justify-center gap-2 active:scale-98"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign In to Portal"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            ← Back to Campus Directory
          </Link>
        </div>
      </div>
    </div>
  );
}
