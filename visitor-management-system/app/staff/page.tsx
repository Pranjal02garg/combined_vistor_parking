"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, useSession, signOut } from "next-auth/react";
import Link from "next/link";
import GoogleIcon from "@/components/GoogleIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyVIPPasses,
  createVIPPass,
  fetchStaffHouseHelps,
  createStaffHouseHelp,
  updateStaffHouseHelp,
  deleteStaffHouseHelp,
  fetchIncidents,
  VIPDTO,
  HouseHelpDTO,
  IncidentDTO,
  ApiError,
} from "@/lib/api";
import QRCode from "qrcode";
import {
  Loader2,
  QrCode,
  ShieldCheck,
  Plus,
  LogOut,
  Calendar,
  User,
  Phone,
  FileText,
  Car,
  Check,
  X,
  Clock,
  ArrowLeft,
  UserCheck,
  AlertOctagon,
  Power,
  Edit2,
  Sparkles,
  Lock,
  MessageCircle,
  Trash2,
  Share2,
  Copy,
  Download,
  AlertCircle,
  Building,
  CheckCircle2,
} from "lucide-react";

export default function StaffPage() {
  const { status, data: session } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (status !== "authenticated" || (session?.user?.role !== "STAFF" && session?.user?.role !== "HEAD")) {
    return <StaffLoginPage />;
  }

  return <StaffConsole userName={session?.user?.name || "Staff Member"} userEmail={session?.user?.email || ""} />;
}

