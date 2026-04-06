"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { moderateText } from "@/lib/moderation";
import type { User } from "@supabase/supabase-js";
import {
  DoorOpen, Droplets, Cross, Grape, Church, Users, BookOpen, Heart,
  MessageCircle, Send, Shield, Star, ChevronRight, Lock, CheckCircle2,
  Circle, Flame, Hand, Crown, Footprints, Sparkles, Eye, UserPlus,
  Search, Loader, X, Bell, PenLine, Calendar, ChevronDown, ChevronUp,
  Bookmark, Globe, EyeOff, UserCheck, AlertTriangle, Flag, Trash2,
  Clock, Activity, ArrowRight, Settings, CheckSquare, Ban, ThumbsUp,
  Sunrise, Moon, CloudSun, Zap, Feather, ScrollText, Mail,
  LogOut, LayoutDashboard, UserCircle, Megaphone, HandHelping,
} from "lucide-react";
import AvatarPicker from "@/components/community/AvatarPicker";
import Threshold from "@/components/community/Threshold";
import LampstandRoom from "@/components/community/LampstandRoom";
import PastorHealthPanel from "@/components/community/PastorHealthPanel";
import PresenceSelector from "@/components/community/PresenceSelector";

/* ════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ════════════════════════════════════════════════════ */

interface Profile {
  id: string;
  display_name: string;
  avatar_initials: string;
  avatar_url?: string | null;
  color: string;
  role: "pastor" | "elder" | "disciple" | "seeker";
  join_date: string;
  is_approved: boolean;
  is_banned: boolean;
}

interface WellPost {
  id: string;
  author_id: string;
  author?: Profile;
  post_type: "prayer" | "praise" | "question" | "testimony";
  content: string;
  scripture_ref?: string;
  is_flagged: boolean;
  flag_reason?: string;
  is_crisis: boolean;
  prayer_count: number;
  response_count?: number;
  created_at: string;
}

interface WellResponse {
  id: string;
  post_id: string;
  author_id: string;
  author?: Profile;
  content: string;
  is_flagged: boolean;
  created_at: string;
}

interface StudyGroup {
  id: string;
  name: string;
  topic: string;
  scripture_ref: string;
  leader_id: string;
  leader?: Profile;
  max_members: number;
  next_meeting?: string;
  meeting_schedule?: string;
  is_active: boolean;
  created_at: string;
  members?: Profile[];
  member_count?: number;
}

interface StudyMessage {
  id: string;
  group_id: string;
  author_id: string;
  author?: Profile;
  content: string;
  scripture_ref?: string;
  is_flagged: boolean;
  created_at: string;
}

interface Partnership {
  id: string;
  partner_a: string;
  partner_b: string;
  matched_by?: string;
  started_at: string;
  is_active: boolean;
  weeks_together: number;
  partner_a_profile?: Profile;
  partner_b_profile?: Profile;
}

interface Checkin {
  id: string;
  partnership_id: string;
  author_id: string;
  week_number: number;
  scripture_answer?: string;
  prayer_answer?: string;
  struggle_answer?: string;
  win_answer?: string;
  service_answer?: string;
  created_at: string;
}

interface Milestone {
  id: string;
  profile_id: string;
  milestone_type: "salvation" | "baptism" | "first_study" | "small_group" | "serving" | "leading" | "discipling";
  achieved_at: string;
}

interface JournalEntry {
  id: string;
  profile_id: string;
  entry_type: "dream" | "vision" | "testimony" | "prayer_answered" | "reflection" | "general";
  title?: string;
  content: string;
  scripture_ref?: string;
  visibility: "private" | "partner" | "pastor" | "community";
  mood?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  sender?: Profile;
  type: string;
  title: string;
  body?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  partner?: { display_name: string; avatar_initials: string; avatar_url?: string | null; color: string; role: string };
  last_message?: string;
  unread_count?: number;
}

interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: { display_name: string; avatar_initials: string; avatar_url?: string | null; color: string };
}

/* ════════════════════════════════════════════════════
   MILESTONE DEFINITIONS
   ════════════════════════════════════════════════════ */

const MILESTONES = [
  { id: "salvation", label: "Salvation", icon: Cross, description: "Accepted Jesus Christ as Lord and Savior", scripture: "Romans 10:9", color: "#d4af37" },
  { id: "baptism", label: "Water Baptism", icon: Droplets, description: "Publicly declared faith through baptism", scripture: "Matthew 28:19", color: "#3498db" },
  { id: "first_study", label: "First Bible Study", icon: BookOpen, description: "Completed first structured Bible study", scripture: "2 Timothy 2:15", color: "#27ae60" },
  { id: "small_group", label: "Small Group", icon: Users, description: "Joined and committed to a small group", scripture: "Hebrews 10:25", color: "#9b59b6" },
  { id: "serving", label: "Serving", icon: Hand, description: "Actively serving in a ministry", scripture: "1 Peter 4:10", color: "#e67e22" },
  { id: "leading", label: "Leading", icon: Crown, description: "Leading a ministry, group, or initiative", scripture: "1 Timothy 3:1", color: "#e74c3c" },
  { id: "discipling", label: "Discipling Others", icon: Footprints, description: "Actively pouring into someone else's faith", scripture: "2 Timothy 2:2", color: "#d4af37" },
];

/* ════════════════════════════════════════════════════
   ROOM DEFINITIONS
   ════════════════════════════════════════════════════ */

const ROOMS = [
  { id: "gate", label: "The Gate", icon: DoorOpen, description: "Your Dashboard", color: "#95a5a6", scripture: "John 10:9" },
  { id: "well", label: "The Well", icon: Droplets, description: "Come As You Are", color: "#3498db", scripture: "John 4:14" },
  { id: "upper_room", label: "The Upper Room", icon: Flame, description: "Study Together", color: "#e74c3c", scripture: "Acts 1:13-14" },
  { id: "vineyard", label: "The Vineyard", icon: Grape, description: "Bear Fruit Together", color: "#27ae60", scripture: "John 15:5" },
  { id: "ecclesia", label: "The Ecclesia", icon: Church, description: "The Called-Out Assembly", color: "#d4af37", scripture: "Matthew 16:18" },
  { id: "journal", label: "My Journal", icon: PenLine, description: "Your Spiritual Journey", color: "#9b59b6", scripture: "Psalm 119:105" },
  { id: "lampstand", label: "The Lampstand", icon: Megaphone, description: "Announcements & Updates", color: "#d4af37", scripture: "Matthew 5:15" },
  { id: "messages", label: "Messages", icon: Mail, description: "Direct Messages", color: "#1abc9c", scripture: "Proverbs 27:17" },
];

/* ════════════════════════════════════════════════════
   POST TYPE DEFINITIONS
   ════════════════════════════════════════════════════ */

const POST_TYPES: Record<string, { label: string; color: string; icon: typeof Heart }> = {
  prayer: { label: "Prayer", color: "#3498db", icon: Hand },
  praise: { label: "Praise", color: "#d4af37", icon: Star },
  question: { label: "Question", color: "#e67e22", icon: BookOpen },
  testimony: { label: "Testimony", color: "#27ae60", icon: Cross },
};

/* ════════════════════════════════════════════════════
   JOURNAL ENTRY TYPES
   ════════════════════════════════════════════════════ */

const JOURNAL_TYPES: Record<string, { label: string; color: string; icon: typeof Heart }> = {
  dream: { label: "Dream", color: "#9b59b6", icon: Moon },
  vision: { label: "Vision", color: "#d4af37", icon: Eye },
  testimony: { label: "Testimony", color: "#27ae60", icon: Cross },
  prayer_answered: { label: "Prayer Answered", color: "#3498db", icon: CheckCircle2 },
  reflection: { label: "Reflection", color: "#e67e22", icon: Feather },
  general: { label: "General", color: "#95a5a6", icon: ScrollText },
};

const MOODS: Record<string, { label: string; color: string; icon: typeof Heart }> = {
  grateful: { label: "Grateful", color: "#d4af37", icon: Heart },
  hopeful: { label: "Hopeful", color: "#3498db", icon: Sunrise },
  peaceful: { label: "Peaceful", color: "#27ae60", icon: CloudSun },
  struggling: { label: "Struggling", color: "#e74c3c", icon: AlertTriangle },
  seeking: { label: "Seeking", color: "#e67e22", icon: Search },
  joyful: { label: "Joyful", color: "#f1c40f", icon: Sparkles },
  burdened: { label: "Burdened", color: "#95a5a6", icon: Moon },
  victorious: { label: "Victorious", color: "#9b59b6", icon: Zap },
};

const VISIBILITY_OPTIONS = [
  { id: "private", label: "Only Me", icon: EyeOff, color: "#95a5a6" },
  { id: "partner", label: "My Partner", icon: Users, color: "#27ae60" },
  { id: "pastor", label: "Pastor", icon: Shield, color: "#d4af37" },
  { id: "community", label: "Community", icon: Globe, color: "#3498db" },
];

/* ════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ════════════════════════════════════════════════════ */

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════ */

export default function CommunityPage() {
  const router = useRouter();

  // ─── Auth state ─────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isPastor, setIsPastor] = useState(false);

  // ─── Room navigation ────────────────────────────
  const [activeRoom, setActiveRoom] = useState("gate");
  const [presenceStatus, setPresenceStatus] = useState<string | null>(null);
  const [showThreshold, setShowThreshold] = useState(true);
  const currentRoom = ROOMS.find((r) => r.id === activeRoom) || ROOMS[0];

  // ─── Notification state ─────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Gate / Dashboard state ─────────────────────
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; text: string; time: string; color: string; icon: typeof Heart }>>([]);

  // ─── The Well state ─────────────────────────────
  const [wellPosts, setWellPosts] = useState<WellPost[]>([]);
  const [loadingWell, setLoadingWell] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState<"prayer" | "praise" | "question" | "testimony">("prayer");
  const [composeContent, setComposeContent] = useState("");
  const [composeScripture, setComposeScripture] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, WellResponse[]>>({});
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);

  // ─── Upper Room state ───────────────────────────
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupTopic, setGroupTopic] = useState("");
  const [groupScripture, setGroupScripture] = useState("");
  const [groupSchedule, setGroupSchedule] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [activeStudyGroup, setActiveStudyGroup] = useState<string | null>(null);
  const [studyMessages, setStudyMessages] = useState<StudyMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Vineyard state ─────────────────────────────
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [showPartnerRequest, setShowPartnerRequest] = useState(false);
  const [partnerRequestMessage, setPartnerRequestMessage] = useState("");
  const [submittingPartnerRequest, setSubmittingPartnerRequest] = useState(false);
  const [partnerRequestSent, setPartnerRequestSent] = useState(false);
  const [existingRequest, setExistingRequest] = useState(false);
  const [myPartnership, setMyPartnership] = useState<Partnership | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkinScripture, setCheckinScripture] = useState("");
  const [checkinPrayer, setCheckinPrayer] = useState("");
  const [checkinStruggle, setCheckinStruggle] = useState("");
  const [checkinWin, setCheckinWin] = useState("");
  const [checkinService, setCheckinService] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // ─── Ecclesia state ─────────────────────────────
  const [members, setMembers] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberMilestones, setMemberMilestones] = useState<Record<string, Milestone[]>>({});
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

  // ─── Journal state ──────────────────────────────
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [showJournalCompose, setShowJournalCompose] = useState(false);
  const [journalType, setJournalType] = useState<JournalEntry["entry_type"]>("reflection");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalScripture, setJournalScripture] = useState("");
  const [journalVisibility, setJournalVisibility] = useState<JournalEntry["visibility"]>("private");
  const [journalMood, setJournalMood] = useState<string>("");
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalFilter, setJournalFilter] = useState<string>("all");
  const [expandedJournal, setExpandedJournal] = useState<string | null>(null);

  // ─── Messages (DM) state ─────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [convoMessages, setConvoMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState("");

  // ─── Admin state ────────────────────────────────
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<Profile[]>([]);
  const [flaggedContent, setFlaggedContent] = useState<WellPost[]>([]);
  const [pendingPartnerRequests, setPendingPartnerRequests] = useState<Array<{ id: string; requester_id: string; message?: string; status: string; created_at: string; requester?: Profile }>>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // ─── Member Profile Modal state ─────────────────
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [profileMember, setProfileMember] = useState<Profile | null>(null);
  const [profileMilestones, setProfileMilestones] = useState<Milestone[]>([]);
  const [profileJournal, setProfileJournal] = useState<JournalEntry[]>([]);

  /* ════════════════════════════════════════════════════
     DATA LOADING
     ════════════════════════════════════════════════════ */

    // Auto-open notifications panel when arriving via ?tab=notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'notifications') {
      setShowNotifications(true);
    }
  }, []);

useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profile) {
          setCurrentProfile(profile);
          setIsPastor(profile?.role === "pastor");
        }
      }
    };
    getUser();
  }, []);

  // Load data when room changes or user logs in
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (activeRoom === "well") loadWellPosts();
    if (activeRoom === "upper_room") loadStudyGroups();
    if (activeRoom === "vineyard") { loadPartnerships(); if (currentUser) checkExistingPartnerRequest(); }
    if (activeRoom === "ecclesia") loadMembersWithMilestones();
    if (activeRoom === "journal" && currentUser) loadJournalEntries();
    if (activeRoom === "gate" && currentUser) loadDashboardData();
    if (activeRoom === "messages" && currentUser) loadMessages();
  }, [activeRoom, currentUser]);

  // Load notifications
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured()) return;
    loadNotifications();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${currentUser.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Real-time for Well posts
  useEffect(() => {
    if (activeRoom !== "well" || !isSupabaseConfigured()) return;
    const channel = supabase
      .channel("well_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "well_posts" }, () => {
        loadWellPosts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  // Real-time for study messages
  useEffect(() => {
    if (!activeStudyGroup || !isSupabaseConfigured()) return;
    const channel = supabase
      .channel(`study_${activeStudyGroup}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "study_messages",
        filter: `group_id=eq.${activeStudyGroup}`,
      }, () => {
        loadStudyMessages(activeStudyGroup);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeStudyGroup]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [studyMessages]);

  /* ──── Load functions ──────────────────────────── */

  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, sender:sender_id(id, display_name, avatar_initials, avatar_url, color, role)")
        .eq("recipient_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!currentUser) return;
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", currentUser.id).eq("is_read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const loadDashboardData = async () => {
    if (!currentUser) return;
    try {
      // Build a recent activity feed from multiple sources
      const activities: Array<{ type: string; text: string; time: string; color: string; icon: typeof Heart }> = [];

      // Recent well posts
      const { data: recentPosts } = await supabase
        .from("well_posts")
        .select("*, author:author_id(display_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      (recentPosts || []).forEach((p) => {
        const pt = POST_TYPES[p.post_type];
        const authorName = (p.author as unknown as Profile)?.display_name || "Someone";
        activities.push({
          type: "well",
          text: `${authorName} shared a ${pt?.label?.toLowerCase() || "post"}`,
          time: p.created_at,
          color: pt?.color || "#3498db",
          icon: pt?.icon || Heart,
        });
      });

      // Recent study messages
      const { data: recentMessages } = await supabase
        .from("study_messages")
        .select("*, author:author_id(display_name), group:group_id(name)")
        .order("created_at", { ascending: false })
        .limit(3);
      (recentMessages || []).forEach((m) => {
        const authorName = (m.author as unknown as Profile)?.display_name || "Someone";
        const groupName = (m.group as unknown as { name: string })?.name || "a study";
        activities.push({
          type: "study",
          text: `${authorName} posted in ${groupName}`,
          time: m.created_at,
          color: "#e74c3c",
          icon: MessageCircle,
        });
      });

      // Sort by time
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activities.slice(0, 8));
    } catch (err) {
      console.error("Error loading dashboard:", err);
    }
  };

  const loadWellPosts = async () => {
    setLoadingWell(true);
    try {
      const { data, error } = await supabase
        .from("well_posts")
        .select("*, author:author_id(id, display_name, avatar_initials, avatar_url, color, role, join_date)")
        .eq("is_flagged", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      // Get response counts
      const postIds = (data || []).map((p) => p.id);
      if (postIds.length > 0) {
        const { data: respCounts } = await supabase
          .from("well_responses")
          .select("post_id")
          .in("post_id", postIds);
        const countMap: Record<string, number> = {};
        (respCounts || []).forEach((r) => {
          countMap[r.post_id] = (countMap[r.post_id] || 0) + 1;
        });
        (data || []).forEach((p) => { p.response_count = countMap[p.id] || 0; });
      }

      setWellPosts(data || []);
    } catch (error) {
      console.error("Error loading well posts:", error);
    } finally {
      setLoadingWell(false);
    }
  };

  const loadResponses = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from("well_responses")
        .select("*, author:author_id(id, display_name, avatar_initials, avatar_url, color, role)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setResponses((prev) => ({ ...prev, [postId]: data || [] }));
    } catch (err) {
      console.error("Error loading responses:", err);
    }
  };

  const loadStudyGroups = async () => {
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase
        .from("study_groups")
        .select(`
          *,
          leader:leader_id(id, display_name, avatar_initials, avatar_url, color, role),
          members:study_group_members(profile:profile_id(id, display_name, avatar_initials, avatar_url, color))
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const groups = (data || []).map((g) => ({
        ...g,
        members: (g.members || []).map((m: { profile: Profile }) => m.profile).filter(Boolean),
        member_count: (g.members || []).length,
      }));
      setStudyGroups(groups);
    } catch (error) {
      console.error("Error loading study groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadStudyMessages = async (groupId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("study_messages")
        .select("*, author:author_id(id, display_name, avatar_initials, avatar_url, color, role)")
        .eq("group_id", groupId)
        .eq("is_flagged", false)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      setStudyMessages(data || []);
    } catch (error) {
      console.error("Error loading study messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMembersWithMilestones = async () => {
    setLoadingMembers(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_approved", true)
        .eq("is_banned", false);
      if (memberError) throw memberError;
      setMembers(memberData || []);

      const { data: milestoneData, error: milestoneError } = await supabase.from("milestones").select("*");
      if (milestoneError) throw milestoneError;
      const milestonesMap: Record<string, Milestone[]> = {};
      (milestoneData || []).forEach((m) => {
        if (!milestonesMap[m.profile_id]) milestonesMap[m.profile_id] = [];
        milestonesMap[m.profile_id].push(m);
      });
      setMemberMilestones(milestonesMap);
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadPartnerships = async () => {
    try {
      const { data, error } = await supabase
        .from("partnerships")
        .select(`
          *,
          partner_a_profile:partner_a(id, display_name, avatar_initials, avatar_url, color, role, join_date),
          partner_b_profile:partner_b(id, display_name, avatar_initials, avatar_url, color, role, join_date)
        `)
        .eq("is_active", true)
        .order("started_at", { ascending: false });
      if (error) throw error;
      setPartnerships(data || []);

      // Find current user's partnership
      if (currentUser) {
        const mine = (data || []).find((p) => p.partner_a === currentUser.id || p.partner_b === currentUser.id);
        setMyPartnership(mine || null);
        if (mine) loadCheckins(mine.id);
      }
    } catch (error) {
      console.error("Error loading partnerships:", error);
    }
  };

  const loadCheckins = async (partnershipId: string) => {
    try {
      const { data, error } = await supabase
        .from("checkins")
        .select("*")
        .eq("partnership_id", partnershipId)
        .order("week_number", { ascending: false })
        .limit(12);
      if (error) throw error;
      setCheckins(data || []);
    } catch (err) {
      console.error("Error loading checkins:", err);
    }
  };

  const loadJournalEntries = async () => {
    if (!currentUser) return;
    setLoadingJournal(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("profile_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (err) {
      console.error("Error loading journal:", err);
    } finally {
      setLoadingJournal(false);
    }
  };

  const checkExistingPartnerRequest = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from("partnership_requests")
        .select("id")
        .eq("requester_id", currentUser.id)
        .eq("status", "pending")
        .limit(1);
      if (!error && data && data.length > 0) setExistingRequest(true);
    } catch (err) {
      console.error("Error checking partner request:", err);
    }
  };

  // ─── Messages (DM) functions ─────────────────────
  const loadMessages = async () => {
    if (!currentUser) return;
    try {
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_one.eq.${currentUser.id},participant_two.eq.${currentUser.id}`)
        .order("last_message_at", { ascending: false });

      if (!convos) { setConversations([]); return; }

      const enriched = await Promise.all(convos.map(async (c: Conversation) => {
        const partnerId = c.participant_one === currentUser.id ? c.participant_two : c.participant_one;
        const { data: partner } = await supabase
          .from("profiles")
          .select("display_name, avatar_initials, avatar_url, color, role")
          .eq("id", partnerId)
          .single();
        const { data: lastMsg } = await supabase
          .from("direct_messages")
          .select("content")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        const { count } = await supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .eq("is_read", false)
          .neq("sender_id", currentUser.id);
        return { ...c, partner, last_message: lastMsg?.content || "", unread_count: count || 0 };
      }));
      setConversations(enriched);
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  const loadConvoMessages = async (convoId: string) => {
    setActiveConvo(convoId);
    try {
      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: true });
      if (!msgs) { setConvoMessages([]); return; }

      const enriched = await Promise.all(msgs.map(async (m: DirectMessage) => {
        const { data: sender } = await supabase
          .from("profiles")
          .select("display_name, avatar_initials, avatar_url, color")
          .eq("id", m.sender_id)
          .single();
        return { ...m, sender };
      }));
      setConvoMessages(enriched);

      // Mark messages as read
      await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("conversation_id", convoId)
        .neq("sender_id", currentUser!.id);
    } catch (err) {
      console.error("Error loading convo messages:", err);
    }
  };

  const sendDirectMessage = async () => {
    if (!newMessage.trim() || !activeConvo || !currentUser) return;
    try {
      await supabase.from("direct_messages").insert({
        conversation_id: activeConvo,
        sender_id: currentUser.id,
        content: newMessage.trim(),
      });
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConvo);
      setNewMessage("");
      loadConvoMessages(activeConvo);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const startNewConversation = async (partnerId: string) => {
    if (!currentUser) return;
    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(participant_one.eq.${currentUser.id},participant_two.eq.${partnerId}),and(participant_one.eq.${partnerId},participant_two.eq.${currentUser.id})`)
        .limit(1)
        .single();
      if (existing) {
        setShowNewConvo(false);
        setNewConvoSearch("");
        loadConvoMessages(existing.id);
        return;
      }
      const { data: newConvo } = await supabase.from("conversations").insert({
        participant_one: currentUser.id,
        participant_two: partnerId,
        last_message_at: new Date().toISOString(),
      }).select().single();
      if (newConvo) {
        setShowNewConvo(false);
        setNewConvoSearch("");
        loadMessages();
        loadConvoMessages(newConvo.id);
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
    }
  };

  // Admin data loaders
  const loadAdminData = async () => {
    if (!isPastor) return;
    setLoadingAdmin(true);
    try {
      const [pendingRes, flaggedRes, partnerReqRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("is_approved", false).eq("is_banned", false),
        supabase.from("well_posts").select("*, author:author_id(id, display_name, avatar_initials, avatar_url, color)").eq("is_flagged", true),
        supabase.from("partnership_requests").select("*, requester:requester_id(id, display_name, avatar_initials, avatar_url, color, role)").eq("status", "pending"),
      ]);
      setPendingMembers(pendingRes.data || []);
      setFlaggedContent(flaggedRes.data || []);
      setPendingPartnerRequests(partnerReqRes.data || []);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  /* ════════════════════════════════════════════════════
     ACTION HANDLERS
     ════════════════════════════════════════════════════ */

  const requireAuth = useCallback(() => {
    if (currentUser) return true;
    setShowJoinPrompt(true);
    setTimeout(() => setShowJoinPrompt(false), 3000);
    return false;
  }, [currentUser]);

  // Well actions
  const handleSubmitPost = async () => {
    if (!composeContent.trim() || !currentUser) return;
    setPosting(true);
    try {
      const modResult = moderateText(composeContent);
      if (!modResult.allowed) {
        alert(modResult.reason || "Your post contains inappropriate content. Please revise.");
        return;
      }
      const { error } = await supabase.from("well_posts").insert({
        author_id: currentUser.id,
        post_type: composeType,
        content: composeContent,
        scripture_ref: composeScripture || null,
        is_flagged: modResult.severity === "warning",
        is_crisis: modResult.isCrisis || false,
        prayer_count: 0,
      });
      if (error) throw error;
      setShowCompose(false);
      setComposeContent("");
      setComposeScripture("");
      loadWellPosts();
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Failed to create post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handlePrayerHand = async (postId: string) => {
    if (!requireAuth()) return;
    try {
      // Check if already prayed
      const { data: existing } = await supabase
        .from("prayer_hands")
        .select("id")
        .eq("post_id", postId)
        .eq("profile_id", currentUser!.id)
        .limit(1);
      if (existing && existing.length > 0) return;

      await supabase.from("prayer_hands").insert({ post_id: postId, profile_id: currentUser!.id });
      await supabase.from("well_posts").update({ prayer_count: wellPosts.find((p) => p.id === postId)!.prayer_count + 1 }).eq("id", postId);
      setWellPosts((prev) => prev.map((p) => p.id === postId ? { ...p, prayer_count: p.prayer_count + 1 } : p));
    } catch (err) {
      console.error("Error adding prayer:", err);
    }
  };

  const handleSubmitReply = async (postId: string) => {
    if (!replyContent.trim() || !currentUser) return;
    try {
      const modResult = moderateText(replyContent);
      if (!modResult.allowed) { alert(modResult.reason || "Content flagged."); return; }
      const { error } = await supabase.from("well_responses").insert({
        post_id: postId,
        author_id: currentUser.id,
        content: replyContent,
        is_flagged: modResult.severity === "warning",
      });
      if (error) throw error;
      setReplyContent("");
      setReplyingTo(null);
      loadResponses(postId);
      setWellPosts((prev) => prev.map((p) => p.id === postId ? { ...p, response_count: (p.response_count || 0) + 1 } : p));
    } catch (err) {
      console.error("Error submitting reply:", err);
    }
  };

  // Study group actions
  const handleCreateGroup = async () => {
    if (!groupName.trim() || !groupTopic.trim() || !currentUser) return;
    setCreatingGroup(true);
    try {
      const { data, error } = await supabase
        .from("study_groups")
        .insert({
          name: groupName,
          topic: groupTopic,
          scripture_ref: groupScripture || null,
          leader_id: currentUser.id,
          meeting_schedule: groupSchedule || null,
        })
        .select()
        .single();
      if (error) throw error;
      // Auto-join as leader
      await supabase.from("study_group_members").insert({ group_id: data.id, profile_id: currentUser.id });
      setShowCreateGroup(false);
      setGroupName(""); setGroupTopic(""); setGroupScripture(""); setGroupSchedule("");
      loadStudyGroups();
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create study group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const joinStudyGroup = async (groupId: string) => {
    if (!requireAuth()) return;
    try {
      const { error } = await supabase.from("study_group_members").insert({ group_id: groupId, profile_id: currentUser!.id });
      if (error) throw error;
      loadStudyGroups();
    } catch (err) {
      console.error("Error joining group:", err);
    }
  };

  const handleSendStudyMessage = async () => {
    if (!chatMessage.trim() || !currentUser || !activeStudyGroup) return;
    setSendingMessage(true);
    try {
      const modResult = moderateText(chatMessage);
      if (!modResult.allowed) { alert(modResult.reason || "Content flagged."); return; }
      const { error } = await supabase.from("study_messages").insert({
        group_id: activeStudyGroup,
        author_id: currentUser.id,
        content: chatMessage,
        is_flagged: modResult.severity === "warning",
      });
      if (error) throw error;
      setChatMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const openGroupChat = (groupId: string) => {
    setActiveStudyGroup(groupId);
    loadStudyMessages(groupId);
  };

  // Vineyard actions
  const handlePartnerRequest = async () => {
    if (!currentUser) { requireAuth(); return; }
    setSubmittingPartnerRequest(true);
    try {
      const { error } = await supabase.from("partnership_requests").insert({
        requester_id: currentUser.id,
        message: partnerRequestMessage.trim() || null,
      });
      if (error) throw error;
      setPartnerRequestSent(true);
      setExistingRequest(true);
      setShowPartnerRequest(false);
      setPartnerRequestMessage("");
    } catch (err) {
      console.error("Error submitting partner request:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmittingPartnerRequest(false);
    }
  };

  const handleSubmitCheckin = async () => {
    if (!currentUser || !myPartnership) return;
    setSubmittingCheckin(true);
    try {
      const nextWeek = checkins.length > 0 ? Math.max(...checkins.map((c) => c.week_number)) + 1 : 1;
      const { error } = await supabase.from("checkins").insert({
        partnership_id: myPartnership.id,
        author_id: currentUser.id,
        week_number: nextWeek,
        scripture_answer: checkinScripture || null,
        prayer_answer: checkinPrayer || null,
        struggle_answer: checkinStruggle || null,
        win_answer: checkinWin || null,
        service_answer: checkinService || null,
      });
      if (error) throw error;
      setShowCheckinForm(false);
      setCheckinScripture(""); setCheckinPrayer(""); setCheckinStruggle(""); setCheckinWin(""); setCheckinService("");
      loadCheckins(myPartnership.id);
    } catch (err) {
      console.error("Error submitting checkin:", err);
      alert("Failed to submit check-in.");
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Journal actions
  const handleSaveJournal = async () => {
    if (!journalContent.trim() || !currentUser) return;
    setSavingJournal(true);
    try {
      const { error } = await supabase.from("journal_entries").insert({
        profile_id: currentUser.id,
        entry_type: journalType,
        title: journalTitle || null,
        content: journalContent,
        scripture_ref: journalScripture || null,
        visibility: journalVisibility,
        mood: journalMood || null,
      });
      if (error) throw error;
      setShowJournalCompose(false);
      setJournalTitle(""); setJournalContent(""); setJournalScripture(""); setJournalMood("");
      setJournalType("reflection"); setJournalVisibility("private");
      loadJournalEntries();
    } catch (err) {
      console.error("Error saving journal:", err);
      alert("Failed to save journal entry.");
    } finally {
      setSavingJournal(false);
    }
  };

  const deleteJournalEntry = async (id: string) => {
    if (!confirm("Delete this journal entry? This cannot be undone.")) return;
    try {
      await supabase.from("journal_entries").delete().eq("id", id);
      setJournalEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Error deleting journal:", err);
    }
  };

  const togglePinJournal = async (id: string, isPinned: boolean) => {
    try {
      await supabase.from("journal_entries").update({ is_pinned: !isPinned }).eq("id", id);
      setJournalEntries((prev) => prev.map((e) => e.id === id ? { ...e, is_pinned: !isPinned } : e));
    } catch (err) {
      console.error("Error toggling pin:", err);
    }
  };

  // Admin actions
  const approveMember = async (profileId: string) => {
    try {
      await supabase.from("profiles").update({ is_approved: true, role: "disciple" }).eq("id", profileId);
      setPendingMembers((prev) => prev.filter((m) => m.id !== profileId));
    } catch (err) {
      console.error("Error approving member:", err);
    }
  };

  const banMember = async (profileId: string) => {
    if (!confirm("Ban this member? They will not be able to participate.")) return;
    try {
      await supabase.from("profiles").update({ is_banned: true }).eq("id", profileId);
      setPendingMembers((prev) => prev.filter((m) => m.id !== profileId));
    } catch (err) {
      console.error("Error banning member:", err);
    }
  };

  const approvePost = async (postId: string) => {
    try {
      await supabase.from("well_posts").update({ is_flagged: false }).eq("id", postId);
      setFlaggedContent((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Error approving post:", err);
    }
  };

  const removePost = async (postId: string) => {
    if (!confirm("Remove this post permanently?")) return;
    try {
      await supabase.from("well_posts").delete().eq("id", postId);
      setFlaggedContent((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Error removing post:", err);
    }
  };

  const matchPartners = async (requestId: string, requesterId: string) => {
    // For now, this opens a simple prompt - in the future could be a full matching UI
    const partnerId = prompt("Enter the profile ID of the person to match with:");
    if (!partnerId) return;
    try {
      await supabase.from("partnerships").insert({
        partner_a: requesterId,
        partner_b: partnerId,
        matched_by: currentUser!.id,
      });
      await supabase.from("partnership_requests").update({ status: "matched" }).eq("id", requestId);
      setPendingPartnerRequests((prev) => prev.filter((r) => r.id !== requestId));
      loadPartnerships();
    } catch (err) {
      console.error("Error matching partners:", err);
      alert("Failed to match. Make sure the profile ID is correct.");
    }
  };

  // Member profile viewer
  const openMemberProfile = async (member: Profile) => {
    setProfileMember(member);
    setShowMemberProfile(true);
    try {
      const [milestonesRes, journalRes] = await Promise.all([
        supabase.from("milestones").select("*").eq("profile_id", member.id),
        supabase.from("journal_entries").select("*").eq("profile_id", member.id).eq("visibility", "community").order("created_at", { ascending: false }).limit(5),
      ]);
      setProfileMilestones(milestonesRes.data || []);
      setProfileJournal(journalRes.data || []);
    } catch (err) {
      console.error("Error loading member profile:", err);
    }
  };

  /* ════════════════════════════════════════════════════
     COMPUTED VALUES
     ════════════════════════════════════════════════════ */

  const getMemberMilestones = (profileId: string): string[] => {
    return (memberMilestones[profileId] || []).map((m) => m.milestone_type);
  };

  const filteredJournal = useMemo(() => {
    let entries = journalEntries;
    if (journalFilter !== "all") {
      entries = entries.filter((e) => e.entry_type === journalFilter);
    }
    // Pinned entries first
    return [...entries].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });
  }, [journalEntries, journalFilter]);

  const myStudyGroups = useMemo(() => {
    if (!currentUser) return [];
    return studyGroups.filter((g) =>
      g.leader_id === currentUser.id ||
      (g.members || []).some((m) => m.id === currentUser.id)
    );
  }, [studyGroups, currentUser]);

  const currentMilestoneIndex = useMemo(() => {
    if (!currentUser) return -1;
    const ms = getMemberMilestones(currentUser.id);
    return MILESTONES.reduce((max, m, i) => ms.includes(m.id) ? i : max, -1);
  }, [currentUser, memberMilestones]);

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 relative">
      <div className="max-w-5xl mx-auto">

        {/* Threshold — daily entry experience */}
        {currentProfile && showThreshold && (
          <Threshold
            userId={currentProfile?.id}
            organizationId={currentProfile?.organization_id}
            onPass={() => setShowThreshold(false)}
          />
        )}

        {/* ──── Page header ──────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-gold-muted mb-1">Gospel Life</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white/90">Community</h1>
          </div>
          <div className="flex items-center gap-3">
                        {/* User avatar circle — click to change avatar */}
            {currentUser && (
              <button
                type="button"
                onClick={() => router.push("/profile")}
                aria-label="My Profile" title="My Profile"
                className="p-0.5 rounded-full transition-all hover:ring-2 hover:ring-gold-bright/30"
                style={{ border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{
                    background: currentProfile?.avatar_url ? "transparent" : (currentProfile?.color || "#d4af37"),
                    color: "#0a0f1e",
                  }}
                >
                  {currentProfile?.avatar_url ? (
                    <img src={currentProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    currentProfile?.avatar_initials || currentUser?.email?.substring(0, 2).toUpperCase() || "??"
                  )}
                </div>
              </button>
            )}

            {/* Dashboard button */}
            {currentUser && (
              <button
                onClick={() => router.push("/dashboard")}
                aria-label="Dashboard" title="Dashboard"
                className="p-2 rounded-xl transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <LayoutDashboard size={18} className="text-white/40" />
              </button>
            )}

            {/* Profile button — opens member profile */}
            {currentUser && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowAvatarPicker(true); }}
                aria-label="Edit Avatar" title="Edit Avatar"
                className="p-2 rounded-xl transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <UserCircle size={18} className="text-white/40" />
              </button>
            )}

            {/* Notifications bell */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-xl transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Bell size={18} className="text-white/40" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center overflow-hidden"
                      style={{ background: "#e74c3c", color: "white" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 top-12 z-40 w-80 rounded-2xl border overflow-hidden"
                      style={{ background: "rgba(10,15,30,0.97)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-sm font-bold text-white/70">Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={markAllNotificationsRead} className="text-[10px] text-gold-bright hover:text-gold-bright/80">
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-white/20 text-center py-6">No notifications yet</p>
                        ) : notifications.map((n) => (
                          <button key={n.id} onClick={() => { markNotificationRead(n.id); setShowNotifications(false); }}
                            className="w-full text-left px-4 py-3 transition-all hover:bg-white/3"
                            style={{ background: n.is_read ? "transparent" : "rgba(212,175,55,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <p className="text-xs text-white/60">{n.title}</p>
                            {n.body && <p className="text-[10px] text-white/25 mt-0.5">{n.body}</p>}
                            <p className="text-[10px] text-white/40 mt-1">{formatDate(n.created_at)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Admin button */}
            {isPastor && (
              <button onClick={() => { setShowAdmin(true); loadAdminData(); }}
                className="p-2 rounded-xl transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(212,175,55,0.2)" }}>
                <Settings size={18} className="text-gold-bright/60" />
              </button>
            )}

            {/* Sign Out button */}
            {currentUser && (
              <button onClick={handleSignOut}
                aria-label="Sign Out" title="Sign Out" className="p-2 rounded-xl transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <LogOut size={18} className="text-white/40" />
              </button>
            )}
          </div>
        </div>

        {/* ──── Room tabs ────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {ROOMS.map((room) => {
            const isActive = activeRoom === room.id;
            const Icon = room.icon;
            // Journal tab only visible when logged in
            if (room.id === "journal" && !currentUser) return null;
            return (
              <button key={room.id} onClick={() => setActiveRoom(room.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
                style={{
                  background: isActive ? `${room.color}15` : "transparent",
                  border: `1px solid ${isActive ? `${room.color}40` : "rgba(255,255,255,0.06)"}`,
                  color: isActive ? room.color : "rgba(255,255,255,0.4)",
                }}>
                <Icon size={14} />
                <span>{room.label}</span>
              </button>
            );
          })}
        </div>

        {/* ──── Room header ──────────────────────────── */}
        <div className="rounded-2xl border p-5 sm:p-6 mb-6"
          style={{ background: `linear-gradient(135deg, ${currentRoom.color}08, transparent)`, borderColor: `${currentRoom.color}20` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${currentRoom.color}15` }}>
              <currentRoom.icon size={24} style={{ color: currentRoom.color }} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: currentRoom.color }}>
                {currentRoom.label}
              </h2>
              <p className="text-xs text-white/30">
                {currentRoom.description} &middot; <span style={{ color: `${currentRoom.color}88` }}>{currentRoom.scripture}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ──── Join prompt ──────────────────────────── */}
        {showJoinPrompt && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl border flex items-center gap-3 animate-fade-in-up"
            style={{ background: "rgba(10,15,30,0.95)", borderColor: "rgba(212,175,55,0.3)", backdropFilter: "blur(12px)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
            <Lock size={18} color="#d4af37" />
            <div>
              <p className="text-sm font-semibold text-gold-bright">Sign in to participate</p>
              <p className="text-xs text-white/30">Create a free account to join the conversation</p>
            </div>
            <button onClick={() => router.push("/auth")}
              className="ml-4 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:brightness-110"
              style={{ background: "#d4af37", color: "#0a0f1e" }}>
              Sign Up
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════
            THE GATE — PERSONAL DASHBOARD
           ════════════════════════════════════════════ */}
        {activeRoom === "gate" && (
          <div className="space-y-6">
            {!currentUser ? (
              /* Unauthenticated welcome */
              <div className="space-y-6">
                <div className="rounded-2xl border p-8 sm:p-12 text-center"
                  style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.06), transparent 70%), linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                  <DoorOpen size={48} className="mx-auto mb-4" style={{ color: "rgba(212,175,55,0.4)" }} />
                  <h3 className="text-2xl sm:text-3xl font-bold text-gold-bright mb-3">Welcome to Gospel Life</h3>
                  <p className="text-sm text-white/30 max-w-lg mx-auto leading-relaxed mb-6">
                    A community built on the Word, walking together in faith. Share prayer requests, study Scripture together, find an accountability partner, and track your discipleship journey.
                  </p>
                  <button onClick={() => router.push("/auth")}
                    className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: "#d4af37", color: "#0a0f1e" }}>
                    Join the Community
                  </button>
                </div>

                {/* How it works */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ROOMS.filter((r) => !["gate", "journal"].includes(r.id)).map((room) => {
                    const Icon = room.icon;
                    return (
                      <div key={room.id} className="rounded-xl border p-5 text-center"
                        style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                        <Icon size={28} className="mx-auto mb-3" style={{ color: `${room.color}66` }} />
                        <h4 className="text-sm font-bold mb-1" style={{ color: room.color }}>{room.label}</h4>
                        <p className="text-[11px] text-white/25">{room.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Authenticated dashboard */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left column — My snapshot */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Welcome card */}
                  <div className="rounded-2xl border p-6"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(212,175,55,0.1)" }}>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden"
                        style={{ background: currentProfile?.avatar_url ? "transparent" : `${currentProfile?.color || "#95a5a6"}22`, color: currentProfile?.color || "#95a5a6" }}>
                        {currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (currentProfile?.avatar_initials || currentUser?.email?.substring(0, 2).toUpperCase() || "??")}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white/80">Welcome back, {currentProfile?.display_name?.split(" ")[0] || "friend"}</h3>
                        <p className="text-xs text-white/30">
                          {currentMilestoneIndex >= 0
                            ? `Currently at: ${MILESTONES[currentMilestoneIndex].label}`
                            : "Start your discipleship journey"}
                          {myPartnership && " · Partnered up"}
                          {myStudyGroups.length > 0 && ` · ${myStudyGroups.length} study group${myStudyGroups.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                  </div>


                {/* Presence Status */}
                <div className="mt-3">
                  <PresenceSelector
                    userId={currentUser.id}
                    currentStatus={presenceStatus}
                    onUpdate={setPresenceStatus}
                  />
                </div>
                  {/* Quick actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Share Prayer", icon: Hand, color: "#3498db", action: () => { setActiveRoom("well"); setTimeout(() => setShowCompose(true), 100); } },
                      { label: "New Journal", icon: PenLine, color: "#9b59b6", action: () => { setActiveRoom("journal"); setTimeout(() => setShowJournalCompose(true), 100); } },
                      { label: "Study Groups", icon: Flame, color: "#e74c3c", action: () => setActiveRoom("upper_room") },
                      { label: "My Journey", icon: Footprints, color: "#d4af37", action: () => setActiveRoom("ecclesia") },
                    ].map((qa) => (
                      <button key={qa.label} onClick={qa.action}
                        className="rounded-xl border p-4 flex flex-col items-center gap-2 transition-all hover:border-white/15"
                        style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.06)" }}>
                        <qa.icon size={20} style={{ color: qa.color }} />
                        <span className="text-[11px] font-semibold text-white/40">{qa.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Activity feed */}
                  <div className="rounded-2xl border p-5"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 flex items-center gap-2">
                      <Activity size={14} /> Recent Activity
                    </h3>
                    {recentActivity.length === 0 ? (
                      <p className="text-xs text-white/20 text-center py-4">No recent activity yet. Be the first to share!</p>
                    ) : (
                      <div className="space-y-3">
                        {recentActivity.map((act, i) => {
                          const Icon = act.icon;
                          return (
                            <div key={i} className="flex items-center gap-3 py-2"
                              style={{ borderBottom: i < recentActivity.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${act.color}15` }}>
                                <Icon size={13} style={{ color: act.color }} />
                              </div>
                              <p className="text-xs text-white/40 flex-1">{act.text}</p>
                              <span className="text-[10px] text-white/40 shrink-0">{formatDate(act.time)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column — sidebar widgets */}

              {/* Pastor Health Dashboard */}
              {(currentProfile?.role === "pastor" || currentProfile?.role === "elder") && (
                <PastorHealthPanel
                  organizationId={currentProfile?.organization_id}
                  onComposeAnnouncement={() => setActiveRoom("lampstand")}
                />
              )}
                <div className="space-y-6">

                  {/* My study groups */}
                  <div className="rounded-2xl border p-5"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <h4 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-3 flex items-center gap-2">
                      <Flame size={12} /> My Studies
                    </h4>
                    {myStudyGroups.length === 0 ? (
                      <p className="text-[11px] text-white/40 text-center py-3">No study groups yet</p>
                    ) : myStudyGroups.map((g) => (
                      <button key={g.id} onClick={() => { setActiveRoom("upper_room"); setTimeout(() => openGroupChat(g.id), 100); }}
                        className="w-full text-left p-3 rounded-xl mb-2 last:mb-0 transition-all hover:bg-white/3"
                        style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                        <p className="text-xs font-semibold text-white/50">{g.name}</p>
                        <p className="text-[10px] text-white/20">{g.member_count} members</p>
                      </button>
                    ))}
                  </div>

                  {/* My partner */}
                  <div className="rounded-2xl border p-5"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <h4 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-3 flex items-center gap-2">
                      <Grape size={12} /> My Partner
                    </h4>
                    {myPartnership ? (
                      <div>
                        {(() => {
                          const partner = myPartnership.partner_a === currentUser.id
                            ? myPartnership.partner_b_profile
                            : myPartnership.partner_a_profile;
                          return partner ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                                style={{ background: partner.avatar_url ? "transparent" : `${partner.color}22`, color: partner.color }}>
                                {partner.avatar_url ? <img src={partner.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : partner.avatar_initials}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-white/50">{partner.display_name}</p>
                                <p className="text-[10px] text-white/20">{myPartnership.weeks_together} weeks together</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <button onClick={() => setActiveRoom("vineyard")}
                          className="w-full mt-3 py-2 rounded-lg text-[11px] font-semibold text-white/30 transition-all hover:bg-white/5"
                          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                          Go to Vineyard
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-[11px] text-white/40 mb-3">No partner yet</p>
                        <button onClick={() => { setActiveRoom("vineyard"); }}
                          className="px-4 py-2 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110"
                          style={{ background: "rgba(39,174,96,0.15)", border: "1px solid rgba(39,174,96,0.25)", color: "#27ae60" }}>
                          Find a Partner
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Journey progress */}
                  <div className="rounded-2xl border p-5"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <h4 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-3 flex items-center gap-2">
                      <Footprints size={12} /> My Journey
                    </h4>
                    <div className="space-y-2">
                      {MILESTONES.map((m, i) => {
                        const achieved = getMemberMilestones(currentUser.id).includes(m.id);
                        return (
                          <div key={m.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden"
                              style={{ background: achieved ? `${m.color}25` : "rgba(255,255,255,0.03)" }}>
                              {achieved ? <CheckCircle2 size={12} style={{ color: m.color }} /> : <Circle size={12} className="text-white/10" />}
                            </div>
                            <span className="text-[11px]" style={{ color: achieved ? `${m.color}aa` : "rgba(255,255,255,0.15)" }}>
                              {m.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            THE WELL — PRAYER & SHARING
           ════════════════════════════════════════════ */}
        {activeRoom === "well" && (
          <div className="space-y-4">
            {/* Compose button */}
            <button onClick={() => { if (requireAuth()) setShowCompose(true); }}
              className="w-full py-4 rounded-xl border-2 border-dashed text-sm text-white/20 font-semibold transition-all hover:border-white/15 hover:text-white/30"
              style={{ borderColor: "rgba(52,152,219,0.15)" }}>
              <PenLine size={16} className="inline mr-2" />
              Share a prayer, praise, question, or testimony...
            </button>

            {/* Compose modal */}
            {showCompose && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompose(false)} />
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-2xl p-6"
                  style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(52,152,219,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white/80">New Post</h3>
                    <button onClick={() => setShowCompose(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
                  </div>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {Object.entries(POST_TYPES).map(([key, pt]) => (
                      <button key={key} onClick={() => setComposeType(key as typeof composeType)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: composeType === key ? `${pt.color}20` : "transparent",
                          border: `1px solid ${composeType === key ? `${pt.color}50` : "rgba(255,255,255,0.08)"}`,
                          color: composeType === key ? pt.color : "rgba(255,255,255,0.4)",
                        }}>
                        <pt.icon size={12} /> {pt.label}
                      </button>
                    ))}
                  </div>
                  <textarea value={composeContent} onChange={(e) => setComposeContent(e.target.value)}
                    placeholder={`Share your ${composeType === "prayer" ? "prayer request" : composeType === "praise" ? "praise report" : composeType === "question" ? "question" : "testimony"}...`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
                    rows={5} autoFocus />
                  <div className="mt-3">
                    <input type="text" value={composeScripture} onChange={(e) => setComposeScripture(e.target.value)}
                      placeholder="Scripture reference (optional, e.g. John 3:16)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-gold-bright/30" />
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => setShowCompose(false)} className="px-4 py-2 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={handleSubmitPost} disabled={!composeContent.trim() || posting}
                      className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: "rgba(52,152,219,0.2)", border: "1px solid rgba(52,152,219,0.3)", color: "#3498db" }}>
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Loading */}
            {loadingWell && (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="animate-spin text-gold-bright" />
              </div>
            )}

            {/* Posts */}
            {!loadingWell && wellPosts.map((post) => {
              const pt = POST_TYPES[post.post_type];
              const author = post.author as unknown as Profile;
              const isExpanded = expandedPost === post.id;
              return (
                <div key={post.id} className="rounded-xl border p-5 transition-all hover:border-white/10"
                  style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => openMemberProfile(author)} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 overflow-hidden"
                      style={{ background: author?.avatar_url ? "transparent" : `${author?.color || "#95a5a6"}22`, color: author?.color || "#95a5a6" }}>
                      {author?.avatar_url ? <img src={author.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (author?.avatar_initials || "?")}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openMemberProfile(author)} className="text-sm font-semibold text-white/80 hover:text-white/90 transition-colors">
                          {author?.display_name || "Unknown"}
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: `${pt.color}18`, color: pt.color }}>
                          {pt.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/20">{formatDate(post.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed mb-3">{post.content}</p>
                  {post.scripture_ref && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium mb-3"
                      style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", color: "rgba(212,175,55,0.7)" }}>
                      <BookOpen size={11} /> {post.scripture_ref}
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <button onClick={() => handlePrayerHand(post.id)}
                      className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors">
                      <Hand size={13} /> {post.prayer_count > 0 && post.prayer_count}
                      {post.prayer_count === 0 ? "Pray" : ""}
                    </button>
                    <button onClick={() => {
                      if (isExpanded) { setExpandedPost(null); } else { setExpandedPost(post.id); loadResponses(post.id); }
                    }}
                      className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors">
                      <MessageCircle size={13} /> {post.response_count || 0} {(post.response_count || 0) === 0 ? "Reply" : ""}
                    </button>
                  </div>

                  {/* Responses thread */}
                  {isExpanded && (
                    <div className="mt-4 pl-4 space-y-3" style={{ borderLeft: "2px solid rgba(255,255,255,0.04)" }}>
                      {(responses[post.id] || []).map((r) => {
                        const rAuthor = r.author as unknown as Profile;
                        return (
                          <div key={r.id} className="flex gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                              style={{ background: rAuthor?.avatar_url ? "transparent" : `${rAuthor?.color || "#95a5a6"}22`, color: rAuthor?.color || "#95a5a6" }}>
                              {rAuthor?.avatar_url ? <img src={rAuthor.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (rAuthor?.avatar_initials || "?")}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white/50">{rAuthor?.display_name || "Unknown"}</span>
                                <span className="text-[10px] text-white/40">{formatDate(r.created_at)}</span>
                              </div>
                              <p className="text-xs text-white/40 leading-relaxed">{r.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      {/* Reply input */}
                      {currentUser && (
                        <div className="flex gap-2 mt-2">
                          <input type="text" value={replyingTo === post.id ? replyContent : ""}
                            onFocus={() => setReplyingTo(post.id)}
                            onChange={(e) => { setReplyingTo(post.id); setReplyContent(e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && replyContent.trim()) handleSubmitReply(post.id); }}
                            placeholder="Write a reply..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/40 outline-none focus:border-white/20" />
                          <button onClick={() => handleSubmitReply(post.id)}
                            disabled={!replyContent.trim() || replyingTo !== post.id}
                            className="px-3 py-2 rounded-lg transition-all disabled:opacity-20"
                            style={{ background: "rgba(52,152,219,0.15)", color: "#3498db" }}>
                            <Send size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!loadingWell && wellPosts.length === 0 && (
              <p className="text-center text-xs text-white/40 py-8">No posts yet. Be the first to share.</p>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            THE UPPER ROOM — STUDY GROUPS + CHAT
           ════════════════════════════════════════════ */}
        {activeRoom === "upper_room" && (
          <div>
            {activeStudyGroup ? (
              /* ──── Chat view ──────────────────────── */
              (() => {
                const group = studyGroups.find((g) => g.id === activeStudyGroup);
                if (!group) return null;
                return (
                  <div className="space-y-4">
                    {/* Chat header */}
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveStudyGroup(null)}
                        className="p-2 rounded-lg transition-all hover:bg-white/5"
                        style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                        <ChevronRight size={16} className="text-white/40 rotate-180" />
                      </button>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-white/70">{group.name}</h3>
                        <p className="text-[10px] text-white/25">{group.member_count} members &middot; {group.topic}</p>
                      </div>
                    </div>

                    {/* Members list */}
                    {(group.members || []).length > 0 && (
                      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2 font-semibold">Members</p>
                        <div className="flex flex-wrap gap-3">
                          {(group.members || []).map((m) => (
                            <div key={m.id} className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold overflow-hidden"
                                style={{ background: m.avatar_url ? "transparent" : `${m.color}22`, color: m.color, border: "1.5px solid rgba(10,15,30,0.9)" }}>
                                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                              </div>
                              <span className="text-[11px] text-white/50">{m.display_name}</span>
                            </div>
                          ))}
                          {group.leader && (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold overflow-hidden"
                                style={{ background: (group.leader as unknown as Profile).avatar_url ? "transparent" : `${(group.leader as unknown as Profile).color}22`, color: (group.leader as unknown as Profile).color, border: "1.5px solid rgba(231,76,60,0.3)" }}>
                                {(group.leader as unknown as Profile).avatar_url ? <img src={(group.leader as unknown as Profile).avatar_url!} alt="" className="w-full h-full object-cover rounded-full" /> : (group.leader as unknown as Profile).avatar_initials}
                              </div>
                              <span className="text-[11px] text-white/50">{(group.leader as unknown as Profile).display_name} <span className="text-[9px] text-white/20">(leader)</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    <div className="rounded-2xl border overflow-hidden"
                      style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                      <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                        {loadingMessages ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader size={20} className="animate-spin text-white/20" />
                          </div>
                        ) : studyMessages.length === 0 ? (
                          <p className="text-center text-xs text-white/40 py-8">No messages yet. Start the conversation!</p>
                        ) : studyMessages.map((msg) => {
                          const msgAuthor = msg.author as unknown as Profile;
                          const isMe = msg.author_id === currentUser?.id;
                          return (
                            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                                style={{ background: msgAuthor?.avatar_url ? "transparent" : `${msgAuthor?.color || "#95a5a6"}22`, color: msgAuthor?.color || "#95a5a6" }}>
                                {msgAuthor?.avatar_url ? <img src={msgAuthor.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (msgAuthor?.avatar_initials || "?")}
                              </div>
                              <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                                <div className="flex items-center gap-2 mb-1" style={{ justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                  <span className="text-[10px] font-semibold text-white/40">{msgAuthor?.display_name || "Unknown"}</span>
                                  <span className="text-[9px] text-white/40">{formatDate(msg.created_at)}</span>
                                </div>
                                <div className="rounded-xl px-4 py-2.5 text-xs text-white/60 leading-relaxed"
                                  style={{
                                    background: isMe ? "rgba(231,76,60,0.1)" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isMe ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.04)"}`,
                                  }}>
                                  {msg.content}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat input */}
                      {currentUser && (
                        <div className="p-3 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <input type="text" value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && chatMessage.trim()) handleSendStudyMessage(); }}
                            placeholder="Type a message..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white/70 placeholder:text-white/40 outline-none focus:border-white/20" />
                          <button onClick={handleSendStudyMessage} disabled={!chatMessage.trim() || sendingMessage}
                            className="px-4 py-2.5 rounded-lg transition-all disabled:opacity-20"
                            style={{ background: "rgba(231,76,60,0.2)", border: "1px solid rgba(231,76,60,0.3)", color: "#e74c3c" }}>
                            <Send size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ──── Group list view ───────────────── */
              <div className="space-y-4">
                {loadingGroups ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader size={24} className="animate-spin text-gold-bright" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studyGroups.map((group) => {
                      const leader = group.leader as unknown as Profile;
                      const isMember = currentUser && (
                        group.leader_id === currentUser.id ||
                        (group.members || []).some((m) => m.id === currentUser.id)
                      );
                      return (
                        <div key={group.id} className="rounded-xl border p-5"
                          style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen size={14} style={{ color: "rgba(231,76,60,0.5)" }} />
                            <h4 className="text-sm font-bold text-white/70">{group.name}</h4>
                          </div>
                          <p className="text-[11px] text-white/30 mb-3 leading-relaxed">{group.topic}</p>
                          {group.scripture_ref && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] mb-3"
                              style={{ background: "rgba(231,76,60,0.06)", color: "rgba(231,76,60,0.5)" }}>
                              <BookOpen size={10} /> {group.scripture_ref}
                            </div>
                          )}
                          <div className="mb-3">
                            <div className="flex items-center gap-1 mb-2">
                              {(group.members || []).slice(0, 5).map((m) => (
                                <div key={m.id} title={m.display_name} className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold -ml-1 first:ml-0 overflow-hidden cursor-default"
                                  style={{ background: m.avatar_url ? "transparent" : `${m.color}22`, color: m.color, border: "2px solid rgba(10,15,30,0.9)" }}>
                                  {m.avatar_url ? <img src={m.avatar_url} alt={m.display_name} className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                                </div>
                              ))}
                              <span className="text-[10px] text-white/20 ml-2">{group.member_count || 0}/{group.max_members}</span>
                            </div>
                            {(group.members || []).length > 0 && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                {(group.members || []).map((m) => (
                                  <span key={m.id} className="text-[10px] text-white/40">{m.display_name}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] text-white/25 mb-4">
                            Led by <span className="text-white/50">{leader?.display_name || "Unknown"}</span>
                            {group.meeting_schedule && <><br />Schedule: <span className="text-white/50">{group.meeting_schedule}</span></>}
                          </div>
                          {isMember ? (
                            <button onClick={() => openGroupChat(group.id)}
                              className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                              style={{ background: "rgba(231,76,60,0.15)", border: "1px solid rgba(231,76,60,0.25)", color: "#e74c3c" }}>
                              <MessageCircle size={12} className="inline mr-1.5" /> Open Discussion
                            </button>
                          ) : (
                            <button onClick={() => joinStudyGroup(group.id)}
                              className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
                              style={{ border: "1px solid rgba(231,76,60,0.25)", color: "#e74c3c" }}>
                              <UserPlus size={12} className="inline mr-1.5" /> Join Group
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Create group card */}
                    <button onClick={() => { if (requireAuth()) setShowCreateGroup(true); }}
                      className="rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center gap-3 transition-all hover:border-white/15"
                      style={{ borderColor: "rgba(255,255,255,0.08)", minHeight: 200 }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden" style={{ background: "rgba(231,76,60,0.08)" }}>
                        <Flame size={20} style={{ color: "rgba(231,76,60,0.4)" }} />
                      </div>
                      <span className="text-sm text-white/20 font-semibold">Start a New Study</span>
                      <span className="text-[10px] text-white/10">Choose a book, invite up to 11 others</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Create group modal */}
            {showCreateGroup && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateGroup(false)} />
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-2xl p-6"
                  style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(231,76,60,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white/80">Start a New Study</h3>
                    <button onClick={() => setShowCreateGroup(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block">Study Name *</label>
                      <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Gospel of John Deep Dive"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20" autoFocus />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block">Topic / Description *</label>
                      <textarea value={groupTopic} onChange={(e) => setGroupTopic(e.target.value)}
                        placeholder="What will this study cover?"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={3} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block">Scripture Reference</label>
                      <input type="text" value={groupScripture} onChange={(e) => setGroupScripture(e.target.value)}
                        placeholder="e.g. John 1-21 (optional)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block">Meeting Schedule</label>
                      <input type="text" value={groupSchedule} onChange={(e) => setGroupSchedule(e.target.value)}
                        placeholder="e.g. Wednesdays 7pm (optional)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={handleCreateGroup} disabled={!groupName.trim() || !groupTopic.trim() || creatingGroup}
                      className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: "rgba(231,76,60,0.2)", border: "1px solid rgba(231,76,60,0.3)", color: "#e74c3c" }}>
                      {creatingGroup ? "Creating..." : "Create Study"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            THE VINEYARD — PARTNERSHIPS + CHECK-INS
           ════════════════════════════════════════════ */}
        {activeRoom === "vineyard" && (
          <div className="space-y-6">
            {/* My partnership section */}
            {currentUser && myPartnership ? (
              <div className="space-y-4">
                {/* Partner card */}
                {(() => {
                  const partner = myPartnership.partner_a === currentUser.id
                    ? myPartnership.partner_b_profile as unknown as Profile
                    : myPartnership.partner_a_profile as unknown as Profile;
                  return (
                    <div className="rounded-2xl border p-6"
                      style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(39,174,96,0.15)" }}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex -space-x-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold z-10 overflow-hidden"
                            style={{ background: currentProfile?.avatar_url ? "transparent" : `${currentProfile?.color || "#95a5a6"}22`, color: currentProfile?.color || "#95a5a6", border: "3px solid rgba(10,15,30,0.9)" }}>
                            {currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (currentProfile?.avatar_initials || currentUser?.email?.substring(0, 2).toUpperCase() || "??")}
                          </div>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                            style={{ background: partner?.avatar_url ? "transparent" : `${partner?.color || "#95a5a6"}22`, color: partner?.color || "#95a5a6", border: "3px solid rgba(10,15,30,0.9)" }}>
                            {partner?.avatar_url ? <img src={partner.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (partner?.avatar_initials || "??")}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white/70">You & {partner?.display_name || "Your Partner"}</h3>
                          <p className="text-[11px] text-white/25">{myPartnership.weeks_together} weeks walking together</p>
                        </div>
                        <button onClick={() => setShowCheckinForm(true)}
                          className="ml-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                          style={{ background: "rgba(39,174,96,0.2)", border: "1px solid rgba(39,174,96,0.3)", color: "#27ae60" }}>
                          <CheckSquare size={13} className="inline mr-1.5" /> Weekly Check-In
                        </button>
                      </div>

                      {/* Check-in history */}
                      {checkins.length > 0 && (
                        <div>
                          <h4 className="text-[11px] uppercase tracking-wider text-white/25 mb-3">Recent Check-Ins</h4>
                          <div className="space-y-2">
                            {checkins.slice(0, 4).map((ci) => {
                              const isMe = ci.author_id === currentUser.id;
                              return (
                                <div key={ci.id} className="rounded-xl p-4"
                                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold" style={{ color: "rgba(39,174,96,0.7)" }}>
                                      Week {ci.week_number} — {isMe ? "You" : partner?.display_name}
                                    </span>
                                    <span className="text-[10px] text-white/40">{formatDate(ci.created_at)}</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    {ci.scripture_answer && <div><span className="text-white/20">Scripture: </span><span className="text-white/40">{ci.scripture_answer}</span></div>}
                                    {ci.win_answer && <div><span className="text-white/20">Win: </span><span className="text-white/40">{ci.win_answer}</span></div>}
                                    {ci.prayer_answer && <div><span className="text-white/20">Prayer: </span><span className="text-white/40">{ci.prayer_answer}</span></div>}
                                    {ci.service_answer && <div><span className="text-white/20">Service: </span><span className="text-white/40">{ci.service_answer}</span></div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : currentUser ? (
              /* No partner — request one */
              <div className="rounded-2xl border p-8 text-center"
                style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(39,174,96,0.1)" }}>
                <Grape size={40} className="mx-auto mb-3" style={{ color: "rgba(39,174,96,0.3)" }} />
                <h3 className="text-lg font-bold text-white/60 mb-2">Accountability Partnership</h3>
                <p className="text-xs text-white/25 max-w-md mx-auto mb-5 leading-relaxed">
                  Walk alongside another believer. Share victories, struggles, and prayers. Pastor Charlie will personally match you with someone on a similar path.
                </p>
                {existingRequest || partnerRequestSent ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
                    style={{ background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.2)", color: "rgba(39,174,96,0.7)" }}>
                    <CheckCircle2 size={14} /> Your request has been submitted
                  </div>
                ) : (
                  <button onClick={() => setShowPartnerRequest(true)}
                    className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: "#27ae60", color: "#0a0f1e" }}>
                    Request a Partner
                  </button>
                )}
              </div>
            ) : null}

            {/* Community partnerships */}
            {partnerships.length > 0 && (
              <div className="rounded-2xl border p-5"
                style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                <h3 className="text-sm font-bold tracking-widest uppercase text-white/30 mb-4">Active Partnerships</h3>
                <div className="space-y-2">
                  {partnerships.map((p) => {
                    const partnerA = p.partner_a_profile as unknown as Profile;
                    const partnerB = p.partner_b_profile as unknown as Profile;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="flex -space-x-2">
                          {[partnerA, partnerB].filter(Boolean).map((m) => (
                            <div key={m.id} className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
                              style={{ background: m.avatar_url ? "transparent" : `${m.color}22`, color: m.color, border: "2px solid rgba(10,15,30,0.9)" }}>
                              {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/50 truncate">{partnerA?.display_name} & {partnerB?.display_name}</p>
                          <p className="text-[10px] text-white/20">{p.weeks_together} weeks together</p>
                        </div>
                        <Grape size={14} style={{ color: "rgba(39,174,96,0.3)" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Partner request modal */}
            {showPartnerRequest && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowPartnerRequest(false)} />
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-2xl p-6"
                  style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(39,174,96,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white/80">Request an Accountability Partner</h3>
                    <button onClick={() => setShowPartnerRequest(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed mb-4">
                    Pastor Charlie will personally pair you with someone walking a similar path. Optionally share a bit about where you are in your walk.
                  </p>
                  <textarea value={partnerRequestMessage} onChange={(e) => setPartnerRequestMessage(e.target.value)}
                    placeholder="(Optional) Share a little about yourself..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
                    rows={4} autoFocus />
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowPartnerRequest(false)} className="flex-1 py-3 rounded-xl text-xs font-semibold text-white/40 transition-all hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
                    <button onClick={handlePartnerRequest} disabled={submittingPartnerRequest}
                      className="flex-1 py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
                      style={{ background: "#27ae60", color: "#0a0f1e" }}>
                      {submittingPartnerRequest ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Check-in form modal */}
            {showCheckinForm && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckinForm(false)} />
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
                  style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(39,174,96,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white/80">Weekly Check-In</h3>
                    <button onClick={() => setShowCheckinForm(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block flex items-center gap-2">
                        <BookOpen size={11} /> What scripture spoke to you this week?
                      </label>
                      <textarea value={checkinScripture} onChange={(e) => setCheckinScripture(e.target.value)}
                        placeholder="Share a verse or passage..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={2} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block flex items-center gap-2">
                        <Hand size={11} /> How is your prayer life?
                      </label>
                      <textarea value={checkinPrayer} onChange={(e) => setCheckinPrayer(e.target.value)}
                        placeholder="Consistent, struggling, growing..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={2} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block flex items-center gap-2">
                        <AlertTriangle size={11} /> Any struggles or temptations?
                      </label>
                      <textarea value={checkinStruggle} onChange={(e) => setCheckinStruggle(e.target.value)}
                        placeholder="Be honest — this is a safe space..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={2} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block flex items-center gap-2">
                        <Star size={11} /> Any wins or victories?
                      </label>
                      <textarea value={checkinWin} onChange={(e) => setCheckinWin(e.target.value)}
                        placeholder="Celebrate what God is doing..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={2} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/30 mb-1 block flex items-center gap-2">
                        <Heart size={11} /> How did you serve someone this week?
                      </label>
                      <textarea value={checkinService} onChange={(e) => setCheckinService(e.target.value)}
                        placeholder="Big or small acts of service..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" rows={2} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => setShowCheckinForm(false)} className="px-4 py-2 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={handleSubmitCheckin} disabled={submittingCheckin}
                      className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: "rgba(39,174,96,0.2)", border: "1px solid rgba(39,174,96,0.3)", color: "#27ae60" }}>
                      {submittingCheckin ? "Submitting..." : "Submit Check-In"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            THE ECCLESIA — JOURNEY MAP + MEMBERS
           ════════════════════════════════════════════ */}
        {activeRoom === "ecclesia" && (
          <div className="space-y-8">
            <p className="text-sm text-white/30 leading-relaxed max-w-2xl">
              The Ecclesia — the called-out assembly. This is the heart of discipleship: seeing where you are, where you&apos;re going, and who&apos;s walking with you.
            </p>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="animate-spin text-gold-bright" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Journey Map */}
                <div className="lg:col-span-3">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-gold-muted mb-4 flex items-center gap-2">
                    <Footprints size={14} /> The Discipleship Journey
                  </h3>
                  <div className="rounded-2xl border p-6"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(212,175,55,0.1)" }}>
                    <div className="relative">
                      {MILESTONES.map((milestone, i) => {
                        const Icon = milestone.icon;
                        const isLast = i === MILESTONES.length - 1;
                        const membersAtMilestone = members.filter((m) => {
                          const memberMs = getMemberMilestones(m.id);
                          const idx = MILESTONES.findIndex((ms) => ms.id === milestone.id);
                          const memberHighest = MILESTONES.reduce((max, ms, msIdx) => {
                            return memberMs.includes(ms.id) ? msIdx : max;
                          }, -1);
                          return memberHighest === idx;
                        });
                        return (
                          <div key={milestone.id} className="flex items-start gap-4 mb-1">
                            <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center relative z-10"
                                style={{ background: `${milestone.color}15`, border: `2px solid ${milestone.color}44`, boxShadow: `0 0 16px ${milestone.color}22` }}>
                                <Icon size={20} style={{ color: milestone.color }} />
                              </div>
                              {!isLast && (
                                <div className="w-px h-8"
                                  style={{ background: `linear-gradient(${milestone.color}44, ${MILESTONES[i + 1].color}44)` }} />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold" style={{ color: milestone.color }}>{milestone.label}</h4>
                                <span className="text-[9px] px-2 py-0.5 rounded-full"
                                  style={{ background: `${milestone.color}12`, color: `${milestone.color}88` }}>
                                  {milestone.scripture}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/30 mt-1 leading-relaxed">{milestone.description}</p>
                              <div className="flex items-center gap-1 mt-2">
                                {membersAtMilestone.map((m) => (
                                  <button key={m.id} onClick={() => openMemberProfile(m)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold cursor-pointer hover:scale-125 transition-transform overflow-hidden"
                                    style={{ background: m.avatar_url ? "transparent" : `${m.color}25`, color: m.color }}
                                    title={m.display_name}>
                                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* The Body — member list */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-gold-muted mb-2 flex items-center gap-2">
                    <Users size={14} /> The Body
                  </h3>
                  <div className="rounded-2xl border p-4"
                    style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const ms = getMemberMilestones(m.id);
                        const highest = MILESTONES.reduce((max, milestone, idx) => ms.includes(milestone.id) ? idx : max, -1);
                        const milestoneInfo = highest >= 0 ? MILESTONES[highest] : null;
                        return (
                          <button key={m.id} onClick={() => openMemberProfile(m)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/3 text-left"
                            style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                              style={{ background: m.avatar_url ? "transparent" : `${m.color}22`, color: m.color }}>
                              {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white/60 truncate">{m.display_name}</p>
                              <p className="text-[10px] text-white/20">
                                {m.role === "pastor" ? "Pastor" : milestoneInfo ? milestoneInfo.label : "New Member"}
                              </p>
                            </div>
                            {milestoneInfo && (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden"
                                style={{ background: `${milestoneInfo.color}15` }}>
                                <milestoneInfo.icon size={12} style={{ color: milestoneInfo.color }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            MY JOURNAL — PERSONAL SPIRITUAL JOURNAL
           ════════════════════════════════════════════ */}
        {activeRoom === "journal" && currentUser && (
          <div className="space-y-4">
            {/* Compose + filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setShowJournalCompose(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: "rgba(155,89,182,0.2)", border: "1px solid rgba(155,89,182,0.3)", color: "#9b59b6" }}>
                <PenLine size={13} /> New Entry
              </button>
              <div className="flex gap-1 flex-wrap flex-1">
                {[{ id: "all", label: "All" }, ...Object.entries(JOURNAL_TYPES).map(([id, jt]) => ({ id, label: jt.label }))].map((f) => (
                  <button key={f.id} onClick={() => setJournalFilter(f.id)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: journalFilter === f.id ? "rgba(155,89,182,0.15)" : "transparent",
                      border: `1px solid ${journalFilter === f.id ? "rgba(155,89,182,0.3)" : "rgba(255,255,255,0.06)"}`,
                      color: journalFilter === f.id ? "#9b59b6" : "rgba(255,255,255,0.3)",
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Journal entries */}
            {loadingJournal ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="animate-spin text-gold-bright" />
              </div>
            ) : filteredJournal.length === 0 ? (
              <div className="text-center py-12">
                <PenLine size={40} className="mx-auto mb-3" style={{ color: "rgba(155,89,182,0.2)" }} />
                <p className="text-sm text-white/20 mb-2">Your journal is empty</p>
                <p className="text-xs text-white/10">Start recording your spiritual journey — dreams, visions, testimonies, and reflections.</p>
              </div>
            ) : filteredJournal.map((entry) => {
              const jt = JOURNAL_TYPES[entry.entry_type];
              const moodInfo = entry.mood ? MOODS[entry.mood] : null;
              const isExpanded = expandedJournal === entry.id;
              const vis = VISIBILITY_OPTIONS.find((v) => v.id === entry.visibility);
              return (
                <div key={entry.id} className="rounded-xl border p-5 transition-all"
                  style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(20,20,35,0.9) 100%)", borderColor: entry.is_pinned ? "rgba(155,89,182,0.2)" : "rgba(255,255,255,0.05)" }}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background: `${jt.color}15`, color: jt.color }}>
                        <jt.icon size={10} className="inline mr-1" />{jt.label}
                      </span>
                      {moodInfo && (
                        <span className="px-2 py-1 rounded-lg text-[10px]"
                          style={{ background: `${moodInfo.color}10`, color: `${moodInfo.color}88` }}>
                          {moodInfo.label}
                        </span>
                      )}
                      {vis && (
                        <span className="text-[9px] text-white/40 flex items-center gap-1">
                          <vis.icon size={9} /> {vis.label}
                        </span>
                      )}
                      {entry.is_pinned && <Bookmark size={11} style={{ color: "#9b59b6" }} />}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => togglePinJournal(entry.id, entry.is_pinned)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white/30 transition-colors">
                        <Bookmark size={12} />
                      </button>
                      <button onClick={() => deleteJournalEntry(entry.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400/50 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Title & date */}
                  {entry.title && <h4 className="text-sm font-bold text-white/70 mb-1">{entry.title}</h4>}
                  <p className="text-[10px] text-white/40 mb-3">{formatFullDate(entry.created_at)}</p>

                  {/* Content */}
                  <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">
                    {isExpanded ? entry.content : entry.content.length > 200 ? entry.content.slice(0, 200) + "..." : entry.content}
                  </p>
                  {entry.content.length > 200 && (
                    <button onClick={() => setExpandedJournal(isExpanded ? null : entry.id)}
                      className="text-[11px] mt-2 transition-colors"
                      style={{ color: "rgba(155,89,182,0.6)" }}>
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}

                  {/* Scripture */}
                  {entry.scripture_ref && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium mt-3"
                      style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", color: "rgba(212,175,55,0.7)" }}>
                      <BookOpen size={11} /> {entry.scripture_ref}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Journal compose modal */}
            {showJournalCompose && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowJournalCompose(false)} />
                <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
                  style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(155,89,182,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white/80">New Journal Entry</h3>
                    <button onClick={() => setShowJournalCompose(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
                  </div>

                  {/* Entry type */}
                  <div className="mb-4">
                    <label className="text-[11px] uppercase tracking-wider text-white/30 mb-2 block">Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(JOURNAL_TYPES).map(([key, jt]) => (
                        <button key={key} onClick={() => setJournalType(key as JournalEntry["entry_type"])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: journalType === key ? `${jt.color}20` : "transparent",
                            border: `1px solid ${journalType === key ? `${jt.color}50` : "rgba(255,255,255,0.08)"}`,
                            color: journalType === key ? jt.color : "rgba(255,255,255,0.4)",
                          }}>
                          <jt.icon size={12} /> {jt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div className="mb-4">
                    <label className="text-[11px] uppercase tracking-wider text-white/30 mb-2 block">How are you feeling?</label>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(MOODS).map(([key, m]) => (
                        <button key={key} onClick={() => setJournalMood(journalMood === key ? "" : key)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] transition-all"
                          style={{
                            background: journalMood === key ? `${m.color}15` : "transparent",
                            border: `1px solid ${journalMood === key ? `${m.color}40` : "rgba(255,255,255,0.06)"}`,
                            color: journalMood === key ? m.color : "rgba(255,255,255,0.3)",
                          }}>
                          <m.icon size={10} /> {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-3">
                    <input type="text" value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20" />
                  </div>

                  {/* Content */}
                  <div className="mb-3">
                    <textarea value={journalContent} onChange={(e) => setJournalContent(e.target.value)}
                      placeholder="Write your thoughts, what God is showing you, what you're experiencing..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
                      rows={6} autoFocus />
                  </div>

                  {/* Scripture */}
                  <div className="mb-4">
                    <input type="text" value={journalScripture} onChange={(e) => setJournalScripture(e.target.value)}
                      placeholder="Scripture reference (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-gold-bright/30" />
                  </div>

                  {/* Visibility */}
                  <div className="mb-5">
                    <label className="text-[11px] uppercase tracking-wider text-white/30 mb-2 block">Who can see this?</label>
                    <div className="flex gap-2 flex-wrap">
                      {VISIBILITY_OPTIONS.map((v) => (
                        <button key={v.id} onClick={() => setJournalVisibility(v.id as JournalEntry["visibility"])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: journalVisibility === v.id ? `${v.color}15` : "transparent",
                            border: `1px solid ${journalVisibility === v.id ? `${v.color}40` : "rgba(255,255,255,0.06)"}`,
                            color: journalVisibility === v.id ? v.color : "rgba(255,255,255,0.3)",
                          }}>
                          <v.icon size={11} /> {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowJournalCompose(false)} className="px-4 py-2 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={handleSaveJournal} disabled={!journalContent.trim() || savingJournal}
                      className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: "rgba(155,89,182,0.2)", border: "1px solid rgba(155,89,182,0.3)", color: "#9b59b6" }}>
                      {savingJournal ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            MEMBER PROFILE MODAL
           ════════════════════════════════════════════ */}
        {showMemberProfile && profileMember && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowMemberProfile(false)} />
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
              style={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(212,175,55,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                    style={{ background: profileMember.avatar_url ? "transparent" : `${profileMember.color}22`, color: profileMember.color }}>
                    {profileMember.avatar_url ? <img src={profileMember.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : profileMember.avatar_initials}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white/80">{profileMember.display_name}</h3>
                    <p className="text-[11px] text-white/25 capitalize">{profileMember.role} &middot; Joined {formatDate(profileMember.join_date)}</p>
                  </div>
                </div>
                <button onClick={() => setShowMemberProfile(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
              </div>

              {/* Milestones achieved */}
              <div className="mb-5">
                <h4 className="text-[11px] uppercase tracking-wider text-white/25 mb-3">Journey Milestones</h4>
                <div className="space-y-2">
                  {MILESTONES.map((m) => {
                    const achieved = profileMilestones.some((pm) => pm.milestone_type === m.id);
                    const Icon = m.icon;
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg"
                        style={{ opacity: achieved ? 1 : 0.3 }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: achieved ? `${m.color}20` : "rgba(255,255,255,0.03)" }}>
                          <Icon size={14} style={{ color: achieved ? m.color : "rgba(255,255,255,0.2)" }} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: achieved ? m.color : "rgba(255,255,255,0.2)" }}>{m.label}</p>
                          <p className="text-[10px] text-white/40">{m.scripture}</p>
                        </div>
                        {achieved && <CheckCircle2 size={14} style={{ color: m.color }} className="ml-auto" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Community journal entries */}
              {profileJournal.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider text-white/25 mb-3">Shared Journal Entries</h4>
                  <div className="space-y-2">
                    {profileJournal.map((entry) => {
                      const jt = JOURNAL_TYPES[entry.entry_type];
                      return (
                        <div key={entry.id} className="p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold" style={{ color: jt.color }}>{jt.label}</span>
                            <span className="text-[9px] text-white/40">{formatDate(entry.created_at)}</span>
                          </div>
                          {entry.title && <p className="text-xs font-semibold text-white/50 mb-1">{entry.title}</p>}
                          <p className="text-[11px] text-white/30 leading-relaxed">
                            {entry.content.length > 150 ? entry.content.slice(0, 150) + "..." : entry.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            MESSAGES TAB — Integrated 2-Column DM Layout
           ════════════════════════════════════════════ */}
        {activeRoom === "messages" && currentUser && (
          <div style={{
            display: "grid",
            gridTemplateColumns: activeConvo ? "300px 1fr" : "1fr",
            gap: "1rem",
            minHeight: 500
          }}>
            {/* Left: Conversation list */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: 0 }}>
              <div style={{
                padding: "1rem",
                borderBottom: "1px solid rgba(212,175,55,0.15)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h3 className="text-sm font-bold text-gold-bright" style={{ margin: 0 }}>
                  Conversations
                </h3>
                <button
                  onClick={() => setShowNewConvo(!showNewConvo)}
                  className="text-[11px] font-bold"
                  style={{
                    background: "#d4af37",
                    color: "#0a0f1e",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    cursor: "pointer"
                  }}
                >
                  + New
                </button>
              </div>

              {/* New conversation search */}
              {showNewConvo && (
                <div style={{ padding: "0.75rem", borderBottom: "1px solid rgba(212,175,55,0.1)" }}>
                  <input
                    placeholder="Search members..."
                    value={newConvoSearch}
                    onChange={(e) => setNewConvoSearch(e.target.value)}
                    className="w-full text-sm"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(212,175,55,0.2)",
                      background: "rgba(10,15,30,0.6)",
                      color: "#e8e0d0",
                      fontSize: "0.85rem"
                    }}
                  />
                  {newConvoSearch.length > 1 && (
                    <div style={{ maxHeight: 150, overflowY: "auto", marginTop: "0.5rem" }}>
                      {members
                        .filter(m =>
                          m.display_name.toLowerCase().includes(newConvoSearch.toLowerCase())
                          && m.id !== currentUser.id
                        )
                        .slice(0, 8)
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => startNewConversation(m.id)}
                            className="flex items-center gap-2 w-full text-left"
                            style={{
                              padding: "6px 8px",
                              background: "none",
                              border: "none",
                              color: "#e8e0d0",
                              cursor: "pointer",
                              borderRadius: 4,
                              fontSize: "0.85rem"
                            }}
                          >
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%",
                              background: m.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.6rem", fontWeight: 800,
                              color: "#0a0f1e", flexShrink: 0
                            }}>
                              {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                            </div>
                            {m.display_name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation list */}
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {conversations.length === 0 && (
                  <p className="text-center text-xs text-white/20 py-8">
                    No conversations yet. Start one!
                  </p>
                )}
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => loadConvoMessages(c.id)}
                    className="flex items-center gap-3 w-full text-left"
                    style={{
                      padding: "12px 1rem",
                      background: activeConvo === c.id ? "rgba(212,175,55,0.1)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: c.partner?.avatar_url ? "transparent" : (c.partner?.color || "#555"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.7rem", fontWeight: 800,
                      color: "#0a0f1e", flexShrink: 0,
                      overflow: "hidden"
                    }}>
                      {c.partner?.avatar_url ? <img src={c.partner.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (c.partner?.avatar_initials || "??")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-white/70">
                          {c.partner?.display_name || "Unknown"}
                        </span>
                        {(c.unread_count || 0) > 0 && (
                          <span style={{
                            background: "#d4af37",
                            color: "#0a0f1e",
                            borderRadius: 10,
                            padding: "1px 7px",
                            fontSize: "0.7rem",
                            fontWeight: 700
                          }}>
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/20 truncate" style={{ margin: 0 }}>
                        {c.last_message || "No messages yet"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Message thread */}
            {activeConvo && (
              <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: 0 }}>
                {/* Thread header */}
                <div style={{
                  padding: "1rem",
                  borderBottom: "1px solid rgba(212,175,55,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem"
                }}>
                  {(() => {
                    const c = conversations.find(x => x.id === activeConvo);
                    return c?.partner ? (
                      <>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: c.partner.avatar_url ? "transparent" : c.partner.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.65rem", fontWeight: 800, color: "#0a0f1e",
                          overflow: "hidden"
                        }}>
                          {c.partner.avatar_url ? <img src={c.partner.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : c.partner.avatar_initials}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white/70">{c.partner.display_name}</div>
                          <div className="text-[11px] text-white/20">{c.partner.role}</div>
                        </div>
                      </>
                    ) : null;
                  })()}
                  <button
                    onClick={() => { setActiveConvo(null); setConvoMessages([]); }}
                    className="ml-auto text-white/20 hover:text-white/50 transition-colors"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Messages area */}
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  maxHeight: 380
                }}>
                  {convoMessages.length === 0 && (
                    <p className="text-center text-xs text-white/40 py-8">Start the conversation!</p>
                  )}
                  {convoMessages.map(m => {
                    const isMine = m.sender_id === currentUser.id;
                    return (
                      <div key={m.id} style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start"
                      }}>
                        <div style={{
                          maxWidth: "70%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isMine ? "flex-end" : "flex-start"
                        }}>
                          {!isMine && (
                            <span style={{
                              fontSize: "0.7rem",
                              color: m.sender?.color || "rgba(255,255,255,0.3)",
                              fontWeight: 600,
                              marginBottom: 2
                            }}>
                              {m.sender?.display_name}
                            </span>
                          )}
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            background: isMine ? "rgba(212,175,55,0.12)" : "rgba(10,15,30,0.8)",
                            color: "#e8e0d0",
                            fontSize: "0.9rem",
                            lineHeight: 1.5,
                            borderBottomRightRadius: isMine ? 4 : 12,
                            borderBottomLeftRadius: isMine ? 12 : 4,
                          }}>
                            {m.content}
                          </div>
                          <span style={{
                            fontSize: "0.65rem",
                            color: "rgba(255,255,255,0.2)",
                            marginTop: 2
                          }}>
                            {formatDate(m.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message input */}
                <div style={{
                  padding: "0.75rem 1rem",
                  borderTop: "1px solid rgba(212,175,55,0.15)",
                  display: "flex",
                  gap: "0.5rem"
                }}>
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendDirectMessage()}
                    placeholder="Type a message..."
                    className="flex-1 text-sm"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(212,175,55,0.2)",
                      background: "rgba(10,15,30,0.6)",
                      color: "#e8e0d0",
                      fontSize: "0.9rem"
                    }}
                  />
                  <button
                    onClick={sendDirectMessage}
                    disabled={!newMessage.trim()}
                    className="font-bold"
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#d4af37",
                      color: "#0a0f1e",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: newMessage.trim() ? 1 : 0.5
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


          {/* ── The Lampstand ─────────────────────────────── */}
          {activeRoom === "lampstand" && (
            <LampstandRoom
              userId={currentUser.id}
              organizationId={currentProfile?.organization_id}
              userRole={currentProfile?.role}
            />
          )}

        {/* ════════════════════════════════════════════
            ADMIN PANEL
           ════════════════════════════════════════════ */}
        {showAdmin && isPastor && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdmin(false)} />
            <div className="fixed inset-4 z-50 rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "rgba(10,15,30,0.98)", border: "1px solid rgba(212,175,55,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>

              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h2 className="text-lg font-bold text-gold-bright flex items-center gap-2">
                  <Shield size={18} /> Pastor Admin Panel
                </h2>
                <button onClick={() => setShowAdmin(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {loadingAdmin ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader size={24} className="animate-spin text-gold-bright" />
                  </div>
                ) : (
                  <>
                    {/* Pending members */}
                    <div>
                      <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 flex items-center gap-2">
                        <UserCheck size={14} /> Pending Members ({pendingMembers.length})
                      </h3>
                      {pendingMembers.length === 0 ? (
                        <p className="text-xs text-white/40">No pending members</p>
                      ) : (
                        <div className="space-y-2">
                          {pendingMembers.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                                style={{ background: m.avatar_url ? "transparent" : `${m.color}22`, color: m.color }}>
                                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : m.avatar_initials}
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-white/60">{m.display_name}</p>
                                <p className="text-[10px] text-white/20">Joined {formatDate(m.join_date)}</p>
                              </div>
                              <button onClick={() => approveMember(m.id)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                                style={{ background: "rgba(39,174,96,0.2)", color: "#27ae60" }}>
                                Approve
                              </button>
                              <button onClick={() => banMember(m.id)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                                style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c" }}>
                                Deny
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Partner requests */}
                    <div>
                      <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 flex items-center gap-2">
                        <Grape size={14} /> Partner Requests ({pendingPartnerRequests.length})
                      </h3>
                      {pendingPartnerRequests.length === 0 ? (
                        <p className="text-xs text-white/40">No pending requests</p>
                      ) : (
                        <div className="space-y-2">
                          {pendingPartnerRequests.map((req) => {
                            const requester = req.requester as unknown as Profile;
                            return (
                              <div key={req.id} className="p-4 rounded-xl"
                                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
                                    style={{ background: requester?.avatar_url ? "transparent" : `${requester?.color || "#95a5a6"}22`, color: requester?.color || "#95a5a6" }}>
                                    {requester?.avatar_url ? <img src={requester.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : (requester?.avatar_initials || "?")}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-white/60">{requester?.display_name || "Unknown"}</p>
                                    <p className="text-[10px] text-white/20">{formatDate(req.created_at)}</p>
                                  </div>
                                </div>
                                {req.message && <p className="text-xs text-white/30 mb-3 leading-relaxed italic">&ldquo;{req.message}&rdquo;</p>}
                                <button onClick={() => matchPartners(req.id, req.requester_id)}
                                  className="px-4 py-2 rounded-lg text-[11px] font-bold transition-all hover:brightness-110"
                                  style={{ background: "rgba(39,174,96,0.2)", border: "1px solid rgba(39,174,96,0.25)", color: "#27ae60" }}>
                                  Match with Partner
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Flagged content */}
                    <div>
                      <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4 flex items-center gap-2">
                        <Flag size={14} /> Flagged Content ({flaggedContent.length})
                      </h3>
                      {flaggedContent.length === 0 ? (
                        <p className="text-xs text-white/40">No flagged content</p>
                      ) : (
                        <div className="space-y-2">
                          {flaggedContent.map((post) => {
                            const author = post.author as unknown as Profile;
                            return (
                              <div key={post.id} className="p-4 rounded-xl"
                                style={{ background: "rgba(231,76,60,0.03)", border: "1px solid rgba(231,76,60,0.1)" }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-white/50">{author?.display_name || "Unknown"}</span>
                                  <span className="text-[10px] text-white/40">{formatDate(post.created_at)}</span>
                                </div>
                                <p className="text-xs text-white/40 mb-3">{post.content}</p>
                                {post.flag_reason && <p className="text-[10px] text-red-400/50 mb-2">Reason: {post.flag_reason}</p>}
                                <div className="flex gap-2">
                                  <button onClick={() => approvePost(post.id)}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                                    style={{ background: "rgba(39,174,96,0.15)", color: "#27ae60" }}>
                                    Approve
                                  </button>
                                  <button onClick={() => removePost(post.id)}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                                    style={{ background: "rgba(231,76,60,0.15)", color: "#e74c3c" }}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

      
      {/* ──── Avatar Picker Modal ──────────────── */}
      {showAvatarPicker && currentUser && (
        <AvatarPicker
          userId={currentUser.id}
          currentAvatarUrl={currentProfile?.avatar_url || null}
          currentInitials={currentProfile?.avatar_initials || currentUser?.email?.substring(0, 2).toUpperCase() || "??"}
          currentColor={currentProfile?.color || "#d4af37"}
          onSave={(updates) => {
            if (currentProfile) {
              setCurrentProfile({ ...currentProfile, ...updates } as Profile);
            }
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

</div>
    </main>
  );
}
