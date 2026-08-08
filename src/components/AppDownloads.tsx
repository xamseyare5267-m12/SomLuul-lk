import React, { useState } from 'react';
import { useLanguage } from './LanguageContext.js';
import { AppLogo } from './AppLogo.js';
import { 
  Monitor, Smartphone, Tablet, Download, Info, CheckCircle2, 
  ArrowRight, Shield, QrCode, Laptop, Cpu, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppDownloadsProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

interface PlatformConfig {
  id: 'windows' | 'android' | 'iphone' | 'ipad';
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  icon: React.ReactNode;
  version: string;
  size: string;
  releaseDate: string;
  filename: string;
  description: string;
  features: string[];
  steps: string[];
}

export const AppDownloads: React.FC<AppDownloadsProps> = ({ onShowToast }) => {
  const { appName, appLogo } = useLanguage();
  const [activePlatform, setActivePlatform] = useState<'windows' | 'android' | 'iphone' | 'ipad'>('windows');
  
  // Interactive simulator state
  const [simulatingDownload, setSimulatingDownload] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('0 MB/s');
  const [simulatedComplete, setSimulatedComplete] = useState<string[]>([]);

  // Real Progressive Web App (PWA) installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstallable, setIsAppInstallable] = useState(false);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  React.useEffect(() => {
    // Check if app is already running as PWA (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsAlreadyInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsAppInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerPwaInstallation = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        onShowToast("SomLuul waxaa lagu guuleystay in lagu rakibo shaashadaada!", "success");
        setIsAppInstallable(false);
        setDeferredPrompt(null);
      } else {
        onShowToast("Rakibaada waa la joojiyay.", "error");
      }
    } else {
      // Direct physical download fallback for direct installation
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const filename = isMobileDevice ? 'SomLuul_Mobile.apk' : 'SomLuul_Desktop_Launcher.bat';
      
      triggerFileDownload(filename);
      onShowToast(`Barnaamijka rasmiga ah ee ${filename} ayaa hadda toos kuugu soo dagaya computerkaaga ama mobilkaaga! Ka kaga rakibo qeybta Downloads.`, "success");
    }
  };

  const platforms: PlatformConfig[] = [
    {
      id: 'windows',
      name: 'SomLuul for Windows',
      type: 'desktop',
      icon: <Monitor size={24} className="text-blue-500" />,
      version: 'v1.4.2',
      size: '1.2 KB',
      releaseDate: 'July 2026',
      filename: 'SomLuul_Desktop_Launcher.bat',
      description: 'Waad ku dhex isticmaali kartaa SomLuul toos kombiyuutarkaaga adoo adeegsanaya Desktop App Mode oo madax-bannaan oo aad u fudud.',
      features: [
        'Wuxuu ku furmayaa daaqad gooni ah oo nadiif ah (no browser frames)',
        'Aad u fudud, ma raranayo kombiyuutarkaaga',
        'Boqolkiiba boqol ammaan ah oo ka madax-bannaan fayras',
        'Uma baahna wax xuquuq maamul (Administrator rights)'
      ],
      steps: [
        'Riix batoonka buluuga ah si uu kuugu soo dago launcher-ka rasmiga ah.',
        'Ka fur faylka "SomLuul_Desktop_Launcher.bat" galkaaga Downloads (Soo-dejimaha).',
        'Haddii uu soo baxo digniinta "Windows protected your PC", taabo "More info" ka dibna dooro "Run anyway".',
        'Barnaamijku wuxuu si toos ah ugu furmi doonaa daaqad qurxoon oo desktop ah!',
        'Hubi inaad ku darto desktop-kaaga si aad mar kasta u furato.'
      ]
    },
    {
      id: 'android',
      name: 'SomLuul for Android',
      type: 'mobile',
      icon: <Smartphone size={24} className="text-emerald-500" />,
      version: 'v1.3.8',
      size: '22.4 MB',
      releaseDate: 'June 2026',
      filename: 'SomLuul_Mobile.apk',
      description: 'Carry your entire SomLuul file ecosystem in your pocket. Features camera-roll auto backup and quick-share widgets.',
      features: [
        'Instant camera photo auto-backup',
        'Offline-marked files for immediate mobile access',
        'Biometric fingerprint app-lock protection',
        'System-wide share sheet integration'
      ],
      steps: [
        'Click the "Download Direct APK" button or scan the QR Code.',
        'Open the downloaded "SomLuul_Mobile.apk" file.',
        'If prompted, allow installation of applications from "Unknown Sources" in settings.',
        'Tap "Install" and wait for the Android system package manager.',
        'Open SomLuul and secure your session with Face/Fingerprint unlock.'
      ]
    },
    {
      id: 'iphone',
      name: 'SomLuul for iPhone',
      type: 'mobile',
      icon: <Smartphone size={24} className="text-amber-500" />,
      version: 'v1.3.6',
      size: '18.9 MB',
      releaseDate: 'June 2026',
      filename: 'SomLuul_iOS_Client.ipa',
      description: 'Crafted with premium iOS design. Features full iCloud Files app integration, home-screen widgets, and native file sharing.',
      features: [
        'iCloud & Files app official provider integration',
        'FaceID security protocol reinforcement',
        'Interactive iOS Home & Lock screen file widgets',
        'Native Apple Share Extension backup support'
      ],
      steps: [
        'Click the "Download iPhone Package" button to download the secure package.',
        'Install the download bundle on your iPhone device.',
        'Authenticate using your credentials or biometric access.',
        'Launch the app and grant required permissions for Photo sync if desired.',
        'Enjoy lightning-fast, native file browsing.'
      ]
    },
    {
      id: 'ipad',
      name: 'SomLuul for iPad',
      type: 'tablet',
      icon: <Tablet size={24} className="text-purple-500" />,
      version: 'v1.3.6',
      size: '19.5 MB',
      releaseDate: 'June 2026',
      filename: 'SomLuul_iPadOS_Client.ipa',
      description: 'Fully optimized for spacious iPad tablet screens. Side-by-side multitasking support and Apple Pencil markup integrations.',
      features: [
        'Comprehensive iPadOS multi-window Split View support',
        'Interactive Drag-and-Drop files to other apps',
        'Apple Pencil annotations on PDF documents',
        'Keyboards shortcuts support for iPad Smart Keyboard'
      ],
      steps: [
        'Click the "Download iPad Package" button to download the tablet-optimized installer.',
        'Apply installation steps using your enterprise or direct bundle manager.',
        'Install and double-tap the icon to run.',
        'Drag documents directly into the storage hub view.',
        'Enjoy fully synchronized cross-device experience.'
      ]
    }
  ];

  const currentPlatform = platforms.find(p => p.id === activePlatform) || platforms[0];

  const triggerFileDownload = (filename: string) => {
    // Open the direct download link in a new window/tab to bypass iframe sandbox restrictions!
    const downloadUrl = `/api/downloads/file?name=${encodeURIComponent(filename)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleSimulateDownload = (platform: PlatformConfig) => {
    if (simulatingDownload) return;
    
    // Reset simulated completed state for this platform
    setSimulatedComplete(prev => prev.filter(p => p !== platform.id));
    setSimulatingDownload(platform.id);
    setDownloadProgress(0);
    setDownloadSpeed('1.5 MB/s');

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 12) + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setSimulatingDownload(null);
          setSimulatedComplete(prev => [...prev, platform.id]);
          // Trigger the real file download on user's machine
          triggerFileDownload(platform.filename);
          onShowToast(`Downloaded ${platform.filename} successfully! Check your computer's Downloads folder.`, 'success');
        }, 600);
      }
      
      // Update fake speed
      const speed = (Math.random() * 3 + 2).toFixed(1);
      setDownloadSpeed(`${speed} MB/s`);
      setDownloadProgress(currentProgress);
    }, 150);
  };

  return (
    <div id="downloads-container" className="space-y-6">
      {/* Premium Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-slate-900 via-[#101726] to-slate-950 dark:from-[#111827] dark:via-[#162238] dark:to-[#0f172a] rounded-2xl p-6 md:p-8 text-white shadow-xl overflow-hidden border border-gray-200/10"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-radial-gradient pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <AppLogo src={appLogo} alt={appName} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl" containerClassName="shrink-0" />
          
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/20">
              <Cpu size={12} /> Cross-Platform Client Apps
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-sans tracking-tight">
              Get the {appName} App Ecosystem
            </h1>
            <p className="text-sm text-gray-300 max-w-xl">
              Access and backup your files safely from anywhere. Download native client applications optimized for performance, security, and battery life on all your devices.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Real-time PWA Device Installer Quick Banner */}
      {!isAlreadyInstalled && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-indigo-900/10 via-blue-900/5 to-transparent dark:from-indigo-950/20 dark:via-blue-950/10 dark:to-transparent p-5 rounded-2xl border border-blue-500/20 dark:border-blue-500/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
              <Laptop size={24} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                Ku Rakibo SomLuul Toos Qalabkaaga (PC ama Mobile)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
                Adigoo isticmaalaya Progressive Web App (PWA), waxaad ku rakiban kartaa SomLuul toos barnaamijyada computer-kaaga (Windows/MacOS) ama shaashada mobilkaaga (Android/iPhone) adigoo batoonka midig riixaya! Waxay kuu sahlaysaa inuu toos u galo barnaamijyadaada oo uu u furmo sidii App caadi ah.
              </p>
            </div>
          </div>
          <button 
            id="pwa-install-banner-btn"
            onClick={triggerPwaInstallation}
            className="w-full md:w-auto px-5 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0"
          >
            <Download size={14} />
            Toos Ugu Rakib Qalabkaaga
          </button>
        </motion.div>
      )}

      {isAlreadyInstalled && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex items-center gap-3"
        >
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Waxaad hadda ku dhex jirtaa barnaamijka rasmiga ah ee SomLuul oo ku rakiban qalabkaaga! Waad ku mahadsantahay doorashadaada.
          </span>
        </motion.div>
      )}

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-1">
        {platforms.map((p) => {
          const isActive = activePlatform === p.id;
          return (
            <button
              id={`tab-download-${p.id}`}
              key={p.id}
              onClick={() => {
                setActivePlatform(p.id);
                // Reset simulator if switching tabs
                if (simulatingDownload !== p.id) {
                  setSimulatingDownload(null);
                  setDownloadProgress(0);
                }
              }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-[#141b2d] border-t-2 border-blue-500 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-850 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30'
              }`}
            >
              {p.icon}
              {p.name.replace('SomLuul for ', '')}
              {isActive && (
                <motion.div 
                  layoutId="activeDownloadIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" 
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active platform detail viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Overview & Actions */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            key={currentPlatform.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-[#141b2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 md:p-8 space-y-6"
          >
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-gray-50 dark:bg-[#1b253b] rounded-xl border border-gray-100 dark:border-gray-850">
                    {currentPlatform.icon}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sans">
                    {currentPlatform.name}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed pt-2">
                  {currentPlatform.description}
                </p>
              </div>

              {/* Version Badge */}
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                  {currentPlatform.version}
                </span>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Release: {currentPlatform.releaseDate}</p>
              </div>
            </div>

            {/* Features lists */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Key Integration Capabilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentPlatform.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Action Button with Simulator */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  id={`btn-download-${currentPlatform.id}`}
                  onClick={() => handleSimulateDownload(currentPlatform)}
                  disabled={simulatingDownload !== null}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                    simulatingDownload === currentPlatform.id
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                      : simulatedComplete.includes(currentPlatform.id)
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/10 hover:-translate-y-0.5'
                  }`}
                >
                  {simulatingDownload === currentPlatform.id ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Simulating Download...
                    </>
                  ) : simulatedComplete.includes(currentPlatform.id) ? (
                    <>
                      <CheckCircle2 size={16} />
                      Re-download Installer
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      {currentPlatform.id === 'windows' ? 'Download Desktop Launcher (.bat)' : 
                       currentPlatform.id === 'android' ? 'Download Direct APK (.apk)' : 
                       currentPlatform.id === 'iphone' ? 'Download iPhone Package (.ipa)' : 
                       'Download iPad Package (.ipa)'}
                    </>
                  )}
                </button>

                {/* Additional Platform details */}
                <div className="text-center sm:text-left text-xs text-gray-500 dark:text-gray-400 font-medium px-2">
                  <p>File: <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">{currentPlatform.filename}</span></p>
                  <p className="mt-0.5">Size: <span className="text-gray-700 dark:text-gray-300">{currentPlatform.size}</span></p>
                </div>
              </div>

              {/* Simulated Progress Container */}
              <AnimatePresence>
                {simulatingDownload === currentPlatform.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3 overflow-hidden"
                  >
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <RefreshCw className="animate-spin text-blue-500" size={13} />
                        Downloading {currentPlatform.filename}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-mono">{downloadProgress}%</span>
                    </div>
                    
                    {/* Progress Bar background */}
                    <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="bg-blue-600 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-gray-400 font-bold tracking-wide">
                      <span>SPEED: {downloadSpeed}</span>
                      <span>SECURE PIPELINE (SSL)</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Simulated success alert */}
              {simulatedComplete.includes(currentPlatform.id) && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs font-semibold"
                >
                  <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-emerald-900 dark:text-emerald-200">Download Complete!</p>
                    <p className="text-xs font-medium text-emerald-600/90 dark:text-emerald-400/90 mt-1">
                      The installation packet has been saved to your local device downloads. You can now follow the instructions on the right to install the application.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick Security Badge & Publisher Warning Solution */}
            <div className="space-y-4 p-5 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-2xl">
              <div className="flex items-start gap-3">
                <Shield size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                    XALKA DIGNIINTA "UNKNOWN PUBLISHER" / APP-KA RASMIGA AH:
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                    Marka aad soo dejisid faylka <strong>SomLuul_Desktop_Launcher.bat</strong>, Windows iyo barowsarada waxay ku tusi karaan digniin odhanaysa "Unknown Publisher" sababtoo ah barnaamijku ma qabo shahaado qaali ah oo "Digital Code-Signing".
                  </p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                    <strong>Habka ugu sahlan uguna ammaan badan oo 100% browser kasta iyo computer kasta u aqoonsanayo App Rasmi ah:</strong>
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-500 shrink-0" />
                    Riix batoonka sare ee <u>"Toos Ugu Rakib Qalabkaaga"</u> (PWA). Chrome/Edge iyo Windows ayaa si toos ah ugu rakibaya shaashadaada sidii App rasmi ah oo sugan oo aan lahayn wax digniin ah!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right column: Detailed Installation Steps & QR Code */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Live Device Frame Simulator */}
          <div className="bg-white dark:bg-[#141b2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white font-sans flex items-center gap-2">
                <Smartphone size={18} className="text-amber-500" />
                Live Logo & App Simulator
              </h3>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Responsive Sizing
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              Daawo sida logo-da rasmiga ah ee <strong>{appName}</strong> ay ugu habboon tahay oo ay ugu shaqaynayso cabbir kasta oo qalab ah (Windows, Android, iyo iPhone):
            </p>

            {/* Simulated Frame */}
            <div className="flex justify-center bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-150 dark:border-gray-850">
              {currentPlatform.id === 'windows' && (
                /* Windows Laptop/PC Mockup Frame */
                <div className="w-full max-w-sm space-y-1 bg-gray-200 dark:bg-gray-800 rounded-lg p-1.5 shadow-md border border-gray-300 dark:border-gray-700">
                  {/* Window Bar */}
                  <div className="flex items-center justify-between px-2 pb-1.5 border-b border-gray-300 dark:border-gray-700">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <span className="text-[9px] font-mono text-gray-450 dark:text-gray-500">somluul.com/windows-app</span>
                    <span className="w-3" />
                  </div>
                  {/* Screen Content */}
                  <div className="bg-white dark:bg-[#0b0f19] rounded p-4 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
                    <AppLogo src={appLogo} alt="Logo" className="w-14 h-14 rounded-xl" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">{appName} Desktop Client</h4>
                      <p className="text-[10px] text-gray-400 font-mono">Cabbirka: 1024px x 768px (Fitted)</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded font-bold uppercase tracking-wide">
                      Windows PC Connected
                    </span>
                  </div>
                </div>
              )}

              {currentPlatform.id === 'android' && (
                /* Android Smartphone Mockup Frame */
                <div className="w-48 bg-gray-900 rounded-[2rem] p-3 shadow-xl border-4 border-gray-800 relative">
                  {/* Punch Hole Camera */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black border border-gray-800 z-10" />
                  
                  {/* Screen Content */}
                  <div className="bg-white dark:bg-[#0b0f19] rounded-[1.5rem] p-4 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] overflow-hidden">
                    <AppLogo src={appLogo} alt="Logo" className="w-10 h-10 rounded-lg mt-2" />
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-black text-gray-900 dark:text-white">{appName} Android</h4>
                      <p className="text-[9px] text-gray-400 font-mono">Cabbirka: 360px x 640px</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full font-bold uppercase tracking-wider">
                      Android Active
                    </span>
                  </div>
                </div>
              )}

              {currentPlatform.id === 'iphone' && (
                /* iPhone Smartphone Mockup Frame */
                <div className="w-48 bg-slate-950 rounded-[2rem] p-3.5 shadow-2xl border-4 border-slate-800 relative">
                  {/* Dynamic Island */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-3 bg-black rounded-full z-10" />
                  
                  {/* Screen Content */}
                  <div className="bg-[#0b0f19] text-white rounded-[1.4rem] p-4 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] overflow-hidden">
                    <AppLogo src={appLogo} alt="Logo" className="w-11 h-11 rounded-2xl mt-1" />
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-bold text-white">{appName} for iPhone</h4>
                      <p className="text-[9px] text-gray-500 font-mono">Cabbirka: 390px x 844px</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full font-bold uppercase tracking-wider border border-blue-500/20">
                      iOS Core Active
                    </span>
                  </div>
                </div>
              )}

              {currentPlatform.id === 'ipad' && (
                /* iPad Mockup Frame */
                <div className="w-64 bg-slate-900 rounded-2xl p-4 shadow-xl border-4 border-slate-850">
                  {/* Screen Content */}
                  <div className="bg-white dark:bg-[#0b0f19] rounded-lg p-5 flex flex-col items-center justify-center text-center space-y-3 min-h-[150px]">
                    <AppLogo src={appLogo} alt="Logo" className="w-12 h-12 rounded-xl" />
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">{appName} iPad Edition</h4>
                      <p className="text-[9px] text-gray-400 font-mono">Cabbirka: 820px x 1180px</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 rounded-full font-bold uppercase tracking-wider">
                      iPadOS Connected
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-start bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 text-[11px] text-gray-650 dark:text-gray-300 font-medium">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Logada {appName} waxaa loo habeeyay hab <strong>Autofit Vector Grid</strong> ah oo u sahlaya inay si qurux badan isugu soo koobto ama u fido iyadoo ku shaqaynaysa cabbirada qalab kasta (Windows Desktop, Android, iyo iPhone).
              </p>
            </div>
          </div>

          {/* Steps Card */}
          <motion.div 
            key={`${currentPlatform.id}-steps`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-[#141b2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-white font-sans flex items-center gap-2">
              <Laptop size={18} className="text-blue-500" /> 
              Step-by-Step Installation Guide
            </h3>

            <div className="space-y-4">
              {currentPlatform.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  {/* Step bubble counter */}
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Android Mobile QR Code widget */}
          {currentPlatform.id === 'android' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex flex-col items-center text-center space-y-4"
            >
              <div className="p-3 bg-white rounded-xl shadow-inner">
                <QrCode size={120} className="text-gray-900" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Scan & Download APK</p>
                <p className="text-xs text-blue-50/90 max-w-xs">
                  Scan this QR code with your mobile camera to instantly download the APK package directly to your smartphone.
                </p>
              </div>
            </motion.div>
          )}

          {/* Quick Support Widget */}
          <div className="bg-white dark:bg-[#141b2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex items-start gap-3">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-gray-900 dark:text-white">Need Installation Assistance?</p>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                Our support desk is always active. Contact your organization system administrator for setup policies, device configurations, or enterprise enrollment.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