function StaffConsole({ userName, userEmail }: { userName: string; userEmail: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"guests" | "house_helps" | "notices">("guests");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddHelpModal, setShowAddHelpModal] = useState(false);
  const [selectedPassForQR, setSelectedPassForQR] = useState<VIPDTO | null>(null);
  const [selectedHelpForQR, setSelectedHelpForQR] = useState<HouseHelpDTO | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Guest passes query
  const passesQuery = useQuery({
    queryKey: ["my-vip-passes"],
    queryFn: fetchMyVIPPasses,
    refetchInterval: 10_000,
  });
  const passes = passesQuery.data?.items ?? [];

  // House helps query
  const helpsQuery = useQuery({
    queryKey: ["my-house-helps"],
    queryFn: fetchStaffHouseHelps,
    refetchInterval: 10_000,
  });
  const helps = helpsQuery.data?.items ?? [];

  // Security notices query
  const noticesQuery = useQuery({
    queryKey: ["my-incidents"],
    queryFn: () => fetchIncidents(true),
    refetchInterval: 10_000,
  });
  const notices = noticesQuery.data?.items ?? [];

  // Toggle helper active/paused
  const toggleHelpMut = useMutation({
    mutationFn: (a: { id: string; isActive: boolean }) =>
      updateStaffHouseHelp(a.id, { isActive: a.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
    },
  });

  // Helper QR generator
  useEffect(() => {
    if (selectedPassForQR) {
      QRCode.toDataURL(selectedPassForQR.token, { width: 300, margin: 2 }).then(setQrDataUrl);
    } else if (selectedHelpForQR) {
      QRCode.toDataURL(selectedHelpForQR.token, { width: 300, margin: 2 }).then(setQrDataUrl);
    } else {
      setQrDataUrl(null);
    }
  }, [selectedPassForQR, selectedHelpForQR]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex flex-col pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">Thapar Gate Pass</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                  Staff Console
                </span>
              </div>
              <p className="text-xs text-slate-400">Welcome, {userName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 border-t border-slate-800/60 flex space-x-2 py-2 overflow-x-auto no-scrollbar">
          {[
            { id: "guests", label: "VIP Guest Passes", icon: QrCode, badge: passes.length },
            { id: "house_helps", label: "Domestic Staff / Helps", icon: UserCheck, badge: helps.length },
            { id: "notices", label: "Security & Resident Alerts", icon: AlertOctagon, badge: notices.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      active ? "bg-white text-blue-600" : "bg-slate-800 text-slate-300"
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* TAB 1: VIP GUEST PASSES */}
        {activeTab === "guests" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Issued VIP Guest Passes</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Issue and track digital entry QR passes for your academic guests, examiners, and personal visitors.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 self-start transition-all"
              >
                <Plus size={16} />
                <span>+ Issue VIP Pass</span>
              </button>
            </div>

            {passesQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs">Loading guest passes...</p>
              </div>
            ) : passes.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-3xl mx-auto mb-4 font-black">
                  🎫
                </div>
                <h3 className="text-lg font-bold text-white">No Guest Passes Created Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1.5 mb-5">
                  Generate digital gate passes for campus visitors. Guests can show the QR code directly at Gates 1–4.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  + Issue Your First Guest Pass
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {passes.map((p) => {
                  const isCheckedIn = p.status === "CHECKED_IN";
                  const isApproved = p.status === "APPROVED";
                  const isExited = p.status === "EXITED";

                  return (
                    <div
                      key={p.id}
                      className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all relative overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isCheckedIn
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : isApproved
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : isExited
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            ● {p.status}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white leading-snug">{p.guestName}</h3>
                        <p className="text-xs text-slate-300 font-medium mt-1">{p.purpose}</p>

                        <div className="mt-3.5 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                          {p.guestPhone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-500" />
                              <span>{p.guestPhone}</span>
                            </div>
                          )}
                          {p.vehicleNumber && (
                            <div className="flex items-center gap-1.5">
                              <Car size={12} className="text-blue-400" />
                              <span>Vehicle: <strong className="text-white font-mono">{p.vehicleNumber}</strong></span>
                            </div>
                          )}
                          {p.entryGateCode && (
                            <div className="text-[11px] text-emerald-400">
                              Entered Gate {p.entryGateCode} at {p.enteredAt ? new Date(p.enteredAt).toLocaleTimeString() : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedPassForQR(p)}
                          className="flex-1 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-blue-500/30 transition-all"
                        >
                          <QrCode size={14} />
                          <span>View QR</span>
                        </button>

                        <button
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/vip/${p.token}`;
                            const msg = `Hello ${p.guestName}, here is your Official Campus Gate Pass for Thapar University: ${shareUrl}`;
                            window.open(`https://wa.me/${p.guestPhone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                          }}
                          className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 transition-all"
                          title="Share on WhatsApp"
                        >
                          <Share2 size={14} />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HOUSE HELPS */}
        {activeTab === "house_helps" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Domestic Staff Clearance</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage registered domestic staff (maids, cooks, drivers) authorized to enter residential quarters.
                </p>
              </div>
              <button
                onClick={() => setShowAddHelpModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 self-start transition-all"
              >
                <Plus size={16} />
                <span>+ Register Domestic Staff</span>
              </button>
            </div>

            {helpsQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs">Loading domestic staff...</p>
              </div>
            ) : helps.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-3xl mx-auto mb-4 font-black">
                  🧹
                </div>
                <h3 className="text-lg font-bold text-white">No Domestic Staff Registered</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1.5 mb-5">
                  Register your household staff to grant them verified digital security entry at campus gates.
                </p>
                <button
                  onClick={() => setShowAddHelpModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  + Register First Helper
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {helps.map((h) => (
                  <div
                    key={h.id}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {h.serviceType}
                        </span>
                        <span className="text-xs font-bold text-slate-300">{h.quarterNumber}</span>
                      </div>

                      <h3 className="text-lg font-bold text-white">{h.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">📞 {h.phone}</p>
                      {h.workShift && (
                        <p className="text-xs text-blue-300 mt-1 font-medium">⏰ Shift: {h.workShift}</p>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedHelpForQR(h)}
                        className="py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold flex items-center gap-1.5 border border-blue-500/30"
                      >
                        <QrCode size={14} />
                        <span>Security QR</span>
                      </button>

                      <button
                        onClick={() => toggleHelpMut.mutate({ id: h.id, isActive: !h.isActive })}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                          h.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {h.isActive ? "● Active" : "○ Paused"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTICES & INCIDENTS */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Campus Security & Resident Notices</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Official security announcements, campus traffic alerts, and residence updates.
              </p>
            </div>

            {notices.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-4 font-black">
                  🛡️
                </div>
                <h3 className="text-lg font-bold text-white">All Clear — No Security Alerts</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1.5">
                  Campus security operations are normal across all 4 gates.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-start gap-4"
                  >
                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 text-xl shrink-0">
                      ⚠️
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-base">{n.title}</h3>
                        <span className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE VIP PASS MODAL */}
      {showCreateModal && (
        <CreateVIPModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(pass) => {
            setShowCreateModal(false);
            setSelectedPassForQR(pass);
            queryClient.invalidateQueries({ queryKey: ["my-vip-passes"] });
          }}
        />
      )}

      {/* QR PASS MODAL */}
      {selectedPassForQR && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-7 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Official Gate Pass QR</h3>
              <button onClick={() => setSelectedPassForQR(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="VIP Pass QR" className="w-52 h-52 mx-auto" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-800" size={32} />
                </div>
              )}
            </div>

            <h4 className="text-lg font-black text-white">{selectedPassForQR.guestName}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{selectedPassForQR.purpose}</p>
            {selectedPassForQR.vehicleNumber && (
              <p className="text-xs text-blue-400 font-mono font-bold mt-1">🚗 {selectedPassForQR.vehicleNumber}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/vip/${selectedPassForQR.token}`;
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedId("pass");
                  setTimeout(() => setCopiedId(null), 3000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {copiedId === "pass" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedId === "pass" ? "Copied!" : "Copy Link"}</span>
              </button>
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/vip/${selectedPassForQR.token}`;
                  const msg = `Hello ${selectedPassForQR.guestName}, here is your Official Campus Gate Pass for Thapar University: ${shareUrl}`;
                  window.open(`https://wa.me/${selectedPassForQR.guestPhone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <Share2 size={14} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateVIPModal({ onClose, onCreated }: { onClose: () => void; onCreated: (pass: VIPDTO) => void }) {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [visitType, setVisitType] = useState<"PERSONAL" | "OFFICIAL">("OFFICIAL");
  const [tier, setTier] = useState<"GUEST" | "DELEGATE" | "VIP">("GUEST");
  const [validityDays, setValidityDays] = useState("1");
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
        throw new Error("Guest mobile number must be 10 digits (e.g. 9876543210)");
      }

      const now = new Date();
      const days = parseInt(validityDays, 10) || 1;
      const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const res = await createVIPPass({
        guestName: guestName.trim(),
        guestPhone: cleanPhone || undefined,
        visitType,
        tier: visitType === "OFFICIAL" ? tier : undefined,
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().replace(/\s+/g, "").trim() : undefined,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
      });
      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to generate VIP pass.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl font-black">
              🎫
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Issue VIP Guest Pass</h3>
              <p className="text-xs text-slate-400">Pre-authorized digital entry pass</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Guest / Visitor Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. A.K. Verma (External Examiner)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Guest Mobile Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                maxLength={13}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Guest Vehicle Plate (Optional)</label>
              <input
                type="text"
                placeholder="e.g. DL8CAB1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white uppercase font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Pass Category</label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="OFFICIAL">🏛️ Official University Guest</option>
                <option value="PERSONAL">🏡 Personal / Family Guest</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Validity Period</label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="1">Valid Today (24 Hours)</option>
                <option value="3">Valid 3 Days (Conferences / Exams)</option>
                <option value="7">Valid 1 Week</option>
                <option value="30">Valid 1 Month</option>
              </select>
            </div>
          </div>

          {visitType === "OFFICIAL" && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Guest VIP Tier</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "GUEST", label: "Official Guest" },
                  { id: "DELEGATE", label: "Examiner / Delegate" },
                  { id: "VIP", label: "VIP Dignitary" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                      tier === t.id
                        ? "bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !guestName.trim()}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Generate VIP Pass</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffLoginPage() {
  const [email, setEmail] = useState("staff1@campus.edu");
  const [password, setPassword] = useState("staff123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      email: email.trim(),
      password,
    });

    if (res?.error) {
      setError("Invalid university email or password.");
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-3xl shadow-lg shadow-blue-500/25 mx-auto mb-4 font-black">
            🎓
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Thapar Gate Pass</h1>
          <p className="text-xs text-slate-400 mt-1">Staff & Faculty Portal Sign In</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              University Email (@campus.edu / @thapar.edu)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all mt-6"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            <span>Sign In to Staff Console</span>
          </button>
        </form>
      </div>
    </div>
  );
}
