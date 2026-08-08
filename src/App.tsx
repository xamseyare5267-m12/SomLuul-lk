import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Info, X, RefreshCw } from 'lucide-react';

// Configure dynamic API Base URL for Web and Android APK environments
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  
  // If running in a web browser via HTTP or HTTPS, always use relative paths
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return '';
  }
  // Otherwise, if running inside a compiled Android APK / iOS IPA / Capacitor app (e.g. file: protocol or Capacitor/Cordova webview)
  // or in an offline local app, point to the live Cloud Run backend server
  if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || !window.location.hostname) {
    return 'https://file-somluul-com-854058746919.europe-west2.run.app';
  }
  return '';
};

axios.defaults.baseURL = getApiBaseUrl();
axios.defaults.timeout = 15000; // 15 second timeout to prevent indefinite hanging

// Add global response interceptor so network errors fail gracefully without crashing
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log network/server errors silently without crashing React component tree
    console.warn('[SomLuul API Notice]:', error.message || error);
    return Promise.reject(error);
  }
);

import { ThemeProvider } from './components/ThemeContext.js';
import { LanguageProvider, useLanguage } from './components/LanguageContext.js';
import { AuthPages } from './components/AuthPages.js';
import { Layout, ActiveTabType } from './components/Layout.js';
import { LandingPage } from './components/LandingPage.js';
import { UserDashboard } from './components/UserDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { OwnerDashboard } from './components/OwnerDashboard.js';
import { AppDownloads } from './components/AppDownloads.js';
import { FilePreviewModal } from './components/FilePreviewModal.js';

// Social Components
import { FeedSection } from './components/FeedSection.js';
import { MessengerSection } from './components/MessengerSection.js';
import { MarketplaceSection } from './components/MarketplaceSection.js';
import { MonetizationSection } from './components/MonetizationSection.js';
import { PlatformCenter } from './components/PlatformCenter.js';
import { ProfileSection } from './components/ProfileSection.js';

import { AuthSession, FileMetadata, Profile } from './types.js';

