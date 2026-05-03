export type KosStatus = 'Raw' | 'Parsed' | 'Reviewed' | 'Rejected';
export type KosType = 'Putri' | 'Putra' | 'Campuran';

export interface KosItem {
  id: string;
  name: string;
  type: KosType;
  status: KosStatus;
  price: string;
  address: string;
  contact: string;
  facilities: string[];
  lat: number;
  lon: number;
  issue: string;
  score: number;
}

export interface MasterUnsItem {
  id: string;
  name: string;
  category: string;
  code: string;
  coordinate: string;
  lat: number;
  lon: number;
  status: 'Valid' | 'Needs Check';
  linkedKos: number;
}

interface ApiKosItem {
  id: string;
  nama?: string;
  jenis_kos?: string;
  alamat?: string;
  harga?: string;
  narahubung?: string;
  narahubung_nama?: string;
  fasilitas?: string;
  lat?: number;
  lon?: number;
  long?: number;
  data_status?: string;
}

interface ApiMasterUnsItem {
  id: string;
  nama: string;
  lat: number;
  lon?: number;
  long?: number;
}

export function normalizeKosType(value: unknown): KosType {
  const text = String(value || '').toLowerCase();
  if (text.includes('putra')) return 'Putra';
  if (text.includes('campur')) return 'Campuran';
  return 'Putri';
}

export function normalizeStatus(value: unknown): KosStatus {
  const text = String(value || '').toLowerCase();
  if (text === 'parsed') return 'Parsed';
  if (text === 'reviewed') return 'Reviewed';
  if (text === 'rejected') return 'Rejected';
  return 'Raw';
}

export function normalizeFacilities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;/|]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export function normalizeApiKos(raw: ApiKosItem): KosItem {
  const facilities = normalizeFacilities(raw.fasilitas);
  const status = normalizeStatus(raw.data_status);
  const hasCoreData = Boolean(raw.nama && raw.alamat && raw.harga && raw.narahubung);

  return {
    id: raw.id,
    name: raw.nama || 'Kos tanpa nama',
    type: normalizeKosType(raw.jenis_kos),
    status,
    price: raw.harga || '-',
    address: raw.alamat || 'Alamat belum lengkap',
    contact: [raw.narahubung_nama, raw.narahubung].filter(Boolean).join(' - ') || '-',
    facilities: facilities.length ? facilities : ['Belum ada fasilitas'],
    lat: raw.lat ?? 0,
    lon: raw.lon ?? raw.long ?? 0,
    issue: status === 'Reviewed' ? 'Siap publish' : hasCoreData ? 'Perlu review' : 'Data inti belum lengkap',
    score: status === 'Reviewed' ? 94 : hasCoreData ? 72 : 38,
  };
}

export function normalizeApiMaster(raw: ApiMasterUnsItem): MasterUnsItem {
  const lon = raw.lon ?? raw.long ?? 0;

  return {
    id: raw.id,
    name: raw.nama,
    category: 'UNS Location',
    code: raw.id,
    coordinate: `${raw.lat}, ${lon}`,
    lat: raw.lat,
    lon,
    status: raw.lat && lon ? 'Valid' : 'Needs Check',
    linkedKos: 0,
  };
}

export async function loadKos(): Promise<KosItem[]> {
  const res = await fetch('/api/kos', { cache: 'no-store' });
  if (!res.ok) throw new Error('Gagal mengambil data kos dari DB.');
  const data = await res.json() as ApiKosItem[];
  return data.map(normalizeApiKos);
}

export async function loadMasterUns(): Promise<MasterUnsItem[]> {
  const res = await fetch('/api/master-uns', { cache: 'no-store' });
  if (!res.ok) throw new Error('Gagal mengambil Master UNS dari DB.');
  const data = await res.json() as ApiMasterUnsItem[];
  return data.map(normalizeApiMaster);
}
