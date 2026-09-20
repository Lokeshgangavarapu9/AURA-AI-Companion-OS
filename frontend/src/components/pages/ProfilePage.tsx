import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Calendar,
  Award,
  Sparkles,
  MessageSquare,
  Mic,
  Camera,
  Clock,
  CheckCircle2,
  Smile,
  Edit2,
  Globe,
  Palette,
  Shield,
  Zap,
  Star,
  LogOut,
  LogIn,
  Lock
} from 'lucide-react';
import { soundFx } from '../../utils/soundEffects';
import { profileService, UserClaims } from '../../api/index.js';

export interface ProfilePageProps {
  onNavigate: (page: string) => void;
  user?: UserClaims | null;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigate,
  user = null,
  onOpenAuth,
  onLogout,
}) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Personalization editable state
  const [userNickname, setUserNickname] = useState('Alex');
  const [companionNickname, setCompanionNickname] = useState('Shizuka');
  const [selectedTheme, setSelectedTheme] = useState('Blush Rose & Warm White');
  const [selectedLanguage, setSelectedLanguage] = useState('English (US)');
  const [isEditingNicknames, setIsEditingNicknames] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    const res = await profileService.getProfile();
    if (res.success && res.data) {
      const rawData = (res.data as any).data || (res.data as any);
      const data = {
        email: rawData?.email || 'alex@aura.os',
        daysTogether: rawData?.daysTogether ?? 1,
        relationshipLevel: rawData?.relationshipLevel || 'stranger',
        statistics: rawData?.statistics || { totalConversations: 0, totalMessages: 0, trustScore: 15, relationshipHealth: 20 },
        favoriteTopics: rawData?.favoriteTopics || ['General'],
        achievements: rawData?.achievements || [],
        personalization: rawData?.personalization || { nickname: 'Alex', companionName: 'Shizuka', theme: 'Blush Rose & Warm White', language: 'English (US)' }
      };
      setProfileData(data);
      if (data.personalization) {
        setUserNickname(data.personalization.nickname || 'Alex');
        setCompanionNickname(data.personalization.companionName || 'Shizuka');
        setSelectedTheme(data.personalization.theme || 'Blush Rose & Warm White');
        setSelectedLanguage(data.personalization.language || 'English (US)');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleToggleEdit = async () => {
    soundFx.playClick();
    if (isEditingNicknames) {
      // Save changes to backend
      await profileService.updateProfile({
        name: userNickname,
        personalization: {
          nickname: userNickname,
          companionName: companionNickname,
          theme: selectedTheme,
          language: selectedLanguage,
        }
      });
      fetchProfile();
    }
    setIsEditingNicknames(!isEditingNicknames);
  };

  if (loading || !profileData) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-24 sm:py-28 text-center space-y-4 text-slate-500">
        <Sparkles className="w-8 h-8 text-pink-400 animate-spin mx-auto" />
        <p className="text-sm font-medium">Entering sanctuary, loading profile data...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-24 sm:py-28 text-slate-800 animate-in fade-in duration-300">
      {/* Page Title Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-100/80 border border-pink-200/80 text-pink-700 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Personal Sanctuary</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
          Your Companion Profile
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          A peaceful overview of your journey, relationship bond, and shared moments with {companionNickname}.
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. User Information Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-300 via-rose-200 to-purple-300 p-1 shadow-lg shadow-pink-200/60 flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-700 font-bold text-2xl shadow-inner">
                  {userNickname.charAt(0)}
                </div>
              </div>
              <div className="absolute bottom-1 right-1 p-1.5 bg-emerald-400 border-2 border-white rounded-full shadow-xs" title="Connected" />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2">
                    {userNickname}
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                      Companion Gold
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">{profileData.email}</p>
                </div>
                
                <button
                  onClick={handleToggleEdit}
                  className="px-3.5 py-1.5 rounded-xl glass-button text-xs font-semibold text-slate-700 hover:text-pink-600 flex items-center gap-1.5 self-center sm:self-auto"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditingNicknames ? 'Done Editing & Save' : 'Edit Personalization'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-pink-500" />
                  Together {profileData.daysTogether} Days
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-500" />
                  Private Session Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Relationship Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-pink-100/60 pb-3">
            <div className="p-2 rounded-2xl bg-pink-100 text-pink-600">
              <Heart className="w-4 h-4 fill-pink-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Relationship Bond</h3>
              <p className="text-xs text-slate-500">Emotional resonance & connection depth</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white/70 border border-white rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
              <Sparkles className="w-4 h-4 text-pink-500" />
              <span className="text-[11px] text-slate-500 font-medium">Friendship Level</span>
              <span className="text-sm font-bold text-slate-800 capitalize">{profileData.relationshipLevel}</span>
            </div>

            <div className="bg-white/70 border border-white rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
              <Calendar className="w-4 h-4 text-rose-500" />
              <span className="text-[11px] text-slate-500 font-medium">Days Together</span>
              <span className="text-sm font-bold text-slate-800">{profileData.daysTogether} Days</span>
            </div>

            <div className="bg-white/70 border border-white rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <span className="text-[11px] text-slate-500 font-medium">Conversations</span>
              <span className="text-sm font-bold text-slate-800">{profileData.statistics.totalConversations} Chats</span>
            </div>

            <div className="bg-white/70 border border-white rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
              <Mic className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] text-slate-500 font-medium">Trust Score</span>
              <span className="text-sm font-bold text-slate-800">{profileData.statistics.trustScore} / 100</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white/70 border border-white rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
              <Camera className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] text-slate-500 font-medium">Health Resonance</span>
              <span className="text-sm font-bold text-slate-800">{profileData.statistics.relationshipHealth}%</span>
            </div>
          </div>
        </div>

        {/* 3. Statistics Grid */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-pink-100/60 pb-3">
            <div className="p-2 rounded-2xl bg-purple-100 text-purple-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Statistics & Harmony</h3>
              <p className="text-xs text-slate-500">Summary of interaction frequency and topics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/60 border border-white/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-pink-500" /> Messages Logged
                </span>
                <span className="font-bold text-slate-800">{profileData.statistics.totalMessages}</span>
              </div>
              <div className="w-full bg-pink-100/70 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-pink-400 to-rose-400 h-full w-[82%]" />
              </div>
            </div>

            <div className="bg-white/60 border border-white/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" /> Trust Index
                </span>
                <span className="font-bold text-slate-800">{profileData.statistics.trustScore} Trust</span>
              </div>
              <div className="w-full bg-purple-100/70 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-full w-[65%]" />
              </div>
            </div>

            <div className="bg-white/60 border border-white/80 rounded-2xl p-4 space-y-2">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500" /> Favorite Topics
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profileData.favoriteTopics.map((topic: string) => (
                  <span key={topic} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-slate-700 border border-slate-100">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white/60 border border-white/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-emerald-500" /> Compatibility Sync
                </span>
                <span className="font-bold text-emerald-600">{profileData.statistics.relationshipHealth}% Resonance</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Active emotional sync detected across chat logs.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Achievements */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-pink-100/60 pb-3">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-600">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Achievements & Badges</h3>
              <p className="text-xs text-slate-500">Shared milestones unlocked with {companionNickname}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {profileData.achievements.map((ach: any, idx: number) => {
              return (
                <div key={idx} className="bg-white/70 border border-white/90 rounded-2xl p-4 flex gap-3.5 items-start">
                  <div className={`p-2.5 rounded-2xl ${ach.achieved ? 'text-amber-500 bg-amber-50' : 'text-slate-400 bg-slate-100'} flex-shrink-0 mt-0.5`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">{ach.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ach.achieved ? 'text-pink-600 bg-pink-50 border-pink-100' : 'text-slate-400 bg-slate-50 border-slate-150'}`}>
                        {ach.achieved ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Personalization Settings */}
        {isEditingNicknames && (
          <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-pink-100/60 pb-3">
              <div className="p-2 rounded-2xl bg-rose-100 text-rose-600">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Personalization Settings</h3>
                <p className="text-xs text-slate-500">Customize nicknames, language, and theme colors</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Your Nickname</label>
                <input
                  type="text"
                  value={userNickname}
                  onChange={(e) => setUserNickname(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Companion Nickname</label>
                <input
                  type="text"
                  value={companionNickname}
                  onChange={(e) => setCompanionNickname(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-pink-500" /> Theme Palette
                </label>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="Blush Rose & Warm White">Blush Rose & Warm White (Default)</option>
                  <option value="Soft Peach Sanctuary">Soft Peach Sanctuary</option>
                  <option value="Cream Lavender Whisper">Cream Lavender Whisper</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-500" /> Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="English (US)">English (US)</option>
                  <option value="Japanese (日本語)">Japanese (日本語)</option>
                  <option value="French (Français)">French (Français)</option>
                  <option value="Spanish (Español)">Spanish (Español)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 6. Account & Cloud Data Security */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-pink-100/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-600">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Account & Cloud Data Security</h3>
                <p className="text-xs text-slate-500">Multi-tenant isolation and cloud sync status</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Isolated Tenant</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span>Account Email:</span>
                <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {user ? user.email : profileData.email}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Authentication Provider:</span>
                <span className="capitalize font-medium text-slate-700">{user?.provider || 'local'}</span>
                <span>•</span>
                <span>Security: JWT Bearer & Argon2/Bcrypt</span>
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onLogout?.();
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onOpenAuth?.('login');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Action Footer */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('chat');
            }}
            className="px-6 py-3 rounded-full glass-button font-semibold text-xs sm:text-sm text-slate-800 hover:text-pink-600 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-pink-500" />
            <span>Continue Conversation with {companionNickname}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default ProfilePage;
