"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CircleHelp,
  MessageSquare,
} from "lucide-react";
import { CATEGORY_ICON } from "@/lib/icons";
import * as LucideIcons from "lucide-react";
import { submitVisit, ApiError, requestOtp, verifyOtp, fetchVisitorByPhone, fetchFormConfig, type FormCategoryConfig, type FormFieldConfig } from "@/lib/api";
import CameraCapture from "@/components/CameraCapture";
import QRCode from "qrcode";

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// Renders the reference code as a scannable QR so the guard can scan the visitor in.
function SuccessQR({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(code, { width: 220, margin: 1 })
      .then(setUrl)
      .catch(() => setUrl(""));
  }, [code]);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Entry pass QR code"
      className="mx-auto mt-6 h-44 w-44 rounded-xl border border-slate-200 p-1"
    />
  );
}

interface SubmitResult {
  referenceCode: string;
  status: string;
}

type Step = "category" | "details" | "success";

function getCategoryIcon(iconName: string | null) {
  if (!iconName) return LucideIcons.CircleHelp;
  const legacy = (CATEGORY_ICON as any)[iconName.toLowerCase()];
  if (legacy) return legacy;
  const IconComponent = (LucideIcons as any)[iconName];
  return IconComponent || LucideIcons.CircleHelp;
}

