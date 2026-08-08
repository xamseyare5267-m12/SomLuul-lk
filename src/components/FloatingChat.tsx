import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Minus, Send, Image as ImageIcon, Mic, MicOff, Smile, Paperclip, Phone, Video, VideoOff,
  ChevronDown, Check, CheckCheck, Loader2, ArrowLeft, Square, Trash2
} from 'lucide-react';
import { Profile } from '../types.js';

// Sound Utilities & Audio Recorder
import { 
  playRingtoneSound, 
  playNotificationSound, 
  playCallConnectedSound, 
  playCallEndedSound 
} from '../lib/soundUtils.js';
import { useAudioRecorder } from '../lib/useAudioRecorder.js';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';

export interface FloatingChatWindow {
  id: string; // roomId or target profile id
  recipient: {
    id: string;
    name: string;
    avatar: string;
    bio?: string;
    phone?: string;
  };
  isMinimized?: boolean;
}

interface FloatingChatProps {
  user: Profile;
  authToken?: string;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onViewProfile?: (userId: string) => void;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
  user,
  authToken,
  onShowToast,
  onViewProfile,
}) => {
  const [openChats, setOpenChats] = useState<FloatingChatWindow[]>([]);
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});
  const [isRecordingMap, setIsRecordingMap] = useState<Record<string, boolean>>({});
  const [recordingSecs, setRecordingSecs] = useState<Record<string, number>>({});
  const [showEmojiMap, setShowEmojiMap] = useState<Record<string, boolean>>({});

  // Active floating call state & camera feed
  const [activeCall, setActiveCall] = useState<{
    recipientName: string;
    avatar: string;
    type: 'voice' | 'video';
    status: 'connecting' | 'connected';
    callTime: number;
  } | null>(null);

  const activeRingRef = useRef<{ stop: () => void } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const messageContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timerRefs = useRef<Record<string, any>>({});
  const mediaRecordersRef = useRef<Record<string, { recorder: MediaRecorder; chunks: Blob[]; stream: MediaStream }>>({});

  // Call timer interval
  useEffect(() => {
    let interval: any = null;
    if (activeCall && activeCall.status === 'connected') {
      interval = setInterval(() => {
        setActiveCall(prev => prev ? { ...prev, callTime: prev.callTime + 1 } : null);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.status]);

  // Video call stream hook
  useEffect(() => {
    let localStream: MediaStream | null = null;
    if (activeCall && (activeCall.type === 'video' || !activeCall.isVideoOff) && !activeCall.isVideoOff) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
        .then(stream => {
          localStream = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn('Floating video call camera notice:', err);
        });
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeCall?.status, activeCall?.type, activeCall?.isVideoOff]);

  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !activeCall?.isMuted;
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = !activeCall?.isVideoOff;
      });
    }
  }, [activeCall?.isMuted, activeCall?.isVideoOff]);

  const connectTimeoutRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);

  const startCall = (recipientName: string, avatar: string, type: 'voice' | 'video') => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (activeRingRef.current) {
      activeRingRef.current.stop();
      activeRingRef.current = null;
    }

    const ring = playRingtoneSound();
    activeRingRef.current = ring;

    setActiveCall({
      recipientName,
      avatar,
      type,
      status: 'connecting',
      callTime: 0
    });

    if (onShowToast) {
      onShowToast(`Wacitaan ${type === 'video' ? 'muuqaal' : 'cod'} ah: ${recipientName}...`, 'success');
    }

    connectTimeoutRef.current = setTimeout(() => {
      if (activeRingRef.current) {
        activeRingRef.current.stop();
        activeRingRef.current = null;
      }
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      playCallConnectedSound();
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
    }, 3200);

    ringTimeoutRef.current = setTimeout(() => {
      endCall(true);
    }, 35000);
  };

  const endCall = (isUnanswered: boolean | React.SyntheticEvent = false) => {
    const unansweredFlag = typeof isUnanswered === 'boolean' ? isUnanswered : false;
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (activeRingRef.current) {
      try { activeRingRef.current.stop(); } catch (e) {}
      activeRingRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      try {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        localVideoRef.current.srcObject = null;
      } catch (e) {}
    }
    try { playCallEndedSound(); } catch (e) {}
    setActiveCall(null);
    if (unansweredFlag && onShowToast) {
      onShowToast(`Wicitaanku ma jawaabin (Call Unanswered)`, 'error');
    }
  };

  const renderAvatarBubble = (avatarUrl: string | null | undefined, name: string, sizeClass = "w-8 h-8") => {
    const isValidUrl = avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:image') || avatarUrl.startsWith('/'));
    if (isValidUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover border border-white/20 shrink-0`}
          referrerPolicy="no-referrer"
        />
      );
    }
    const parts = name ? name.trim().split(' ').filter(p => Boolean(p) && !['user', 'admin'].includes(p.toLowerCase())) : [];
    const initials = parts.length >= 2 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts.length === 1 && parts[0].length > 0 ? parts[0].slice(0, 2).toUpperCase() : '💬');

    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 tracking-tight border border-white/30 shadow-xs font-sans`}>
        {initials}
      </div>
    );
  };

  // Sync with backend API
  const syncChatMessages = async () => {
    if (!authToken) return;
    try {
      const res = await axios.get('/api/chat/messages', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.data && Array.isArray(res.data)) {
        const grouped: Record<string, any[]> = {};
        res.data.forEach((msg: any) => {
          if (!grouped[msg.roomId]) grouped[msg.roomId] = [];
          grouped[msg.roomId].push(msg);
        });
        setMessages(prev => {
          let updated = false;
          const merged = { ...prev };
          Object.keys(grouped).forEach(rId => {
            if (!merged[rId]) {
              merged[rId] = grouped[rId];
              updated = true;
            } else {
              // Merge unique messages
              const existingIds = new Set(merged[rId].map(m => m.id));
              grouped[rId].forEach(m => {
                if (!existingIds.has(m.id)) {
                  merged[rId].push(m);
                  updated = true;
                }
              });
            }
          });
          if (updated) {
            localStorage.setItem('somluul_chat_messages', JSON.stringify(merged));
            return merged;
          }
          return prev;
        });
      }
    } catch (_err) {
      // Silent sync fallback for offline/local state
    }
  };

  const handleDeleteMessage = (msgId: string, roomId: string) => {
    setMessages(prev => {
      const roomMsgs = prev[roomId] || [];
      const filtered = roomMsgs.filter(m => m.id !== msgId);
      const updated = { ...prev, [roomId]: filtered };
      localStorage.setItem('somluul_chat_messages', JSON.stringify(updated));
      return updated;
    });

    if (authToken) {
      axios.delete(`/api/chat/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(err => console.warn('Delete message sync error:', err));
    }
  };

  // Listen for global open floating chat events
  useEffect(() => {
    const handleOpenChat = (e: CustomEvent) => {
      if (!e.detail) return;
      const target = e.detail;
      const roomId = target.id;

      const chatObj: FloatingChatWindow = {
        id: roomId,
        recipient: {
          id: target.id,
          name: target.first_name ? `${target.first_name} ${target.last_name || ''}`.trim() : (target.name || 'User'),
          avatar: target.avatar || null,
          bio: target.bio,
          phone: target.phone
        },
        isMinimized: false
      };

      setOpenChats(prev => {
        const existingIdx = prev.findIndex(c => c.id === roomId || c.recipient.id === target.id);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].isMinimized = false;
          return updated;
        }
        // Limit max 3 floating chat boxes side-by-side
        if (prev.length >= 3) {
          return [...prev.slice(1), chatObj];
        }
        return [...prev, chatObj];
      });

      // Fetch message history for this room if missing
      syncChatMessages();

      if (target.startCall) {
        const recipientName = target.first_name ? `${target.first_name} ${target.last_name || ''}`.trim() : (target.name || 'User');
        startCall(recipientName, target.avatar || '', target.startCall === 'video' ? 'video' : 'voice');
      }
    };

    window.addEventListener('somluul_open_floating_chat' as any, handleOpenChat as any);
    syncChatMessages();

    // Poll chat messages every 10 seconds only when window focused
    const pollInterval = setInterval(() => {
      if (document.hasFocus()) {
        syncChatMessages();
      }
    }, 10000);

    return () => {
      window.removeEventListener('somluul_open_floating_chat' as any, handleOpenChat as any);
      clearInterval(pollInterval);
    };
  }, [user.id, authToken]);

  // Scroll to bottom when messages update without scrolling outer page window
  useEffect(() => {
    openChats.forEach(chat => {
      const container = messageContainerRefs.current[chat.id];
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [messages, openChats]);

  // Actions
  const handleCloseChat = (chatId: string) => {
    setOpenChats(prev => prev.filter(c => c.id !== chatId));
  };

  const handleToggleMinimize = (chatId: string) => {
    setOpenChats(prev => prev.map(c => c.id === chatId ? { ...c, isMinimized: !c.isMinimized } : c));
  };

  const handleSendMessage = async (chat: FloatingChatWindow, type: 'text' | 'image' | 'voice' = 'text', mediaUrl?: string) => {
    const roomId = chat.id;
    const textContent = inputTexts[roomId] || '';

    if (type === 'text' && !textContent.trim()) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      roomId,
      senderId: user.id,
      senderName: `${user.first_name} ${user.last_name}`,
      senderAvatar: user.avatar,
      content: type === 'text' ? textContent.trim() : (type === 'voice' ? 'Fariin maqal ah 🎤' : 'Sawir 📷'),
      type,
      mediaUrl,
      created_at: currentTime
    };

    // Update local state instantly
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), newMsg]
    }));

    // Play message notification chime
    playNotificationSound();

    // Clear text input
    setInputTexts(prev => ({ ...prev, [roomId]: '' }));

    // Sync room object
    const updatedRoom = {
      id: roomId,
      name: chat.recipient.name,
      avatar: chat.recipient.avatar,
      isGroup: false,
      unreadCount: 0,
      lastMessage: newMsg.content,
      lastMessageTime: currentTime,
      members: [user.id, chat.recipient.id]
    };

    // Save locally
    const savedMsgsStr = localStorage.getItem('somluul_chat_messages');
    let localMsgs: Record<string, any[]> = {};
    if (savedMsgsStr) {
      try { localMsgs = JSON.parse(savedMsgsStr); } catch (_) {}
    }
    localMsgs[roomId] = [...(localMsgs[roomId] || []), newMsg];
    localStorage.setItem('somluul_chat_messages', JSON.stringify(localMsgs));

    // Send to backend API
    if (authToken) {
      try {
        await axios.post('/api/chat/messages', { message: newMsg }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        await axios.post('/api/chat/rooms', { room: updatedRoom }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (err) {
        console.warn('Silent fallback: Saved message locally:', err);
      }
    }

    // Simulated contact interactive response
    if (chat.recipient.id !== user.id) {
      setTimeout(() => {
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const replyContent = type === 'voice' 
          ? `Asc! Farriintaada codka ah waa aan helay, waa ku mahadsan tahay 🎤`
          : (type === 'image' 
              ? `Sawir aad u qurux badan! Waad ku mahadsan tahay wadaaga 📷`
              : `Waad ku mahadsan tahay fariintaada! Sideen ku caawin karaa maanta? 😊`);

        const replyMsg = {
          id: `m_reply_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          roomId,
          senderId: chat.recipient.id,
          senderName: chat.recipient.name,
          senderAvatar: chat.recipient.avatar,
          content: replyContent,
          type: 'text',
          created_at: replyTime
        };

        setMessages(prev => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), replyMsg]
        }));
        playNotificationSound();

        const updatedRoomWithReply = {
          ...updatedRoom,
          lastMessage: replyContent,
          lastMessageTime: replyTime
        };

        const currentLocal = localStorage.getItem('somluul_chat_messages');
        let parsed: Record<string, any[]> = {};
        if (currentLocal) {
          try { parsed = JSON.parse(currentLocal); } catch (_) {}
        }
        parsed[roomId] = [...(parsed[roomId] || []), replyMsg];
        localStorage.setItem('somluul_chat_messages', JSON.stringify(parsed));

        if (authToken) {
          axios.post('/api/chat/messages', { message: replyMsg }, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).catch(() => {});
          axios.post('/api/chat/rooms', { room: updatedRoomWithReply }, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).catch(() => {});
        }
      }, 1800);
    }
  };

  // Image Upload handler
  const handleImageSelect = (chat: FloatingChatWindow, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage(chat, 'image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Real Voice recording & playback handler
  const toggleRecording = async (chatId: string) => {
    const isRec = !!isRecordingMap[chatId];
    if (!isRec) {
      setIsRecordingMap(prev => ({ ...prev, [chatId]: true }));
      setRecordingSecs(prev => ({ ...prev, [chatId]: 0 }));

      timerRefs.current[chatId] = setInterval(() => {
        setRecordingSecs(prev => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
      }, 1000);

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          recorder.start(100);
          mediaRecordersRef.current[chatId] = { recorder, chunks, stream };
        } catch (err) {
          console.warn('Microphone access notice:', err);
        }
      }
    } else {
      if (timerRefs.current[chatId]) {
        clearInterval(timerRefs.current[chatId]);
      }
      const totalSecs = recordingSecs[chatId] || 3;
      setIsRecordingMap(prev => ({ ...prev, [chatId]: false }));

      const chat = openChats.find(c => c.id === chatId);
      const recData = mediaRecordersRef.current[chatId];

      if (recData && recData.recorder && recData.recorder.state !== 'inactive') {
        recData.recorder.onstop = () => {
          const blob = new Blob(recData.chunks, { type: recData.recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Url = reader.result as string;
            if (chat) {
              handleSendMessage(chat, 'voice', base64Url);
            }
          };
          reader.readAsDataURL(blob);
          recData.stream.getTracks().forEach(t => t.stop());
          delete mediaRecordersRef.current[chatId];
        };
        try { recData.recorder.stop(); } catch (e) {}
      } else if (chat) {
        const timeStr = `0:${totalSecs < 10 ? '0' : ''}${totalSecs}`;
        handleSendMessage(chat, 'voice', timeStr);
      }
    }
  };

  if (openChats.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-3 pointer-events-none">
      {openChats.map((chat) => {
        const roomId = chat.id;
        const roomMsgs = messages[roomId] || [];
        const isRec = !!isRecordingMap[roomId];
        const currentSecs = recordingSecs[roomId] || 0;
        const isMin = !!chat.isMinimized;

        return (
          <div
            key={chat.id}
            className={`pointer-events-auto bg-white dark:bg-[#182232] border border-gray-200 dark:border-gray-800 rounded-t-2xl shadow-2xl transition-all duration-300 flex flex-col ${
              isMin ? 'w-64 h-12 overflow-hidden' : 'w-80 sm:w-88 h-[450px]'
            }`}
          >
            {/* Header Bar */}
            <div
              onClick={() => handleToggleMinimize(chat.id)}
              className="bg-blue-600 dark:bg-[#1a2942] text-white px-3.5 py-2.5 flex items-center justify-between cursor-pointer rounded-t-2xl select-none shrink-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  {renderAvatarBubble(chat.recipient.avatar, chat.recipient.name, "w-8 h-8")}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-blue-600"></span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold truncate leading-tight">{chat.recipient.name}</h4>
                  <p className="text-[10px] text-blue-100 dark:text-blue-300 opacity-90 truncate">Online • SomLuul</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => startCall(chat.recipient.name, chat.recipient.avatar, 'voice')}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                  title="Wacitaan Cod ah (Voice Call)"
                >
                  <Phone size={13} />
                </button>

                <button
                  onClick={() => startCall(chat.recipient.name, chat.recipient.avatar, 'video')}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                  title="Wacitaan Muuqaal ah (Video Call)"
                >
                  <Video size={13} />
                </button>

                <button
                  onClick={() => handleToggleMinimize(chat.id)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Minimize"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => handleCloseChat(chat.id)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* If minimized, hide body */}
            {!isMin && (
              <>
                {/* Messages Body */}
                <div
                  ref={el => { messageContainerRefs.current[roomId] = el; }}
                  className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-[#111726]/60 text-xs"
                >
                  {roomMsgs.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-xl font-bold">
                        💬
                      </div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Ku bilow sheeko badbaado leh {chat.recipient.name}!
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Farriimahaagu waa kuwo la sireeyay oo si toos ah u gaaraya qofka.
                      </p>
                    </div>
                  ) : (
                    roomMsgs.map((m, idx) => {
                      const isMe = m.senderId === user.id || m.senderId === 'me';
                      return (
                        <div
                          key={m.id || idx}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-xs leading-relaxed ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-[#1e293b] text-gray-800 dark:text-gray-100 border border-gray-150 dark:border-gray-800 rounded-bl-none'
                            }`}
                          >
                            {m.type === 'text' && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                            {m.type === 'image' && (
                              <div className="space-y-1">
                                <img
                                  src={m.mediaUrl}
                                  alt="Attached media"
                                  className="rounded-xl max-h-48 object-cover border border-white/20"
                                />
                                {m.content && m.content !== 'Sawir 📷' && <p className="pt-1">{m.content}</p>}
                              </div>
                            )}
                            {m.type === 'voice' && (
                              <VoiceNotePlayer
                                mediaUrl={m.mediaUrl}
                                durationLabel={typeof m.mediaUrl === 'string' && !m.mediaUrl.startsWith('data:') ? m.mediaUrl : '0:08'}
                                isMe={isMe}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[9px] text-gray-400">{m.created_at || 'Just now'}</span>
                            <button
                              onClick={() => handleDeleteMessage(m.id, chat.id)}
                              className="text-gray-400 hover:text-rose-500 transition-colors p-0.5"
                              title="Tirtir fariinta"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Controls Bar */}
                <div className="p-2.5 bg-white dark:bg-[#182232] border-t border-gray-200 dark:border-gray-800 shrink-0 space-y-1.5">
                  {/* Recording indicator */}
                  {isRec && (
                    <div className="flex items-center justify-between px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold animate-pulse">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                        Codeday farriin maqal ah...
                      </span>
                      <span>0:{currentSecs < 10 ? '0' : ''}{currentSecs}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {/* Image Attachment Button */}
                    <label className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors">
                      <ImageIcon size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageSelect(chat, e)}
                        className="hidden"
                      />
                    </label>

                    {/* Mic / Stop Recording Button */}
                    {isRec ? (
                      <button
                        type="button"
                        onClick={() => toggleRecording(roomId)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer animate-pulse shrink-0"
                        title="Jooji & Dir Codka / Stop & Send Voice Note"
                      >
                        <Square size={12} fill="currentColor" />
                        <span>Jooji ({currentSecs}s)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleRecording(roomId)}
                        className="p-1.5 rounded-xl text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
                        title="Duub Cod / Record Voice Note (🎤)"
                      >
                        <Mic size={18} />
                      </button>
                    )}

                    {/* Text Input */}
                    <input
                      type="text"
                      value={inputTexts[roomId] || ''}
                      onChange={(e) => setInputTexts(prev => ({ ...prev, [roomId]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage(chat, 'text');
                        }
                      }}
                      placeholder="Qor farriin..."
                      className="flex-1 text-xs bg-gray-100 dark:bg-[#111726] border border-gray-200/80 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />

                    {/* Send Button */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage(chat, 'text')}
                      disabled={!(inputTexts[roomId] || '').trim() && !isRec}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* ACTIVE CALL OVERLAY MODAL */}
      {activeCall && (
        <div className="fixed inset-0 bg-[#0a0f1d]/95 backdrop-blur-md text-white flex flex-col justify-between p-6 z-60 animate-fade-in font-sans">
          <div className="flex justify-between items-center z-10">
            <button 
              type="button"
              onClick={() => endCall(false)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
              title="Ka laabo Wacitaanka"
            >
              <ArrowLeft size={16} />
              <span>Ka laabo</span>
            </button>

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-gray-200">SomLuul E2E Call</span>
            </div>

            <div className="text-xs font-mono font-bold text-gray-300 bg-white/10 px-3 py-1.5 rounded-full">
              {Math.floor(activeCall.callTime / 60)}:{(activeCall.callTime % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="grow flex flex-col items-center justify-center py-6">
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              <div className="relative w-full max-w-md h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/20 bg-gray-900 flex items-center justify-center shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 w-20 h-28 rounded-xl overflow-hidden border-2 border-white/60 shadow-lg bg-gray-950">
                  {renderAvatarBubble(activeCall.avatar, activeCall.recipientName, "w-full h-full")}
                </div>
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Video size={13} className="text-green-400" />
                    <span>{activeCall.recipientName} HD Video Stream</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
                  {renderAvatarBubble(activeCall.avatar, activeCall.recipientName, "w-24 h-24 text-2xl")}
                </div>
                <div>
                  <h4 className="text-xl font-bold tracking-tight">{activeCall.recipientName}</h4>
                  <p className="text-xs text-blue-300 font-semibold uppercase tracking-widest mt-1">
                    {activeCall.status === 'connecting' ? 'Inaaleeso wacitaan...' : 'Wacitaanka waa uu socdaaa'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
              className={`p-3.5 rounded-full transition-all border cursor-pointer ${activeCall?.isMuted ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'}`}
              title={activeCall?.isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {activeCall?.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              type="button"
              onClick={endCall}
              className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer shrink-0"
              title="Jooji Wacitaanka (Cancel / Hang Up Call)"
            >
              <Phone size={26} className="rotate-[135deg]" />
            </button>

            <button
              type="button"
              onClick={() => setActiveCall(prev => prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null)}
              className={`p-3.5 rounded-full transition-all border cursor-pointer ${activeCall?.isVideoOff ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'}`}
              title={activeCall?.isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {activeCall?.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
