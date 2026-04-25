"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

type HargaVariant = {
  per_bulan: number | null;
  per_semester: number | null;
  per_tahun: number | null;
  deskripsi: string | null;
  exclude: string[];
};

type Harga = {
  raw: string;
  variants: HargaVariant[];
};

type Kos = {
  id: string;
  nama: string;
  jenis: string;
  lat: number;
  lon: number;
  alamat: string;
  plus_code: string;
  harga: Harga;
  fasilitas: string;
  peraturan: string;
  narahubung: string;
  narahubung_nama: string;
};

type Destination = {
  id: string;
  nama: string;
  lat: number;
  lon: number;
};

type RawKos = {
  No?: string;
  "Nama kos"?: string;
  "Jenis kos"?: string;
  Alamat?: string;
  Plus_Code?: string;
  Harga?: string;
  Fasilitas?: string;
  Peraturan?: string;
  Narahubung?: string;
  lat?: string | number;
  long?: string | number;
  ac_status?: string;
  tipe_pembayaran?: string[] | null;
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

export default function Map() {
  const [data, setData] = useState<Kos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
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
    if (!showWelcome) {
      return;
    }

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
    fetch("/api/kos")
      .then((res) => res.json())
      .then((res: unknown) => {
        const arr = Array.isArray(res) ? res : [];
        const mapped: Kos[] = arr
          .map((item: any) => {
            const hargaRaw = item.Harga;
            let harga: Harga;
            if (typeof hargaRaw === "string") {
              harga = { raw: hargaRaw, variants: [] };
            } else if (hargaRaw && typeof hargaRaw === "object") {
              harga = hargaRaw;
            } else {
              harga = { raw: "-", variants: [] };
            }

            return {
              id: String(item.No ?? ""),
              nama: String(item["Nama kos"] ?? "Tanpa Nama"),
              jenis: String(item["Jenis kos"] ?? "Tidak diketahui"),
              alamat: String(item.Alamat ?? ""),
              plus_code: String(item.Plus_Code ?? ""),
              lat: toNumber(item.lat),
              lon: toNumber(item.long),
              harga,
              fasilitas: String(item.Fasilitas ?? ""),
              peraturan: String(item.Peraturan ?? ""),
              narahubung: String(item.Narahubung ?? "-"),
              narahubung_nama: "",
            };
          })
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

      // Tentukan icon marker berdasarkan jenis kos
      const jenis = normalizeJenisKos(kos.jenis);
      let iconUrl = "/marker_campuran.png";
      if (jenis === "Putra") iconUrl = "/marker_putra.png";
      else if (jenis === "Putri") iconUrl = "/marker_putri.png";

      // Buat elemen img untuk marker
      const el = document.createElement("img");
      el.src = iconUrl;
      el.alt = jenis + " marker";
      el.style.width = "38px";
      el.style.height = "38px";
      el.style.objectFit = "contain";
      el.style.display = "block";
      el.style.transform = "translateY(-10%)";

      // ...existing code for popupNode, header, badge, etc...
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

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.gap = "10px";
      header.style.marginBottom = "10px";

      const title = document.createElement("strong");
      title.textContent = kos.nama;
      title.style.display = "inline-block";
      title.style.fontSize = "16px";
      title.style.lineHeight = "1.35";
      title.style.marginBottom = "0";
      title.style.color = "#2e3c2a";

      const jenisColor = getJenisBadgeColor(jenis);

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

      header.append(title, jenisBadge);

      // --- HARGA SECTION ---
      const hargaSection = document.createElement("div");
      hargaSection.style.marginBottom = "8px";

      const variants = kos.harga.variants;
      const hasMultipleVariants = variants.length > 1;

      const getYearlyPrice = (v: HargaVariant) => {
        if (v.per_tahun) return v.per_tahun;
        if (v.per_semester) return v.per_semester * 2;
        if (v.per_bulan) return v.per_bulan * 12;
        return 0;
      };

      // Format price helper
      const formatPrice = (price: number) => {
        if (price >= 1000000) {
          return `${(price / 1000000).toFixed(1).replace(/\.0$/, '')}jt`;
        }
        return price.toLocaleString('id-ID');
      };

      // Helper to get display period
      const getPeriodLabel = (v: HargaVariant) => {
        if (v.per_tahun) return '/thn';
        if (v.per_semester) return '/sem';
        if (v.per_bulan) return '/bln';
        return '';
      };

      if (variants.length === 0) {
        const rawHarga = document.createElement("div");
        rawHarga.style.fontSize = "13px";
        rawHarga.style.color = "#324030";
        rawHarga.style.fontWeight = "500";
        rawHarga.style.padding = "6px 10px";
        rawHarga.style.backgroundColor = "#ecf2e8";
        rawHarga.style.borderRadius = "10px";
        rawHarga.textContent = kos.harga.raw !== "-" ? `💰 ${kos.harga.raw}` : "Harga tidak tersedia";
        hargaSection.appendChild(rawHarga);
      } else {
        if (hasMultipleVariants) {
          // Price range header
          const prices = variants.map(v => getYearlyPrice(v)).filter(p => p > 0);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          const priceRangeHeader = document.createElement("div");
          priceRangeHeader.style.display = "flex";
          priceRangeHeader.style.alignItems = "center";
          priceRangeHeader.style.justifyContent = "space-between";
          priceRangeHeader.style.padding = "6px 10px";
          priceRangeHeader.style.marginBottom = "6px";
          priceRangeHeader.style.borderRadius = "10px";
          priceRangeHeader.style.backgroundColor = "#ecf2e8";
          priceRangeHeader.style.color = "#324030";
          priceRangeHeader.style.fontSize = "13px";
          priceRangeHeader.style.gap = "8px";

          const priceLabel = document.createElement("span");
          priceLabel.style.fontWeight = "600";
          priceLabel.textContent = `💰 ${formatPrice(minPrice)} - ${formatPrice(maxPrice)}/tahun`;
          priceLabel.style.whiteSpace = "nowrap";

          const variantCount = document.createElement("span");
          variantCount.textContent = `${variants.length} opsi`;
          variantCount.style.fontSize = "11px";
          variantCount.style.opacity = "0.7";

          priceRangeHeader.append(priceLabel, variantCount);
          hargaSection.appendChild(priceRangeHeader);
        }

        // Variant cards
        variants.forEach((variant, idx) => {
          const yearlyPrice = getYearlyPrice(variant);
          if (yearlyPrice <= 0) return;

          const isFirst = idx === 0;
          const isBestValue = isFirst && variant.deskripsi && (
            variant.deskripsi.toLowerCase().includes('ac') || 
            variant.deskripsi.toLowerCase().includes('dalam')
          );

          const variantCard = document.createElement("div");
          variantCard.style.padding = "6px 10px";
          variantCard.style.marginBottom = "4px";
          variantCard.style.borderRadius = "8px";
          variantCard.style.fontSize = "12px";
          variantCard.style.backgroundColor = isBestValue ? "#fef3c7" : "#f0f4eb";
          variantCard.style.border = isBestValue 
            ? "1px solid #f59e0b55" 
            : "1px solid #d1d5db55";
          variantCard.style.color = "#374151";
          variantCard.style.position = "relative";

          if (isBestValue) {
            const badge = document.createElement("span");
            badge.textContent = "⭐ Best Value";
            badge.style.position = "absolute";
            badge.style.top = "4px";
            badge.style.right = "6px";
            badge.style.fontSize = "9px";
            badge.style.fontWeight = "700";
            badge.style.color = "#92400e";
            variantCard.appendChild(badge);
          }

          const variantLine1 = document.createElement("div");
          variantLine1.style.display = "flex";
          variantLine1.style.justifyContent = "space-between";
          variantLine1.style.alignItems = "center";
          variantLine1.style.fontWeight = isBestValue ? "700" : "500";

          const variantName = document.createElement("span");
          variantName.textContent = isBestValue ? `⭐ ${variant.deskripsi || 'Standard'}` : (variant.deskripsi || 'Standard');
          variantName.style.flexShrink = "1";
          variantName.style.marginRight = "8px";
          variantName.style.color = isBestValue ? "#78350f" : "#1f2937";

          const variantPrice = document.createElement("span");
          variantPrice.textContent = `Rp ${formatPrice(yearlyPrice)}${getPeriodLabel(variant)}`;
          variantPrice.style.fontWeight = "700";
          variantPrice.style.color = isBestValue ? "#b45309" : "#047857";
          variantPrice.style.whiteSpace = "nowrap";

          variantLine1.append(variantName, variantPrice);

          const variantLine2 = document.createElement("div");
          variantLine2.style.fontSize = "10px";
          variantLine2.style.color = "#6b7280";
          variantLine2.style.marginTop = "2px";

          if (variant.exclude && variant.exclude.length > 0) {
            variantLine2.textContent = `* Tidak termasuk: ${variant.exclude.join(', ')}`;
          } else if (isBestValue) {
            variantLine2.textContent = "Termasuk semua fasilitas";
          }

          variantCard.appendChild(variantLine1);
          if (variantLine2.textContent) {
            variantCard.appendChild(variantLine2);
          }

          hargaSection.appendChild(variantCard);
        });
      }

      const fasilitasSection = document.createElement("div");
      fasilitasSection.style.marginBottom = "8px";

      const fasilitasLabel = document.createElement("div");
      fasilitasLabel.textContent = "Fasilitas";
      fasilitasLabel.style.fontWeight = "600";
      fasilitasLabel.style.marginBottom = "4px";
      fasilitasLabel.style.fontSize = "12px";
      fasilitasLabel.style.color = "#475569";
      fasilitasSection.appendChild(fasilitasLabel);

      const fasilitasText = document.createElement("div");
      fasilitasText.textContent = kos.fasilitas || "-";
      fasilitasText.style.fontSize = "12px";
      fasilitasText.style.color = "#374151";
      fasilitasText.style.lineHeight = "1.45";
      fasilitasSection.appendChild(fasilitasText);

      const kontak = document.createElement("div");
      kontak.style.marginTop = "8px";
      kontak.style.fontSize = "13px";

      const parsedContact = parseContact(kos.narahubung);
      if (parsedContact.href) {
        const contactLink = document.createElement("a");
        contactLink.href = parsedContact.href;
        contactLink.target = "_blank";
        contactLink.rel = "noopener noreferrer";
        contactLink.style.display = "flex";
        contactLink.style.alignItems = "center";
        contactLink.style.gap = "6px";
        contactLink.style.color = "#476184";
        contactLink.style.textDecoration = "none";
        contactLink.style.transition = "color 150ms ease";

        const waIcon = document.createElement("span");
        waIcon.textContent = "💬";
        waIcon.style.fontSize = "14px";

        const contactText = document.createElement("span");
        contactText.style.fontWeight = "500";
        contactText.textContent = kos.narahubung_nama || parsedContact.label;

        contactLink.appendChild(waIcon);
        contactLink.appendChild(contactText);
        kontak.appendChild(contactLink);
      } else {
        const fallbackText = document.createElement("span");
        fallbackText.textContent = parsedContact.label;
        fallbackText.style.color = "#475569";
        kontak.appendChild(fallbackText);
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

          routeResult.textContent = `Jarak: ${formatDistanceMeters(routeData.distanceMeters)} | Estimasi (Walking): ${formatDuration(routeData.duration)}`;
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

      popupNode.append(header, hargaSection, fasilitasSection, kontak, routeSection);

      const popup = new maplibregl.Popup({ offset: 25, className: "kos-popup" }).setDOMContent(popupNode);
      popup.on("close", clearRoute);

      // Gunakan custom marker element (el)
      return new maplibregl.Marker({ element: el })
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data, destinations]);

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
              X
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