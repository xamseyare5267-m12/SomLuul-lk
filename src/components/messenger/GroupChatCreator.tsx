import React, { useState } from 'react';
import { Users, Search, Plus, Check, Camera, MessageSquare, ShieldAlert } from 'lucide-react';

interface GroupChatCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: any[];
  onCreateGroup: (groupData: { name: string; avatar: string; description: string; members: string[] }) => void;
  language: 'so' | 'en';
}

export const GroupChatCreator: React.FC<GroupChatCreatorProps> = ({
  isOpen,
  onClose,
  profiles,
  onCreateGroup,
  language
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAvatar, setCustomAvatar] = useState('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150');

  if (!isOpen) return null;

  // Pre-selected avatars options
  const groupAvatarOptions = [
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150', // Mogadishu tech
    'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150', // General work
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150', // Music/talk
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150', // Study
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150'  // Business/somluul
  ];

  // Handle member checkbox toggle
  const handleToggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  // Submit and create
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    onCreateGroup({
      name: groupName,
      avatar: customAvatar,
      description: description || 'Koox cusub oo si qarsoodi ah ugu wada xiriirta barnaamijka SomLuul.',
      members: [...selectedMembers, 'me']
    });

    // Reset states
    setGroupName('');
    setDescription('');
    setSelectedMembers([]);
    onClose();
  };

  const filteredProfiles = profiles.filter(p => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-[#141b2d] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-150 dark:border-gray-800/60 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
          <div className="flex items-center gap-2">
            <Users className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                {language === 'so' ? 'Samee Koox Cusub' : 'Create New Group Chat'}
              </h3>
              <p className="text-[10px] text-gray-400">SomLuul Ultra-Private Grouping Wizard</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
          >
            &times;
          </button>
        </div>

        {/* Wizard Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* 1. Group Details Section */}
            <div className="space-y-3.5">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">
                {language === 'so' ? 'Sawirka iyo Magaca' : 'Group Picture & Identity'}
              </label>

              <div className="flex items-center gap-4">
                {/* Selected Photo Avatar */}
                <div className="relative group shrink-0">
                  <img 
                    src={customAvatar} 
                    alt="Group" 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-150 dark:border-gray-700 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={16} className="text-white" />
                  </div>
                </div>

                <div className="grow space-y-2">
                  <input
                    type="text"
                    required
                    placeholder={language === 'so' ? 'Qor magaca kooxda (t.g Mogadishu Devs)...' : 'Group Name (e.g. SomLuul Hackers)...'}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1f293d] border border-gray-250 dark:border-gray-750 rounded-xl text-xs text-gray-950 dark:text-white placeholder-gray-450 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder={language === 'so' ? 'Ku dar qeexid kooban ama ujeedada kooxda...' : 'Group Description / Mission...'}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1f293d] border border-gray-250 dark:border-gray-750 rounded-xl text-xs text-gray-950 dark:text-white placeholder-gray-450 focus:outline-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Avatar Selector Presets */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-gray-400">Preset Avatars:</span>
                <div className="flex gap-2">
                  {groupAvatarOptions.map((avatar, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCustomAvatar(avatar)}
                      className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${customAvatar === avatar ? 'border-blue-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Select Members Section */}
            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  {language === 'so' ? 'Kala dooro Xubnaha' : 'Add Group Members'}
                </label>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold px-2 py-0.5 rounded-full">
                  {selectedMembers.length} Selected
                </span>
              </div>

              {/* Search contacts filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder={language === 'so' ? 'Ku raadi xubnaha magac ahaan...' : 'Search members by name...'}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#1f293d] border border-gray-200 dark:border-gray-750 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-450 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Members check-list scroll */}
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-2 bg-gray-50/20 dark:bg-gray-900/15">
                {filteredProfiles.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-xs">No registered contacts found.</p>
                ) : (
                  filteredProfiles.map(p => {
                    const isChecked = selectedMembers.includes(p.id);
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => handleToggleMember(p.id)}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                            alt="" 
                            className="w-8 h-8 rounded-full object-cover border border-gray-150 dark:border-gray-750"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {p.first_name} {p.last_name}
                            </h5>
                            <p className="text-[9px] font-mono text-gray-450 dark:text-gray-400">
                              @{p.email.split('@')[0]}
                            </p>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-650'}`}>
                          {isChecked && <Check size={10} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Footer Submit Buttons */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-150 dark:border-gray-800/60 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                (!groupName.trim() || selectedMembers.length === 0)
                  ? 'bg-blue-300 text-white cursor-not-allowed opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10'
              }`}
            >
              <Plus size={13} />
              <span>{language === 'so' ? 'Abuur Kooxda' : 'Create Group'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
