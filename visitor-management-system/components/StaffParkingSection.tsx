"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Car,
  CheckCircle2,
  DoorOpen,
  Plus,
  Loader2,
  X,
  AlertCircle,
  QrCode,
  Trash2,
  Copy,
  Check,
  Camera,
  ShieldCheck,
  Building,
  Upload,
  ArrowUpRight,
  Clock,
  Sparkles,
} from "lucide-react";

interface VehicleDTO {
  id: string;
  plateNumber: string;
  stickerColor: string;
  vehicleType: string;
  modelName: string | null;
  isActive: boolean;
  rcDocUrl?: string | null;
  user: {
    name: string;
    department?: string | null;
    facultyId?: string | null;
    parkingEligible: boolean;
    eligibleTill?: string | null;
  };
}

interface ParkingLotDTO {
  id: string;
  name: string;
  code: string;
  zone: string;
  totalCapacity: number;
  occupied: number;
  reservedFaculty: number;
  freeSlots: number;
  occupancyPercentage: number;
}

export default function StaffParkingSection({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [selectedVehicleForQR, setSelectedVehicleForQR] = useState<VehicleDTO | null>(null);
  const [selectedGate, setSelectedGate] = useState("GATE_1");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Add Vehicle form
  const [plateNumber, setPlateNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [vehicleType, setVehicleType] = useState("CAR");
  const [stickerColor, setStickerColor] = useState("green");
  const [rcDocUrl, setRcDocUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [barrierStatus, setBarrierStatus] = useState<string | null>(null);

  // Camera scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Queries
  const vehiclesQuery = useQuery<{ vehicles: VehicleDTO[] }>({
    queryKey: ["myVehicles"],
    queryFn: async () => {
      const res = await fetch("/api/faculty/vehicles");
      if (!res.ok) throw new Error("Failed to load vehicles");
      return res.json();
    },
  });

  const lotsQuery = useQuery<{ lots: ParkingLotDTO[] }>({
    queryKey: ["parkingLots"],
    queryFn: async () => {
      const res = await fetch("/api/faculty/lots");
      if (!res.ok) throw new Error("Failed to load parking lots");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Remote Barrier Open Mutation
  const barrierMutation = useMutation({
    mutationFn: async (gateCode?: string) => {
      const res = await fetch("/api/faculty/barrier/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateCode: gateCode || selectedGate,
          vehiclePlate: vehiclesQuery.data?.vehicles?.[0]?.plateNumber || "PB11BH8820",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger barrier");
      return data;
    },
    onSuccess: () => {
      setBarrierStatus(`Signal dispatched to ${selectedGate.replace("_", " ")}. Barrier open for 12 seconds.`);
      setTimeout(() => setBarrierStatus(null), 6000);
      queryClient.invalidateQueries({ queryKey: ["parkingLots"] });
    },
    onError: (err: any) => {
      setBarrierStatus(`Error: ${err.message}`);
      setTimeout(() => setBarrierStatus(null), 5000);
    },
  });

  // Add Vehicle Mutation
  const addVehicleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/faculty/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add vehicle");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myVehicles"] });
      setShowAddVehicleModal(false);
      setPlateNumber("");
      setModelName("");
      setRcDocUrl(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  // Delete Vehicle Mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const res = await fetch(`/api/faculty/vehicles/${vehicleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete vehicle");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myVehicles"] });
    },
  });

  // Vehicle QR generation
  useEffect(() => {
    if (selectedVehicleForQR) {
      const token = selectedVehicleForQR.plateNumber;
      QRCode.toDataURL(token, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedVehicleForQR]);

  // Camera start/stop
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera hardware interface is unavailable in this environment.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraError("Camera permission was not granted.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const handleScanGateCode = async (gateCode: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/faculty/barrier/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateCode: gateCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gate verification rejected");
      setScanResult(`Success: ${data.message || "Gate barrier unlocked."}`);
      stopCamera();
    } catch (e: any) {
      setScanResult(`Verification Failed: ${e.message || "Invalid QR"}`);
    } finally {
      setScanning(false);
    }
  };

  const vehicles = vehiclesQuery.data?.vehicles || [];
  const lots = lotsQuery.data?.lots || [];
  const userProfile = vehicles[0]?.user;

  return (
    <div className="space-y-6">
      {/* Faculty Permit & Access Management Hero */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800/60">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Permit Active
              </span>
              <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700 font-mono">
                ANPR Fast-Lane
              </span>
            </div>

            <h2 className="mt-2.5 text-xl sm:text-2xl font-bold text-white tracking-tight">
              {userName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-slate-500" />
                {userProfile?.department || "Department of Computer Science"}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">
                {userProfile?.facultyId ? `ID: #${userProfile.facultyId}` : "Faculty Member"}
              </span>
            </div>
          </div>

          <div className="sm:text-right text-xs text-slate-400 sm:border-l sm:border-slate-800 sm:pl-6 pt-3 sm:pt-0 border-t border-slate-800 sm:border-t-0">
            <div className="text-slate-500 font-medium">Clearance Validity</div>
            <div className="text-emerald-400 font-mono font-semibold text-sm mt-0.5">
              {userProfile?.eligibleTill ? new Date(userProfile.eligibleTill).toLocaleDateString() : "Permanent / 2027"}
            </div>
          </div>
        </div>

        {/* Gate Control & Barrier Pulse Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-800/90 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Gate Barrier:</span>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
              {[
                { id: "GATE_1", label: "Gate 1 (Main)" },
                { id: "GATE_2", label: "Gate 2 (Faculty)" },
                { id: "GATE_3", label: "Gate 3 (Hostel)" },
                { id: "GATE_4", label: "Gate 4 (Quarters)" },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGate(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedGate === g.id
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowScannerModal(true);
                startCamera();
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
            >
              <Camera className="h-3.5 w-3.5 text-slate-400" />
              <span>Scan Barrier QR</span>
            </button>

            <button
              onClick={() => barrierMutation.mutate(selectedGate)}
              disabled={barrierMutation.isPending}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {barrierMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DoorOpen className="h-3.5 w-3.5" />
              )}
              <span>1-Tap Open Gate</span>
            </button>

            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-3.5 py-2 text-xs font-bold transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-slate-900" />
              <span>Register Vehicle</span>
            </button>
          </div>
        </div>

        {barrierStatus && (
          <div className="mt-3.5 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-medium text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{barrierStatus}</span>
          </div>
        )}
      </div>

      {/* Live Campus Parking Occupancy Meters */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Campus Parking Availability
            </h3>
            <p className="text-[11px] text-slate-500">Live zone occupancy sync</p>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">10s auto-refresh</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const percent = lot.occupancyPercentage;
            const isFull = percent >= 90;
            const isMedium = percent >= 70 && percent < 90;

            return (
              <div
                key={lot.id}
                className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-sm transition hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 uppercase font-mono border border-slate-700/80">
                      Zone {lot.zone}
                    </span>
                    <h4 className="mt-1 text-sm font-semibold text-white tracking-tight">{lot.name}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400 font-mono">{lot.freeSlots}</div>
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Free Slots</div>
                  </div>
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Occupancy</span>
                    <span className="font-semibold text-slate-200">
                      {lot.occupied} / {lot.totalCapacity} ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull
                          ? "bg-rose-500"
                          : isMedium
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Faculty Registered Vehicles List */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Registered Faculty Vehicles ({vehicles.length})
            </h3>
            <p className="text-[11px] text-slate-500">Configured for Fast-Lane ANPR Gate Barriers</p>
          </div>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
          >
            + Register Vehicle
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
            <Car className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-xs text-slate-400">No vehicles registered under your account.</p>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-3.5 py-2 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5 text-slate-900" /> Register Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {vehicles.map((veh) => {
              const isGreen = veh.stickerColor === "green";
              const isBlue = veh.stickerColor === "blue";

              return (
                <div
                  key={veh.id}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-sm transition hover:border-slate-700 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-base font-bold tracking-wider text-white">
                        {veh.plateNumber}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase font-mono ${
                          isGreen
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                            : isBlue
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-rose-950/60 text-rose-400 border-rose-800/60"
                        }`}
                      >
                        {veh.stickerColor} Tier
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      <span className="font-medium text-slate-300">{veh.modelName || veh.vehicleType}</span>
                    </div>

                    {veh.rcDocUrl && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle2 size={12} />
                        <span>RC Document Verified</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 gap-2">
                    <button
                      onClick={() => setSelectedVehicleForQR(veh)}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition"
                    >
                      <QrCode size={13} className="text-slate-400" />
                      <span>Security Badge</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Remove vehicle ${veh.plateNumber}?`)) {
                          deleteVehicleMutation.mutate(veh.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                      title="Remove Vehicle"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Register Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white tracking-tight">Register Campus Vehicle</h3>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { id: "CAR", label: "Car" },
                    { id: "BIKE", label: "Two-Wheeler" },
                    { id: "EV", label: "Electric EV" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVehicleType(t.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                        vehicleType === t.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">
                  License Plate Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PB11BH8820"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 font-mono focus:border-indigo-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Make, Model &amp; Color</label>
                <input
                  type="text"
                  placeholder="e.g. Honda City (White)"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Sticker Tier</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {["green", "blue", "red"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStickerColor(c)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold uppercase font-mono transition ${
                        stickerColor === c
                          ? "bg-slate-800 text-white border-2 border-indigo-500 shadow-sm"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      {c} Tier
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Vehicle Registration Certificate (RC)</label>
                {rcDocUrl ? (
                  <div className="mt-1 flex items-center justify-between p-2.5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 text-xs text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Document Attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setRcDocUrl(null)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-300 transition">
                    <Upload size={14} />
                    <span>Upload RC Document Scan (JPG/PNG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setRcDocUrl(reader.result as string);
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
                onClick={() => setShowAddVehicleModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addVehicleMutation.isPending || !plateNumber.trim()}
                onClick={() =>
                  addVehicleMutation.mutate({
                    plateNumber: plateNumber.trim(),
                    modelName: modelName.trim() || undefined,
                    vehicleType,
                    stickerColor,
                    rcDocUrl,
                  })
                }
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                {addVehicleMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Vehicle Security Badge QR Modal */}
      {selectedVehicleForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 text-center relative space-y-4">
            <button
              onClick={() => setSelectedVehicleForQR(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                THAPAR UNIVERSITY FAST-LANE
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">Vehicle Security Badge</h3>
            </div>

            <div className="mx-auto flex justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Vehicle QR" className="h-44 w-44 rounded-lg" />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center text-xs text-slate-400">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </div>

            <div className="font-mono text-base font-black text-indigo-700 tracking-wider">
              {selectedVehicleForQR.plateNumber}
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-left text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Owner:</span>
                <span className="font-bold text-slate-900">{userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Model:</span>
                <span className="font-semibold text-slate-800">
                  {selectedVehicleForQR.modelName || selectedVehicleForQR.vehicleType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Permit Tier:</span>
                <span className="font-mono font-bold uppercase text-slate-900">
                  {selectedVehicleForQR.stickerColor} Tier
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedVehicleForQR.plateNumber);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy Plate"}</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`Badge_${selectedVehicleForQR.plateNumber}.png`}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ArrowUpRight size={14} />
                  <span>Download Badge</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Gate Camera Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera size={16} className="text-blue-400" />
                <span>Gate Barrier Camera Scanner</span>
              </h3>
              <button
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {cameraError ? (
              <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300">
                {cameraError}
              </div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-slate-800">
                <video ref={videoRef} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-32 w-32 rounded-lg border-2 border-blue-500/80 shadow-lg" />
                </div>
              </div>
            )}

            {scanResult && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-semibold text-slate-200 text-center">
                {scanResult}
              </div>
            )}

            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Quick Gate Emulators
              </div>
              <div className="grid grid-cols-4 gap-2">
                {["GATE_1", "GATE_2", "GATE_3", "GATE_4"].map((g) => (
                  <button
                    key={g}
                    disabled={scanning}
                    onClick={() => handleScanGateCode(g)}
                    className="py-2 px-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-slate-300 transition"
                  >
                    {g.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
