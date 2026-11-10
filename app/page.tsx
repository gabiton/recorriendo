"use client";

import Link from "next/link";
import { SessionStatus, useSession } from "./components/session-provider";
import MemberHome from "./components/member-home";

export default function Home() {
  const { session, loading, error } = useSession();
  if (loading || error) return <SessionStatus />;
  if (session?.user) return <MemberHome />;
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-white px-6 py-12 text-zinc-900">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Recorriendo.ar
      </h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="min-h-11 min-w-32 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
        >
          Login
        </Link>
        <Link
          href="/registro"
          className="min-h-11 min-w-32 rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
        >
          Registro
        </Link>
      </div>
    </main>
  );
}
