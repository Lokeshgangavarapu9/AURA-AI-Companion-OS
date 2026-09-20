import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService, UserClaims } from '../api/index.js';

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

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      if (authService.isAuthenticated()) {
        const res = await authService.getMe();
        if (res.success && res.data?.data?.user) {
          setUser(res.data.data.user);
        } else {
          authService.clearToken();
          setUser(null);
          setIsAuthModalOpen(true);
          setAuthModalMode('login');
        }
      } else {
        // Protect application: prompt unauthenticated users
        setUser(null);
        setIsAuthModalOpen(true);
        setAuthModalMode('login');
      }
    } catch {
      authService.clearToken();
      setUser(null);
      setIsAuthModalOpen(true);
      setAuthModalMode('login');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthModalOpen(true);
      setAuthModalMode('login');
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
  }, [restoreSession]);

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
    await authService.logout();
    setUser(null);
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    // Only close if user is authenticated to keep protected state safe
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
