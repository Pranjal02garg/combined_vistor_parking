"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, AlertTriangle, Check, Upload, Sparkles } from "lucide-react";

type Phase = "idle" | "requesting" | "live" | "captured" | "error";

const MAX_SELFIE_BYTES = 100 * 1024;

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClear?: () => void;
}

// Sample fallback portrait avatar for testing when camera is unavailable
const SAMPLE_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export default function CameraCapture({ onCapture, onClear }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [photo, setPhoto] = useState<string>("");
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [wasLiveBeforeHide, setWasLiveBeforeHide] = useState<boolean>(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError("Web camera APIs are not available in this browser.");
      return;
    }

    setPhase("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: { ideal: 1.0 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPhase("live");
    } catch (err: any) {
      stopStream();
      setPhase("error");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Camera permission denied. Allow camera access or upload a photo below.");
      } else {
        setError("Could not open webcam. You can upload a photo or use a sample portrait.");
      }
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || phase !== "live") return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    const targetSize = 480;
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.clearRect(0, 0, targetSize, targetSize);
    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    setPhoto(dataUrl);
    setPhase("captured");
    stopStream();
    onCapture(dataUrl);
  }, [phase, stopStream, onCapture]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPhoto(dataUrl);
        setPhase("captured");
        stopStream();
        onCapture(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const useSamplePhoto = () => {
    setPhoto(SAMPLE_PHOTO);
    setPhase("captured");
    stopStream();
    onCapture(SAMPLE_PHOTO);
  };

  const retake = () => {
    setPhoto("");
    setPhase("idle");
    onClear?.();
    startCamera();
  };

  return (
    <div className="flex flex-col items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="relative h-64 w-64 overflow-hidden rounded-3xl border-2 border-slate-700 bg-slate-950 shadow-xl">
        {phase === "captured" && photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Visitor Selfie" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${phase === "live" ? "scale-x-[-1]" : "opacity-0"}`}
          />
        )}

        {phase === "requesting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
            <p className="text-xs text-slate-300">Initializing camera...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 text-center">
            <AlertTriangle className="h-7 w-7 text-amber-400 mb-1" />
            <p className="text-xs text-slate-300 leading-tight mb-3">{error}</p>
            <div className="flex flex-col gap-1.5 w-full px-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow-md"
              >
                <Upload size={13} /> Upload Photo
              </button>
              <button
                type="button"
                onClick={useSamplePhoto}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
              >
                <Sparkles size={12} /> Use Demo Photo
              </button>
            </div>
          </div>
        )}

        {phase === "captured" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-sm px-3 py-0.5 text-xs font-bold text-white shadow-md">
            <Check size={13} /> Photo Verified
          </div>
        )}

        <div
          className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 ${
            isFlashing ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Action Buttons */}
      <div className="mt-4 flex items-center gap-3">
        {phase === "captured" ? (
          <button
            type="button"
            onClick={retake}
            className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-700 shadow-sm"
          >
            <RefreshCw size={13} /> Retake Selfie
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={capture}
              disabled={phase !== "live"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-blue-600/30 hover:bg-blue-500 disabled:opacity-40 transition active:scale-95"
            >
              <Camera size={24} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <Upload size={13} /> Upload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
