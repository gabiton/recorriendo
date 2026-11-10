"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "./session-provider";
import type { SavedPlace } from "./map";

type Category = { id: number; name: string; is_default: number };
type Location = { name: string; latitude: number; longitude: number };
type Flow = "manual" | "link";

function parseCoordinates(value: string): { latitude: number; longitude: number } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("Las coordenadas deben estar dentro del rango válido de latitud y longitud.");
  }
  return { latitude, longitude };
}

export default function PlaceManager({ initialLocation, editingPlace, onPlacesChange, onPickChange, onLocationSelect, onClose }: {
  initialLocation: Location | null;
  editingPlace: SavedPlace | null;
  onPlacesChange: (places: SavedPlace[]) => void;
  onPickChange: (picking: boolean) => void;
  onLocationSelect: (location: Location | null) => void;
  onClose: () => void;
}) {
  const { session, refresh } = useSession();
  const [flow, setFlow] = useState<Flow>("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(editingPlace?.title || "");
  const [videoUrl, setVideoUrl] = useState("");
  const [links, setLinks] = useState<string[]>(editingPlace?.links || []);
  const [linkDraft, setLinkDraft] = useState("");
  const [locationQuery, setLocationQuery] = useState(editingPlace?.location_name || "");
  const [locations, setLocations] = useState<Location[]>([]);
  const location = initialLocation;
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [linkDebug, setLinkDebug] = useState<Record<string, unknown> | null>(null);
  const [duplicates, setDuplicates] = useState<{ id: number; title: string }[]>([]);
  const requestLock = useRef(false);


  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/categories", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { await refresh(); return; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setCategories(data.categories);
          setSelectedCategories(editingPlace
            ? editingPlace.categories.map(category => category.id)
            : (data.categories as Category[]).filter(category => category.is_default).map(category => category.id));
        }
      } catch { if (!controller.signal.aborted) setError("No pudimos cargar las categorías."); }
    })();
    return () => controller.abort();
  }, [editingPlace, refresh]);

  async function readLocationResults(response: Response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No pudimos buscar la ubicación.");
    setLocations(data.results);
    setMessage(data.message || (data.results.length ? "Elegí la ubicación correcta." : "No encontramos una ubicación. Podés marcarla en el mapa."));
    if (!data.results.length) onPickChange(true);
  }

  async function searchLocation() {
    const query = locationQuery.trim();
    if (requestLock.current || query.length < 3) return;
    setError(""); setMessage(""); setLocations([]); setLinkDebug(null);
    try {
      const coordinates = parseCoordinates(query);
      if (coordinates) {
        const point = { name: `Punto (${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)})`, ...coordinates };
        onLocationSelect(point);
        onPickChange(false);
        setMessage("Coordenadas reconocidas. El pin está en el mapa y podés arrastrarlo para ajustar el punto.");
        return;
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Las coordenadas no son válidas.");
      return;
    }
    if (query.length < 3) return;
    requestLock.current = true; setLoading(true); setError(""); setMessage(""); setLocations([]); setLinkDebug(null); onLocationSelect(null);
    try {
      const response = await fetch("/api/location-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, csrf: session?.csrf }) });
      await readLocationResults(response);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos buscar la ubicación."); onPickChange(true); }
    finally { requestLock.current = false; setLoading(false); }
  }

  async function detectFromLink() {
    const url = videoUrl.trim();
    if (requestLock.current || !url) return;
    requestLock.current = true; setLoading(true); setError(""); setMessage(""); setLocations([]); setLinkDebug(null); onLocationSelect(null);
    try {
      const response = await fetch("/api/link-location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, csrf: session?.csrf }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos revisar el enlace.");
      setLinkDebug(data.debug && typeof data.debug === "object" ? data.debug : null);
      setLinks(current => current.includes(data.url) ? current : [...current, data.url]);
      setLocations(data.results || []);
      setMessage(data.message);
      if (!data.results?.length) onPickChange(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos revisar el enlace."); }
    finally { requestLock.current = false; setLoading(false); }
  }

  async function save(permitDuplicate = false) {
    if (requestLock.current || !location) return;
    requestLock.current = true; setBusy(true); setError(""); setMessage("");
    const body = new FormData();
    body.set("csrf", session?.csrf || ""); body.set("title", title.trim());
    if (editingPlace) body.set("id", String(editingPlace.id));
    body.set("location_name", location.name); body.set("latitude", String(location.latitude)); body.set("longitude", String(location.longitude));
    body.set("category_ids", JSON.stringify(selectedCategories)); body.set("links", JSON.stringify(links));
    if (permitDuplicate) body.set("allow_duplicate", "1");
    for (const photo of photos) body.append("photos[]", photo);
    try {
      const response = await fetch("/api/places", { method: "POST", body });
      const data = await response.json();
      if (response.status === 409) { setDuplicates(data.duplicates || []); setError(data.message); return; }
      if (!response.ok) throw new Error(data.message || "No pudimos guardar el lugar.");
      const placesResponse = await fetch("/api/places", { cache: "no-store" });
      if (placesResponse.ok) onPlacesChange((await placesResponse.json()).places);
      setMessage(data.message); onPickChange(false); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos guardar el lugar."); }
    finally { requestLock.current = false; setBusy(false); }
  }

  return <aside aria-label={editingPlace ? "Editar lugar" : "Agregar lugar"} className="absolute inset-2 z-20 flex max-h-[calc(100svh-6rem)] w-auto flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-xl sm:inset-4 sm:max-h-[calc(100svh-7rem)] md:inset-y-4 md:left-4 md:right-auto md:w-[26rem] md:max-h-none">
    <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4">
      <div><h2 className="text-lg font-semibold">{editingPlace ? "Editar lugar" : "Agregar lugar"}</h2><p className="mt-1 text-sm text-zinc-600">{editingPlace ? "Actualizá los datos del lugar." : "Guardalo para conocerlo."}</p></div>
      <button type="button" aria-label="Cerrar" onClick={() => { onPickChange(false); onClose(); }} className="min-h-11 min-w-11 rounded border border-zinc-300 text-lg">×</button>
    </header>
    <div className="flex gap-2 border-b border-zinc-200 p-3" role="tablist" aria-label="Forma de agregar lugar">
      {(["manual", "link"] as const).map(value => <button key={value} type="button" role="tab" aria-selected={flow === value} onClick={() => { setFlow(value); setError(""); setMessage(""); }} className={`min-h-10 flex-1 rounded px-2 text-sm ${flow === value ? "bg-zinc-900 text-white" : "border border-zinc-300"}`}>{value === "manual" ? "Agregar manualmente" : "Desde un reel o video"}</button>)}
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {flow === "link" && <section className="space-y-3 rounded border border-zinc-200 p-3">
        <label htmlFor="video-link" className="block text-sm font-medium">Link del video o reel</label>
        <input id="video-link" type="url" inputMode="url" placeholder="https://..." value={videoUrl} maxLength={2048} onChange={event => setVideoUrl(event.target.value)} className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        <button type="button" disabled={loading || !videoUrl.trim()} onClick={() => void detectFromLink()} className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50">{loading ? "Buscando información pública..." : "Detectar ubicación"}</button>
      </section>}

      <div className="space-y-2"><label htmlFor="place-title" className="block text-sm font-medium">Título *</label>
        <input id="place-title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej. Cataratas del Iguazú" className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>

      <section className={`space-y-3 rounded border border-zinc-200 p-3 transition-opacity duration-150 ${loading ? "opacity-50" : "opacity-100"}`} aria-busy={loading}>
        <div><h3 className="text-sm font-medium">Ubicación *</h3><p className="mt-1 text-xs text-zinc-600">Buscala por nombre o marcá el punto en el mapa.</p></div>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void searchLocation(); }}>
          <input aria-label="Buscar ubicación o pegar coordenadas" value={locationQuery} onChange={event => setLocationQuery(event.target.value)} maxLength={150} placeholder="Ciudad, parque o latitud, longitud..." className="min-h-11 min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button disabled={loading || locationQuery.trim().length < 3} className="min-h-11 rounded border border-zinc-300 px-3 text-sm disabled:opacity-50">Buscar</button>
        </form>
        {locations.length > 0 && <ul className="space-y-2" aria-label="Resultados de ubicación">{locations.map(result => <li key={`${result.latitude}:${result.longitude}`}>
          <button type="button" aria-pressed={location?.latitude === result.latitude && location?.longitude === result.longitude} onClick={() => { setLocationQuery(result.name); onPickChange(false); onLocationSelect(result); setMessage("Ubicación confirmada."); }} className={`min-h-11 w-full rounded border p-2 text-left text-sm ${location?.latitude === result.latitude && location?.longitude === result.longitude ? "border-zinc-500 bg-zinc-200" : "border-zinc-300 hover:bg-zinc-50"}`}>{result.name}</button>
        </li>)}</ul>}
        {location && <p role="status" className="break-words rounded bg-zinc-100 p-2 text-sm">Ubicación: <strong>{location.name}</strong> · {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}. Podés arrastrar el pin del mapa para ajustar el punto.</p>}
        <button type="button" onClick={() => { onLocationSelect(null); onPickChange(true); setMessage("Tocá el punto exacto en el mapa para confirmar la ubicación."); }} className="text-sm underline underline-offset-4">Marcar un punto en el mapa</button>
      </section>

      <section className="space-y-2"><h3 className="text-sm font-medium">Categorías</h3>
        {categories.length ? <ul className="flex flex-wrap gap-2">{categories.map(category => <li key={category.id}><label className="flex min-h-10 items-center gap-2 rounded border border-zinc-300 px-3 text-sm"><input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={event => setSelectedCategories(current => event.target.checked ? [...current, category.id] : current.filter(id => id !== category.id))} />{category.name}</label></li>)}</ul> : <p className="text-sm text-zinc-600">Las categorías están cargando o todavía no hay categorías.</p>}
      </section>

      <section className="space-y-2"><label htmlFor="place-photos" className="block text-sm font-medium">Fotos</label>
        {editingPlace?.photos.length ? <ul className="flex flex-wrap gap-2">{editingPlace.photos.map(photo => <li key={photo}><img src={photo} alt={`Foto de ${editingPlace.title}`} className="h-14 w-14 rounded object-cover" /></li>)}</ul> : null}
        <input id="place-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { const files = Array.from(event.target.files || []); if (files.some(file => file.size > 5 * 1024 * 1024)) { setError("Cada foto puede pesar hasta 5 MB."); event.target.value = ""; return; } if (files.length + (editingPlace?.photos.length || 0) > 8) { setError("El lugar puede tener hasta 8 fotos en total."); event.target.value = ""; return; } setError(""); setPhotos(files); }} className="block w-full text-sm" />
        <p className="text-xs text-zinc-500">Hasta 8 fotos JPG, PNG o WebP, de hasta 5 MB cada una.</p>
        {photos.length > 0 && <ul className="space-y-1 text-sm">{photos.map(file => <li key={`${file.name}:${file.size}`} className="truncate">{file.name}</li>)}</ul>}
      </section>

      {flow === "manual" && <section className="space-y-3 rounded border border-zinc-200 p-3"><h3 className="text-sm font-medium">Links de referencia</h3>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const url = linkDraft.trim(); if (url && !links.includes(url)) setLinks(current => [...current, url]); setLinkDraft(""); }}>
          <input type="url" aria-label="Link de referencia" value={linkDraft} onChange={event => setLinkDraft(event.target.value)} placeholder="https://..." className="min-h-11 min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button disabled={!linkDraft.trim()} className="min-h-11 rounded border border-zinc-300 px-3 text-sm">Agregar</button>
        </form>
        {links.length > 0 && <ul className="space-y-1 text-sm">{links.map(url => <li key={url} className="flex min-w-0 items-center gap-2"><a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline">{url}</a><button type="button" aria-label="Quitar link" onClick={() => setLinks(current => current.filter(link => link !== url))} className="min-h-9 px-2">×</button></li>)}</ul>}
      </section>}

      {flow === "link" && <section className="space-y-3 rounded border border-zinc-200 p-3"><h3 className="text-sm font-medium">Links relacionados</h3>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const url = linkDraft.trim(); if (url && !links.includes(url)) setLinks(current => [...current, url]); setLinkDraft(""); }}>
          <input type="url" aria-label="Agregar otro link relacionado" value={linkDraft} onChange={event => setLinkDraft(event.target.value)} placeholder="https://..." className="min-h-11 min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button disabled={!linkDraft.trim()} className="min-h-11 rounded border border-zinc-300 px-3 text-sm">Agregar</button>
        </form>
        <ul className="space-y-1 text-sm">{links.map(url => <li key={url} className="flex min-w-0 items-center gap-2"><a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline">{url}</a><button type="button" aria-label="Quitar link" onClick={() => setLinks(current => current.filter(link => link !== url))} className="min-h-9 px-2">×</button></li>)}</ul>
      </section>}
      {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
      {flow === "link" && linkDebug && <details className="hidden"><summary>Diagnóstico de detección</summary><pre>{JSON.stringify(linkDebug, null, 2)}</pre></details>}
      {error && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p>{duplicates.map(place => <p key={place.id}>Lugar cercano: {place.title}</p>)}{duplicates.length > 0 && <button type="button" disabled={busy} onClick={() => void save(true)} className="min-h-10 rounded border border-red-300 px-3 text-red-800">Guardar igualmente</button>}</div>}
    </div>
    <footer className="flex gap-3 border-t border-zinc-200 p-4"><button type="button" disabled={busy || loading || !title.trim() || !location || duplicates.length > 0} onClick={() => void save()} className="min-h-11 flex-1 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Guardando..." : editingPlace ? "Guardar cambios" : "Guardar en Quiero conocer"}</button></footer>
  </aside>;
}
