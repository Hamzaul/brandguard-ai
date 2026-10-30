import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../services/authApi.js";
import { getToken, setToken, clearToken, UNAUTHORIZED_EVENT } from "../services/session.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On load: if a token is stored, ask the server who it belongs to.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getToken()) { setReady(true); return; }
      try {
        const data = await api.fetchMe();
        if (!cancelled) setUser(data.user);
      } catch {
        clearToken(); // expired / invalid token
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  // Any 401 from the API signs the user out.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const finish = useCallback((data) => { setToken(data.token); setUser(data.user); }, []);
  const value = useMemo(() => ({
    user,
    ready,
    login: async (email, password) => finish(await api.login(email, password)),
    signup: async (name, email, password) => finish(await api.signup(name, email, password)),
    logout: () => { clearToken(); setUser(null); window.location.hash = ""; },
  }), [user, ready, finish]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
