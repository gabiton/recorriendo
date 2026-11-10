"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export default function RegisterPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const [message, setMessage] = useState("");
  const mismatch = submitted && password !== confirmation;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-white px-6 py-12 text-zinc-900">
      <Link href="/" className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Recorriendo.ar
      </Link>
      <section className="w-full max-w-sm" aria-labelledby="register-title">
        <h1 id="register-title" className="mb-6 text-center text-2xl font-semibold">
          Registro
        </h1>
        <form
          hidden={success}
          aria-busy={pending}
          className={success ? "hidden" : "flex flex-col gap-5"}
          onChange={() => { setMessage(""); setErrors({}); }}
          onSubmit={async (event) => {
            event.preventDefault();
            if (inFlight.current) return;
            setSubmitted(true);
            setErrors({});
            setMessage("");
            if (password !== confirmation) {
              setMessage("");
              event.currentTarget.querySelector<HTMLInputElement>("#password-confirmation")?.focus();
              return;
            }
            const form = event.currentTarget;
            const email = String(new FormData(form).get("email") ?? "");
            inFlight.current = true;
            setPending(true);
            try {
              const response = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, password_confirmation: confirmation }),
              });
              const data = await response.json();
              if (!response.ok) {
                setErrors(data.errors ?? {});
                setMessage(data.message || "No pudimos crear la cuenta. Intentá nuevamente.");
                const firstField = Object.keys(data.errors ?? {})[0];
                const fieldId = firstField === "password_confirmation" ? "password-confirmation" : firstField;
                if (["email", "password", "password-confirmation"].includes(fieldId)) {
                  requestAnimationFrame(() => form.querySelector<HTMLInputElement>("#" + fieldId)?.focus());
                }
                return;
              }
              setSuccess(true);
              setPassword("");
              setConfirmation("");
              setMessage("Tu cuenta fue creada correctamente.");
              form.reset();
            } catch {
              setMessage("No pudimos conectar con el servidor. Intentá nuevamente.");
            } finally {
              inFlight.current = false;
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending} className="contents">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                required
                className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              />
              {errors.email && <p id="email-error" role="alert" className="text-sm text-red-600">{errors.email}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="password-help"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              />
              <p id="password-help" className="text-sm text-zinc-600">{errors.password || "Mínimo 8 caracteres."}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password-confirmation" className="text-sm font-medium">
                Repetir contraseña
              </label>
              <input
                id="password-confirmation"
                name="password-confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                aria-invalid={mismatch || Boolean(errors.password_confirmation)}
                aria-describedby={mismatch || errors.password_confirmation ? "password-error" : undefined}
                className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              />
              {(mismatch || errors.password_confirmation) && (
                <p id="password-error" role="alert" className="text-sm text-red-600">
                  Las contraseñas no coinciden.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
              disabled={pending}
            >
              {pending ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </fieldset>
          <p role="status" className="text-center text-sm text-zinc-600">{message}</p>
        </form>
        {success && (
          <div role="status" className="text-center text-sm text-zinc-700">
            <p>{message}</p>
            <Link href="/login" className="mt-4 inline-block underline underline-offset-4">Iniciar sesión</Link>
          </div>
        )}
        <Link href="/" className="mt-4 block text-center text-sm underline underline-offset-4">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
