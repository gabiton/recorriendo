"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useSession } from "../components/session-provider";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const { session } = useSession();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-white px-6 py-12 text-zinc-900">
      <Link href="/" className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Recorriendo.ar
      </Link>
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <h1 id="login-title" className="mb-6 text-center text-2xl font-semibold">
          Login
        </h1>
        <form
          className="flex flex-col gap-5"
          aria-busy={pending}
          onSubmit={async (event) => {
            event.preventDefault();
            if (inFlight.current) return;
            const form = new FormData(event.currentTarget);
            inFlight.current = true; setPending(true); setMessage("");
            try {
              const response = await fetch("/api/login", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.get("email"), password: form.get("password"), csrf: session?.csrf }),
              });
              const data = await response.json();
              if (!response.ok) {
                setMessage(data.message || "No pudimos iniciar sesión.");
                return;
              }
              window.location.replace("/");
            } catch {
              setMessage("No pudimos conectar con el servidor. Intentá nuevamente.");
            } finally { inFlight.current = false; setPending(false); }
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={pending}
              required
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={pending}
              required
              className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
          >
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </button>
          <p role="status" className="text-center text-sm text-zinc-600">{message}</p>
        </form>
        <Link href="/" className="mt-4 block text-center text-sm underline underline-offset-4">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
