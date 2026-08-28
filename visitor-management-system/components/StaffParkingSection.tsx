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
  Radio,
  FileCheck,
  Key,
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
        width: 360,
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
    <div className="space-y-8">
      {/* 1. Large Commanding Faculty Permit Hero Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 md:p-10 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3.5 py-1 text-sm font-bold text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
                Permit Active
              </span>
              <span className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 border border-slate-700 font-mono tracking-wide">
                Fast-Lane ANPR Clearance
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {userName}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Building className="h-4 w-4 text-blue-400" />
                {userProfile?.department || "Department of Computer Science"}
              </span>
              <span className="text-slate-600 font-bold">•</span>
              <span className="font-mono text-slate-300 font-medium">
                {userProfile?.facultyId ? `Faculty ID: #${userProfile.facultyId}` : "Faculty Member"}
              </span>
            </div>
          </div>

          <div className="md:text-right border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8 space-y-1">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-400">Clearance Status</div>
            <div className="text-emerald-400 font-mono font-bold text-base sm:text-lg">
              {userProfile?.eligibleTill ? new Date(userProfile.eligibleTill).toLocaleDateString() : "Permanent Access / 2027"}
            </div>
            <div className="text-xs text-slate-500 font-medium">Auto-Renewed Annually</div>
          </div>
        </div>

        {/* Gate Selection & Large Remote Barrier Pulse Button */}
        <div className="mt-8 pt-6 border-t border-slate-800/90 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">
              Select Gate Barrier Post
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                { id: "GATE_1", label: "Gate 1 (Main Entrance)" },
                { id: "GATE_2", label: "Gate 2 (South Academic)" },
                { id: "GATE_3", label: "Gate 3 (Hostel & Sports)" },
                { id: "GATE_4", label: "Gate 4 (Faculty Quarters)" },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGate(g.id)}
                  className={`py-3 px-3.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center text-center ${
                    selectedGate === g.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-400/30"
                      : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={() => barrierMutation.mutate(selectedGate)}
              disabled={barrierMutation.isPending}
              className="flex-1 py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 transition active:scale-[0.98] disabled:opacity-50"
            >
              {barrierMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <DoorOpen className="h-5 w-5" />
              )}
              <span>1-Tap Remote Open ({selectedGate.replace("_", " ")})</span>
            </button>

            <button
              onClick={() => {
                setShowScannerModal(true);
                startCamera();
              }}
              className="py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <Camera className="h-4 w-4 text-slate-400" />
              <span>Scan Barrier QR</span>
            </button>

            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="py-4 px-5 rounded-2xl bg-slate-100 hover:bg-white text-slate-950 text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Plus className="h-4 w-4 text-slate-950" />
              <span>+ Register Vehicle</span>
            </button>
          </div>

          {barrierStatus && (
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-sm font-semibold text-slate-200 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>{barrierStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Live Campus Parking Occupancy Meters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Campus Parking Zone Availability
            </h3>
            <p className="text-xs text-slate-400">Live 10-second occupancy meter sync</p>
          </div>
          <span className="text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
            Live Automated Sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lots.map((lot) => {
            const percent = lot.occupancyPercentage;
            const isFull = percent >= 90;
            const isMedium = percent >= 70 && percent < 90;

            return (
              <div
                key={lot.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-md transition hover:border-slate-700 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 uppercase font-mono border border-slate-700">
                        Zone {lot.zone}
                      </span>
                      <h4 className="mt-2 text-base font-bold text-white tracking-tight">{lot.name}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-400 font-mono">{lot.freeSlots}</div>
                      <div className="text-xs uppercase font-bold text-slate-500">Free Slots</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Occupied Capacity</span>
                      <span className="font-bold text-slate-200">
                        {lot.occupied} / {lot.totalCapacity} ({percent}%)
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull ? "bg-rose-500" : isMedium ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Reserved Faculty Bays</span>
                  <span className="font-bold text-slate-200">{lot.reservedFaculty} Spots</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Registered Faculty Vehicles List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              My Registered Vehicles ({vehicles.length})
            </h3>
            <p className="text-xs text-slate-400">Linked to Faculty Profile for Fast-Lane ANPR auto-entry</p>
          </div>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="text-xs sm:text-sm font-bold text-blue-400 hover:text-blue-300 transition"
          >
            + Register New Vehicle
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
            <Car className="mx-auto h-12 w-12 text-slate-600" />
            <h4 className="text-base font-bold text-white">No Vehicles Registered</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your license plate for Fast-Lane ANPR automated gate barrier entry.
            </p>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-slate-100 hover:bg-white text-slate-950 px-5 py-3 text-sm font-bold transition shadow-sm"
            >
              <Plus size={16} /> Register First Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((veh) => {
              const isGreen = veh.stickerColor === "green";
              const isBlue = veh.stickerColor === "blue";

              return (
                <div
                  key={veh.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-md transition hover:border-slate-700 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-lg font-black tracking-wider text-white">
                        {veh.plateNumber}
                      </span>
                      <span
                        className={`rounded-xl border px-3 py-1 text-xs font-bold uppercase font-mono ${
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

                    <div className="text-sm text-slate-300 font-medium">
                      {veh.modelName || veh.vehicleType}
                    </div>

                    {veh.rcDocUrl && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-1">
                        <FileCheck size={14} />
                        <span>RC Document Attached</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedVehicleForQR(veh)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
                    >
                      <QrCode size={16} className="text-blue-400" />
                      <span>Security Badge</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Remove vehicle ${veh.plateNumber}?`)) {
                          deleteVehicleMutation.mutate(veh.id);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                      title="Remove Vehicle"
                    >
                      <Trash2 size={16} />
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
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white tracking-tight">Register Campus Vehicle</h3>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="rounded-2xl bg-rose-950/60 border border-rose-800/60 p-4 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-slate-400">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                  {[
                    { id: "CAR", label: "Car" },
                    { id: "BIKE", label: "Two-Wheeler" },
                    { id: "EV", label: "Electric EV" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVehicleType(t.id)}
                      className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold transition ${
                        vehicleType === t.id
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  License Plate Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PB11BH8820"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-600 font-mono font-bold focus:border-blue-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-slate-400">Make, Model &amp; Color</label>
                <input
                  type="text"
                  placeholder="e.g. Honda City (White)"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-slate-400">Sticker Tier</label>
                <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                  {["green", "blue", "red"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStickerColor(c)}
                      className={`py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-bold uppercase font-mono transition ${
                        stickerColor === c
                          ? "bg-slate-800 text-white border-2 border-blue-500 shadow-md"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      {c} Tier
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Vehicle Registration Certificate (RC)
                </label>
                {rcDocUrl ? (
                  <div className="mt-1.5 flex items-center justify-between p-3.5 rounded-2xl border border-emerald-800/60 bg-emerald-950/40 text-xs sm:text-sm text-emerald-300">
                    <span className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} /> RC Document Attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setRcDocUrl(null)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs sm:text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition">
                    <Upload size={16} />
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

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                className="rounded-2xl px-5 py-3 text-sm font-bold text-slate-400 hover:text-white"
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
                className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition disabled:opacity-50"
              >
                {addVehicleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Vehicle Security Badge QR Modal (Large & High-Contrast) */}
      {selectedVehicleForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-slate-900 text-center relative space-y-5">
            <button
              onClick={() => setSelectedVehicleForQR(null)}
              className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>

            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
                THAPAR UNIVERSITY SECURITY
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-1">Vehicle Security Badge</h3>
            </div>

            <div className="mx-auto flex justify-center bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Vehicle QR" className="h-56 w-56 rounded-2xl" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center text-sm text-slate-400">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
            </div>

            <div className="font-mono text-2xl font-black text-blue-700 tracking-wider">
              {selectedVehicleForQR.plateNumber}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-left text-sm space-y-2 border border-slate-100 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Faculty Owner:</span>
                <span className="font-bold text-slate-900">{userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle Model:</span>
                <span className="font-bold text-slate-800">
                  {selectedVehicleForQR.modelName || selectedVehicleForQR.vehicleType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Permit Tier:</span>
                <span className="font-mono font-bold uppercase text-slate-900">
                  {selectedVehicleForQR.stickerColor} Tier
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedVehicleForQR.plateNumber);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy Plate"}</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`Badge_${selectedVehicleForQR.plateNumber}.png`}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition shadow-md"
                >
                  <ArrowUpRight size={16} />
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
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Camera size={18} className="text-blue-400" />
                <span>Gate Barrier Camera Scanner</span>
              </h3>
              <button
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {cameraError ? (
              <div className="rounded-2xl bg-rose-950/60 border border-rose-800/60 p-4 text-sm text-rose-300">
                {cameraError}
              </div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-inner">
                <video ref={videoRef} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-36 w-36 rounded-2xl border-2 border-blue-500/80 shadow-2xl" />
                </div>
              </div>
            )}

            {scanResult && (
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-sm font-bold text-slate-200 text-center">
                {scanResult}
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2.5">
                Quick Gate Emulators
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {["GATE_1", "GATE_2", "GATE_3", "GATE_4"].map((g) => (
                  <button
                    key={g}
                    disabled={scanning}
                    onClick={() => handleScanGateCode(g)}
                    className="py-3 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-mono font-bold text-slate-300 transition"
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
