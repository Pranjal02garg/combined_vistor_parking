"use client";

import React, { useEffect, useRef, useState } from "react";
import { mobileClient } from "@/lib/mobile-client";

export default function FacultyScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [triggeringDirect, setTriggeringDirect] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera access is not supported on this browser.");
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
    } catch (err: any) {
      setCameraError("Camera permission was denied or camera is in use.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const handleScanSubmit = async (payload: string) => {
    if (!payload.trim()) return;
    setScanning(true);
    setResult(null);

    try {
      const res = await mobileClient.scanQr(payload.trim());
      if (res.data?.success) {
        setResult({ success: true, message: res.data.message || "Gate Barrier Triggered Successfully!" });
        setManualCode("");
      } else {
        setResult({ success: false, message: res.error || "QR verification failed. Please try again." });
      }
    } catch (err: any) {
      setResult({ success: false, message: err?.message || "Scan request failed." });
    } finally {
      setScanning(false);
    }
  };

  const handleDirectOpen = async (gate: string) => {
    setTriggeringDirect(true);
    setResult(null);
    try {
      const res = await mobileClient.openBarrier(gate, "Faculty Mobile App Direct Trigger");
      if (res.data?.success) {
        setResult({ success: true, message: `✅ ${gate} Barrier Activated!` });
      } else {
        setResult({ success: false, message: res.error || `Unable to open ${gate}.` });
      }
    } catch (err: any) {
      setResult({ success: false, message: err?.message || "Direct barrier request failed." });
    } finally {
      setTriggeringDirect(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-black text-white">Gate Barrier Access</h2>
        <p className="text-xs text-slate-400">Scan gate QR code or trigger physical barrier</p>
      </div>

      {/* Camera Viewfinder Box */}
      <div className="relative aspect-square max-w-[320px] mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
        />

        {!cameraActive && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center text-xl mx-auto mb-3">
              📷
            </div>
            <p className="text-xs text-slate-300 font-semibold mb-2">Camera Inactive</p>
            <p className="text-[11px] text-slate-500 mb-4">{cameraError || "Camera permission is required to scan booth QR codes."}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md"
            >
              Enable Camera
            </button>
          </div>
        )}

        {/* Viewfinder Target Reticle */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-blue-500/80 rounded-2xl relative animate-pulse">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1 rounded-br" />
            </div>
            <div className="absolute bottom-4 px-3 py-1 bg-slate-950/80 backdrop-blur rounded-full text-[10px] text-white font-medium">
              Align QR Code within the box
            </div>
          </div>
        )}
      </div>

      {/* Result Alert */}
      {result && (
        <div
          className={`p-4 rounded-2xl border text-center text-xs font-semibold shadow-lg animate-fadeIn ${
            result.success
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Direct Barrier Trigger Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          Direct Gate Pulse (1-Tap Override)
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {["Gate 1 (Main)", "Gate 2 (North)", "Gate 3 (Hostel)", "Gate 4 (Faculty)"].map((gateName, i) => (
            <button
              key={i}
              onClick={() => handleDirectOpen(`GATE_${i + 1}`)}
              disabled={triggeringDirect}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <div className="text-[10px] text-slate-500 font-semibold">GATEWAY</div>
              <div className="text-xs font-bold text-white mt-0.5">{gateName}</div>
              <div className="text-[10px] text-emerald-400 font-medium mt-1">● Tap to Open</div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual QR Code Input (Useful for Testing) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Manual QR Session Code (Test / Backup)
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Paste QR payload..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handleScanSubmit(manualCode)}
            disabled={scanning || !manualCode}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl disabled:opacity-50"
          >
            {scanning ? "Verifying..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
