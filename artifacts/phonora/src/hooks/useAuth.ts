import { create } from 'zustand';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetProfile, getGetProfileQueryKey } from '@workspace/api-client-react';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('phonora_token'),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('phonora_token', token);
    } else {
      localStorage.removeItem('phonora_token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('phonora_token');
    set({ token: null });
  },
}));

export function useAuth() {
  const token = useAuthStore((state) => state.token);
  const setToken = useAuthStore((state) => state.setToken);
  const logoutAction = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetProfile({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  const isAuthenticated = !!user && !!token;

  // Since actual login/signup mutations aren't in api client, we'll fetch them manually for auth routes
  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || 'Login failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Signup failed' }));
        throw new Error(errorData.message || 'Signup failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    },
  });

  const logout = () => {
    logoutAction();
    queryClient.clear();
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    token,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    signup: signupMutation.mutateAsync,
    isSigningUp: signupMutation.isPending,
    logout,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
  };
}