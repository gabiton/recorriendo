"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type User = { id: number; name: string; email: string };
type Session = { user: User | null; csrf: string };
type SessionContext = { session: Session | null; loading: boolean; error: string; refresh: () => Promise<void> };
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const request = async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.csrf !== "string" || !("user" in data)) throw new Error();
      setSession(data);
      setError("");
    } catch {
      setError("No pudimos comprobar tu sesión. Intentá nuevamente.");
      setSession(null);
    } finally {
      setLoading(false);
    }
    };
    inFlight.current = request();
    try { await inFlight.current; } finally { inFlight.current = null; }
  }, []);
  useEffect(() => {
    void refresh();
    const check = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 60_000);
    return () => { window.removeEventListener("focus", check); window.clearInterval(timer); };
  }, [refresh]);
  return <Context.Provider value={{ session, loading, error, refresh }}>{children}</Context.Provider>;
}

export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Falta SessionProvider");
  return context;
}

export function SessionStatus() {
  const { error, refresh } = useSession();
  return <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-white px-6 text-zinc-900">
    <p role="status">{error || "Cargando..."}</p>
    {error && <button onClick={() => void refresh()} className="rounded border border-zinc-300 px-4 py-2">Reintentar</button>}
  </main>;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading, error } = useSession();
  useEffect(() => {
    if (session?.user) window.location.replace("/");
  }, [session]);
  if (loading || error || session?.user) return <SessionStatus />;
  return children;
}
