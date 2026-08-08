import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useLanguage } from './LanguageContext.js';
import { 
  Heart, MessageCircle, Share2, Send, MoreHorizontal, Plus, Video, Image, Music,
  Globe, Bookmark, Sparkles, Check, X, HardDrive, Download, FileText, Megaphone,
  MessageSquare, Minimize2, Maximize2, ShieldCheck, Users, Smile, HeartHandshake, Eye,
  RefreshCw
} from 'lucide-react';
import { Post, Story } from '../types.js';
import { formatTimeAgo } from '../utils.js';
import { motion, AnimatePresence } from 'motion/react';
import { VideoPlayer } from './VideoPlayer.js';

interface FeedSectionProps {
  user?: any;
  authToken?: string;
  onGoToStorage?: () => void;
  onDownloadFile?: (file: any) => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onViewProfile?: (userIdOrHandle: string) => void;
}

interface ActiveChatBox {
  id: string;
  name: string;
  avatar: string;
  messages: { id: string; text: string; isSelf: boolean; time: string }[];
  isMinimized: boolean;
}

export const FeedSection: React.FC<FeedSectionProps> = ({
  user,
  authToken,
  onGoToStorage,
  onDownloadFile,
  onShowToast,
  onViewProfile
}) => {
  const { t, language } = useLanguage();

  const renderAuthorAvatar = (avatar: string | null | undefined, name: string, sizeClass: string = "w-10 h-10") => {
    let cleanAvatar = avatar;
    if (cleanAvatar && cleanAvatar.includes('photo-1535713875002-d1d0cf377fde')) {
      cleanAvatar = null;
    }
    const isUrl = cleanAvatar && (cleanAvatar.startsWith('http') || cleanAvatar.startsWith('/') || cleanAvatar.startsWith('data:image'));
    if (isUrl) {
      return (
        <img
          src={cleanAvatar}
          alt={name}
          className={`${sizeClass} rounded-full object-cover border border-gray-100 dark:border-gray-800 shrink-0`}
          referrerPolicy="no-referrer"
        />
      );
    }
    
    // Resolve clean display name if generic placeholders were passed
    let effectiveName = name;
    if (!effectiveName || effectiveName.toLowerCase().includes('avatar') || effectiveName === 'My avatar' || effectiveName === 'User Avatar') {
      effectiveName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Qaalid Yare';
    }

    const parts = effectiveName.trim().split(' ').filter(Boolean);
    let initials = '👤';
    if (parts.length >= 2) {
      initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }

    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0 border border-blue-400/30 font-sans tracking-tight`}>
        {initials}
      </div>
    );
  };

  // State Management
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userFiles, setUserFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [systemNotice, setSystemNotice] = useState('');

  // Active floating chat boxes (Facebook-style)
  const [activeChats, setActiveChats] = useState<ActiveChatBox[]>([]);
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});

  // Story modals & uploader state
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [storyTimer, setStoryTimer] = useState(0);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [newStoryMedia, setNewStoryMedia] = useState('');
  const [newStoryMediaType, setNewStoryMediaType] = useState<'image' | 'video'>('image');
  const [customStoryUrl, setCustomStoryUrl] = useState('');
  const [isCreatingStory, setIsCreatingStory] = useState(false);

  // New Post States
  const [previewMediaModal, setPreviewMediaModal] = useState<{ url: string; type?: string; title?: string } | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState<'text' | 'image' | 'audio' | 'video'>('text');
  const [imageLink, setImageLink] = useState('');
  const [attachedMediaList, setAttachedMediaList] = useState<{ type: 'image' | 'video' | 'audio'; url: string }[]>([]);
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Comment & Share States
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [sharingPost, setSharingPost] = useState<Post | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const storyFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Active online contacts
  const onlineContacts = [
    { id: 'u1', name: 'Yasmin Elmi', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100', bio: 'Digital Creator • Mogadishu' },
    { id: 'u2', name: 'Abdirahman Warsame', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', bio: 'Software Engineer' },
    { id: 'u3', name: 'Muna Dahir', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', bio: 'E-commerce Lead' },
    { id: 'u4', name: 'Saciid Gurey', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', bio: 'FinTech Consultant' },
    { id: 'u5', name: 'Hassan Keynan', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100', bio: 'SomLuul Tech Enthusiast' },
  ];

  // Load Data
  const fetchPosts = async () => {
    try {
      let activeToken = authToken;
      if (!activeToken) {
        try {
          const saved = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
          if (saved) {
            const parsed = JSON.parse(saved);
            activeToken = parsed.token;
          }
        } catch (_) {}
      }

      const response = await axios.get('/api/posts', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      });
      let serverPosts = response.data;

      // Fetch custom posts saved in localStorage
      const cachedPostsStr = localStorage.getItem('somluul_custom_posts');
      let localPosts: Post[] = [];
      if (cachedPostsStr) {
        try {
          localPosts = JSON.parse(cachedPostsStr);
        } catch (_) {}
      }

      // Merge server posts and local posts (prefer serverPosts so full media object with real URLs is kept!)
      const mergedPosts = [...serverPosts];
      localPosts.forEach((lp: Post) => {
        if (!mergedPosts.some(sp => sp.id === lp.id)) {
          mergedPosts.push(lp);
        }
      });

      // Sort merged posts by date descending
      mergedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Force my posts in the feed to show my current avatar (or null if none uploaded)
      const myHandle = (user?.username || user?.email?.split('@')[0] || '').toLowerCase();
      mergedPosts.forEach((p: Post) => {
        if (p.author) {
          if (p.author.avatar && p.author.avatar.includes('photo-1535713875002-d1d0cf377fde')) {
            p.author.avatar = null;
          }
          if (p.author.handle && p.author.handle.toLowerCase() === myHandle) {
            p.author.avatar = user?.avatar || null;
          }
        }
      });

      setPosts(mergedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStories = async () => {
    try {
      const response = await axios.get('/api/stories');
      let serverStories = response.data || [];

      // Merge custom stories from localStorage safely
      try {
        const cachedStoriesStr = localStorage.getItem('somluul_custom_stories');
        if (cachedStoriesStr) {
          const localStories = JSON.parse(cachedStoriesStr);
          if (Array.isArray(localStories)) {
            localStories.forEach((ls: Story) => {
              if (!serverStories.some((s: Story) => s.id === ls.id)) {
                serverStories.unshift(ls);
              }
            });
          }
        }
      } catch (_) {}

      setStories(serverStories);
    } catch (err) {
      console.error('Error fetching stories:', err);
    }
  };

  interface StoryGroup {
    authorName: string;
    authorAvatar: string | null;
    items: Story[];
    hasUnread: boolean;
  }

  // Group stories by author so each user has ONE story card/entry
  const groupedStories = useMemo<StoryGroup[]>(() => {
    const map: { [key: string]: StoryGroup } = {};
    stories.forEach(s => {
      const key = (s.authorName || 'SomLuul User').trim().toLowerCase();
      if (!map[key]) {
        map[key] = {
          authorName: s.authorName || 'SomLuul User',
          authorAvatar: s.authorAvatar || null,
          items: [],
          hasUnread: false
        };
      }
      map[key].items.push(s);
      if (s.isUnread) {
        map[key].hasUnread = true;
      }
    });
    return Object.values(map);
  }, [stories]);

  const fetchSystemNotice = async () => {
    try {
      const response = await axios.get('/api/system-notice');
      setSystemNotice(response.data.system_notice || '');
    } catch (err) {
      console.error('Error fetching system notice:', err);
    }
  };

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchPosts(), fetchStories(), fetchSystemNotice()]);
      if (onShowToast) {
        onShowToast(
          language === 'so'
            ? 'Bogga waa la cusbooneysiiyay si guul leh!'
            : 'Page refreshed successfully!',
          'success'
        );
      }
    } catch (err) {
      console.error('Error refreshing feed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchStories();
    fetchSystemNotice();

    if (authToken) {
      setLoadingFiles(true);
      axios.get('/api/files', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { limit: 5 }
      })
      .then(res => {
        setUserFiles(res.data.data || []);
      })
      .catch(err => {
        console.error("Error loading files in feed:", err);
      })
      .finally(() => {
        setLoadingFiles(false);
      });
    }
  }, [authToken]);

  // Handle active story viewer progress bar
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeStoryGroup) {
      setStoryTimer(0);
      interval = setInterval(() => {
        setStoryTimer(prev => {
          if (prev >= 100) {
            if (activeStoryIndex < activeStoryGroup.items.length - 1) {
              setActiveStoryIndex(i => i + 1);
              return 0;
            } else {
              setActiveStoryGroup(null);
              return 0;
            }
          }
          return prev + 2;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [activeStoryGroup, activeStoryIndex]);

  // Server File Upload Helper for Posts & Media
  const uploadFileToServer = async (file: File): Promise<{ type: 'image' | 'video' | 'audio'; url: string }> => {
    const isVideo = file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.webm') || file.name.endsWith('.mov') || file.name.endsWith('.mkv');
    const mediaType: 'image' | 'video' | 'audio' = isVideo ? 'video' : 'image';

    let token = authToken;
    if (!token) {
      try {
        const saved = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
        if (saved) token = JSON.parse(saved).token;
      } catch (_) {}
    }

    if (token) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('/api/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.data && res.data.public_url) {
          return { type: mediaType, url: res.data.public_url };
        }
      } catch (err) {
        console.warn('Direct file upload to server failed, falling back to FileReader base64:', err);
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ type: mediaType, url: reader.result as string });
      };
      reader.readAsDataURL(file);
    });
  };

  // Image Upload handler
  const triggerImageUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        const uploaded = await uploadFileToServer(file);
        setAttachedMediaList(prev => [...prev, uploaded]);
        setPostType(uploaded.type);
      }
      e.target.value = '';
    }
  };

  // Video Upload handler
  const triggerVideoUpload = () => {
    if (videoInputRef.current) videoInputRef.current.click();
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        const uploaded = await uploadFileToServer(file);
        setAttachedMediaList(prev => [...prev, uploaded]);
        setPostType(uploaded.type);
      }
      e.target.value = '';
    }
  };

  // Story file uploader
  const triggerStoryUpload = () => {
    if (storyFileInputRef.current) storyFileInputRef.current.click();
  };

  const handleStoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.webm') || file.name.endsWith('.mov');
      setNewStoryMediaType(isVideo ? 'video' : 'image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewStoryMedia(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !imageLink && attachedMediaList.length === 0) return;

    setIsPublishingPost(true);
    
    // Determine backward-compatible singular mediaUrl and mediaType
    let primaryMediaType = postType;
    let primaryMediaUrl = (postType !== 'text') ? imageLink : undefined;
    
    if (attachedMediaList.length > 0) {
      primaryMediaType = attachedMediaList[0].type;
      primaryMediaUrl = attachedMediaList[0].url;
    }

    const payload = {
      content: newPostContent,
      mediaType: primaryMediaType,
      mediaUrl: primaryMediaUrl,
      mediaList: attachedMediaList.length > 0 ? attachedMediaList : undefined
    };

    // Determine token
    let activeToken = authToken;
    if (!activeToken) {
      try {
        const saved = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          activeToken = parsed.token;
        }
      } catch (_) {}
    }

    try {
      const response = await axios.post('/api/posts', payload, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      });

      const newCreatedPost = response.data;

      // Save custom post to localStorage safely
      try {
        const cachedPostsStr = localStorage.getItem('somluul_custom_posts');
        let localPosts: Post[] = [];
        if (cachedPostsStr) {
          try {
            localPosts = JSON.parse(cachedPostsStr);
          } catch (_) {}
        }
        localPosts.unshift(newCreatedPost);
        if (localPosts.length > 20) localPosts = localPosts.slice(0, 20);
        localStorage.setItem('somluul_custom_posts', JSON.stringify(localPosts));
      } catch (storageErr) {
        console.warn('LocalStorage save skipped (quota exceeded or restricted):', storageErr);
      }

      setPosts([newCreatedPost, ...posts]);
      setNewPostContent('');
      setImageLink('');
      setAttachedMediaList([]);
      setPostType('text');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (onShowToast) onShowToast('Farriintaada/Muuqaalkaaga waa la daabacay!', 'success');
    } catch (err) {
      console.error('Error creating post on server, falling back to instant client post:', err);

      // Create fallback post locally so post publishing NEVER fails
      const fallbackPost: Post = {
        id: `p-local-${Date.now()}`,
        author: {
          name: user ? `${user.first_name} ${user.last_name}` : 'SomLuul User',
          avatar: user?.avatar || null,
          handle: user?.username || 'user',
          verified: user?.role === 'admin'
        },
        content: newPostContent || '',
        mediaType: primaryMediaType,
        mediaUrl: primaryMediaUrl,
        mediaList: attachedMediaList.length > 0 ? attachedMediaList : undefined,
        likes: 0,
        comments: [],
        shares: 0,
        isLiked: false,
        isLoved: false,
        isSaved: false,
        created_at: new Date().toISOString()
      };

      try {
        const cachedPostsStr = localStorage.getItem('somluul_custom_posts');
        let localPosts: Post[] = [];
        if (cachedPostsStr) {
          try { localPosts = JSON.parse(cachedPostsStr); } catch (_) {}
        }
        localPosts.unshift(fallbackPost);
        localStorage.setItem('somluul_custom_posts', JSON.stringify(localPosts.slice(0, 20)));
      } catch (_) {}

      setPosts([fallbackPost, ...posts]);
      setNewPostContent('');
      setImageLink('');
      setAttachedMediaList([]);
      setPostType('text');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (onShowToast) onShowToast('Farriintaada/Muuqaalkaaga waa la daabacay!', 'success');
    } finally {
      setIsPublishingPost(false);
    }
  };

  // Create Story
  const handlePublishStory = async () => {
    const media = newStoryMedia || customStoryUrl;
    if (!media) {
      if (onShowToast) onShowToast('Fadlan geli sawir ama muuqaal!', 'error');
      return;
    }

    let isVideo = newStoryMediaType === 'video';
    if (media.startsWith('data:video') || media.includes('.mp4') || media.includes('.webm') || media.includes('.mov')) {
      isVideo = true;
    }

    setIsCreatingStory(true);
    try {
      const response = await axios.post('/api/stories', {
        mediaUrl: media,
        mediaType: isVideo ? 'video' : 'image'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const newStoryItem = response.data;

      // Save custom story to localStorage safely
      try {
        const cachedStoriesStr = localStorage.getItem('somluul_custom_stories');
        let localStories: Story[] = [];
        if (cachedStoriesStr) {
          try {
            localStories = JSON.parse(cachedStoriesStr);
          } catch (_) {}
        }
        const storyForStorage: Story = {
          ...newStoryItem,
          mediaUrl: (newStoryItem.mediaUrl && newStoryItem.mediaUrl.length > 100000) ? 'media_stored_on_server' : newStoryItem.mediaUrl
        };
        localStories.unshift(storyForStorage);
        if (localStories.length > 20) localStories = localStories.slice(0, 20);
        localStorage.setItem('somluul_custom_stories', JSON.stringify(localStories));
      } catch (storageErr) {
        console.warn('LocalStorage stories save skipped:', storageErr);
      }

      setStories([newStoryItem, ...stories]);
      setShowStoryCreator(false);
      setNewStoryMedia('');
      setCustomStoryUrl('');
      setNewStoryMediaType('image');
      if (onShowToast) onShowToast('Sheekadaada (Story/Status) waa la daray!', 'success');
    } catch (err) {
      console.error('Error publishing story:', err);
      if (onShowToast) onShowToast('Ku darista sheekada waa ay guuldareysatay.', 'error');
    } finally {
      setIsCreatingStory(false);
    }
  };

  // Like/Reaction toggle
  const toggleLike = async (postId: string, type: 'like' | 'love') => {
    try {
      const response = await axios.post(`/api/posts/${postId}/like`, { type }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPosts(posts.map(p => p.id === postId ? response.data : p));
    } catch (err) {
      console.error('Error toggling like:', err);
      // Local fallback
      setPosts(posts.map(p => {
        if (p.id === postId) {
          if (type === 'like') {
            const isLiked = !p.isLiked;
            return {
              ...p,
              isLiked,
              likes: isLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
              isLoved: false,
            };
          } else {
            const isLoved = !p.isLoved;
            return {
              ...p,
              isLoved,
              likes: isLoved ? p.likes + 1 : Math.max(0, p.likes - 1),
              isLiked: false,
            };
          }
        }
        return p;
      }));
    }
  };

  // Bookmarks
  const toggleSave = (postId: string) => {
    setPosts(posts.map(p => {
      if (p.id === postId) {
        const nextSaved = !p.isSaved;
        if (onShowToast) {
          onShowToast(nextSaved ? 'Waa lagu daray kuwa la kaydsaday!' : 'Waa laga saaray kuwa la kaydsaday.', 'success');
        }
        return { ...p, isSaved: nextSaved };
      }
      return p;
    }));
  };

  // Comment Addition
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const response = await axios.post(`/api/posts/${postId}/comment`, { content: text }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPosts(posts.map(p => p.id === postId ? response.data : p));
      setCommentInputs({ ...commentInputs, [postId]: '' });
    } catch (err) {
      console.error('Error adding comment:', err);
      // Local fallback
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [
              ...p.comments,
              {
                id: `c-${Date.now()}`,
                authorName: user ? `${user.first_name} ${user.last_name}` : 'You (SomLuul User)',
                authorAvatar: user?.avatar || null,
                content: text,
                created_at: 'Just now'
              }
            ]
          };
        }
        return p;
      }));
      setCommentInputs({ ...commentInputs, [postId]: '' });
    }
  };

  // Share post helper
  const triggerSharePost = (post: Post) => {
    setSharingPost(post);
  };

  const confirmShare = (option: 'messenger' | 'timeline' | 'copy') => {
    if (!sharingPost) return;

    if (option === 'copy') {
      const postUrl = `https://somluul.com/posts/${sharingPost.id}`;
      navigator.clipboard.writeText(postUrl);
      if (onShowToast) onShowToast('Link-ga qoraalka waa la koobiyeeyay!', 'success');
    } else if (option === 'timeline') {
      // Simulate timeline share
      const newSharedPost: Post = {
        id: `p-share-${Date.now()}`,
        author: {
          name: user ? `${user.first_name} ${user.last_name}` : 'SomLuul User',
          avatar: user?.avatar || null,
          handle: user?.is_username_custom ? (user.username || '') : '',
        },
        content: `🔄 Wadaagay qoraalka ${sharingPost.author.handle ? `@${sharingPost.author.handle}` : sharingPost.author.name}:\n\n"${sharingPost.content}"`,
        mediaType: sharingPost.mediaType,
        mediaUrl: sharingPost.mediaUrl,
        likes: 0,
        comments: [],
        shares: 0,
        created_at: 'Just now'
      };
      setPosts([newSharedPost, ...posts]);
      if (onShowToast) onShowToast('Qoraalkan waxaa lagu daray timeline-kaaga!', 'success');
    } else {
      if (onShowToast) onShowToast('Farriinta waxaa loo diray asxaabtaada Messenger!', 'success');
    }

    setSharingPost(null);
  };

  // Open Chatbox
  const handleOpenChat = (contact: any) => {
    // Check if already open
    if (activeChats.find(c => c.id === contact.id)) {
      setActiveChats(activeChats.map(c => c.id === contact.id ? { ...c, isMinimized: false } : c));
      return;
    }

    // Max 3 chat boxes on screen
    const rawChats = [...activeChats];
    if (rawChats.length >= 3) {
      rawChats.shift(); // remove oldest
    }

    const newChat: ActiveChatBox = {
      id: contact.id,
      name: contact.name,
      avatar: contact.avatar,
      messages: [
        { id: '1', text: `Asc! Sidee tahay? Soo dhowow SomLuul Messenger.`, isSelf: false, time: 'Just now' }
      ],
      isMinimized: false
    };

    setActiveChats([...rawChats, newChat]);
  };

  // Close Chatbox
  const handleCloseChat = (chatId: string) => {
    setActiveChats(activeChats.filter(c => c.id !== chatId));
  };

  // Minimize Chatbox
  const toggleMinimizeChat = (chatId: string) => {
    setActiveChats(activeChats.map(c => c.id === chatId ? { ...c, isMinimized: !c.isMinimized } : c));
  };

  // Send Messenger message from floating chatbox
  const handleSendChatMessage = (chatId: string) => {
    const text = chatInputs[chatId];
    if (!text || !text.trim()) return;

    setActiveChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: [
            ...c.messages,
            { id: `m-${Date.now()}`, text, isSelf: true, time: 'Just now' }
          ]
        };
      }
      return c;
    }));

    setChatInputs({ ...chatInputs, [chatId]: '' });

    // Mock response after 1.5s
    setTimeout(() => {
      setActiveChats(prev => prev.map(c => {
        if (c.id === chatId) {
          const replies = [
            "Hubaal, waa fikrad cajiib ah! 👍",
            "Aad baan ugu faraxsanahay horumarka SomLuul.",
            "Mashallah, nala soo xiriir mar kasta.",
            "Waan maqnaa hadda ayaan soo laabtay, maxaa cusub?",
            "Ku soo dhowow SomLuul App, nidaamka ugu habboon Somaliya! 🇸🇴"
          ];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          return {
            ...c,
            messages: [
              ...c.messages,
              { id: `m-rep-${Date.now()}`, text: randomReply, isSelf: false, time: 'Just now' }
            ]
          };
        }
        return c;
      }));
    }, 1500);
  };

  return (
    <div id="feed-root-grid" className="grid grid-cols-1 xl:grid-cols-4 gap-6 max-w-7xl mx-auto py-2 w-full max-w-full overflow-x-hidden">
      
      {/* 1. LEFT SIDEBAR: Nav and Quick Stats (Visible on desktop XL) */}
      <div className="hidden xl:flex flex-col space-y-6">
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800/60 mb-4">
            {renderAuthorAvatar(user?.avatar, 'User Avatar', 'w-12 h-12')}
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {user?.first_name} {user?.last_name}
              </h4>
              <p className="text-[10px] text-gray-400 font-mono">@{user?.email?.split('@')?.[0]}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all">
              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                <Users size={14} className="text-blue-500" /> Followers
              </span>
              <span className="font-bold text-gray-800 dark:text-white">1,482</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all">
              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                <Smile size={14} className="text-emerald-500" /> Following
              </span>
              <span className="font-bold text-gray-800 dark:text-white">512</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all">
              <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                <Eye size={14} className="text-amber-500" /> Profile Views
              </span>
              <span className="font-bold text-gray-800 dark:text-white">324 kan toddobaadkan</span>
            </div>
          </div>
        </div>

        {/* Quick Help & Privacy Pledge */}
        <div className="bg-gradient-to-br from-[#121824] to-[#1a2333] border border-gray-800 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-blue-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Amniga SomLuul</h4>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">
            SomLuul waxay isticmaashaa sirta dhamaadka-ilaa-dhamaadka (End-to-End Encryption) si loo hubiyo in xogtaada iyo wada sheekaysigiinu ay ahaan karaan kuwa gaar ah oo ammaan ah.
          </p>
        </div>
      </div>

      {/* 2. MIDDLE CONTENT COLUMN: Feed & Stories (Spans 2 columns) */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* SYSTEM NOTICE (If any) */}
        {systemNotice && (
          <div className="p-4 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 dark:border-amber-900/30 rounded-2xl flex items-start gap-3.5 shadow-xs relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/20">
              <Megaphone size={17} className="animate-bounce" />
            </div>
            <div className="space-y-1 grow min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                📢 Farriin rasmi ah
              </span>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                {systemNotice}
              </p>
            </div>
          </div>
        )}

        {/* FACEBOOK STYLE RECTANGULAR STORIES BAR */}
        <div id="stories-wrapper" className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Users size={14} className="text-blue-500" />
              {t('stories_title')}
            </h3>
            <button
              onClick={() => setShowStoryCreator(true)}
              className="text-xs text-blue-500 hover:text-blue-600 font-bold hover:underline"
            >
              {t('add_story')}
            </button>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x">
            {/* 1st Card: Create Story Tile */}
            <div
              onClick={() => setShowStoryCreator(true)}
              className="relative w-28 h-44 sm:w-32 sm:h-48 rounded-2xl overflow-hidden shrink-0 cursor-pointer shadow-sm border border-gray-150 dark:border-gray-800/80 group flex flex-col justify-between bg-white dark:bg-[#141b2d]"
            >
              <div className="h-[70%] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {user?.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:image')) && !user.avatar.includes('photo-1535713875002-d1d0cf377fde') ? (
                  <img
                    src={user.avatar}
                    alt={`${user.first_name || ''} ${user.last_name || ''}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-800 via-blue-900 to-indigo-900 flex flex-col items-center justify-center text-white p-2 text-center group-hover:scale-105 transition-all duration-500">
                    <div className="w-12 h-12 rounded-full bg-blue-600/80 border border-blue-400/40 flex items-center justify-center font-black text-base shadow-inner mb-1">
                      {user?.first_name && user?.last_name ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : (user?.first_name ? user.first_name.slice(0, 2).toUpperCase() : '👤')}
                    </div>
                    <span className="text-[10px] font-bold opacity-90 truncate max-w-full">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Qaalid'}
                    </span>
                  </div>
                )}
              </div>
              <div className="relative h-[30%] bg-white dark:bg-[#141b2d] flex flex-col items-center justify-center pt-2 pb-1 px-1">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center border-4 border-white dark:border-[#141b2d] shadow-md group-hover:scale-110 transition-all duration-300">
                  <Plus size={18} />
                </div>
                <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-300 tracking-tight text-center truncate w-full">
                  {t('create_story')}
                </span>
              </div>
            </div>

            {/* Stories mapping (Grouped by User) */}
            {groupedStories.map(group => {
              const latestItem = group.items[group.items.length - 1];
              if (!latestItem) return null;
              const isVideo = latestItem.mediaType === 'video' || (typeof latestItem.mediaUrl === 'string' && (latestItem.mediaUrl.startsWith('data:video') || latestItem.mediaUrl.includes('.mp4') || latestItem.mediaUrl.includes('.webm') || latestItem.mediaUrl.includes('.mov')));
              return (
                <div
                  key={group.authorName}
                  onClick={() => {
                    setActiveStoryGroup(group);
                    setActiveStoryIndex(0);
                  }}
                  className="relative w-28 h-44 sm:w-32 sm:h-48 rounded-2xl overflow-hidden shrink-0 cursor-pointer shadow-sm group border border-gray-200/50 dark:border-gray-800/50 snap-start"
                >
                  {/* Story Image/Video as background */}
                  {isVideo ? (
                    <VideoPlayer
                      src={latestItem.mediaUrl}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      autoPlay
                      loop
                      muted
                      controls={false}
                      playsInline
                    />
                  ) : (
                    <img
                      src={latestItem.mediaUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

                  {/* Author Avatar in Top-Left */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <div className={`w-8 h-8 rounded-full p-[2px] ${group.hasUnread ? 'bg-blue-500' : 'bg-gray-400'} shadow-md overflow-hidden`}>
                      {renderAuthorAvatar(group.authorAvatar, group.authorName, "w-full h-full")}
                    </div>
                  </div>

                  {/* Item count badge in Top-Right if user posted multiple stories */}
                  {group.items.length > 1 && (
                    <div className="absolute top-2.5 right-2.5 z-10 bg-blue-600/90 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md backdrop-blur-xs flex items-center gap-0.5">
                      <span>{group.items.length}</span>
                    </div>
                  )}

                  {/* Author Name at Bottom */}
                  <div className="absolute bottom-2.5 inset-x-2.5 z-10">
                    <p className="text-[11px] font-extrabold text-white truncate shadow-xs">
                      {group.authorName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FACEBOOK STYLE COMPOSER BOX */}
        <form
          onSubmit={handleCreatePost}
          className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm space-y-4 animate-fade-in"
        >
          {/* Hidden native selectors */}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleImageFileChange} />
          <input type="file" ref={videoInputRef} className="hidden" accept="video/*,image/*" multiple onChange={handleVideoFileChange} />
          
          <div className="flex gap-3 items-start">
            {renderAuthorAvatar(user?.avatar, 'My avatar', 'w-10 h-10')}
            <div className="grow">
              <textarea
                placeholder={t('mind_placeholder')}
                className="w-full bg-gray-50 dark:bg-[#1f293d]/50 hover:bg-gray-100/50 dark:hover:bg-[#1f293d] border-0 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[60px] transition-all"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleRefreshFeed}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer h-10 self-start shrink-0 active:scale-95"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              <span>{isRefreshing ? 'Cusboonaysiin...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Multiple Attached Media Previews */}
          {attachedMediaList.length > 0 && (
            <div className="pl-12 grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
              {attachedMediaList.map((item, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 aspect-video flex items-center justify-center shadow-xs">
                  {item.type === 'image' && (
                    <img src={item.url} alt="preview" className="w-full h-full object-cover" />
                  )}
                  {item.type === 'video' && (
                    <div className="relative w-full h-full bg-black flex items-center justify-center">
                      <VideoPlayer src={item.url} controls={false} className="max-w-full max-h-full" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                        <Video size={20} className="text-white" />
                      </div>
                    </div>
                  )}
                  {item.type === 'audio' && (
                    <div className="text-center p-2">
                      <Music size={20} className="mx-auto text-blue-500" />
                      <span className="text-[10px] text-gray-500 font-bold block mt-1 truncate max-w-full">Audio file</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedMediaList(prev => prev.filter((_, i) => i !== index));
                    }}
                    className="absolute top-1 right-1 bg-black/75 hover:bg-black text-white rounded-full p-1 shadow-md hover:scale-110 transition-all cursor-pointer z-10"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Conditional image URL preview (Only when no attached files) */}
          {attachedMediaList.length === 0 && postType === 'image' && (
            <div className="pl-12 space-y-2">
              {imageLink ? (
                <div className="relative w-fit rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-[220px]">
                  <img src={imageLink} alt="Selected preview" className="object-cover max-h-[220px] max-w-full rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setImageLink(''); setPostType('text'); }}
                    className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white rounded-full p-1.5 shadow"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Paste custom image URL here..."
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none"
                  value={imageLink}
                  onChange={(e) => setImageLink(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Conditional video URL preview (Only when no attached files) */}
          {attachedMediaList.length === 0 && postType === 'video' && (
            <div className="pl-12 space-y-2">
              {imageLink ? (
                <div className="relative w-fit rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-[220px] bg-black">
                  <VideoPlayer src={imageLink} controls className="max-h-[220px] max-w-full rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setImageLink(''); setPostType('text'); }}
                    className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white rounded-full p-1.5 shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Paste video source URL (mp4)..."
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none"
                  value={imageLink}
                  onChange={(e) => setImageLink(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Conditional audio URL */}
          {attachedMediaList.length === 0 && postType === 'audio' && (
            <div className="pl-12">
              <input
                type="text"
                placeholder="Paste MP3 audio source URL..."
                className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none"
                value={imageLink}
                onChange={(e) => setImageLink(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800/60 pt-3 pl-1 md:pl-12">
            <div className="flex flex-wrap gap-1 md:gap-2">
              {/* Muuqaal toos ah (Live Video) */}
              <button
                type="button"
                onClick={triggerVideoUpload}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${postType === 'video' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <Video size={16} className="text-[#f02849]" />
                <span className="hidden sm:inline">{t('live_video')}</span>
              </button>

              {/* Sawir/Muuqaal (Photo/Video) */}
              <button
                type="button"
                onClick={triggerImageUpload}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${postType === 'image' ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 border border-green-200' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <Image size={16} className="text-[#45bd62]" />
                <span className="hidden sm:inline">{t('photo_video')}</span>
              </button>

              {/* Dareen/Waxqabad (Feeling/Activity) */}
              <button
                type="button"
                onClick={() => setPostType(postType === 'audio' ? 'text' : 'audio')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${postType === 'audio' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' : 'text-gray-550 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <Smile size={16} className="text-[#f7b928]" />
                <span className="hidden sm:inline">{t('feeling_activity')}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isPublishingPost}
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isPublishingPost ? t('publishing') : t('post_btn')}
            </button>
          </div>
        </form>

        {/* FEED POSTS LIST */}
        <div className="space-y-5">
          {isLoading ? (
            <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-10 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-gray-400 animate-pulse">{t('loading_posts')}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-10 text-center space-y-3">
              <MessageSquare size={32} className="text-gray-300 dark:text-gray-600 mx-auto" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('no_posts_yet')}</p>
              <p className="text-xs text-gray-400">{t('be_first_post')}</p>
            </div>
          ) : (
            posts.map(p => (
              <div
                key={p.id}
                className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl shadow-sm overflow-hidden p-4 hover:border-gray-200 dark:hover:border-gray-750 transition-all duration-300"
              >
                
                {/* Post Header */}
                <div className="flex justify-between items-center mb-3">
                  <div 
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => onViewProfile && onViewProfile(p.author.handle)}
                  >
                    {renderAuthorAvatar(p.author.avatar, p.author.name)}
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight group-hover:underline">
                          {p.author.name}
                        </span>
                        {p.author.verified && (
                          <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold shadow-xs" title="Verified Account">✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                        {p.author.handle && (
                          <>
                            <span>@{p.author.handle}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatTimeAgo(p.created_at, language)}</span>
                        <span>•</span>
                        <Globe size={11} className="text-gray-400" />
                      </div>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                    <MoreHorizontal size={18} />
                  </button>
                </div>

                {/* Text Content */}
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-4">
                  {p.content}
                </p>

                {/* Media Attachments */}
                {p.mediaList && p.mediaList.length > 0 ? (
                  <div className={`grid gap-2 mb-4 rounded-xl overflow-hidden ${
                    p.mediaList.length === 1 
                      ? 'grid-cols-1' 
                      : p.mediaList.length === 2 
                        ? 'grid-cols-2' 
                        : 'grid-cols-2 sm:grid-cols-3'
                  }`}>
                    {p.mediaList.map((item, index) => (
                      <div 
                        key={index} 
                        className={`relative overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-center ${
                          p.mediaList!.length === 1 ? 'max-h-[380px] rounded-xl' : 'aspect-square rounded-lg'
                        }`}
                      >
                        {item.type === 'image' && (
                          <img
                            src={item.url}
                            alt="Attachment"
                            onClick={() => setPreviewMediaModal({ url: item.url, type: 'image', title: p.content })}
                            className="w-full h-full object-cover hover:scale-102 transition-all duration-350 cursor-pointer"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {item.type === 'video' && (
                          <div className="w-full h-full bg-black flex items-center justify-center relative">
                            <VideoPlayer 
                              src={item.url} 
                              controls 
                              className="w-full max-h-[380px] rounded-lg object-contain cursor-pointer" 
                              playsInline 
                              preload="metadata"
                            />
                          </div>
                        )}
                        {item.type === 'audio' && (
                          <div className="p-3 w-full text-center flex flex-col justify-center items-center">
                            <Music size={24} className="text-blue-500 mb-1" />
                            <audio src={item.url} controls className="w-full h-8" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {(() => {
                      const isVideoUrl = p.mediaType === 'video' || (typeof p.mediaUrl === 'string' && (p.mediaUrl.startsWith('data:video') || p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') || p.mediaUrl.includes('.mov') || p.mediaUrl.includes('.mkv') || p.mediaUrl.includes('.avi')));
                      const isAudioUrl = p.mediaType === 'audio' || (typeof p.mediaUrl === 'string' && (p.mediaUrl.startsWith('data:audio') || p.mediaUrl.includes('.mp3') || p.mediaUrl.includes('.wav') || p.mediaUrl.includes('.m4a') || p.mediaUrl.includes('.ogg')));

                      if (isVideoUrl && p.mediaUrl) {
                        return (
                          <div className="rounded-xl overflow-hidden mb-4 border border-gray-100 dark:border-gray-800/40 bg-black max-h-[420px] flex items-center justify-center shadow-inner relative">
                            <VideoPlayer 
                              src={p.mediaUrl} 
                              controls 
                              className="w-full max-h-[420px] rounded-xl object-contain cursor-pointer" 
                              playsInline 
                              preload="metadata"
                            />
                          </div>
                        );
                      }

                      if (isAudioUrl && p.mediaUrl) {
                        return (
                          <div className="bg-gray-50 dark:bg-[#1f293d]/60 p-3.5 rounded-xl mb-4 flex items-center gap-3 border border-gray-150 dark:border-gray-800">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                              <Music size={18} />
                            </div>
                            <div className="grow min-w-0">
                              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">SomLuul Audio Attachment</div>
                              <audio controls className="w-full h-8 mt-1.5 focus:outline-none">
                                <source src={p.mediaUrl} />
                              </audio>
                            </div>
                          </div>
                        );
                      }

                      if (p.mediaUrl) {
                        return (
                          <div
                            onClick={() => setPreviewMediaModal({ url: p.mediaUrl, type: 'image', title: p.content })}
                            className="rounded-xl overflow-hidden mb-4 border border-gray-100 dark:border-gray-800/40 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:opacity-95 transition-opacity"
                          >
                            <img
                              src={p.mediaUrl}
                              alt="Post Attachment"
                              className="w-full max-h-[350px] object-cover hover:scale-101 transition-all duration-500 cursor-pointer"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </>
                )}

                {/* Sponsored Tag */}
                {p.isSponsored && (
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold px-2.5 py-1 rounded-lg w-fit mb-4 uppercase tracking-wider border border-amber-500/20">
                    <Sparkles size={11} className="animate-spin-slow" />
                    <span>{t('sponsored_label')}</span>
                  </div>
                )}

                {/* Post Stats Counters */}
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-3 border-b border-gray-100 dark:border-gray-800/40 pb-3">
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-bold border border-white dark:border-gray-900">👍</span>
                      <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold border border-white dark:border-gray-900">❤️</span>
                    </div>
                    <span className="font-bold text-gray-600 dark:text-gray-300 ml-1">{p.likes} likes</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="hover:underline cursor-pointer">{p.comments.length} comments</span>
                    <span>{p.shares} shares</span>
                  </div>
                </div>

                {/* Action Reaction Buttons (Facebook Style) */}
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800/40 pb-2.5 mb-3 gap-1">
                  <button
                    onClick={() => toggleLike(p.id, 'like')}
                    className={`flex items-center justify-center gap-1.5 grow py-2 text-xs font-bold rounded-xl transition-all ${p.isLiked ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                  >
                    <Heart size={16} fill={p.isLiked ? 'currentColor' : 'none'} className={p.isLiked ? 'scale-110' : ''} />
                    <span>Like</span>
                  </button>
                  
                  <button
                    onClick={() => toggleLike(p.id, 'love')}
                    className={`flex items-center justify-center gap-1.5 grow py-2 text-xs font-bold rounded-xl transition-all ${p.isLoved ? 'text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                  >
                    <Heart size={16} fill={p.isLoved ? 'currentColor' : 'none'} className={p.isLoved ? 'scale-110 text-red-500' : 'text-red-500'} />
                    <span>Love</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onShowToast) onShowToast('Muuqaalka faallada waa uu furan yahay!', 'success');
                    }}
                    className="flex items-center justify-center gap-1.5 grow py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 rounded-xl transition-all"
                  >
                    <MessageCircle size={16} />
                    <span>Comment</span>
                  </button>

                  <button
                    onClick={() => triggerSharePost(p)}
                    className="flex items-center justify-center gap-1.5 grow py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 rounded-xl transition-all"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={() => toggleSave(p.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all ${p.isSaved ? 'text-amber-500 bg-amber-50/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    title="Kaydi qoraalkan"
                  >
                    <Bookmark size={15} fill={p.isSaved ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {/* Nested Comments List */}
                {p.comments.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                    {p.comments.map(c => (
                      <div key={c.id} className="flex gap-2.5 text-xs items-start">
                        {renderAuthorAvatar(c.authorAvatar, c.authorName, "w-8 h-8")}
                        <div className="bg-gray-50 dark:bg-[#1f293d] rounded-2xl px-3.5 py-2 grow border border-gray-100 dark:border-gray-800/30">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-extrabold text-gray-800 dark:text-gray-200">{c.authorName}</span>
                            <span className="text-[9px] text-gray-400">{c.created_at}</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment Input Bar */}
                <div className="flex gap-2.5 pt-1">
                  {renderAuthorAvatar(user?.avatar, 'My avatar', 'w-8 h-8')}
                  <div className="relative grow">
                    <input
                      type="text"
                      placeholder={t('write_comment')}
                      className="w-full text-xs bg-gray-50 dark:bg-[#1f293d]/60 border border-gray-150 dark:border-gray-800 rounded-full pl-3.5 pr-10 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1f293d]"
                      value={commentInputs[p.id] || ''}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [p.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment(p.id)}
                    />
                    <button
                      onClick={() => handleAddComment(p.id)}
                      className="absolute right-2.5 top-1.5 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. RIGHT COLUMN: Sponsors, Storage & Active Friends (Visible on LG screens) */}
      <div className="hidden lg:flex flex-col space-y-6 lg:col-span-1">
        
        {/* RECENT STORAGE FILES SHORTCUT */}
        {authToken && (
          <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <HardDrive size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest">
                  Cloud Files
                </h3>
              </div>
              {onGoToStorage && (
                <button
                  onClick={onGoToStorage}
                  className="text-[10px] text-blue-500 hover:text-blue-600 font-extrabold uppercase hover:underline"
                >
                  Go to Cloud
                </button>
              )}
            </div>

            {loadingFiles ? (
              <div className="flex justify-center py-4">
                <span className="text-xs text-gray-400 animate-pulse">Loading...</span>
              </div>
            ) : userFiles.length === 0 ? (
              <div className="text-center py-5 space-y-2">
                <FileText size={24} className="text-gray-300 dark:text-gray-600 mx-auto" />
                <p className="text-[11px] text-gray-400 leading-normal">Ma jiraan faylal dhawaan la geliyay.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-0.5 scrollbar-thin">
                {userFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-[#1f293d]/30 hover:bg-gray-100/60 dark:hover:bg-[#1f293d]/80 border border-gray-100/50 dark:border-gray-800/20 transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 shrink-0">
                        <FileText size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={file.original_name}>
                          {file.original_name}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          {parseFloat((file.file_size / (1024 * 1024)).toFixed(2))} MB
                        </p>
                      </div>
                    </div>
                    {onDownloadFile && (
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                        title="Download"
                      >
                        <Download size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REAL-LOOKING SOMALI SPONSORS (ADS) */}
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Sponsored Ads</span>
            <span className="text-[9px] text-gray-400 font-medium">Verified Ad Network</span>
          </div>

          <div className="space-y-4">
            {/* Dahabshiil Transfer Ad */}
            <div className="group cursor-pointer block">
              <div className="relative h-28 rounded-xl overflow-hidden mb-2 border border-gray-100 dark:border-gray-800">
                <img
                  src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400"
                  alt="Dahabshiil Money Transfer"
                  className="w-full h-full object-cover group-hover:scale-103 transition-all duration-500"
                />
                <div className="absolute top-2 left-2 bg-black/70 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded">FAST PAY</div>
              </div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">Dahabshiil Money Transfer</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">U dir lacag dalkaaga si ka sahlan sidii hore. Qiime jaban iyo amaan 100% ah.</p>
            </div>

            {/* SomLuul Premium Pro */}
            <div className="group cursor-pointer block">
              <div className="relative h-28 rounded-xl overflow-hidden mb-2 border border-gray-150 dark:border-gray-800">
                <img
                  src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400"
                  alt="SomLuul Storage Pro"
                  className="w-full h-full object-cover group-hover:scale-103 transition-all duration-500"
                />
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded">OFFER</div>
              </div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">SomLuul Unlimited Cloud Storage</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">Kor u qaad xisaabtaada ilaa 100GB oo Cloud ah oo gabi ahaanba sugan oo bilaash ah maanta!</p>
            </div>
          </div>
        </div>

        {/* ACTIVE CONTACTS & CHAT INITIATOR (Facebook-style Sidebar) */}
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
            <h3 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Contacts Online
            </h3>
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-1.5 py-0.5 rounded">
              5 Active
            </span>
          </div>

          <p className="text-[10px] text-gray-450 dark:text-gray-400 leading-relaxed">
            Guji mid kasta oo ka mid ah asxaabta si aad u bilowdo wada hadal Messenger ah!
          </p>

          <div className="space-y-2.5">
            {onlineContacts.map(contact => (
              <div
                key={contact.id}
                onClick={() => handleOpenChat(contact)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-50 dark:hover:bg-[#1f293d]/50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
              >
                <div 
                  className="relative hover:scale-105 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewProfile) onViewProfile(contact.id);
                  }}
                  title="Eeg Profile-ka"
                >
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{contact.name}</h4>
                  <p className="text-[9px] text-gray-400 truncate">{contact.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ============================================== */}
      {/* 4. MODALS & POPUPS OR INTERACTIVE PORTALS */}
      {/* ============================================== */}

      {/* A. STORY CREATOR MODAL */}
      <AnimatePresence>
        {showStoryCreator && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Ku dar Story / Add Story</h3>
                <button onClick={() => setShowStoryCreator(false)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <input type="file" ref={storyFileInputRef} className="hidden" accept="image/*,video/*" onChange={handleStoryFileChange} />
                
                {/* Preview block */}
                {newStoryMedia ? (
                  <div className="relative h-48 rounded-xl overflow-hidden bg-black border border-gray-150 dark:border-gray-800 flex items-center justify-center">
                    {newStoryMediaType === 'video' || newStoryMedia.startsWith('data:video') ? (
                      <VideoPlayer src={newStoryMedia} controls className="max-h-full max-w-full" />
                    ) : (
                      <img src={newStoryMedia} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => setNewStoryMedia('')}
                      className="absolute top-2.5 right-2.5 p-1 bg-black/70 hover:bg-black text-white rounded-full z-10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={triggerStoryUpload}
                    className="h-40 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all space-y-2"
                  >
                    <div className="flex gap-2 text-gray-400">
                      <Image size={24} />
                      <Video size={24} className="text-red-500" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Soo gali Sawir ama Muuqaal (Photo or Video)</span>
                    <span className="text-[10px] text-gray-400">PNG, JPG, MP4, WEBM up to 50MB</span>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Globe size={14} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Ama Geli sawir ama video URL halkan..."
                    className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-850 rounded-xl pl-9 pr-3 py-3 text-gray-900 dark:text-white placeholder-gray-450 focus:outline-none"
                    value={customStoryUrl}
                    onChange={(e) => setCustomStoryUrl(e.target.value)}
                  />
                </div>

                <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400 leading-normal">
                  Sheekadaadu (Story/Status) waxay u muuqan doontaa dhammaan bulshada SomLuul.
                </div>
              </div>

              <div className="px-5 py-4 bg-gray-50 dark:bg-[#111724]/60 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  onClick={() => setShowStoryCreator(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold"
                >
                  Abbaar / Cancel
                </button>
                <button
                  onClick={handlePublishStory}
                  disabled={isCreatingStory}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {isCreatingStory ? 'Publishing...' : 'Daabac Story'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. DETAILED STORY PLAYER BACKDROP */}
      {activeStoryGroup && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm h-[85vh] rounded-3xl overflow-hidden bg-gray-950 flex flex-col justify-between shadow-2xl border border-gray-800">
            {/* Loading top segments bar */}
            <div className="absolute top-3.5 inset-x-4 flex gap-1 z-25">
              {activeStoryGroup.items.map((item, idx) => {
                let fillWidth = '0%';
                if (idx < activeStoryIndex) fillWidth = '100%';
                else if (idx === activeStoryIndex) fillWidth = `${storyTimer}%`;

                return (
                  <div key={item.id || idx} className="h-1 bg-white/30 rounded-full grow overflow-hidden">
                    <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: fillWidth }} />
                  </div>
                );
              })}
            </div>

            {/* Top Info Header */}
            <div className="absolute top-6 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-2">
                {renderAuthorAvatar(activeStoryGroup.authorAvatar, activeStoryGroup.authorName, "w-8 h-8")}
                <div className="text-left">
                  <span className="text-xs font-bold text-white block leading-none">{activeStoryGroup.authorName}</span>
                  <span className="text-[9px] text-gray-300 font-medium">
                    Status {activeStoryIndex + 1} of {activeStoryGroup.items.length}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveStoryGroup(null)}
                className="text-white hover:text-gray-300 bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Navigation Tap Overlay (Left & Right) */}
            <div
              className="absolute inset-y-0 left-0 w-1/3 z-30 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (activeStoryIndex > 0) {
                  setActiveStoryIndex(prev => prev - 1);
                  setStoryTimer(0);
                } else {
                  setActiveStoryGroup(null);
                }
              }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/3 z-30 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (activeStoryIndex < activeStoryGroup.items.length - 1) {
                  setActiveStoryIndex(prev => prev + 1);
                  setStoryTimer(0);
                } else {
                  setActiveStoryGroup(null);
                }
              }}
            />

            {/* Core Story Image/Video */}
            {(() => {
              const currentStoryItem = activeStoryGroup.items[activeStoryIndex];
              if (!currentStoryItem) return null;
              const isVideo = currentStoryItem.mediaType === 'video' || (typeof currentStoryItem.mediaUrl === 'string' && (currentStoryItem.mediaUrl.startsWith('data:video') || currentStoryItem.mediaUrl.includes('.mp4') || currentStoryItem.mediaUrl.includes('.webm') || currentStoryItem.mediaUrl.includes('.mov')));
              return isVideo ? (
                <VideoPlayer src={currentStoryItem.mediaUrl} controls autoPlay className="w-full h-full object-cover" playsInline />
              ) : (
                <img src={currentStoryItem.mediaUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              );
            })()}

            {/* Bottom Info and action */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-5 text-center z-20 space-y-2 pointer-events-none">
              <span className="text-[10px] text-gray-300 font-medium bg-black/40 px-3 py-1.5 rounded-full inline-block backdrop-blur-md">
                Taabo dhinaca bidix ama xaq si aad status kale u aragto
              </span>
            </div>
          </div>
          <div className="absolute inset-0 -z-10 cursor-pointer" onClick={() => setActiveStoryGroup(null)}></div>
        </div>
      )}

      {/* C. FACEBOOK-STYLE FLOATING CHAT BOXES CONTAINER (BOTTOM RIGHT) */}
      <div id="floating-messenger-dock" className="fixed bottom-0 right-4 z-40 hidden sm:flex gap-3 items-end pointer-events-none">
        {activeChats.map(chat => (
          <div
            key={chat.id}
            className={`w-72 bg-white dark:bg-[#141b2d] rounded-t-2xl shadow-2xl border border-gray-150 dark:border-gray-800 transition-all duration-300 flex flex-col pointer-events-auto ${chat.isMinimized ? 'h-11' : 'h-96'}`}
          >
            {/* Chatbox Header */}
            <div className="h-11 bg-blue-600 text-white px-3 flex items-center justify-between rounded-t-2xl shrink-0 cursor-pointer" onClick={() => toggleMinimizeChat(chat.id)}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <img src={chat.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" />
                  <span className="absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-bold truncate leading-none">{chat.name}</span>
              </div>
              
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleMinimizeChat(chat.id)} className="p-1 hover:bg-white/10 rounded transition-all">
                  <Minimize2 size={12} />
                </button>
                <button onClick={() => handleCloseChat(chat.id)} className="p-1 hover:bg-white/10 rounded transition-all">
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Chatbox body messages */}
            {!chat.isMinimized && (
              <>
                <div
                  className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-gray-50 dark:bg-[#0c111d] scrollbar-thin"
                  ref={el => { chatScrollRefs.current[chat.id] = el; }}
                  style={{ maxHeight: 'calc(24rem - 5.5rem)' }}
                >
                  {chat.messages.map(m => (
                    <div key={m.id} className={`flex ${m.isSelf ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.isSelf ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                        <p>{m.text}</p>
                        <span className={`text-[8px] mt-0.5 block text-right ${m.isSelf ? 'text-blue-200' : 'text-gray-400'}`}>
                          {m.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chatbox input bar */}
                <div className="p-2 border-t border-gray-150 dark:border-gray-800 bg-white dark:bg-[#141b2d] flex gap-1.5 shrink-0">
                  <input
                    type="text"
                    placeholder="Type message..."
                    className="grow text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-150 dark:border-gray-800 rounded-full px-3 py-2 text-gray-900 dark:text-white focus:outline-none"
                    value={chatInputs[chat.id] || ''}
                    onChange={e => setChatInputs({ ...chatInputs, [chat.id]: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage(chat.id)}
                  />
                  <button
                    onClick={() => handleSendChatMessage(chat.id)}
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shrink-0"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* D. BEAUTIFUL FACEBOOK SHARE INTERACTIVE POPUP */}
      <AnimatePresence>
        {sharingPost && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">Share Post</h3>
                <button onClick={() => setSharingPost(null)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Do you want to share {sharingPost.author.handle ? `@${sharingPost.author.handle}` : sharingPost.author.name}'s post with others?
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => confirmShare('timeline')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:bg-blue-950/20 text-left cursor-pointer transition-all border border-gray-100 dark:border-gray-800"
                >
                  <Share2 size={15} />
                  <span>Share directly to my timeline</span>
                </button>

                <button
                  onClick={() => confirmShare('messenger')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:bg-emerald-950/20 text-left cursor-pointer transition-all border border-gray-100 dark:border-gray-800"
                >
                  <MessageSquare size={15} />
                  <span>Send in private Messenger chat</span>
                </button>

                <button
                  onClick={() => confirmShare('copy')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:bg-amber-950/20 text-left cursor-pointer transition-all border border-gray-100 dark:border-gray-800"
                >
                  <Bookmark size={15} />
                  <span>Copy web link for clipboard</span>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSharingPost(null)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Media Lightbox Preview Modal */}
      {previewMediaModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewMediaModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewMediaModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2 text-sm font-bold flex items-center gap-1 bg-black/50 rounded-full px-3"
            >
              <X size={18} />
              <span>{language === 'so' ? 'Xir' : 'Close'}</span>
            </button>

            {previewMediaModal.type === 'video' || previewMediaModal.url.includes('.mp4') || previewMediaModal.url.startsWith('data:video') ? (
              <VideoPlayer src={previewMediaModal.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
            ) : (
              <img src={previewMediaModal.url} alt="Media preview" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
            )}

            {previewMediaModal.title && (
              <p className="text-white/80 text-xs mt-3 font-semibold text-center max-w-md line-clamp-2">
                {previewMediaModal.title}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
