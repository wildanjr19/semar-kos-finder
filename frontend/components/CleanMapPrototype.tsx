"use client";

import { useEffect, useState, useCallback } from "react";
import type { CleanKos, Destination, RawDestination } from "../../types/kos";
import { normalizeCleanKos, toNumber } from "../../lib/kos-helpers";
import MapView from "../app/prototype/clean-map/MapView";
import {
  Sidebar,
  StatsBar,
  PreviewList,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../app/prototype/clean-map/components";

export default function CleanMapPrototype() {
  const [items, setItems] = useState<CleanKos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").default.Map | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadKos() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/kos", { cache: "no-store" });
        if (!response.ok) throw new Error(`Gagal memuat data kos (${response.status})`);
        const payload = await response.json();
        const nextItems = (Array.isArray(payload) ? payload : [])
          .map(normalizeCleanKos)
          .filter((item): item is CleanKos => item !== null);
        if (!cancelled) setItems(nextItems);
      } catch (loadError) {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data kos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadKos();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDestinations() {
      try {
        const response = await fetch("/api/master-uns", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const nextDestinations = (Array.isArray(payload) ? payload : [])
          .map((item: RawDestination) => ({
            id: String(item.id ?? ""),
            nama: String(item.nama ?? "Tanpa nama"),
            lat: toNumber(item.lat),
            lon: toNumber(item.lon),
          }))
          .filter((item) => item.id && Number.isFinite(item.lat) && Number.isFinite(item.lon));
        if (!cancelled) setDestinations(nextDestinations);
      } catch {
        if (!cancelled) setDestinations([]);
      }
    }

    loadDestinations();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFlyTo = useCallback(
    (item: CleanKos) => {
      mapInstance?.flyTo({ center: [item.lon, item.lat], zoom: 16, duration: 700 });
    },
    [mapInstance],
  );

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "#e2e8f0",
      }}
    >
      <MapView items={items} destinations={destinations} onMapReady={setMapInstance} />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)}>
        <StatsBar items={items} />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && items.length === 0 && <EmptyState />}
        {!loading && items.length > 0 && (
          <PreviewList items={items} onItemClick={handleFlyTo} />
        )}
      </Sidebar>
    </div>
  );
}