function RegisterForm() {
  const params = useSearchParams();
  const gate = params.get("gate") ?? "1";

  const [step, setStep] = useState<Step>("category");
  const [visitorMode, setVisitorMode] = useState<"new" | "returning">("new");
  const [category, setCategory] = useState<FormCategoryConfig | null>(null);
  const [entryMode, setEntryMode] = useState<"foot" | "vehicle">("foot");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selfie, setSelfie] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  // OTP States — WhatsApp is default, with SMS Master Key available
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [activeSentChannel, setActiveSentChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Load Form Config dynamically from DB
  const { data: configData, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: ["form-config"],
    queryFn: fetchFormConfig,
  });

  const categories = configData?.categories ?? [];

  async function handleSendOtp(channelToUse?: "whatsapp" | "sms") {
    const ch = channelToUse || otpChannel;
    if (!values.phone || values.phone.length !== 10) return;
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await requestOtp(values.phone, ch);
      setOtpSent(true);
      setActiveSentChannel(ch);
      setOtpChannel(ch);
      if (res.devCode) {
        setOtpDevCode(res.devCode);
      }
    } catch (e: any) {
      setOtpError(e.message || "Failed to send OTP code.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!values.phone || !otpCode) return;
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const res = await verifyOtp(values.phone, otpCode);
      setOtpToken(res.otpToken);

      // Frequent visitor lookup
      try {
        const visitor = await fetchVisitorByPhone(values.phone);
        if (visitor) {
          if (visitorMode === "returning") {
            if (!visitor.category) throw new Error("No category found");
            const cat = categories.find((c) => c.key.toLowerCase() === visitor.category?.toLowerCase());
            if (cat) {
              setCategory(cat);
              setValues({
                phone: values.phone,
                name: visitor.name,
                vehicleNumber: visitor.lastVehicleNumber || "",
                ...(visitor.details || {}),
              });
              setSelfie(visitor.selfieUrl || "");
              if (visitor.lastVehicleNumber) setEntryMode("vehicle");
              setStep("details");
            } else {
              setVisitorMode("new");
              setOtpError("Previous category no longer exists. Please register as a new visitor.");
            }
          } else {
            setValues((prev) => ({
              ...prev,
              name: prev.name || visitor.name,
              vehicleNumber: prev.vehicleNumber || visitor.lastVehicleNumber || "",
            }));
            if (visitor.lastVehicleNumber) {
              setEntryMode("vehicle");
            }
          }
        } else if (visitorMode === "returning") {
          setVisitorMode("new");
          setOtpError("No previous visits found for this number. Please select a category.");
        }
      } catch (e) {
        if (visitorMode === "returning") {
          setVisitorMode("new");
          setOtpError("Could not fetch past visits. Please select a category.");
        }
      }
    } catch (e: any) {
      setOtpError(e.message || "Incorrect verification code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  const submitMutation = useMutation({
    mutationFn: submitVisit,
    onSuccess: (data) => {
      setResult(data);
      setStep("success");
    },
  });
  const submitting = submitMutation.isPending;

  function pickCategory(c: FormCategoryConfig) {
    setCategory(c);
    setValues({});
    setSelfie("");
    setErrors({});
    if (c.key.toUpperCase() === "TAXI") {
      setEntryMode("vehicle");
    } else {
      setEntryMode("foot");
    }
    setStep("details");
  }

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (name === "phone") {
      setOtpToken(null);
      setOtpSent(false);
      setOtpCode("");
      setOtpDevCode(null);
      setOtpError(null);
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      category?.fields?.forEach((f) => {
        if (f.requiredWhenField === name) delete next[f.name];
      });
      return next;
    });
  }

  function isRequired(f: FormFieldConfig): boolean {
    if (f.required) return true;
    if (f.requiredWhenField) {
      return (values[f.requiredWhenField] ?? "").trim() === f.requiredWhenValue;
    }
    return false;
  }

  function validate(fields: FormFieldConfig[]): boolean {
    const found: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.name] ?? "").trim();
      if (isRequired(f) && !v) {
        found[f.name] = "Required";
      } else if (v && f.pattern) {
        const src = f.pattern.startsWith("^") ? f.pattern : `^${f.pattern}$`;
        if (!new RegExp(src).test(v)) found[f.name] = "Check the format";
      }
    }
    if (!otpToken) {
      found.otp = "Phone verification is required";
    }
    if (!selfie) found.selfie = "A photo is required";
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || submitting) return;
    if (!validate(category.fields ?? [])) {
      document
        .querySelector("[data-error='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const { name = "", phone = "", ...rest } = values;
    const fields: Record<string, string> = {
      category: category.key.toUpperCase(),
    };
    for (const [key, value] of Object.entries(rest)) {
      if (value.trim()) fields[key] = value.trim();
    }

    submitMutation.mutate({
      entryGate: gate,
      name: name.trim(),
      phone: phone.trim(),
      selfie,
      fields: fields as Record<string, string> & { category: string },
      otpToken: otpToken || undefined,
    });
  }

  function reset() {
    setStep("category");
    setCategory(null);
    setValues({});
    setSelfie("");
    setErrors({});
    setResult(null);
    submitMutation.reset();
    setOtpSending(false);
    setOtpSent(false);
    setOtpVerifying(false);
    setOtpToken(null);
    setOtpCode("");
    setOtpDevCode(null);
    setOtpError(null);
    setVisitorMode("new");
  }

  // ---- Loading / Error States --------------------------------------------
  if (configLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (configError || categories.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <AlertTriangle className="mx-auto text-rose-500 mb-2" size={40} />
        <h1 className="text-base font-bold text-slate-900">System settings loading error</h1>
        <p className="mt-1 text-xs text-slate-500">
          Unable to pull the latest intake form configurations. Please retry or contact administration.
        </p>
      </div>
    );
  }

  // ---- Success -----------------------------------------------------------
  if (step === "success" && result) {
    const isDayPass = category?.key === "DELIVERY" || category?.key === "VENDOR" || category?.key === "DELIVERY_VENDOR" || (result as any).isDayPass;

    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          {isDayPass ? (
            <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wider">
                🛵 24-Hour Multi-Entry Day Pass
              </span>
              <p className="mt-2 text-xs font-semibold text-amber-900">
                {(result as any).reused ? "Active Day Pass Loaded" : "Day Pass Active for Today!"}
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                You do <strong>not</strong> need to fill this form again today. Show this same QR code for all your entries and exits today until midnight.
              </p>
            </div>
          ) : (
            <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
          )}

          <h1 className="mt-2 text-xl font-bold">
            {isDayPass ? "Day Pass QR Ready" : "You're checked in"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Show this QR (or the reference code) to the guard at Gate {gate}.
          </p>

          <SuccessQR code={result.referenceCode} />

          <div className="mt-6 rounded-2xl bg-slate-900 py-5 text-white">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Reference ID
            </p>
            <p className="mt-1 text-3xl font-bold tracking-wider">
              {result.referenceCode}
            </p>
          </div>

          <dl className="mt-5 space-y-2 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Category</dt>
              <dd className="font-medium">{category?.label || "Day Pass Visitor"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pass Validity</dt>
              <dd className="font-medium text-emerald-700">
                {isDayPass ? "Valid All Day (Until 11:59 PM)" : "Single Entry"}
              </dd>
            </div>
          </dl>
        </div>

        <button
          onClick={reset}
          className="mt-5 w-full rounded-2xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-700 active:bg-slate-100"
        >
          Register another visitor
        </button>
      </main>
    );
  }

  // ---- Category picker or Returning Visitor ------------------------------
  if (step === "category") {
    return (
      <main className="mx-auto max-w-md px-5 pb-10 pt-8">
        <header className="mb-6 flex items-center gap-2 text-slate-500">
          <ShieldCheck size={18} className="text-slate-900" />
          <span className="text-sm font-medium">Gate {gate} check-in</span>
        </header>

        <div className="mb-8 flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setVisitorMode("new")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              visitorMode === "new"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            New Visitor
          </button>
          <button
            onClick={() => setVisitorMode("returning")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              visitorMode === "returning"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Returning Visitor
          </button>
        </div>

        {visitorMode === "new" ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Who&apos;s visiting?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose the option that fits you best.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {categories.map((c) => {
                const Icon = getCategoryIcon(c.icon || c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => pickCategory(c)}
                    className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors active:border-slate-400 active:bg-slate-50"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Icon size={22} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold leading-tight">
                        {c.label}
                      </span>
                      {c.description && (
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {c.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Fast Track Entry</h2>
            <p className="text-sm text-slate-500">
              Enter your phone number to automatically pre-fill your details and photo from your last visit.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="fast-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  id="fast-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={values.phone || ""}
                  onChange={(e) => setField("phone", e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>

              {!otpSent && !otpToken && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Delivery Channel (Default: WhatsApp)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOtpChannel("whatsapp")}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                          otpChannel === "whatsapp"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-400"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpChannel("sms")}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                          otpChannel === "sms"
                            ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        SMS
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendOtp(otpChannel)}
                    disabled={otpSending || !values.phone || values.phone.length !== 10}
                    className={`w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all ${
                      otpChannel === "whatsapp"
                        ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                        : "bg-slate-900 hover:bg-slate-800 active:bg-slate-950"
                    }`}
                  >
                    {otpSending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : otpChannel === "whatsapp" ? (
                      <WhatsAppIcon className="w-4 h-4" />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    Send OTP via {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}
                  </button>
                  {otpError && (
                    <p className="text-xs font-medium text-rose-500 mt-1">{otpError}</p>
                  )}
                </div>
              )}

              {otpSent && !otpToken && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      {activeSentChannel === "whatsapp" ? (
                        <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 inline" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-slate-600 inline" />
                      )}
                      Sent code via <strong>{activeSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}</strong> to +91 {values.phone}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="fast-otpCode" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Verification Code
                    </label>
                    <input
                      id="fast-otpCode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit code (e.g. 123456)"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none focus:border-slate-400"
                    />
                    <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Hint: Use master key <strong className="font-mono text-slate-800 font-bold">123456</strong> for instant testing</span>
                    </p>
                  </div>
                  {otpError && (
                    <p className="text-sm font-medium text-rose-500">{otpError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying || otpCode.length < 4}
                      className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white active:bg-slate-800 disabled:opacity-50"
                    >
                      {otpVerifying ? <Loader2 size={16} className="animate-spin" /> : null}
                      Verify & Fetch Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendOtp(activeSentChannel)}
                      disabled={otpSending}
                      className="rounded-xl border border-slate-300 bg-white px-4 h-11 text-sm font-semibold text-slate-700 active:bg-slate-100"
                    >
                      Resend
                    </button>
                  </div>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const nextChannel = activeSentChannel === "whatsapp" ? "sms" : "whatsapp";
                        handleSendOtp(nextChannel);
                      }}
                      disabled={otpSending}
                      className="text-xs font-semibold text-slate-600 hover:text-emerald-700 underline underline-offset-2 disabled:opacity-50"
                    >
                      Didn&apos;t receive on {activeSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}? Send via {activeSentChannel === "whatsapp" ? "SMS" : "WhatsApp"} instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // ---- Details + selfie --------------------------------------------------
  return (
    <main className="mx-auto max-w-md px-5 pb-32 pt-6">
      <button
        onClick={() => setStep("category")}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 active:text-slate-800"
      >
        <ArrowLeft size={16} /> Change category
      </button>

      {category && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-slate-100 p-4 border border-slate-200">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 border border-slate-200">
            {(() => {
              const Icon = getCategoryIcon(category.icon || category.key);
              return <Icon size={20} />;
            })()}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {category.label}
            </p>
            <p className="text-xs text-slate-500">Gate {gate}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {category?.key.toUpperCase() !== "TAXI" && (
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setEntryMode("foot"); setField("vehicleNumber", ""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${entryMode === "foot" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              On Foot
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("vehicle")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${entryMode === "vehicle" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Vehicle
            </button>
          </div>
        )}

        {category?.fields?.filter(f => entryMode === "vehicle" || f.name !== "vehicleNumber").map((field) => (
          <Field
            key={field.name}
            field={field}
            required={isRequired(field)}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            onChange={(v) => setField(field.name, v)}
          />
        ))}

        {/* Phone OTP Verification */}
        <div data-error={Boolean(errors.otp)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Phone Verification</h3>
            {otpToken && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Verified
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Verify your phone number via WhatsApp or SMS to proceed.
          </p>

          {!otpSent && !otpToken && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Delivery Channel (Default: WhatsApp)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpChannel("whatsapp")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      otpChannel === "whatsapp"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-400"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpChannel("sms")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      otpChannel === "sms"
                        ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    SMS
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSendOtp(otpChannel)}
                disabled={otpSending || !values.phone || values.phone.length !== 10}
                className={`w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all ${
                  otpChannel === "whatsapp"
                    ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                    : "bg-slate-900 hover:bg-slate-800 active:bg-slate-950"
                }`}
              >
                {otpSending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : otpChannel === "whatsapp" ? (
                  <WhatsAppIcon className="w-4 h-4" />
                ) : (
                  <MessageSquare size={16} />
                )}
                Send OTP via {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}
              </button>
              {otpError && (
                <p className="text-xs font-medium text-rose-500 mt-1">{otpError}</p>
              )}
            </div>
          )}

          {otpSent && !otpToken && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
                <span className="flex items-center gap-1.5 font-medium">
                  {activeSentChannel === "whatsapp" ? (
                    <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 inline" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-slate-600 inline" />
                  )}
                  Sent code via <strong>{activeSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}</strong> to +91 {values.phone}
                </span>
              </div>

              <div>
                <label htmlFor="otpCode" className="block text-xs font-medium text-slate-600 mb-1">
                  Enter Verification Code
                </label>
                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Hint: Use master key <strong className="font-mono text-slate-800 font-bold">123456</strong> for instant testing</span>
                </p>
              </div>
              {otpError && (
                <p className="text-xs font-medium text-rose-500">{otpError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || otpCode.length < 4}
                  className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white active:bg-slate-800 disabled:opacity-50"
                >
                  {otpVerifying ? <Loader2 size={16} className="animate-spin" /> : null}
                  Verify Code
                </button>
                <button
                  type="button"
                  onClick={() => handleSendOtp(activeSentChannel)}
                  disabled={otpSending}
                  className="rounded-xl border border-slate-300 bg-white px-4 h-11 text-sm font-semibold text-slate-700 active:bg-slate-100"
                >
                  Resend
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextChannel = activeSentChannel === "whatsapp" ? "sms" : "whatsapp";
                    handleSendOtp(nextChannel);
                  }}
                  disabled={otpSending}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-700 underline underline-offset-2 disabled:opacity-50"
                >
                  Didn&apos;t receive on {activeSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}? Send via {activeSentChannel === "whatsapp" ? "SMS" : "WhatsApp"} instead
                </button>
              </div>
            </div>
          )}

          {otpToken && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2.5 rounded-xl border border-emerald-200 text-sm font-semibold">
              <CheckCircle2 size={18} className="text-emerald-500" /> Phone number verified via {activeSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}!
            </div>
          )}
          
          {errors.otp && (
            <p className="text-xs font-medium text-rose-500">{errors.otp}</p>
          )}
        </div>

        {/* Selfie */}
        <div data-error={Boolean(errors.selfie)}>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Live Photo <span className="text-rose-500">*</span>
          </label>
          <CameraCapture
            onCapture={(b64) => {
              setSelfie(b64);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.selfie;
                return next;
              });
            }}
            onClear={() => setSelfie("")}
          />
          {errors.selfie && (
            <p className="mt-1.5 text-xs font-medium text-rose-500">
              {errors.selfie}
            </p>
          )}
        </div>
      </form>

      {/* Sticky submit bar keeps the primary action in thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {submitMutation.isError && (
            <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertTriangle size={14} />
              {submitMutation.error instanceof ApiError
                ? submitMutation.error.message
                : "Couldn't submit. Check your connection and try again."}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition active:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Submit check-in <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// A single dynamic input driven by its FormField config.
function Field({
  field,
  required,
  value,
  error,
  onChange,
}: {
  field: FormFieldConfig;
  required: boolean;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full rounded-xl border bg-white px-4 py-3.5 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 " +
    (error ? "border-rose-400" : "border-slate-300");

  const optionsList = Array.isArray(field.options) ? field.options : [];

  return (
    <div data-error={Boolean(error)}>
      <label
        htmlFor={field.name}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {field.label}
        {required ? (
          <span className="text-rose-500"> *</span>
        ) : field.requiredWhenField ? (
          <span className="ml-1 text-xs font-normal text-slate-400">
            (optional)
          </span>
        ) : null}
      </label>

      {field.type === "select" ? (
        <select
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base + (value ? "" : " text-slate-400")}
        >
          <option value="">Select…</option>
          {optionsList.map((opt: any) => {
            const optVal = typeof opt === "object" ? opt.value : opt;
            const optLbl = typeof opt === "object" ? opt.label : opt;
            return (
              <option key={optVal} value={optVal} className="text-slate-900">
                {optLbl}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          id={field.name}
          type={field.type}
          inputMode={
            field.type === "tel" || field.type === "number"
              ? "numeric"
              : "text"
          }
          value={value}
          maxLength={field.maxLength ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
