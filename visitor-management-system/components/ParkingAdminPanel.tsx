"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  Radio,
  Layers,
  Users,
  History,
  FileSpreadsheet,
  AlertTriangle,
  Trash2,
  SlidersHorizontal,
  X,
  Loader2,
  Calendar,
} from "lucide-react";

interface ParkingStats {
  totalCapacity: number;
  totalOccupied: number;
  totalFree: number;
  occupancyPercentage: number;
  totalRegisteredVehicles: number;
  activeVehicles: number;
  eligibleFacultyCount: number;
  cameraAlarmOn: boolean;
}

interface ParkingLot {
  id: string;
  name: string;
  code: string;
  zone: string;
  totalCapacity: number;
  occupied: number;
  reservedFaculty: number;
  isActive: boolean;
}

interface FacultyVehicle {
  id: string;
  plateNumber: string;
  stickerColor: string;
  vehicleType: string;
  modelName: string | null;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    facultyId: string | null;
    phone: string | null;
    parkingEligible: boolean;
    eligibleFrom: string | null;
    eligibleTill: string | null;
  };
}

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  department: string | null;
  facultyId: string | null;
  phone: string | null;
  parkingEligible: boolean;
  eligibleFrom: string | null;
  eligibleTill: string | null;
  createdAt: string;
  vehicles: Array<{
    id: string;
    plateNumber: string;
    stickerColor: string;
    vehicleType: string;
    modelName: string | null;
    isActive: boolean;
  }>;
}

interface BarrierLog {
  id: string;
  plateNumber: string | null;
  action: string;
  method: string;
  status: string;
  createdAt: string;
  gate?: { name: string; code: string };
  user?: { name: string; email: string };
}

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: any;
  createdAt: string;
  actor: { name: string; email: string };
}

