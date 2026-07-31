"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import LoginScreen from "./LoginScreen";

type AuthContextValue = {
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({ user: null, signOut: async () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabase) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).finally(() => {
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.pathname + url.hash);
      });
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseEnabled) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-mark" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, signOut: async () => { await supabase!.auth.signOut(); } }}>
      {children}
    </AuthContext.Provider>
  );
}
