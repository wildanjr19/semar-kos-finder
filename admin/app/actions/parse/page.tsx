'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, PrototypeChrome } from '../../prototype/chrome';
import { normalizeKosType } from '../../prototype/shared';
import styles from '../../prototype/prototype.module.css';
import { useJobEvents, JobConnectionStatus } from '@/hooks/useJobEvents';
import { HargaEditor, FasilitasEditor, PeraturanEditor, KontakEditor } from '@/components/parse/InlineEditors';
import { useUserLlmConfig } from '@/hooks/useUserLlmConfig';

type DataStatus = 'raw' | 'parsed' | 'reviewed' | 'rejected';
type ParseStatus = 'idle' | 'todo' | 'in_progress' | 'parsing' | 'done' | 'error' | 'cancelled';
type QueueFilter = 'all' | 'raw' | 'parsed' | 'reviewed' | 'rejected' | 'todo' | 'in_progress' | 'error';
type DetailTab = 'raw' | 'cleaned' | 'feedback' | 'confidence';
type ReviewSection = 'harga' | 'kontak' | 'fasilitas' | 'peraturan' | 'identity';
type BadgeTone = 'raw' | 'parsed' | 'reviewed' | 'rejected' | 'blue' | 'rose' | 'amber';

interface HargaItem {
  min: number;
  max: number;
  periode: 'bulanan' | 'semesteran' | 'tahunan' | 'per3bulan' | 'mingguan';
  tipe_kamar: string | null;
  catatan: string | null;
}

interface FasilitasCleaned {
  dalam_kamar: string[];
  bersama: string[];
  utilitas: string[];
  catatan: string;
}

interface PeraturanCleaned {
  jam_malam: string | null;
  tamu_lawan_jenis: Array<'dilarang' | 'terbatas' | 'bebas'>;
  tamu_menginap: boolean | null;
  boleh_hewan: boolean | null;
  lainnya: string[];
}

interface KontakItem {
  nama: string;
  nomor_wa: string;
  url_wa: string;
}

interface KosClean {
  id: string;
  nama: string;
  jenis_kos: 'Putri' | 'Putra' | 'Campuran';
  alamat: string;
  plus_code: string;
  lat: number;
  lon: number;
  ac_status: 'ac' | 'non_ac' | 'keduanya';
  tipe_pembayaran: string[];
  harga: HargaItem[];
  fasilitas: FasilitasCleaned;
  peraturan: PeraturanCleaned;
  kontak: KontakItem[];
}

interface ParseEntryPayload {
  id: string;
  No: string;
  'Nama kos': string;
  'Jenis kos': string;
  Alamat: string;
  Plus_Code: string;
  Fasilitas: string;
  Peraturan: string;
  Harga: string;
  Narahubung: string;
  lat: number;
  long: number;
  ac_status: string;
  tipe_pembayaran: string[];
  data_status: DataStatus;
}

interface ApiKosItem {
  id: string;
  nama?: string;
  jenis_kos?: string;
  alamat?: string;
  harga?: string;
  fasilitas?: string;
  peraturan?: string;
  narahubung?: string;
  narahubung_nama?: string;
  plus_code?: string;
  lat?: number | string;
  lon?: number | string;
  long?: number | string;
  ac_status?: string;
  tipe_pembayaran?: string[] | null;
  data_status?: string;
  parsed_data?: unknown;
}

interface QueueItem {
  id: string;
  name: string;
  type: 'Putri' | 'Putra' | 'Campuran';
  statusKey: DataStatus;
  statusLabel: 'Raw' | 'Parsed' | 'Reviewed' | 'Rejected';
  priceRaw: string;
  address: string;
  contactRaw: string;
  facilitiesRaw: string;
  rulesRaw: string;
  issue: string;
  score: number;
  parseStatus: ParseStatus;
  parseError: string | null;
  clean: KosClean | null;
  feedbackPrompt: string;
  editedClean: Partial<KosClean> | null;
  parseEntry: ParseEntryPayload;
}

interface ConfidenceResult {
  value: number;
  label: 'High' | 'Medium' | 'Low';
  details: Array<{ label: string; score: number; max: number; note: string }>;
}

