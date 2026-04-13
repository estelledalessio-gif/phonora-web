import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuthStore } from "@/hooks/useAuth";

setAuthTokenGetter(() => {
  const session = useAuthStore.getState().session;
  return session?.access_token ?? null;
});

createRoot(document.getElementById("root")!).render(<App />);