const LandingPageWrapper: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  const { appLogo } = useLanguage();
  return <LandingPage onOpenAuth={onOpenAuth} appLogo={appLogo} />;
};

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('feed');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const handleViewProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    setActiveTab('profile');
  };

  // Preview overlay state
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);

  // Custom sliding Toast alerts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimeout, setToastTimeout] = useState<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimeout) clearTimeout(toastTimeout);
    setToast({ message, type });
    const timeout = setTimeout(() => setToast(null), 4000);
    setToastTimeout(timeout);
  };

  const checkLocalSession = async () => {
    setIsSessionLoading(true);
    const saved = localStorage.getItem('auth_session') || sessionStorage.getItem('auth_session');
    let loggedIn = false;
    
    if (saved) {
      try {
        const parsed: AuthSession = JSON.parse(saved);
        // Verify session validity with backend
        const response = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${parsed.token}` }
        });
        const updatedSession = {
          token: parsed.token,
          user: response.data.user
        };
        setSession(updatedSession);
        
        // Save complete profile backup in localStorage
        localStorage.setItem(`somluul_profile_backup_${response.data.user.id}`, JSON.stringify(response.data.user));
        localStorage.setItem('last_user_id', response.data.user.id);
        
        // Synchronize local / session storage with the latest DB details
        if (localStorage.getItem('auth_session')) {
          localStorage.setItem('auth_session', JSON.stringify(updatedSession));
        } else {
          sessionStorage.setItem('auth_session', JSON.stringify(updatedSession));
        }
        
        // Auto navigate owner accounts to admin workspace
        if (response.data.user.email.toLowerCase() === 'xamseyare5267@gmail.com') {
          setActiveTab('admin_center');
        } else {
          setActiveTab('feed');
        }
        loggedIn = true;
      } catch (err: any) {
        // Only clear the session if the server explicitly tells us the session is unauthorized/expired (e.g. 401 or 403)
        // If it is a network error (no response) or server error (500, 502), do not clear the session!
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          // Attempt automatic silent session restoration if we have a backup profile in localStorage
          try {
            const parsed: AuthSession = JSON.parse(saved);
            const lastUserId = localStorage.getItem('last_user_id') || (parsed && parsed.user && parsed.user.id);
            const backupProfileStr = lastUserId ? localStorage.getItem(`somluul_profile_backup_${lastUserId}`) : null;
            const backupProfile = backupProfileStr ? JSON.parse(backupProfileStr) : (parsed && parsed.user);
            
            if (backupProfile) {
              // Call the restore-session endpoint to register again silently
              await axios.post('/api/auth/restore-session', {
                token: parsed?.token || 'restored-token',
                profile: backupProfile
              });
              
              // Retry me endpoint
              const retryResponse = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${parsed?.token || 'restored-token'}` }
              });
              
              const updatedSession = {
                token: parsed?.token || 'restored-token',
                user: retryResponse.data.user || backupProfile
              };
              setSession(updatedSession);
              localStorage.setItem(`somluul_profile_backup_${updatedSession.user.id}`, JSON.stringify(updatedSession.user));
              localStorage.setItem('auth_session', JSON.stringify(updatedSession));
              
              if (updatedSession.user.email?.toLowerCase() === 'xamseyare5267@gmail.com') {
                setActiveTab('admin_center');
              } else {
                setActiveTab('feed');
              }
              setIsSessionLoading(false);
              return;
            }
          } catch (restoreErr) {
            console.error('Silent session restoration notice:', restoreErr);
          }

          // Fallback: keep local session so the user is never forcibly logged out upon refresh/reopen
          try {
            const parsed: AuthSession = JSON.parse(saved);
            if (parsed && parsed.user) {
              setSession(parsed);
              setIsSessionLoading(false);
              return;
            }
          } catch (_) {}

          localStorage.removeItem('auth_session');
          sessionStorage.removeItem('auth_session');
          setSession(null);
        } else {
          // Network / offline / server error - keep the local session as is so they don't get logged out
          try {
            const parsed: AuthSession = JSON.parse(saved);
            if (parsed && parsed.user) {
              setSession(parsed);
            }
          } catch (_) {}
        }
      }
    }

    setIsSessionLoading(false);
  };

  useEffect(() => {
    checkLocalSession();
    
    const handleSwitchTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('somluul_switch_tab', handleSwitchTab);

    return () => {
      if (toastTimeout) clearTimeout(toastTimeout);
      window.removeEventListener('somluul_switch_tab', handleSwitchTab);
    };
  }, []);

  useEffect(() => {
    if (session?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${session.token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [session]);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newSession.token}`;
    localStorage.setItem('auth_session', JSON.stringify(newSession));
    sessionStorage.setItem('auth_session', JSON.stringify(newSession));
    localStorage.setItem('last_user_id', newSession.user.id);
    localStorage.setItem(`somluul_profile_backup_${newSession.user.id}`, JSON.stringify(newSession.user));
    if (newSession.user.email.toLowerCase() === 'xamseyare5267@gmail.com') {
      setActiveTab('admin_center');
    } else {
      setActiveTab('feed');
    }
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    if (session) {
      const updatedSession = { ...session, user: updatedProfile };
      setSession(updatedSession);
      localStorage.setItem(`somluul_profile_backup_${updatedProfile.id}`, JSON.stringify(updatedProfile));
      const storageKey = localStorage.getItem('auth_session') ? 'localStorage' : 'sessionStorage';
      if (storageKey === 'localStorage') {
        localStorage.setItem('auth_session', JSON.stringify(updatedSession));
      } else {
        sessionStorage.setItem('auth_session', JSON.stringify(updatedSession));
      }
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (e) {
      console.warn('Silent logout error', e);
    }
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth_session');
    sessionStorage.removeItem('auth_session');
    localStorage.setItem('has_registered', 'true');
    localStorage.removeItem('last_user_email');
    localStorage.removeItem('last_user_password');
    localStorage.removeItem('last_first_name');
    localStorage.removeItem('last_last_name');
    setSession(null);
    showToast('You have been logged out successfully.', 'success');
  };

  const handleDownloadFile = async (file: FileMetadata) => {
    try {
      showToast(`Downloading file ${file.original_name}...`, 'success');
      const response = await fetch(file.public_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      
      // Clean up the temporary URL and anchor
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Blob download failed, falling back to direct anchor link download', err);
      const link = document.createElement('a');
      link.href = file.public_url;
      link.target = '_blank';
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f19] flex items-center justify-center text-gray-500">
        <div className="text-center space-y-3">
          <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mx-auto" size={32} />
          <p className="text-sm font-semibold tracking-wider uppercase text-gray-400">Loading SomLuul Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <ThemeProvider>
        <div id="app-root" className="min-h-screen font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
          {!session ? (
            /* Authentication cards view */
            <AuthPages onLoginSuccess={handleLoginSuccess} onShowToast={showToast} />
          ) : (
            /* Main Platform layout shell */
            <Layout
              user={session.user}
              authToken={session.token}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onLogout={handleLogout}
              onProfileUpdate={handleProfileUpdate}
              onShowToast={showToast}
              onViewProfile={handleViewProfile}
            >
              {activeTab === 'feed' && (
                <FeedSection
                  user={session.user}
                  authToken={session.token}
                  onGoToStorage={() => setActiveTab('user_storage')}
                  onDownloadFile={handleDownloadFile}
                  onShowToast={showToast}
                  onViewProfile={handleViewProfile}
                />
              )}
              {activeTab === 'messenger' && (
                <MessengerSection 
                  user={session.user} 
                  authToken={session.token} 
                  onShowToast={showToast} 
                  onNavigateHome={() => setActiveTab('feed')}
                  onViewProfile={handleViewProfile}
                />
              )}
              {activeTab === 'marketplace' && (
                <MarketplaceSection />
              )}
              {activeTab === 'monetization' && (
                <MonetizationSection />
              )}
              {activeTab === 'user_storage' && (
                <UserDashboard
                  authToken={session.token}
                  onPreviewFile={setPreviewFile}
                  onDownloadFile={handleDownloadFile}
                  onShowToast={showToast}
                />
              )}
              {activeTab === 'apps_download' && (
                <AppDownloads onShowToast={showToast} />
              )}
              {activeTab === 'platform_center' && (
                <PlatformCenter />
              )}
              {activeTab === 'admin_center' && session.user.email.toLowerCase() === 'xamseyare5267@gmail.com' && (
                <OwnerDashboard
                  authToken={session.token}
                  onLogout={handleLogout}
                  onShowToast={showToast}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileSection
                  user={session.user}
                  profileId={selectedProfileId}
                  authToken={session.token}
                  onShowToast={showToast}
                  onViewProfile={handleViewProfile}
                  onProfileUpdate={handleProfileUpdate}
                />
              )}
              {activeTab === 'landing' && (
                <div className="relative bg-[#0F172A] rounded-2xl overflow-hidden shadow-2xl border border-gray-150 dark:border-gray-800">
                  {/* Sticky Banner inside App Layout to return to feed */}
                  <div className="sticky top-0 z-40 bg-[#1e293b]/95 backdrop-blur-md border-b border-slate-700/50 p-4 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center p-0.5 border border-blue-500/30 shrink-0">
                        {session.user.avatar ? (
                          <img src={session.user.avatar} alt="User" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            {(session.user?.first_name?.[0] || 'S')}{(session.user?.last_name?.[0] || 'L')}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-400 font-extrabold tracking-widest uppercase">WAXAAD KU JIRTAA QEYBTA WEB-KA</p>
                        <p className="text-sm font-black text-white tracking-tight">SomLuul Landing Page</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('feed')}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-blue-500/30 active:scale-95"
                    >
                      <span>🔙</span> KU NOQO FEED-KA APP-KA
                    </button>
                  </div>
                  <LandingPageWrapper 
                    onOpenAuth={() => setActiveTab('feed')} 
                  />
                </div>
              )}
            </Layout>
          )}

          {/* Global Modal Preview viewport */}
          {previewFile && (
            <FilePreviewModal
              file={previewFile}
              onClose={() => setPreviewFile(null)}
              onDownload={handleDownloadFile}
            />
          )}

          {/* Floating Sliding Toast Alert */}
          {toast && (
            <div
              id="floating-toast"
              className={`fixed bottom-5 right-5 z-50 flex items-start gap-3 p-4 rounded-2xl shadow-2xl border max-w-sm transition-all duration-300 transform translate-y-0 text-sm font-medium ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-900/50'
                  : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/90 dark:text-red-300 dark:border-red-900/50'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' ? (
                  <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={18} />
                ) : (
                  <Info className="text-red-600 dark:text-red-400" size={18} />
                )}
              </div>
              <div className="flex-1">
                {toast.message}
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 p-0.5 rounded-md"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </ThemeProvider>
    </LanguageProvider>
  );
}
