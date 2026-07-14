import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '../types';

type AuthContextValue = {
  token: string;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (values: { email: string; password: string }) => Promise<void>;
  register: (values: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'scheduler-auth-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    // Restore the session from the backend before exposing protected routes.
    api.auth
      .me(token)
      .then((response) => {
        if (mounted) {
          setUser(response.user);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        if (mounted) {
          setToken('');
          setUser(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      async login(values) {
        const response = await api.auth.login(values);
        localStorage.setItem(STORAGE_KEY, response.token);
        setToken(response.token);
        setUser(response.user);
      },
      async register(values) {
        const response = await api.auth.register(values);
        localStorage.setItem(STORAGE_KEY, response.token);
        setToken(response.token);
        setUser(response.user);
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY);
        setToken('');
        setUser(null);
      },
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}