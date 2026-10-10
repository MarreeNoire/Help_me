"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

/** Carte Leaflet + OpenStreetMap. `points` doit être dans l'ordre chronologique. */
export default function LiveMap({
  points,
  className = "h-[45vh] w-full rounded-3xl",
}: {
  points: Point[];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const pointsRef = useRef<Point[]>(points);
  const fittedRef = useRef(false);

  const update = () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const pts = pointsRef.current;
    if (!L || !map || pts.length === 0) return;

    const last = pts[pts.length - 1];
    const latlng: [number, number] = [last.lat, last.lng];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: '<div class="pulse-dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      markerRef.current = L.marker(latlng, { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }

    const trail = pts.map((p) => [p.lat, p.lng]);
    if (!lineRef.current) {
      lineRef.current = L.polyline(trail, { color: "#ef4444", weight: 4, opacity: 0.7 }).addTo(map);
    } else {
      lineRef.current.setLatLngs(trail);
    }

    if (!fittedRef.current) {
      map.setView(latlng, 16);
      fittedRef.current = true;
    } else {
      map.panTo(latlng);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(el.current, { zoomControl: true }).setView([5.36, -4.0083], 12); // Abidjan par défaut
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      update();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      lineRef.current = null;
      fittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pointsRef.current = points;
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return <div ref={el} className={className} />;
}
