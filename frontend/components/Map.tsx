"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const UNKNOWN_PAYMENT_VALUE = "unknown_payment";

const PAYMENT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "mingguan", label: "Mingguan" },
  { value: "bulanan", label: "Bulanan" },
  { value: "per3bulan", label: "Per 3 Bulan" },
  { value: "semesteran", label: "Semesteran" },
  { value: "tahunan", label: "Tahunan" },
  { value: UNKNOWN_PAYMENT_VALUE, label: "Tidak diketahui" },
];

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

type HargaItem = {
  min: number;
  max: number;
  periode: string;
  tipe_kamar: string | null;
  catatan: string | null;
};

type FasilitasCleaned = {
  dalam_kamar: string[];
  bersama: string[];
  utilitas: string[];
  catatan: string;
};

type PeraturanCleaned = {
  jam_malam: string | null;
  tamu_lawan_jenis: string | null;
  tamu_menginap: boolean | null;
  boleh_hewan: boolean | null;
  lainnya: string[];
};

type KontakItem = {
  nama: string;
  nomor_wa: string;
  url_wa: string;
};

type KosClean = {
  harga: HargaItem[];
  fasilitas: FasilitasCleaned;
  peraturan: PeraturanCleaned;
  kontak: KontakItem[];
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
  data_status: string;
  parsed_data?: KosClean | null;
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
  data_status?: string;
  parsed_data?: KosClean | null;
};

function isCleanData(kos: Kos): boolean {
  return kos.data_status === "reviewed" && kos.parsed_data != null;
}

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

function normalizeAcStatus(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (normalized === "ac") return "ac";
  if (normalized === "non_ac" || normalized === "nonac") return "non_ac";
  if (normalized === "keduanya" || normalized === "both") return "keduanya";
  return "";
}

function normalizePaymentType(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (!normalized) return "";

  const compact = normalized.replace(/_/g, "");
  if (compact === "mingguan") return "mingguan";
  if (compact === "bulanan") return "bulanan";
  if (compact === "per3bulan" || compact === "3bulan") return "per3bulan";
  if (compact === "semesteran") return "semesteran";
  if (compact === "tahunan") return "tahunan";
  return "";
}

function normalizePaymentTypes(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizePaymentType(value)).filter(Boolean)));
}

