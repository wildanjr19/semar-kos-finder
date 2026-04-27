'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import styles from './parse.module.css';
import { HargaEditor, FasilitasEditor, PeraturanEditor, KontakEditor } from '@/components/parse/InlineEditors';
import { useJobPoller } from '@/hooks/useJobPoller';
import { useUserLlmConfig } from '@/hooks/useUserLlmConfig';

interface RawEntry {
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
  lat: string | number;
  long: string | number;
  ac_status: string;
  tipe_pembayaran: string[];
  data_status: string;
  parsed_data?: unknown;
}

interface HargaItem {
  min: number;
  max: number;
  periode: string;
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
  tamu_lawan_jenis: 'dilarang' | 'terbatas' | 'bebas' | null;
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

type ParseStatus = 'idle' | 'queued' | 'parsing' | 'done' | 'error';
type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ViewMode = 'inbox' | 'workbench' | 'publish';
type InboxFilter = 'all' | 'raw' | 'parsed' | 'error' | 'needs_review';

interface ParseEntryState {
  index: number;
  raw: RawEntry;
  clean: KosClean | null;
  parseStatus: ParseStatus;
  parseError: string | null;
  reviewStatus: ReviewStatus;
  edits: Partial<KosClean> | null;
  feedbackPrompt: string;
}

interface LlmConfig {
  api_base: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

interface FasilitasTokenResult {
  token: string;
  status: 'matched' | 'fuzzy' | 'unmatched';
  category: 'dalam_kamar' | 'bersama' | 'utilitas' | null;
}

const MODEL_PRESETS = [
  { label: 'OpenAI GPT-4o', base: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'OpenAI GPT-4.1', base: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  { label: 'OpenRouter (any)', base: 'https://openrouter.ai/api/v1', model: '' },
  { label: 'DeepSeek V3', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Groq LLaMA 3', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b' },
  { label: 'Custom...', base: '', model: '' },
];

const LLM_STORAGE_KEY = 'llm_config';
const FEEDBACK_SUGGESTIONS = [
  'Fokus normalisasi harga. Jangan gabungkan tipe kamar berbeda.',
  'Pisahkan fasilitas ke kategori dalam_kamar, bersama, utilitas lebih ketat.',
  'Kontak WA salah format. Pastikan nomor valid Indonesia.',
  'Peraturan kurang lengkap. Prioritaskan jam malam dan aturan tamu.',
];

const INBOX_FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'raw', label: 'Raw' },
  { key: 'parsed', label: 'Parsed' },
  { key: 'error', label: 'Error' },
  { key: 'needs_review', label: 'Needs Review' },
];

function loadLlmConfig(): LlmConfig {
  if (typeof window === 'undefined') return { api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 };
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    return { api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 };
  }
  return { api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 };
}

function saveLlmConfig(config: LlmConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(config));
}

function formatHargaSnippet(harga: HargaItem[]): string {
  if (!harga?.length) return '-';
  return harga
    .map((h) => {
      let s = `Rp ${h.min.toLocaleString()}`;
      if (h.min !== h.max) s += ` - ${h.max.toLocaleString()}`;
      s += ` / ${h.periode}`;
      if (h.tipe_kamar) s += ` (${h.tipe_kamar})`;
      return s;
    })
    .join(' · ');
}

function formatKontakSnippet(k: KontakItem[]): string {
  if (!k?.length) return '-';
  return k.slice(0, 2).map((c) => (c.nama ? `${c.nama} (${c.nomor_wa})` : c.nomor_wa)).join(', ');
}

