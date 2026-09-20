/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AIStatusMode,
  AIEmotion,
  PersonalityMode,
  ChatMessage,
  CameraState,
  AudioState,
  AppSettings,
  ConversationHistoryItem
} from './types';
import {
  PERSONALITY_MODES,
  DEFAULT_SETTINGS,
  SAMPLE_CONVERSATION_HISTORY
} from './utils/mockData';
import { soundFx } from './utils/soundEffects';

import {
  chatService,
  sessionService,
  settingsService,
  authService,
  UserClaims
} from './api/index.js';

// Core Components
import { AvatarViewer } from './components/AvatarViewer';
import { TopStatusBar, NavTab } from './components/TopStatusBar';
import { FloatingControlsBar } from './components/FloatingControlsBar';
import { CameraPreviewModal } from './components/CameraPreviewModal';
import { MicrophoneModal } from './components/MicrophoneModal';
import { AuthModal } from './components/AuthModal';

// Dedicated Full Pages
import { ProfilePage } from './components/pages/ProfilePage';
import { ChatPage } from './components/pages/ChatPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { SettingsPage } from './components/pages/SettingsPage';

export interface ConversationSessionState {
  sessionId: string | null;
  title: string;
  currentTopic: string;
  messageCount: number;
  startedAt: string;
}

