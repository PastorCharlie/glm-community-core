"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, HandHelping } from "lucide-react";

interface PresenceSelectorProps {
  userId: string;
  currentStatus: string | null;
  onUpdate: (status: string | null) => void;
}

export default function PresenceSelector({ userId, currentStatus, onUpdate }: PresenceSelectorProps) {
  const [updating, setUpdating] = useState(false);

  const toggleStatus = async (status: "in_the_word" | "in_prayer") => {
    setUpdating(true);
    const newStatus = currentStatus === status ? null : status;

    await supabase
      .from("profiles")
      .update({
        presence_status: newStatus,
        presence_set_at: newStatus ? new Date().toISOString() : null,
      })
      .eq("id", userId);

    onUpdate(newStatus);
    setUpdating(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => toggleStatus("in_the_word")}
        disabled={updating}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
          currentStatus === "in_the_word"
            ? "bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
            : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
        }`}
        title="Set your status to 'In the Word'"
      >
        <BookOpen size={12} />
        In the Word
      </button>
      <button
        onClick={() => toggleStatus("in_prayer")}
        disabled={updating}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
          currentStatus === "in_prayer"
            ? "bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
            : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
        }`}
        title="Set your status to 'In Prayer'"
      >
        <HandHelping size={12} />
        In Prayer
      </button>
    </div>
  );
}
