'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  MessageCircle,
  Send,
  X,
  ArrowLeft,
  Search,
  Loader,
  Mail,
  Check,
  CheckCheck,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { moderateText } from '@/lib/moderation';

// Types
type View = 'INBOX' | 'CHAT';

interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  other_user: {
    id: string;
    display_name: string;
    avatar_initials: string;
    color: string;
  };
  unread_count: number;
}

interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface SearchProfile {
  id: string;
  display_name: string;
  avatar_initials: string;
  color: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  currentProfile: {
    id: string;
    display_name: string;
    avatar_initials: string;
    color: string;
    role: string;
  } | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
}

export default function DirectMessages({
  isOpen,
  onClose,
  currentUser,
  currentProfile,
  targetUserId,
  targetUserName,
}: Props) {
  const [view, setView] = useState<View>('INBOX');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeUserName, setActiveUserName] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeSubscriptionRef = useRef<any>(null);

  // Helper function to ensure consistent conversation ID ordering
  const getOrderedParticipants = (id1: string, id2: string) => {
    return id1.localeCompare(id2) < 0 ? [id1, id2] : [id2, id1];
  };

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser?.id || !isSupabaseConfigured()) return;

    try {
      setLoading(true);

      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select(
          `
          id,
          participant_one,
          participant_two,
          last_message_at
        `
        )
        .or(
          `participant_one.eq.${currentUser.id},participant_two.eq.${currentUser.id}`
        )
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      // Fetch other user details and unread counts
      const conversationsWithDetails = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const otherUserId = conv.participant_one === currentUser.id
            ? conv.participant_two
            : conv.participant_one;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_initials, color')
            .eq('id', otherUserId)
            .single();

          const { count: unreadCount } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('sender_id', otherUserId)
            .eq('is_read', false);

          return {
            id: conv.id,
            participant_one: conv.participant_one,
            participant_two: conv.participant_two,
            last_message_at: conv.last_message_at,
            other_user: profileData || {
              id: otherUserId,
              display_name: 'Unknown User',
              avatar_initials: '?',
              color: '#666',
            },
            unread_count: unreadCount || 0,
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(messagesData || []);

      // Mark as read (messages sent by the OTHER user)
      if (currentUser?.id) {
        await supabase
          .from('direct_messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUser.id)
          .eq('is_read', false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [currentUser?.id]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!activeConversationId || !isSupabaseConfigured()) return;

    if (realtimeSubscriptionRef.current) {
      supabase.removeChannel(realtimeSubscriptionRef.current);
    }

    realtimeSubscriptionRef.current = supabase
      .channel(`direct-messages-${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        () => {
          loadMessages(activeConversationId);
        }
      )
      .subscribe();

    return () => {
      if (realtimeSubscriptionRef.current) {
        supabase.removeChannel(realtimeSubscriptionRef.current);
      }
    };
  }, [activeConversationId, loadMessages]);

  // Load conversations on mount and when drawer opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();

      // If targetUserId is provided, open conversation with that user
      if (targetUserId && currentUser?.id) {
        handleStartConversation(targetUserId, targetUserName || 'User');
      }
    }
  }, [isOpen, currentUser?.id, targetUserId, targetUserName, loadConversations]);

  // Get or create conversation
  const getOrCreateConversation = useCallback(
    async (otherUserId: string, otherUserName: string) => {
      if (!currentUser?.id || !isSupabaseConfigured()) return null;

      try {
        const [participant1, participant2] = getOrderedParticipants(
          currentUser.id,
          otherUserId
        );

        // Try to find existing conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_one', participant1)
          .eq('participant_two', participant2)
          .maybeSingle();

        if (existingConv) {
          return existingConv.id;
        }

        // Create new conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            participant_one: participant1,
            participant_two: participant2,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error) throw error;
        return newConv?.id || null;
      } catch (error) {
        console.error('Error getting or creating conversation:', error);
        return null;
      }
    },
    [currentUser?.id]
  );

  // Start conversation
  const handleStartConversation = useCallback(
    async (userId: string, userName: string) => {
      const conversationId = await getOrCreateConversation(userId, userName);
      if (conversationId) {
        setActiveConversationId(conversationId);
        setActiveUserName(userName);
        setView('CHAT');
        setShowNewMessageModal(false);
        setSearchQuery('');
        await loadMessages(conversationId);
      }
    },
    [getOrCreateConversation, loadMessages]
  );

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeConversationId || !currentUser?.id || !currentProfile) {
      return;
    }

    // Get other user ID from conversation
    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (!conversation) return;

    const receiverId = conversation.participant_one === currentUser.id
      ? conversation.participant_two
      : conversation.participant_one;

    try {
      setSendingMessage(true);

      // Moderate message content
      const modResult = moderateText(messageInput);
      if (!modResult.allowed) {
        alert(modResult.reason || 'Message contains inappropriate content and was blocked.');
        return;
      }

      // Insert message
      const { error: insertError } = await supabase.from('direct_messages').insert({
        conversation_id: activeConversationId,
        sender_id: currentUser.id,
        content: messageInput,
        is_read: false,
      });

      if (insertError) throw insertError;

      // Update conversation last_message_at
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConversationId);

      if (updateError) throw updateError;

      setMessageInput('');
      await loadMessages(activeConversationId);
      await loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  }, [messageInput, activeConversationId, currentUser?.id, currentProfile, conversations, loadMessages, loadConversations]);

  // Search members
  const handleSearchMembers = useCallback(
    async (query: string) => {
      if (!query.trim() || !isSupabaseConfigured()) {
        setSearchResults([]);
        return;
      }

      try {
        setSearchLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_initials, color')
          .ilike('display_name', `%${query}%`)
          .eq('is_approved', true)
          .neq('id', currentUser?.id || '')
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching members:', error);
      } finally {
        setSearchLoading(false);
      }
    },
    [currentUser?.id]
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchMembers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchMembers]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (view === 'CHAT') {
          setView('INBOX');
        } else {
          onClose();
        }
      }

      if (e.key === 'Enter' && e.ctrlKey && view === 'CHAT') {
        handleSendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, onClose, handleSendMessage]);

  if (!isSupabaseConfigured() || !currentUser || !currentProfile) {
    return null;
  }

  const getLastMessagePreview = (conversation: Conversation): string => {
    const lastMessage = messages.find(
      (m) => m.conversation_id === conversation.id
    );
    if (!lastMessage) return 'No messages yet';
    return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-16 right-0 h-[calc(100vh-4rem)] w-full sm:w-96 bg-[#0a0f1e] border-l border-[#d4af37] border-opacity-20 z-50 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {view === 'INBOX' ? (
          <>
            {/* Inbox Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#d4af37] border-opacity-20">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} className="text-[#d4af37]" />
                <h2 className="text-lg font-semibold text-white">Messages</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[#d4af37] hover:bg-opacity-10 rounded transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* New Message Button */}
            <div className="p-3 border-b border-gold-subtle/20">
              <button
                onClick={() => setShowNewMessageModal(true)}
                className="w-full bg-gold-ghost hover:bg-gold-subtle border border-gold-subtle text-gold-bright py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                New Message
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader size={20} className="text-[#d4af37] animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                  <MessageCircle size={32} className="mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setActiveConversationId(conversation.id);
                        setActiveUserName(conversation.other_user.display_name);
                        setView('CHAT');
                        loadMessages(conversation.id);
                      }}
                      className="w-full p-3 rounded hover:bg-[#d4af37] hover:bg-opacity-5 transition-colors text-left border border-transparent hover:border-[#d4af37] hover:border-opacity-20"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: conversation.other_user.color }}
                        >
                          {conversation.other_user.avatar_initials}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-white font-medium text-sm truncate">
                              {conversation.other_user.display_name}
                            </span>
                            <span className="text-gray-400 text-xs flex-shrink-0">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs truncate">
                            {getLastMessagePreview(conversation)}
                          </p>
                        </div>

                        {/* Unread Badge */}
                        {conversation.unread_count > 0 && (
                          <div className="bg-[#d4af37] text-black text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {conversation.unread_count}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b border-[#d4af37] border-opacity-20">
              <button
                onClick={() => {
                  setView('INBOX');
                  setActiveConversationId(null);
                  setMessages([]);
                }}
                className="p-1 hover:bg-[#d4af37] hover:bg-opacity-10 rounded transition-colors"
              >
                <ArrowLeft size={20} className="text-[#d4af37]" />
              </button>

              {/* User Avatar */}
              {conversations
                .find((c) => c.id === activeConversationId)
                ?.other_user && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{
                      backgroundColor: conversations.find(
                        (c) => c.id === activeConversationId
                      )?.other_user.color,
                    }}
                  >
                    {
                      conversations.find((c) => c.id === activeConversationId)
                        ?.other_user.avatar_initials
                    }
                  </div>
                )}

              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">
                <p className="text-gray-400 text-xs mb-0.5">Chatting with</p>
                  {activeUserName || "Select a conversation"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[#d4af37] hover:bg-opacity-10 rounded transition-colors ml-auto"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                  <MessageCircle size={32} className="mb-2 opacity-50" />
                  <p>No messages yet</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isSender = message.sender_id === currentUser.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          isSender
                            ? 'bg-[#d4af37] text-black'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 ${
                            isSender ? 'justify-end' : ''
                          }`}
                        >
                          <span className={`text-xs ${
                            isSender ? 'text-black text-opacity-60' : 'text-gray-400'
                          }`}>
                            {new Date(message.created_at).toLocaleTimeString(
                              'en-US',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </span>
                          {isSender && (
                            message.is_read ? (
                              <CheckCheck size={12} className="text-black text-opacity-60" />
                            ) : (
                              <Check size={12} className="text-black text-opacity-60" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-[#d4af37] border-opacity-20 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={sendingMessage}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-[#d4af37] focus:border-opacity-50 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                  className="bg-[#d4af37] hover:bg-[#d4af37] hover:opacity-80 text-black p-2 rounded transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowNewMessageModal(false);
            setSearchQuery('');
          }}
        >
          <div
            className="bg-[#0a0f1e] border border-[#d4af37] border-opacity-30 rounded-lg max-w-md w-full max-h-96 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#d4af37] border-opacity-20">
              <h3 className="text-white font-semibold">Start a Conversation</h3>
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setSearchQuery('');
                }}
                className="p-1 hover:bg-[#d4af37] hover:bg-opacity-10 rounded transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[#d4af37] border-opacity-20">
              <div className="flex items-center gap-2 bg-gray-700 border border-gray-600 rounded px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  autoFocus
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader size={16} className="text-[#d4af37] animate-spin" />
                </div>
              ) : searchResults.length === 0 && searchQuery ? (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  No members found
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {searchResults.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() =>
                        handleStartConversation(profile.id, profile.display_name)
                      }
                      className="w-full p-3 rounded hover:bg-[#d4af37] hover:bg-opacity-5 transition-colors text-left border border-transparent hover:border-[#d4af37] hover:border-opacity-20 flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: profile.color }}
                      >
                        {profile.avatar_initials}
                      </div>
                      <span className="text-white text-sm truncate">
                        {profile.display_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
