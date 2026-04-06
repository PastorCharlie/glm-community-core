"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Heart, BookOpen, Flag, Megaphone } from "lucide-react";

interface HealthMetric {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ReactNode;
}

interface PastorHealthPanelProps {
  organizationId: string;
  onComposeAnnouncement: () => void;
}

export default function PastorHealthPanel({ organizationId, onComposeAnnouncement }: PastorHealthPanelProps) {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      // Get total members
      const { count: totalMembers } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_banned", false);

      // Active members this week (anyone who posted, prayed, or journaled in last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count: wellActivity } = await supabase
        .from("well_posts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", weekAgo);

      const { count: prayerActivity } = await supabase
        .from("prayer_hands")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo);

      const { count: journalActivity } = await supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", weekAgo);

      const { count: milestoneActivity } = await supabase
        .from("milestones")
        .select("id", { count: "exact", head: true })
        .gte("achieved_at", weekAgo);

      const total = totalMembers || 1;
      setMetrics([
        {
          label: "Active This Week",
          value: Math.min((wellActivity || 0) + (prayerActivity || 0), total),
          max: total,
          color: "#d4af37",
          icon: <Users size={16} />,
        },
        {
          label: "Well Activity",
          value: (wellActivity || 0) + (prayerActivity || 0),
          max: Math.max((wellActivity || 0) + (prayerActivity || 0), 10),
          color: "#3498db",
          icon: <Heart size={16} />,
        },
        {
          label: "Journal Entries",
          value: journalActivity || 0,
          max: Math.max(journalActivity || 0, 10),
          color: "#9b59b6",
          icon: <BookOpen size={16} />,
        },
        {
          label: "Milestones",
          value: milestoneActivity || 0,
          max: Math.max(milestoneActivity || 0, 5),
          color: "#e74c3c",
          icon: <Flag size={16} />,
        },
      ]);
      setLoading(false);
    };

    loadMetrics();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 p-4 animate-pulse" style={{ background: "rgba(20,20,35,0.6)" }}>
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#d4af37]/10 p-4 space-y-4" style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.8) 100%)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/60 tracking-wider uppercase">
          Community Health
        </h3>
        <span className="text-xs text-white/30">This Week</span>
      </div>

      {/* Health Rings */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const percentage = metric.max > 0 ? (metric.value / metric.max) * 100 : 0;
          const circumference = 2 * Math.PI * 28;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;

          return (
            <div
              key={metric.label}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              {/* Arc/Ring SVG */}
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke={metric.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000"
                    style={{ opacity: 0.8 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center" style={{ color: metric.color }}>
                  {metric.icon}
                </div>
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-none">{metric.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{metric.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Lampstand Post */}
      <button
        onClick={onComposeAnnouncement}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#d4af37]/10 text-[#d4af37] text-sm hover:bg-[#d4af37]/20 transition-colors"
      >
        <Megaphone size={14} />
        Post to The Lampstand
      </button>
    </div>
  );
}
