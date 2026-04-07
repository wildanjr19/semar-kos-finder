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

type RawKos = {
  "Nama kos"?: string;
  "Harga"?: string;
  Fasilitas?: string;
  Narahubung?: string;
  lat?: string | number;
  long?: string | number;
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

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
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());

    markersRef.current = data.map((kos) => {
      const popupNode = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = kos.nama;

      const harga = document.createElement("div");
      harga.textContent = `Harga: ${kos.harga}`;

      const fasilitas = document.createElement("div");
      fasilitas.textContent = `Fasilitas: ${kos.fasilitas}`;

      const kontak = document.createElement("div");
      const contactLabel = document.createElement("span");
      contactLabel.textContent = "Kontak WAAA: ";

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

      popupNode.append(title, harga, fasilitas, kontak);

      const popup = new maplibregl.Popup({ offset: 25 }).setDOMContent(popupNode);

      return new maplibregl.Marker()
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data]);

  return <div ref={mapContainerRef} style={{ height: "100vh", width: "100%" }} />;
}