function formatFasilitasSnippet(fasilitas: FasilitasCleaned): string {
  const parts = [
    fasilitas.dalam_kamar.length ? `Kamar: ${fasilitas.dalam_kamar.join(', ')}` : '',
    fasilitas.bersama.length ? `Bersama: ${fasilitas.bersama.join(', ')}` : '',
    fasilitas.utilitas.length ? `Utilitas: ${fasilitas.utilitas.join(', ')}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || '-';
}

function isNeedsReview(entry: ParseEntryState): boolean {
  return (entry.parseStatus === 'done' || entry.parseStatus === 'error') && entry.reviewStatus === 'pending';
}

function matchesInboxFilter(entry: ParseEntryState, filter: InboxFilter): boolean {
  const dataStatus = entry.raw.data_status || 'raw';
  if (filter === 'all') return true;
  if (filter === 'raw') return dataStatus === 'raw';
  if (filter === 'parsed') return entry.parseStatus === 'done';
  if (filter === 'error') return entry.parseStatus === 'error';
  return isNeedsReview(entry);
}

function statusClass(status: ParseStatus): string {
  if (status === 'done') return styles.statusDone;
  if (status === 'error') return styles.statusError;
  if (status === 'parsing') return styles.statusParsing;
  return styles.statusQueue;
}

function getFasilitasMapping(raw: string, clean: FasilitasCleaned): FasilitasTokenResult[] {
  if (!raw) return [];
  const separators = /[,;/|]+/;
  const tokens = raw.split(separators).map((t) => t.trim()).filter(Boolean);
  const allCleanItems = [
    ...clean.dalam_kamar.map((i) => ({ text: i, cat: 'dalam_kamar' as const })),
    ...clean.bersama.map((i) => ({ text: i, cat: 'bersama' as const })),
    ...clean.utilitas.map((i) => ({ text: i, cat: 'utilitas' as const })),
  ];
  return tokens.map((token) => {
    const lowerToken = token.toLowerCase();
    const exact = allCleanItems.find((i) => i.text.toLowerCase() === lowerToken);
    if (exact) return { token, status: 'matched', category: exact.cat };
    const fuzzy = allCleanItems.find((i) => {
      const lt = i.text.toLowerCase();
      return lowerToken.includes(lt) || lt.includes(lowerToken);
    });
    if (fuzzy) return { token, status: 'fuzzy', category: fuzzy.cat };
    return { token, status: 'unmatched', category: null };
  });
}

export default function ParseAction() {
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(loadLlmConfig);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);
  const [llmPanelOpen, setLlmPanelOpen] = useState(false);

  const [entries, setEntries] = useState<ParseEntryState[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedRawIndices, setSelectedRawIndices] = useState<Set<number>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobSourceIndices, setActiveJobSourceIndices] = useState<number[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [expandedInboxIndex, setExpandedInboxIndex] = useState<number | null>(null);

  const { config: savedConfig, saveConfig } = useUserLlmConfig();

  useEffect(() => {
    if (!savedConfig) return;
    setLlmConfig(savedConfig);
    saveLlmConfig(savedConfig);
  }, [savedConfig]);

  const jobIds = useMemo(() => (activeJobId ? [activeJobId] : []), [activeJobId]);
  const jobs = useJobPoller(jobIds, { interval: 2000 });
  const activeJob = activeJobId ? jobs[activeJobId] || null : null;

  const rawCount = useMemo(() => entries.filter((e) => (e.raw.data_status || 'raw') === 'raw').length, [entries]);
  const parsedCount = useMemo(() => entries.filter((e) => (e.raw.data_status || 'raw') === 'parsed').length, [entries]);
  const reviewedCount = useMemo(() => entries.filter((e) => (e.raw.data_status || 'raw') === 'reviewed').length, [entries]);
  const rejectedCount = useMemo(() => entries.filter((e) => (e.raw.data_status || 'raw') === 'rejected').length, [entries]);

  const needsReviewIndices = useMemo(
    () => entries.filter((e) => e.parseStatus === 'done' || e.parseStatus === 'error').map((e) => e.index),
    [entries],
  );

  const reviewStats = useMemo(() => {
    const approved = entries.filter((e) => e.reviewStatus === 'approved').length;
    const rejected = entries.filter((e) => e.reviewStatus === 'rejected').length;
    const pending = entries.filter((e) => e.reviewStatus === 'pending').length;
    return { approved, rejected, pending, total: entries.length };
  }, [entries]);

  const inboxFilterCounts = useMemo(() => ({
    all: entries.length,
    raw: entries.filter((e) => (e.raw.data_status || 'raw') === 'raw').length,
    parsed: entries.filter((e) => e.parseStatus === 'done').length,
    error: entries.filter((e) => e.parseStatus === 'error').length,
    needs_review: entries.filter(isNeedsReview).length,
  }), [entries]);

  const filteredInboxEntries = useMemo(
    () => entries.filter((entry) => matchesInboxFilter(entry, inboxFilter)),
    [entries, inboxFilter],
  );

  useEffect(() => {
    if (!activeJob) return;
    const mapIndex = (jobLocalIndex: number) => activeJobSourceIndices[jobLocalIndex] ?? jobLocalIndex;
    setEntries((prev) => {
      const next = [...prev];
      for (const r of activeJob.results || []) {
        const idx = mapIndex(r.index as number);
        if (!next[idx]) continue;
        next[idx] = {
          ...next[idx],
          clean: r.clean as KosClean,
          parseStatus: 'done',
          parseError: null,
          reviewStatus: next[idx].reviewStatus === 'approved' ? 'approved' : 'pending',
          raw: { ...next[idx].raw, data_status: 'parsed' },
        };
      }
      for (const e of activeJob.errors || []) {
        const idx = mapIndex(e.index as number);
        if (!next[idx]) continue;
        next[idx] = { ...next[idx], parseStatus: 'error', parseError: e.error };
      }
      return next;
    });
  }, [activeJob, activeJobSourceIndices]);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    setPageError('');
    try {
      const res = await fetch('/api/kos');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid response');
      const loaded: RawEntry[] = data.map((d: Record<string, unknown>) => ({
        id: String(d.id ?? ''),
        No: String(d.id ?? ''),
        'Nama kos': String(d.nama ?? ''),
        'Jenis kos': String(d.jenis_kos ?? ''),
        Alamat: String(d.alamat ?? ''),
        Plus_Code: String(d.plus_code ?? ''),
        Fasilitas: String(d.fasilitas ?? ''),
        Peraturan: String(d.peraturan ?? ''),
        Harga: String(d.harga ?? ''),
        Narahubung: String(d.narahubung ?? ''),
        lat: d.lat ?? 0,
        long: d.long ?? 0,
        ac_status: String(d.ac_status ?? ''),
        tipe_pembayaran: Array.isArray(d.tipe_pembayaran) ? d.tipe_pembayaran : [],
        data_status: String(d.data_status || 'raw'),
        parsed_data: d.parsed_data ?? null,
      }));
      setEntries(
        loaded.map((raw, idx) => ({
          index: idx,
          raw,
          clean: (raw.parsed_data as KosClean | null) ?? null,
          parseStatus: raw.parsed_data ? 'done' : 'idle',
          parseError: null,
          reviewStatus: raw.data_status === 'reviewed' ? 'approved' : raw.data_status === 'rejected' ? 'rejected' : 'pending',
          edits: null,
          feedbackPrompt: '',
        })),
      );
      setSelectedRawIndices(new Set());
      setExpandedInboxIndex(null);
      setSuccessMessage('Data loaded from database.');
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (activeReviewIndex !== null && !entries[activeReviewIndex]) {
      setActiveReviewIndex(null);
    }
  }, [entries, activeReviewIndex]);

  const activeEntry = activeReviewIndex !== null ? entries[activeReviewIndex] : null;
  const effectiveClean = useMemo(() => {
    if (!activeEntry?.clean) return null;
    if (!activeEntry.edits) return activeEntry.clean;
    return { ...activeEntry.clean, ...activeEntry.edits } as KosClean;
  }, [activeEntry]);

  const toggleRawSelection = (idx: number) => {
    const entry = entries[idx];
    if (!entry || (entry.raw.data_status || 'raw') !== 'raw') return;
    const next = new Set(selectedRawIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedRawIndices(next);
  };

  const toggleSelectAllRaw = () => {
    const rawIndices = entries.map((e) => e.index).filter((i) => (entries[i].raw.data_status || 'raw') === 'raw');
    if (rawIndices.length > 0 && rawIndices.every((i) => selectedRawIndices.has(i))) {
      setSelectedRawIndices(new Set());
      return;
    }
    setSelectedRawIndices(new Set(rawIndices));
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/actions/llm/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(llmConfig),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setTestResult({ status: 'ok', message: `Connected: ${data.model || llmConfig.model}` });
      } else {
        setTestResult({ status: 'error', message: data.error || 'Connection failed' });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setTestingLlm(false);
    }
  };

  const startBulkParse = async (indices?: number[]) => {
    setPageError('');
    setSuccessMessage('');
    const target = indices ?? Array.from(selectedRawIndices);
    if (target.length === 0) return;
    const payload = target.map((i) => entries[i].raw);

    setEntries((prev) => {
      const next = [...prev];
      for (const i of target) {
        next[i] = { ...next[i], parseStatus: 'queued', parseError: null };
      }
      return next;
    });

    try {
      const res = await fetch('/api/actions/parse/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: payload, override_config: llmConfig }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveJobId(data.job_id as string);
      setActiveJobSourceIndices(target);
      setEntries((prev) => {
        const next = [...prev];
        for (const i of target) {
          next[i] = { ...next[i], parseStatus: 'parsing' };
        }
        return next;
      });
      setViewMode('workbench');
      if (activeReviewIndex === null && target.length > 0) setActiveReviewIndex(target[0]);
      setSuccessMessage(`Batch parse started (${target.length} entries).`);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Parse failed');
      setEntries((prev) => {
        const next = [...prev];
        for (const i of target) {
          next[i] = { ...next[i], parseStatus: 'idle' };
        }
        return next;
      });
    }
  };

  const updateEntry = (idx: number, patch: Partial<ParseEntryState>) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const reparseEntry = async (idx: number) => {
    setPageError('');
    const entry = entries[idx];
    if (!entry) return;
    updateEntry(idx, { parseStatus: 'parsing', parseError: null });
    try {
      const res = await fetch('/api/actions/parse/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entry: entry.raw,
          custom_prompt: entry.feedbackPrompt || undefined,
          override_config: llmConfig,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateEntry(idx, {
        clean: data as KosClean,
        parseStatus: 'done',
        parseError: null,
        reviewStatus: 'pending',
        raw: { ...entry.raw, data_status: 'parsed' },
      });
      setSuccessMessage(`Entry #${entry.raw.No} re-parsed with feedback.`);
    } catch (e) {
      updateEntry(idx, { parseStatus: 'error', parseError: e instanceof Error ? e.message : 'Re-parse failed' });
    }
  };

  const updateEdit = (patch: Partial<KosClean>) => {
    if (activeReviewIndex === null) return;
    const current = entries[activeReviewIndex];
    updateEntry(activeReviewIndex, { edits: { ...(current.edits || {}), ...patch } });
  };

  const applyFeedbackSuggestion = (text: string) => {
    if (activeReviewIndex === null) return;
    const current = entries[activeReviewIndex];
    const next = current.feedbackPrompt ? `${current.feedbackPrompt}\n${text}` : text;
    updateEntry(activeReviewIndex, { feedbackPrompt: next });
  };

  const approveEntry = (idx: number) => {
    if (!entries[idx].clean) return;
    updateEntry(idx, { reviewStatus: 'approved' });
  };

  const rejectEntry = (idx: number) => {
    updateEntry(idx, { reviewStatus: 'rejected' });
  };

  const approveAllParsed = () => {
    setEntries((prev) => prev.map((e) => (e.parseStatus === 'done' && e.reviewStatus === 'pending' ? { ...e, reviewStatus: 'approved' } : e)));
  };

  const rejectAllFailed = () => {
    setEntries((prev) => prev.map((e) => (e.parseStatus === 'error' && e.reviewStatus === 'pending' ? { ...e, reviewStatus: 'rejected' } : e)));
  };

  const publishReview = async () => {
    setPublishing(true);
    setPageError('');
    setSuccessMessage('');
    try {
      const approvedItems = entries
        .filter((e) => e.reviewStatus === 'approved')
        .map((e) => {
          const clean = e.edits ? { ...(e.clean as KosClean), ...e.edits } : e.clean;
          return { id: e.raw.id || clean?.id, parsed_data: clean, status: 'reviewed' };
        });
      const rejectedItems = entries
        .filter((e) => e.reviewStatus === 'rejected')
        .map((e) => {
          const clean = e.edits ? { ...(e.clean as KosClean), ...e.edits } : e.clean;
          return { id: e.raw.id || clean?.id, parsed_data: clean, status: 'rejected' };
        });
      const items = [...approvedItems, ...rejectedItems];
      if (items.length === 0) {
        setSuccessMessage('No review decisions to publish.');
        return;
      }

      const res = await fetch('/api/actions/parse/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updated = Number(data.updated || 0);
      setSuccessMessage(`Published ${updated} decisions. Backend map data updated.`);
      if (updated > 0) {
        sessionStorage.setItem('just_imported', 'true');
        window.location.href = `/kos?imported=${updated}`;
      }
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Clean Data Workspace</h1>
          <div className={styles.textMuted}>Flow: cleaning -> review -> feedback -> final publish -> map update</div>
        </div>
        <div className={styles.gap1}>
          <a href="/kos" className={styles.outlineButton}>Back to Kos List</a>
          <button className={styles.editBtn} onClick={loadEntries} disabled={loadingEntries}>{loadingEntries ? 'Reloading...' : 'Reload DB'}</button>
        </div>
      </header>

      {pageError && <div className={styles.error}>{pageError}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      <div className={styles.workspaceTopbar}>
        <button className={viewMode === 'inbox' ? styles.approveBtn : styles.editBtn} onClick={() => setViewMode('inbox')}>Inbox</button>
        <button className={viewMode === 'workbench' ? styles.approveBtn : styles.editBtn} onClick={() => setViewMode('workbench')}>Review Workbench</button>
        <button className={viewMode === 'publish' ? styles.approveBtn : styles.editBtn} onClick={() => setViewMode('publish')}>Final Publish</button>
      </div>

      <div className={styles.statsStrip}>
        <div className={styles.statBox}><strong>{rawCount}</strong><span>Raw</span></div>
        <div className={styles.statBox}><strong>{parsedCount}</strong><span>Parsed</span></div>
        <div className={styles.statBox}><strong>{needsReviewIndices.length}</strong><span>Needs Review</span></div>
        <div className={styles.statBox}><strong>{reviewedCount}</strong><span>Reviewed</span></div>
        <div className={styles.statBox}><strong>{rejectedCount}</strong><span>Rejected</span></div>
      </div>

      <div className={styles.card}>
        <div className={styles.flexBetween} style={{ cursor: 'pointer' }} onClick={() => setLlmPanelOpen((v) => !v)}>
          <h2 className={styles.cardTitle}>LLM Configuration {llmPanelOpen ? '▾' : '▸'}</h2>
          <span className={styles.textMuted}>{llmConfig.model || 'No model selected'}</span>
        </div>
        {llmPanelOpen && (
          <>
            <div className={styles.configGrid}>
              <div className={styles.field}>
                <label>Preset</label>
                <select
                  value={MODEL_PRESETS.find((p) => p.base === llmConfig.api_base && p.model === llmConfig.model)?.label || 'Custom...'}
                  onChange={(e) => {
                    const preset = MODEL_PRESETS.find((p) => p.label === e.target.value);
                    if (!preset) return;
                    setLlmConfig((prev) => ({ ...prev, api_base: preset.base, model: preset.model }));
                  }}
                >
                  {MODEL_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>API Base URL</label>
                <input value={llmConfig.api_base} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_base: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>API Key</label>
                <input type="password" value={llmConfig.api_key} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_key: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>Model</label>
                <input value={llmConfig.model} onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>Max Tokens</label>
                <input type="number" value={llmConfig.max_tokens} onChange={(e) => setLlmConfig((prev) => ({ ...prev, max_tokens: Number(e.target.value) }))} />
              </div>
              <div className={styles.field}>
                <label>Temperature</label>
                <input type="number" step={0.1} value={llmConfig.temperature} onChange={(e) => setLlmConfig((prev) => ({ ...prev, temperature: Number(e.target.value) }))} />
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button onClick={handleTestLlm} disabled={testingLlm}>{testingLlm ? 'Testing...' : 'Test LLM'}</button>
              <button onClick={async () => { saveLlmConfig(llmConfig); await saveConfig(llmConfig); setSuccessMessage('LLM config saved.'); }}>Save Config</button>
            </div>
            {testResult && <div className={`${styles.testResult} ${testResult.status === 'ok' ? styles.testOk : styles.testErr}`}>{testResult.message}</div>}
          </>
        )}
      </div>

      {viewMode === 'inbox' && (
        <div className={styles.card}>
          <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
            <h2 className={styles.cardTitle}>Inbox Queue</h2>
            <div className={styles.gap1}>
              <button onClick={toggleSelectAllRaw}>{Array.from(selectedRawIndices).length > 0 ? 'Deselect Raw' : 'Select All Raw'}</button>
              <button onClick={() => startBulkParse()} disabled={selectedRawIndices.size === 0}>Parse Selected ({selectedRawIndices.size})</button>
              <button onClick={() => startBulkParse(entries.map((e) => e.index).filter((i) => (entries[i].raw.data_status || 'raw') === 'raw'))} disabled={rawCount === 0}>Parse All Raw</button>
            </div>
          </div>
          <div className={styles.inboxToolbar}>
            <div className={styles.filterChips} aria-label="Inbox filters">
              {INBOX_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  className={`${styles.filterChip} ${inboxFilter === filter.key ? styles.filterChipActive : ''}`}
                  onClick={() => {
                    setInboxFilter(filter.key);
                    setExpandedInboxIndex(null);
                  }}
                  type="button"
                >
                  {filter.label} <span>{inboxFilterCounts[filter.key]}</span>
                </button>
              ))}
            </div>
            <div className={styles.textMuted}>{filteredInboxEntries.length} shown</div>
          </div>
          {activeJob && (
            <div className={styles.importPreview}>
              <strong>Active Batch:</strong> {activeJob.job_id} - {activeJob.status}
              <div className={styles.progressBar} style={{ marginTop: '0.5rem' }}>
                <div className={styles.progressFill} style={{ width: `${activeJob.total ? (activeJob.completed / activeJob.total) * 100 : 0}%` }} />
              </div>
              <div className={styles.textMuted}>{activeJob.completed}/{activeJob.total} done, {activeJob.failed} failed</div>
            </div>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkboxCol}><input type="checkbox" onChange={toggleSelectAllRaw} checked={rawCount > 0 && entries.filter((e) => (e.raw.data_status || 'raw') === 'raw').every((e) => selectedRawIndices.has(e.index))} /></th>
                  <th>#</th>
                  <th>Nama</th>
                  <th>Jenis Kos</th>
                  <th>Status</th>
                  <th>Parse</th>
                  <th>Harga Raw</th>
                  <th>Fasilitas Raw</th>
                  <th>Narahubung Raw</th>
                  <th>Clean Preview</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {filteredInboxEntries.map((entry) => {
                  const isExpanded = expandedInboxIndex === entry.index;
                  const cleanPreview = entry.parseStatus === 'done' && entry.clean
                    ? [
                        `Harga: ${formatHargaSnippet(entry.clean.harga)}`,
                        `Fasilitas: ${formatFasilitasSnippet(entry.clean.fasilitas)}`,
                        `Kontak: ${formatKontakSnippet(entry.clean.kontak)}`,
                      ]
                    : [];
                  return (
                    <Fragment key={entry.index}>
                      <tr
                        className={`${styles.inboxRow} ${isExpanded ? styles.inboxRowExpanded : ''}`}
                        onClick={() => setExpandedInboxIndex((current) => (current === entry.index ? null : entry.index))}
                      >
                        <td className={styles.checkboxCol} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRawIndices.has(entry.index)}
                            onChange={() => toggleRawSelection(entry.index)}
                            disabled={(entry.raw.data_status || 'raw') !== 'raw'}
                          />
                        </td>
                        <td className={styles.expandCell}><span className={styles.expandIcon}>{isExpanded ? '▾' : '▸'}</span>{entry.raw.No}</td>
                        <td><span className={styles.truncateText} title={entry.raw['Nama kos']}>{entry.raw['Nama kos'] || '-'}</span></td>
                        <td>{entry.raw['Jenis kos'] || '-'}</td>
                        <td><span className={`${styles.badge} ${styles[`badge${(entry.raw.data_status || 'raw').charAt(0).toUpperCase() + (entry.raw.data_status || 'raw').slice(1)}`] || styles.badgeRaw}`}>{entry.raw.data_status || 'raw'}</span></td>
                        <td><span className={statusClass(entry.parseStatus)}>{entry.parseStatus}</span></td>
                        <td className={styles.rawTextCell}><span className={styles.truncateText} title={entry.raw.Harga}>{entry.raw.Harga || '-'}</span></td>
                        <td className={styles.rawTextCell}><span className={styles.truncateText} title={entry.raw.Fasilitas}>{entry.raw.Fasilitas || '-'}</span></td>
                        <td className={styles.rawTextCell}><span className={styles.truncateText} title={entry.raw.Narahubung}>{entry.raw.Narahubung || '-'}</span></td>
                        <td className={styles.cleanPreviewCell}>
                          {cleanPreview.length > 0 ? (
                            <div className={styles.cleanPreviewStack}>
                              {cleanPreview.map((line) => <span key={line} className={styles.cleanPreviewLine} title={line}>{line}</span>)}
                            </div>
                          ) : (
                            <span className={styles.textMuted}>-</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {entry.clean ? (
                            <button
                              className={styles.editBtn}
                              onClick={() => {
                                setActiveReviewIndex(entry.index);
                                setViewMode('workbench');
                              }}
                            >
                              Open
                            </button>
                          ) : (
                            <span className={styles.textMuted}>-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${entry.index}-detail`} className={styles.inboxDetailRow}>
                          <td colSpan={11}>
                            <div className={styles.inboxDetail}>
                              <div className={styles.inboxDetailGrid}>
                                <div className={styles.detailSection}>
                                  <h3>Raw</h3>
                                  <div className={styles.detailField}><span className={styles.detailLabel}>Harga</span><div className={styles.detailValue}>{entry.raw.Harga || '-'}</div></div>
                                  <div className={styles.detailField}><span className={styles.detailLabel}>Fasilitas</span><div className={styles.detailValue}>{entry.raw.Fasilitas || '-'}</div></div>
                                  <div className={styles.detailField}><span className={styles.detailLabel}>Peraturan</span><div className={styles.detailValue}>{entry.raw.Peraturan || '-'}</div></div>
                                  <div className={styles.detailField}><span className={styles.detailLabel}>Narahubung</span><div className={styles.detailValue}>{entry.raw.Narahubung || '-'}</div></div>
                                </div>
                                <div className={styles.detailSection}>
                                  <h3>Clean</h3>
                                  {entry.clean ? (
                                    <>
                                      <div className={styles.detailField}><span className={styles.detailLabel}>Harga</span><div className={styles.detailValue}>{formatHargaSnippet(entry.clean.harga)}</div></div>
                                      <div className={styles.detailField}>
                                        <span className={styles.detailLabel}>Fasilitas</span>
                                        <div className={styles.detailValue}>
                                          <div>Dalam kamar: {entry.clean.fasilitas.dalam_kamar.join(', ') || '-'}</div>
                                          <div>Bersama: {entry.clean.fasilitas.bersama.join(', ') || '-'}</div>
                                          <div>Utilitas: {entry.clean.fasilitas.utilitas.join(', ') || '-'}</div>
                                          {entry.clean.fasilitas.catatan && <div>Catatan: {entry.clean.fasilitas.catatan}</div>}
                                        </div>
                                      </div>
                                      <div className={styles.detailField}><span className={styles.detailLabel}>Kontak</span><div className={styles.detailValue}>{formatKontakSnippet(entry.clean.kontak)}</div></div>
                                    </>
                                  ) : (
                                    <div className={styles.textMuted}>No clean parse result yet.</div>
                                  )}
                                  {entry.parseError && <div className={styles.error}>Error: {entry.parseError}</div>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filteredInboxEntries.length === 0 && (
                  <tr>
                    <td colSpan={11} className={styles.emptyInbox}>No entries match this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'workbench' && (
        <div className={styles.reviewLayout}>
          <div className={styles.entryList}>
            <div className={styles.reviewProgress}>
              <div>Review progress: {reviewStats.approved + reviewStats.rejected}/{reviewStats.total}</div>
              <div className={styles.miniProgressBar}>
                <div style={{ width: `${reviewStats.total ? ((reviewStats.approved + reviewStats.rejected) / reviewStats.total) * 100 : 0}%` }} />
              </div>
              <div className={styles.reviewProgressSub}>approved {reviewStats.approved} - rejected {reviewStats.rejected} - pending {reviewStats.pending}</div>
            </div>
            <div className={styles.bulkReviewActions}>
              <button onClick={approveAllParsed}>Approve parsed</button>
              <button onClick={rejectAllFailed}>Reject failed</button>
            </div>
            {needsReviewIndices.length === 0 && <div style={{ padding: '0.75rem' }} className={styles.textMuted}>No parsed items yet.</div>}
            {needsReviewIndices.map((idx) => {
              const e = entries[idx];
              return (
                <div
                  key={e.index}
                  className={`${styles.entryListItem} ${activeReviewIndex === e.index ? styles.entryListItemActive : ''}`}
                  onClick={() => {
                    setActiveReviewIndex(e.index);
                    setEditingReview(false);
                  }}
                >
                  <span>{e.raw.No}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.raw['Nama kos']}</span>
                  {e.reviewStatus === 'approved' && <span className={`${styles.badge} ${styles.badgeReviewed}`}>OK</span>}
                  {e.reviewStatus === 'rejected' && <span className={`${styles.badge} ${styles.badgeRejected}`}>X</span>}
                  {e.parseStatus === 'error' && <span className={`${styles.badge} ${styles.badgeRejected}`}>!</span>}
                </div>
              );
            })}
          </div>

          <div className={styles.reviewPanel}>
            {!activeEntry && <div className={styles.textMuted}>Select item from queue.</div>}
            {activeEntry && (
              <>
                <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>#{activeEntry.raw.No} - {activeEntry.raw['Nama kos']}</h3>
                  <div className={styles.gap1}>
                    <button className={styles.editBtn} onClick={() => setEditingReview((v) => !v)}>{editingReview ? 'Stop Edit' : 'Edit'}</button>
                    <button className={styles.approveBtn} onClick={() => approveEntry(activeEntry.index)} disabled={!activeEntry.clean}>Approve</button>
                    <button className={styles.rejectBtn} onClick={() => rejectEntry(activeEntry.index)}>Reject</button>
                  </div>
                </div>

                {effectiveClean ? (
                  <>
                    {!editingReview && (
                      <div className={styles.fieldDiffPanel}>
                        <div className={styles.fieldDiffSection}>
                          <div className={styles.fieldDiffTitle}>Harga</div>
                          <div className={styles.fieldDiffGrid}>
                            <div className={styles.fieldDiffBox}><strong>Raw</strong><div className={styles.textMuted}>{activeEntry.raw.Harga || '-'}</div></div>
                            <div className={styles.fieldDiffBox}><strong>Clean</strong><div>{formatHargaSnippet(effectiveClean.harga)}</div></div>
                          </div>
                        </div>
                        <div className={styles.fieldDiffSection}>
                          <div className={styles.fieldDiffTitle}>Fasilitas</div>
                          <div className={styles.fieldDiffGrid}>
                            <div className={styles.fieldDiffBox}>
                              <strong>Raw</strong>
                              <div className={styles.textMuted}>{activeEntry.raw.Fasilitas || '-'}</div>
                              <div className={styles.tokenMap}>
                                {getFasilitasMapping(activeEntry.raw.Fasilitas, effectiveClean.fasilitas).map((t, i) => (
                                  <span key={i} className={`${styles.token} ${t.status === 'matched' ? styles.tokenMatched : t.status === 'fuzzy' ? styles.tokenFuzzy : styles.tokenUnmatched}`}>
                                    {t.token}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className={styles.fieldDiffBox}>
                              <strong>Clean</strong>
                              <div>Dalam kamar: {effectiveClean.fasilitas.dalam_kamar.join(', ') || '-'}</div>
                              <div>Bersama: {effectiveClean.fasilitas.bersama.join(', ') || '-'}</div>
                              <div>Utilitas: {effectiveClean.fasilitas.utilitas.join(', ') || '-'}</div>
                            </div>
                          </div>
                        </div>
                        <div className={styles.fieldDiffSection}>
                          <div className={styles.fieldDiffTitle}>Kontak</div>
                          <div className={styles.fieldDiffGrid}>
                            <div className={styles.fieldDiffBox}><strong>Raw</strong><div className={styles.textMuted}>{activeEntry.raw.Narahubung || '-'}</div></div>
                            <div className={styles.fieldDiffBox}><strong>Clean</strong><div>{formatKontakSnippet(effectiveClean.kontak)}</div></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Feedback to LLM</div>
                      <div className={styles.feedbackSuggestions}>
                        {FEEDBACK_SUGGESTIONS.map((s) => (
                          <button key={s} className={styles.feedbackChip} onClick={() => applyFeedbackSuggestion(s)}>{s}</button>
                        ))}
                      </div>
                      <textarea
                        rows={3}
                        value={activeEntry.feedbackPrompt}
                        onChange={(e) => updateEntry(activeEntry.index, { feedbackPrompt: e.target.value })}
                        placeholder="Tulis feedback custom untuk memperbaiki hasil parse item ini..."
                      />
                      <div className={styles.actionsRow}>
                        <button onClick={() => reparseEntry(activeEntry.index)}>Re-parse with feedback</button>
                        {activeEntry.parseError && <span className={styles.statusError}>Error: {activeEntry.parseError}</span>}
                      </div>
                    </div>

                    <div className={styles.humanReview}>
                      <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionTitle}>Harga</div>
                        {editingReview ? (
                          <HargaEditor value={effectiveClean.harga} onChange={(v) => updateEdit({ harga: v })} />
                        ) : (
                          <div>{formatHargaSnippet(effectiveClean.harga)}</div>
                        )}
                      </div>

                      <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionTitle}>Fasilitas</div>
                        {editingReview ? (
                          <FasilitasEditor value={effectiveClean.fasilitas} onChange={(v) => updateEdit({ fasilitas: v })} />
                        ) : (
                          <div>Dalam: {effectiveClean.fasilitas.dalam_kamar.join(', ') || '-'} | Bersama: {effectiveClean.fasilitas.bersama.join(', ') || '-'} | Utilitas: {effectiveClean.fasilitas.utilitas.join(', ') || '-'}</div>
                        )}
                      </div>

                      <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionTitle}>Peraturan</div>
                        {editingReview ? (
                          <PeraturanEditor value={effectiveClean.peraturan} onChange={(v) => updateEdit({ peraturan: v })} />
                        ) : (
                          <div className={styles.textMuted}>
                            Jam malam: {effectiveClean.peraturan.jam_malam ?? '-'} | Tamu lawan jenis: {effectiveClean.peraturan.tamu_lawan_jenis ?? '-'}
                          </div>
                        )}
                      </div>

                      <div className={styles.reviewSection}>
                        <div className={styles.reviewSectionTitle}>Kontak</div>
                        {editingReview ? (
                          <KontakEditor value={effectiveClean.kontak} onChange={(v) => updateEdit({ kontak: v })} />
                        ) : (
                          <div>{formatKontakSnippet(effectiveClean.kontak)}</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className={styles.error}>No clean parse result yet for this entry.</div>
                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Feedback to LLM</div>
                      <textarea
                        rows={3}
                        value={activeEntry.feedbackPrompt}
                        onChange={(e) => updateEntry(activeEntry.index, { feedbackPrompt: e.target.value })}
                        placeholder="Berikan instruksi perbaikan, lalu re-parse."
                      />
                      <div className={styles.actionsRow}>
                        <button onClick={() => reparseEntry(activeEntry.index)}>Re-parse</button>
                        {activeEntry.parseError && <span className={styles.statusError}>Error: {activeEntry.parseError}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {viewMode === 'publish' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Final Publish</h2>
          <div className={styles.importPreview}>
            <div>{reviewStats.approved} reviewed, {reviewStats.rejected} rejected, {reviewStats.pending} pending.</div>
            <div className={styles.textMuted}>Only reviewed/rejected decisions will be applied. Reviewed clean data will update map output.</div>
          </div>
          <div className={styles.actionsRow}>
            <button onClick={publishReview} disabled={publishing || (reviewStats.approved + reviewStats.rejected) === 0}>{publishing ? 'Publishing...' : 'Publish Review Decisions'}</button>
            <button className={styles.editBtn} onClick={() => setViewMode('workbench')}>Back to Workbench</button>
          </div>
        </div>
      )}
    </div>
  );
}