interface LlmConfig {
  api_base: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

interface LlmProfile {
  id: string;
  name: string;
  config: LlmConfig;
}

const LLM_PROFILES_STORAGE_KEY = 'llm_profiles_v1';
const LLM_ACTIVE_PROFILE_STORAGE_KEY = 'llm_active_profile_v1';

const CONNECTION_STATUS_LABELS: Record<JobConnectionStatus, string> = {
  live: 'live',
  reconnecting: 'reconnecting',
  polling: 'polling',
};

const MODEL_PRESETS = [
  { label: 'OpenAI GPT-4.1', base: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  { label: 'OpenAI GPT-4.1 Mini', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  { label: 'OpenAI GPT-4o', base: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'OpenAI GPT-4o Mini', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenAI o4-mini', base: 'https://api.openai.com/v1', model: 'o4-mini' },
  { label: 'OpenRouter Claude Sonnet 4', base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  { label: 'OpenRouter Gemini 2.5 Pro', base: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.5-pro' },
  { label: 'OpenRouter DeepSeek V3', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat-v3-0324' },
  { label: 'Groq Llama 3.3 70B', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'DeepSeek API (deepseek-chat)', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Custom...', base: '', model: '' },
];

const REVIEW_SECTIONS: Array<{ key: ReviewSection; label: string; hint: string }> = [
  { key: 'harga', label: 'Harga', hint: 'Range, periode, tipe kamar' },
  { key: 'kontak', label: 'Kontak', hint: 'Nama narahubung dan nomor WA' },
  { key: 'fasilitas', label: 'Fasilitas', hint: 'Kamar, bersama, utilitas' },
  { key: 'peraturan', label: 'Peraturan', hint: 'Tamu, jam malam, hewan' },
  { key: 'identity', label: 'Identitas', hint: 'Nama, alamat, koordinat' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asKosClean(value: unknown): KosClean | null {
  if (!isRecord(value)) return null;
  const clean = value as unknown as KosClean;
  const tamu = clean?.peraturan?.tamu_lawan_jenis;
  if (typeof tamu === 'string') {
    clean.peraturan.tamu_lawan_jenis = [tamu];
  } else if (!Array.isArray(tamu)) {
    clean.peraturan.tamu_lawan_jenis = [];
  }
  return clean;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeDataStatus(value: unknown): DataStatus {
  const text = String(value || '').toLowerCase();
  if (text === 'parsed') return 'parsed';
  if (text === 'reviewed') return 'reviewed';
  if (text === 'rejected') return 'rejected';
  return 'raw';
}

function statusLabel(status: DataStatus): 'Raw' | 'Parsed' | 'Reviewed' | 'Rejected' {
  if (status === 'parsed') return 'Parsed';
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'rejected') return 'Rejected';
  return 'Raw';
}

function parseStatusFromJobItem(status: string): ParseStatus {
  if (status === 'todo') return 'todo';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'done') return 'done';
  if (status === 'error') return 'error';
  return 'cancelled';
}

function parseStatusLabel(status: ParseStatus): string {
  if (status === 'idle') return '-';
  if (status === 'todo') return 'queued';
  if (status === 'in_progress') return 'in progress';
  if (status === 'parsing') return 'parsing';
  if (status === 'done') return 'done';
  if (status === 'cancelled') return 'cancelled';
  return 'error';
}

function parseStatusTone(status: ParseStatus): BadgeTone {
  if (status === 'done') return 'parsed';
  if (status === 'error' || status === 'cancelled') return 'rejected';
  if (status === 'in_progress' || status === 'parsing') return 'blue';
  if (status === 'todo') return 'amber';
  return 'raw';
}

function parseStatusIssue(status: ParseStatus, error?: string | null): string {
  if (status === 'todo') return 'Masuk antrean batch parse.';
  if (status === 'in_progress' || status === 'parsing') return 'Sedang dikirim ke LLM.';
  if (status === 'done') return 'Hasil parse siap direview';
  if (status === 'cancelled') return 'Batch dibatalkan sebelum selesai.';
  if (status === 'error') return error || 'Parse gagal. Perlu prompt ulang.';
  return '';
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.error === 'string') return payload.error;

  const detail = payload.detail;
  if (typeof detail === 'string') return detail;
  if (isRecord(detail) && typeof detail.error === 'string') return detail.error;

  return fallback;
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatHargaSnippet(harga: HargaItem[] | null): string {
  if (!Array.isArray(harga) || harga.length === 0) return '-';
  return harga
    .map((item) => {
      const min = Number(item.min || 0).toLocaleString('id-ID');
      const max = Number(item.max || 0).toLocaleString('id-ID');
      const range = item.min === item.max ? `Rp ${min}` : `Rp ${min} - ${max}`;
      const room = item.tipe_kamar ? ` (${item.tipe_kamar})` : '';
      return `${range} / ${item.periode}${room}`;
    })
    .join(' · ');
}

function formatKontakSnippet(kontak: KontakItem[] | null): string {
  if (!Array.isArray(kontak) || kontak.length === 0) return '-';
  return kontak
    .slice(0, 2)
    .map((item) => item.nama ? `${item.nama} (${item.nomor_wa})` : item.nomor_wa)
    .join(', ');
}

function formatList(values: string[] | null | undefined): string {
  if (!Array.isArray(values) || values.length === 0) return '-';
  return values.filter(Boolean).join(', ') || '-';
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return 'Diizinkan';
  if (value === false) return 'Dilarang';
  return '-';
}

function formatFasilitasSnippet(fasilitas: FasilitasCleaned | null | undefined): string {
  if (!fasilitas) return '-';
  const parts = [
    fasilitas.dalam_kamar?.length ? `Kamar: ${fasilitas.dalam_kamar.join(', ')}` : '',
    fasilitas.bersama?.length ? `Bersama: ${fasilitas.bersama.join(', ')}` : '',
    fasilitas.utilitas?.length ? `Utilitas: ${fasilitas.utilitas.join(', ')}` : '',
    fasilitas.catatan ? `Catatan: ${fasilitas.catatan}` : '',
  ].filter(Boolean);
  return parts.join('\n') || '-';
}

function formatPeraturanSnippet(peraturan: PeraturanCleaned | null | undefined): string {
  if (!peraturan) return '-';
  const parts = [
    peraturan.jam_malam ? `Jam malam: ${peraturan.jam_malam}` : '',
    peraturan.tamu_lawan_jenis?.length ? `Tamu lawan jenis: ${peraturan.tamu_lawan_jenis.join(', ')}` : '',
    peraturan.tamu_menginap !== null ? `Tamu menginap: ${formatBoolean(peraturan.tamu_menginap)}` : '',
    peraturan.boleh_hewan !== null ? `Hewan: ${formatBoolean(peraturan.boleh_hewan)}` : '',
    peraturan.lainnya?.length ? `Lainnya: ${peraturan.lainnya.join(', ')}` : '',
  ].filter(Boolean);
  return parts.join('\n') || '-';
}

function formatRawSectionSummary(item: QueueItem, section: ReviewSection): string {
  if (section === 'harga') return item.priceRaw;
  if (section === 'kontak') return item.contactRaw;
  if (section === 'fasilitas') return item.facilitiesRaw;
  if (section === 'peraturan') return item.rulesRaw;
  return [
    item.name,
    item.address,
    item.parseEntry.Plus_Code ? `Plus code: ${item.parseEntry.Plus_Code}` : '',
    item.parseEntry.ac_status ? `AC: ${item.parseEntry.ac_status}` : '',
  ].filter(Boolean).join('\n') || '-';
}

function buildQueueItem(raw: ApiKosItem): QueueItem {
  const statusKey = normalizeDataStatus(raw.data_status);
  const clean = asKosClean(raw.parsed_data);
  const hasCoreData = Boolean(raw.nama && raw.alamat && raw.harga && raw.narahubung);

  const issue =
    statusKey === 'reviewed'
      ? 'Siap publish'
      : statusKey === 'rejected'
        ? 'Ditolak reviewer'
        : clean
          ? 'Hasil parse siap direview'
          : hasCoreData
            ? 'Data siap parse'
            : 'Data inti belum lengkap';

  const score =
    statusKey === 'reviewed'
      ? 94
      : statusKey === 'rejected'
        ? 42
        : clean
          ? 80
          : hasCoreData
            ? 63
            : 38;

  const lat = toNumber(raw.lat);
  const lon = raw.lon != null ? toNumber(raw.lon) : toNumber(raw.long);

  return {
    id: raw.id,
    name: raw.nama || 'Kos tanpa nama',
    type: normalizeKosType(raw.jenis_kos),
    statusKey,
    statusLabel: statusLabel(statusKey),
    priceRaw: raw.harga || '-',
    address: raw.alamat || 'Alamat belum lengkap',
    contactRaw: raw.narahubung || '-',
    facilitiesRaw: raw.fasilitas || '-',
    rulesRaw: raw.peraturan || '-',
    issue,
    score,
    parseStatus: clean ? 'done' : 'idle',
    parseError: null,
    clean,
    feedbackPrompt: '',
    editedClean: null,
    parseEntry: {
      id: raw.id,
      No: raw.id,
      'Nama kos': raw.nama || '',
      'Jenis kos': raw.jenis_kos || 'Tidak diketahui',
      Alamat: raw.alamat || '',
      Plus_Code: raw.plus_code || '',
      Fasilitas: raw.fasilitas || '',
      Peraturan: raw.peraturan || '',
      Harga: raw.harga || '',
      Narahubung: raw.narahubung || '',
      lat,
      long: lon,
      ac_status: raw.ac_status || '',
      tipe_pembayaran: Array.isArray(raw.tipe_pembayaran) ? raw.tipe_pembayaran : [],
      data_status: statusKey,
    },
  };
}

function mergeClean(item: QueueItem | null): KosClean | null {
  if (!item?.clean) return null;
  if (!item.editedClean) return item.clean;
  return { ...item.clean, ...item.editedClean } as KosClean;
}

function computeConfidence(item: QueueItem | null): ConfidenceResult {
  if (!item) {
    return { value: 0, label: 'Low', details: [] };
  }
  const clean = mergeClean(item);
  const details: ConfidenceResult['details'] = [];

  const hargaValid = clean?.harga && clean.harga.length > 0 && clean.harga.every((h) => Number(h.min) > 0 && Number(h.max) >= Number(h.min));
  details.push({
    label: 'Harga valid',
    score: hargaValid ? 20 : 0,
    max: 20,
    note: hargaValid ? 'Range harga terbaca.' : 'Harga kosong atau tidak valid.',
  });

  const kontakCount = clean?.kontak?.length || 0;
  const kontakValidCount = (clean?.kontak || []).filter((k) => /^62\d{8,15}$/.test((k.nomor_wa || '').trim())).length;
  const kontakScore = kontakCount === 0 ? 0 : Math.round((kontakValidCount / kontakCount) * 15);
  details.push({
    label: 'Kontak WA valid',
    score: kontakScore,
    max: 15,
    note: kontakCount === 0 ? 'Kontak kosong.' : `${kontakValidCount}/${kontakCount} kontak valid.`,
  });

  const rawFacilityTokens = (item.facilitiesRaw || '').split(/[,;/|]+/).map((x) => x.trim()).filter(Boolean);
  const cleanFacilityCount = (clean?.fasilitas?.dalam_kamar?.length || 0) + (clean?.fasilitas?.bersama?.length || 0) + (clean?.fasilitas?.utilitas?.length || 0);
  const fasilitasRatio = rawFacilityTokens.length === 0 ? 0 : Math.min(1, cleanFacilityCount / rawFacilityTokens.length);
  details.push({
    label: 'Fasilitas terpetakan',
    score: Math.round(fasilitasRatio * 15),
    max: 15,
    note: rawFacilityTokens.length === 0 ? 'Fasilitas raw kosong.' : `${cleanFacilityCount} clean dari ${rawFacilityTokens.length} token raw.`,
  });

  const peraturanFill = clean?.peraturan
    ? [
      clean.peraturan.jam_malam,
      clean.peraturan.tamu_lawan_jenis.length > 0 ? clean.peraturan.tamu_lawan_jenis : null,
      clean.peraturan.tamu_menginap,
      clean.peraturan.boleh_hewan,
    ].filter((v) => v !== null && v !== '').length
    : 0;
  details.push({
    label: 'Peraturan terstruktur',
    score: Math.round((peraturanFill / 4) * 10),
    max: 10,
    note: `${peraturanFill}/4 field utama terisi.`,
  });

  const coordValid = clean ? Number.isFinite(clean.lat) && Number.isFinite(clean.lon) && clean.lat !== 0 && clean.lon !== 0 : false;
  details.push({
    label: 'Koordinat valid',
    score: coordValid ? 10 : 0,
    max: 10,
    note: coordValid ? 'Lat/Lon valid.' : 'Lat/Lon belum valid.',
  });

  const textRaw = `${item.name} ${item.address} ${item.priceRaw} ${item.contactRaw}`.toLowerCase();
  let consistency = 15;
  if (clean) {
    if (clean.nama && !textRaw.includes(clean.nama.toLowerCase().slice(0, 8))) consistency -= 5;
    if (clean.alamat && !textRaw.includes(clean.alamat.toLowerCase().slice(0, 8))) consistency -= 5;
    if ((clean.kontak || []).length === 0) consistency -= 5;
  } else {
    consistency = 0;
  }
  consistency = Math.max(0, consistency);
  details.push({
    label: 'Konsistensi raw-clean',
    score: consistency,
    max: 15,
    note: consistency >= 10 ? 'Tidak ada konflik besar.' : 'Ada indikasi mismatch.',
  });

  const completenessFields = clean
    ? [clean.nama, clean.jenis_kos, clean.alamat, clean.plus_code, clean.ac_status].filter((v) => String(v || '').trim().length > 0).length
    : 0;
  details.push({
    label: 'Kelengkapan field inti',
    score: Math.round((completenessFields / 5) * 15),
    max: 15,
    note: `${completenessFields}/5 field inti terisi.`,
  });

  const value = Math.max(0, Math.min(100, details.reduce((sum, d) => sum + d.score, 0)));
  const label: 'High' | 'Medium' | 'Low' = value >= 85 ? 'High' : value >= 70 ? 'Medium' : 'Low';
  return { value, label, details };
}

function appendStoredJobId(jobId: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = window.localStorage.getItem('parse_jobs');
    const parsed = current ? JSON.parse(current) : [];
    const list = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    if (!list.includes(jobId)) {
      list.push(jobId);
      window.localStorage.setItem('parse_jobs', JSON.stringify(list));
    }
  } catch {
    // ignore local storage failure
  }
}

function removeStoredJobId(jobId: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = window.localStorage.getItem('parse_jobs');
    const parsed = current ? JSON.parse(current) : [];
    const list = Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string' && id !== jobId)
      : [];
    window.localStorage.setItem('parse_jobs', JSON.stringify(list));
  } catch {
    // ignore local storage failure
  }
}

export default function PrototypeCleanDataPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [message, setMessage] = useState('Pilih item. Parse pakai LLM lalu approve/reject ke DB.');
  const [detailTab, setDetailTab] = useState<DetailTab>('raw');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSection, setReviewSection] = useState<ReviewSection>('harga');
  const [llmPanelOpen, setLlmPanelOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({ api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 });
  const [llmProfiles, setLlmProfiles] = useState<LlmProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState('');
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobSourceIds, setActiveJobSourceIds] = useState<string[]>([]);
  const prevJobStatusRef = useRef<string>('');

  const handleMissingJob = useCallback((jobId: string) => {
    removeStoredJobId(jobId);
    setActiveJobId((current) => (current === jobId ? null : current));
    setActiveJobSourceIds([]);
    setMessage(`Batch ${jobId} sudah tidak tersedia. Status lokal dibersihkan.`);
  }, []);

  const jobIds = useMemo(() => activeJobId ? [activeJobId] : [], [activeJobId]);
  const { jobs, connectionStatus } = useJobEvents(jobIds, { interval: 2000, onMissing: handleMissingJob });
  const activeJob = activeJobId ? jobs[activeJobId] || null : null;

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );
  const selectedClean = useMemo(() => mergeClean(selected), [selected]);
  const confidence = useMemo(() => computeConfidence(selected), [selected]);
  const { config: savedConfig, saveConfig } = useUserLlmConfig();

  useEffect(() => {
    if (!savedConfig) return;
    setLlmConfig(savedConfig);
  }, [savedConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawProfiles = window.localStorage.getItem(LLM_PROFILES_STORAGE_KEY);
      const rawActive = window.localStorage.getItem(LLM_ACTIVE_PROFILE_STORAGE_KEY);
      const parsed = rawProfiles ? JSON.parse(rawProfiles) : [];
      const profiles = Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string' && p.config) as LlmProfile[] : [];

      if (profiles.length > 0) {
        setLlmProfiles(profiles);
        const activeId = rawActive && profiles.some((p) => p.id === rawActive) ? rawActive : profiles[0].id;
        setActiveProfileId(activeId);
        const active = profiles.find((p) => p.id === activeId);
        if (active) setLlmConfig(active.config);
      }
    } catch {
      // ignore storage parse errors
    }
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;
    setLlmProfiles((prev) => prev.map((profile) => (
      profile.id === activeProfileId
        ? { ...profile, config: llmConfig }
        : profile
    )));
  }, [llmConfig, activeProfileId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (llmProfiles.length === 0) {
      window.localStorage.removeItem(LLM_PROFILES_STORAGE_KEY);
      window.localStorage.removeItem(LLM_ACTIVE_PROFILE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(LLM_PROFILES_STORAGE_KEY, JSON.stringify(llmProfiles));
    if (activeProfileId) {
      window.localStorage.setItem(LLM_ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
    }
  }, [llmProfiles, activeProfileId]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/kos', { cache: 'no-store' });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal mengambil queue clean data.'));
      }
      if (!Array.isArray(payload)) {
        throw new Error('Response queue clean data tidak valid.');
      }

      const nextItems = payload.map((raw) => buildQueueItem(raw as ApiKosItem));
      setItems(nextItems);
      setSelectedIds((current) => {
        const next = new Set<string>();
        const validIds = new Set(nextItems.map((item) => item.id));
        for (const id of current) {
          if (validIds.has(id)) next.add(id);
        }
        return next;
      });
      setSelectedId((current) => {
        if (current && nextItems.some((item) => item.id === current)) return current;
        const fallback = nextItems.find((item) => item.statusKey !== 'reviewed') || nextItems[0];
        return fallback ? fallback.id : null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal mengambil queue clean data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (activeJobId || typeof window === 'undefined') return;
    try {
      const current = window.localStorage.getItem('parse_jobs');
      const parsed = current ? JSON.parse(current) : [];
      const list = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
      if (list.length > 0) setActiveJobId(list[0]);
    } catch {
      // ignore local storage failure
    }
  }, [activeJobId]);

  useEffect(() => {
    if (!activeJob) return;

    setItems((current) => {
      const next = [...current];
      const indexById = new Map(next.map((item, index) => [item.id, index]));

      for (const jobItem of activeJob.items || []) {
        const sourceId = jobItem.id || activeJobSourceIds[jobItem.index] || '';
        const queueIndex = indexById.get(sourceId);
        if (queueIndex == null) continue;

        const currentItem = next[queueIndex];
        const parseStatus = parseStatusFromJobItem(jobItem.status);
        next[queueIndex] = {
          ...currentItem,
          parseStatus,
          parseError: jobItem.error,
          issue: parseStatusIssue(parseStatus, jobItem.error),
          score: parseStatus === 'error' ? Math.max(35, currentItem.score - 8) : currentItem.score,
        };
      }

      for (const result of activeJob.results || []) {
        const jobItem = (activeJob.items || []).find((item) => item.index === result.index);
        const sourceId = jobItem?.id || activeJobSourceIds[result.index] || '';
        const queueIndex = indexById.get(sourceId);
        if (queueIndex == null) continue;

        const currentItem = next[queueIndex];
        next[queueIndex] = {
          ...currentItem,
          statusKey: 'parsed',
          statusLabel: 'Parsed',
          parseStatus: 'done',
          parseError: null,
          clean: asKosClean(result.clean) || currentItem.clean,
          issue: 'Hasil parse siap direview',
          score: Math.max(currentItem.score, 82),
        };
      }

      for (const jobError of activeJob.errors || []) {
        const jobItem = (activeJob.items || []).find((item) => item.index === jobError.index);
        const sourceId = jobItem?.id || activeJobSourceIds[jobError.index] || '';
        const queueIndex = indexById.get(sourceId);
        if (queueIndex == null) continue;

        const currentItem = next[queueIndex];
        next[queueIndex] = {
          ...currentItem,
          parseStatus: 'error',
          parseError: jobError.error,
          issue: 'Parse gagal. Perlu prompt ulang.',
          score: Math.max(35, currentItem.score - 8),
        };
      }

      return next;
    });

    const previousStatus = prevJobStatusRef.current;
    if (previousStatus !== activeJob.status) {
      prevJobStatusRef.current = activeJob.status;

      if (activeJob.status === 'done') {
        setMessage(
          `Batch ${activeJob.job_id} selesai. ${activeJob.completed}/${activeJob.total} done, ${activeJob.failed} gagal.`,
        );
        removeStoredJobId(activeJob.job_id);
        setActiveJobId(null);
        setActiveJobSourceIds([]);
        void loadQueue();
      }

      if (activeJob.status === 'cancelled') {
        setMessage(`Batch ${activeJob.job_id} dibatalkan.`);
        removeStoredJobId(activeJob.job_id);
        setActiveJobId(null);
        setActiveJobSourceIds([]);
      }

      if (activeJob.status === 'error') {
        setError(`Batch ${activeJob.job_id} error. Cek detail jobs.`);
        removeStoredJobId(activeJob.job_id);
        setActiveJobId(null);
        setActiveJobSourceIds([]);
      }
    }
  }, [activeJob, activeJobSourceIds, loadQueue]);

  useEffect(() => {
    if (activeJobId) prevJobStatusRef.current = '';
  }, [activeJobId]);

  const counts = useMemo(() => ({
    all: items.length,
    raw: items.filter((item) => item.statusKey === 'raw').length,
    parsed: items.filter((item) => item.statusKey === 'parsed').length,
    reviewed: items.filter((item) => item.statusKey === 'reviewed').length,
    rejected: items.filter((item) => item.statusKey === 'rejected').length,
    todo: items.filter((item) => item.parseStatus === 'todo').length,
    in_progress: items.filter((item) => item.parseStatus === 'in_progress' || item.parseStatus === 'parsing').length,
    error: items.filter((item) => item.parseStatus === 'error').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'todo') return items.filter((item) => item.parseStatus === 'todo');
    if (filter === 'in_progress') return items.filter((item) => item.parseStatus === 'in_progress' || item.parseStatus === 'parsing');
    if (filter === 'error') return items.filter((item) => item.parseStatus === 'error');
    return items.filter((item) => item.statusKey === filter);
  }, [filter, items]);

  const reviewCandidates = useMemo(
    () => items.filter((item) => item.statusKey === 'parsed' && Boolean(mergeClean(item))),
    [items],
  );

  const reviewIndex = useMemo(
    () => selected ? reviewCandidates.findIndex((item) => item.id === selected.id) : -1,
    [reviewCandidates, selected],
  );

  const reviewPosition = reviewIndex >= 0 ? reviewIndex + 1 : 0;
  const reviewTotal = reviewCandidates.length;
  const hasPreviousReview = reviewIndex > 0;
  const hasNextReview = reviewIndex >= 0 && reviewIndex < reviewCandidates.length - 1;
  const canGoNextReview = reviewCandidates.length > 0 && (reviewIndex < 0 || hasNextReview);

  const batchCandidates = useMemo(
    () => filteredItems.filter((item) => item.statusKey === 'raw' || item.parseStatus === 'error'),
    [filteredItems],
  );

  const selectedBatchCount = useMemo(
    () => batchCandidates.filter((item) => selectedIds.has(item.id)).length,
    [batchCandidates, selectedIds],
  );

  const openReview = useCallback((id?: string) => {
    const explicit = id ? items.find((item) => item.id === id) || null : null;
    const selectedCandidate = selected?.statusKey === 'parsed' && selectedClean ? selected : null;
    const target = explicit || selectedCandidate || reviewCandidates[0] || selected;
    if (!target) return;
    setSelectedId(target.id);
    setReviewSection('harga');
    setReviewOpen(true);
  }, [items, reviewCandidates, selected, selectedClean]);

  const goPreviousReviewable = useCallback(() => {
    if (reviewCandidates.length === 0) {
      setMessage('Tidak ada parsed item yang perlu direview.');
      return;
    }

    const currentIndex = selected ? reviewCandidates.findIndex((item) => item.id === selected.id) : -1;
    const target = currentIndex > 0 ? reviewCandidates[currentIndex - 1] : null;
    if (!target) {
      setMessage('Sudah di parsed item pertama.');
      return;
    }

    setSelectedId(target.id);
    setReviewOpen(true);
  }, [reviewCandidates, selected]);

  const goNextReviewable = useCallback(() => {
    if (reviewCandidates.length === 0) {
      setMessage('Tidak ada parsed item yang perlu direview.');
      return;
    }

    const currentIndex = selected ? reviewCandidates.findIndex((item) => item.id === selected.id) : -1;
    const target = currentIndex >= 0 ? reviewCandidates[currentIndex + 1] : reviewCandidates[0];
    if (!target) {
      setMessage('Sudah di parsed item terakhir.');
      return;
    }

    setSelectedId(target.id);
    setReviewOpen(true);
  }, [reviewCandidates, selected]);

  useEffect(() => {
    if (!reviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

      if (event.key === 'Escape') {
        setReviewOpen(false);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPreviousReviewable();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNextReviewable();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNextReviewable, goPreviousReviewable, reviewOpen]);

  const updateQueueItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllBatchCandidates = useCallback(() => {
    setSelectedIds((current) => {
      const allSelected = batchCandidates.length > 0 && batchCandidates.every((item) => current.has(item.id));
      const next = new Set(current);
      if (allSelected) {
        for (const item of batchCandidates) next.delete(item.id);
      } else {
        for (const item of batchCandidates) next.add(item.id);
      }
      return next;
    });
  }, [batchCandidates]);

  const parseSelected = async () => {
    if (!selected) return;
    setWorking(true);
    setError('');
    updateQueueItem(selected.id, { parseStatus: 'parsing', parseError: null, issue: parseStatusIssue('parsing') });
    try {
      const response = await fetch('/api/actions/parse/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: selected.parseEntry, override_config: llmConfig }),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal parse item terpilih.'));
      }
      if (!isRecord(payload)) {
        throw new Error('Response parse item tidak valid.');
      }

      const clean = asKosClean(payload);
      if (!clean) {
        throw new Error('Response parse item tidak valid.');
      }

      updateQueueItem(selected.id, {
        statusKey: 'parsed',
        statusLabel: 'Parsed',
        parseStatus: 'done',
        parseError: null,
        clean,
        editedClean: null,
        issue: 'Hasil parse siap direview',
        score: Math.max(selected.score, 82),
      });
      setMessage(`${selected.name} selesai di-parse. Review lalu approve/reject.`);
    } catch (parseError) {
      const messageText = parseError instanceof Error ? parseError.message : 'Gagal parse item terpilih.';
      updateQueueItem(selected.id, {
        parseStatus: 'error',
        parseError: messageText,
        issue: 'Parse gagal. Perlu prompt ulang.',
      });
      setError(messageText);
    } finally {
      setWorking(false);
    }
  };

  const reparseWithFeedback = async () => {
    if (!selected) return;
    setWorking(true);
    setError('');
    updateQueueItem(selected.id, { parseStatus: 'parsing', parseError: null, issue: parseStatusIssue('parsing') });
    try {
      const response = await fetch('/api/actions/parse/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entry: selected.parseEntry,
          custom_prompt: selected.feedbackPrompt || undefined,
          override_config: llmConfig,
        }),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal re-review item terpilih.'));
      }
      const clean = asKosClean(payload);
      if (!clean) {
        throw new Error('Response re-review tidak valid.');
      }

      updateQueueItem(selected.id, {
        statusKey: 'parsed',
        statusLabel: 'Parsed',
        parseStatus: 'done',
        parseError: null,
        clean,
        editedClean: null,
        issue: 'Hasil re-review siap dicek ulang.',
        score: Math.max(selected.score, 80),
      });
      setMessage(`${selected.name} selesai re-review dengan feedback.`);
      setDetailTab('cleaned');
    } catch (reviewError) {
      const messageText = reviewError instanceof Error ? reviewError.message : 'Gagal re-review item terpilih.';
      updateQueueItem(selected.id, {
        parseStatus: 'error',
        parseError: messageText,
        issue: 'Re-review gagal. Coba feedback lain.',
      });
      setError(messageText);
    } finally {
      setWorking(false);
    }
  };

  const testLlmConfig = async () => {
    setTestingLlm(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/actions/llm/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(llmConfig),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'LLM test gagal.'));
      }
      if (isRecord(payload) && payload.status === 'ok') {
        setTestResult({ status: 'ok', message: `Connected: ${String(payload.model || llmConfig.model || '-')}` });
      } else {
        const msg = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'LLM test gagal.';
        setTestResult({ status: 'error', message: msg });
      }
    } catch (err) {
      setTestResult({ status: 'error', message: err instanceof Error ? err.message : 'LLM test gagal.' });
    } finally {
      setTestingLlm(false);
    }
  };

  const createProfile = () => {
    const profileName = newProfileName.trim() || `Profile ${llmProfiles.length + 1}`;
    const id = `profile_${Date.now()}`;
    const profile: LlmProfile = { id, name: profileName, config: llmConfig };
    setLlmProfiles((prev) => [...prev, profile]);
    setActiveProfileId(id);
    setNewProfileName('');
    setMessage(`Profile '${profileName}' dibuat.`);
  };

  const switchProfile = (id: string) => {
    const profile = llmProfiles.find((p) => p.id === id);
    if (!profile) return;
    setActiveProfileId(id);
    setLlmConfig(profile.config);
    setMessage(`Active profile: ${profile.name}`);
  };

  const renameActiveProfile = () => {
    if (!activeProfileId) return;
    const nextName = newProfileName.trim();
    if (!nextName) return;
    setLlmProfiles((prev) => prev.map((profile) => (
      profile.id === activeProfileId ? { ...profile, name: nextName } : profile
    )));
    setNewProfileName('');
    setMessage('Profile rename sukses.');
  };

  const deleteActiveProfile = () => {
    if (!activeProfileId) return;
    const filtered = llmProfiles.filter((p) => p.id !== activeProfileId);
    setLlmProfiles(filtered);
    if (filtered.length === 0) {
      setActiveProfileId('');
      setMessage('Profile dihapus.');
      return;
    }
    setActiveProfileId(filtered[0].id);
    setLlmConfig(filtered[0].config);
    setMessage(`Profile dihapus. Active profile -> ${filtered[0].name}`);
  };

  const parseAllRaw = async () => {
    if (activeJobId) return;
    setError('');

    const targetItems = items.filter((item) => item.statusKey === 'raw');
    if (targetItems.length === 0) {
      setMessage('Tidak ada data raw untuk batch parse.');
      return;
    }

    setWorking(true);
    try {
      const response = await fetch('/api/actions/parse/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: targetItems.map((item) => item.parseEntry) }),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal memulai batch parse.'));
      }
      if (!isRecord(payload) || typeof payload.job_id !== 'string') {
        throw new Error('Response batch parse tidak valid.');
      }

      const jobId = payload.job_id;
      appendStoredJobId(jobId);
      setActiveJobId(jobId);
      setActiveJobSourceIds(targetItems.map((item) => item.id));
      setItems((current) => current.map((item) => (
        item.statusKey === 'raw'
          ? { ...item, parseStatus: 'todo', parseError: null, issue: parseStatusIssue('todo') }
          : item
      )));
      setMessage(`Batch parse dimulai (${targetItems.length} entry).`);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Gagal memulai batch parse.');
    } finally {
      setWorking(false);
    }
  };

  const parseBatchSelected = async () => {
    if (activeJobId) return;
    setError('');

    const targetItems = items.filter((item) => selectedIds.has(item.id) && (item.statusKey === 'raw' || item.parseStatus === 'error'));
    if (targetItems.length === 0) {
      setMessage('Pilih item raw/error dulu untuk batch parse.');
      return;
    }

    setWorking(true);
    try {
      const response = await fetch('/api/actions/parse/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: targetItems.map((item) => item.parseEntry), override_config: llmConfig }),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal memulai batch parse terpilih.'));
      }
      if (!isRecord(payload) || typeof payload.job_id !== 'string') {
        throw new Error('Response batch parse terpilih tidak valid.');
      }

      const jobId = payload.job_id;
      const targetIdSet = new Set(targetItems.map((item) => item.id));
      appendStoredJobId(jobId);
      setActiveJobId(jobId);
      setActiveJobSourceIds(targetItems.map((item) => item.id));
      setItems((current) => current.map((item) => (
        targetIdSet.has(item.id)
          ? { ...item, parseStatus: 'todo', parseError: null, issue: parseStatusIssue('todo') }
          : item
      )));
      setMessage(`Batch parse terpilih dimulai (${targetItems.length} entry).`);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Gagal memulai batch parse terpilih.');
    } finally {
      setWorking(false);
    }
  };

  const cancelActiveJob = async () => {
    if (!activeJobId) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch(`/api/actions/parse/jobs/${activeJobId}/cancel`, {
        method: 'POST',
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal membatalkan batch parse.'));
      }
      setMessage(`Batch ${activeJobId} dibatalkan.`);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Gagal membatalkan batch parse.');
    } finally {
      setWorking(false);
    }
  };

  const publishReview = async (status: 'reviewed' | 'rejected'): Promise<boolean> => {
    if (!selected) return false;
    if (status === 'reviewed' && !selectedClean) {
      setError('Approve butuh hasil parsed_data. Parse dulu entry ini.');
      return false;
    }

    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/actions/parse/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: selected.id,
            status,
            parsed_data: selectedClean,
          }],
        }),
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal publish keputusan review.'));
      }

      setMessage(
        status === 'reviewed'
          ? `${selected.name} approved. Status DB -> reviewed.`
          : `${selected.name} ditolak. Status DB -> rejected.`,
      );
      await loadQueue();
      return true;
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Gagal publish keputusan review.');
      return false;
    } finally {
      setWorking(false);
    }
  };

  const publishReviewAndMove = async (status: 'reviewed' | 'rejected') => {
    if (!selected) return;
    const currentIndex = reviewCandidates.findIndex((item) => item.id === selected.id);
    const nextItem = currentIndex >= 0 ? reviewCandidates[currentIndex + 1] || null : reviewCandidates[0] || null;
    const success = await publishReview(status);
    if (!success) return;

    setReviewOpen(true);
    if (nextItem) {
      setSelectedId(nextItem.id);
      setMessage(`${selected.name} ${status === 'reviewed' ? 'approved' : 'ditolak'}. Lanjut review ${nextItem.name}.`);
    } else {
      setMessage(`${selected.name} ${status === 'reviewed' ? 'approved' : 'ditolak'}. Semua parsed item sudah direview.`);
    }
  };

  const progressPercent = activeJob
    ? Math.round(((activeJob.completed + activeJob.failed) / Math.max(activeJob.total, 1)) * 100)
    : 0;
  const activeReviewSection = REVIEW_SECTIONS.find((section) => section.key === reviewSection) || REVIEW_SECTIONS[0];

  return (
    <PrototypeChrome active="clean">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Clean Data</p>
          <h1>Review hasil parsing LLM</h1>
        </div>
      </header>

      <section className={styles.actionPanel}>
        <div style={{ width: '100%' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }} onClick={() => setLlmPanelOpen((v) => !v)}>
            <strong>LLM Configuration {llmPanelOpen ? '▾' : '▸'}</strong>
            <span>{llmConfig.model || 'No model selected'}</span>
          </div>
          {llmPanelOpen && (
            <div className={styles.formGrid} style={{ marginTop: '0.85rem' }}>
              <label>
                Active Profile
                <select value={activeProfileId} onChange={(e) => switchProfile(e.target.value)}>
                  <option value="">No profile (manual)</option>
                  {llmProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Profile Name
                <input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Nama profile" />
              </label>
              <label>
                Preset
                <select
                  value={MODEL_PRESETS.find((p) => p.base === llmConfig.api_base && p.model === llmConfig.model)?.label || 'Custom...'}
                  onChange={(e) => {
                    const preset = MODEL_PRESETS.find((p) => p.label === e.target.value);
                    if (!preset) return;
                    setLlmConfig((prev) => ({ ...prev, api_base: preset.base, model: preset.model }));
                  }}
                >
                  {MODEL_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.label}>{preset.label}</option>
                  ))}
                </select>
              </label>
              <label>
                API Base URL
                <input value={llmConfig.api_base} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_base: e.target.value }))} />
              </label>
              <label>
                API Key
                <input type="password" value={llmConfig.api_key} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_key: e.target.value }))} />
              </label>
              <label>
                Model
                <input value={llmConfig.model} onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))} />
              </label>
              <label>
                Max Tokens
                <input type="number" value={llmConfig.max_tokens} onChange={(e) => setLlmConfig((prev) => ({ ...prev, max_tokens: Number(e.target.value) }))} />
              </label>
              <label>
                Temperature
                <input type="number" step={0.1} value={llmConfig.temperature} onChange={(e) => setLlmConfig((prev) => ({ ...prev, temperature: Number(e.target.value) }))} />
              </label>
            </div>
          )}
          {llmPanelOpen && (
            <div className={styles.panelActions} style={{ marginTop: '0.65rem' }}>
              <button type="button" className={styles.secondaryButton} onClick={createProfile}>Save as New Profile</button>
              <button type="button" className={styles.secondaryButton} onClick={renameActiveProfile} disabled={!activeProfileId || !newProfileName.trim()}>Rename Active</button>
              <button type="button" className={styles.dangerAction} onClick={deleteActiveProfile} disabled={!activeProfileId}>Delete Active</button>
              <button type="button" className={styles.secondaryButton} onClick={testLlmConfig} disabled={testingLlm}>{testingLlm ? 'Testing...' : 'Test LLM'}</button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={async () => {
                  const ok = await saveConfig(llmConfig);
                  if (ok) {
                    setMessage(activeProfileId ? 'LLM config profile aktif tersimpan ke server.' : 'LLM config tersimpan ke server.');
                  }
                }}
              >
                Save Config
              </button>
              {testResult && <span>{testResult.message}</span>}
            </div>
          )}
        </div>
      </section>

      {activeJob && (
        <section className={styles.actionPanel}>
          <strong>Batch {activeJob.job_id}</strong>
          <span>{activeJob.status} - {activeJob.completed}/{activeJob.total} done, {activeJob.failed} gagal</span>
          <span>Connection: {CONNECTION_STATUS_LABELS[connectionStatus]}</span>
          <div className={styles.jobProgress}><span style={{ width: `${progressPercent}%` }} /></div>
          {(activeJob.status === 'running' || activeJob.status === 'pending') && (
            <button type="button" className={styles.tableAction} onClick={cancelActiveJob} disabled={working}>Cancel batch</button>
          )}
        </section>
      )}

      {loading && <section className={styles.actionPanel}><strong>Loading DB</strong><span>Mengambil queue kos...</span></section>}
      {error && <section className={`${styles.actionPanel} ${styles.errorPanel}`} role="alert"><strong>DB load failed</strong><span>{error}</span></section>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.toneinfo}`} /><strong>{counts.raw}</strong><span>Raw</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonewarning}`} /><strong>{counts.in_progress}</strong><span>In LLM</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonewarning}`} /><strong>{counts.parsed}</strong><span>Parsed</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonesuccess}`} /><strong>{counts.reviewed}</strong><span>Reviewed</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonemuted}`} /><strong>{counts.error}</strong><span>Parse Error</span></article>
      </section>

      <section className={styles.sectionGrid}>
        <div className={styles.panelWide}>
          <div className={styles.subHeaderRow}>
            <div className={styles.filterChips} aria-label="Filter queue clean data">
              {([
                { key: 'all', label: 'All', count: counts.all },
                { key: 'raw', label: 'Raw', count: counts.raw },
                { key: 'todo', label: 'Queued', count: counts.todo },
                { key: 'in_progress', label: 'In LLM', count: counts.in_progress },
                { key: 'parsed', label: 'Parsed', count: counts.parsed },
                { key: 'reviewed', label: 'Reviewed', count: counts.reviewed },
                { key: 'rejected', label: 'Rejected', count: counts.rejected },
                { key: 'error', label: 'Error', count: counts.error },
              ] as const).map((entry) => (
                <button key={entry.key} type="button" className={filter === entry.key ? styles.filterChipActive : styles.filterChip} onClick={() => setFilter(entry.key)}>
                  {entry.label} ({entry.count})
                </button>
              ))}
            </div>
            <div className={styles.topbarActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => openReview()} disabled={reviewTotal === 0}>Review parsed ({reviewTotal})</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void loadQueue()} disabled={loading || working}>Reload</button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={parseBatchSelected}
                disabled={working || loading || activeJobId != null || selectedBatchCount === 0}
              >
                Parse selected ({selectedBatchCount})
              </button>
              <button type="button" className={styles.primaryButton} onClick={parseAllRaw} disabled={working || loading || activeJobId != null || counts.raw === 0}>Parse all raw</button>
            </div>
          </div>
          <p className={styles.sectionIntro}>{message}</p>

          <div className={styles.desktopTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={batchCandidates.length > 0 && batchCandidates.every((item) => selectedIds.has(item.id))}
                      onChange={() => toggleSelectAllBatchCandidates()}
                      aria-label="Select all raw/error"
                    />
                  </th>
                  <th>Queue</th>
                  <th>Status</th>
                  <th>Parse</th>
                  <th>Issue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyTableCell}>{loading ? 'Memuat queue...' : 'Queue kosong.'}</td>
                  </tr>
                )}

                {filteredItems.map((item) => {
                  const parseTone = parseStatusTone(item.parseStatus);
                  const parseText = parseStatusLabel(item.parseStatus);
                  return (
                    <tr key={item.id} className={selected?.id === item.id ? styles.selectedRow : ''} onClick={() => setSelectedId(item.id)}>
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          disabled={!(item.statusKey === 'raw' || item.parseStatus === 'error')}
                          onChange={() => toggleItemSelection(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td>
                        <button type="button" className={styles.rowButton} onClick={() => setSelectedId(item.id)}>
                          <strong>{item.name}</strong>
                          <span>{item.address}</span>
                        </button>
                      </td>
                      <td>
                        <Badge tone={item.statusKey === 'reviewed' ? 'reviewed' : item.statusKey === 'parsed' ? 'parsed' : item.statusKey === 'rejected' ? 'rejected' : 'raw'}>{item.statusLabel}</Badge>
                      </td>
                      <td>
                        <Badge tone={parseTone}>{parseText}</Badge>
                      </td>
                      <td>{item.parseError || item.issue}</td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.tableAction}
                          onClick={() => openReview(item.id)}
                          disabled={item.statusKey !== 'parsed' || !mergeClean(item)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {filteredItems.map((item) => (
              <article key={item.id} className={styles.kosCard} onClick={() => setSelectedId(item.id)}>
                <div className={styles.cardTopline}>
                  <Badge>{item.type}</Badge>
                  <Badge tone={item.statusKey === 'reviewed' ? 'reviewed' : item.statusKey === 'parsed' ? 'parsed' : item.statusKey === 'rejected' ? 'rejected' : 'raw'}>{item.statusLabel}</Badge>
                  <Badge tone={parseStatusTone(item.parseStatus)}>{parseStatusLabel(item.parseStatus)}</Badge>
                </div>
                <strong>{item.name}</strong>
                <p>{item.address}</p>
                <p>{item.parseError || item.issue}</p>
                <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.tableAction}
                    onClick={() => openReview(item.id)}
                    disabled={item.statusKey !== 'parsed' || !mergeClean(item)}
                  >
                    Review
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className={styles.drawer}>
          {selected ? (
            <>
              <div className={styles.drawerHeader}>
                <Badge>{selected.type}</Badge>
                <h2>{selected.name}</h2>
                <p>{selected.address}</p>
                <div className={styles.cardTopline}>
                  <Badge tone={selected.statusKey === 'reviewed' ? 'reviewed' : selected.statusKey === 'parsed' ? 'parsed' : selected.statusKey === 'rejected' ? 'rejected' : 'raw'}>{selected.statusLabel}</Badge>
                  <Badge tone={parseStatusTone(selected.parseStatus)}>{parseStatusLabel(selected.parseStatus)}</Badge>
                </div>
              </div>

              <div className={styles.filterChips}>
                <button type="button" className={detailTab === 'raw' ? styles.filterChipActive : styles.filterChip} onClick={() => setDetailTab('raw')}>Raw Data</button>
                <button type="button" className={detailTab === 'cleaned' ? styles.filterChipActive : styles.filterChip} onClick={() => setDetailTab('cleaned')}>Cleaned Data</button>
                <button type="button" className={detailTab === 'feedback' ? styles.filterChipActive : styles.filterChip} onClick={() => setDetailTab('feedback')}>Feedback LLM</button>
                <button type="button" className={detailTab === 'confidence' ? styles.filterChipActive : styles.filterChip} onClick={() => setDetailTab('confidence')}>Confidence</button>
              </div>

              <div className={styles.panelActions} style={{ marginTop: '0.9rem' }}>
                <button type="button" className={styles.secondaryButton} onClick={() => openReview(selected.id)} disabled={!selected}>Open review</button>
                <button type="button" className={styles.secondaryButton} onClick={parseSelected} disabled={!selected || working || loading}>Parse selected</button>
                <button type="button" className={styles.secondaryButton} onClick={reparseWithFeedback} disabled={!selected || working || loading}>Re-review LLM</button>
                <button type="button" className={styles.primaryButton} onClick={() => void publishReview('reviewed')} disabled={!selected || !selectedClean || selected.statusKey !== 'parsed' || working}>Approve</button>
                <button type="button" className={styles.dangerAction} onClick={() => void publishReview('rejected')} disabled={!selected || selected.statusKey !== 'parsed' || working}>Reject</button>
              </div>

              {detailTab === 'raw' && (
                <div className={styles.compareGrid}>
                  <article className={styles.compareCard}>
                    <span className={styles.compareLabel}>Raw snapshot</span>
                    <p><strong>Harga:</strong> {selected.priceRaw}</p>
                    <p><strong>Kontak:</strong> {selected.contactRaw}</p>
                    <p><strong>Fasilitas:</strong> {selected.facilitiesRaw}</p>
                    <p><strong>Peraturan:</strong> {selected.rulesRaw}</p>
                  </article>
                </div>
              )}

              {detailTab === 'cleaned' && (
                <div className={styles.compareGrid}>
                  <article className={styles.compareCardStrong}>
                    <span className={styles.compareLabel}>Clean output editable</span>
                    {selectedClean ? (
                      <>
                        <div className={styles.cleanField}><strong>quality</strong><span>{confidence.value}% ({confidence.label})</span></div>
                        <div className={styles.cleanField}><strong>issue</strong><span>{selected.parseError || selected.issue}</span></div>
                        <div className={styles.cleanField}><strong>harga</strong><span>{formatHargaSnippet(selectedClean.harga)}</span></div>
                        <HargaEditor
                          value={selectedClean.harga}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), harga: v } })}
                        />
                        <FasilitasEditor
                          value={selectedClean.fasilitas}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), fasilitas: v } })}
                        />
                        <PeraturanEditor
                          value={selectedClean.peraturan}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), peraturan: v } })}
                        />
                        <KontakEditor
                          value={selectedClean.kontak}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), kontak: v } })}
                        />
                      </>
                    ) : (
                      <div className={styles.emptyState}>Belum ada cleaned data. Parse dulu.</div>
                    )}
                  </article>
                </div>
              )}

              {detailTab === 'feedback' && (
                <div className={styles.compareGrid}>
                  <article className={styles.compareCardStrong}>
                    <span className={styles.compareLabel}>Feedback untuk re-review</span>
                    <p>Tulis instruksi spesifik untuk memperbaiki hasil cleaning.</p>
                    <textarea
                      rows={5}
                      value={selected.feedbackPrompt}
                      onChange={(e) => updateQueueItem(selected.id, { feedbackPrompt: e.target.value })}
                      placeholder="Contoh: Normalisasi harga per kamar, validasi nomor WA format 62..., pisah fasilitas kamar vs bersama."
                    />
                    <div className={styles.panelActions}>
                      <button type="button" className={styles.secondaryButton} onClick={reparseWithFeedback} disabled={working || loading}>Re-review sekarang</button>
                    </div>
                  </article>
                </div>
              )}

              {detailTab === 'confidence' && (
                <div className={styles.compareGrid}>
                  <article className={styles.compareCardStrong}>
                    <span className={styles.compareLabel}>Confidence scoring</span>
                    <div className={styles.cleanField}><strong>Total</strong><span>{confidence.value}% ({confidence.label})</span></div>
                    {confidence.details.map((row) => (
                      <div key={row.label} className={styles.cleanField}>
                        <strong>{row.label}</strong>
                        <span>{row.score}/{row.max} - {row.note}</span>
                      </div>
                    ))}
                  </article>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>Pilih item review.</div>
          )}
        </aside>
      </section>

      {reviewOpen && selected && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setReviewOpen(false)}>
          <section className={`${styles.importModal} ${styles.reviewModal}`} role="dialog" aria-modal="true" aria-labelledby="clean-review-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Clean Data Review</p>
                <h2 id="clean-review-title">{selected.name}</h2>
                <p className={styles.reviewMetaLine}>
                  {reviewTotal === 0
                    ? 'Semua parsed item sudah direview'
                    : reviewPosition > 0
                      ? `Review ${reviewPosition}/${reviewTotal}`
                      : `${reviewTotal} parsed item perlu review`}
                </p>
              </div>
              <div className={styles.reviewHeaderActions}>
                <button type="button" className={styles.secondaryButton} onClick={goPreviousReviewable} disabled={!hasPreviousReview || working}>Prev</button>
                <button type="button" className={styles.secondaryButton} onClick={goNextReviewable} disabled={!canGoNextReview || working}>Next</button>
                <button type="button" className={styles.iconButton} onClick={() => setReviewOpen(false)}>x</button>
              </div>
            </div>

            <div className={styles.reviewStatusRow}>
              <Badge>{selected.type}</Badge>
              <Badge tone={selected.statusKey === 'reviewed' ? 'reviewed' : selected.statusKey === 'parsed' ? 'parsed' : selected.statusKey === 'rejected' ? 'rejected' : 'raw'}>{selected.statusLabel}</Badge>
              <Badge tone={parseStatusTone(selected.parseStatus)}>{parseStatusLabel(selected.parseStatus)}</Badge>
              <span>{selected.parseError || selected.issue}</span>
            </div>

            <div className={styles.reviewWorkspaceGrid}>
              <aside className={styles.reviewRawRail}>
                <div className={styles.reviewRailHeader}>
                  <span className={styles.compareLabel}>Raw Snapshot</span>
                  <strong>{confidence.value}% {confidence.label}</strong>
                </div>
                {REVIEW_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    className={reviewSection === section.key ? styles.reviewSectionButtonActive : styles.reviewSectionButton}
                    onClick={() => setReviewSection(section.key)}
                  >
                    <strong>{section.label}</strong>
                    <span>{formatRawSectionSummary(selected, section.key)}</span>
                  </button>
                ))}
              </aside>

              <section className={styles.reviewEditorPane}>
                <div className={styles.reviewPaneHeader}>
                  <div>
                    <span className={styles.compareLabel}>Active Section</span>
                    <h3>{activeReviewSection.label}</h3>
                    <p>{activeReviewSection.hint}</p>
                  </div>
                  <div className={styles.filterChips} aria-label="Switch review section">
                    {REVIEW_SECTIONS.map((section) => (
                      <button
                        key={section.key}
                        type="button"
                        className={reviewSection === section.key ? styles.filterChipActive : styles.filterChip}
                        onClick={() => setReviewSection(section.key)}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.reviewActiveCompare}>
                  <article className={styles.reviewRawCard}>
                    <span className={styles.compareLabel}>Raw {activeReviewSection.label}</span>
                    <p>{formatRawSectionSummary(selected, reviewSection)}</p>
                  </article>

                  <article className={styles.reviewParsedCard}>
                    <span className={styles.compareLabel}>Parsed {activeReviewSection.label}</span>
                    {!selectedClean && <div className={styles.emptyState}>Belum ada parsed data.</div>}

                    {selectedClean && reviewSection === 'identity' && (
                      <>
                        <div className={styles.cleanField}><strong>Nama</strong><span>{selectedClean.nama || '-'}</span></div>
                        <div className={styles.cleanField}><strong>Jenis</strong><span>{selectedClean.jenis_kos || '-'}</span></div>
                        <div className={styles.cleanField}><strong>Alamat</strong><span>{selectedClean.alamat || '-'}</span></div>
                        <div className={styles.cleanField}><strong>Plus code</strong><span>{selectedClean.plus_code || '-'}</span></div>
                        <div className={styles.cleanField}><strong>AC</strong><span>{selectedClean.ac_status || '-'}</span></div>
                        <div className={styles.cleanField}><strong>Bayar</strong><span>{formatList(selectedClean.tipe_pembayaran)}</span></div>
                        <div className={styles.cleanField}><strong>Koordinat</strong><span>{selectedClean.lat}, {selectedClean.lon}</span></div>
                      </>
                    )}

                    {selectedClean && reviewSection === 'harga' && (
                      <>
                        <div className={styles.cleanField}><strong>Output</strong><span>{formatHargaSnippet(selectedClean.harga)}</span></div>
                        <HargaEditor
                          value={selectedClean.harga}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), harga: v } })}
                        />
                      </>
                    )}

                    {selectedClean && reviewSection === 'kontak' && (
                      <>
                        <div className={styles.cleanField}><strong>Output</strong><span>{formatKontakSnippet(selectedClean.kontak)}</span></div>
                        <KontakEditor
                          value={selectedClean.kontak}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), kontak: v } })}
                        />
                      </>
                    )}

                    {selectedClean && reviewSection === 'fasilitas' && (
                      <>
                        <div className={styles.cleanField}><strong>Output</strong><span>{formatFasilitasSnippet(selectedClean.fasilitas)}</span></div>
                        <FasilitasEditor
                          value={selectedClean.fasilitas}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), fasilitas: v } })}
                        />
                      </>
                    )}

                    {selectedClean && reviewSection === 'peraturan' && (
                      <>
                        <div className={styles.cleanField}><strong>Output</strong><span>{formatPeraturanSnippet(selectedClean.peraturan)}</span></div>
                        <PeraturanEditor
                          value={selectedClean.peraturan}
                          onChange={(v) => updateQueueItem(selected.id, { editedClean: { ...(selected.editedClean || {}), peraturan: v } })}
                        />
                      </>
                    )}
                  </article>
                </div>

                <div className={styles.reviewDisclosureGrid}>
                  <details className={styles.reviewDisclosure}>
                    <summary>Feedback LLM</summary>
                    <p>Tulis instruksi spesifik kalau parsed output perlu diperbaiki.</p>
                    <textarea
                      rows={4}
                      value={selected.feedbackPrompt}
                      onChange={(e) => updateQueueItem(selected.id, { feedbackPrompt: e.target.value })}
                      placeholder="Contoh: Nomor WA belum format 62, harga semesteran jangan dianggap bulanan."
                    />
                    <div className={styles.panelActions}>
                      <button type="button" className={styles.secondaryButton} onClick={reparseWithFeedback} disabled={working || loading}>Re-review LLM</button>
                    </div>
                  </details>

                  <details className={styles.reviewDisclosure}>
                    <summary>Confidence detail</summary>
                    <div className={styles.cleanField}><strong>Total</strong><span>{confidence.value}% ({confidence.label})</span></div>
                    {confidence.details.map((row) => (
                      <div key={row.label} className={styles.cleanField}>
                        <strong>{row.label}</strong>
                        <span>{row.score}/{row.max} - {row.note}</span>
                      </div>
                    ))}
                  </details>
                </div>
              </section>
            </div>

            <div className={`${styles.modalActions} ${styles.reviewFooter}`}>
              <button type="button" className={styles.ghostButton} onClick={() => setReviewOpen(false)}>Close</button>
              <div className={styles.reviewFooterActions}>
                <button type="button" className={styles.secondaryButton} onClick={parseSelected} disabled={!selected || working || loading}>Parse selected</button>
                <button type="button" className={styles.secondaryButton} onClick={goNextReviewable} disabled={!canGoNextReview || working}>Skip to next</button>
                <button type="button" className={styles.dangerAction} onClick={() => void publishReviewAndMove('rejected')} disabled={!selected || selected.statusKey !== 'parsed' || working}>Reject & Next</button>
                <button type="button" className={styles.primaryButton} onClick={() => void publishReviewAndMove('reviewed')} disabled={!selected || !selectedClean || selected.statusKey !== 'parsed' || working}>Approve & Next</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </PrototypeChrome>
  );
}
