import React, { createContext, useContext, useState, useEffect } from "react";
import { api, MobileUser } from "../services/api";
import { registerForPushAsync } from "../services/push";

interface AuthContextType {
  user: MobileUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const storedToken = await api.getToken();
      const storedUser = await api.getStoredUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        // Silently fetch fresh user
        api.getProfile().then((res) => {
          setUser(res.user);
          api.setSession(storedToken, res.user);
        }).catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, pass: string) {
    const res = await api.login(email, pass);
    await api.setSession(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
    // Register this device for push (no-op in Expo Go; works in a dev build).
    void registerForPushAsync();
  }

  async function logout() {
    await api.clearSession();
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    try {
      const res = await api.getProfile();
      setUser(res.user);
      if (token) await api.setSession(token, res.user);
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
