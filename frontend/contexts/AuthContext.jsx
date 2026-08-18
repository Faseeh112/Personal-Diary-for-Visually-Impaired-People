"use client";

/**
 * AuthContext — single source of truth for "is the user logged in" and
 * who they are. Persists to localStorage via tokenStore. Listens for
 * forced-logout events emitted by the axios interceptor (failed refresh).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { authApi } from "../api/endpoints";
import { tokenStore, AUTH_EVENT } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Start null on server; hydrate from localStorage after mount to avoid SSR mismatch.
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    setUser(tokenStore.getUser());
  }, []);

  // React to forced-logout events from the axios interceptor.
  useEffect(() => {
    const onAuthChange = () => setUser(tokenStore.getUser());
    window.addEventListener(AUTH_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_EVENT, onAuthChange);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setBootstrapping(true);
    try {
      const data = await authApi.login({ email, password });
      tokenStore.set(data);
      setUser(data.user);
      return data.user;
    } finally {
      setBootstrapping(false);
    }
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    setBootstrapping(true);
    try {
      const data = await authApi.register({ name, email, password });
      tokenStore.set(data);
      setUser(data.user);
      return data.user;
    } finally {
      setBootstrapping(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      bootstrapping,
      login,
      register,
      logout,
    }),
    [user, bootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
