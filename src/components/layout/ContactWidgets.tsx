"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, X, Copy, Check } from "lucide-react";

/* LinkedIn SVG — not available in this version of lucide-react */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const EMAIL = "gutierrezjustin48@gmail.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/justingutierrez1";

/* ─── Email modal ─────────────────────────────────────────── */

function EmailModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — no-op
    }
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Blurred dark backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-[#111111] shadow-2xl shadow-black/60 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-7 w-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <Mail className="h-7 w-7 text-red-400" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          Get in touch
        </h2>
        <p className="text-sm text-zinc-400 text-center leading-relaxed mb-6">
          Have questions about TunerData, remote tuning workflows, or the
          project? Feel free to reach out — I&apos;d love to hear from you.
        </p>

        {/* Email pill */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 mb-4">
          <Mail className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm font-mono text-zinc-100 flex-1 select-all">
            {EMAIL}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300"
          >
            {copied ? (
              <><Check className="h-3 w-3 text-green-400" /> Copied</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy</>
            )}
          </button>
        </div>

        {/* Open mail client */}
        <a
          href={`mailto:${EMAIL}?subject=TunerData Question`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Open in email client
        </a>

        <p className="text-[11px] text-zinc-600 text-center mt-4">
          Press <kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px]">Esc</kbd> or click outside to close
        </p>
      </div>
    </div>
  );
}

/* ─── Widget bar ─────────────────────────────────────────── */

export function ContactWidgets() {
  const [emailOpen, setEmailOpen] = useState(false);

  const closeModal = useCallback(() => setEmailOpen(false), []);

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Email widget */}
        <button
          onClick={() => setEmailOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-red-500/50 hover:bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all"
        >
          <Mail className="h-3.5 w-3.5 text-red-400" />
          Contact
        </button>

        {/* LinkedIn widget */}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-blue-500/50 hover:bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all"
        >
          <LinkedInIcon className="h-3.5 w-3.5 text-blue-400" />
          LinkedIn
        </a>
      </div>

      {emailOpen && <EmailModal onClose={closeModal} />}
    </>
  );
}
