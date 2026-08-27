"use client";

import { useState } from "react";
import { Share2, Download, Copy, Check, MessageCircle } from "lucide-react";

export default function PassShareActions({
  token,
  name,
  purpose,
  qrDataUrl,
}: {
  token: string;
  name: string;
  purpose: string;
  qrDataUrl: string;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://localhost:3000";
  const passUrl = `${origin}/pass/${token}`;

  const shareText = `🏛️ *Thapar University — Campus Entry Pass*\n\nHello *${name}*,\nYour campus entry pass is ready.\n\n• *Pass Code / Token:* *${token}*\n• *Purpose:* ${purpose}\n\n📱 *Digital Pass:* ${passUrl}\n\nShow this QR code at the security gate for entry.`;

  function fallbackCopyText(text: string) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch {}
  }

  async function handleShareImage() {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `Thapar-Gate-Pass-${token}.png`, { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Campus Pass - ${name}`,
          text: shareText,
        });
        return;
      }
    } catch {}

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Campus Pass - ${name}`,
          text: shareText,
          url: passUrl,
        });
      } catch {}
    }
  }

  async function handleCopyImage() {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 2500);
        return;
      }
    } catch {}
    handleCopyLink();
  }

  async function handleCopyLink() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(passUrl);
      } else {
        fallbackCopyText(passUrl);
      }
    } catch {
      fallbackCopyText(passUrl);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleDownloadQR() {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Thapar-Gate-Pass-${token}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-2 pt-2 border-t border-slate-800">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleShareImage}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-3 py-2.5 text-xs font-bold text-white shadow-md hover:bg-brand-500 transition"
        >
          <Share2 size={15} /> Share QR Image
        </button>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
        >
          <MessageCircle size={15} /> WhatsApp Text
        </a>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={handleCopyImage}
          className="flex items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900 transition"
          title="Copy QR Image to clipboard (Paste with Cmd+V into WhatsApp)"
        >
          {imageCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{imageCopied ? "Image Copied!" : "Copy Image"}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900 transition"
        >
          {linkCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{linkCopied ? "Link Copied!" : "Copy Link"}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadQR}
          className="flex items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900 transition"
        >
          <Download size={13} /> Save QR
        </button>
      </div>
    </div>
  );
}
