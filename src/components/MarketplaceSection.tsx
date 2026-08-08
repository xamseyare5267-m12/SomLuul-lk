import React, { useState } from 'react';
import { useLanguage } from './LanguageContext.js';
import { Search, MapPin, Tag, User, MessageSquare, Star, Plus, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { MarketplaceItem } from '../types.js';

export const MarketplaceSection: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<MarketplaceItem[]>([
    {
      id: 'item1',
      title: 'iPhone 15 Pro Max (256GB, Active)',
      price: '$950',
      category: 'electronics',
      imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500',
      location: 'Mogadishu, Somalia',
      sellerName: 'Hassan Bile',
      sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      description: 'iPhone 15 Pro Max oo xaaladiisu aad u wanaagsan tahay. Battery Health waa 98%. Wuxuu la socdaa charger iyo damaanad (warranty) 6 bilood ah. Qiimuhu waa la dhimayaa wax yar.',
      reviews: [
        { reviewer: 'Ahmed Cali', stars: 5, comment: 'Iibiye aad u fiican, taleefanka wuxuu ahaa sidii la rabay!' },
        { reviewer: 'Ruqia Yusuf', stars: 4, comment: 'Wax walba waa sax, laakiin keenista ayaa yara daahday.' }
      ],
      created_at: '2 hours ago'
    },
    {
      id: 'item2',
      title: 'Guri Casri ah (Modern Villa)',
      price: '$120,000',
      category: 'property',
      imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500',
      location: 'Garowe, Somalia',
      sellerName: 'Farhan Maxamed',
      sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      description: 'Guri dabaq ah oo ku yaala meel aad u amaan ah oo ka tirsan magaalada Garowe. Wuxuu ka kooban yahay 5 qol, 4 musqulood, jiko casri ah, iyo barxad aad u weyn.',
      reviews: [],
      created_at: '1 day ago'
    },
    {
      id: 'item3',
      title: 'Toyota Land Cruiser V8 (2020)',
      price: '$45,000',
      category: 'vehicles',
      imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500',
      location: 'Hargeisa, Somalia',
      sellerName: 'Sahra Omer',
      sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      description: 'Toyota Land Cruiser V8 oo aad u nadiif ah. Kuraasta maqaarka ah, qaboojiye heer sare ah, camera dhabta ah, iyo nidaamka badbaadada oo dhamaystiran. Soco 45K km kaliya.',
      reviews: [
        { reviewer: 'Abdirizak', stars: 5, comment: 'Mashiinku waa xaalad aad u fiican. Sahra waa qof lagu kalsoonaan karo.' }
      ],
      created_at: '3 days ago'
    },
    {
      id: 'item4',
      title: 'Dhar Hiddo iyo Dhaqan oo Qurux badan',
      price: '$45',
      category: 'fashion',
      imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=500',
      location: 'Kismayo, Somalia',
      sellerName: 'Halima Ahmed',
      sellerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      description: 'Dhar hiddo iyo dhaqan oo loogu talagalay aroosyada iyo xafladaha qaranka. Waxaa lagu tolay gacanta, tayaduna waa heerka ugu sareeya.',
      reviews: [],
      created_at: '4 days ago'
    }
  ]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

  // Listing Form States
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<'electronics' | 'property' | 'vehicles' | 'fashion' | 'others'>('electronics');
  const [location, setLocation] = useState('');
  const [desc, setDesc] = useState('');
  const [imageLink, setImageLink] = useState('');

  // Seller Quick Message States
  const [sellerMsgSent, setSellerMsgSent] = useState(false);
  const [sellerMsgText, setSellerMsgText] = useState('');

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !location) return;

    const newItem: MarketplaceItem = {
      id: `item-${Date.now()}`,
      title,
      price: price.startsWith('$') ? price : `$${price}`,
      category,
      imageUrl: imageLink || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
      location,
      sellerName: 'You (SomLuul User)',
      sellerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      description: desc || 'Sifeyn gaar ah looma helin.',
      reviews: [],
      created_at: 'Just now'
    };

    setItems([newItem, ...items]);
    setTitle('');
    setPrice('');
    setCategory('electronics');
    setLocation('');
    setDesc('');
    setImageLink('');
    setShowForm(false);
  };

  const handleMessageSeller = () => {
    if (!sellerMsgText.trim()) return;
    setSellerMsgSent(true);
    setTimeout(() => {
      setSellerMsgSent(false);
      setSellerMsgText('');
      setSelectedItem(null);
    }, 1500);
  };

  const filteredItems = items
    .filter(item => activeCategory === 'all' || item.category === activeCategory)
    .filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div id="marketplace-container" className="space-y-6 max-w-6xl mx-auto py-4">
      
      {/* Header Panel */}
      <div className="bg-white dark:bg-[#141b2d] border border-gray-150 dark:border-gray-800/60 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={24} />
            {t('marketplace_title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl leading-relaxed">
            {t('marketplace_desc')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/15 shrink-0"
        >
          <Plus size={16} />
          <span>{t('sell_btn')}</span>
        </button>
      </div>

      {/* Category filters & Search input */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        
        {/* Horizontal scroll Categories list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin shrink-0">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#141b2d] text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 border border-gray-100 dark:border-gray-800'}`}
          >
            {t('all_categories')}
          </button>
          <button
            onClick={() => setActiveCategory('electronics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === 'electronics' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#141b2d] text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 border border-gray-100 dark:border-gray-800'}`}
          >
            {t('electronics')}
          </button>
          <button
            onClick={() => setActiveCategory('property')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === 'property' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#141b2d] text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 border border-gray-100 dark:border-gray-800'}`}
          >
            {t('property')}
          </button>
          <button
            onClick={() => setActiveCategory('vehicles')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === 'vehicles' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#141b2d] text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 border border-gray-100 dark:border-gray-800'}`}
          >
            {t('vehicles')}
          </button>
          <button
            onClick={() => setActiveCategory('fashion')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === 'fashion' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#141b2d] text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 border border-gray-100 dark:border-gray-800'}`}
          >
            {t('fashion')}
          </button>
        </div>

        {/* Search input */}
        <div className="relative grow max-w-md">
          <Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Raadi alaabta suuqa taala..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#141b2d] border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ITEMS GRID */}
      <div id="marketplace-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredItems.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="bg-white dark:bg-[#141b2d] border border-gray-100 dark:border-gray-850 rounded-2xl shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col h-full"
          >
            {/* Image Wrapper */}
            <div className="relative h-44 overflow-hidden bg-gray-100 shrink-0">
              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-103 transition-all duration-500" referrerPolicy="no-referrer" />
              <div className="absolute top-3 left-3 bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow">
                {item.price}
              </div>
            </div>

            {/* Content info */}
            <div className="p-4 flex flex-col grow justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-500 transition-all">
                  {item.title}
                </h3>
                
                <div className="flex items-center gap-1.5 mt-1.5 text-gray-400">
                  <MapPin size={12} className="shrink-0 text-gray-400" />
                  <span className="text-[10px] truncate">{item.location}</span>
                </div>
              </div>

              {/* Seller details footer */}
              <div className="flex justify-between items-center border-t border-gray-50 dark:border-gray-800/40 pt-3 mt-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={item.sellerAvatar} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100" referrerPolicy="no-referrer" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-300 font-medium truncate">{item.sellerName}</span>
                </div>
                
                {/* Rating average */}
                <div className="flex items-center gap-0.5 text-amber-500 text-[10px] font-bold">
                  <Star size={11} fill="currentColor" />
                  <span>{item.reviews.length > 0 ? (item.reviews.reduce((acc, r) => acc + r.stars, 0) / item.reviews.length).toFixed(1) : '5.0'}</span>
                </div>
              </div>

            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full bg-white dark:bg-[#141b2d] border border-gray-100 p-12 rounded-2xl text-center">
            <Tag size={40} className="mx-auto text-gray-300 mb-2" />
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Shay Ma Surna</h4>
            <p className="text-xs text-gray-400 mt-1">Niyad-jab ma leh! Isku day inaad raadiso erey kale oo fure ah ama aad doorato kasta kale.</p>
          </div>
        )}
      </div>

      {/* ITEM VIEW DETAILED MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#141b2d] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]">
            
            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-10 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white">
              <X size={18} />
            </button>

            {/* Left Col: Image */}
            <div className="md:w-1/2 h-56 md:h-auto bg-gray-100 relative shrink-0">
              <img src={selectedItem.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute bottom-4 left-4 bg-blue-600 text-white font-extrabold text-sm px-3.5 py-1.5 rounded-xl shadow-lg">
                {selectedItem.price}
              </div>
            </div>

            {/* Right Col: Details */}
            <div className="md:w-1/2 p-6 overflow-y-auto flex flex-col justify-between max-h-[50vh] md:max-h-auto">
              <div>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold px-2 py-0.5 rounded uppercase">
                  {selectedItem.category}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white mt-2 leading-snug">
                  {selectedItem.title}
                </h3>
                
                <div className="flex gap-1.5 items-center text-gray-400 text-xs mt-2">
                  <MapPin size={13} />
                  <span>{selectedItem.location}</span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-4 whitespace-pre-wrap">
                  {selectedItem.description}
                </p>

                {/* Seller Section */}
                <div className="border-t border-gray-100 dark:border-gray-800/60 pt-4 mt-4">
                  <div className="flex items-center gap-3">
                    <img src={selectedItem.sellerAvatar} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-150" referrerPolicy="no-referrer" />
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">{selectedItem.sellerName}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <ShieldCheck size={11} className="text-green-500" />
                        <span>Verified Merchant</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviews Section */}
                {selectedItem.reviews.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Reviews</h5>
                    {selectedItem.reviews.map((r, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#1f293d] p-2.5 rounded-xl text-[11px] leading-relaxed">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-gray-700 dark:text-gray-300">{r.reviewer}</span>
                          <div className="flex text-amber-500">
                            {[...Array(r.stars)].map((_, idx) => <Star key={idx} size={10} fill="currentColor" />)}
                          </div>
                        </div>
                        <p className="text-gray-500 dark:text-gray-300">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Seller Form */}
              <div className="border-t border-gray-100 dark:border-gray-800/60 pt-4 mt-5 space-y-3">
                <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-blue-500" />
                  {t('message_seller')}
                </h5>
                
                {sellerMsgSent ? (
                  <div className="bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 p-3 rounded-xl text-xs font-semibold text-center border border-green-200 dark:border-green-900/30 animate-pulse">
                    Fariintaadii waa loo diray iibiyaha! Fiiri chat room-kaaga.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="I say, mawaxaa laga heli karaa sheyga?"
                      className="grow text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={sellerMsgText}
                      onChange={(e) => setSellerMsgText(e.target.value)}
                    />
                    <button
                      onClick={handleMessageSeller}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
                    >
                      Mittaa
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* CREATE LISTING MODAL SHEET */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141b2d] border border-gray-200 dark:border-gray-850 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base font-sans">{t('sell_btn')}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('item_title')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samsung Galaxy S23 (256GB)"
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('price')} ($)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 750"
                    className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Qeybta (Category)</label>
                  <select
                    className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                  >
                    <option value="electronics">{t('electronics')}</option>
                    <option value="property">{t('property')}</option>
                    <option value="vehicles">{t('vehicles')}</option>
                    <option value="fashion">{t('fashion')}</option>
                    <option value="others">{t('others')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('location')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mogadishu, Somalia"
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Sawir Link (Unsplash or URL)</label>
                <input
                  type="text"
                  placeholder="Enter image URL..."
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={imageLink}
                  onChange={(e) => setImageLink(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('item_desc')}</label>
                <textarea
                  placeholder="E.g. battery health, size, model, delivery details..."
                  className="w-full text-xs bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10"
              >
                {t('post_item')}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
