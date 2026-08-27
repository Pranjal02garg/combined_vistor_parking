"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
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
        <p className="text-xs text-slate-400 font-medium">Authenticating Staff Portal...</p>
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddHelpModal, setShowAddHelpModal] = useState(false);
  const [selectedPassForQR, setSelectedPassForQR] = useState<VIPDTO | null>(null);
  const [selectedHelpForQR, setSelectedHelpForQR] = useState<HouseHelpDTO | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const passesQuery = useQuery({
    queryKey: ["my-vip-passes"],
    queryFn: fetchMyVIPPasses,
  });
  const passes = passesQuery.data?.items ?? [];

  const helpsQuery = useQuery({
    queryKey: ["my-house-helps"],
    queryFn: fetchStaffHouseHelps,
  });
  const helps = helpsQuery.data?.items ?? [];

  const noticesQuery = useQuery({
    queryKey: ["my-notices"],
    queryFn: () => fetchIncidents(true),
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

  // Delete / Unlink helper
  const deleteHelpMut = useMutation({
    mutationFn: (id: string) => deleteStaffHouseHelp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-house-helps"] });
    },
  });

  // QR code generator
  useEffect(() => {
    if (selectedPassForQR) {
      QRCode.toDataURL(selectedPassForQR.token, { width: 300, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else if (selectedHelpForQR) {
      QRCode.toDataURL(selectedHelpForQR.token, { width: 300, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedPassForQR, selectedHelpForQR]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-sm">
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
                <span className="font-bold text-base text-white tracking-tight">Thapar Faculty Portal</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-md">
                  Staff Console
                </span>
              </div>
              <p className="text-xs text-slate-400">{userName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 border-t border-slate-800 flex space-x-1.5 py-2 overflow-x-auto no-scrollbar">
          {[
            { id: "parking", label: "Parking & Access", icon: Car },
            { id: "guests", label: "Guest Passes", icon: QrCode, badge: passes.length },
            { id: "house_helps", label: "Domestic Staff", icon: UserCheck, badge: helps.length },
            { id: "notices", label: "Campus Notices", icon: AlertOctagon, badge: notices.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* TAB 0: PARKING & ACCESS */}
        {activeTab === "parking" && <StaffParkingSection userName={userName} />}

        {/* TAB 1: GUEST PASSES */}
        {activeTab === "guests" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Visitor &amp; Guest Passes</h1>
                <p className="text-xs text-slate-400">Pre-authorized digital gate passes for campus visitors and academic guests.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus size={15} />
                <span>+ Issue Guest Pass</span>
              </button>
            </div>

            {passesQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-500" size={28} />
                <p className="text-xs">Loading passes...</p>
              </div>
            ) : passes.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🎫
                </div>
                <h3 className="text-base font-bold text-white">No Guest Passes Created</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Generate digital gate passes for campus visitors. Visitors scan the QR code at Gates 1–4.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold"
                >
                  + Issue First Pass
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
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                isCheckedIn
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : isApproved
                                  ? "bg-slate-800 text-slate-300 border-slate-700"
                                  : isExited
                                  ? "bg-slate-800/60 text-slate-500 border-slate-800"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}
                            >
                              ● {p.status}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
                              {p.tier || "VIP"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white leading-snug">{p.guestName}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{p.purpose}</p>

                        <div className="mt-3.5 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                          {p.guestPhone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-500" />
                              <span>{p.guestPhone}</span>
                            </div>
                          )}
                          {p.vehicleNumber && (
                            <div className="flex items-center gap-1.5">
                              <Car size={12} className="text-slate-400" />
                              <span>Vehicle: <strong className="text-white font-mono">{p.vehicleNumber}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <FileText size={11} className="text-slate-500" />
                            <span>Type: <strong className="text-slate-300 font-semibold">{p.visitType || "OFFICIAL"}</strong></span>
                          </div>
                          {p.entryGateCode && (
                            <div className="text-[11px] text-emerald-400 font-semibold">
                              Gate {p.entryGateCode} • {p.enteredAt ? new Date(p.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-2">
                        <button
                          onClick={() => setSelectedPassForQR(p)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                        >
                          <QrCode size={14} />
                          <span>QR Pass</span>
                        </button>

                        <button
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/vip/${p.token}`;
                            navigator.clipboard.writeText(shareUrl);
                            setCopiedId(p.id);
                            setTimeout(() => setCopiedId(null), 3000);
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                          title="Copy Link"
                        >
                          {copiedId === p.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>

                        {p.guestPhone && (
                          <button
                            onClick={() => {
                              const shareUrl = `${window.location.origin}/vip/${p.token}`;
                              const msg = `Campus Gate Pass for Thapar University: ${shareUrl}`;
                              window.open(`https://wa.me/${p.guestPhone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 border border-slate-700 transition-colors"
                            title="Share on WhatsApp"
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DOMESTIC STAFF */}
        {activeTab === "house_helps" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Domestic Staff Clearance</h1>
                <p className="text-xs text-slate-400">Manage digital entry clearance and verified ID proofs for household staff and drivers.</p>
              </div>
              <button
                onClick={() => setShowAddHelpModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus size={15} />
                <span>+ Register Domestic Staff</span>
              </button>
            </div>

            {helpsQuery.isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-500" size={28} />
                <p className="text-xs">Loading domestic staff...</p>
              </div>
            ) : helps.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🧹
                </div>
                <h3 className="text-base font-bold text-white">No Domestic Staff Registered</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Register maids, cooks, and drivers for digital gate entry into campus residences with ID proofs.
                </p>
                <button
                  onClick={() => setShowAddHelpModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold"
                >
                  + Register Domestic Staff
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {helps.map((h) => (
                  <div
                    key={h.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {h.serviceType}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">{h.quarterNumber}</span>
                      </div>

                      <h3 className="text-base font-bold text-white">{h.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">📞 {h.phone}</p>

                      {/* ID Proof & Shift Section */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1 text-xs text-slate-400">
                        {h.idProofNumber && (
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                            <span className="truncate">
                              <strong className="text-slate-300">{h.idProofType || "Govt ID"}:</strong> {h.idProofNumber}
                            </span>
                          </div>
                        )}
                        {h.workShift && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-500 shrink-0" />
                            <span>Shift: {h.workShift}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedHelpForQR(h)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <QrCode size={14} />
                        <span>Security QR</span>
                      </button>

                      <button
                        onClick={() => toggleHelpMut.mutate({ id: h.id, isActive: !h.isActive })}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          h.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {h.isActive ? "● Active" : "○ Paused"}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remove domestic staff entry clearance for ${h.name}?`)) {
                            deleteHelpMut.mutate(h.id);
                          }
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                        title="Unlink Staff"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTICES */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Campus Security Notices</h1>
              <p className="text-xs text-slate-400">Security announcements, traffic alerts, and residence updates.</p>
            </div>

            {notices.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  🛡️
                </div>
                <h3 className="text-base font-bold text-white">No Active Security Alerts</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Campus gate and traffic operations are currently normal across all gates.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex items-start gap-4"
                  >
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-lg shrink-0">
                      ⚠️
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">{n.title}</h3>
                        <span className="text-xs text-slate-500 font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
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

      {/* ADD DOMESTIC STAFF MODAL */}
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

      {/* VIP QR PASS MODAL */}
      {selectedPassForQR && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Campus Gate Pass QR</h3>
              <button onClick={() => setSelectedPassForQR(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Gate Pass QR" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-800" size={28} />
                </div>
              )}
            </div>

            <div className="flex justify-center gap-1.5 mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase">
                {selectedPassForQR.tier || "VIP PASS"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase">
                {selectedPassForQR.visitType || "OFFICIAL"}
              </span>
            </div>

            <h4 className="text-base font-bold text-white">{selectedPassForQR.guestName}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{selectedPassForQR.purpose}</p>
            {selectedPassForQR.vehicleNumber && (
              <p className="text-xs text-slate-300 font-mono font-semibold mt-1">Vehicle: {selectedPassForQR.vehicleNumber}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/vip/${selectedPassForQR.token}`;
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedId("pass");
                  setTimeout(() => setCopiedId(null), 3000);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {copiedId === "pass" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedId === "pass" ? "Copied!" : "Copy Link"}</span>
              </button>
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/vip/${selectedPassForQR.token}`;
                  const msg = `Campus Gate Pass: ${shareUrl}`;
                  window.open(`https://wa.me/${selectedPassForQR.guestPhone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOMESTIC STAFF QR MODAL */}
      {selectedHelpForQR && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Domestic Staff Gate Clearance</h3>
              <button onClick={() => setSelectedHelpForQR(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Domestic Staff QR" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-800" size={28} />
                </div>
              )}
            </div>

            <div className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 mb-1 uppercase">
              {selectedHelpForQR.serviceType}
            </div>
            <h4 className="text-base font-bold text-white">{selectedHelpForQR.name}</h4>
            <p className="text-xs text-slate-400 font-mono mt-0.5">📞 {selectedHelpForQR.phone}</p>
            <p className="text-xs text-slate-300 mt-0.5">Quarter: {selectedHelpForQR.quarterNumber}</p>
            {selectedHelpForQR.idProofNumber && (
              <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                🪪 {selectedHelpForQR.idProofType || "Govt ID"}: {selectedHelpForQR.idProofNumber}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedHelpForQR.token);
                  setCopiedId("help");
                  setTimeout(() => setCopiedId(null), 3000);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {copiedId === "help" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedId === "help" ? "Copied!" : "Copy Token"}</span>
              </button>
              <button
                onClick={() => {
                  const msg = `Security Pass ID for ${selectedHelpForQR.name}: ${selectedHelpForQR.token}`;
                  window.open(`https://wa.me/${selectedHelpForQR.phone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
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
  const [purpose, setPurpose] = useState("Academic Guest / Faculty Visit");
  const [visitType, setVisitType] = useState<"OFFICIAL" | "PERSONAL">("OFFICIAL");
  const [tier, setTier] = useState<"VIP" | "DELEGATE" | "GUEST" | "GENERAL">("VIP");
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
        throw new Error("Guest mobile number must be 10 digits");
      }

      const now = new Date();
      const days = parseInt(validityDays, 10) || 1;
      const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const res = await createVIPPass({
        guestName: guestName.trim(),
        guestPhone: cleanPhone || undefined,
        visitType,
        tier,
        purpose: purpose.trim(),
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().replace(/\s+/g, "").trim() : undefined,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
      });
      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to generate pass.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Issue Visitor Gate Pass</h3>
            <p className="text-xs text-slate-400">Pre-authorized digital entry pass</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Visit Type & Tier Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Visit Type</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setVisitType("OFFICIAL")}
                  className={`py-1 text-xs font-bold rounded-lg transition ${
                    visitType === "OFFICIAL" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Official
                </button>
                <button
                  type="button"
                  onClick={() => setVisitType("PERSONAL")}
                  className={`py-1 text-xs font-bold rounded-lg transition ${
                    visitType === "PERSONAL" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Personal
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Guest Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-600"
              >
                <option value="VIP">VIP Guest</option>
                <option value="DELEGATE">Academic Delegate</option>
                <option value="GUEST">General Visitor</option>
                <option value="GENERAL">Contractor / Vendor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Guest Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh Khanna"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number (10 Digits)</label>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle License Plate</label>
              <input
                type="text"
                placeholder="e.g. PB11AB1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Validity (Days)</label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              >
                <option value="1">1 Day (Today)</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Purpose of Visit</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Academic Council Meeting / Lab Review"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
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
              disabled={loading || !guestName.trim()}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Pass"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddHouseHelpModal({ onClose, onCreated }: { onClose: () => void; onCreated: (help: HouseHelpDTO) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("MAID");
  const [quarterNumber, setQuarterNumber] = useState("Faculty Residence B-104");
  const [workShift, setWorkShift] = useState("Morning (07:00 - 11:00)");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [idProofDocUrl, setIdProofDocUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SERVICE_TYPES = [
    { id: "MAID", label: "Maid / Domestic Help" },
    { id: "COOK", label: "Cook / Chef" },
    { id: "DRIVER", label: "Driver" },
    { id: "CLEANER", label: "Cleaner" },
    { id: "GARDENER", label: "Gardener" },
    { id: "ELECTRICIAN", label: "Electrician / Plumber" },
    { id: "OTHER", label: "Other Staff" },
  ];

  const ID_PROOF_TYPES = [
    { id: "AADHAAR", label: "Aadhaar Card" },
    { id: "VOTER_ID", label: "Voter ID Card" },
    { id: "DRIVING_LICENSE", label: "Driving License" },
    { id: "PASSPORT", label: "Passport" },
    { id: "OTHER", label: "Other Govt Photo ID" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);
      if (cleanPhone.length !== 10) {
        throw new Error("Valid 10-digit mobile number is required");
      }
      if (!name.trim()) throw new Error("Staff name is required");
      if (!quarterNumber.trim()) throw new Error("Quarter number is required");

      const res = await createStaffHouseHelp({
        name: name.trim(),
        phone: cleanPhone,
        serviceType,
        quarterNumber: quarterNumber.trim(),
        workShift,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        idProofDocUrl: idProofDocUrl.trim() || undefined,
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      });

      onCreated(res);
    } catch (err: any) {
      setError(err?.message || "Failed to register staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Register Domestic Staff</h3>
            <p className="text-xs text-slate-400">Quarter entry clearance &amp; ID Proof</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Staff Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (10 Digits) *</label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876500111"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Staff Category *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quarter / Residence *</label>
              <input
                type="text"
                required
                placeholder="e.g. Faculty Residence B-104"
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

          {/* Government ID Proof Fields */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Govt ID Proof Verification
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">ID Proof Type</label>
                <select
                  value={idProofType}
                  onChange={(e) => setIdProofType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {ID_PROOF_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">ID Proof Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9102-8812-4410"
                  value={idProofNumber}
                  onChange={(e) => setIdProofNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Photo / Proof Document Link (Optional)</label>
              <input
                type="url"
                placeholder="https://.../id-proof.jpg"
                value={idProofDocUrl}
                onChange={(e) => setIdProofDocUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
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
              disabled={loading || !name.trim() || !phone.trim()}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
            >
              {loading ? "Registering..." : "Register Staff"}
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
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-xl shadow mx-auto mb-2.5 font-bold">
            🎓
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Faculty &amp; Resident Portal</h2>
          <p className="text-xs text-slate-400">Campus Visitor &amp; Parking System</p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* 1-Tap Quick Sign-In */}
        <div className="mb-5 p-3 rounded-xl bg-slate-950 border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 mb-2">1-Tap Demo Accounts:</p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setEmail("staff1@campus.edu");
                setPassword("staff123");
                handleLogin("staff1@campus.edu", "staff123");
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <div>
                <div className="text-xs font-semibold text-white">Prof. Rajesh Sharma</div>
                <div className="text-[10px] text-slate-400 font-mono">staff1@campus.edu • Pass: staff123</div>
              </div>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail("prof.kaur@thapar.edu");
                setPassword("staff123");
                handleLogin("prof.kaur@thapar.edu", "staff123");
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition"
            >
              <div>
                <div className="text-xs font-semibold text-white">Dr. Simran Kaur</div>
                <div className="text-[10px] text-slate-400 font-mono">prof.kaur@thapar.edu • Pass: staff123</div>
              </div>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">Sign In</span>
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">University Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold transition shadow-sm mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign In to Portal"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white transition">
            ← Back to Campus Directory
          </Link>
        </div>
      </div>
    </div>
  );
}
