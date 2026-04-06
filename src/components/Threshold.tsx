"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Sparkles } from "lucide-react";

interface ThresholdEntry {
  id: string;
  scripture_text: string;
  scripture_ref: string;
  prayer_prompt: string;
  community_highlight: string | null;
  display_date: string;
}

interface ThresholdProps {
  userId: string;
  organizationId: string;
  onPass: () => void;
}

export default function Threshold({ userId, organizationId, onPass }: ThresholdProps) {
  const [entry, setEntry] = useState<ThresholdEntry | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [passing, setPassing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkThreshold = async () => {
      if (!userId || !organizationId) return;
      const today = new Date().toISOString().split("T")[0];
      const { data: todayEntry } = await supabase
        .from("threshold_entries")
        .select("*")
        .eq("display_date", today)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!todayEntry) { onPass(); return; }

      const { data: existingView } = await supabase
        .from("threshold_views")
        .select("id")
        .eq("profile_id", userId)
        .eq("threshold_id", todayEntry.id)
        .limit(1)
        .maybeSingle();

      if (existingView) { onPass(); return; }

      setEntry(todayEntry);
      setLoading(false);
      setTimeout(() => setFadeIn(true), 100);
    };
    checkThreshold();
  }, [userId, organizationId, onPass]);

  const handlePass = async () => {
    if (!entry) return;
    setPassing(true);
    await supabase.from("threshold_views").insert({ profile_id: userId, threshold_id: entry.id });
    setFadeIn(false);
    setTimeout(() => onPass(), 600);
  };

  if (loading || !entry) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-700 ${fadeIn ? "opacity-100" : "opacity-0"}`}
      style={{ background: "radial-gradient(ellipse at center, rgba(20,20,50,0.98) 0%, rgba(5,5,20,1) 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 1 + "px", height: Math.random() * 2 + 1 + "px",
            top: Math.random() * 100 + "%", left: Math.random() * 100 + "%",
            opacity: Math.random() * 0.6 + 0.2,
            animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: Math.random() * 3 + "s",
          }} />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-8 text-center space-y-8">
        <div className={`transition-all duration-1000 delay-300 ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-xl md:text-2xl font-serif leading-relaxed italic" style={{ color: "#d4af37" }}>
            &ldquo;{entry.scripture_text}&rdquo;
          </p>
          <p className="mt-3 text-sm text-white/40 tracking-widest uppercase">{entry.scripture_ref}</p>
        </div>

        <div className={`transition-all duration-1000 delay-700 ${fadeIn ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`}>
          <div className="mx-auto w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
        </div>

        <div className={`transition-all duration-1000 delay-1000 ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-white/70 text-base leading-relaxed">{entry.prayer_prompt}</p>
        </div>

        {entry.community_highlight && (
          <div className={`transition-all duration-1000 delay-[1300ms] ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <p className="text-white/40 text-sm">{entry.community_highlight}</p>
          </div>
        )}

        <div className={`transition-all duration-1000 delay-[1600ms] ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <button onClick={handlePass} disabled={passing}
            className="group mt-4 px-8 py-3 rounded-full border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10 transition-all duration-300 flex items-center gap-2 mx-auto">
            <Sparkles size={16} className="opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="text-sm tracking-wider uppercase">{passing ? "Entering..." : "Enter the Gate"}</span>
          </button>
        </div>
      </div>

      <div className={`absolute bottom-8 text-center transition-all duration-1000 delay-[2000ms] ${fadeIn ? "opacity-100" : "opacity-0"}`}>
        <p className="text-white/20 text-xs tracking-[0.3em] uppercase">The Threshold &middot; Psalm 84:10</p>
      </div>

      <style>{`@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}
