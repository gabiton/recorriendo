"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "./session-provider";
import Categories from "./categories";
import type { Category } from "./categories";
import PlaceManager from "./place-manager";
import type { SavedPlace } from "./map";

const TravelMap = dynamic(() => import("./map"), { ssr: false, loading: () => <p role="status" className="flex flex-1 items-center justify-center bg-zinc-100">Cargando mapa...</p> });

function getMediaEmbed(link: string): { kind: "instagram" | "youtube"; src: string } | null {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "instagram.com") {
      const match = url.pathname.match(/^\/(reels?|p|tv)\/([^/]+)/i);
      if (match) {
        const path = match[1].toLowerCase().startsWith("reel") ? "reel" : match[1].toLowerCase();
        return { kind: "instagram", src: `https://www.instagram.com/${path}/${match[2]}/embed/` };
      }
    }

    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else videoId = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || "";
    }
    if (/^[\w-]{11}$/.test(videoId)) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${videoId}` };
  } catch {
    return null;
  }
  return null;
}

export default function MemberHome() {
  const { session } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<number[] | null>(null);
  const [placeManagerOpen, setPlaceManagerOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [pendingPlace, setPendingPlace] = useState<{name:string; latitude:number; longitude:number} | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [placesError, setPlacesError] = useState("");
  const [placesAttempt, setPlacesAttempt] = useState(0);
  const handleCategoriesChange = useCallback((updated: Category[], addedId?: number) => {
    setCategories(updated);
    setPlaces(current => current.map(place => ({
      ...place,
      categories: place.categories.map(placeCategory => {
        const category = updated.find(item => item.id === placeCategory.id);
        return category ? { ...placeCategory, color: category.color } : placeCategory;
      }),
    })));
    setVisibleCategoryIds(current => current === null
      ? updated.map(category => category.id)
      : addedId ? Array.from(new Set([...current, addedId])) : current.filter(id => updated.some(category => category.id === id)));
  }, []);
  const toggleCategory = useCallback((id: number, checked: boolean) => {
    setVisibleCategoryIds(current => {
      const visible = current ?? categories.map(category => category.id);
      return checked ? Array.from(new Set([...visible, id])) : visible.filter(categoryId => categoryId !== id);
    });
  }, [categories]);
  const visiblePlaces = visibleCategoryIds === null ? places : places.filter(place => place.categories.some(category => visibleCategoryIds.includes(category.id)));
  function selectLocation(location: { name: string; latitude: number; longitude: number } | null) {
    setFocusLocation(location);
    setPendingPlace(location);
  }
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/places", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { await fetch("/api/session", { cache: "no-store" }); return; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setPlaces(data.places); setPlacesError(""); }
      } catch {
        if (!controller.signal.aborted) setPlacesError("No pudimos cargar tus lugares.");
      }
    })();
    return () => controller.abort();
  }, [placesAttempt]);
  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrf: session?.csrf }) });
      if (!response.ok) throw new Error();
      window.location.replace("/");
    } catch {
      setError("No pudimos cerrar sesión. Intentá nuevamente.");
      inFlight.current = false; setPending(false);
    }
  }
  return <main className="flex h-svh flex-col bg-white text-zinc-900">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Recorriendo.ar</h1>
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <button disabled={picking} onClick={() => { setEditingPlace(null); setPendingPlace(null); setFocusLocation(null); setPlaceManagerOpen(true); setSelectedPlace(null); }} className="min-h-11 rounded bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-700 disabled:opacity-50">Agregar lugar</button>
        <button aria-expanded={categoriesOpen} aria-controls="categories-panel" onClick={() => setCategoriesOpen(open => !open)} className="min-h-11 rounded border border-zinc-300 px-3 py-2 hover:bg-zinc-100">Categorías</button>
        <span className="max-w-40 truncate sm:max-w-64">{session?.user?.name || session?.user?.email}</span>
        <button disabled={pending} onClick={() => void logout()} className="min-h-11 shrink-0 rounded border border-zinc-300 px-3 py-2 hover:bg-zinc-100 disabled:opacity-50">{pending ? "Saliendo..." : "Cerrar sesión"}</button>
      </div>
    </header>
    {error && <p role="alert" className="px-4 py-2 text-sm text-red-700">{error}</p>}
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Categories open={categoriesOpen} onCategoriesChange={handleCategoriesChange} visibleCategoryIds={visibleCategoryIds} onToggleCategory={toggleCategory} />
      <TravelMap places={visiblePlaces} picking={picking} visibleCategoryIds={visibleCategoryIds} focusLocation={focusLocation} onDragLocation={(latitude, longitude) => {
        setFocusLocation(current => {
          if (!current) return current;
          const updated = { ...current, latitude, longitude };
          setPendingPlace(updated);
          return updated;
        });
        setPicking(false);
      }} onPick={picking ? (latitude, longitude) => {
        setPlaceManagerOpen(false); setPicking(false); setPendingPlace({ name: `Punto marcado (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, latitude, longitude }); setPlaceManagerOpen(true);
      } : undefined} onOpenPlace={setSelectedPlace} />
    </div>
    {placesError && <p role="alert" className="absolute right-3 bottom-3 z-10 rounded border border-zinc-300 bg-white p-3 text-sm">{placesError} <button className="underline" onClick={() => setPlacesAttempt(value => value + 1)}>Reintentar</button></p>}
    {placeManagerOpen && <PlaceManager key={editingPlace ? `edit-${editingPlace.id}` : "new-place"} initialLocation={pendingPlace} editingPlace={editingPlace} onPlacesChange={setPlaces} onPickChange={setPicking} onLocationSelect={selectLocation} onClose={() => { setPlaceManagerOpen(false); setPicking(false); setPendingPlace(null); setFocusLocation(null); setEditingPlace(null); }} />}
    {selectedPlace && <aside aria-label="Detalle del lugar" className="absolute inset-x-2 bottom-2 z-10 max-h-[70svh] overflow-y-auto rounded-lg border border-zinc-300 bg-white p-4 shadow-xl sm:inset-x-4 md:inset-y-4 md:right-4 md:left-auto md:bottom-4 md:w-[min(600px,calc(100vw-2rem))] md:max-h-none">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{selectedPlace.title}</h2><p className="mt-1 text-sm text-zinc-600">{selectedPlace.location_name}</p></div><button aria-label="Cerrar" onClick={() => setSelectedPlace(null)} className="min-h-10 min-w-10 rounded border border-zinc-300">×</button></div>
      <button type="button" onClick={() => { setEditingPlace(selectedPlace); const location = { name: selectedPlace.location_name, latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }; setPendingPlace(location); setFocusLocation(location); setSelectedPlace(null); setPlaceManagerOpen(true); }} className="mt-3 min-h-10 rounded border border-zinc-300 px-3 text-sm hover:bg-zinc-100">Editar lugar</button>
      <div className="mt-4 flex flex-wrap gap-2">{selectedPlace.categories.map(category => <span key={category.id} className="rounded border border-zinc-300 px-2 py-1 text-xs">{category.name}</span>)}</div>
      {selectedPlace.photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2">{selectedPlace.photos.map(photo => <img key={photo} src={photo} alt={`Foto de ${selectedPlace.title}`} loading="lazy" className="aspect-square w-full rounded object-cover" />)}</div>}
      {selectedPlace.links.length > 0 && <div className="mt-4 space-y-5">{selectedPlace.links.map(link => {
        const embed = getMediaEmbed(link);
        return <div key={link} className="space-y-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className="block break-all text-sm underline">{link}</a>
          {embed?.kind === "instagram" && <iframe title="Publicación de Instagram" src={embed.src} loading="lazy" className="mx-auto block w-full max-w-[450px] overflow-hidden rounded border-0" style={{ height: 560 }} allow="encrypted-media; picture-in-picture" allowFullScreen />}
          {embed?.kind === "youtube" && <div className="aspect-video w-full overflow-hidden rounded"><iframe title="Video de YouTube" src={embed.src} loading="lazy" className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}
        </div>;
      })}</div>}
    </aside>}
  </main>;
}
