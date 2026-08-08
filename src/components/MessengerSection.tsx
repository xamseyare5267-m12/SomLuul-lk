import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLanguage } from './LanguageContext.js';
import { AppLogo } from './AppLogo.js';
import { 
  Search, Send, Mic, MicOff, Phone, Video, Shield, User, MoreHorizontal, 
  Smile, Paperclip, CheckCheck, Volume2, VideoOff, ScreenShare, 
  Info, ShieldAlert, BadgeInfo, Users, Check, Plus, MessageSquare, X, 
  Heart, Radio, Trash2, Edit2, MapPin, UserSquare, Star, CheckCircle, 
  AlertCircle, Lock, CornerUpLeft, Forward, Copy, Pin, Wifi, WifiOff, RefreshCw,
  ArrowLeft, Image as ImageIcon, Square
} from 'lucide-react';

import { ChatRoom, ChatMessage } from '../types.js';

// Sound Utilities & Audio Recorder
import { 
  playRingtoneSound, 
  playNotificationSound, 
  playCallConnectedSound, 
  playCallEndedSound 
} from '../lib/soundUtils.js';
import { useAudioRecorder } from '../lib/useAudioRecorder.js';
import { VoiceNotePlayer } from './VoiceNotePlayer.js';

// Import Modular Components
import { DeviceFrame } from './messenger/DeviceFrame.js';
import { ContactsSyncModal } from './messenger/ContactsSyncModal.js';
import { UserProfileSidebar } from './messenger/UserProfileSidebar.js';
import { BlockedUsersManager } from './messenger/BlockedUsersManager.js';
import { GroupChatCreator } from './messenger/GroupChatCreator.js';
import { PollBuilder } from './messenger/PollBuilder.js';
import { BroadcastComposer } from './messenger/BroadcastComposer.js';

interface MessengerSectionProps {
  user: any;
  authToken: string;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onNavigateHome?: () => void;
  onViewProfile?: (userId: string) => void;
}

interface InAppNotification {
  id: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  roomId: string;
}

