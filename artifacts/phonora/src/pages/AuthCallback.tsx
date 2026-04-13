import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLocation("/dashboard");
      } else {
        // Exchange code in URL for session (PKCE flow)
        supabase.auth.exchangeCodeForSession(window.location.search).then(({ error }) => {
          if (error) {
            console.error("OAuth callback error:", error.message);
            setLocation("/login");
          } else {
            setLocation("/dashboard");
          }
        });
      }
    });
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
