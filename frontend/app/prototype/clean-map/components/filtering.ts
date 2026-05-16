import type { CleanKos, Destination } from "../../../../types/kos";
import type { FilterState } from "./filter-types";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function filterItems(
  items: CleanKos[],
  filter: FilterState,
  destinations: Destination[],
): CleanKos[] {
  const dest = filter.selectedCampus
    ? destinations.find((d) => d.nama === filter.selectedCampus)
    : null;
  const maxKm = filter.distanceMaxKm === "Semua" ? null : parseFloat(filter.distanceMaxKm);

  return items.filter((item) => {
    if (filter.searchText) {
      const q = filter.searchText.toLowerCase();
      const text = `${item.nama} ${item.alamat} ${item.plus_code} ${item.fasilitas?.dalam_kamar?.join(" ") ?? ""} ${item.fasilitas?.bersama?.join(" ") ?? ""} ${item.fasilitas?.utilitas?.join(" ") ?? ""}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    if (filter.selectedGender && item.jenis_kos !== filter.selectedGender) return false;
    if (filter.selectedAc && item.ac_status !== filter.selectedAc) return false;
    if (filter.priceMin || filter.priceMax) {
      const min = parseFloat(filter.priceMin || "0") || 0;
      const max = parseFloat(filter.priceMax || "Infinity") || Infinity;
      const matches = item.harga.some((h) => {
        if (filter.pricePeriod && h.periode !== filter.pricePeriod) return false;
        return h.min >= min && h.max <= max;
      });
      if (!matches) return false;
    }
    if (filter.selectedPaymentTypes.length > 0) {
      if (!item.tipe_pembayaran.some((t) => filter.selectedPaymentTypes.includes(t))) return false;
    }
    if (filter.selectedFacilities.length > 0) {
      const allFas = [
        ...(item.fasilitas?.dalam_kamar ?? []),
        ...(item.fasilitas?.bersama ?? []),
        ...(item.fasilitas?.utilitas ?? []),
      ];
      if (!filter.selectedFacilities.some((f) => allFas.includes(f))) return false;
    }
    if (filter.selectedJamMalam && item.peraturan?.jam_malam !== filter.selectedJamMalam) return false;
    if (filter.selectedTamuLawanJenis) {
      const tamuLawanJenis = item.peraturan?.tamu_lawan_jenis;
      const matchesTamuLawanJenis = Array.isArray(tamuLawanJenis)
        ? tamuLawanJenis.includes(filter.selectedTamuLawanJenis)
        : tamuLawanJenis === filter.selectedTamuLawanJenis;
      if (!matchesTamuLawanJenis) return false;
    }
    if (filter.selectedTamuMenginap && filter.selectedTamuMenginap !== "Semua" && String(item.peraturan?.tamu_menginap) !== filter.selectedTamuMenginap) return false;
    if (filter.selectedBolehHewan && filter.selectedBolehHewan !== "Semua" && String(item.peraturan?.boleh_hewan) !== filter.selectedBolehHewan) return false;
    if (dest && maxKm != null && maxKm > 0) {
      const d = haversine(item.lat, item.lon, dest.lat, dest.lon);
      if (d > maxKm) return false;
    }
    return true;
  });
}
