import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  History,
  Settings,
  User,
  Home,
  LogIn,
  LogOut
} from 'lucide-react';
import { soundFx } from '../utils/soundEffects';
import { healthService, HealthResponse, UserClaims } from '../api/index.js';

export type NavTab = 'home' | 'chat' | 'history' | 'profile' | 'settings';

interface TopStatusBarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  isIdle?: boolean;
  user?: UserClaims | null;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
}

type BackendConnectionStatus = 'connecting' | 'online' | 'offline';

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  activeTab,
  onNavigate,
  isIdle = false,
  user = null,
  onOpenAuth,
  onLogout,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>('connecting');
  const [, setHealthData] = useState<HealthResponse | null>(null);

  // Poll backend health API using healthService from central API layer
  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      const res = await healthService.checkHealth();
      if (!isMounted) return;

      if (res.success && res.data.status === 'ok') {
        setConnectionStatus('online');
        setHealthData(res.data);
      } else {
        setConnectionStatus('offline');
        setHealthData(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className={`fixed top-5 left-0 right-0 z-50 px-4 transition-all duration-500 ease-in-out ${
      isIdle ? 'opacity-30 pointer-events-none -translate-y-1' : 'opacity-100 pointer-events-auto translate-y-0'
    }`}>
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-3 bg-white/70 backdrop-blur-xl border border-white/90 rounded-full px-4 sm:px-6 py-2.5 shadow-sm shadow-pink-100/40 text-slate-800 transition-all">
        
        {/* Logo / Brand Name - Returns to Home */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              soundFx.playClick();
              onNavigate('home');
            }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-400 to-rose-400 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold tracking-wide text-slate-800 text-xs sm:text-sm">
              Shizuka
            </span>
          </div>

          {/* Dynamic Backend Status Badge */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/60 text-[10px] font-medium text-slate-600">
            {connectionStatus === 'connecting' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden md:inline">Connecting...</span>
              </>
            )}
            {connectionStatus === 'online' && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden md:inline text-emerald-700 font-semibold">Engine v1.0</span>
              </>
            )}
            {connectionStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="hidden md:inline text-rose-600">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Unified Navigation Items: Home, Chat, History, Profile, Settings */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Home */}
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('home');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-pink-100/90 text-pink-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-pink-500" />
            <span className="hidden sm:inline">Home</span>
          </button>

          {/* Chat */}
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('chat');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-pink-100/90 text-pink-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-pink-500" />
            <span>Chat</span>
          </button>

          {/* History */}
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('history');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-100/90 text-purple-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('profile');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-rose-100/90 text-rose-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <User className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Profile</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              soundFx.playClick();
              onNavigate('settings');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-200/90 text-slate-800 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Authentication State / Action */}
          {user ? (
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200/80">
              <button
                type="button"
                title={`Signed in as ${user.name} (${user.email})`}
                onClick={() => {
                  soundFx.playClick();
                  onNavigate('profile');
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 transition-all cursor-pointer text-xs font-semibold"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-400 to-rose-400 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[70px] truncate hidden md:inline">{user.name}</span>
              </button>

              <button
                type="button"
                title="Sign Out"
                onClick={() => {
                  soundFx.playClick();
                  onLogout?.();
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onOpenAuth?.('login');
              }}
              className="flex items-center gap-1 px-3 py-1.5 ml-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
