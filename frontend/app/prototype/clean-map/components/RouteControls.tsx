"use client";

import { useState } from "react";
import type { CleanKos, Destination } from "../../../../types/kos";
import {
  decodeEncodedPolyline,
  formatDistanceMeters,
  formatDuration,
} from "../../../../lib/kos-helpers";
import styles from "./RouteControls.module.css";

type RouteControlsProps = {
  kos: CleanKos;
  destinations: Destination[];
  onShowRoute: (coords: Array<[number, number]>) => void;
  onClearRoute: () => void;
};

export function RouteControls({
  kos,
  destinations,
  onShowRoute,
  onClearRoute,
}: RouteControlsProps) {
  const [selectedId, setSelectedId] = useState("");
  const [resultText, setResultText] = useState("");
  const [resultType, setResultType] = useState<"neutral" | "success" | "error">("neutral");
  const [loading, setLoading] = useState(false);

  async function handleShowRoute() {
    const selected = destinations.find((d) => d.id === selectedId);
    if (!selected) {
      setResultText("Pilih tujuan terlebih dahulu.");
      setResultType("error");
      return;
    }

    setLoading(true);
    setResultText("Menghitung rute...");
    setResultType("neutral");

    try {
      const res = await fetch("/api/directions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin: { lat: kos.lat, lon: kos.lon },
          destination: { lat: selected.lat, lon: selected.lon },
          travelMode: "WALK",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal menghitung rute");
      const routeData = data as {
        distanceMeters: number;
        duration: string;
        encodedPolyline: string;
      };
      const coords = decodeEncodedPolyline(routeData.encodedPolyline);
      onShowRoute(coords);
      setResultText(
        `Jarak ${formatDistanceMeters(routeData.distanceMeters)} | jalan kaki ${formatDuration(routeData.duration)}`,
      );
      setResultType("success");
    } catch (err) {
      setResultText(
        err instanceof Error ? err.message : "Gagal menghitung rute.",
      );
      setResultType("error");
    } finally {
      setLoading(false);
    }
  }

  function handleClearRoute() {
    onClearRoute();
    setResultText("Rute dihapus.");
    setResultType("neutral");
  }

  return (
    <section className={styles.section}>
      <div className={styles.label}>Rute ke kampus</div>
      <select
        className={styles.select}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={loading}
      >
        {destinations.length === 0 ? (
          <option value="">Tujuan belum tersedia</option>
        ) : (
          <>
            <option value="">Pilih tujuan</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </>
        )}
      </select>
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.routeButton}
          onClick={handleShowRoute}
          disabled={loading}
        >
          Tampilkan rute
        </button>
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClearRoute}
          disabled={loading}
        >
          Hapus
        </button>
      </div>
      {resultText && (
        <div
          className={`${styles.result} ${
            resultType === "error"
              ? styles.resultError
              : resultType === "success"
                ? styles.resultSuccess
                : ""
          }`}
        >
          {resultText}
        </div>
      )}
    </section>
  );
}