function getAcChipPresentation(rawStatus: string): {
  label: string;
  backgroundColor: string;
  color: string;
  border: string;
} {
  const status = normalizeAcStatus(rawStatus);
  if (status === "ac") {
    return {
      label: "AC",
      backgroundColor: "#e0f2fe",
      color: "#0369a1",
      border: "1px solid #bae6fd",
    };
  }
  if (status === "non_ac") {
    return {
      label: "Non-AC",
      backgroundColor: "#f1f5f9",
      color: "#64748b",
      border: "1px solid #e2e8f0",
    };
  }
  if (status === "keduanya") {
    return {
      label: "AC & Non-AC",
      backgroundColor: "#ecfeff",
      color: "#0f766e",
      border: "1px solid #99f6e4",
    };
  }
  return {
    label: "Status AC tidak diketahui",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

export default function KosMap() {
  const [allKos, setAllKos] = useState<Kos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAcChecked, setFilterAcChecked] = useState(false);
  const [filterNonAcChecked, setFilterNonAcChecked] = useState(false);
  const [filterPaymentTypes, setFilterPaymentTypes] = useState<string[]>([]);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const routeSourceId = "route-source";
  const routeLayerId = "route-layer";
  const welcomeStorageKey = "unskosfinder_welcome_seen";

  const paymentLabelMap = useMemo(
    () =>
      new Map(PAYMENT_FILTER_OPTIONS.map((option) => [option.value, option.label])),
    [],
  );

  const activeFilterCount =
    Number(filterAcChecked) + Number(filterNonAcChecked) + filterPaymentTypes.length;

  const matchesAcFilter = (rawAcStatus: string): boolean => {
    if (!filterAcChecked && !filterNonAcChecked) return true;
    if (filterAcChecked && filterNonAcChecked) return true;

    const normalizedAcStatus = normalizeAcStatus(rawAcStatus);
    if (filterAcChecked) {
      return normalizedAcStatus === "ac" || normalizedAcStatus === "keduanya";
    }
    return normalizedAcStatus === "non_ac" || normalizedAcStatus === "keduanya";
  };

  const matchesPaymentFilter = (rawPaymentTypes: string[]): boolean => {
    if (filterPaymentTypes.length === 0) return true;

    const normalizedPayments = normalizePaymentTypes(rawPaymentTypes);
    const hasUnknownPayment = normalizedPayments.length === 0;

    return filterPaymentTypes.some((selectedType) => {
      if (selectedType === UNKNOWN_PAYMENT_VALUE) {
        return hasUnknownPayment;
      }
      return normalizedPayments.includes(selectedType);
    });
  };

  const filteredByAc = useMemo(
    () => allKos.filter((item) => matchesAcFilter(item.ac_status)),
    [allKos, filterAcChecked, filterNonAcChecked],
  );

  const filteredKos = useMemo(
    () => filteredByAc.filter((item) => matchesPaymentFilter(item.tipe_pembayaran)),
    [filteredByAc, filterPaymentTypes],
  );

  const baseForAcCounts = useMemo(
    () => allKos.filter((item) => matchesPaymentFilter(item.tipe_pembayaran)),
    [allKos, filterPaymentTypes],
  );

  const acFacetCount = useMemo(
    () =>
      baseForAcCounts.filter((item) => {
        const status = normalizeAcStatus(item.ac_status);
        return status === "ac" || status === "keduanya";
      }).length,
    [baseForAcCounts],
  );

  const nonAcFacetCount = useMemo(
    () =>
      baseForAcCounts.filter((item) => {
        const status = normalizeAcStatus(item.ac_status);
        return status === "non_ac" || status === "keduanya";
      }).length,
    [baseForAcCounts],
  );

  const paymentFacetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PAYMENT_FILTER_OPTIONS.forEach((option) => {
      counts[option.value] = 0;
    });

    filteredByAc.forEach((item) => {
      const normalizedPayments = normalizePaymentTypes(item.tipe_pembayaran);
      if (normalizedPayments.length === 0) {
        counts[UNKNOWN_PAYMENT_VALUE] += 1;
        return;
      }
      normalizedPayments.forEach((paymentType) => {
        if (paymentType in counts) {
          counts[paymentType] += 1;
        }
      });
    });

    return counts;
  }, [filteredByAc]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (filterAcChecked) {
      chips.push({ key: "ac", label: "AC" });
    }
    if (filterNonAcChecked) {
      chips.push({ key: "non_ac", label: "Non-AC" });
    }
    filterPaymentTypes.forEach((paymentType) => {
      chips.push({
        key: `pay:${paymentType}`,
        label: paymentLabelMap.get(paymentType) ?? paymentType,
      });
    });
    return chips;
  }, [filterAcChecked, filterNonAcChecked, filterPaymentTypes, paymentLabelMap]);

  const acRuleHint =
    filterAcChecked && !filterNonAcChecked
      ? "AC aktif: menampilkan kos AC + keduanya"
      : !filterAcChecked && filterNonAcChecked
        ? "Non-AC aktif: menampilkan kos Non-AC + keduanya"
        : "Tidak pilih AC/Non-AC: semua kos ditampilkan";

  const resetFilters = () => {
    setFilterAcChecked(false);
    setFilterNonAcChecked(false);
    setFilterPaymentTypes([]);
  };

  const clearFilterChip = (chipKey: string) => {
    if (chipKey === "ac") {
      setFilterAcChecked(false);
      return;
    }
    if (chipKey === "non_ac") {
      setFilterNonAcChecked(false);
      return;
    }
    if (chipKey.startsWith("pay:")) {
      const paymentType = chipKey.replace("pay:", "");
      setFilterPaymentTypes((prev) => prev.filter((item) => item !== paymentType));
    }
  };

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

  useEffect(() => {
    if (!isHydrated || filtersHydrated) return;

    const params = new URLSearchParams(window.location.search);
    setFilterAcChecked(params.get("ac") === "1");
    setFilterNonAcChecked(params.get("non_ac") === "1");

    const paymentQuery = params.get("pay");
    if (paymentQuery) {
      const parsedPayments = Array.from(
        new Set(
          paymentQuery
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => (value === UNKNOWN_PAYMENT_VALUE ? value : normalizePaymentType(value)))
            .filter(Boolean),
        ),
      );
      setFilterPaymentTypes(parsedPayments);
    }

    setFiltersHydrated(true);
  }, [isHydrated, filtersHydrated]);

  useEffect(() => {
    if (!filtersHydrated) return;

    const params = new URLSearchParams(window.location.search);
    if (filterAcChecked) {
      params.set("ac", "1");
    } else {
      params.delete("ac");
    }

    if (filterNonAcChecked) {
      params.set("non_ac", "1");
    } else {
      params.delete("non_ac");
    }

    if (filterPaymentTypes.length > 0) {
      params.set("pay", filterPaymentTypes.join(","));
    } else {
      params.delete("pay");
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [filterAcChecked, filterNonAcChecked, filterPaymentTypes, filtersHydrated]);

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
              data_status: String(item.data_status ?? "raw"),
              parsed_data: item.parsed_data ?? null,
            };
          })
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
        // eslint-disable-next-line no-console
        console.log(`[UNSKosFinder] Loaded ${mapped.length} kos items`);
        setAllKos(mapped);
      });
  }, []);

  useEffect(() => {
    fetch("/api/master-uns")
      .then((res) => res.json())
      .then((res: RawDestination[]) => {
        const arr = Array.isArray(res) ? res : [];
        const mapped = arr
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
    console.log(`[UNSKosFinder] Rendering ${filteredKos.length} markers`);
    if (filteredKos.length > 0) {
      const first = filteredKos[0];
      const projected = map.project([first.lon, first.lat]);
      // eslint-disable-next-line no-console
      console.log(`[UNSKosFinder] First marker: lng=${first.lon}, lat=${first.lat}, pixel=${Math.round(projected.x)},${Math.round(projected.y)}`);
    }

    markersRef.current = filteredKos.map((kos) => {
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

      const acChipStyle = getAcChipPresentation(kos.ac_status);
      const acChip = createChip(acChipStyle.label, {
        backgroundColor: acChipStyle.backgroundColor,
        color: acChipStyle.color,
        border: acChipStyle.border,
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

      if (isCleanData(kos) && kos.parsed_data) {
        const clean = kos.parsed_data;
        if (clean.harga.length > 0) {
          clean.harga.forEach((h) => {
            const tag = document.createElement("span");
            const tipe = h.tipe_kamar ? `${h.tipe_kamar} · ` : "";
            tag.textContent = `${tipe}Rp ${h.min.toLocaleString()}${h.min !== h.max ? ` - ${h.max.toLocaleString()}` : ""} / ${h.periode}`;
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
      } else if (kos.harga && kos.harga !== "-") {
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

      // Fasilitas
      const fasilitasSection = document.createElement("div");
      fasilitasSection.style.marginBottom = "8px";
      const fasilitasLabel = createSectionLabel("Fasilitas");
      fasilitasSection.appendChild(fasilitasLabel);

      if (isCleanData(kos) && kos.parsed_data) {
        const f = kos.parsed_data.fasilitas;
        const fasilitasWrap = document.createElement("div");
        fasilitasWrap.style.display = "flex";
        fasilitasWrap.style.flexWrap = "wrap";
        fasilitasWrap.style.gap = "4px";
        f.dalam_kamar.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        f.bersama.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        f.utilitas.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        if (f.catatan) {
          const note = document.createElement("div");
          note.textContent = f.catatan;
          note.style.fontSize = "11px";
          note.style.color = "#7a8a70";
          note.style.marginTop = "4px";
          fasilitasWrap.appendChild(note);
        }
        fasilitasSection.appendChild(fasilitasWrap);
      } else {
        const fasilitasText = document.createElement("div");
        fasilitasText.textContent = kos.fasilitas || "-";
        fasilitasText.style.fontSize = "12px";
        fasilitasText.style.color = "#4a5a45";
        fasilitasText.style.lineHeight = "1.45";
        fasilitasText.style.backgroundColor = "#f0f4eb";
        fasilitasText.style.padding = "6px 8px";
        fasilitasText.style.borderRadius = "8px";
        fasilitasSection.appendChild(fasilitasText);
      }

      // Peraturan
      const peraturanSection = document.createElement("div");
      peraturanSection.style.marginBottom = "8px";
      const peraturanLabel = createSectionLabel("Peraturan");
      peraturanSection.appendChild(peraturanLabel);

      if (isCleanData(kos) && kos.parsed_data) {
        const p = kos.parsed_data.peraturan;
        const peraturanWrap = document.createElement("div");
        peraturanWrap.style.display = "flex";
        peraturanWrap.style.flexWrap = "wrap";
        peraturanWrap.style.gap = "4px";
        if (p.jam_malam) peraturanWrap.appendChild(createChip(`⏰ ${p.jam_malam}`));
        if (p.tamu_lawan_jenis) peraturanWrap.appendChild(createChip(`👫 ${p.tamu_lawan_jenis}`));
        if (p.tamu_menginap === true) peraturanWrap.appendChild(createChip("🛏 Tamu menginap"));
        if (p.boleh_hewan === true) peraturanWrap.appendChild(createChip("🐕 Hewan diizinkan"));
        p.lainnya.forEach((r) => peraturanWrap.appendChild(createChip(r)));
        if (peraturanWrap.childNodes.length === 0) {
          peraturanWrap.textContent = "-";
          peraturanWrap.style.fontSize = "12px";
          peraturanWrap.style.color = "#4a5a45";
        }
        peraturanSection.appendChild(peraturanWrap);
      } else {
        const peraturanText = document.createElement("div");
        peraturanText.textContent = kos.peraturan || "-";
        peraturanText.style.fontSize = "12px";
        peraturanText.style.color = "#4a5a45";
        peraturanText.style.lineHeight = "1.45";
        peraturanSection.appendChild(peraturanText);
      }

      // Kontak
      const kontakSection = document.createElement("div");
      kontakSection.style.marginTop = "10px";

      if (isCleanData(kos) && kos.parsed_data) {
        const kontakWrap = document.createElement("div");
        kontakWrap.style.display = "flex";
        kontakWrap.style.flexDirection = "column";
        kontakWrap.style.gap = "4px";
        kos.parsed_data.kontak.forEach((k) => {
          const waLink = document.createElement("a");
          waLink.href = k.url_wa;
          waLink.target = "_blank";
          waLink.rel = "noopener noreferrer";
          waLink.textContent = `${k.nama || "Kontak"} — ${k.nomor_wa}`;
          waLink.style.color = "#2563eb";
          waLink.style.fontSize = "12px";
          waLink.style.textDecoration = "underline";
          kontakWrap.appendChild(waLink);
        });
        if (kos.parsed_data.kontak.length === 0) {
          const fallback = document.createElement("span");
          fallback.textContent = "-";
          fallback.style.fontSize = "12px";
          fallback.style.color = "#64748b";
          kontakWrap.appendChild(fallback);
        }
        kontakSection.appendChild(kontakWrap);
      } else {
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
  }, [filteredKos, destinations, mapReady]);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

      <div className="mapFilterDock">
        <button
          type="button"
          className="mapFilterToggle"
          onClick={() => setIsFilterOpen((prev) => !prev)}
          aria-expanded={isFilterOpen}
          aria-controls="map-filter-panel"
        >
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>

        {activeFilterChips.length > 0 && (
          <div className="mapFilterActiveChips" aria-label="Filter aktif">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="mapFilterChip"
                onClick={() => clearFilterChip(chip.key)}
              >
                <span>{chip.label}</span>
                <span className="mapFilterChipClose">x</span>
              </button>
            ))}
            <button type="button" className="mapFilterChip mapFilterChipReset" onClick={resetFilters}>
              Reset
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`mapFilterBackdrop ${isFilterOpen ? "open" : ""}`}
        aria-label="Tutup panel filter"
        onClick={() => setIsFilterOpen(false)}
      />

      <aside id="map-filter-panel" className={`mapFilterPanel ${isFilterOpen ? "open" : ""}`}>
        <header className="mapFilterHeader">
          <div>
            <h3>Filter Kos</h3>
            <p>{filteredKos.length} kos cocok dari {allKos.length}</p>
          </div>
          <button type="button" className="mapFilterClose" onClick={() => setIsFilterOpen(false)}>
            Tutup
          </button>
        </header>

        <div className="mapFilterBody">
          <section className="mapFilterSection">
            <h4>AC</h4>
            <p className="mapFilterHint">{acRuleHint}</p>

            <label className="mapFilterOption">
              <span className="mapFilterOptionMain">
                <input
                  type="checkbox"
                  checked={filterAcChecked}
                  onChange={(event) => setFilterAcChecked(event.target.checked)}
                />
                <span>AC</span>
              </span>
              <span className="mapFilterCount">{acFacetCount}</span>
            </label>

            <label className="mapFilterOption">
              <span className="mapFilterOptionMain">
                <input
                  type="checkbox"
                  checked={filterNonAcChecked}
                  onChange={(event) => setFilterNonAcChecked(event.target.checked)}
                />
                <span>Non-AC</span>
              </span>
              <span className="mapFilterCount">{nonAcFacetCount}</span>
            </label>
          </section>

          <section className="mapFilterSection">
            <h4>Periode Pembayaran</h4>
            <p className="mapFilterHint">Pilih satu atau lebih. Hasil memakai logika OR.</p>

            {PAYMENT_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className="mapFilterOption">
                <span className="mapFilterOptionMain">
                  <input
                    type="checkbox"
                    checked={filterPaymentTypes.includes(option.value)}
                    onChange={(event) => {
                      setFilterPaymentTypes((prev) => {
                        if (event.target.checked) {
                          return Array.from(new Set([...prev, option.value]));
                        }
                        return prev.filter((item) => item !== option.value);
                      });
                    }}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="mapFilterCount">{paymentFacetCounts[option.value] ?? 0}</span>
              </label>
            ))}
          </section>
        </div>

        <footer className="mapFilterFooter">
          <button type="button" className="mapFilterGhostButton" onClick={resetFilters}>
            Reset Semua
          </button>
          <button type="button" className="mapFilterPrimaryButton" onClick={() => setIsFilterOpen(false)}>
            Tutup Panel
          </button>
        </footer>
      </aside>

      {allKos.length > 0 && filteredKos.length === 0 && (
        <div className="mapFilterEmptyState" role="status" aria-live="polite">
          <strong>Tidak ada kos yang cocok</strong>
          <p>Coba ubah kombinasi filter Anda atau reset semua filter.</p>
          <button type="button" onClick={resetFilters}>Reset Filter</button>
        </div>
      )}

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

      <style jsx>{`
        .mapFilterDock {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 1001;
          max-width: min(72vw, 380px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }

        .mapFilterToggle {
          pointer-events: auto;
          width: fit-content;
          border: 1px solid rgba(148, 163, 184, 0.55);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.95);
          color: #1e293b;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          backdrop-filter: blur(6px);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
        }

        .mapFilterActiveChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          pointer-events: auto;
        }

        .mapFilterChip {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.95);
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 5px 16px rgba(15, 23, 42, 0.09);
        }

        .mapFilterChipClose {
          font-weight: 700;
          color: #64748b;
          line-height: 1;
        }

        .mapFilterChipReset {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #3730a3;
        }

        .mapFilterBackdrop {
          position: absolute;
          inset: 0;
          z-index: 1002;
          border: none;
          background: rgba(15, 23, 42, 0.14);
          opacity: 0;
          pointer-events: none;
          transition: opacity 220ms ease;
        }

        .mapFilterBackdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .mapFilterPanel {
          position: absolute;
          top: 14px;
          left: 14px;
          bottom: 14px;
          z-index: 1003;
          width: min(360px, calc(100% - 28px));
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: linear-gradient(165deg, #ffffff 0%, #f1f6ef 58%, #fbf5ee 100%);
          box-shadow: 0 20px 42px rgba(15, 23, 42, 0.22);
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          transform: translateX(-112%);
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        .mapFilterPanel.open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .mapFilterHeader {
          padding: 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .mapFilterHeader h3 {
          margin: 0;
          font-size: 18px;
          color: #1f2937;
        }

        .mapFilterHeader p {
          margin: 4px 0 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .mapFilterClose {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #334155;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
        }

        .mapFilterBody {
          padding: 16px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mapFilterSection {
          border: 1px solid rgba(148, 163, 184, 0.26);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.78);
          padding: 12px;
        }

        .mapFilterSection h4 {
          margin: 0;
          font-size: 14px;
          color: #1f2937;
        }

        .mapFilterHint {
          margin: 7px 0 10px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .mapFilterOption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 8px;
          border-radius: 10px;
          cursor: pointer;
        }

        .mapFilterOption:hover {
          background: rgba(241, 245, 249, 0.8);
        }

        .mapFilterOptionMain {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
        }

        .mapFilterOptionMain input {
          width: 15px;
          height: 15px;
          accent-color: #4f46e5;
        }

        .mapFilterCount {
          font-size: 11px;
          line-height: 1;
          font-weight: 700;
          border-radius: 999px;
          padding: 5px 8px;
          color: #334155;
          background: #e2e8f0;
          border: 1px solid #cbd5e1;
        }

        .mapFilterFooter {
          padding: 14px 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(255, 255, 255, 0.92);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .mapFilterGhostButton,
        .mapFilterPrimaryButton {
          border-radius: 11px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .mapFilterGhostButton {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
        }

        .mapFilterPrimaryButton {
          border: 1px solid #1d4ed8;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
        }

        .mapFilterEmptyState {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          padding: 14px 16px;
          width: min(360px, calc(100% - 32px));
          text-align: center;
          color: #1f2937;
        }

        .mapFilterEmptyState strong {
          display: block;
          margin-bottom: 6px;
        }

        .mapFilterEmptyState p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .mapFilterEmptyState button {
          margin-top: 10px;
          border-radius: 10px;
          border: 1px solid #1d4ed8;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .mapFilterDock {
            max-width: calc(100vw - 28px);
          }

          .mapFilterPanel {
            left: 0;
            right: 0;
            top: auto;
            bottom: 0;
            width: 100%;
            height: min(78vh, 560px);
            border-radius: 18px 18px 0 0;
            transform: translateY(104%);
          }

          .mapFilterPanel.open {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
