"use client";

import React, { useEffect, useState } from "react";
import { mobileClient, AllowedCar } from "@/lib/mobile-client";

export default function FacultyVehiclesPage() {
  const [cars, setCars] = useState<AllowedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingPlate, setDeletingPlate] = useState<string | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [stickerColor, setStickerColor] = useState<"green" | "red" | "blue">("green");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCars = async () => {
    setLoading(true);
    const res = await mobileClient.getCars();
    if (res.data?.cars) {
      setCars(res.data.cars);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const handlePlateChange = (val: string) => {
    // Force uppercase and remove spaces
    const clean = val.toUpperCase().replace(/\s+/g, "").trim();
    setNewPlate(clean);
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    // Format validation: e.g. PB10AB1234
    const plateRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
    if (!plateRegex.test(newPlate)) {
      setFormError("Invalid license plate format. Example: PB10AB1234 or HR26DQ5510");
      return;
    }

    setAdding(true);
    try {
      const res = await mobileClient.addCar(newPlate, stickerColor);
      if (res.error) {
        setFormError(res.error);
      } else {
        setSuccessMsg(`✅ Vehicle ${newPlate} registered and synced with ANPR cameras!`);
        setNewPlate("");
        setShowAddForm(false);
        await fetchCars();
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to add vehicle.");
    } finally {
      setAdding(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const handleDeleteCar = async (plateNumber: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${plateNumber}? It will be removed from camera fast-lane.`)) {
      return;
    }

    setDeletingPlate(plateNumber);
    try {
      const res = await mobileClient.deleteCar(plateNumber);
      if (res.error) {
        alert(res.error);
      } else {
        setSuccessMsg(`Vehicle ${plateNumber} removed.`);
        await fetchCars();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete car.");
    } finally {
      setDeletingPlate(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const getStickerDetails = (color: string) => {
    switch (color?.toLowerCase()) {
      case "green":
        return { name: "Green Sticker (S4)", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" };
      case "red":
        return { name: "Red Sticker (S4)", badge: "bg-rose-500/20 text-rose-300 border-rose-500/30", dot: "bg-rose-400" };
      case "blue":
        return { name: "Blue Sticker (E4)", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30", dot: "bg-blue-400" };
      default:
        return { name: "Standard Sticker", badge: "bg-slate-700 text-slate-300 border-slate-600", dot: "bg-slate-400" };
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Registered Vehicles</h2>
          <p className="text-xs text-slate-400">Manage plates linked to your gate permit</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>+ Add Plate</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl animate-fadeIn shadow-sm">
          {successMsg}
        </div>
      )}

      {/* Add Vehicle Form Drawer / Card */}
      {showAddForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-xl animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Register New Vehicle</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Cancel
            </button>
          </div>

          <form onSubmit={handleAddCar} className="space-y-4">
            {formError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                License Plate Number
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={newPlate}
                onChange={(e) => handlePlateChange(e.target.value)}
                placeholder="e.g. PB10AB1234"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-wider font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Standard Indian format without spaces (State code + 2 digits + 1-2 letters + 4 digits).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Campus Parking Sticker Zone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { color: "green", label: "Green S4", desc: "Senior Faculty" },
                  { color: "red", label: "Red S4", desc: "Admin / VIP" },
                  { color: "blue", label: "Blue E4", desc: "Staff / General" },
                ].map((item) => {
                  const active = stickerColor === item.color;
                  return (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => setStickerColor(item.color as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        active
                          ? "bg-blue-600/20 border-blue-500 text-white shadow-sm"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={adding || !newPlate}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding ? "Syncing with Cameras..." : "Register & Enable Fast-Lane"}
            </button>
          </form>
        </div>
      )}

      {/* Vehicle List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
            Loading vehicle permit records...
          </div>
        ) : cars.length === 0 ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <div className="text-3xl mb-2">🚗</div>
            <p className="text-sm text-slate-300 font-bold">No Vehicles Registered</p>
            <p className="text-xs text-slate-500 mt-1">
              Add your vehicle registration number to allow the gate cameras to open the barrier automatically.
            </p>
          </div>
        ) : (
          cars.map((car, idx) => {
            const sticker = getStickerDetails(car.stickerColor);
            const isDeleting = deletingPlate === car.plateNumber;
            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
                    🚘
                  </div>
                  <div>
                    <div className="font-mono font-black text-base text-white tracking-wider">
                      {car.plateNumber}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sticker.badge}`}>
                        {sticker.name}
                      </span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ANPR Active
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteCar(car.plateNumber)}
                  disabled={isDeleting}
                  className="w-9 h-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center justify-center transition-all disabled:opacity-50"
                  title="Remove vehicle"
                >
                  {isDeleting ? "..." : "🗑️"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Info Card */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 text-[11px] text-slate-400 space-y-1.5">
        <p className="font-semibold text-slate-300">💡 How ANPR Fast-Lane Works:</p>
        <p>
          1. As you approach Gate 1, 2, or 3, the AI camera scans your license plate.
        </p>
        <p>
          2. The barrier lifts automatically within 1.5 seconds without scanning your ID card.
        </p>
      </div>
    </div>
  );
}
