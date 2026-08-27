"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Lock,
  DoorOpen
} from "lucide-react";

interface ANPREvent {
  id: string;
  plateNumber: string;
  cameraType: string;
  confidence: number | null;
  snapshotUrl: string | null;
  matched: boolean;
  gateName: string;
  gateCode: string;
  driverName: string;
  department: string | null;
  stickerColor: string;
  modelName: string | null;
  createdAt: string;
}

export default function GuardAnprFeed({ activeGateId }: { activeGateId: string | null }) {
  const queryClient = useQueryClient();
  const [searchPlate, setSearchPlate] = useState("");
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);

  const { data, refetch } = useQuery<{ events: ANPREvent[] }>({
    queryKey: ["guardAnprFeed"],
    queryFn: async () => {
      const res = await fetch("/api/guard/anpr");
      if (!res.ok) throw new Error("Failed to load ANPR feed");
      return res.json();
    },
    refetchInterval: 4_000,
  });

  const barrierMutation = useMutation({
    mutationFn: async ({ action, plateNumber }: { action: "OPEN" | "CLOSE"; plateNumber?: string }) => {
      const res = await fetch("/api/guard/barrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateId: activeGateId,
          action,
          reason: "Guard Manual Console Control",
          plateNumber,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to trigger barrier");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOverrideMsg(data.message);
      queryClient.invalidateQueries({ queryKey: ["guardAnprFeed"] });
      setTimeout(() => setOverrideMsg(null), 4000);
    },
  });

  const events = data?.events || [];
  const filteredEvents = searchPlate
    ? events.filter((e) =>
        e.plateNumber.toLowerCase().includes(searchPlate.toLowerCase()) ||
        e.driverName.toLowerCase().includes(searchPlate.toLowerCase())
      )
    : events;

  return (
    <div className="space-y-4">
      {/* Barrier Quick Override Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Gate Barrier Fast-Lane Control
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Camera reads license plates and automates barrier access for verified faculty permits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => barrierMutation.mutate({ action: "OPEN" })}
              disabled={barrierMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
            >
              <DoorOpen className="h-4 w-4" /> Open Barrier
            </button>
            <button
              onClick={() => barrierMutation.mutate({ action: "CLOSE" })}
              disabled={barrierMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </div>

        {overrideMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {overrideMsg}
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search detected plate or driver..."
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none shadow-sm"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Stream
        </button>
      </div>

      {/* ANPR Camera Events Feed */}
      <div className="space-y-2.5">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            <Car className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-xs font-semibold">No recent camera plate detections</p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isGreen = evt.stickerColor === "green";
            const isBlue = evt.stickerColor === "blue";
            const isRed = evt.stickerColor === "red";

            return (
              <div
                key={evt.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm transition ${
                  evt.matched
                    ? "border-slate-200 bg-white hover:border-slate-300"
                    : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                      evt.matched
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <Car className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold tracking-wider text-slate-900">
                        {evt.plateNumber}
                      </span>
                      {evt.matched ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Authorized Faculty
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 border border-amber-200">
                          <AlertCircle className="h-3 w-3" /> Unlisted Vehicle
                        </span>
                      )}

                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isGreen
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isBlue
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : isRed
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {evt.stickerColor}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">{evt.driverName}</span>
                      {evt.department && <span> • {evt.department}</span>}
                      {evt.modelName && <span> • {evt.modelName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <div>{evt.gateName}</div>
                    <div>
                      {new Date(evt.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>

                  {!evt.matched && (
                    <button
                      onClick={() =>
                        barrierMutation.mutate({
                          action: "OPEN",
                          plateNumber: evt.plateNumber,
                        })
                      }
                      className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Allow Entry
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
