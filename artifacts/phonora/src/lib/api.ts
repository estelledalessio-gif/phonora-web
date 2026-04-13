import { useAuthStore } from "@/hooks/useAuth";

/**
 * Authenticated fetch wrapper used by the Orval custom fetcher.
 * Reads the current Supabase session access_token from the Zustand store
 * and attaches it as a Bearer token on every request.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = useAuthStore.getState().session;
  const token = session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
