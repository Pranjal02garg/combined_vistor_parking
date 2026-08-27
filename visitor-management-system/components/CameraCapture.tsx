"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, AlertTriangle, Check, RefreshCcw } from "lucide-react";

type Phase = "idle" | "requesting" | "live" | "captured" | "error";

// Keep the encoded selfie small so many records fit within the browser's ~5 MB
// localStorage budget. Without this, a couple of 2–3 MB Base64 blobs blow the
// per-origin cap and freeze the app. (Becomes moot in Phase 2 once selfies are
// uploaded to object storage, but the smaller payload still speeds mobile uploads.)
const MAX_SELFIE_BYTES = 100 * 1024;

// Approximate the decoded byte size of a base64 data URL without allocating a buffer.
function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

interface CameraCaptureProps {
  /** Called with the JPEG data URL (base64) when the visitor takes a photo. */
  onCapture: (base64: string) => void;
  /** Called when a captured photo is discarded (retake). */
  onClear?: () => void;
}

export default function CameraCapture({ onCapture, onClear }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [photo, setPhoto] = useState<string>("");
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [wasLiveBeforeHide, setWasLiveBeforeHide] = useState<boolean>(false);

  // Safely stop all tracks on the stream to turn off the hardware LED & save battery.
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Check for Secure Context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setPhase("error");
      setError("Camera access requires a secure connection (HTTPS or localhost).");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError("Web camera APIs are not supported by this browser.");
      return;
    }

    setPhase("requesting");
    setError("");
    
    try {
      // Ask for a moderate resolution square frame to avoid performance hits on cheap smartphones
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
        setError("Camera permission denied. Please allow camera access in your browser settings and try again.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("No camera device found on this system.");
      } else {
        setError("Could not open camera. Ensure it is not in use by another application.");
      }
    }
  }, [stopStream]);

  // Tab suspension: pause camera access when tab is backgrounded, resume when active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (phase === "live" || phase === "requesting") {
          setWasLiveBeforeHide(true);
          stopStream();
          setPhase("idle");
        }
      } else if (document.visibilityState === "visible") {
        if (wasLiveBeforeHide) {
          setWasLiveBeforeHide(false);
          startCamera();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [phase, wasLiveBeforeHide, stopStream, startCamera]);

  // Initiate camera on mount and clean up on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  // Center-Crop logic: capture only the square visible crop
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || phase !== "live") return;

    // Trigger visual hardware flash effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    
    // We want a square crop matching what the user sees in the square preview container.
    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    // Output dimension: 480×480 keeps the selfie small on mobile; paired with the
    // quality sweep below it holds the payload under ~100 KB (see MAX_SELFIE_BYTES).
    const targetSize = 480;
    canvas.width = targetSize;
    canvas.height = targetSize;

    // Clear canvas
    ctx.clearRect(0, 0, targetSize, targetSize);

    // Apply mirroring transformation so the saved image matches the mirrored user view
    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);

    // Draw the cropped center area of the video frame
    ctx.drawImage(
      video,
      sx,
      sy,
      cropSize,
      cropSize,
      0,
      0,
      targetSize,
      targetSize
    );

    try {
      // Step the JPEG quality down until the payload fits the budget. At 480px, q0.5 is
      // usually ~40–60 KB, so this almost always exits on the first iteration.
      let dataUrl = "";
      for (const quality of [0.5, 0.4, 0.3, 0.25, 0.2]) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (estimateDataUrlBytes(dataUrl) <= MAX_SELFIE_BYTES) break;
      }
      setPhoto(dataUrl);
      setPhase("captured");
      stopStream(); // immediately release hardware stream
      onCapture(dataUrl);
    } catch (err) {
      console.error("Failed to capture picture data:", err);
      setError("Failed to process captured image.");
      setPhase("error");
    }
  }, [phase, onCapture, stopStream]);

  const retake = useCallback(() => {
    setPhoto("");
    onClear?.();
    startCamera();
  }, [onClear, startCamera]);

  return (
    <div className="w-full">
      {/* Outer frame container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-inner">
        
        {/* Video feed */}
        {phase !== "captured" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Selfie preview stream"
            // Mirror the preview so the user feels like they are looking in a mirror
            className="h-full w-full -scale-x-100 object-cover"
          />
        )}

        {/* Captured image display */}
        {phase === "captured" && photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Captured Visitor Selfie"
            className="h-full w-full object-cover transition-all duration-300 animate-fade-in"
          />
        )}

        {/* Loading overlay */}
        {phase === "requesting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-3 z-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-brand-500" />
            <p className="text-sm font-medium text-slate-300">Initializing camera...</p>
          </div>
        )}

        {/* Idle suspension overlay */}
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md gap-3 z-10 text-center px-4">
            <RefreshCcw className="text-slate-500 animate-pulse" size={28} />
            <p className="text-sm font-medium text-slate-300">Camera suspended due to tab inactivity.</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-2 text-xs font-semibold bg-brand-600 text-white px-3 py-1.5 rounded-full hover:bg-brand-500 transition-colors"
            >
              Resume Camera
            </button>
          </div>
        )}

        {/* Error overlay */}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md gap-3 z-10 text-center px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <AlertTriangle size={26} />
            </div>
            <p className="text-sm font-medium text-slate-200 px-2 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={startCamera}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 hover:bg-white text-slate-900 px-5 py-2 text-xs font-semibold transition shadow-md active:scale-95"
            >
              <RefreshCw size={14} className="animate-spin-once" /> Retry Access
            </button>
          </div>
        )}

        {/* Hardware-like camera flash effect */}
        <div
          className={`absolute inset-0 bg-white transition-opacity duration-200 pointer-events-none z-30 ${
            isFlashing ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Saved badge */}
        {phase === "captured" && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-sm px-3.5 py-1 text-xs font-bold text-white shadow-md select-none animate-slide-down">
            <Check size={14} strokeWidth={3} /> Photo Verified
          </div>
        )}

        {/* Secure marker to reassure visitors of data privacy */}
        {phase === "live" && (
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-md bg-slate-950/60 backdrop-blur-sm px-2 py-1 text-[10px] text-slate-300 font-mono select-none">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Preview
          </div>
        )}
      </div>

      {/* Offscreen scratch canvas used for center-cropping the image frame */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Interactive Trigger Button */}
      <div className="mt-5 flex justify-center">
        {phase === "captured" ? (
          <button
            type="button"
            onClick={retake}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 text-sm font-bold shadow-sm active:scale-95 transition"
          >
            <RefreshCw size={16} /> Retake Selfie
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={phase !== "live"}
            aria-label="Capture Selfie Pass Photo"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-slate-100/50 hover:bg-slate-800 transition active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Camera size={26} />
          </button>
        )}
      </div>
    </div>
  );
}
