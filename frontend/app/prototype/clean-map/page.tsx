"use client";

import { useEffect, useRef, useState } from "react";
import type { CleanKos, Destination, RawDestination } from "../../../types/kos";
import { normalizeCleanKos, toNumber } from "../../../lib/kos-helpers";
import MapView from "./MapView";
import type { MapViewHandle } from "./MapView";
import type { FilterState } from "./components/filter-types";
import { DEFAULT_FILTER_STATE } from "./components/filter-types";
import {
  Sidebar,
  PreviewList,
  LoadingState,
  ErrorState,
  EmptyState,
  FilterPanel,
} from "./components";
import styles from "./page.module.css";

export default function CleanMapPage() {
  const [items, setItems] = useState<CleanKos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [campusList, setCampusList] = useState<string[]>([]);
  const mapViewRef = useRef<MapViewHandle>(null);

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

  // Extract unique campus building names from master-uns data
  useEffect(() => {
    async function loadCampusList() {
      try {
        const response = await fetch("/api/master-uns", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const campuses = (Array.isArray(payload) ? payload : [])
          .map((item: Record<string, unknown>) => String(item.nama ?? "").trim())
          .filter((name: string) => name.length > 0);
        setCampusList([...new Set(campuses)].sort());
      } catch {
        setCampusList([]);
      }
    }
    loadCampusList();
  }, []);

  return (
    <div className={styles.page}>
      <MapView ref={mapViewRef} items={items} destinations={destinations} />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)}>
        <FilterPanel
          filterState={filterState}
          setFilterState={setFilterState}
          campusList={campusList}
        />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && items.length === 0 && <EmptyState />}
        {!loading && items.length > 0 && (
          <PreviewList
            items={items}
            expanded={previewExpanded}
            onToggleExpand={() => setPreviewExpanded((v) => !v)}
            onItemClick={(kos) => mapViewRef.current?.flyTo(kos)}
          />
        )}
      </Sidebar>
    </div>
  );
}