export default function ParkingAdminPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"lots" | "users" | "barrier_logs" | "audit_logs">("lots");
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("ALL");

  // Modals
  const [showLotModal, setShowLotModal] = useState(false);
  const [editingLot, setEditingLot] = useState<ParkingLot | null>(null);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState<ManagedUser | null>(null);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState<{ userId: string; userName: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Lot form
  const [lotName, setLotName] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [lotZone, setLotZone] = useState("SOUTH");
  const [lotCapacity, setLotCapacity] = useState("50");
  const [lotOccupied, setLotOccupied] = useState("0");
  const [lotReserved, setLotReserved] = useState("20");

  // Create User form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDept, setNewUserDept] = useState("Computer Science");
  const [newUserFacultyId, setNewUserFacultyId] = useState("");
  const [newUserPlate, setNewUserPlate] = useState("");
  const [newUserSticker, setNewUserSticker] = useState("green");
  const [newUserVehicleType, setNewUserVehicleType] = useState("CAR");

  // Add Vehicle form
  const [vehPlate, setVehPlate] = useState("");
  const [vehModel, setVehModel] = useState("");
  const [vehSticker, setVehSticker] = useState("green");
  const [vehType, setVehType] = useState("CAR");

  // Import JSON / CSV text
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const { data, refetch, isLoading } = useQuery<{
    stats: ParkingStats;
    lots: ParkingLot[];
    vehicles: FacultyVehicle[];
    users: ManagedUser[];
    barrierLogs: BarrierLog[];
    auditLogs: AuditLogItem[];
  }>({
    queryKey: ["adminParkingData"],
    queryFn: async () => {
      const res = await fetch("/api/admin/parking");
      if (!res.ok) throw new Error("Failed to load parking admin data");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Post Mutation
  const postAction = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminParkingData"] });
    },
  });

  const saveLotMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/parking/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save lot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminParkingData"] });
      setShowLotModal(false);
      setEditingLot(null);
    },
  });

  const openAddLot = () => {
    setEditingLot(null);
    setLotName("");
    setLotCode("");
    setLotZone("SOUTH");
    setLotCapacity("50");
    setLotOccupied("0");
    setLotReserved("20");
    setShowLotModal(true);
  };

  const openEditLot = (lot: ParkingLot) => {
    setEditingLot(lot);
    setLotName(lot.name);
    setLotCode(lot.code);
    setLotZone(lot.zone);
    setLotCapacity(String(lot.totalCapacity));
    setLotOccupied(String(lot.occupied));
    setLotReserved(String(lot.reservedFaculty));
    setShowLotModal(true);
  };

  const handleImportSubmit = () => {
    setImportError(null);
    try {
      let parsed: any[] = [];
      if (importText.trim().startsWith("[")) {
        parsed = JSON.parse(importText);
      } else {
        // Parse simple CSV (plate, email, name, department, sticker)
        const lines = importText.trim().split("\n");
        parsed = lines.map((l) => {
          const parts = l.split(",").map((p) => p.trim());
          return {
            plateNumber: parts[0],
            email: parts[1] || "staff1@campus.edu",
            name: parts[2] || "Faculty Member",
            department: parts[3] || "Academic Department",
            stickerColor: parts[4] || "green",
          };
        });
      }

      if (!parsed.length) throw new Error("No vehicle rows detected to import");

      postAction.mutate(
        { action: "BATCH_IMPORT_EXCEL", items: parsed },
        {
          onSuccess: (res: any) => {
            alert(`✅ ${res.message}`);
            setShowImportModal(false);
            setImportText("");
          },
          onError: (err: any) => setImportError(err.message),
        }
      );
    } catch (e: any) {
      setImportError(e.message || "Invalid JSON or CSV format");
    }
  };

  const stats = data?.stats || {
    totalCapacity: 0,
    totalOccupied: 0,
    totalFree: 0,
    occupancyPercentage: 0,
    totalRegisteredVehicles: 0,
    activeVehicles: 0,
    eligibleFacultyCount: 0,
    cameraAlarmOn: false,
  };

  const filteredUsers = (data?.users || []).filter((u) => {
    const q = searchQuery.toLowerCase();
    const plates = u.vehicles?.map((v) => v.plateNumber).join(" ").toLowerCase() || "";
    const matchesQuery =
      !searchQuery ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      plates.includes(q);

    const matchesColor =
      colorFilter === "ALL" ||
      u.vehicles?.some((v) => v.stickerColor.toLowerCase() === colorFilter.toLowerCase());

    return matchesQuery && (colorFilter === "ALL" ? true : matchesColor);
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Top System Overview & Physical Alarm Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Campus Parking &amp; ANPR Control Center
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Automated gate barrier control, zone capacity allocation, and faculty vehicle permit allowlists.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Manual Camera Physical Alarm Toggle */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  stats.cameraAlarmOn ? "bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse" : "bg-slate-300"
                }`}
              />
              <span className="text-xs font-bold text-slate-700">
                Alarm: {stats.cameraAlarmOn ? "ON" : "OFF"}
              </span>
              <button
                onClick={() =>
                  postAction.mutate({ action: "TOGGLE_MANUAL_ALARM", nextState: !stats.cameraAlarmOn })
                }
                disabled={postAction.isPending}
                className={`ml-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                  stats.cameraAlarmOn
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                Turn {stats.cameraAlarmOn ? "OFF" : "ON"}
              </button>
            </div>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Batch Import
            </button>

            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Sober Metric Tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Capacity</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalCapacity}</span>
              <span className="text-xs text-slate-500">slots</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Available Free</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-600">{stats.totalFree}</span>
              <span className="text-xs text-slate-500">free</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Occupied Slots</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalOccupied}</span>
              <span className="text-xs text-slate-400 font-medium">({stats.occupancyPercentage}%)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registered Vehicles</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalRegisteredVehicles}</span>
              <span className="text-xs text-slate-500">vehicles</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Permit Eligible</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.eligibleFacultyCount}</span>
              <span className="text-xs text-slate-500">faculty</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Navigation Sub-Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("lots")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "lots"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Parking Lots ({data?.lots?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "users"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> User Management &amp; Allowlist ({data?.users?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("barrier_logs")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "barrier_logs"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Radio className="h-3.5 w-3.5" /> Gate Access Logs
          </button>

          <button
            onClick={() => setActiveTab("audit_logs")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "audit_logs"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History className="h-3.5 w-3.5" /> System Audit Trail
          </button>
        </div>

        {activeTab === "lots" && (
          <button
            onClick={openAddLot}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Parking Lot
          </button>
        )}

        {activeTab === "users" && (
          <button
            onClick={() => setShowCreateUserModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Create Managed User
          </button>
        )}
      </div>

      {/* ── TAB 1: PARKING LOTS & ZONES ── */}
      {activeTab === "lots" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.lots || []).map((lot) => {
            const freeSlots = Math.max(0, lot.totalCapacity - lot.occupied);
            const percent = Math.round((lot.occupied / lot.totalCapacity) * 100);
            return (
              <div
                key={lot.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 border border-slate-200">
                      Zone {lot.zone} • {lot.code}
                    </span>
                    <h3 className="mt-2 text-base font-bold text-slate-900">{lot.name}</h3>
                  </div>
                  <button
                    onClick={() => openEditLot(lot)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    title="Edit Parking Lot"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Capacity Progress Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Live Occupancy</span>
                    <span className="font-semibold text-slate-700">
                      {lot.occupied} / {lot.totalCapacity} ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent >= 90
                          ? "bg-rose-500"
                          : percent >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                {/* Details Footer */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-slate-500">Free Slots:</span>
                    <span className="ml-1.5 font-bold text-emerald-600">{freeSlots}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Reserved:</span>
                    <span className="ml-1.5 font-semibold text-slate-700">
                      {lot.reservedFaculty}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 2: USER MANAGEMENT & VEHICLE ALLOWLIST ── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search user by name, email, department, or plate number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">Filter Sticker:</span>
              {["ALL", "GREEN", "BLUE", "RED"].map((col) => (
                <button
                  key={col}
                  onClick={() => setColorFilter(col)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    colorFilter === col
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Registered Vehicles</th>
                  <th className="px-4 py-3.5">Permit Expiry</th>
                  <th className="px-4 py-3.5">Parking Access</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No matching users or vehicles found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div>{u.department || "Academic Faculty"}</div>
                        {u.facultyId && <div className="text-[10px] text-slate-400 font-mono">ID: {u.facultyId}</div>}
                      </td>

                      <td className="px-4 py-3">
                        {u.vehicles && u.vehicles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.vehicles.map((v) => {
                              const stickerBg =
                                v.stickerColor === "green"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : v.stickerColor === "blue"
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : "bg-rose-50 text-rose-700 border-rose-200";

                              return (
                                <div
                                  key={v.id}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-mono ${stickerBg}`}
                                >
                                  <span className="font-bold">{v.plateNumber}</span>
                                  <button
                                    onClick={() =>
                                      postAction.mutate({
                                        action: "UPDATE_VEHICLE",
                                        vehicleId: v.id,
                                        isActive: !v.isActive,
                                      })
                                    }
                                    title={v.isActive ? "Pause vehicle permit" : "Activate vehicle permit"}
                                    className={`text-[9px] font-bold px-1 rounded ${
                                      v.isActive ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {v.isActive ? "ACTIVE" : "PAUSED"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remove vehicle ${v.plateNumber}?`)) {
                                        postAction.mutate({ action: "DELETE_USER_VEHICLE", vehicleId: v.id });
                                      }
                                    }}
                                    className="text-slate-400 hover:text-rose-600"
                                    title="Delete vehicle"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No vehicles registered</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {u.eligibleTill ? new Date(u.eligibleTill).toLocaleDateString() : "Permanent / 2026"}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            postAction.mutate({
                              action: "TOGGLE_USER_PERMIT",
                              userId: u.id,
                              parkingEligible: !u.parkingEligible,
                            })
                          }
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                            u.parkingEligible
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          }`}
                        >
                          {u.parkingEligible ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Granted
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" /> Revoked
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setShowAddVehicleModal({ userId: u.id, userName: u.name })}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                          >
                            + Vehicle
                          </button>
                          <button
                            onClick={() => setShowEditUserModal(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            title="Edit User Details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: BARRIER & ANPR ACCESS LOGS ── */}
      {activeTab === "barrier_logs" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Gate Location</th>
                  <th className="px-4 py-3.5">License Plate</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Driver / Staff Member</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(data?.barrierLogs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {log.gate?.name || "Main Gate 1"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {log.plateNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {log.user?.name || "ANPR Match"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: SYSTEM AUDIT LOGS ── */}
      {activeTab === "audit_logs" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Action Event</th>
                  <th className="px-4 py-3.5">Entity / Target</th>
                  <th className="px-4 py-3.5">Executed By</th>
                  <th className="px-4 py-3.5">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(data?.auditLogs || []).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 border border-slate-200 font-mono">
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{a.entity}</td>
                    <td className="px-4 py-3 text-slate-700">{a.actor?.name || a.actor?.email || "System"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                      {a.details ? JSON.stringify(a.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE MANAGED USER ── */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Create Managed Faculty User</h3>
              <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                postAction.mutate(
                  {
                    action: "CREATE_MANAGED_USER",
                    name: newUserName,
                    email: newUserEmail,
                    department: newUserDept,
                    facultyId: newUserFacultyId,
                    plateNumber: newUserPlate,
                    stickerColor: newUserSticker,
                    vehicleType: newUserVehicleType,
                  },
                  {
                    onSuccess: () => {
                      setShowCreateUserModal(false);
                      setNewUserName("");
                      setNewUserEmail("");
                      setNewUserPlate("");
                    },
                    onError: (err: any) => alert(err.message),
                  }
                );
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Amanpreet Singh"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="prof.aman@thapar.edu"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-900">Vehicle Permit Details (Optional)</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold text-slate-600">License Plate</label>
                    <input
                      type="text"
                      placeholder="e.g. PB11BH9900"
                      value={newUserPlate}
                      onChange={(e) => setNewUserPlate(e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 font-mono focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Sticker Tier</label>
                    <select
                      value={newUserSticker}
                      onChange={(e) => setNewUserSticker(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                    >
                      <option value="green">Green</option>
                      <option value="blue">Blue</option>
                      <option value="red">Red</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postAction.isPending || !newUserName || !newUserEmail}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
                >
                  {postAction.isPending ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD VEHICLE TO USER ── */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Add Vehicle for {showAddVehicleModal.userName}
              </h3>
              <button onClick={() => setShowAddVehicleModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                postAction.mutate(
                  {
                    action: "ADD_USER_VEHICLE",
                    userId: showAddVehicleModal.userId,
                    plateNumber: vehPlate,
                    modelName: vehModel,
                    stickerColor: vehSticker,
                    vehicleType: vehType,
                  },
                  {
                    onSuccess: () => {
                      setShowAddVehicleModal(null);
                      setVehPlate("");
                      setVehModel("");
                    },
                    onError: (err: any) => alert(err.message),
                  }
                );
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700">License Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PB11CD4567"
                  value={vehPlate}
                  onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Vehicle Model &amp; Color</label>
                <input
                  type="text"
                  placeholder="e.g. Hyundai Creta (Silver)"
                  value={vehModel}
                  onChange={(e) => setVehModel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Vehicle Type</label>
                  <select
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="CAR">Car</option>
                    <option value="BIKE">Two-Wheeler</option>
                    <option value="EV">Electric Vehicle (EV)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Sticker Tier</label>
                  <select
                    value={vehSticker}
                    onChange={(e) => setVehSticker(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="green">Green (Full Access)</option>
                    <option value="blue">Blue (Restricted)</option>
                    <option value="red">Red (Warning)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postAction.isPending || !vehPlate}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
                >
                  {postAction.isPending ? "Adding..." : "Add Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT USER ── */}
      {showEditUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Edit User Details</h3>
              <button onClick={() => setShowEditUserModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                postAction.mutate(
                  {
                    action: "UPDATE_USER_DETAILS",
                    userId: showEditUserModal.id,
                    name: showEditUserModal.name,
                    department: showEditUserModal.department,
                    facultyId: showEditUserModal.facultyId,
                    parkingEligible: showEditUserModal.parkingEligible,
                  },
                  {
                    onSuccess: () => setShowEditUserModal(null),
                    onError: (err: any) => alert(err.message),
                  }
                );
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700">Name</label>
                <input
                  type="text"
                  value={showEditUserModal.name}
                  onChange={(e) => setShowEditUserModal({ ...showEditUserModal, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Department</label>
                <input
                  type="text"
                  value={showEditUserModal.department || ""}
                  onChange={(e) => setShowEditUserModal({ ...showEditUserModal, department: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Faculty / Staff ID</label>
                <input
                  type="text"
                  value={showEditUserModal.facultyId || ""}
                  onChange={(e) => setShowEditUserModal({ ...showEditUserModal, facultyId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postAction.isPending}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  {postAction.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: BATCH EXCEL IMPORT ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Batch Vehicle &amp; Permit Import</h3>
                <p className="text-xs text-slate-500">Paste CSV rows or JSON array from your spreadsheet</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {importError && (
              <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {importError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                CSV Format (plateNumber, email, name, department, stickerColor):
              </label>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`PB11BH8820, prof.sharma@thapar.edu, Prof. Rajesh Sharma, Computer Science, green\nHR26DX9900, dr.kaur@thapar.edu, Dr. Simran Kaur, Electrical, blue`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={postAction.isPending || !importText.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
              >
                {postAction.isPending ? "Importing..." : "Process Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT PARKING LOT ── */}
      {showLotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              {editingLot ? "Edit Parking Lot Capacity" : "Add Campus Parking Lot"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Configure zone code, total capacity, and faculty reservations.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Lot Name</label>
                <input
                  type="text"
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  placeholder="e.g. Faculty Lot S4"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Lot Code</label>
                  <input
                    type="text"
                    value={lotCode}
                    onChange={(e) => setLotCode(e.target.value)}
                    placeholder="LOT_S4"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Zone</label>
                  <input
                    type="text"
                    value={lotZone}
                    onChange={(e) => setLotZone(e.target.value)}
                    placeholder="SOUTH"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    value={lotCapacity}
                    onChange={(e) => setLotCapacity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Occupied</label>
                  <input
                    type="number"
                    value={lotOccupied}
                    onChange={(e) => setLotOccupied(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Reserved</label>
                  <input
                    type="number"
                    value={lotReserved}
                    onChange={(e) => setLotReserved(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setShowLotModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveLotMutation.mutate({
                    id: editingLot?.id,
                    name: lotName,
                    code: lotCode,
                    zone: lotZone,
                    totalCapacity: Number(lotCapacity),
                    occupied: Number(lotOccupied),
                    reservedFaculty: Number(lotReserved),
                  })
                }
                disabled={!lotName || !lotCode || saveLotMutation.isPending}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
              >
                {saveLotMutation.isPending ? "Saving..." : "Save Lot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
