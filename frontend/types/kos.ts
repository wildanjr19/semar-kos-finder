/** Shared kos-related types across production map and clean prototype. */

export type Destination = {
  id: string;
  nama: string;
  lat: number;
  lon: number;
};

export type RawDestination = {
  id?: string;
  nama?: string;
  lat?: string | number;
  lon?: string | number;
};

export type RouteApiResponse = {
  distanceMeters: number;
  duration: string;
  encodedPolyline: string;
};

export type HargaItem = {
  min: number;
  max: number;
  periode: string;
  tipe_kamar: string | null;
  catatan: string | null;
};

export type FasilitasCleaned = {
  dalam_kamar: string[];
  bersama: string[];
  utilitas: string[];
  catatan: string;
};

export type PeraturanCleaned = {
  jam_malam: string | null;
  tamu_lawan_jenis: string[] | string | null;
  tamu_menginap: boolean | null;
  boleh_hewan: boolean | null;
  lainnya: string[];
};

export type KontakItem = {
  nama: string;
  nomor_wa: string;
  url_wa: string;
};

export type KosClean = {
  id: string;
  nama: string;
  jenis_kos: string;
  alamat: string;
  plus_code: string;
  lat: number;
  lon: number;
  ac_status: string;
  tipe_pembayaran: string[];
  harga: HargaItem[];
  fasilitas: FasilitasCleaned;
  peraturan: PeraturanCleaned;
  kontak: KontakItem[];
};

/** Raw kos item as returned by the API (minimal). */
export type RawKos = {
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

/** Production kos item with both raw and parsed data. */
export type Kos = {
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

/** Clean kos item used by the prototype (extends KosClean with sourceId). */
export type CleanKos = KosClean & {
  sourceId: string;
};

export type ParsedContact = {
  href: string | null;
  label: string;
};