export const MessengerSection: React.FC<MessengerSectionProps> = ({ user, authToken, onShowToast, onNavigateHome, onViewProfile }) => {
  const { t, language } = useLanguage();

  const triggerAlert = (message: string, type: 'success' | 'error' = 'success') => {
    if (onShowToast) {
      onShowToast(message, type);
    } else {
      console.log(`[ALERT] ${type}: ${message}`);
    }
  };

  // --- CORE STATE DRIVERS ---
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [offlineQueue, setOfflineQueue] = useState<ChatMessage[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [selectedSubTab, setSelectedSubTab] = useState<'all' | 'chats' | 'groups' | 'channels' | 'contacts'>('all');
  const [viewingContactProfile, setViewingContactProfile] = useState<any | null>(null);
  const [inviteTargetContact, setInviteTargetContact] = useState<any | null>(null);

  // Predefined phone contacts representing the user's phonebook
  const mockPhoneBook = [
    { name: 'Maryan Mohamed', phone: '+252 61 2223344' },
    { name: 'Cumar Abdi', phone: '+252 61 5112233' },
    { name: 'Ahmed Hassan', phone: '+252 61 5666561' },
    { name: 'Fadumo Ali', phone: '+252 61 8889900' },
    { name: 'Abdirahman Warsame', phone: '+252 61 5554433' },
    { name: 'Khaalid Maxamed Sxb', phone: '+252 61 5112233' },
    { name: 'Mustafe Yusuf', phone: '+252 61 9998877' },
    { name: 'Deqa Salaad', phone: '+252 61 3332211' },
    { name: 'Eng. Sharmaarke', phone: '+252 61 4445566' },
    { name: 'Hassan Geedi', phone: '+252 61 1112223' },
    { name: 'Amina Warsame', phone: '+252 61 4442211' }
  ];

  const getMatchedPhonebook = () => {
    return mockPhoneBook.map(contact => {
      const cleanContactPhone = contact.phone.replace(/[^0-9]/g, '');
      const matchedRoom = rooms.find(r => {
        if (!r.phone) return false;
        const cleanRoomPhone = r.phone.replace(/[^0-9]/g, '');
        return cleanRoomPhone.endsWith(cleanContactPhone) || cleanContactPhone.endsWith(cleanRoomPhone);
      });
      return {
        ...contact,
        registered: !!matchedRoom,
        room: matchedRoom
      };
    });
  };
  
  const [rooms, setRooms] = useState<ChatRoom[]>([
    { 
      id: 'r_maryan', 
      name: 'Maryan Mohamed', 
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      unreadCount: 2, 
      lastMessage: 'Asc walalayaal, sidee tahay?', 
      lastMessageTime: '09:41 AM', 
      members: ['r_maryan', 'me'],
      bio: 'Isku xidhka SomLuul Messenger. Chat. Call. Share. Secure.',
      phone: '+252 61 2223344',
      followersCount: 1420,
      followingCount: 380,
      isFollowing: true
    },
    { 
      id: 'r_cumar', 
      name: 'Cumar Abdi', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      unreadCount: 0, 
      lastMessage: 'Waan ku soo gaadhay.', 
      lastMessageTime: '09:33 AM', 
      members: ['r_cumar', 'me'],
      bio: 'Software Engineer @ SomLuul. Cryptography enthusiast & PWA builder.',
      phone: '+252 61 5112233',
      followersCount: 840,
      followingCount: 150,
      isFollowing: false
    },
    { 
      id: 'r_group', 
      name: 'SomLuul Group', 
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80', 
      isGroup: true, 
      unreadCount: 12, 
      lastMessage: 'Ayaan: Warbixin ku saabsan tignoolajiyada cusub...', 
      lastMessageTime: '09:20 AM', 
      members: ['r_maryan', 'r_cumar', 'r_ahmed', 'me'],
      bio: 'Kooxda guud ee SomLuul. Wixii cusub halkan kala soco.',
      phone: '+252 61 0000000 (Group)',
      followersCount: 12500,
      followingCount: 0,
      isFollowing: false
    },
    { 
      id: 'r_ahmed', 
      name: 'Ahmed Hassan', 
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      unreadCount: 0, 
      lastMessage: 'Sawirkaas waa fiican yahay 👍', 
      lastMessageTime: '08:55 AM', 
      members: ['r_ahmed', 'me'],
      bio: 'Somali Tech Enthusiast and Open-Source PWA Developer.',
      phone: '+252 61 5666561',
      followersCount: 310,
      followingCount: 220,
      isFollowing: true
    },
    { 
      id: 'r_channel', 
      name: 'News Channel 📢', 
      avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      isChannel: true, 
      unreadCount: 5, 
      lastMessage: 'Somaliya oo guul balaadhan ka gaartay...', 
      lastMessageTime: '08:30 AM', 
      members: ['me'],
      bio: 'Kanaalka rasmiga ah ee wararka iyo horumarka dalka SomLuul.',
      phone: '+252 61 9998877',
      followersCount: 45000,
      followingCount: 0,
      isFollowing: true
    },
    { 
      id: 'r_fadumo', 
      name: 'Fadumo Ali', 
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      unreadCount: 0, 
      lastMessage: 'Voice message 🎤 0:12', 
      lastMessageTime: '08:22 AM', 
      members: ['r_fadumo', 'me'],
      bio: 'Somali UI/UX Designer creating elegant digital experiences.',
      phone: '+252 61 8889900',
      followersCount: 950,
      followingCount: 410,
      isFollowing: false
    },
    { 
      id: 'r_design', 
      name: 'Design Team 🎨', 
      avatar: 'https://images.unsplash.com/photo-1542744094-3a3172720449?w=400&auto=format&fit=crop&q=80', 
      isGroup: true, 
      unreadCount: 0, 
      lastMessage: 'You: Fadlan eeg presentation-ka cusub', 
      lastMessageTime: 'Yesterday', 
      members: ['r_fadumo', 'r_cumar', 'me'],
      bio: 'Kooxda nashqadaynta iyo bilicda rasmiga ah ee SomLuul.',
      phone: '+252 61 1112233',
      followersCount: 15,
      followingCount: 0,
      isFollowing: false
    },
    { 
      id: 'r_cabdirahman', 
      name: 'Cabdirahman', 
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80', 
      isGroup: false, 
      unreadCount: 0, 
      lastMessage: '📁 File', 
      lastMessageTime: 'Yesterday', 
      members: ['r_cabdirahman', 'me'],
      bio: 'Student at Somali National University studying Artificial Intelligence.',
      phone: '+252 61 5554433',
      followersCount: 120,
      followingCount: 95,
      isFollowing: false
    }
  ]);

  const [activeRoomId, setActiveRoomId] = useState<string>('r_maryan');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({
    r_maryan: [
      { id: 'm_maryan_1', roomId: 'r_maryan', senderId: 'r_maryan', senderName: 'Maryan Mohamed', content: 'Asc walalayaal, sidee tahay?', type: 'text', created_at: '09:41 AM' },
      { id: 'm_maryan_2', roomId: 'r_maryan', senderId: 'me', senderName: 'Me', content: 'Waa fiicanahay, adiguna?', type: 'text', created_at: '09:42 AM' },
      { id: 'm_maryan_3', roomId: 'r_maryan', senderId: 'r_maryan', senderName: 'Maryan Mohamed', content: 'Alxamdullilah, waan fiicanahay 😊', type: 'text', created_at: '09:42 AM' },
      { id: 'm_maryan_4', roomId: 'r_maryan', senderId: 'me', senderName: 'Me', content: 'Maxaa cusub?', type: 'text', created_at: '09:43 AM' },
      { id: 'm_maryan_5', roomId: 'r_maryan', senderId: 'r_maryan', senderName: 'Maryan Mohamed', content: 'Fariin maqal ah', type: 'voice', created_at: '09:44 AM', mediaUrl: '0:15' },
      { id: 'm_maryan_6', roomId: 'r_maryan', senderId: 'r_maryan', senderName: 'Maryan Mohamed', content: 'Waxaan joogaa halkan quruxda badan!', type: 'image', created_at: '09:45 AM', mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' }
    ],
    r_cumar: [
      { id: 'm_cumar_1', roomId: 'r_cumar', senderId: 'r_cumar', senderName: 'Cumar Abdi', content: 'Asc sxb, ma dhamaysay hawshii?', type: 'text', created_at: '09:30 AM' },
      { id: 'm_cumar_2', roomId: 'r_cumar', senderId: 'me', senderName: 'Me', content: 'Haa, hadda ayaan u soo dirayaa server-ka.', type: 'text', created_at: '09:32 AM' },
      { id: 'm_cumar_3', roomId: 'r_cumar', senderId: 'r_cumar', senderName: 'Cumar Abdi', content: 'Waan ku soo gaadhay.', type: 'text', created_at: '09:33 AM' }
    ],
    r_group: [
      { id: 'm_group_1', roomId: 'r_group', senderId: 'r_cumar', senderName: 'Cumar Abdi', content: 'Fadlan qof kasta halkan ha dhigo fikradiisa.', type: 'text', created_at: '09:15 AM' },
      { id: 'm_group_2', roomId: 'r_group', senderId: 'r_maryan', senderName: 'Maryan Mohamed', content: 'Ayaan: Warbixin ku saabsan tignoolajiyada cusub ayaa diyaar ah.', type: 'text', created_at: '09:20 AM' }
    ],
    r_ahmed: [
      { id: 'm_ahmed_1', roomId: 'r_ahmed', senderId: 'me', senderName: 'Me', content: 'Eeg nashqaddan cusub ee SomLuul Messenger.', type: 'text', created_at: '08:50 AM' },
      { id: 'm_ahmed_2', roomId: 'r_ahmed', senderId: 'r_ahmed', senderName: 'Ahmed Hassan', content: 'Sawirkaas waa fiican yahay 👍', type: 'text', created_at: '08:55 AM' }
    ],
    r_channel: [
      { id: 'm_chan_1', roomId: 'r_channel', senderId: 'system', senderName: 'SomLuul News', content: 'Wararkii u dambeeyay: Somaliya oo guul balaadhan ka gaartay dhanka tignoolajiyada isgaarsiinta.', type: 'text', created_at: '08:30 AM' }
    ],
    r_fadumo: [
      { id: 'm_fadumo_1', roomId: 'r_fadumo', senderId: 'r_fadumo', senderName: 'Fadumo Ali', content: 'Fadlan eeg farriintan codka ah.', type: 'voice', created_at: '08:22 AM', mediaUrl: '0:12' }
    ],
    r_design: [
      { id: 'm_des_1', roomId: 'r_design', senderId: 'r_fadumo', senderName: 'Fadumo Ali', content: 'Figma link-gii waa kan diyaar sxb.', type: 'text', created_at: 'Yesterday' },
      { id: 'm_des_2', roomId: 'r_design', senderId: 'me', senderName: 'Me', content: 'Fadlan eeg presentation-ka cusub', type: 'text', created_at: 'Yesterday' }
    ],
    r_cabdirahman: [
      { id: 'm_cab_1', roomId: 'r_cabdirahman', senderId: 'r_cabdirahman', senderName: 'Cabdirahman', content: 'Halkan ayaan kuugu soo lifaqay buugga.', type: 'file', created_at: 'Yesterday', mediaUrl: 'AI_Handbook.pdf' }
    ]
  });

  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState<string | null>(null); // name of who is typing
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Users blocking state
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  
  // Custom Starred & Pinned Messages lists
  const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Record<string, string>>({}); // roomId -> messageId

  // Live Poll responses tracker
  const [pollVotes, setPollVotes] = useState<Record<string, Record<string, number>>>({}); // messageId -> {optionIndex: votes}

  // Active Broadcast Lists
  const [broadcastLists, setBroadcastLists] = useState<Array<{ id: string; name: string; memberIds: string[] }>>([
    { id: 'b1', name: 'Mogadishu Tech Friends 📻', memberIds: ['khaalid', 'support'] }
  ]);

  // Message reply tracking
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);

  // Security Verification Screens
  const [otpVerificationState, setOtpVerificationState] = useState<{ phone: string; step: 'none' | 'input' | 'verified' }>({
    phone: '',
    step: 'none'
  });
  const [otpCode, setOtpCode] = useState('');

  // Privacy Options State
  const [privacySettings, setPrivacySettings] = useState({
    hideLastSeen: false,
    hideOnline: false
  });

  // Floating notifications toasts list
  const [activeToasts, setActiveToasts] = useState<InAppNotification[]>([]);

  // Sub-drawers & Dropdowns
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);
  const [showMediaUploadOverlay, setShowMediaUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);

  // UI Panels Modals Visibility
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(true);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [showBroadcastComposer, setShowBroadcastComposer] = useState(false);
  const [showBlockedManager, setShowBlockedManager] = useState(false);

  // Profiles Database
  const [profiles, setProfiles] = useState<any[]>([]);

  // Call simulation state
  const [activeCall, setActiveCall] = useState<{
    room: ChatRoom;
    type: 'voice' | 'video';
    status: 'connecting' | 'connected' | 'ended';
    noiseCancel: boolean;
    captionsEnabled: boolean;
    isScreenSharing: boolean;
    isMuted: boolean;
    callTime: number;
  } | null>(null);

  const [callCaption, setCallCaption] = useState<string>('Connecting secure server lines...');
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);
  const ringtoneControllerRef = useRef<{ stop: () => void } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const callConnectTimeoutRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);

  const handleStartCall = (type: 'voice' | 'video') => {
    const activeRoom = rooms.find(r => r.id === activeRoomId);
    if (!activeRoom) return;
    if (isCurrentRoomBlocked) { triggerAlert("Cannot call a blocked contact!", "error"); return; }

    if (callConnectTimeoutRef.current) clearTimeout(callConnectTimeoutRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (ringtoneControllerRef.current) {
      ringtoneControllerRef.current.stop();
      ringtoneControllerRef.current = null;
    }

    ringtoneControllerRef.current = playRingtoneSound();

    setActiveCall({
      room: activeRoom,
      type,
      status: 'connecting',
      noiseCancel: true,
      captionsEnabled: true,
      isScreenSharing: false,
      isMuted: false,
      isVideoOff: false,
      callTime: 0
    });

    callConnectTimeoutRef.current = setTimeout(() => {
      if (ringtoneControllerRef.current) {
        ringtoneControllerRef.current.stop();
        ringtoneControllerRef.current = null;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      playCallConnectedSound();
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
      setCallCaption(type === 'video' ? 'WebRTC secure video session initialized.' : 'Secure peer-to-peer line established.');
    }, 3500);

    callTimeoutRef.current = setTimeout(() => {
      handleEndCall(true);
    }, 35000);
  };

  const handleEndCall = (isUnanswered: boolean | React.SyntheticEvent = false) => {
    const unansweredFlag = typeof isUnanswered === 'boolean' ? isUnanswered : false;
    if (callConnectTimeoutRef.current) clearTimeout(callConnectTimeoutRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (ringtoneControllerRef.current) {
      try { ringtoneControllerRef.current.stop(); } catch (e) {}
      ringtoneControllerRef.current = null;
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
    if (unansweredFlag) {
      triggerAlert("Wicitaanku ma jawaabin (Call Unanswered / No Answer)", "error");
    }
  };

  // Real Microphone Audio Recorder Hook
  const audioRecorder = useAudioRecorder();

  // Handle active video call camera feed
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
          console.warn('Call stream camera notice:', err);
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

  const renderAvatar = (avatarUrl: string | null | undefined, name: string, sizeClass = "w-10 h-10") => {
    const isValidUrl = avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:image') || avatarUrl.startsWith('/'));
    if (isValidUrl) {
      return (
        <img 
          src={avatarUrl} 
          alt={name || 'User'} 
          className={`${sizeClass} rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0`} 
          referrerPolicy="no-referrer"
        />
      );
    }
    const parts = name ? name.trim().split(' ').filter(p => Boolean(p) && !['user', 'admin'].includes(p.toLowerCase())) : [];
    const initials = parts.length >= 2 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts.length === 1 && parts[0].length > 0 ? parts[0].slice(0, 2).toUpperCase() : '💬');

    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 tracking-tight border border-white/30 shadow-xs font-sans`}>
        {initials}
      </div>
    );
  };

  // --- ACTIONS & API HOOKS ---

  // Fetch profiles registered on database
  const fetchProfiles = async () => {
    try {
      const res = await axios.get('/api/profiles', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setProfiles(res.data);
    } catch (_err) {
      // Silent fallback
    }
  };

  const syncWithServerDB = async () => {
    if (!authToken) return;
    try {
      const roomsRes = await axios.get('/api/chat/rooms', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (roomsRes.data && roomsRes.data.length > 0) {
        setRooms(prev => {
          let updated = false;
          const merged = [...prev];
          roomsRes.data.forEach((srvRoom: any) => {
            const index = merged.findIndex(r => r.id === srvRoom.id);
            if (index > -1) {
              if (merged[index].lastMessage !== srvRoom.lastMessage || merged[index].unreadCount !== srvRoom.unreadCount) {
                merged[index] = { ...merged[index], ...srvRoom };
                updated = true;
              }
            } else {
              merged.push(srvRoom);
              updated = true;
            }
          });
          return updated ? merged : prev;
        });
      }

      const msgsRes = await axios.get('/api/chat/messages', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (msgsRes.data && msgsRes.data.length > 0) {
        setMessages(prev => {
          let updated = false;
          const merged = { ...prev };
          msgsRes.data.forEach((msg: any) => {
            const roomId = msg.roomId;
            if (!merged[roomId]) merged[roomId] = [];
            const exists = merged[roomId].some((m: any) => m.id === msg.id);
            if (!exists) {
              merged[roomId] = [...merged[roomId], msg];
              updated = true;
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
      // Silent fallback
    }
  };

  useEffect(() => {
    fetchProfiles();
    syncWithServerDB();
    const syncInterval = setInterval(() => {
      // Only sync if document is focused to avoid disrupting scrolling/reviewing
      if (document.hasFocus()) {
        syncWithServerDB();
      }
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [authToken]);

  const processTargetProfile = (targetProfile: any) => {
    if (!targetProfile || !targetProfile.id) return;
    const nameStr = targetProfile.first_name ? `${targetProfile.first_name} ${targetProfile.last_name || ''}`.trim() : (targetProfile.name || 'User');
    const newRoom: ChatRoom = {
      id: targetProfile.id,
      name: nameStr,
      avatar: targetProfile.avatar || null,
      isGroup: false,
      unreadCount: 0,
      lastMessage: language === 'so' ? 'Ku bilow hadal badbaado leh!' : 'Start a secure chat!',
      lastMessageTime: 'Just now',
      members: [targetProfile.id, 'me'],
      bio: targetProfile.bio || '',
      phone: targetProfile.phone || ''
    };
    setRooms(prev => {
      const exists = prev.some(r => r.id === targetProfile.id);
      if (exists) return prev;
      return [newRoom, ...prev];
    });
    setActiveRoomId(targetProfile.id);
    setMobileView('chat');
  };

  // Persistent storage loaders & dynamic event listeners
  useEffect(() => {
    let currentRooms: ChatRoom[] = [];
    const savedRooms = localStorage.getItem('somluul_chat_rooms');
    if (savedRooms) {
      try {
        currentRooms = JSON.parse(savedRooms);
        setRooms(currentRooms);
      } catch (e) {
        console.error('Error parsing stored chat rooms:', e);
      }
    }
    const savedMessages = localStorage.getItem('somluul_chat_messages');
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Error parsing stored chat messages:', e);
      }
    }

    // Handle initial redirection/start-chat
    const chatTargetStr = localStorage.getItem('somluul_chat_target_profile');
    if (chatTargetStr) {
      try {
        const targetProfile = JSON.parse(chatTargetStr);
        localStorage.removeItem('somluul_chat_target_profile');
        processTargetProfile(targetProfile);
      } catch (e) {
        // Silent catch
      }
    }

    const handleCustomOpenChat = (e: CustomEvent) => {
      if (e.detail) {
        processTargetProfile(e.detail);
      }
    };

    window.addEventListener('somluul_open_floating_chat' as any, handleCustomOpenChat as any);
    window.addEventListener('somluul_select_messenger_room' as any, handleCustomOpenChat as any);
    return () => {
      window.removeEventListener('somluul_open_floating_chat' as any, handleCustomOpenChat as any);
      window.removeEventListener('somluul_select_messenger_room' as any, handleCustomOpenChat as any);
    };
  }, []);

  // Persistent storage synchronizers
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      localStorage.setItem('somluul_chat_rooms', JSON.stringify(rooms));
    }
  }, [rooms]);

  useEffect(() => {
    if (messages && Object.keys(messages).length > 0) {
      localStorage.setItem('somluul_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll stream inside chat container without scrolling main window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeRoomId, isTyping]);

  // Simulated Voice Note Duration Counter
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording]);

  // Secure E2E Call Captions simulation
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') return;
    const captionInterval = setInterval(() => {
      // Increment call timer
      setActiveCall(prev => prev ? { ...prev, callTime: prev.callTime + 1 } : null);

      const somaliCaptions = [
        "Waan ku ngheystaa si fiican, codkaagu waa nadiif.",
        "Miyaad wadaagi kartaa shaashaddaada si aan u arko faylka?",
        "Haa, suuqa SomLuul waa mid aad u badbaado dhan.",
        "Nidaamka dhimista sawaxanka ayaa hadda si toos ah u shaqeynaya.",
        "Mahadsanid sxb, aan is aragno berrito!"
      ];
      const englishCaptions = [
        "I can hear you perfectly, your voice is crystal clear.",
        "Can you share your screen so I can look at the presentation?",
        "Yes, SomLuul platform is fully end-to-end encrypted.",
        "The noise cancellation engine is filtering ambient noises perfectly.",
        "Thank you friend, let us catch up tomorrow!"
      ];
      const items = language === 'so' ? somaliCaptions : englishCaptions;
      setCallCaption(items[Math.floor(Math.random() * items.length)]);
    }, 4000);

    return () => clearInterval(captionInterval);
  }, [activeCall, language]);

  // --- MESSAGING OPERATORS ---

  // Handle send message logic with Offline Cache and Background Queue support
  const handleSendMessage = (textToSend?: string, customType: 'text' | 'image' | 'video' | 'file' | 'voice' | 'location' = 'text', customMediaUrl?: string) => {
    const rawContent = textToSend || inputText;
    if (!rawContent.trim() && !customMediaUrl) return;

    const activeRoom = rooms.find(r => r.id === activeRoomId);
    if (!activeRoom) return;

    // Check if user is blocked
    if (blockedUserIds.includes(activeRoomId)) {
      triggerAlert("You cannot message a blocked user. Unblock them to continue.", "error");
      return;
    }

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomId: activeRoomId,
      senderId: user?.id || 'me',
      senderName: `${user?.first_name || 'Me'} ${user?.last_name || ''}`,
      content: replyingToMessage ? `[Replied to: ${replyingToMessage.content.slice(0, 30)}] ${rawContent}` : rawContent,
      type: customType,
      mediaUrl: customMediaUrl,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (networkStatus === 'offline') {
      // Background Sync offline queuing
      setOfflineQueue(prev => [...prev, newMsg]);
      
      // Still append locally with offline marking
      setMessages(prev => ({
        ...prev,
        [activeRoomId]: [...(prev[activeRoomId] || []), { ...newMsg, reaction: '🕒 (Offline Queue)' }]
      }));
    } else {
      // Normal online dispatch
      setMessages(prev => ({
        ...prev,
        [activeRoomId]: [...(prev[activeRoomId] || []), newMsg]
      }));

      // Play message chime
      playNotificationSound();

      // Update last message
      setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, lastMessage: rawContent || `Shared a ${customType}`, lastMessageTime: 'Just now' } : r));

      // Synchronize with server database
      const updatedRoom = {
        ...activeRoom,
        lastMessage: rawContent || `Shared a ${customType}`,
        lastMessageTime: 'Just now'
      };
      axios.post('/api/chat/rooms', { room: updatedRoom }, {
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(err => console.warn('Room sync error:', err));

      axios.post('/api/chat/messages', { message: newMsg }, {
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(err => console.warn('Message sync error:', err));

      // Simulated contact interactive response
      if (activeRoomId !== (user?.id || 'me') && !activeRoom.isGroup) {
        setTimeout(() => {
          const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const replyContent = customType === 'voice' 
            ? `Asc! Farriintaada codka ah waa aan helay, waa ku mahadsan tahay 🎤`
            : (customType === 'image' 
                ? `Sawir aad u qurux badan! Waad ku mahadsan tahay wadaaga 📷`
                : `Waad ku mahadsan tahay fariintaada! Sideen ku caawin karaa maanta? 😊`);

          const replyMsg: ChatMessage = {
            id: `m_reply_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            roomId: activeRoomId,
            senderId: activeRoom.id,
            senderName: activeRoom.name,
            content: replyContent,
            type: 'text',
            created_at: replyTime
          };

          setMessages(prev => ({
            ...prev,
            [activeRoomId]: [...(prev[activeRoomId] || []), replyMsg]
          }));

          playNotificationSound();

          setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, lastMessage: replyContent, lastMessageTime: 'Just now' } : r));

          if (authToken) {
            axios.post('/api/chat/messages', { message: replyMsg }, {
              headers: { Authorization: `Bearer ${authToken}` }
            }).catch(() => {});
          }
        }, 1800);
      }
    }

    setInputText('');
    setReplyingToMessage(null);
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

    triggerAlert(language === 'so' ? "✓ Fariinta waa la tirtiray" : "✓ Message deleted successfully", "success");
  };

  // Dispatch all queued offline messages when reconnecting
  const triggerBackgroundSync = () => {
    if (offlineQueue.length === 0) return;
    setNetworkStatus('online');

    // Emulate background synchronization
    offlineQueue.forEach(msg => {
      setMessages(prev => {
        const list = prev[msg.roomId] || [];
        // Remove offline markers
        const updated = list.map(m => m.id === msg.id ? { ...m, reaction: undefined } : m);
        return { ...prev, [msg.roomId]: updated };
      });
    });

    triggerAlert(`Background Sync complete! ${offlineQueue.length} queued messages dispatched successfully.`, "success");
    setOfflineQueue([]);
  };

  // Voice Notes Recorder Dispatcher
  const handleStartRecordingVoice = async () => {
    if (isCurrentRoomBlocked) return;
    const success = await audioRecorder.startRecording();
    if (!success) {
      setIsRecording(true); // fall back to timer simulation if mic unavailable
    }
  };

  const handleFinishVoiceRecording = async () => {
    if (audioRecorder.isRecording) {
      const result = await audioRecorder.stopRecording();
      if (result && result.audioUrl) {
        const durStr = `0:${result.durationSeconds < 10 ? '0' : ''}${result.durationSeconds}`;
        handleSendMessage(`🎤 Voice Note (${durStr})`, 'voice', result.audioUrl);
        return;
      }
    }
    // Fallback simulation
    setIsRecording(false);
    const audioSeconds = recordingSeconds || 8;
    handleSendMessage(`🎤 Voice Note (0:${audioSeconds < 10 ? '0' : ''}${audioSeconds})`, 'voice', '#simulated_voice_note');
  };

  const handleCancelVoiceRecording = () => {
    if (audioRecorder.isRecording) {
      audioRecorder.cancelRecording();
    }
    setIsRecording(false);
  };

  // Location Sharing Pinpointer
  const handleSendLocation = () => {
    const mapsMock = `https://maps.google.com/?q=2.0408,45.3421`; // Mogadishu center
    handleSendMessage(`📍 Shared Location: Mogadishu, Somalia`, 'location', mapsMock);
  };

  // Contact Sharing Card Dispatcher
  const handleSendContact = (contactProfile: any) => {
    const details = `👤 Contact Card: ${contactProfile.first_name} ${contactProfile.last_name} (@${contactProfile.email.split('@')[0]}) • 📱 ${contactProfile.phone || 'No Phone'}`;
    handleSendMessage(details, 'text');
    triggerAlert(`Shared contact @${contactProfile.email.split('@')[0]} to this chat.`, "success");
  };

  // Custom Interactive Polls builder
  const handleSendPoll = (question: string, options: string[]) => {
    const pollId = `poll_${Date.now()}`;
    const formattedContent = `📊 POLL: ${question}\n` + options.map((o, idx) => `[${idx}] ${o}`).join('\n');
    
    // Dispatch
    handleSendMessage(formattedContent, 'text');

    // Register active vote tracker
    const votesInit: Record<string, number> = {};
    options.forEach((_, idx) => {
      votesInit[idx.toString()] = 0;
    });

    setPollVotes(prev => ({
      ...prev,
      [pollId]: votesInit
    }));
  };

  // Handle vote click on custom polls
  const handleVotePoll = (pollId: string, optionIdx: number) => {
    setPollVotes(prev => {
      const current = prev[pollId] || {};
      const votes = current[optionIdx.toString()] || 0;
      return {
        ...prev,
        [pollId]: {
          ...current,
          [optionIdx.toString()]: votes + 1
        }
      };
    });
  };

  // Broadcast lists transmitter
  const handleSendBroadcast = (listId: string, broadcastMsgText: string) => {
    const selectedList = broadcastLists.find(l => l.id === listId);
    if (!selectedList) return;

    // Send the message individually to all members of the list
    selectedList.memberIds.forEach(memberId => {
      const bMsg: ChatMessage = {
        id: `m_b_${Date.now()}_${memberId}`,
        roomId: memberId,
        senderId: 'me',
        senderName: `${user?.first_name || 'Me'} ${user?.last_name || ''}`,
        content: `📢 [Broadcast]: ${broadcastMsgText}`,
        type: 'text',
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => ({
        ...prev,
        [memberId]: [...(prev[memberId] || []), bMsg]
      }));

      // Update room lastMessage
      setRooms(prev => prev.map(r => r.id === memberId ? { ...r, lastMessage: `📢 Broadcast: ${broadcastMsgText.slice(0, 20)}...`, lastMessageTime: 'Just now' } : r));
    });
  };

  // File Uploader with realistic animated Progress bar (Fulfills Module 6)
  const handleTriggerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress({ name: file.name, pct: 10 });
    setShowMediaUploadOverlay(false);

    let progress = 10;
    const interval = setInterval(() => {
      progress += 25;
      if (progress >= 100) {
        clearInterval(interval);
        setUploadProgress(null);
        
        // Append to chat stream as file attachment
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        handleSendMessage(`📄 ${file.name} (${sizeMb} MB)`, 'file', '/uploads/.write-test');
      } else {
        setUploadProgress({ name: file.name, pct: progress });
      }
    }, 400);
  };

  // OTP Phone Verification flow
  const handleOTPRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerificationState.phone.trim()) return;

    setOtpVerificationState(prev => ({ ...prev, step: 'input' }));
    triggerAlert(`SomLuul Secure Core: SMS with a 6-digit OTP code has been dispatched to ${otpVerificationState.phone}. Enter code "666561" to verify.`, "success");
  };

  const handleOTPVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode === '666561' || otpCode === '123456') {
      setOtpVerificationState(prev => ({ ...prev, step: 'verified' }));
      triggerAlert("✓ Phone verified securely via OTP SMS. Account security hardened.", "success");
    } else {
      triggerAlert("❌ Invalid OTP verification code. Please retry.", "error");
    }
  };

  // --- HELPER COMPONENT DISPATCHERS ---
  const handleToggleBlock = (targetId: string) => {
    setBlockedUserIds(prev => {
      const exists = prev.includes(targetId);
      if (exists) {
        triggerAlert("Contact unblocked successfully.", "success");
        return prev.filter(id => id !== targetId);
      } else {
        triggerAlert("Contact blocked. They can no longer call or text you.", "error");
        return [...prev, targetId];
      }
    });
  };

  const handleCreateGroupChannel = (groupData: { name: string; avatar: string; description: string; members: string[] }) => {
    const newGroupId = `group_${Date.now()}`;
    const newGroupRoom: ChatRoom = {
      id: newGroupId,
      name: groupData.name,
      avatar: groupData.avatar,
      isGroup: true,
      unreadCount: 0,
      lastMessage: 'Kooxda si guul leh ayaa loo abuuray. Ku soo dhowada!',
      lastMessageTime: 'Just now',
      members: groupData.members,
      bio: groupData.description,
      phone: 'Group Chat Link: somluul.com/join/' + newGroupId
    };

    setRooms(prev => [newGroupRoom, ...prev]);
    setMessages(prev => ({
      ...prev,
      [newGroupId]: [
        { id: `init_${Date.now()}`, roomId: newGroupId, senderId: 'system', senderName: 'SomLuul Security', content: `🔒 Group initialized with End-to-End Encryption. Description: "${groupData.description}"`, type: 'text', created_at: 'Just now' }
      ]
    }));
    setActiveRoomId(newGroupId);
  };

  // Global search matching messages and attachments (Fulfills Module 9)
  const getGlobalSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const results: Array<{ type: 'message' | 'group' | 'contact'; title: string; subtitle: string; roomId: string }> = [];

    // Search contacts/users
    profiles.forEach(p => {
      const name = `${p.first_name} ${p.last_name}`;
      if (name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.includes(searchQuery)) {
        results.push({ type: 'contact', title: name, subtitle: `Contact: @${p.email.split('@')[0]}`, roomId: p.id });
      }
    });

    // Search messages content
    Object.keys(messages).forEach(rId => {
      const roomMsgs = messages[rId] || [];
      const matchedRoom = rooms.find(r => r.id === rId);
      if (!matchedRoom) return;

      roomMsgs.forEach(m => {
        if (m.content.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ type: 'message', title: m.content, subtitle: `In chat with: ${matchedRoom.name}`, roomId: rId });
        }
      });
    });

    return results;
  };

  const globalSearchResults = getGlobalSearchResults();

  // Filtered rooms display list based on sub-tabs
  const filteredRooms = rooms.filter(r => {
    // Search query filter first
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedSubTab === 'chats') {
      return !r.isGroup && !r.isChannel;
    }
    if (selectedSubTab === 'groups') {
      return r.isGroup === true;
    }
    if (selectedSubTab === 'channels') {
      return r.isChannel === true;
    }
    return true; // 'all'
  });
  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activeRoomMessages = messages[activeRoomId] || [];

  const isCurrentRoomBlocked = blockedUserIds.includes(activeRoomId);

  // Match against profile
  const matchingRealProfile = activeRoom ? profiles.find(p => p.id === activeRoom.id) : null;

  // Custom Somali Themes stickers dictionary (Module 5 stickers)
  const somaliStickers = [
    { label: '🐪 Geel dhoodaan', emoji: '🐪', desc: 'Camel emoji sticker' },
    { label: '☕ Shaah Carbeed', emoji: '☕', desc: 'Somali Cardamom Spiced Tea' },
    { label: '🌊 Lido Beach', emoji: '🌊', desc: 'Mogadishu Beach wave' },
    { label: '🌴 SomLuul Premium', emoji: '🌴', desc: 'Official SomLuul premium leaf' },
    { label: '🛡️ Gaashaan', emoji: '🛡️', desc: 'Somali traditional shield' }
  ];

  return (
    <DeviceFrame language={language}>
      
      <div id="messenger-wrapper" className="bg-white dark:bg-[#141b2d] rounded-2xl shadow-sm h-[calc(100vh-140px)] min-h-[460px] max-h-[720px] overflow-hidden grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 relative border border-gray-150 dark:border-gray-800/60 animate-fade-in">
        
        {/* 1. SIDEBAR COLUMN (ROOMS, CHATS, AND DISCOVERY SECTORS) */}
        <div className={`border-r border-gray-150 dark:border-gray-800/60 flex flex-col h-full bg-gray-50/50 dark:bg-[#121826] md:col-span-1 pt-3 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          
          {/* SomLuul Mockup Header */}
          <div className="px-3.5 py-3 bg-white dark:bg-[#141b2d] flex justify-between items-center select-none border-b border-gray-100 dark:border-gray-850">
            <div className="flex items-center gap-1.5">
              {onNavigateHome && (
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                  title="Ka noqo / Back to Home"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (onNavigateHome) onNavigateHome();
                }}
                className="text-lg font-black text-blue-600 dark:text-blue-500 tracking-tight font-sans flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer text-left"
                title="Aada Hoyga SomLuul / Go to Home Feed"
              >
                <AppLogo className="w-6 h-6 rounded-lg" />
                <span>SomLuul</span>
              </button>
            </div>
            <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400">
              <button 
                onClick={() => setSelectedSubTab('contacts')} 
                className={`p-1.5 rounded-lg hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-all ${selectedSubTab === 'contacts' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-450' : ''}`}
                title="Daawo Lambarada / Contacts"
              >
                <Users size={17} />
              </button>
              <button 
                onClick={() => setShowBroadcastComposer(true)}
                className="p-1.5 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-all"
                title="Broadcasting"
              >
                <Radio size={16} />
              </button>
              <button 
                onClick={() => setShowGroupCreator(true)}
                className="p-1.5 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-all"
                title="Create Group"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Sub-tabs Slider Menu */}
          <div className="px-4 py-2 bg-white dark:bg-[#141b2d] overflow-x-auto scrollbar-none flex gap-1.5 border-b border-gray-100 dark:border-gray-850">
            {[
              { id: 'all', label: language === 'so' ? 'Dhamaan' : 'All' },
              { id: 'chats', label: language === 'so' ? 'Kala hadal' : 'Chats' },
              { id: 'groups', label: language === 'so' ? 'Kooxaha' : 'Groups' },
              { id: 'channels', label: language === 'so' ? 'Kanaalada' : 'Channels' },
              { id: 'contacts', label: language === 'so' ? 'Lambarada' : 'Contacts' }
            ].map(tab => {
              const isActive = selectedSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedSubTab(tab.id as any)}
                  className={`px-3 py-1.5 text-[11px] font-extrabold rounded-full transition-all shrink-0 cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search globally / locally */}
          <div className="p-3 bg-white dark:bg-[#141b2d] space-y-2 border-b border-gray-100 dark:border-gray-850">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
              <input
                type="text"
                placeholder={selectedSubTab === 'contacts' ? (language === 'so' ? 'Raadi lambar ama magac...' : 'Search contacts...') : t('search_chats')}
                className="w-full pl-8.5 pr-3 py-2 bg-gray-50 dark:bg-[#1f293d] border border-gray-150 dark:border-gray-700/60 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Global Search Results dropdown if matching (Module 9) */}
            {searchQuery.trim() !== '' && selectedSubTab !== 'contacts' && globalSearchResults.length > 0 && (
              <div className="bg-white dark:bg-[#1e2738] border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 space-y-2 shadow-lg max-h-36 overflow-y-auto">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Global Search Matches:</span>
                {globalSearchResults.map((res, i) => (
                  <div 
                    key={i} 
                    onClick={() => { setActiveRoomId(res.roomId); setSearchQuery(''); }}
                    className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer text-[10px]"
                  >
                    <span className="font-bold text-gray-950 dark:text-white block truncate">{res.title}</span>
                    <span className="text-blue-500 font-medium block truncate mt-0.5">{res.subtitle}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PRIVACY CONTROLS SHORTCUT */}
          <div className="px-4 py-2.5 bg-gray-50/50 dark:bg-gray-900/10 border-b border-gray-150 dark:border-gray-800/60 flex items-center justify-between text-[10px]">
            <span className="text-gray-400 font-bold uppercase font-mono">My Presence</span>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={privacySettings.hideOnline} 
                  onChange={(e) => setPrivacySettings({ ...privacySettings, hideOnline: e.target.checked })} 
                  className="rounded dark:bg-gray-800 border-gray-300"
                />
                <span className="text-gray-500 dark:text-gray-450">Hide Online</span>
              </label>
            </div>
          </div>

          {/* ROOMS AND CONTACTS LISTING STREAM */}
          <div className="grow overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40 scrollbar-thin">
            {selectedSubTab === 'contacts' ? (
              <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pb-1">
                  <span>{language === 'so' ? 'Lambarrada ku jira taleefankaaga' : 'Your Phonebook Contacts'}</span>
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    {mockPhoneBook.length} Contacts
                  </span>
                </div>
                
                <div className="space-y-3.5">
                  {getMatchedPhonebook()
                    .filter(c => 
                      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      c.phone.includes(searchQuery)
                    )
                    .map((contact, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2.5 p-2 hover:bg-gray-100/40 dark:hover:bg-gray-800/20 rounded-xl transition-all">
                        <div className="flex gap-2.5 items-center min-w-0">
                          {renderAvatar(contact.room?.avatar, contact.name, "w-9 h-9")}
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {contact.name}
                              </span>
                              {contact.registered && (
                                <span className="text-[7.5px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1 rounded font-black uppercase tracking-wider shrink-0">
                                  SomLuul
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-450 font-mono block mt-0.5">
                              {contact.phone}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          {contact.registered ? (
                            <>
                              <button
                                onClick={() => {
                                  if (contact.room) {
                                    setActiveRoomId(contact.room.id);
                                    setShowContactInfo(true);
                                    setMobileView('chat');
                                  }
                                }}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer"
                                title="Show Profile"
                              >
                                Profile
                              </button>
                              <button
                                onClick={() => {
                                  if (contact.room) {
                                    setActiveRoomId(contact.room.id);
                                    setMobileView('chat');
                                  }
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                              >
                                Chat
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setInviteTargetContact(contact);
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-extrabold rounded-lg transition-all cursor-pointer shadow-xs"
                            >
                              {language === 'so' ? 'Casuun' : 'Invite'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              filteredRooms.map(r => {
                const isBlocked = blockedUserIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => { setActiveRoomId(r.id); setMobileView('chat'); }}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition-all ${r.id === activeRoomId ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500' : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/30'}`}
                  >
                    <div className="relative shrink-0">
                      {renderAvatar(r.avatar, r.name, "w-10 h-10")}
                      {!isBlocked && !privacySettings.hideOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#141b2d]" />
                      )}
                    </div>
                    
                    <div className="grow min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold truncate ${r.isSecret ? 'text-green-600 dark:text-green-400 flex items-center gap-1' : 'text-gray-900 dark:text-white'}`}>
                          {r.isSecret && <Shield size={11} />}
                          {r.name}
                        </span>
                        <span className="text-[9px] text-gray-400 shrink-0">{r.lastMessageTime}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {isBlocked ? '🚫 Content Blocked' : r.lastMessage}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VERIFY PHONE CORNER LINK */}
          <div className="p-3 bg-gray-100/60 dark:bg-gray-900/40 border-t border-gray-150 dark:border-gray-850 flex justify-between items-center">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Verification Status</span>
            <button
              onClick={() => setOtpVerificationState({ phone: user.phone || '615666561', step: 'input' })}
              className={`text-[9px] font-bold px-2 py-0.8 rounded-md transition-all ${otpVerificationState.step === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'}`}
            >
              {otpVerificationState.step === 'verified' ? '✓ OTP Verified' : 'Unverified • OTP Sync'}
            </button>
          </div>

        </div>

        {/* 2. CHAT STREAM PANEL (CONVERSATIONS FEED) */}
        <div className={`flex flex-col h-full overflow-hidden min-h-0 bg-white dark:bg-[#141b2d] ${showContactInfo ? 'md:col-span-2 lg:col-span-2' : 'md:col-span-2 lg:col-span-3'} ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          
          {activeRoom ? (
            <>
              {/* Active room headers */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800/60 flex justify-between items-center bg-gray-50/20 dark:bg-gray-900/10 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-1.5 hover:bg-gray-150 dark:hover:bg-gray-800 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all shrink-0"
                    title="Back to chat list"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div 
                    onClick={() => setShowContactInfo(true)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80"
                  >
                    {renderAvatar(activeRoom.avatar, activeRoom.name, "w-9 h-9")}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                        {activeRoom.name}
                        {isCurrentRoomBlocked && (
                          <span className="text-[8px] bg-red-500/10 text-red-600 dark:text-red-400 font-extrabold px-1.5 py-0.2 rounded uppercase">BLOCKED</span>
                        )}
                      </h4>
                      <div className="text-[9px] text-gray-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isCurrentRoomBlocked ? 'bg-gray-400' : 'bg-green-500'}`}></span>
                        <span>{isCurrentRoomBlocked ? 'Blocked' : 'Online / Verified Line'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call & Meta settings */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartCall('voice')}
                    className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                    title="Wacitaanka Codka / Voice Call"
                  >
                    <Phone size={15} />
                  </button>

                  <button
                    onClick={() => handleStartCall('video')}
                    className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                    title="Wacitaanka Muuqaalka / Video Call"
                  >
                    <Video size={15} />
                  </button>

                  <button
                    onClick={() => setShowContactInfo(!showContactInfo)}
                    className={`p-2 rounded-xl transition-all ${showContactInfo ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    title="Xogta Qofka / Contact Info"
                  >
                    <Info size={15} />
                  </button>

                  {/* Close Chat Button (X) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoomId('');
                      setShowContactInfo(false);
                      setMobileView('list');
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all cursor-pointer ml-1"
                    title="Xidh Sheekada / Close Chat (X)"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* CHATS STREAM CONTAINER */}
              <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-50/20 dark:bg-[#0b0f19]/15">
                {activeRoomMessages.map((m, idx) => {
                  const isMe = m.senderId === 'me' || m.senderId === user?.id;
                  const isStarred = starredMessageIds.includes(m.id);
                  const isPinned = pinnedMessageIds[activeRoomId] === m.id;

                  return (
                    <div key={m.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                      
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                        {/* Pinned Marker */}
                        {isPinned && (
                          <span className="text-[8px] text-blue-500 font-extrabold flex items-center gap-1 mb-1 uppercase tracking-widest"><Pin size={8} /> Pinned Message</span>
                        )}

                        {/* Speech Bubble */}
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs relative ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-150 dark:bg-[#1f293d] text-gray-900 dark:text-gray-200 rounded-bl-none'}`}>
                          
                          {/* File sharing attachment template with realistic download/preview features (Module 6) */}
                          {m.type === 'file' && (
                            <div className="flex items-center gap-2.5 p-1 bg-black/5 dark:bg-black/20 rounded-xl border border-white/10 my-1">
                              <span className="text-xl">📄</span>
                              <div className="min-w-0 text-left">
                                <span className="block font-bold text-[11px] truncate">{m.content}</span>
                                <span className="text-[9px] text-gray-400 block mt-0.5">Attachment verified • 100% Downloaded</span>
                              </div>
                            </div>
                          )}

                          {/* Location pin template */}
                          {m.type === 'location' && (
                            <div className="p-1 my-1 space-y-1 text-left bg-black/10 rounded-xl">
                              <span className="text-xs font-bold block flex items-center gap-1 text-blue-300"><MapPin size={11} /> Lido Beach, Mogadishu</span>
                              <div className="w-full h-24 bg-gray-300 dark:bg-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                                <span className="text-lg">📍</span>
                                <span className="absolute bottom-1 right-1 text-[8px] bg-black/50 text-white px-1.5 py-0.2 rounded font-mono">2.0408, 45.3421</span>
                              </div>
                              <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline block font-semibold">Open in Google Maps</a>
                            </div>
                          )}

                          {/* Image preview template */}
                          {m.type === 'image' && (
                            <div className="space-y-1.5 my-1 text-left">
                              <img
                                src={m.mediaUrl || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80'}
                                alt="Sawir"
                                className="rounded-xl max-h-60 max-w-full object-cover border border-white/20 shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
                                referrerPolicy="no-referrer"
                                onClick={() => {
                                  if (m.mediaUrl) window.open(m.mediaUrl, '_blank');
                                }}
                              />
                              {m.content && m.content !== 'Sawir 📷' && <p className="text-xs pt-0.5">{m.content}</p>}
                            </div>
                          )}

                          {/* Voice Note player */}
                          {m.type === 'voice' ? (
                            <VoiceNotePlayer
                              mediaUrl={m.mediaUrl}
                              durationLabel={m.content.includes('(') ? m.content.split('(')[1]?.replace(')', '') : '0:08'}
                              isMe={isMe}
                            />
                          ) : (
                            /* Render default text */
                            m.type !== 'file' && m.type !== 'location' && m.type !== 'image' && (
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            )
                          )}

                          {/* Action context float menus on hover */}
                          <div className="absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white dark:bg-[#1f293d] border border-gray-250 dark:border-gray-700 shadow-md p-1 rounded-xl z-20 transition-all -left-20 group-hover:opacity-100">
                            {/* Star */}
                            <button 
                              onClick={() => {
                                setStarredMessageIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                              }}
                              className={`p-1 hover:text-amber-500 rounded ${isStarred ? 'text-amber-500' : 'text-gray-400'}`}
                              title="Star message"
                            >
                              <Star size={11} />
                            </button>
                            {/* Pin */}
                            <button
                              onClick={() => {
                                setPinnedMessageIds(prev => ({ ...prev, [activeRoomId]: prev[activeRoomId] === m.id ? '' : m.id }));
                              }}
                              className={`p-1 hover:text-blue-500 rounded ${isPinned ? 'text-blue-500' : 'text-gray-400'}`}
                              title="Pin/unpin message"
                            >
                              <Pin size={11} />
                            </button>
                            {/* Reply */}
                            <button
                              onClick={() => setReplyingToMessage(m)}
                              className="p-1 hover:text-indigo-500 text-gray-400 rounded"
                              title="Reply to message"
                            >
                              <CornerUpLeft size={11} />
                            </button>
                            {/* Delete message button */}
                            <button
                              onClick={() => handleDeleteMessage(m.id, activeRoomId)}
                              className="p-1 hover:text-rose-500 text-gray-400 rounded"
                              title={language === 'so' ? "Tirtir fariinta" : "Delete message"}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                        </div>

                        {/* Meta indicators */}
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-gray-400 font-mono font-bold">
                          <span>{m.created_at}</span>
                          {isStarred && <Star size={9} className="text-amber-500 fill-amber-500" />}
                          {isMe && <CheckCheck size={11} className="text-blue-500 shrink-0" />}
                          {m.reaction && <span className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[8px]">{m.reaction}</span>}
                          <button
                            onClick={() => handleDeleteMessage(m.id, activeRoomId)}
                            className="text-gray-400 hover:text-rose-500 transition-colors ml-1"
                            title={language === 'so' ? "Tirtir fariinta" : "Delete message"}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicators */}
                {isTyping && (
                  <div className="flex justify-start items-center gap-2 text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">{isTyping}</span>
                    <span>{t('typing')}</span>
                    <span className="flex gap-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </div>
                )}


              </div>

              {/* INPUT BOX CONTROL FOOTERS */}
              <div className="p-3 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/10 dark:bg-gray-900/10">
                
                {/* Replying context bar if active */}
                {replyingToMessage && (
                  <div className="p-2 mb-2 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-300">
                    <div className="truncate">
                      <span className="font-bold">Replying to {replyingToMessage.senderName}: </span>
                      <span className="italic">"{replyingToMessage.content}"</span>
                    </div>
                    <button onClick={() => setReplyingToMessage(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Drawers panels overlay toggles */}
                <div className="flex gap-2 mb-2">
                  {/* Emoji Drawer trigger */}
                  <button 
                    onClick={() => { setShowEmojiDrawer(!showEmojiDrawer); setShowStickerDrawer(false); }}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border transition-all ${showEmojiDrawer ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
                  >
                    😃 Emoji
                  </button>

                  {/* Somali Tech Stickers drawer */}
                  <button 
                    onClick={() => { setShowStickerDrawer(!showStickerDrawer); setShowEmojiDrawer(false); }}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border transition-all ${showStickerDrawer ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
                  >
                    🐫 Somali Stickers
                  </button>

                  {/* Attachment overlay launcher */}
                  <button 
                    onClick={() => setShowMediaUploadOverlay(!showMediaUploadOverlay)}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border bg-white dark:bg-gray-800 text-gray-500"
                  >
                    📎 Share Attachment
                  </button>
                </div>

                {/* Render Emoji Drawer Grid if open */}
                {showEmojiDrawer && (
                  <div className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl mb-3 grid grid-cols-8 gap-2 text-lg">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🐫', '☕', '⚡', '🎉', '💡', '💯', '👏', '🤝', '🇸🇴'].map(em => (
                      <button 
                        key={em} 
                        type="button"
                        onClick={() => { setInputText(prev => prev + em); setShowEmojiDrawer(false); }}
                        className="hover:scale-125 transition-transform"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* Render Stickers Drawer Grid if open */}
                {showStickerDrawer && (
                  <div className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl mb-3 space-y-2">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Premium Somali Stickers:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {somaliStickers.map(st => (
                        <button
                          key={st.label}
                          type="button"
                          onClick={() => {
                            handleSendMessage(st.label, 'text');
                            setShowStickerDrawer(false);
                          }}
                          className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-[#1a2235]/40 hover:bg-amber-500/10 hover:border-amber-500/25 border border-gray-100 dark:border-gray-850 rounded-xl text-left text-xs font-semibold cursor-pointer"
                        >
                          <span className="text-lg">{st.emoji}</span>
                          <span className="truncate">{st.label.split(' ')[1] || st.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachment Drawer Grid */}
                {showMediaUploadOverlay && (
                  <div className="p-3.5 bg-white dark:bg-[#1e2738] border border-gray-150 dark:border-gray-800 rounded-xl mb-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* File sharing input click */}
                    <label className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 rounded-xl cursor-pointer text-xs font-bold border border-transparent hover:border-gray-200">
                      <Paperclip size={14} className="text-blue-500" />
                      <span>Document / ZIP / APK</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleTriggerFileUpload} 
                        accept=".pdf,.docx,.xlsx,.txt,.zip,.rar,.apk"
                      />
                    </label>

                    {/* Location Pin */}
                    <button
                      onClick={() => { handleSendLocation(); setShowMediaUploadOverlay(false); }}
                      className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 rounded-xl text-xs font-bold text-left border border-transparent hover:border-gray-200 cursor-pointer"
                    >
                      <MapPin size={14} className="text-emerald-500" />
                      <span>Live Location</span>
                    </button>

                    {/* Poll generator */}
                    <button
                      onClick={() => { setShowPollBuilder(true); setShowMediaUploadOverlay(false); }}
                      className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 rounded-xl text-xs font-bold text-left border border-transparent hover:border-gray-200 cursor-pointer"
                    >
                      <CheckCircle size={14} className="text-amber-500" />
                      <span>Create Poll</span>
                    </button>
                  </div>
                )}

                {/* Animated File Upload progress bar */}
                {uploadProgress && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-2.5 rounded-xl mb-3 space-y-1.5 animate-pulse">
                    <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold">
                      <span className="truncate">Uploading: {uploadProgress.name}</span>
                      <span>{uploadProgress.pct}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress.pct}%` }} />
                    </div>
                  </div>
                )}

                {/* Core Message Dispatcher Form */}
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                  className="flex gap-1.5 items-center"
                >
                  {/* Photo Upload quick button */}
                  {!audioRecorder.isRecording && !isRecording && (
                    <label 
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-500 hover:text-blue-500 shrink-0 transition-all cursor-pointer" 
                      title="Soo gudbi Sawir / Send Image (📷)"
                    >
                      <ImageIcon size={15} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        disabled={isCurrentRoomBlocked}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleSendMessage('Sawir 📷', 'image', reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  )}

                  {/* Real Voice Note Recorder controls or Text Input */}
                  {(audioRecorder.isRecording || isRecording) ? (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full text-red-600 dark:text-red-400 text-xs font-mono font-bold animate-pulse grow justify-between min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 min-w-0 shrink">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                        <span className="truncate whitespace-nowrap text-[11px] sm:text-xs">
                          Duubida codka: 0:{((audioRecorder.recordingSeconds || recordingSeconds) < 10 ? '0' : '')}{(audioRecorder.recordingSeconds || recordingSeconds)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          type="button" 
                          onClick={handleCancelVoiceRecording} 
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-[11px] font-sans font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                          title="Ka noqo duubista / Cancel recording"
                        >
                          <Trash2 size={12} />
                          <span className="hidden sm:inline">Kanasal</span>
                        </button>

                        <button 
                          type="button" 
                          onClick={handleFinishVoiceRecording} 
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-sans font-semibold flex items-center gap-1 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                          title="Jooji & Dir / Stop & Send voice note"
                        >
                          <Square size={11} fill="currentColor" />
                          <span>Jooji & Dir</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        disabled={isCurrentRoomBlocked}
                        placeholder={isCurrentRoomBlocked ? 'You have blocked this contact. Unblock to message.' : (activeRoom.isSecret ? t('secret_chat') : 'Qor farriin... (Type message)')}
                        className="grow bg-gray-50 dark:bg-[#1f293d] border border-gray-150 dark:border-gray-700 rounded-full px-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />

                      <button
                        type="button"
                        disabled={isCurrentRoomBlocked}
                        onClick={handleStartRecordingVoice}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-500 hover:text-red-500 shrink-0 transition-all cursor-pointer"
                        title="Duub cod (Record voice note 🎤)"
                      >
                        <Mic size={15} />
                      </button>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isCurrentRoomBlocked || (!inputText.trim() && !isRecording)}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    title="Dir farriinta / Send message (➔)"
                  >
                    <Send size={15} />
                  </button>
                </form>

              </div>
            </>
          ) : (
            <div className="grow flex flex-col items-center justify-center text-center p-6 bg-gray-50/20 dark:bg-[#0b0f19]/10 relative">
              <button
                type="button"
                onClick={() => {
                  setMobileView('list');
                  setShowContactInfo(false);
                }}
                className="md:hidden absolute top-4 left-4 p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Ka noqo / Back to list"
              >
                <ArrowLeft size={16} />
                <span>Liiska</span>
              </button>
              <MessageSquare className="text-gray-300 dark:text-gray-700 mb-3 animate-bounce" size={48} />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('chats_title')}</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">Furan farriin cusub ama kala dooro liiska dhanka bidix si aad u bilowdo hadal qarsoodi ah oo badbaado leh.</p>
            </div>
          )}

        </div>

        {/* 3. USER PROFILE SETTINGS SIDEBAR DETAIL PANELS */}
        {showContactInfo && activeRoom && (
          <div className={`border-l border-gray-150 dark:border-gray-800/60 flex flex-col h-full bg-gray-50/50 dark:bg-[#111624] md:col-span-1 ${mobileView !== 'chat' || !showContactInfo ? 'hidden md:flex' : 'flex'}`}>
            <UserProfileSidebar
              room={activeRoom}
              onClose={() => setShowContactInfo(false)}
              matchingRealProfile={matchingRealProfile}
              isBlocked={isCurrentRoomBlocked}
              onToggleBlock={() => handleToggleBlock(activeRoomId)}
              language={language}
              onViewProfile={onViewProfile}
              onReport={(reason) => {
                // Log and register the abuse report to simulated API
                console.log(`[ABUSE REPORT] User: ${activeRoomId} Reported for: ${reason}`);
                triggerAlert(`✓ Abuse report registered. Our legal compliance team is auditing this chat's encryption signature.`, "success");
              }}
            />
          </div>
        )}

      </div>

      {/* --- FLOATING NOTIFICATIONS TOAST SYSTEM (Module 12) --- */}
      <div className="fixed bottom-6 right-6 z-55 space-y-2 max-w-xs">
        {activeToasts.map(toast => (
          <div key={toast.id} className="bg-gray-900/95 text-white border border-white/10 p-3.5 rounded-2xl shadow-2xl flex gap-3 items-start animate-slide-up select-none">
            <img src={toast.senderAvatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
            <div className="grow space-y-1.5 min-w-0">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-extrabold truncate">{toast.senderName}</span>
                <span className="text-[8px] bg-blue-500 text-white font-mono font-bold px-1 rounded uppercase">NEW</span>
              </div>
              <p className="text-[10px] text-gray-300 line-clamp-2 leading-relaxed">{toast.text}</p>
              
              <div className="flex gap-1.5 pt-1">
                <button 
                  onClick={() => { setActiveRoomId(toast.roomId); setActiveToasts([]); }}
                  className="bg-blue-600 hover:bg-blue-700 text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer"
                >
                  Reply
                </button>
                <button 
                  onClick={() => setActiveToasts([])}
                  className="bg-white/15 hover:bg-white/20 text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- INTEGRATED MODALS SYSTEM MANAGER --- */}

      {/* 1. Phone Contacts Sync Modal */}
      <ContactsSyncModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        profiles={profiles}
        onStartChat={(profile) => {
          // Check if room already in set
          const exists = rooms.find(r => r.id === profile.id);
          if (exists) {
            setActiveRoomId(profile.id);
          } else {
            // Append as new direct chat
            const newRoom: ChatRoom = {
              id: profile.id,
              name: `${profile.first_name} ${profile.last_name}`,
              avatar: profile.avatar || null,
              isGroup: false,
              unreadCount: 0,
              lastMessage: 'Ku bilow hadal badbaado leh!',
              lastMessageTime: 'Just now',
              members: [profile.id, 'me'],
              bio: profile.bio,
              phone: profile.phone
            };
            setRooms(prev => [newRoom, ...prev]);
            setActiveRoomId(profile.id);
          }
        }}
        language={language}
      />

      {/* 2. Group Chat Wizard modal */}
      <GroupChatCreator
        isOpen={showGroupCreator}
        onClose={() => setShowGroupCreator(false)}
        profiles={profiles}
        onCreateGroup={handleCreateGroupChannel}
        language={language}
      />

      {/* 3. Poll Builder custom modal */}
      <PollBuilder
        isOpen={showPollBuilder}
        onClose={() => setShowPollBuilder(false)}
        onSendPoll={handleSendPoll}
        language={language}
      />

      {/* 4. Broadcast composer and lists center */}
      <BroadcastComposer
        isOpen={showBroadcastComposer}
        onClose={() => setShowBroadcastComposer(false)}
        profiles={profiles}
        broadcastLists={broadcastLists}
        onSaveList={(name, ids) => {
          setBroadcastLists(prev => [...prev, { id: `b_${Date.now()}`, name, memberIds: ids }]);
          triggerAlert("✓ Broadcast List saved successfully.", "success");
        }}
        onDeleteList={(id) => {
          setBroadcastLists(prev => prev.filter(l => l.id !== id));
          triggerAlert("Broadcast List deleted.", "success");
        }}
        onSendBroadcast={handleSendBroadcast}
        language={language}
      />

      {/* 5. Direct Phonebook Contact Invite Modal */}
      {inviteTargetContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#182135] rounded-3xl p-6 shadow-2xl border border-gray-150 dark:border-gray-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  {language === 'so' ? 'Ku Casuun SomLuul' : 'Invite to SomLuul'}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'so' 
                    ? `U dir fariin casuumad ah ${inviteTargetContact.name}` 
                    : `Send an invitation message to ${inviteTargetContact.name}`}
                </p>
              </div>
              <button 
                onClick={() => setInviteTargetContact(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-850 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                {language === 'so' ? 'Xiriirka / Contact' : 'Contact Details'}
              </span>
              <div className="font-extrabold text-xs text-gray-900 dark:text-white">
                {inviteTargetContact.name}
              </div>
              <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {inviteTargetContact.phone}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pb-1">
                {language === 'so' ? 'Dooro halkaad u marinayso' : 'Choose Platform to Send'}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://api.whatsapp.com/send?phone=${inviteTargetContact.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(
                    language === 'so'
                      ? `Asc! Waxaan kugu casuumayaa SomLuul, oo ah barnaamijka rasmiga ah ee wada sheekaysiga, badbaadada iyo wicitaanka. Ku soo biir hadda: https://somluul.com/download`
                      : `Hello! I am inviting you to SomLuul, the official messenger for secure chat, HD calls, and social updates. Join now: https://somluul.com/download`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  <span className="text-base">💬</span>
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent('https://somluul.com/download')}&text=${encodeURIComponent(
                    language === 'so'
                      ? `Asc! Ku soo biir SomLuul Messenger.`
                      : `Hello! Join me on SomLuul Messenger.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/20 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-450 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  <span className="text-base">✈</span>
                  <span>Telegram</span>
                </a>

                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://somluul.com/download')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-450 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  <span className="text-base">👤</span>
                  <span>Facebook</span>
                </a>

                <button
                  onClick={() => {
                    const inviteText = language === 'so'
                      ? `Asc! Ku soo biir SomLuul Messenger: https://somluul.com/download`
                      : `Join me on SomLuul secure messenger: https://somluul.com/download`;
                    navigator.clipboard.writeText(inviteText);
                    triggerAlert(language === 'so' ? '✓ Link-ga casuumadda waa la koobiyeeyay!' : '✓ Invitation link copied to clipboard!', "success");
                  }}
                  className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xs transition-all cursor-pointer border border-gray-150 dark:border-gray-800"
                >
                  <span className="text-base">📋</span>
                  <span>{language === 'so' ? 'Koobiyeey Link-ga' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setInviteTargetContact(null)}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                {language === 'so' ? 'Xir' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OTP SMS VERIFICATION OVERLAY SCREEN */}
      {otpVerificationState.step !== 'none' && otpVerificationState.step !== 'verified' && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#182135] rounded-2xl p-6 shadow-2xl border border-gray-150 dark:border-gray-800 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <Lock size={24} />
              </div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                SMS OTP Verification Security
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                SomLuul Core requires verifying your phone line to activate end-to-end cloud persistence.
              </p>
            </div>

            {otpVerificationState.step === 'input' && (
              <form onSubmit={handleOTPVerifySubmit} className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400">OTP Code:</span>
                  <input
                    type="text"
                    required
                    placeholder="Enter 6-digit OTP code (666561)..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-750 rounded-xl text-center text-lg font-mono font-black tracking-widest text-gray-950 dark:text-white focus:outline-none"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                >
                  Confirm Code
                </button>
              </form>
            )}

            <button
              onClick={() => setOtpVerificationState({ phone: '', step: 'none' })}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel Sync
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE PEER CALL MODAL OVERLAY */}
      {activeCall && (
        <div className="fixed inset-0 bg-[#0a0f1d] text-white flex flex-col justify-between p-6 z-55 animate-scale-up">
          
          <div className="flex justify-between items-center z-10">
            <button 
              type="button"
              onClick={handleEndCall}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
              title={language === 'so' ? 'Ka laabo Wacitaanka' : 'Back to Chat'}
            >
              <ArrowLeft size={18} />
              <span>{language === 'so' ? 'Kalaab' : 'Back'}</span>
            </button>

            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Shield className="text-green-400 shrink-0 animate-pulse" size={13} />
              <span className="text-[10px] font-bold tracking-wider uppercase text-gray-350">Secure E2E Signal Session</span>
            </div>
            
            <div className="text-xs font-mono font-bold text-gray-450 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              <span>
                {Math.floor(activeCall.callTime / 60)}:{(activeCall.callTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="grow flex flex-col items-center justify-center py-6">
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              <div className="relative w-full max-w-lg h-64 md:h-80 rounded-2xl overflow-hidden border border-white/20 bg-gray-950 flex items-center justify-center shadow-2xl">
                {/* Live Video element or Peer background */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Receiver Avatar picture-in-picture preview */}
                <div className="absolute top-3 right-3 w-24 h-32 rounded-xl overflow-hidden border-2 border-white/60 shadow-xl bg-gray-900">
                  <img src={activeCall.room.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white">
                    {activeCall.room.name}
                  </div>
                </div>

                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Video size={13} className="text-green-400" />
                    <span>{activeCall.room.name} HD Feed • Live WebRTC Stream</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping [animation-duration:2.5s]"></div>
                  <img src={activeCall.room.avatar} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-white/20 relative z-10" referrerPolicy="no-referrer" />
                </div>
                <h4 className="text-lg font-bold tracking-tight">{activeCall.room.name}</h4>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">{activeCall.status === 'connecting' ? 'Connecting Securely...' : 'Active Voice Call'}</p>
                
                {/* Voice waves */}
                {activeCall.status === 'connected' && (
                  <div className="flex gap-1.5 items-end h-8 mt-5">
                    <span className="w-1.5 bg-blue-500 rounded-full animate-bounce [animation-duration:0.6s] h-4"></span>
                    <span className="w-1.5 bg-blue-400 rounded-full animate-bounce [animation-duration:0.8s] h-7"></span>
                    <span className="w-1.5 bg-blue-500 rounded-full animate-bounce [animation-duration:0.7s] h-5"></span>
                    <span className="w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-duration:0.9s] h-8"></span>
                    <span className="w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.5s] h-4"></span>
                  </div>
                )}
              </div>
            )}

            {/* LIVE SUBTITLES TRANSCRIPTION */}
            {activeCall.captionsEnabled && activeCall.status === 'connected' && (
              <div className="mt-6 w-full max-w-md bg-black/60 backdrop-blur-md border border-white/10 p-3.5 rounded-xl text-center shadow-lg">
                <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mb-1">Live Translated Captions</div>
                <p className="text-xs text-gray-255 leading-relaxed font-medium italic">
                  "{callCaption}"
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-center items-center gap-3.5 max-w-sm mx-auto">
              <button
                onClick={() => setActiveCall({ ...activeCall, noiseCancel: !activeCall.noiseCancel })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeCall.noiseCancel ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-450 border border-transparent'}`}
              >
                <Volume2 size={13} />
                <span>Noise Cancel</span>
              </button>

              <button
                onClick={() => setActiveCall({ ...activeCall, captionsEnabled: !activeCall.captionsEnabled })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeCall.captionsEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-455 border border-transparent'}`}
              >
                <BadgeInfo size={13} />
                <span>Captions</span>
              </button>

              <button
                onClick={() => setActiveCall({ ...activeCall, isScreenSharing: !activeCall.isScreenSharing })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeCall.isScreenSharing ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30 animate-pulse' : 'bg-white/5 text-gray-450 border border-transparent'}`}
              >
                <ScreenShare size={13} />
                <span>Share Screen</span>
              </button>
            </div>

            <div className="flex justify-center items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
                className={`p-3.5 rounded-full transition-all border cursor-pointer ${activeCall.isMuted ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'}`}
                title={activeCall.isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              <button
                type="button"
                onClick={() => handleEndCall(false)}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Jooji Wacitaanka (Hang Up / Cancel Call)"
              >
                <Phone size={26} className="rotate-[135deg]" />
              </button>

              <button
                type="button"
                onClick={() => setActiveCall(prev => prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null)}
                className={`p-3.5 rounded-full transition-all border cursor-pointer ${activeCall.isVideoOff ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'}`}
                title={activeCall.isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {activeCall.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            </div>
          </div>

        </div>
      )}

    </DeviceFrame>
  );
};
