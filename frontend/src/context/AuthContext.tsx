import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService, UserClaims } from '../api/index.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export interface AuthContextType {
  user: UserClaims | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  login: (params: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  register: (params: { email: string; password: string; name: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  setUser: (user: UserClaims | null) => void;
  requireAuth: <T>(action: () => T) => T | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserClaims | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  /** Show auth modal */
  const showAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  }, []);

  /**
   * Exchange a Supabase access_token with the AURA backend to resolve the Neon user record,
   * OR restore an existing AURA token session. 
   */
  const restoreSession = useCallback(async (supabaseToken?: string) => {
    setIsLoading(true);
    try {
      const token = supabaseToken || authService.getToken();

      if (token) {
        // Store Supabase token for subsequent API calls
        if (supabaseToken) {
          authService.setToken(supabaseToken);
        }

        const res = await authService.getMe();
        if (res.success && res.data?.data?.user) {
          setUser(res.data.data.user);
          setIsAuthModalOpen(false);
          return;
        }
      }

      // No valid session — prompt login
      authService.clearToken();
      setUser(null);
      showAuthModal();
    } catch {
      authService.clearToken();
      setUser(null);
      showAuthModal();
    } finally {
      setIsLoading(false);
    }
  }, [showAuthModal]);

  // -----------------------------------------------------------------------
  // Effect 1: Supabase session listener + initial session restore
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Supabase not configured — restore AURA token only
      restoreSession();
      return;
    }

    // Subscribe to all Supabase auth state changes (OAuth redirects, refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.access_token) {
          await restoreSession(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          authService.clearToken();
          setUser(null);
          setIsLoading(false);
          showAuthModal();
        }
      }
    );

    // Check for an existing Supabase session on mount (handles page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        await restoreSession(session.access_token);
      } else {
        // Fall back to AURA token (email/password sessions)
        await restoreSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [restoreSession, showAuthModal]);

  // -----------------------------------------------------------------------
  // Effect 2: Global window event listeners (aura:unauthorized, aura:auth_state_changed)
  // These are always set up regardless of Supabase configuration.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handleUnauthorized = () => {
      authService.clearToken();
      setUser(null);
      showAuthModal();
    };

    const handleAuthStateChanged = () => {
      restoreSession();
    };

    window.addEventListener('aura:unauthorized', handleUnauthorized);
    window.addEventListener('aura:auth_state_changed', handleAuthStateChanged);

    return () => {
      window.removeEventListener('aura:unauthorized', handleUnauthorized);
      window.removeEventListener('aura:auth_state_changed', handleAuthStateChanged);
    };
  }, [restoreSession, showAuthModal]);

  const login = async (params: { email: string; password: string }) => {
    const res = await authService.login(params);
    if (res.success && res.data?.data?.user) {
      setUser(res.data.data.user);
      setIsAuthModalOpen(false);
      return { success: true };
    }
    return {
      success: false,
      error: 'error' in res ? res.error : 'Login failed. Please check your credentials.',
    };
  };

  const register = async (params: { email: string; password: string; name: string }) => {
    const res = await authService.register(params);
    if (res.success && res.data?.data?.user) {
      setUser(res.data.data.user);
      setIsAuthModalOpen(false);
      return { success: true };
    }
    return {
      success: false,
      error: 'error' in res ? res.error : 'Registration failed. Please try again.',
    };
  };

  const logout = async () => {
    // Sign out from Supabase if configured
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await authService.logout();
    authService.clearToken();
    setUser(null);
    showAuthModal();
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    // Only allow closing the modal if the user is authenticated
    if (user) {
      setIsAuthModalOpen(false);
    }
  };

  const requireAuth = <T,>(action: () => T): T | void => {
    if (!user && !authService.isAuthenticated()) {
      openAuthModal('login');
      return;
    }
    return action();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        login,
        register,
        logout,
        openAuthModal,
        closeAuthModal,
        setUser,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Protected Route Guard Component
 * Protects child components until user authentication succeeds.
 */
export const ProtectedRoute: React.FC<{
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ children, fallback = null }) => {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openAuthModal('login');
    }
  }, [isLoading, isAuthenticated, openAuthModal]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
