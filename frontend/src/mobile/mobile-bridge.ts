/**
 * AURA Mobile Architecture & Bridge Layer
 * Mission 7.0: Cross-platform mobile foundation for Android & iOS.
 * Handles secure storage, offline message caching, haptics, notifications, and device permissions.
 */

export interface CachedSession {
  sessionId: string;
  title: string;
  lastMessage?: string;
  timestamp: string;
}

export interface QueuedMessage {
  id: string;
  text: string;
  sessionId?: string | null;
  createdAt: string;
}

class MobileBridge {
  private offlineQueue: QueuedMessage[] = [];
  private readonly QUEUE_KEY = 'aura_offline_msg_queue';
  private readonly SESSIONS_CACHE_KEY = 'aura_cached_sessions';
  private readonly TOKEN_KEY = 'aura_auth_token';

  constructor() {
    this.loadOfflineQueue();
    this.initNetworkListeners();
  }

  // 1. PLATFORM DETECTION
  public get isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  public get isAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
  }

  public get isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  public get isPWA(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  }

  public get isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  // 2. SECURE TOKEN STORAGE
  public setSecureAuthToken(token: string): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
    } catch (e) {
      console.warn('Failed to persist auth token', e);
    }
  }

  public getSecureAuthToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public clearSecureAuthToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to clear auth token', e);
    }
  }

  // 3. OFFLINE CACHE & QUEUE MANAGER
  public cacheSessions(sessions: CachedSession[]): void {
    try {
      localStorage.setItem(this.SESSIONS_CACHE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to cache sessions', e);
    }
  }

  public getCachedSessions(): CachedSession[] {
    try {
      const data = localStorage.getItem(this.SESSIONS_CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public enqueueOfflineMessage(text: string, sessionId?: string | null): QueuedMessage {
    const item: QueuedMessage = {
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      sessionId,
      createdAt: new Date().toISOString(),
    };
    this.offlineQueue.push(item);
    this.saveOfflineQueue();
    this.triggerHaptic('light');
    return item;
  }

  public getPendingQueue(): QueuedMessage[] {
    return [...this.offlineQueue];
  }

  public removeQueuedMessage(id: string): void {
    this.offlineQueue = this.offlineQueue.filter((m) => m.id !== id);
    this.saveOfflineQueue();
  }

  private loadOfflineQueue(): void {
    try {
      const data = localStorage.getItem(this.QUEUE_KEY);
      if (data) {
        this.offlineQueue = JSON.parse(data);
      }
    } catch {
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (e) {
      console.warn('Failed to persist offline queue', e);
    }
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      console.log('📶 AURA Mobile: Network connection restored, online queue length:', this.offlineQueue.length);
      this.triggerHaptic('success');
    });
  }

  // 4. MOBILE HAPTIC FEEDBACK
  public triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' = 'light'): void {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'heavy':
        navigator.vibrate(60);
        break;
      case 'success':
        navigator.vibrate([20, 40, 30]);
        break;
    }
  }

  // 5. PUSH & LOCAL NOTIFICATIONS
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  public sendNotification(title: string, options?: NotificationOptions): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/vite.svg',
        badge: '/vite.svg',
        ...options,
      });
      this.triggerHaptic('medium');
    }
  }

  // 6. DEVICE SENSOR PERMISSIONS
  public async requestCameraAccess(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  public async requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}

export const mobileBridge = new MobileBridge();
