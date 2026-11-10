"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type SavedPlace = { id: number; title: string; location_name: string; latitude: number; longitude: number; categories: {id:number; name:string; color?:string}[]; links: string[]; photos: string[] };

function localizeLabelExpression(expression: unknown): unknown {
  if (!Array.isArray(expression)) return expression;

  const [operator, property, ...rest] = expression;
  if (operator === "literal") return expression;
  if (operator === "get" && ["name", "name_en", "name:latin"].includes(String(property))) {
    const original = ["get", property];
    const malvinas = [
      "in",
      ["downcase", ["to-string", original]],
      ["literal", ["falkland islands", "falkland island"]],
    ];
    const spanishName = ["coalesce", ["get", "name:es"], ["get", "name_es"], original];

    return ["case", malvinas, "Islas Malvinas", spanishName];
  }

  return [operator, ...[property, ...rest].map(localizeLabelExpression)];
}

export default function TravelMap({ places = [], picking = false, onPick, onOpenPlace, focusLocation, onDragLocation, visibleCategoryIds }: {
  places?: SavedPlace[]; picking?: boolean; onPick?: (latitude: number, longitude: number) => void;
  onOpenPlace?: (place: SavedPlace) => void;
  focusLocation?: { name: string; latitude: number; longitude: number } | null;
  onDragLocation?: (latitude: number, longitude: number) => void;
  visibleCategoryIds?: number[] | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const placesRef = useRef(places);
  const onPickRef = useRef(onPick);
  const onOpenPlaceRef = useRef(onOpenPlace);
  const onDragLocationRef = useRef(onDragLocation);
  const selectionMarkerRef = useRef<maplibregl.Marker | null>(null);
  useEffect(() => { placesRef.current = places; onPickRef.current = onPick; onOpenPlaceRef.current = onOpenPlace; onDragLocationRef.current = onDragLocation; }, [places, onPick, onOpenPlace, onDragLocation]);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map | undefined;
    let observer: ResizeObserver | undefined;
    try {
      maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
      map = new maplibregl.Map({
        container: container.current,
        center: [-64, -38.5], zoom: 3.4,
        style: "https://tiles.openfreemap.org/styles/liberty",
        locale: { "NavigationControl.ZoomIn": "Acercar", "NavigationControl.ZoomOut": "Alejar", "NavigationControl.ResetBearing": "Orientar al norte" },
      });
      mapRef.current = map;
      map.on("style.load", () => {
        for (const layer of map?.getStyle().layers ?? []) {
          const textField = (layer.layout as Record<string, unknown> | undefined)?.["text-field"];
          if (layer.type === "symbol" && textField !== undefined) {
            map?.setLayoutProperty(layer.id, "text-field", localizeLabelExpression(textField) as maplibregl.ExpressionSpecification);
          }
        }
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      map.on("click", event => {
        if (onPickRef.current) onPickRef.current(event.lngLat.lat, event.lngLat.lng);
      });
      map.on("error", () => setError("No se pudo cargar el mapa. Revisá tu conexión e intentá nuevamente."));
      observer = new ResizeObserver(() => map?.resize());
      observer.observe(container.current);
    } catch {
      // Report failure from the imperative WebGL initialization.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No se pudo iniciar el mapa. Verificá que tu navegador tenga WebGL habilitado.");
    }
    return () => { observer?.disconnect(); map?.remove(); mapRef.current = null; };
  }, [attempt]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];
    for (const place of places) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = "•";
      button.setAttribute("aria-label", place.title); button.title = place.title;
      const category = place.categories.find(item => visibleCategoryIds === null || visibleCategoryIds?.includes(item.id)) || place.categories[0];
      button.style.backgroundColor = category?.color || "#18181b";
      button.className = "grid h-8 w-8 place-items-center rounded-full border-2 border-white text-2xl leading-none text-white shadow-lg";
      button.addEventListener("click", event => { event.stopPropagation(); onOpenPlaceRef.current?.(place); });
      markers.push(new maplibregl.Marker({ element: button, anchor: "bottom" }).setLngLat([place.longitude, place.latitude]).addTo(map));
    }
    return () => { for (const marker of markers) marker.remove(); };
  }, [places, visibleCategoryIds]);
  useEffect(() => {
    if (!focusLocation) {
      selectionMarkerRef.current?.remove();
      selectionMarkerRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [focusLocation.longitude, focusLocation.latitude], zoom: 10, speed: 2.2, curve: 1.25, essential: true });
    if (!selectionMarkerRef.current) {
      const marker = new maplibregl.Marker({ color: "#dc2626", draggable: true })
        .setLngLat([focusLocation.longitude, focusLocation.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        onDragLocationRef.current?.(point.lat, point.lng);
      });
      selectionMarkerRef.current = marker;
    } else {
      selectionMarkerRef.current.setLngLat([focusLocation.longitude, focusLocation.latitude]);
    }
  }, [focusLocation]);
  return <section aria-label="Mapa de lugares" className="relative min-h-0 flex-1 bg-zinc-100">
    <div ref={container} style={{ position: "absolute", inset: 0 }} />
    {picking && <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm">Tocá el mapa para marcar la ubicación</div>}
    <button onClick={() => mapRef.current?.flyTo({ center: [-64, -38.5], zoom: 3.4 })} className="absolute top-3 left-3 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm">Ver Argentina</button>
    {error && <div role="alert" className="absolute top-16 right-14 left-3 max-w-sm rounded border border-zinc-300 bg-white p-4 text-sm text-zinc-900 shadow-sm">
      <p>{error}</p><button className="mt-3 underline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Reintentar</button>
    </div>}
  </section>;
}