export default function App() {
  // Navigation Routing State
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Authentication State (Multi-tenant SaaS Identity)
  const [user, setUser] = useState<UserClaims | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Active Session State (Resets on browser refresh or restores via History)
  const [activeSession, setActiveSession] = useState<ConversationSessionState>({
    sessionId: null,
    title: 'AURA Conversation',
    currentTopic: 'General',
    messageCount: 0,
    startedAt: new Date().toISOString(),
  });

  // Application State
  const [status, setStatus] = useState<AIStatusMode>('idle');
  const [emotion, setEmotion] = useState<AIEmotion>('happy');
  const [personality, setPersonality] = useState<PersonalityMode>(PERSONALITY_MODES[0]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Audio / Speech State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>({
    isMicActive: false,
    isMuted: false,
    volumeLevel: 45,
    audioWaveData: [],
    transcription: ''
  });

  // Camera Vision State
  const [cameraState, setCameraState] = useState<CameraState>({
    isOpen: false,
    isPaused: false,
    facingMode: 'user',
    visionScanning: true,
    detectedObjects: ['User Face', 'Soft Lighting', 'Smile Expression']
  });

  // Microphone stream modal toggle
  const [isMicModalOpen, setIsMicModalOpen] = useState(false);
  const liveVoiceManagerRef = useRef<any>(null);

  // Helper for dynamic greeting based on time of day and authenticated user
  const getGreetingText = (userName?: string) => {
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const displayName = userName ? userName.split(' ')[0] : 'friend';
    return `${salutation}, ${displayName}. It's wonderful to see you again. How can I accompany you today?`;
  };

  // Time-of-day session greeting (Greets once per session)
  const [sessionGreeting, setSessionGreeting] = useState<string | null>(() => getGreetingText());

  // Restore authenticated session on mount and sync across tabs
  useEffect(() => {
    const restoreAuth = async () => {
      if (authService.isAuthenticated()) {
        const res = await authService.getMe();
        if (res.success && res.data?.data?.user) {
          const authUser = res.data.data.user;
          setUser(authUser);
          setSessionGreeting(getGreetingText(authUser.name));

          // Reload user-scoped settings
          const settingsRes = await settingsService.getSettings();
          if (settingsRes.success && settingsRes.data) {
            setSettings((settingsRes.data as any).data);
          }
        } else {
          authService.clearToken();
          setUser(null);
        }
      }
    };

    restoreAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthModalOpen(true);
      setAuthModalMode('login');
    };

    const handleAuthState = () => {
      restoreAuth();
    };

    window.addEventListener('aura:unauthorized', handleUnauthorized);
    window.addEventListener('aura:auth_state_changed', handleAuthState);

    return () => {
      window.removeEventListener('aura:unauthorized', handleUnauthorized);
      window.removeEventListener('aura:auth_state_changed', handleAuthState);
    };
  }, []);

  // Auto-fade greeting banner after 6 seconds
  useEffect(() => {
    if (sessionGreeting) {
      const t = setTimeout(() => setSessionGreeting(null), 6000);
      return () => clearTimeout(t);
    }
  }, [sessionGreeting]);

  // User Inactivity / Idle Auto-Hide State for Home Controls
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsIdle(true);
      }, 8000); // 8 seconds of inactivity
    };

    resetIdleTimer();

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
    };
  }, []);

  // Chat Messages & History
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyList, setHistoryList] = useState<ConversationHistoryItem[]>(SAMPLE_CONVERSATION_HISTORY);

  // Sync Web Audio Synth enabled state with settings
  useEffect(() => {
    soundFx.setEnabled(settings.soundFxEnabled);
  }, [settings.soundFxEnabled]);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = async (authenticatedUser: UserClaims) => {
    setUser(authenticatedUser);
    setSessionGreeting(getGreetingText(authenticatedUser.name));

    // Reset voice manager instance to reconnect with user JWT
    if (liveVoiceManagerRef.current) {
      liveVoiceManagerRef.current.stopDuplexSession();
      liveVoiceManagerRef.current = null;
    }

    // Refresh scoped settings
    const settingsRes = await settingsService.getSettings();
    if (settingsRes.success && settingsRes.data) {
      setSettings((settingsRes.data as any).data);
    }
  };

  const handleLogout = async () => {
    if (liveVoiceManagerRef.current) {
      liveVoiceManagerRef.current.stopDuplexSession();
      liveVoiceManagerRef.current = null;
    }
    await authService.logout();
    setUser(null);
    setActiveSession({
      sessionId: null,
      title: 'AURA Conversation',
      currentTopic: 'General',
      messageCount: 0,
      startedAt: new Date().toISOString(),
    });
    setMessages([]);
    setSessionGreeting(getGreetingText());
    soundFx.playStatusChange('idle');
  };

  const handleUpdateSettings = async (newSet: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSet };
    setSettings(updated);
    await settingsService.updateSettings(updated);
  };

  const handleResetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await settingsService.updateSettings(DEFAULT_SETTINGS);
  };

  // Handle Resuming an Active Session from History Workspace
  const handleResumeSession = async (sessionId?: string) => {
    if (!sessionId) {
      setActiveSession({
        sessionId: null,
        title: 'AURA Conversation',
        currentTopic: 'General',
        messageCount: 0,
        startedAt: new Date().toISOString(),
      });
      setMessages([]);
      setActiveTab('chat');
      return;
    }

    const res = await sessionService.getSessionById(sessionId);
    if (res.success) {
      const { session, messages: thread } = res.data.data;
      setActiveSession({
        sessionId: session.id,
        title: session.title,
        currentTopic: session.currentTopic || 'General',
        messageCount: session.messageCount,
        startedAt: session.createdAt,
      });

      const formattedMsgs: ChatMessage[] = thread.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: (m.emotion as AIEmotion) || 'neutral',
      }));

      setMessages(formattedMsgs);
    }
    setActiveTab('chat');
  };

  // Handle AI Response Generation via Live Backend ConversationManager
  const triggerAIResponse = async (userPrompt: string) => {
    setStatus('thinking');
    setEmotion('thinking');
    soundFx.playStatusChange('thinking');

    // Send message via chatService, passing active sessionId (if present)
    const result = await chatService.sendMessage(userPrompt, activeSession.sessionId);

    let replyText = `I'm right here with you!`;
    let responseEmotion: AIEmotion = 'neutral';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (result.success) {
      const payload = result.data.data;
      replyText = payload.text;
      responseEmotion = payload.emotion as AIEmotion;

      // Update active session metadata in React state
      setActiveSession((prev) => ({
        ...prev,
        sessionId: payload.sessionId,
        currentTopic: payload.topic,
        messageCount: payload.messageCount,
      }));
    } else {
      replyText = `I heard what you said, but encountered a network issue: ${'error' in result ? result.error : 'Connection error'}`;
      responseEmotion = 'soothing';
    }

    const newAIMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      text: replyText,
      timestamp: timeStr,
      emotion: responseEmotion,
    };

    setMessages((prev) => [...prev, newAIMsg]);

    // Enter Speaking State with Lip Sync Animation
    setStatus('speaking');
    setEmotion(responseEmotion);
    setIsSpeaking(true);
    soundFx.playStatusChange('speaking');

    const speechInterval = setInterval(() => {
      soundFx.triggerSpeechBlip();
    }, 160);

    setTimeout(() => {
      clearInterval(speechInterval);
      setIsSpeaking(false);
      setStatus('idle');
      setEmotion('neutral');
      soundFx.playStatusChange('idle');
    }, 3800);
  };

  // Toggle Microphone Realtime Voice (Clean Production Experience vs Developer Mode)
  const handleToggleMic = async () => {
    const nextMicActive = !audioState.isMicActive;
    setAudioState((prev) => ({ ...prev, isMicActive: nextMicActive }));

    if (nextMicActive) {
      setStatus('listening');
      setEmotion('curious');
      soundFx.playStatusChange('listening');

      // 1. Request Microphone Permission and Start Live Voice Duplex Stream
      try {
        if (!liveVoiceManagerRef.current) {
          const { LiveVoiceSyncManager } = await import('./services/live-voice-sync.manager.js');
          const token = authService.getToken();
          const wsUrl = token
            ? `ws://${window.location.hostname}:5000/ws/voice?token=${encodeURIComponent(token)}`
            : `ws://${window.location.hostname}:5000/ws/voice`;

          liveVoiceManagerRef.current = new LiveVoiceSyncManager({
            wsUrl,
            onStateChanged: (newStatus, newEmotion) => {
              setStatus(newStatus);
              if (newEmotion) setEmotion(newEmotion);
              setIsSpeaking(newStatus === 'speaking');
            },
            onTranscriptionReceived: (text, isFinal) => {
              setAudioState((a) => ({ ...a, transcription: text }));
              if (isFinal) {
                setMessages((prev) => [...prev, {
                  id: `voice-user-${Date.now()}`,
                  sender: 'user',
                  text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
              }
            },
            onAiResponseText: (aiText, conversationSessionId) => {
              if (conversationSessionId) {
                setActiveSession((prev) => ({
                  ...prev,
                  sessionId: conversationSessionId,
                  messageCount: prev.messageCount + 2
                }));
              }
              const now = new Date();
              const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg-${Date.now()}`,
                  sender: 'ai',
                  text: aiText,
                  timestamp: timeStr,
                  emotion: 'happy',
                },
              ]);
            },
          });
        }
        await liveVoiceManagerRef.current.startDuplexSession(activeSession.sessionId || undefined);
      } catch (err) {
        console.error('❌ App: Microphone access denied or connection error', err);
        setAudioState((prev) => ({ ...prev, isMicActive: false }));
        setStatus('idle');
        setEmotion('soothing');
        return;
      }

      // In Developer Mode, open Audio Stream Inspector Modal
      if (settings.developerMode) {
        setIsMicModalOpen(true);
      } else {
        setIsMicModalOpen(false);
      }
    } else {
      // Complete Resource Cleanup
      if (liveVoiceManagerRef.current) {
        liveVoiceManagerRef.current.stopDuplexSession();
      }
      setIsMicModalOpen(false);
      setStatus('idle');
      setEmotion('neutral');
      soundFx.playStatusChange('idle');
    }
  };

  // Toggle Camera Vision Window (Clean Production Experience vs Developer Mode)
  const handleToggleCamera = async () => {
    const nextOpen = !cameraState.isOpen;

    if (nextOpen) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        setStatus('vision');
        soundFx.playStatusChange('vision');
      } catch (err) {
        console.error('❌ App: Camera permission denied or device not found', err);
        return;
      }
    } else {
      setStatus('idle');
      soundFx.playStatusChange('idle');
    }

    setCameraState((prev) => ({
      ...prev,
      isOpen: settings.developerMode ? nextOpen : false,
    }));
  };

  // User Sent Text Message
  const handleSendMessage = (text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: timeStr
    };

    setMessages((prev) => [...prev, userMsg]);
    triggerAIResponse(text);
  };

  const bgClass = settings.theme === 'cyberpunk' ? 'bg-peach-sanctuary'
                : settings.theme === 'minimal' ? 'bg-lavender-whisper'
                : 'bg-paper-cloud';

  return (
    <div className={`relative w-screen h-screen overflow-hidden ${bgClass} paper-grain font-sans text-slate-800 select-none`}>
      
      {/* Soft Ambient Light Highlights */}
      <div className="pointer-events-none absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-pink-200/40 blur-[130px] rounded-full z-0 animate-pulse duration-1000" />
      <div className="pointer-events-none absolute bottom-[-5%] right-[15%] w-[45%] h-[45%] bg-purple-200/35 blur-[120px] rounded-full z-0 animate-pulse duration-700" />
      <div className="pointer-events-none absolute top-[30%] left-[35%] w-[400px] h-[400px] bg-amber-100/50 blur-[140px] rounded-full z-0" />

      {/* Ambient Floating Particles */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[15%] left-[10%] w-1.5 h-1.5 bg-pink-300/40 rounded-full animate-ping" />
        <div className="absolute top-[60%] left-[85%] w-2 h-2 bg-purple-300/30 rounded-full animate-pulse" />
        <div className="absolute top-[75%] left-[25%] w-1.5 h-1.5 bg-amber-200/50 rounded-full animate-ping" />
        <div className="absolute top-[35%] right-[20%] w-2 h-2 bg-rose-200/40 rounded-full animate-pulse" />
      </div>

      {/* 1. Background 3D AI Companion Avatar & Interactive Circular Ring */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${activeTab !== 'home' ? 'opacity-30 blur-xs pointer-events-none' : 'opacity-100'}`}>
        <AvatarViewer
          status={status}
          emotion={emotion}
          isSpeaking={isSpeaking}
          isListening={status === 'listening'}
          glowColorHex={settings.avatarGlowColor}
        />
      </div>

      {/* 2. Unified Navigation Bar (Home, Chat, History, Profile, Settings, Auth) */}
      <TopStatusBar
        activeTab={activeTab}
        isIdle={isIdle}
        user={user}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* 3. Page Views Container */}
      <main className="relative z-10 w-full h-full overflow-y-auto no-scrollbar">
        {/* PAGE 1: HOME */}
        {activeTab === 'home' && (
          <div className="relative w-full h-full">
            {/* Session Greeting Banner (Greets once per session) */}
            {sessionGreeting && (
              <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-md border border-pink-200/80 text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                <span>{sessionGreeting}</span>
              </div>
            )}

            {/* Home Floating Controls (Speak, Chat, Camera) */}
            <FloatingControlsBar
              isMicActive={audioState.isMicActive}
              onToggleMic={handleToggleMic}
              isChatOpen={false}
              onToggleChat={() => setActiveTab('chat')}
              isCameraOpen={cameraState.isOpen}
              onToggleCamera={handleToggleCamera}
              status={status}
              isIdle={isIdle}
            />
          </div>
        )}

        {/* PAGE 2: PROFILE */}
        {activeTab === 'profile' && (
          <ProfilePage
            onNavigate={(page) => setActiveTab(page as NavTab)}
            user={user}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
          />
        )}

        {/* PAGE 3: CHAT */}
        {activeTab === 'chat' && (
          <ChatPage
            messages={messages}
            onSendMessage={handleSendMessage}
            onClearChat={() => setMessages([])}
            isThinking={status === 'thinking'}
          />
        )}

        {/* PAGE 4: HISTORY WORKSPACE */}
        {activeTab === 'history' && (
          <HistoryPage
            onNavigateToChat={(sessionId) => handleResumeSession(sessionId)}
          />
        )}

        {/* PAGE 5: SETTINGS */}
        {activeTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetSettings={handleResetSettings}
          />
        )}
      </main>

      {/* Camera Vision View (Global Overlay) */}
      {cameraState.isOpen && (
        <CameraPreviewModal
          cameraState={cameraState}
          onClose={() => setCameraState((c) => ({ ...c, isOpen: false }))}
          onTogglePause={() => setCameraState((c) => ({ ...c, isPaused: !c.isPaused }))}
          onCaptureFrame={(label) => handleSendMessage(label)}
        />
      )}

      {/* Microphone Stream Modal (Global Overlay) */}
      {isMicModalOpen && (
        <MicrophoneModal
          audioState={audioState}
          onClose={() => setIsMicModalOpen(false)}
          onToggleMute={() => setAudioState((a) => ({ ...a, isMuted: !a.isMuted }))}
          onSimulateVoiceTranscribe={(text) => {
            setAudioState((a) => ({ ...a, transcription: text }));
            handleSendMessage(text);
          }}
        />
      )}

      {/* Authentication Modal (Sign In / Register / Reset Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />
    </div>
  );
}
