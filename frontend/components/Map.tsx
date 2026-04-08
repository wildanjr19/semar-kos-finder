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
      const popupColors = {
        sage: "#9CAF88",
        steel: "#829AB1",
        peach: "#D9AE94",
      };

      const popupNode = document.createElement("div");
      popupNode.style.maxWidth = "280px";
      popupNode.style.fontFamily = "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif";
      popupNode.style.padding = "14px";
      popupNode.style.borderRadius = "16px";
      popupNode.style.border = `1px solid ${popupColors.sage}55`;
      popupNode.style.background =
        "linear-gradient(145deg, #ffffff 0%, #eef4ea 55%, #f7eee8 100%)";
      popupNode.style.boxShadow = "0 10px 24px rgba(47, 63, 57, 0.14)";
      popupNode.style.color = "#2f3a2f";

      const title = document.createElement("strong");
      title.textContent = kos.nama;
      title.style.display = "block";
      title.style.fontSize = "16px";
      title.style.lineHeight = "1.35";
      title.style.marginBottom = "10px";
      title.style.color = "#2e3c2a";

      const harga = document.createElement("div");
      harga.textContent = `Harga: ${kos.harga}`;
      harga.style.fontSize = "13px";
      harga.style.padding = "7px 10px";
      harga.style.marginBottom = "6px";
      harga.style.borderRadius = "10px";
      harga.style.backgroundColor = "#ecf2e8";
      harga.style.color = "#324030";

      const fasilitas = document.createElement("div");
      fasilitas.textContent = `Fasilitas: ${kos.fasilitas}`;
      fasilitas.style.fontSize = "13px";
      fasilitas.style.padding = "7px 10px";
      fasilitas.style.borderRadius = "10px";
      fasilitas.style.backgroundColor = "#e8eef3";
      fasilitas.style.color = "#2f3c4a";

      const kontak = document.createElement("div");
      kontak.style.marginTop = "8px";
      kontak.style.fontSize = "13px";
      const contactLabel = document.createElement("span");
      contactLabel.textContent = "Kontak: ";
      contactLabel.style.fontWeight = "600";
      contactLabel.style.color = "#334155";

      const parsedContact = parseContact(kos.kontak);
      if (parsedContact.href) {
        const contactLink = document.createElement("a");
        contactLink.href = parsedContact.href;
        contactLink.target = "_blank";
        contactLink.rel = "noopener noreferrer";
        contactLink.textContent = parsedContact.label;
        contactLink.style.color = "#476184";
        contactLink.style.textDecorationColor = `${popupColors.steel}88`;
        kontak.append(contactLabel, contactLink);
      } else {
        const fallbackText = document.createElement("span");
        fallbackText.textContent = parsedContact.label;
        fallbackText.style.color = "#475569";
        kontak.append(contactLabel, fallbackText);
      }

      const routeSection = document.createElement("div");
      routeSection.style.marginTop = "10px";
      routeSection.style.paddingTop = "8px";
      routeSection.style.borderTop = `1px solid ${popupColors.sage}55`;

      const routeLabel = document.createElement("div");
      routeLabel.textContent = "Rute ke:";
      routeLabel.style.fontWeight = "600";
      routeLabel.style.marginBottom = "6px";
      routeLabel.style.color = "#334155";

      const destinationSelect = document.createElement("select");
      destinationSelect.style.width = "100%";
      destinationSelect.style.marginBottom = "6px";
      destinationSelect.style.padding = "8px 10px";
      destinationSelect.style.borderRadius = "10px";
      destinationSelect.style.border = `1px solid ${popupColors.steel}66`;
      destinationSelect.style.backgroundColor = "#ffffff";
      destinationSelect.style.color = "#334155";
      destinationSelect.style.outline = "none";
      destinationSelect.style.transition = "border-color 180ms ease, box-shadow 180ms ease";

      destinationSelect.onfocus = () => {
        destinationSelect.style.borderColor = popupColors.steel;
        destinationSelect.style.boxShadow = `0 0 0 3px ${popupColors.steel}33`;
      };

      destinationSelect.onblur = () => {
        destinationSelect.style.borderColor = `${popupColors.steel}66`;
        destinationSelect.style.boxShadow = "none";
      };

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
      routeButton.style.padding = "9px 10px";
      routeButton.style.border = "none";
      routeButton.style.borderRadius = "11px";
      routeButton.style.background =
        `linear-gradient(140deg, ${popupColors.steel} 0%, ${popupColors.sage} 100%)`;
      routeButton.style.color = "#ffffff";
      routeButton.style.cursor = "pointer";
      routeButton.style.fontWeight = "600";
      routeButton.style.transition = "transform 180ms ease, box-shadow 180ms ease, filter 180ms ease";

      routeButton.onmouseenter = () => {
        if (routeButton.disabled) return;
        routeButton.style.transform = "translateY(-1px)";
        routeButton.style.boxShadow = "0 10px 20px rgba(130, 154, 177, 0.32)";
        routeButton.style.filter = "saturate(1.05)";
      };

      routeButton.onmouseleave = () => {
        routeButton.style.transform = "translateY(0)";
        routeButton.style.boxShadow = "none";
        routeButton.style.filter = "none";
      };

      routeButton.onfocus = () => {
        routeButton.style.boxShadow = `0 0 0 3px ${popupColors.sage}66`;
      };

      routeButton.onblur = () => {
        routeButton.style.boxShadow = "none";
      };

      const clearRouteButton = document.createElement("button");
      clearRouteButton.type = "button";
      clearRouteButton.textContent = "Hapus Rute";
      clearRouteButton.style.width = "100%";
      clearRouteButton.style.padding = "9px 10px";
      clearRouteButton.style.marginTop = "6px";
      clearRouteButton.style.border = `1px solid ${popupColors.peach}99`;
      clearRouteButton.style.borderRadius = "11px";
      clearRouteButton.style.backgroundColor = "#f6e9e1";
      clearRouteButton.style.color = "#67473a";
      clearRouteButton.style.cursor = "pointer";
      clearRouteButton.style.transition = "transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease";

      clearRouteButton.onmouseenter = () => {
        if (clearRouteButton.disabled) return;
        clearRouteButton.style.transform = "translateY(-1px)";
        clearRouteButton.style.backgroundColor = "#f2dfd4";
      };

      clearRouteButton.onmouseleave = () => {
        clearRouteButton.style.transform = "translateY(0)";
        clearRouteButton.style.backgroundColor = "#f6e9e1";
      };

      clearRouteButton.onfocus = () => {
        clearRouteButton.style.boxShadow = `0 0 0 3px ${popupColors.peach}4d`;
      };

      clearRouteButton.onblur = () => {
        clearRouteButton.style.boxShadow = "none";
      };

      const routeResult = document.createElement("div");
      routeResult.style.marginTop = "8px";
      routeResult.style.fontSize = "13px";
      routeResult.style.color = "#334155";
      routeResult.style.lineHeight = "1.45";
      routeResult.style.padding = "8px 10px";
      routeResult.style.borderRadius = "10px";
      routeResult.style.backgroundColor = "#edf2f7";

      routeButton.onclick = async () => {
        const selectedId = destinationSelect.value;
        const selectedDestination = destinations.find((item) => item.id === selectedId);

        if (!selectedDestination) {
          routeResult.textContent = "Pilih tujuan terlebih dahulu.";
          routeResult.style.color = "#8a3b2f";
          return;
        }

        routeButton.disabled = true;
        clearRouteButton.disabled = true;
        routeButton.style.opacity = "0.65";
        clearRouteButton.style.opacity = "0.65";
        routeResult.textContent = "Menghitung rute...";
        routeResult.style.color = "#334155";

        try {
          const response = await fetch("/api/directions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              origin: { lat: kos.lat, lon: kos.lon },
              destination: { lat: selectedDestination.lat, lon: selectedDestination.lon },
              travelMode: "WALK"
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
          routeResult.style.color = "#2f5133";
        } catch (error) {
          routeResult.textContent =
            error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil rute.";
          routeResult.style.color = "#8a3b2f";
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
        routeResult.style.color = "#5f6e7e";
      };

      routeSection.append(
        routeLabel,
        destinationSelect,
        routeButton,
        clearRouteButton,
        routeResult,
      );

      popupNode.append(title, harga, fasilitas, kontak, routeSection);

      const popup = new maplibregl.Popup({ offset: 25, className: "kos-popup" }).setDOMContent(popupNode);
      popup.on("close", clearRoute);

      return new maplibregl.Marker()
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data, destinations]);

  return <div ref={mapContainerRef} style={{ height: "100vh", width: "100%" }} />;
}