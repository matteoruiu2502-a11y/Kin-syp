"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, FileText, Loader2, Mail, MessageCircle, RotateCcw, Send, Smartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChannelId = "email" | "whatsapp" | "sms";
const CHANNELS: { id: ChannelId; icon: LucideIcon; color: string }[] = [
  { id: "email", icon: Mail, color: "#3b82ff" },
  { id: "whatsapp", icon: MessageCircle, color: "#25d366" },
  { id: "sms", icon: Smartphone, color: "#22d3ee" },
];

export function MultiChannel() {
  const { t } = useI18n();
  const c = t.features.channels;
  const [enabled, setEnabled] = useState<Record<ChannelId, boolean>>({ email: true, whatsapp: true, sms: false });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const any = Object.values(enabled).some(Boolean);

  const send = () => {
    if (!any) return;
    setStatus("sending");
    setTimeout(() => setStatus("done"), 1400);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative mb-1 flex items-center justify-center py-2">
        <motion.span
          animate={status === "sending" ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] } : { scale: 1 }}
          transition={{ duration: 0.7, repeat: status === "sending" ? Infinity : 0 }}
          className="flex h-14 w-14 items-center justify-center theme-fixed rounded-2xl bg-white text-blue shadow-[0_0_40px_-6px_rgba(0,102,255,0.9)]"
        >
          <FileText className="h-6 w-6" />
        </motion.span>
      </div>

      {CHANNELS.map(({ id, icon: Icon, color }, i) => {
        const on = enabled[id];
        return (
          <div key={id} className={cn("relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-colors", on ? "border-white/15 bg-white/[0.05]" : "border-white/5 bg-transparent opacity-60")}>
            {status === "sending" && on && (
              <motion.span
                className="absolute inset-y-0 left-0 w-1/3"
                style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
                initial={{ x: "-100%" }}
                animate={{ x: "300%" }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            )}
            <Icon className="relative h-4 w-4" style={{ color }} />
            <span className="relative flex-1 text-sm font-medium text-slate-200">{c[id]}</span>
            <AnimatePresence mode="wait">
              {status === "done" && on ? (
                <motion.span key="ok" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }} className="relative flex items-center gap-1 text-xs font-semibold text-emerald">
                  <CheckCheck className="h-4 w-4" /> {c.delivered}
                </motion.span>
              ) : status === "sending" && on ? (
                <Loader2 key="load" className="relative h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <button
                  key="toggle"
                  role="switch"
                  aria-checked={on}
                  aria-label={c[id]}
                  disabled={status !== "idle"}
                  onClick={() => setEnabled((e) => ({ ...e, [id]: !e[id] }))}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-gradient-to-r from-blue to-emerald" : "bg-white/10")}
                >
                  <motion.span layout className={cn("absolute top-1 theme-fixed h-4 w-4 rounded-full bg-white", on ? "right-1" : "left-1")} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                </button>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      <div className="mt-auto pt-2">
        {status === "done" ? (
          <button onClick={() => setStatus("idle")} className="btn-ghost w-full text-sm">
            <RotateCcw className="h-4 w-4" /> {c.reset}
          </button>
        ) : (
          <button onClick={send} disabled={!any || status === "sending"} className="btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-50">
            {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {status === "sending" ? c.sending : any ? c.send : c.none}
          </button>
        )}
      </div>
    </div>
  );
}
