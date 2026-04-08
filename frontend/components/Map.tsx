"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

type Kos = {
  nama: string;
  lat: number;
  lon: number;
  harga: string;
  fasilitas: string;
  kontak: string;
};

type Destination = {
  id: string;
  nama: string;
  lat: number;
  lon: number;
};

type RawKos = {
  "Nama kos"?: string;
  "Harga"?: string;
  Fasilitas?: string;
  Narahubung?: string;
  lat?: string | number;
  long?: string | number;
};

type RawDestination = {
  id?: string;
  nama?: string;
  lat?: string | number;
  lon?: string | number;
};

type RouteApiResponse = {
  distanceMeters: number;
  duration: string;
  encodedPolyline: string;
};

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function decodeEncodedPolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lon += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coordinates.push([lon / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function formatDistanceMeters(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function formatDuration(durationValue: string): string {
  const seconds = Number.parseInt(durationValue.replace("s", ""), 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return durationValue;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }

  if (minutes > 0) {
    return `${minutes} menit`;
  }

  return `${seconds} detik`;
}

type ParsedContact = {
  href: string | null;
  label: string;
};

// clickable
function normalizeWaHref(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    if (/wa\.me\//i.test(trimmed)) {
      return trimmed;
    }

    const phoneMatch = trimmed.match(/https?:\/\/(\d{8,15})\/?/i);
    if (phoneMatch?.[1]) {
      return `https://wa.me/${phoneMatch[1]}`;
    }

    return trimmed;
  }

  const phoneOnlyMatch = trimmed.match(/^\d{8,15}$/);
  if (phoneOnlyMatch) {
    return `https://wa.me/${trimmed}`;
  }

  return null;
}

function parseContact(raw: string): ParsedContact {
  const cleaned = raw.trim();
  if (!cleaned || cleaned === "-") {
    return { href: null, label: "-" };
  }

  const parts = cleaned.match(/^(\S+)(?:\s*\(([^)]+)\))?$/);
  const rawUrl = parts?.[1] ?? cleaned;
  const name = parts?.[2]?.trim();
  const href = normalizeWaHref(rawUrl);

  if (href) {
    return {
      href,
      label: name ? `${href} (${name})` : href,
    };
  }

  return { href: null, label: cleaned };
}

export default function Map() {
  const [data, setData] = useState<Kos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const routeSourceId = "route-source";
  const routeLayerId = "route-layer";

  const clearRoute = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (map.getLayer(routeLayerId)) {
      map.removeLayer(routeLayerId);
    }

    if (map.getSource(routeSourceId)) {
      map.removeSource(routeSourceId);
    }
  };

  const drawRoute = (coordinates: Array<[number, number]>) => {
    const map = mapRef.current;
    if (!map || coordinates.length < 2) {
      return;
    }

    const routeFeature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    };

    const source = map.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(routeFeature as never);
    } else {
      map.addSource(routeSourceId, {
        type: "geojson",
        data: routeFeature as never,
      });

      map.addLayer({
        id: routeLayerId,
        type: "line",
        source: routeSourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
    }

    const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
    coordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 60, duration: 900, maxZoom: 15 });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [110.856, -7.559],
      zoom: 14,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    fetch("/data/data_kost_geo.json")
      .then((res) => res.json())
      .then((res: RawKos[]) => {
        const mapped = res
          .map((item) => ({
            nama: item["Nama kos"] ?? "Tanpa Nama",
            lat: toNumber(item.lat),
            lon: toNumber(item.long),
            harga: item["Harga"] ?? "-",
            fasilitas: item["Fasilitas"] ?? "-",
            kontak: item["Narahubung"] ?? "-",
          }))
          .filter(
            (item) => Number.isFinite(item.lat) && Number.isFinite(item.lon),
          );

        setData(mapped);
      });
  }, []);

  useEffect(() => {
    fetch("/data/master_uns.json")
      .then((res) => res.json())
      .then((res: RawDestination[]) => {
        const mapped = res
          .map((item) => ({
            id: item.id ?? "",
            nama: item.nama ?? "Tanpa Nama",
            lat: toNumber(item.lat),
            lon: toNumber(item.lon),
          }))
          .filter(
            (item) =>
              item.id.trim().length > 0 &&
              Number.isFinite(item.lat) &&
              Number.isFinite(item.lon),
          );

        setDestinations(mapped);
      });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());

    markersRef.current = data.map((kos) => {
      const popupNode = document.createElement("div");
      popupNode.style.maxWidth = "280px";

      const title = document.createElement("strong");
      title.textContent = kos.nama;

      const harga = document.createElement("div");
      harga.textContent = `Harga: ${kos.harga}`;

      const fasilitas = document.createElement("div");
      fasilitas.textContent = `Fasilitas: ${kos.fasilitas}`;

      const kontak = document.createElement("div");
      const contactLabel = document.createElement("span");
      contactLabel.textContent = "Kontak: ";

      const parsedContact = parseContact(kos.kontak);
      if (parsedContact.href) {
        const contactLink = document.createElement("a");
        contactLink.href = parsedContact.href;
        contactLink.target = "_blank";
        contactLink.rel = "noopener noreferrer";
        contactLink.textContent = parsedContact.label;
        kontak.append(contactLabel, contactLink);
      } else {
        const fallbackText = document.createElement("span");
        fallbackText.textContent = parsedContact.label;
        kontak.append(contactLabel, fallbackText);
      }

      const routeSection = document.createElement("div");
      routeSection.style.marginTop = "10px";
      routeSection.style.paddingTop = "8px";
      routeSection.style.borderTop = "1px solid #e5e7eb";

      const routeLabel = document.createElement("div");
      routeLabel.textContent = "Rute ke:";
      routeLabel.style.fontWeight = "600";
      routeLabel.style.marginBottom = "6px";

      const destinationSelect = document.createElement("select");
      destinationSelect.style.width = "100%";
      destinationSelect.style.marginBottom = "6px";
      destinationSelect.style.padding = "6px";

      if (destinations.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.text = "Tujuan belum tersedia";
        destinationSelect.append(option);
      } else {
        destinations.forEach((destination) => {
          const option = document.createElement("option");
          option.value = destination.id;
          option.text = destination.nama;
          destinationSelect.append(option);
        });
      }

      const routeButton = document.createElement("button");
      routeButton.type = "button";
      routeButton.textContent = "Tampilkan Rute";
      routeButton.style.width = "100%";
      routeButton.style.padding = "7px 8px";
      routeButton.style.border = "none";
      routeButton.style.borderRadius = "6px";
      routeButton.style.backgroundColor = "#1d4ed8";
      routeButton.style.color = "#ffffff";
      routeButton.style.cursor = "pointer";

      const clearRouteButton = document.createElement("button");
      clearRouteButton.type = "button";
      clearRouteButton.textContent = "Hapus Rute";
      clearRouteButton.style.width = "100%";
      clearRouteButton.style.padding = "7px 8px";
      clearRouteButton.style.marginTop = "6px";
      clearRouteButton.style.border = "1px solid #d1d5db";
      clearRouteButton.style.borderRadius = "6px";
      clearRouteButton.style.backgroundColor = "#ffffff";
      clearRouteButton.style.color = "#1f2937";
      clearRouteButton.style.cursor = "pointer";

      const routeResult = document.createElement("div");
      routeResult.style.marginTop = "6px";
      routeResult.style.fontSize = "13px";
      routeResult.style.color = "#111827";

      routeButton.onclick = async () => {
        const selectedId = destinationSelect.value;
        const selectedDestination = destinations.find((item) => item.id === selectedId);

        if (!selectedDestination) {
          routeResult.textContent = "Pilih tujuan terlebih dahulu.";
          routeResult.style.color = "#b91c1c";
          return;
        }

        routeButton.disabled = true;
        clearRouteButton.disabled = true;
        routeButton.style.opacity = "0.65";
        clearRouteButton.style.opacity = "0.65";
        routeResult.textContent = "Menghitung rute...";
        routeResult.style.color = "#111827";

        try {
          const response = await fetch("/api/directions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              origin: { lat: kos.lat, lon: kos.lon },
              destination: { lat: selectedDestination.lat, lon: selectedDestination.lon },
              travelMode: "DRIVE",
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result?.error ?? "Gagal menghitung rute");
          }

          const routeData = result as RouteApiResponse;
          const coordinates = decodeEncodedPolyline(routeData.encodedPolyline);

          if (map.isStyleLoaded()) {
            drawRoute(coordinates);
          } else {
            map.once("load", () => drawRoute(coordinates));
          }

          routeResult.textContent = `Jarak: ${formatDistanceMeters(routeData.distanceMeters)} | Estimasi: ${formatDuration(routeData.duration)}`;
          routeResult.style.color = "#065f46";
        } catch (error) {
          routeResult.textContent =
            error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil rute.";
          routeResult.style.color = "#b91c1c";
        } finally {
          routeButton.disabled = false;
          clearRouteButton.disabled = false;
          routeButton.style.opacity = "1";
          clearRouteButton.style.opacity = "1";
        }
      };

      clearRouteButton.onclick = () => {
        clearRoute();
        routeResult.textContent = "Rute dihapus.";
        routeResult.style.color = "#6b7280";
      };

      routeSection.append(
        routeLabel,
        destinationSelect,
        routeButton,
        clearRouteButton,
        routeResult,
      );

      popupNode.append(title, harga, fasilitas, kontak, routeSection);

      const popup = new maplibregl.Popup({ offset: 25 }).setDOMContent(popupNode);
      popup.on("close", clearRoute);

      return new maplibregl.Marker()
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data, destinations]);

  return <div ref={mapContainerRef} style={{ height: "100vh", width: "100%" }} />;
}