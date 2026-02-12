"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  loggedIn: boolean;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  loggedIn: false,
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setLoggedIn(!!token);
    setLoading(false);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("token");
    setLoggedIn(false);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ loggedIn, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Hook to redirect to /login if not authenticated.
 * Call at the top of protected pages.
 */
export function useRequireAuth() {
  const { loggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !loggedIn) {
      router.replace("/login");
    }
  }, [loggedIn, loading, router]);

  return { loggedIn, loading };
}
