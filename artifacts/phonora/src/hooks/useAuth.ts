import { create } from "zustand";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getGetProfileQueryKey } from "@workspace/api-client-react";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
}));

/** Bootstrap the Supabase session once on app mount */
export function useAuthInit() {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    });

    return () => listener.subscription.unsubscribe();
  }, [setSession, setLoading, queryClient]);
}

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();

  const isAuthenticated = !!session && !!user;

  /** Returns the current access token for use in API calls */
  function getToken(): string | null {
    return session?.access_token ?? null;
  }

  async function login({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // Ensure profile rows exist server-side
    await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token}`,
      },
      body: JSON.stringify({ email, password: "__supabase_token__" }),
    });
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    return data;
  }

  async function signup({
    email,
    password,
    displayName,
  }: {
    email: string;
    password: string;
    displayName?: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw new Error(error.message);

    // Ensure profile + settings rows exist
    if (data.session) {
      await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ email, password: "__supabase_token__", displayName }),
      });
    }

    return data;
  }

  async function loginWithGoogle() {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    getToken,
    login,
    signup,
    loginWithGoogle,
    logout,
  };
}
