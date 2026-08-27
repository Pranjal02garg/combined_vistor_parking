import { prisma } from "@/lib/server/prisma";
import QRCode from "qrcode";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import PassShareActions from "./PassShareActions";

export const dynamic = "force-dynamic";

export default async function PublicPassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  // Try finding VIP / Official Guest Pass
  const vipPass = await prisma.vIPPass.findUnique({
    where: { token },
    include: {
      hostStaff: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Try finding Domestic Staff / House Help Pass
  let houseHelp: any = null;
  if (!vipPass) {
    houseHelp = await prisma.houseHelp.findUnique({
      where: { token },
      include: {
        staffLinks: {
          include: {
            staff: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  if (!vipPass && !houseHelp) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100 font-sans">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-900/40 border border-rose-700/50 text-rose-400">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-xl font-black text-slate-100">Invalid or Expired Pass</h1>
          <p className="text-xs text-slate-400">
            The pass reference token <span className="font-mono text-slate-300 font-bold">{token}</span> could not be found or has been revoked.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
            >
              Return to Campus Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Generate QR Code Data URL
  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 320,
    margin: 1.5,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const isVip = !!vipPass;
  const passTypeTitle = isVip ? "Official Guest Entry Pass" : "Domestic Staff Master Pass";
  const name = isVip ? vipPass.guestName : houseHelp.name;
  const phone = isVip ? vipPass.guestPhone : houseHelp.phone;
  const purpose = isVip ? vipPass.purpose : `Domestic Service • ${houseHelp.serviceType}`;
  const vehicle = isVip ? vipPass.vehicleNumber : null;
  const status = isVip ? vipPass.status : houseHelp.status;
  const validUntil = isVip ? vipPass.validUntil : houseHelp.staffLinks?.[0]?.validUntil;

  const isExpired = validUntil ? new Date(validUntil) < new Date() : false;

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                  Thapar University
                </p>
                <h1 className="text-sm font-black tracking-tight">{passTypeTitle}</h1>
              </div>
            </div>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                status === "APPROVED"
                  ? isExpired
                    ? "bg-rose-500/30 text-rose-200 border border-rose-400/40"
                    : "bg-emerald-400 text-slate-950"
                  : status === "CHECKED_IN"
                  ? "bg-blue-400 text-slate-950"
                  : "bg-amber-400 text-slate-950"
              }`}
            >
              {status === "APPROVED"
                ? isExpired
                  ? "Expired"
                  : "Approved"
                : status === "CHECKED_IN"
                ? "On Campus"
                : status}
            </span>
          </div>
        </div>

        {/* QR Code Presentation Box */}
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto inline-block rounded-2xl bg-white p-3.5 shadow-xl border border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Campus Gate Pass QR Code"
              className="h-56 w-56 object-contain"
            />
          </div>

          <div className="rounded-2xl bg-slate-950 py-3 border border-slate-850">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Pass Reference Token
            </p>
            <p className="text-base font-black font-mono tracking-wider text-slate-100 mt-0.5">
              {token}
            </p>
          </div>

          {/* Details Table */}
          <div className="rounded-2xl bg-slate-950/60 p-4 text-left text-xs border border-slate-850 space-y-2.5">
            <div className="flex justify-between items-start">
              <span className="text-slate-400">Visitor Name</span>
              <span className="font-bold text-slate-100 text-right">{name}</span>
            </div>

            {phone && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Mobile</span>
                <span className="font-semibold text-slate-300 font-mono">{phone}</span>
              </div>
            )}

            <div className="flex justify-between items-start">
              <span className="text-slate-400">Purpose / Role</span>
              <span className="font-semibold text-slate-200 text-right max-w-[180px]">
                {purpose}
              </span>
            </div>

            {vehicle && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Vehicle</span>
                <span className="font-mono font-bold text-amber-400 uppercase">{vehicle}</span>
              </div>
            )}

            {isVip && vipPass?.hostStaff && (
              <div className="flex justify-between items-start border-t border-slate-850 pt-2">
                <span className="text-slate-400">Host Faculty</span>
                <span className="font-bold text-indigo-400 text-right">
                  {vipPass.hostStaff.name}
                </span>
              </div>
            )}

            {!isVip && houseHelp?.staffLinks && houseHelp.staffLinks.length > 0 && (
              <div className="border-t border-slate-850 pt-2 space-y-1">
                <span className="text-slate-400 block">Assigned Residences:</span>
                <div className="space-y-1">
                  {houseHelp.staffLinks.map((link: any) => (
                    <div key={link.id} className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">{link.quarterNumber}</span>
                      <span className="text-slate-400">{link.staff.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validUntil && (
              <div className="flex justify-between items-center border-t border-slate-850 pt-2">
                <span className="text-slate-400">Validity</span>
                <span className={isExpired ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold"}>
                  Until {new Date(validUntil).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Share & Save Actions */}
          <PassShareActions
            token={token}
            name={name}
            purpose={purpose}
            qrDataUrl={qrDataUrl}
          />

          <div className="pt-2 text-[11px] text-slate-500">
            Show this QR code to the Security Officer at the Main Gate for quick check-in.
          </div>
        </div>
      </div>
    </main>
  );
}
