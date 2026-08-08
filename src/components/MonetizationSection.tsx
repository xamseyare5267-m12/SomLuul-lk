import React, { useState } from 'react';
import { useLanguage } from './LanguageContext.js';
import { Coins, Plus, TrendingUp, DollarSign, Globe, Award, Sparkles, Check, Play, Pause, BarChart2 } from 'lucide-react';
import { AdCampaign, CreatorWallet } from '../types.js';

export const MonetizationSection: React.FC = () => {
  const { t } = useLanguage();
  
  // Simulated Creator Wallet
  const [wallet, setWallet] = useState<CreatorWallet>({
    balance: 1450.75,
    views: 452000,
    followers: 12400,
    watchMinutes: 184500,
    earningsThisMonth: 380.20,
    platformCut: 15, // 15% platform fee, 85% creator split
  });

  // Simulated Campaigns Ad list
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([
    { id: 'c1', title: 'Zaad and EVC Quick Deposits', bannerUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400', destinationUrl: 'https://premierbank.so', budget: 15, country: 'Somalia', language: 'Somali', impressions: 12400, clicks: 890, conversions: 120, status: 'active' },
    { id: 'c2', title: 'Learn Modern Web Engineering', bannerUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400', destinationUrl: 'https://somali-devs.com', budget: 5, country: 'Global', language: 'English', impressions: 5600, clicks: 420, conversions: 45, status: 'paused' }
  ]);

  // Ad Creator states
  const [showForm, setShowForm] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [budget, setBudget] = useState('10');
  const [targetCountry, setTargetCountry] = useState('Somalia');
  const [targetLang, setTargetLang] = useState('Somali');

  // General states
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('evc');

  const handleWithdraw = () => {
    if (wallet.balance <= 0) return;
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWallet(prev => ({ ...prev, balance: 0 }));
      setWithdrawSuccess(false);
    }, 2000);
  };

  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle) return;

    const newAd: AdCampaign = {
      id: `ad-${Date.now()}`,
      title: adTitle,
      bannerUrl: bannerUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400',
      destinationUrl: 'https://somluul.com',
      budget: parseFloat(budget) || 10,
      country: targetCountry,
      language: targetLang,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: 'scheduled'
    };

    setCampaigns([newAd, ...campaigns]);
    setAdTitle('');
    setBannerUrl('');
    setBudget('10');
    setShowForm(false);
  };

  const toggleCampaign = (id: string) => {
    setCampaigns(campaigns.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === 'active' ? 'paused' : 'active' };
      }
      return c;
    }));
  };

  // Eligibility Percentages
  const followerPercent = Math.min((wallet.followers / 10000) * 100, 100);
  const watchPercent = Math.min((wallet.watchMinutes / 240000) * 100, 100);

  return (
    <div id="monetization-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto py-4">
      
      {/* 1. CREATOR HUB (Wallet & Requirements) - Left Col */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* WALLET PORTAL */}
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/60 p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Coins className="text-amber-500" size={20} />
                {t('creator_title')}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">{t('creator_desc')}</p>
            </div>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Primary Balance Panel */}
            <div className="bg-gradient-to-tr from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-md space-y-4">
              <div>
                <span className="text-[10px] text-amber-100 uppercase tracking-wider font-semibold">{t('wallet_bal')}</span>
                <h4 className="text-3xl font-black mt-1">${wallet.balance.toFixed(2)}</h4>
              </div>
              <div className="flex justify-between text-xs text-amber-100 border-t border-white/10 pt-3">
                <span>{t('earnings_month')}:</span>
                <span className="font-bold">${wallet.earningsThisMonth.toFixed(2)}</span>
              </div>
            </div>

            {/* Payout Channels Picker */}
            <div className="bg-gray-50 dark:bg-[#1f293d] p-4 rounded-xl border border-gray-150 dark:border-gray-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Payout Gateway</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    onClick={() => setSelectedGateway('evc')}
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${selectedGateway === 'evc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#141b2d] text-gray-500 border-gray-200 dark:border-gray-700'}`}
                  >
                    EVC Plus
                  </button>
                  <button
                    onClick={() => setSelectedGateway('visa')}
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${selectedGateway === 'visa' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#141b2d] text-gray-500 border-gray-200 dark:border-gray-700'}`}
                  >
                    Visa Card
                  </button>
                  <button
                    onClick={() => setSelectedGateway('zaad')}
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${selectedGateway === 'zaad' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#141b2d] text-gray-500 border-gray-200 dark:border-gray-700'}`}
                  >
                    Zaad Pay
                  </button>
                </div>
              </div>

              {withdrawSuccess ? (
                <div className="bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 p-2 text-center rounded-lg text-[10px] font-bold border border-green-200 dark:border-green-900/30 mt-3 animate-pulse">
                  {t('withdraw_success')}
                </div>
              ) : (
                <button
                  onClick={handleWithdraw}
                  disabled={wallet.balance <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 mt-3"
                >
                  {t('payout_btn')}
                </button>
              )}
            </div>

          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="text-center p-3 bg-gray-50 dark:bg-[#1f293d] rounded-xl border border-gray-150 dark:border-gray-800">
              <TrendingUp className="text-blue-500 mx-auto" size={16} />
              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">{t('views_stat')}</div>
              <div className="text-sm font-black text-gray-700 dark:text-white mt-0.5">{(wallet.views / 1000).toFixed(0)}K</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-[#1f293d] rounded-xl border border-gray-150 dark:border-gray-800">
              <Award className="text-green-500 mx-auto" size={16} />
              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">{t('followers_stat')}</div>
              <div className="text-sm font-black text-gray-700 dark:text-white mt-0.5">{(wallet.followers / 1000).toFixed(1)}K</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-[#1f293d] rounded-xl border border-gray-150 dark:border-gray-800">
              <Coins className="text-amber-500 mx-auto" size={16} />
              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Platform Cut</div>
              <div className="text-sm font-black text-gray-700 dark:text-white mt-0.5">{wallet.platformCut}%</div>
            </div>
          </div>
        </div>

        {/* MONETIZATION CRITERIA PROGRESS */}
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/60 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex gap-2 items-center">
            <Sparkles className="text-blue-600" size={18} />
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-900 dark:text-white">
              {t('min_monetize_req')}
            </h4>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('monetization_req_desc')}
          </p>

          <div className="space-y-4 pt-2">
            {/* Req 1: Followers */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">{t('req_followers')}</span>
                <span className="text-blue-600">{wallet.followers} / 10,000</span>
              </div>
              <div className="h-2 w-full bg-gray-150 dark:bg-[#1f293d] rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${followerPercent}%` }}></div>
              </div>
            </div>

            {/* Req 2: Watch Hours */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Watch Minutes (Last 90 days)</span>
                <span className="text-blue-600">{wallet.watchMinutes} / 240,000</span>
              </div>
              <div className="h-2 w-full bg-gray-150 dark:bg-[#1f293d] rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${watchPercent}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-700 dark:text-blue-300 mt-2">
            <Check size={16} className="shrink-0 mt-0.5 text-blue-600" />
            <span>Excellent progress! You are currently eligible to start posting sponsored articles and premium stories.</span>
          </div>
        </div>

      </div>

      {/* 2. ADVERTISING PORTAL (Campaign management) - Right Col */}
      <div className="space-y-6">
        
        {/* ACTIVE CAMPAIGNS LIST */}
        <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/60 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-900 dark:text-white">
              My Campaigns
            </h4>
            <button
              onClick={() => setShowForm(true)}
              className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 rounded-lg transition-all"
              title="New Ad Campaign"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* List items */}
          <div className="space-y-3.5">
            {campaigns.map(c => (
              <div key={c.id} className="bg-gray-50 dark:bg-[#1f293d] border border-gray-150 dark:border-gray-800 rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-gray-800 dark:text-white leading-snug">{c.title}</h5>
                    <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-0.5">
                      <Globe size={10} />
                      <span>{c.country} ({c.language})</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCampaign(c.id)}
                    className={`p-1 rounded-md transition-all ${c.status === 'active' ? 'text-green-500 bg-green-500/10' : 'text-gray-400 bg-gray-400/10'}`}
                  >
                    {c.status === 'active' ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                  </button>
                </div>

                {/* Mini chart of metrics */}
                <div className="grid grid-cols-3 gap-1 text-center border-t border-gray-150/50 dark:border-gray-800/40 pt-2.5">
                  <div>
                    <div className="text-[10px] text-gray-700 dark:text-gray-200 font-extrabold">{(c.impressions / 1000).toFixed(1)}K</div>
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">{t('impressions')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-700 dark:text-gray-200 font-extrabold">{c.clicks}</div>
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">{t('clicks')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-700 dark:text-gray-200 font-extrabold">{c.conversions}</div>
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">{t('conversions')}</div>
                  </div>
                </div>

                {/* CTR (Click Through Rate) Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-semibold text-gray-400">
                    <span>CTR Status:</span>
                    <span className="text-blue-500">{(c.clicks > 0 ? (c.clicks / c.impressions) * 100 : 7.2).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${c.clicks > 0 ? (c.clicks / c.impressions) * 100 * 5 : 36}%` }}></div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CREATE AD MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141b2d] border border-gray-200 dark:border-gray-850 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base font-sans">{t('create_ad')}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateAd} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('ad_title')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Best Premier Wallet Deals!"
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('ad_image')}</label>
                <input
                  type="text"
                  placeholder="Banner image URL..."
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('ad_budget')}</label>
                  <input
                    type="number"
                    required
                    placeholder="10"
                    className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Target</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Somalia"
                    className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10"
              >
                {t('launch_campaign')}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
