"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { X, Upload, Camera, Check, Loader } from "lucide-react";

const PRESET_COLORS = [
  "#d4af37", "#3498db", "#e74c3c", "#27ae60", "#9b59b6", "#e67e22",
  "#1abc9c", "#34495e", "#c0392b", "#2980b9", "#8e44ad", "#16a085",
];

const PRESET_AVATARS = [
  { url: "/avatars/cross-gold.svg", label: "Cross" },
  { url: "/avatars/flame-red.svg", label: "Flame" },
  { url: "/avatars/dove-white.svg", label: "Dove" },
  { url: "/avatars/fish-blue.svg", label: "Ichthys" },
  { url: "/avatars/crown-gold.svg", label: "Crown" },
  { url: "/avatars/shield-gold.svg", label: "Shield" },
  { url: "/avatars/water-blue.svg", label: "Water" },
  { url: "/avatars/heart-teal.svg", label: "Heart" },
  { url: "/avatars/bible-brown.svg", label: "Bible" },
  { url: "/avatars/hands-purple.svg", label: "Prayer" },
  { url: "/avatars/star-orange.svg", label: "Star" },
  { url: "/avatars/bolt-yellow.svg", label: "Lightning" },
  { url: "/avatars/olive-green.svg", label: "Olive Branch" },
  { url: "/avatars/sunrise-gold.svg", label: "Sunrise" },
  { url: "/avatars/sword-red.svg", label: "Sword" },
  { url: "/avatars/lamb-white.svg", label: "Lamb" },
];

interface AvatarPickerProps {
  userId: string;
  currentAvatarUrl: string | null;
  currentInitials: string;
  currentColor: string;
  onSave: (updates: { avatar_url?: string | null; color?: string }) => void;
  onClose: () => void;
}

export default function AvatarPicker({
  userId, currentAvatarUrl, currentInitials, currentColor, onSave, onClose,
}: AvatarPickerProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "color">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2MB"); return; }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setPreviewUrl(`${publicUrl}?t=${Date.now()}`);
      setActiveTab("upload");
    } catch (err: any) { setError(err.message || "Upload failed"); }
    finally { setUploading(false); }
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { avatar_url?: string | null; color?: string } = {};
      if (previewUrl !== currentAvatarUrl) updates.avatar_url = previewUrl;
      if (selectedColor !== currentColor) updates.color = selectedColor;
      const updateData: Record<string, any> = {};
      if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", userId);
        if (updateError) throw updateError;
      }
      onSave(updates);
      onClose();
    } catch (err: any) { setError(err.message || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 9998 }} onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md rounded-2xl border overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(20,28,58,0.98), rgba(15,20,45,0.98))", borderColor: "rgba(212,175,55,0.15)", boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-lg font-bold text-white/90">Customize Avatar</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X size={18} className="text-white/40" /></button>
          </div>
          <div className="flex flex-col items-center py-6">
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden"
              style={{ background: previewUrl ? "transparent" : selectedColor, color: "#0a0f1e", border: "3px solid rgba(212,175,55,0.3)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              {previewUrl ? <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" onError={() => setPreviewUrl(null)} /> : currentInitials}
            </div>
            <p className="text-xs text-white/30 mt-2">Preview</p>
          </div>
          <div className="flex gap-1 px-6 mb-4">
            <button onClick={() => setActiveTab("upload")} className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
              style={{ background: activeTab === "upload" ? "rgba(212,175,55,0.15)" : "transparent", color: activeTab === "upload" ? "#d4af37" : "rgba(255,255,255,0.4)", border: `1px solid ${activeTab === "upload" ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.06)"}` }}>
              <Upload size={12} className="inline mr-1.5" />Upload Photo
            </button>
            <button onClick={() => setActiveTab("color")} className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
              style={{ background: activeTab === "color" ? "rgba(212,175,55,0.15)" : "transparent", color: activeTab === "color" ? "#d4af37" : "rgba(255,255,255,0.4)", border: `1px solid ${activeTab === "color" ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.06)"}` }}>
              <Camera size={12} className="inline mr-1.5" />Initials & Color
            </button>
          </div>
          <div className="px-6 pb-4" style={{ minHeight: 160 }}>
            {activeTab === "upload" && (
              <div className="space-y-4">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2"
                  style={{ background: "rgba(212,175,55,0.1)", border: "1px dashed rgba(212,175,55,0.3)", color: "#d4af37" }}>
                  {uploading ? <><Loader size={14} className="animate-spin" />Uploading...</> : <><Upload size={14} />Choose a photo</>}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
                <p className="text-[10px] text-white/20 text-center">JPG, PNG, or WebP — max 2MB</p>
                {previewUrl && <button onClick={() => setPreviewUrl(null)} className="w-full py-2 rounded-lg text-xs text-white/30 hover:text-white/50 transition-colors">Remove photo (use initials)</button>}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">Or choose a symbol</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AVATARS.map((preset) => (
                      <button key={preset.url} onClick={() => setPreviewUrl(preset.url)}
                        className="aspect-square rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: previewUrl === preset.url ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${previewUrl === preset.url ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.06)"}` }}
                        title={preset.label}>
                        <img src={preset.url} alt={preset.label} className="w-8 h-8 opacity-70" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "color" && (
              <div className="space-y-4">
                <p className="text-xs text-white/40">Choose a color for your initials avatar:</p>
                <div className="grid grid-cols-6 gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button key={color} onClick={() => { setSelectedColor(color); setPreviewUrl(null); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: color, border: selectedColor === color ? "3px solid white" : "2px solid rgba(255,255,255,0.1)", boxShadow: selectedColor === color ? `0 0 12px ${color}60` : "none" }}>
                      {selectedColor === color && !previewUrl && <Check size={16} className="text-white drop-shadow" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: selectedColor, color: "#0a0f1e" }}>{currentInitials}</div>
                  <p className="text-xs text-white/30">This is how your initials avatar will look</p>
                </div>
              </div>
            )}
          </div>
          {error && <div className="mx-6 mb-3 px-3 py-2 rounded-lg text-xs text-red-400" style={{ background: "rgba(231,76,60,0.1)" }}>{error}</div>}
          <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/60 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "#d4af37", color: "#0a0f1e" }}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
