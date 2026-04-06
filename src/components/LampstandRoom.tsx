"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Pin, Megaphone, Plus, Send, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  scripture_ref: string | null;
  is_pinned: boolean;
  reactions: { profile_id: string; reaction_type: string }[];
  created_at: string;
  author?: { display_name: string; avatar_initials: string; avatar_url: string | null; color: string; role: string };
}

interface LampstandRoomProps {
  userId: string;
  organizationId: string;
  userRole: string;
}

export default function LampstandRoom({ userId, organizationId, userRole }: LampstandRoomProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newScripture, setNewScripture] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const isPastorOrElder = userRole === "pastor" || userRole === "elder";

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from("lampstand_announcements")
      .select("*, author:profiles!lampstand_announcements_author_id_fkey(display_name, avatar_initials, avatar_url, color, role)")
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data as unknown as Announcement[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    loadAnnouncements();
    const channel = supabase.channel("lampstand-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lampstand_announcements" }, () => loadAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAnnouncements]);

  const handlePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setPosting(true);
    try {
      await supabase.from("lampstand_announcements").insert({
        organization_id: organizationId, author_id: userId,
        title: newTitle.trim(), content: newContent.trim(),
        scripture_ref: newScripture.trim() || null, is_pinned: newPinned,
      });
      setNewTitle(""); setNewContent(""); setNewScripture(""); setNewPinned(false); setShowCompose(false);
      loadAnnouncements();
    } catch (err) { console.error("Error posting announcement:", err); }
    finally { setPosting(false); }
  };

  const handleReaction = async (announcementId: string, reactionType: "amen" | "received") => {
    const announcement = announcements.find((a) => a.id === announcementId);
    if (!announcement) return;
    const reactions = announcement.reactions || [];
    const existingIdx = reactions.findIndex((r) => r.profile_id === userId);
    let newReactions;
    if (existingIdx >= 0) {
      if (reactions[existingIdx].reaction_type === reactionType) {
        newReactions = reactions.filter((_, i) => i !== existingIdx);
      } else {
        newReactions = reactions.map((r, i) => i === existingIdx ? { ...r, reaction_type: reactionType } : r);
      }
    } else {
      newReactions = [...reactions, { profile_id: userId, reaction_type: reactionType }];
    }
    setAnnouncements((prev) => prev.map((a) => a.id === announcementId ? { ...a, reactions: newReactions } : a));
    await supabase.from("lampstand_announcements").update({ reactions: newReactions }).eq("id", announcementId);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffHours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return Math.floor(diffHours) + "h ago";
    if (diffHours < 48) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Megaphone size={20} className="text-[#d4af37]" />The Lampstand
          </h2>
          <p className="text-xs text-white/40 mt-1">&ldquo;Neither do people light a lamp and put it under a bowl&rdquo; &mdash; Matthew 5:15</p>
        </div>
        {isPastorOrElder && (
          <button onClick={() => setShowCompose(!showCompose)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors text-sm">
            {showCompose ? <X size={14} /> : <Plus size={14} />}{showCompose ? "Cancel" : "New"}
          </button>
        )}
      </div>

      {showCompose && isPastorOrElder && (
        <div className="rounded-xl border border-[#d4af37]/20 p-4 space-y-3" style={{ background: "rgba(26,26,46,0.8)" }}>
          <input type="text" placeholder="Announcement title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#d4af37]/40" />
          <textarea placeholder="Write your announcement..." value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#d4af37]/40 resize-none" />
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Scripture ref (optional)" value={newScripture} onChange={(e) => setNewScripture(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#d4af37]/40" />
            <label className="flex items-center gap-1 text-white/50 text-sm cursor-pointer">
              <input type="checkbox" checked={newPinned} onChange={(e) => setNewPinned(e.target.checked)} className="rounded" /><Pin size={12} />Pin
            </label>
          </div>
          <button onClick={handlePost} disabled={posting || !newTitle.trim() || !newContent.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d4af37] text-[#0a0f1e] font-semibold text-sm hover:bg-[#b8860b] transition-colors disabled:opacity-40">
            <Send size={14} />{posting ? "Posting..." : "Post Announcement"}
          </button>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="text-center py-16"><Megaphone size={40} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No announcements yet</p></div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const userReaction = a.reactions?.find((r) => r.profile_id === userId);
            const amenCount = a.reactions?.filter((r) => r.reaction_type === "amen").length || 0;
            const receivedCount = a.reactions?.filter((r) => r.reaction_type === "received").length || 0;
            return (
              <div key={a.id} className="rounded-xl border p-4 space-y-3" style={{
                background: a.is_pinned ? "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(20,20,35,0.9) 100%)" : "rgba(20,20,35,0.6)",
                borderColor: a.is_pinned ? "rgba(212,175,55,0.25)" : "rgba(255,255,255,0.06)",
              }}>
                {a.is_pinned && <div className="flex items-center gap-1 text-[#d4af37]/60 text-xs"><Pin size={10} />Pinned</div>}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                      style={{ background: a.author?.avatar_url ? "transparent" : (a.author?.color || "#95a5a6") + "22", color: a.author?.color || "#95a5a6" }}>
                      {a.author?.avatar_url ? <img src={a.author.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : a.author?.avatar_initials || "?"}
                    </div>
                    <div><span className="text-white/80 text-sm font-medium">{a.author?.display_name || "Unknown"}</span>
                    <span className="ml-2 text-white/30 text-xs capitalize">{a.author?.role}</span></div>
                  </div>
                  <span className="text-white/30 text-xs">{formatDate(a.created_at)}</span>
                </div>
                <div><h3 className="text-white font-semibold text-base">{a.title}</h3>
                <p className="text-white/60 text-sm mt-1 leading-relaxed whitespace-pre-wrap">{a.content}</p></div>
                {a.scripture_ref && <p className="text-[#d4af37]/50 text-xs italic">{a.scripture_ref}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => handleReaction(a.id, "amen")} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all ${
                    userReaction?.reaction_type === "amen" ? "bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"}`}>
                    Amen{amenCount > 0 && <span className="ml-1 font-medium">{amenCount}</span>}
                  </button>
                  <button onClick={() => handleReaction(a.id, "received")} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all ${
                    userReaction?.reaction_type === "received" ? "bg-[#3498db]/20 text-[#3498db] border border-[#3498db]/30" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"}`}>
                    Received{receivedCount > 0 && <span className="ml-1 font-medium">{receivedCount}</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
