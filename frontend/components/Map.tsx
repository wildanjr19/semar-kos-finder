"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

type Destination = {
  id: string;
  nama: string;
  lat: number;
  lon: number;
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

type Kos = {
  id: string;
  nama: string;
  jenis: string;
  lat: number;
  lon: number;
  alamat: string;
  plus_code: string;
  harga: string;
  fasilitas: string;
  peraturan: string;
  narahubung: string;
  narahubung_nama: string;
  ac_status: string;
  tipe_pembayaran: string[];
};

type RawKos = {
  id?: string;
  nama?: string;
  jenis_kos?: string;
  alamat?: string;
  plus_code?: string;
  harga?: string;
  fasilitas?: string;
  peraturan?: string;
  narahubung?: string;
  lat?: string | number;
  long?: string | number;
  ac_status?: string;
  tipe_pembayaran?: string[] | null;
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

function normalizeJenisKos(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.includes("putri")) return "Putri";
  if (cleaned.includes("putra")) return "Putra";
  if (cleaned.includes("campur")) return "Campuran";
  return "Tidak diketahui";
}

function getJenisBadgeColor(jenis: string): { bg: string; text: string; border: string } {
  if (jenis === "Putri") {
    return { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" };
  }
  if (jenis === "Putra") {
    return { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" };
  }
  if (jenis === "Campuran") {
    return { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" };
  }
  return { bg: "#E2E8F0", text: "#334155", border: "#CBD5E1" };
}

function getMarkerGradient(jenis: string): string {
  if (jenis === "Putri") return "linear-gradient(135deg, #f9a8d4 0%, #fce7f3 100%)";
  if (jenis === "Putra") return "linear-gradient(135deg, #93c5fd 0%, #dbeafe 100%)";
  return "linear-gradient(135deg, #86efac 0%, #dcfce7 100%)";
}

function getMarkerTextColor(jenis: string): string {
  if (jenis === "Putri") return "#9d174d";
  if (jenis === "Putra") return "#1d4ed8";
  return "#166534";
}

function getMarkerLetter(jenis: string): string {
  if (jenis === "Putri") return "P";
  if (jenis === "Putra") return "L";
  return "C";
}

function createSectionLabel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.letterSpacing = "0.08em";
  el.style.textTransform = "uppercase";
  el.style.color = "#8a9a80";
  el.style.marginBottom = "6px";
  return el;
}

function createChip(text: string, styles?: Partial<CSSStyleDeclaration>): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.textContent = text.trim();
  chip.style.display = "inline-block";
  chip.style.padding = "3px 10px";
  chip.style.borderRadius = "999px";
  chip.style.fontSize = "11px";
  chip.style.fontWeight = "600";
  chip.style.lineHeight = "1.4";
  chip.style.backgroundColor = "#f0f4eb";
  chip.style.color = "#4a5a45";
  chip.style.border = "1px solid #d8e0d0";
  if (styles) {
    Object.assign(chip.style, styles);
  }
  return chip;
}

export default function Map() {
  const [data, setData] = useState<Kos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const routeSourceId = "route-source";
  const routeLayerId = "route-layer";
  const welcomeStorageKey = "unskosfinder_welcome_seen";

  const closeWelcome = () => {
    setShowWelcome(false);
    window.sessionStorage.setItem(welcomeStorageKey, "1");
  };

  useEffect(() => {
    setIsHydrated(true);
    const hasSeenWelcome = window.sessionStorage.getItem(welcomeStorageKey) === "1";
    setShowWelcome(!hasSeenWelcome);
  }, []);

  useEffect(() => {
    if (!showWelcome) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWelcome();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showWelcome]);

  const clearRoute = () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(routeLayerId)) {
      map.removeLayer(routeLayerId);
    }
    if (map.getSource(routeSourceId)) {
      map.removeSource(routeSourceId);
    }
  };

  const drawRoute = (coordinates: Array<[number, number]>) => {
    const map = mapRef.current;
    if (!map || coordinates.length < 2) return;

    const routeFeature = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
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
    if (!mapContainerRef.current || mapRef.current) return;

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

    const onMapLoad = () => {
      // eslint-disable-next-line no-console
      console.log("[UNSKosFinder] Map ready");
      setMapReady(true);
    };
    mapRef.current.on("load", onMapLoad);
    if (mapRef.current.loaded()) {
      // eslint-disable-next-line no-console
      console.log("[UNSKosFinder] Map already ready");
      setMapReady(true);
    }

    return () => {
      mapRef.current?.off("load", onMapLoad);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    fetch("/api/kos")
      .then((res) => res.json())
      .then((res: unknown) => {
        const arr = Array.isArray(res) ? res : [];
        const mapped: Kos[] = arr
          .map((item: RawKos) => {
            const rawNarahubung = String(item.narahubung ?? "-");
            const contactParsed = parseContact(rawNarahubung);
            const contactMatch = rawNarahubung.match(/^(.*?)\s*\(([^)]+)\)$/);
            const narahubung = contactMatch ? contactMatch[1].trim() : rawNarahubung;
            const narahubung_nama = contactMatch ? contactMatch[2].trim() : "";

            return {
              id: String(item.id ?? ""),
              nama: String(item.nama ?? "Tanpa Nama"),
              jenis: String(item.jenis_kos ?? "Tidak diketahui"),
              alamat: String(item.alamat ?? ""),
              plus_code: String(item.plus_code ?? ""),
              lat: toNumber(item.lat),
              lon: toNumber(item.long),
              harga: String(item.harga ?? "-"),
              fasilitas: String(item.fasilitas ?? ""),
              peraturan: String(item.peraturan ?? ""),
              narahubung,
              narahubung_nama: narahubung_nama || (contactParsed.href ? contactParsed.label : ""),
              ac_status: String(item.ac_status ?? "non_ac"),
              tipe_pembayaran: Array.isArray(item.tipe_pembayaran) ? item.tipe_pembayaran : [],
            };
          })
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
        // eslint-disable-next-line no-console
        console.log(`[UNSKosFinder] Loaded ${mapped.length} kos items`);
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
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());

    // eslint-disable-next-line no-console
    console.log(`[UNSKosFinder] Rendering ${data.length} markers`);
    if (data.length > 0) {
      const first = data[0];
      const projected = map.project([first.lon, first.lat]);
      // eslint-disable-next-line no-console
      console.log(`[UNSKosFinder] First marker: lng=${first.lon}, lat=${first.lat}, pixel=${Math.round(projected.x)},${Math.round(projected.y)}`);
    }

    markersRef.current = data.map((kos) => {
      const jenis = normalizeJenisKos(kos.jenis);
      const jenisColor = getJenisBadgeColor(jenis);

      // Marker element
      const el = document.createElement("div");
      el.style.width = "36px";
      el.style.height = "36px";
      el.style.borderRadius = "50%";
      el.style.background = getMarkerGradient(jenis);
      el.style.border = "3px solid #ffffff";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.28), 0 0 0 2px rgba(255,255,255,0.8)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = "pointer";
      el.style.fontWeight = "800";
      el.style.fontSize = "14px";
      el.style.color = getMarkerTextColor(jenis);
      el.style.fontFamily = "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif";
      el.style.userSelect = "none";
      el.textContent = getMarkerLetter(jenis);

      // Popup content
      const popupNode = document.createElement("div");
      popupNode.style.maxWidth = "340px";
      popupNode.style.maxHeight = "70vh";
      popupNode.style.overflowY = "auto";
      popupNode.style.fontFamily = "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif";
      popupNode.style.padding = "14px";
      popupNode.style.borderRadius = "16px";
      popupNode.style.border = "1px solid rgba(156, 175, 136, 0.25)";
      popupNode.style.background = "linear-gradient(160deg, #ffffff 0%, #f3f7ef 50%, #faf5f0 100%)";
      popupNode.style.color = "#2f3a2f";
      popupNode.style.boxShadow = "0 20px 40px rgba(47, 63, 57, 0.14)";
      popupNode.style.scrollbarWidth = "thin";

      // Header: Title + Jenis badge
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "flex-start";
      header.style.justifyContent = "space-between";
      header.style.gap = "10px";
      header.style.marginBottom = "8px";

      const title = document.createElement("strong");
      title.textContent = kos.nama;
      title.style.display = "block";
      title.style.fontSize = "17px";
      title.style.lineHeight = "1.35";
      title.style.color = "#2a3b28";
      title.style.flex = "1";

      const jenisBadge = document.createElement("span");
      jenisBadge.textContent = jenis;
      jenisBadge.style.display = "inline-flex";
      jenisBadge.style.alignItems = "center";
      jenisBadge.style.padding = "4px 10px";
      jenisBadge.style.borderRadius = "999px";
      jenisBadge.style.fontSize = "11px";
      jenisBadge.style.fontWeight = "700";
      jenisBadge.style.whiteSpace = "nowrap";
      jenisBadge.style.backgroundColor = jenisColor.bg;
      jenisBadge.style.color = jenisColor.text;
      jenisBadge.style.border = `1px solid ${jenisColor.border}`;
      jenisBadge.style.flexShrink = "0";

      header.append(title, jenisBadge);

      // Meta row: AC + Payment
      const metaRow = document.createElement("div");
      metaRow.style.display = "flex";
      metaRow.style.flexWrap = "wrap";
      metaRow.style.gap = "6px";
      metaRow.style.marginBottom = "8px";

      const acChip = createChip(kos.ac_status === "ac" ? "🧊 AC" : "Non-AC", {
        backgroundColor: kos.ac_status === "ac" ? "#e0f2fe" : "#f1f5f9",
        color: kos.ac_status === "ac" ? "#0369a1" : "#64748b",
        border: kos.ac_status === "ac" ? "1px solid #bae6fd" : "1px solid #e2e8f0",
      });
      metaRow.appendChild(acChip);

      kos.tipe_pembayaran.forEach((tp) => {
        const paymentChip = createChip(tp, {
          backgroundColor: "#f3e8ff",
          color: "#7e22ce",
          border: "1px solid #e9d5ff",
        });
        metaRow.appendChild(paymentChip);
      });

      // Alamat
      const alamatSection = document.createElement("div");
      alamatSection.style.marginBottom = "8px";
      const alamatText = document.createElement("div");
      alamatText.textContent = `📍 ${kos.alamat || "Alamat tidak tersedia"}`;
      alamatText.style.fontSize = "12px";
      alamatText.style.color = "#5a6b55";
      alamatText.style.lineHeight = "1.45";
      alamatSection.appendChild(alamatText);

      if (kos.plus_code) {
        const plusCode = document.createElement("div");
        plusCode.textContent = `Plus Code: ${kos.plus_code}`;
        plusCode.style.fontSize = "11px";
        plusCode.style.color = "#7a8a70";
        plusCode.style.fontFamily = "monospace";
        plusCode.style.marginTop = "3px";
        alamatSection.appendChild(plusCode);
      }

      // Harga
      const hargaSection = document.createElement("div");
      hargaSection.style.marginBottom = "8px";
      const hargaLabel = createSectionLabel("Harga");
      hargaSection.appendChild(hargaLabel);

      const hargaTags = document.createElement("div");
      hargaTags.style.display = "flex";
      hargaTags.style.flexWrap = "wrap";
      hargaTags.style.gap = "6px";

      if (kos.harga && kos.harga !== "-") {
        const parts = kos.harga.split(";").map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          parts.forEach((part) => {
            const tag = document.createElement("span");
            tag.textContent = part;
            tag.style.display = "inline-block";
            tag.style.padding = "6px 10px";
            tag.style.borderRadius = "8px";
            tag.style.fontSize = "12px";
            tag.style.fontWeight = "600";
            tag.style.backgroundColor = "#ecf2e8";
            tag.style.color = "#3a4a35";
            hargaTags.appendChild(tag);
          });
        } else {
          const tag = document.createElement("span");
          tag.textContent = kos.harga;
          tag.style.display = "inline-block";
          tag.style.padding = "6px 10px";
          tag.style.borderRadius = "8px";
          tag.style.fontSize = "12px";
          tag.style.fontWeight = "600";
          tag.style.backgroundColor = "#ecf2e8";
          tag.style.color = "#3a4a35";
          hargaTags.appendChild(tag);
        }
      } else {
        const tag = document.createElement("span");
        tag.textContent = "Harga belum tersedia";
        tag.style.display = "inline-block";
        tag.style.padding = "6px 10px";
        tag.style.borderRadius = "8px";
        tag.style.fontSize = "12px";
        tag.style.fontWeight = "600";
        tag.style.backgroundColor = "#f1f5f9";
        tag.style.color = "#64748b";
        hargaTags.appendChild(tag);
      }
      hargaSection.appendChild(hargaTags);

      // Fasilitas (raw)
      const fasilitasSection = document.createElement("div");
      fasilitasSection.style.marginBottom = "8px";
      const fasilitasLabel = createSectionLabel("Fasilitas");
      fasilitasSection.appendChild(fasilitasLabel);

      const fasilitasText = document.createElement("div");
      fasilitasText.textContent = kos.fasilitas || "-";
      fasilitasText.style.fontSize = "12px";
      fasilitasText.style.color = "#4a5a45";
      fasilitasText.style.lineHeight = "1.45";
      fasilitasText.style.backgroundColor = "#f0f4eb";
      fasilitasText.style.padding = "6px 8px";
      fasilitasText.style.borderRadius = "8px";
      fasilitasSection.appendChild(fasilitasText);

      // Peraturan
      const peraturanSection = document.createElement("div");
      peraturanSection.style.marginBottom = "8px";
      const peraturanLabel = createSectionLabel("Peraturan");
      peraturanSection.appendChild(peraturanLabel);

      const peraturanText = document.createElement("div");
      peraturanText.textContent = kos.peraturan || "-";
      peraturanText.style.fontSize = "12px";
      peraturanText.style.color = "#4a5a45";
      peraturanText.style.lineHeight = "1.45";
      peraturanSection.appendChild(peraturanText);

      // Kontak
      const kontakSection = document.createElement("div");
      kontakSection.style.marginTop = "10px";
      const parsedContact = parseContact(kos.narahubung);

      if (parsedContact.href) {
        const waLink = document.createElement("a");
        waLink.href = parsedContact.href;
        waLink.target = "_blank";
        waLink.rel = "noopener noreferrer";
        waLink.textContent = parsedContact.label || kos.narahubung;
        waLink.style.color = "#2563eb";
        waLink.style.fontSize = "12px";
        waLink.style.textDecoration = "underline";
        kontakSection.appendChild(waLink);
      } else {
        const fallback = document.createElement("span");
        fallback.textContent = parsedContact.label;
        fallback.style.fontSize = "12px";
        fallback.style.color = "#64748b";
        kontakSection.appendChild(fallback);
      }

      // Route section
      const routeSection = document.createElement("div");
      routeSection.style.marginTop = "10px";
      routeSection.style.paddingTop = "10px";
      routeSection.style.borderTop = "1px dashed #c4d1bc";

      const routeLabel = document.createElement("div");
      routeLabel.textContent = "Rute ke kampus";
      routeLabel.style.fontWeight = "700";
      routeLabel.style.marginBottom = "8px";
      routeLabel.style.color = "#334155";
      routeLabel.style.fontSize = "13px";

      const destinationSelect = document.createElement("select");
      destinationSelect.style.width = "100%";
      destinationSelect.style.marginBottom = "8px";
      destinationSelect.style.padding = "9px 11px";
      destinationSelect.style.borderRadius = "10px";
      destinationSelect.style.border = "1px solid #bfc9d6";
      destinationSelect.style.backgroundColor = "#ffffff";
      destinationSelect.style.color = "#334155";
      destinationSelect.style.outline = "none";
      destinationSelect.style.fontSize = "13px";
      destinationSelect.style.transition = "border-color 180ms ease, box-shadow 180ms ease";

      destinationSelect.onfocus = () => {
        destinationSelect.style.borderColor = "#829AB1";
        destinationSelect.style.boxShadow = "0 0 0 3px rgba(130, 154, 177, 0.2)";
      };
      destinationSelect.onblur = () => {
        destinationSelect.style.borderColor = "#bfc9d6";
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
      routeButton.style.padding = "6px 12px";
      routeButton.style.border = "1px solid #bfc9d6";
      routeButton.style.borderRadius = "6px";
      routeButton.style.backgroundColor = "#ffffff";
      routeButton.style.color = "#334155";
      routeButton.style.cursor = "pointer";
      routeButton.style.fontWeight = "500";
      routeButton.style.fontSize = "12px";

      const clearRouteButton = document.createElement("button");
      clearRouteButton.type = "button";
      clearRouteButton.textContent = "Hapus Rute";
      clearRouteButton.style.padding = "6px 12px";
      clearRouteButton.style.marginLeft = "6px";
      clearRouteButton.style.border = "1px solid #e2e8f0";
      clearRouteButton.style.borderRadius = "6px";
      clearRouteButton.style.backgroundColor = "#f8fafc";
      clearRouteButton.style.color = "#64748b";
      clearRouteButton.style.cursor = "pointer";
      clearRouteButton.style.fontSize = "12px";
      clearRouteButton.style.fontWeight = "500";

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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { lat: kos.lat, lon: kos.lon },
              destination: { lat: selectedDestination.lat, lon: selectedDestination.lon },
              travelMode: "WALK",
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

          routeResult.textContent = `Jarak: ${formatDistanceMeters(routeData.distanceMeters)} | Estimasi jalan kaki: ${formatDuration(routeData.duration)}`;
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

      popupNode.append(
        header,
        metaRow,
        alamatSection,
        hargaSection,
        fasilitasSection,
        peraturanSection,
        kontakSection,
        routeSection,
      );

      const popup = new maplibregl.Popup({ offset: 25, className: "kos-popup" }).setDOMContent(popupNode);
      popup.on("close", clearRoute);

      return new maplibregl.Marker({ element: el, offset: [0, -18] })
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data.length, destinations.length, mapReady]);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

      {isHydrated && showWelcome && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.32)",
            padding: "20px",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Informasi awal UNSKosFinder"
            style={{
              width: "100%",
              maxWidth: "540px",
              borderRadius: "18px",
              border: "1px solid #c4d1bc",
              background: "linear-gradient(150deg, #ffffff 0%, #eef4ea 60%, #f7eee8 100%)",
              boxShadow: "0 16px 38px rgba(15, 23, 42, 0.24)",
              color: "#2f3a2f",
              padding: "18px",
              position: "relative",
              fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            <button
              type="button"
              aria-label="Tutup informasi awal"
              onClick={closeWelcome}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "30px",
                height: "30px",
                borderRadius: "999px",
                border: "1px solid #b7c6ac",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h2 style={{ margin: "0 36px 8px 0", fontSize: "22px", color: "#2e3c2a" }}>
              Selamat datang di UNSKosFinder
            </h2>
            <p style={{ margin: "0 0 12px 0", lineHeight: "1.55", color: "#3f4f3c" }}>
              Cari kos sekitar UNS jadi lebih cepat lewat peta interaktif.
            </p>

            <div style={{ marginBottom: "10px" }}>
              <strong style={{ display: "block", marginBottom: "6px", color: "#334155" }}>
                Cara pakai:
              </strong>
              <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.6", color: "#334155" }}>
                <li>Klik pin kos di peta untuk lihat detail.</li>
                <li>Pilih tujuan kampus lalu klik Tampilkan Rute.</li>
                <li>Gunakan kontak yang tertera untuk menghubungi pemilik.</li>
              </ul>
            </div>

            <div
              style={{
                marginTop: "12px",
                borderRadius: "12px",
                padding: "10px 12px",
                backgroundColor: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                fontWeight: 700,
              }}
            >
              Waspada Penipuan
            </div>

            <div
              style={{
                marginTop: "10px",
                borderRadius: "12px",
                padding: "10px 12px",
                backgroundColor: "#e8eef3",
                border: "1px solid #c5d4e2",
                color: "#334155",
                lineHeight: "1.5",
              }}
            >
              Informasi harga dapat berubah sewaktu-waktu.
            </div>

            <button
              type="button"
              onClick={closeWelcome}
              style={{
                marginTop: "14px",
                width: "100%",
                border: "none",
                borderRadius: "12px",
                padding: "11px 12px",
                background: "linear-gradient(145deg, #829AB1 0%, #9CAF88 100%)",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Saya mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
