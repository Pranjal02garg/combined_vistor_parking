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
  Layers,
  ShieldCheck,
} from "lucide-react";

interface VehicleDTO {
  id: string;
  plateNumber: string;
  stickerColor: string;
  vehicleType: string;
  modelName: string | null;
  isActive: boolean;
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
    onSuccess: (data) => {
      setBarrierStatus(`✅ Barrier signal sent to ${selectedGate}! Barrier opening for 12 seconds.`);
      setTimeout(() => setBarrierStatus(null), 6000);
      queryClient.invalidateQueries({ queryKey: ["parkingLots"] });
    },
    onError: (err: any) => {
      setBarrierStatus(`❌ Error: ${err.message}`);
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
      const qrPayload = JSON.stringify({
        type: "FACULTY_VEHICLE",
        plate: selectedVehicleForQR.plateNumber,
        owner: userName,
        sticker: selectedVehicleForQR.stickerColor,
      });
      QRCode.toDataURL(qrPayload, { width: 280, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedVehicleForQR, userName]);

  // Camera start/stop
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera is not supported on this browser.");
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
      setCameraError("Camera permission denied or camera in use.");
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
      if (!res.ok) throw new Error(data.error || "Gate QR verification failed");
      setScanResult(`✅ ${data.message || "Gate barrier triggered successfully!"}`);
      stopCamera();
    } catch (e: any) {
      setScanResult(`❌ ${e.message || "QR verification failed"}`);
    } finally {
      setScanning(false);
    }
  };

  const vehicles = vehiclesQuery.data?.vehicles || [];
  const lots = lotsQuery.data?.lots || [];
  const userProfile = vehicles[0]?.user;

  return (
    <div className="space-y-6">
      {/* Faculty Profile & Permit Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" /> Permit Active
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700 font-mono">
                ANPR Fast-Lane
              </span>
            </div>

            <h2 className="mt-2 text-lg sm:text-xl font-bold text-white tracking-tight">
              {userName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              🏢 {userProfile?.department || "Department of Computer Science"} • {userProfile?.facultyId ? `Faculty ID: #${userProfile.facultyId}` : "Faculty Permit"}
            </p>
          </div>

          <div className="text-right text-xs text-slate-400 border-l border-slate-800 pl-4">
            <div className="font-semibold text-slate-300">Permit Validity</div>
            <div className="text-emerald-400 font-mono font-bold mt-0.5">
              {userProfile?.eligibleTill ? new Date(userProfile.eligibleTill).toLocaleDateString() : "Permanent / 2027"}
            </div>
          </div>
        </div>

        {/* Quick Gate Actions Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Select Gate:</label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
            >
              <option value="GATE_1">Gate 1 (Main Entrance)</option>
              <option value="GATE_2">Gate 2 (South Academic)</option>
              <option value="GATE_3">Gate 3 (Hostel &amp; Sports)</option>
              <option value="GATE_4">Gate 4 (Faculty Quarters)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowScannerModal(true);
                startCamera();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition shadow-sm"
            >
              <Camera className="h-3.5 w-3.5 text-slate-400" /> Scan Gate QR
            </button>

            <button
              onClick={() => barrierMutation.mutate(selectedGate)}
              disabled={barrierMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {barrierMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DoorOpen className="h-3.5 w-3.5" />
              )}
              Open Barrier
            </button>

            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-3.5 py-2 text-xs font-bold transition"
            >
              <Plus className="h-3.5 w-3.5" /> Register Vehicle
            </button>
          </div>
        </div>

        {barrierStatus && (
          <div className="mt-3 rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-semibold text-slate-200">
            {barrierStatus}
          </div>
        )}
      </div>

      {/* My Registered Vehicles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            My Registered Vehicles ({vehicles.length})
          </h3>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="text-xs font-semibold text-slate-300 hover:text-white"
          >
            + Add Another Vehicle
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
            <Car className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-xs text-slate-400">No vehicles registered under your faculty account.</p>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-3.5 py-2 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> Register Your Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {vehicles.map((veh) => {
              const stickerBg =
                veh.stickerColor === "green"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : veh.stickerColor === "blue"
                  ? "bg-slate-800 text-slate-300 border-slate-700"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20";

              return (
                <div
                  key={veh.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm transition hover:border-slate-700"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-base font-bold tracking-wider text-white">
                      {veh.plateNumber}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${stickerBg}`}
                    >
                      {veh.stickerColor} Sticker
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    <span className="font-medium text-slate-300">{veh.modelName || veh.vehicleType}</span>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5 gap-2">
                    <button
                      onClick={() => setSelectedVehicleForQR(veh)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 transition"
                    >
                      <QrCode size={13} />
                      <span>Security Badge</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Remove vehicle ${veh.plateNumber}?`)) {
                          deleteVehicleMutation.mutate(veh.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                      title="Remove Vehicle"
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

      {/* Live Campus Parking Lots Meter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Campus Parking Availability
          </h3>
          <span className="text-xs text-slate-500">Live 10s sync</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {lots.map((lot) => {
            const percent = lot.occupancyPercentage;
            return (
              <div
                key={lot.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 uppercase border border-slate-700">
                      Zone {lot.zone}
                    </span>
                    <h4 className="mt-1 text-sm font-bold text-white">{lot.name}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-emerald-400">{lot.freeSlots}</div>
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Free Slots</div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Occupancy</span>
                    <span className="font-semibold text-slate-300">
                      {lot.occupied} / {lot.totalCapacity} ({percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Add Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Car className="h-4 w-4 text-slate-400" /> Register Vehicle
              </h3>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  License Plate Number *
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. PB11BH8820"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs uppercase text-white focus:border-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Vehicle Model &amp; Color</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. Honda City (White)"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-slate-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-slate-600 focus:outline-none"
                  >
                    <option value="CAR">Car</option>
                    <option value="BIKE">Two-Wheeler / Bike</option>
                    <option value="EV">Electric Vehicle (EV)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Sticker Tier</label>
                  <select
                    value={stickerColor}
                    onChange={(e) => setStickerColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-slate-600 focus:outline-none"
                  >
                    <option value="green">Green (Full Access)</option>
                    <option value="blue">Blue (Zone Restricted)</option>
                    <option value="red">Red (Warning)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  addVehicleMutation.mutate({
                    plateNumber,
                    modelName,
                    vehicleType,
                    stickerColor,
                  })
                }
                disabled={!plateNumber || addVehicleMutation.isPending}
                className="rounded-xl bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-50 transition"
              >
                {addVehicleMutation.isPending ? "Registering..." : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Scan Gate QR */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="h-4 w-4" /> Scan Physical Gate QR
              </h3>
              <button
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Point your camera at the QR code posted at the gate booth to trigger the barrier.
            </p>

            <div className="relative aspect-square max-w-[260px] mx-auto bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden mb-3 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {!cameraActive && (
                <div className="text-xs text-slate-500 p-4">
                  {cameraError || "Camera inactive. Enter gate code below."}
                </div>
              )}
            </div>

            {scanResult && (
              <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200">
                {scanResult}
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {["GATE_1", "GATE_2", "GATE_3", "GATE_4"].map((g) => (
                <button
                  key={g}
                  onClick={() => handleScanGateCode(g)}
                  disabled={scanning}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 font-mono transition"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vehicle Security Badge QR */}
      {selectedVehicleForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Vehicle Digital Security Badge</h3>
              <button onClick={() => setSelectedVehicleForQR(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Vehicle QR" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-800" size={28} />
                </div>
              )}
            </div>

            <div className="font-mono text-base font-bold text-white">
              {selectedVehicleForQR.plateNumber}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{selectedVehicleForQR.modelName || selectedVehicleForQR.vehicleType}</p>
            <p className="text-[11px] text-slate-500 mt-1">Authorized Faculty Permit • Gate Fast-Lane Pass</p>

            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedVehicleForQR.plateNumber);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="mt-4 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Copied Plate!" : "Copy License Plate"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
