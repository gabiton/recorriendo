"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "./session-provider";

export type Category = { id: number; name: string; color: string; is_default: number };

export default function Categories({ open, onCategoriesChange, visibleCategoryIds, onToggleCategory }: {
  open: boolean;
  onCategoriesChange: (categories: Category[], addedId?: number) => void;
  visibleCategoryIds: number[] | null;
  onToggleCategory: (id: number, checked: boolean) => void;
}) {
  const { session, refresh } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { await refresh(); return; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setCategories(data.categories); onCategoriesChange(data.categories); setLoadError(""); }
      } catch {
        if (!controller.signal.aborted) setLoadError("No pudimos cargar tus categorías.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, onCategoriesChange, refresh]);

  async function saveColor(categoryId: number, nextColor: string) {
    const updated = categories.map(category => category.id === categoryId ? { ...category, color: nextColor } : category);
    setCategories(updated); onCategoriesChange(updated);
    try {
      const response = await fetch("/api/categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoryId, color: nextColor, csrf: session?.csrf }),
      });
      if (response.status === 401) { await refresh(); return; }
      if (!response.ok) { setError("No pudimos guardar el color de la categoría."); return; }
      setError(""); setMessage("Color de categoría guardado.");
    } catch { setError("No pudimos conectar para guardar el color."); }
  }

  return <aside id="categories-panel" aria-labelledby="categories-title" className={`${open ? "" : "hidden"} max-h-[55svh] shrink-0 overflow-y-auto border-b border-zinc-200 bg-white p-4 md:max-h-none md:w-72 md:border-r md:border-b-0`}>
    <h2 id="categories-title" className="font-semibold">Mis categorías</h2>
    <p className="mt-1 text-sm text-zinc-600">Activá las categorías que querés ver en el mapa.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Cargando categorías...</p> : loadError ? <div className="mt-4 text-sm">
      <p role="alert">{loadError}</p><button className="mt-2 underline" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Reintentar</button>
    </div> : <>
      <ul className="mt-4 space-y-2">
        {categories.map(category => <li key={category.id} className="flex items-center gap-2 rounded border border-zinc-200 px-2 py-2 text-sm">
          <input type="checkbox" aria-label={`Mostrar lugares de ${category.name}`} checked={visibleCategoryIds === null || visibleCategoryIds.includes(category.id)} onChange={event => onToggleCategory(category.id, event.target.checked)} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{category.name}{Boolean(category.is_default) && <span className="ml-1 text-xs text-zinc-500">(por defecto)</span>}</span>
          <input type="color" aria-label={`Color de ${category.name}`} value={category.color || "#3b82f6"} onChange={event => void saveColor(category.id, event.target.value)} className="h-8 w-9 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" />
        </li>)}
      </ul>
      <form className="mt-6 space-y-3" onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current) return;
        const cleanName = name.trim();
        if (!cleanName) { setError("Ingresá un nombre para la categoría."); return; }
        inFlight.current = true; setPending(true); setError(""); setMessage("");
        try {
          const response = await fetch("/api/categories", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: cleanName, color, csrf: session?.csrf }),
          });
          if (response.status === 401) { await refresh(); return; }
          const data = await response.json();
          if (!response.ok) { setError(data.message || "No pudimos crear la categoría."); return; }
          const updated = [...categories, data.category].sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, "es"));
          setCategories(updated); onCategoriesChange(updated, data.category.id);
          setName(""); setMessage("Categoría creada.");
        } catch { setError("No pudimos conectar. Intentá nuevamente."); }
        finally { inFlight.current = false; setPending(false); }
      }}>
        <label htmlFor="category-name" className="block text-sm font-medium">Nueva categoría</label>
        <input id="category-name" name="name" required maxLength={100} disabled={pending} value={name}
          onChange={event => { setName(event.target.value); setError(""); setMessage(""); }}
          aria-invalid={Boolean(error)} aria-describedby={error ? "category-error" : undefined}
          placeholder="Por ejemplo, Escapadas" className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        <label htmlFor="new-category-color" className="flex items-center justify-between gap-3 text-sm">Color de la categoría
          <input id="new-category-color" type="color" disabled={pending} value={color} onChange={event => setColor(event.target.value)} className="h-9 w-11 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" />
        </label>
        <button disabled={pending} className="min-h-11 w-full rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50">{pending ? "Guardando..." : "Agregar categoría"}</button>
        {error && <p id="category-error" role="alert" className="text-sm text-red-700">{error}</p>}
        <p role="status" className="text-sm text-zinc-600">{message}</p>
      </form>
    </>}
  </aside>;
}
