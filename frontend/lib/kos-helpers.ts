/** Shared kos-related helper functions. */

import type { HargaItem, Kos } from "../types/kos";

export function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function asHargaItems(value: unknown): HargaItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    min: toNumber(item.min as string | number | undefined) || 0,
    max: toNumber(item.max as string | number | undefined) || 0,
    periode: String(item.periode ?? "bulanan"),
    tipe_kamar:
      typeof item.tipe_kamar === "string" && item.tipe_kamar.trim()
        ? item.tipe_kamar.trim()
        : null,
    catatan:
      typeof item.catatan === "string" && item.catatan.trim()
        ? item.catatan.trim()
        : null,
  }));
}

export function decodeEncodedPolyline(encoded: string): Array<[number, number]> {
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

export function formatDistanceMeters(distanceMeters: number): string {
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
  return `${Math.round(distanceMeters)} m`;
}

export function formatDuration(durationValue: string): string {
  const seconds = Number.parseInt(durationValue.replace("s", ""), 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return durationValue;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit`;
  return `${seconds} detik`;
}

export function normalizeJenisKos(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.includes("putri")) return "Putri";
  if (cleaned.includes("putra")) return "Putra";
  if (cleaned.includes("campur")) return "Campuran";
  return "Tidak diketahui";
}

export function normalizeTamuLawanJenis(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function formatPrice(harga: HargaItem): string {
  const min = harga.min.toLocaleString("id-ID");
  const max = harga.max.toLocaleString("id-ID");
  const range =
    harga.min === harga.max || harga.max === 0 ? `Rp ${min}` : `Rp ${min} - ${max}`;
  return `${range} / ${harga.periode}`;
}

export function isCleanData(kos: Kos): boolean {
  return kos.data_status === "reviewed" && kos.parsed_data != null;
}

export function normalizeWaHref(rawUrl: string): string | null {
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

export function parseContact(raw: string): { href: string | null; label: string } {
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

function normalizeCleanKosRecord(
  clean: Record<string, unknown>,
  sourceIdFallback: string,
): import("../types/kos").CleanKos | null {
  const lat = toNumber(clean.lat as string | number | undefined);
  const lon = toNumber((clean.lon ?? clean.long) as string | number | undefined);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const fasilitasRaw = isRecord(clean.fasilitas) ? clean.fasilitas : {};
  const peraturanRaw = isRecord(clean.peraturan) ? clean.peraturan : {};
  const kontakRaw = Array.isArray(clean.kontak) ? clean.kontak : [];

  return {
    sourceId: String(clean.sourceId ?? clean.id ?? sourceIdFallback),
    id: String(clean.id ?? sourceIdFallback),
    nama: String(clean.nama ?? "Kos tanpa nama"),
    jenis_kos: normalizeJenisKos(String(clean.jenis_kos ?? "Tidak diketahui")),
    alamat: String(clean.alamat ?? ""),
    plus_code: String(clean.plus_code ?? ""),
    lat,
    lon,
    ac_status: String(clean.ac_status ?? ""),
    tipe_pembayaran: asStringArray(clean.tipe_pembayaran),
    harga: asHargaItems(clean.harga),
    fasilitas: {
      dalam_kamar: asStringArray(fasilitasRaw.dalam_kamar),
      bersama: asStringArray(fasilitasRaw.bersama),
      utilitas: asStringArray(fasilitasRaw.utilitas),
      catatan: String(fasilitasRaw.catatan ?? ""),
    },
    peraturan: {
      jam_malam:
        typeof peraturanRaw.jam_malam === "string" && peraturanRaw.jam_malam.trim()
          ? peraturanRaw.jam_malam.trim()
          : null,
      tamu_lawan_jenis:
        Array.isArray(peraturanRaw.tamu_lawan_jenis) ||
        typeof peraturanRaw.tamu_lawan_jenis === "string"
          ? peraturanRaw.tamu_lawan_jenis
          : [],
      tamu_menginap:
        typeof peraturanRaw.tamu_menginap === "boolean"
          ? peraturanRaw.tamu_menginap
          : null,
      boleh_hewan:
        typeof peraturanRaw.boleh_hewan === "boolean"
          ? peraturanRaw.boleh_hewan
          : null,
      lainnya: asStringArray(peraturanRaw.lainnya),
    },
    kontak: kontakRaw
      .filter(isRecord)
      .map((kontak) => ({
        nama: String(kontak.nama ?? ""),
        nomor_wa: String(kontak.nomor_wa ?? ""),
        url_wa: String(kontak.url_wa ?? ""),
      }))
      .filter((kontak) => kontak.nomor_wa || kontak.url_wa),
  };
}

export function normalizeCleanKos(raw: unknown): import("../types/kos").CleanKos | null {
  if (!isRecord(raw)) return null;
  const item = raw as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(item, "data_status")) {
    if (String(item.data_status ?? "").toLowerCase() !== "reviewed") return null;
    if (!isRecord(item.parsed_data)) return null;
    return normalizeCleanKosRecord(item.parsed_data, String(item.id ?? ""));
  }

  return normalizeCleanKosRecord(item, String(item.id ?? item.sourceId ?? ""));
}

export function getJenisBadgeColor(jenis: string): { bg: string; text: string; border: string } {
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

export function getMarkerGradient(jenis: string): string {
  if (jenis === "Putri") return "linear-gradient(135deg, #f9a8d4 0%, #fce7f3 100%)";
  if (jenis === "Putra") return "linear-gradient(135deg, #93c5fd 0%, #dbeafe 100%)";
  return "linear-gradient(135deg, #86efac 0%, #dcfce7 100%)";
}

export function getMarkerTextColor(jenis: string): string {
  if (jenis === "Putri") return "#9d174d";
  if (jenis === "Putra") return "#1d4ed8";
  return "#166534";
}

export function getMarkerLetter(jenis: string): string {
  if (jenis === "Putri") return "P";
  if (jenis === "Putra") return "L";
  return "C";
}

export function markerColors(jenis: string) {
  if (jenis === "Putri") return { bg: "#fdf2f8", border: "#ec4899", text: "#9d174d", letter: "P" };
  if (jenis === "Putra") return { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", letter: "L" };
  if (jenis === "Campuran") return { bg: "#f0fdf4", border: "#22c55e", text: "#166534", letter: "C" };
  return { bg: "#f8fafc", border: "#64748b", text: "#334155", letter: "?" };
}
