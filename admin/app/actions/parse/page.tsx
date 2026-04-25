'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './parse.module.css';
import { HargaEditor, FasilitasEditor, PeraturanEditor, KontakEditor } from '@/components/parse/InlineEditors';

// ─── Types ───

interface RawEntry {
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
type Step = 'config' | 'load' | 'parse' | 'review' | 'save';

interface ParseEntryState {
  index: number;
  raw: RawEntry;
  clean: KosClean | null;
  parseStatus: ParseStatus;
  parseError: string | null;
  reviewStatus: ReviewStatus;
  edits: Partial<KosClean> | null;
  promptOverride: string | null;
}

interface LlmConfig {
  api_base: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
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
const JOBS_STORAGE_KEY = 'parse_jobs';

function loadLlmConfig(): LlmConfig {
  if (typeof window === 'undefined') return { api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 };
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { api_base: '', api_key: '', model: '', max_tokens: 4096, temperature: 0.1 };
}

function saveLlmConfig(config: LlmConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(config));
}

function recordJobId(jobId: string) {
  if (typeof window === 'undefined') return;
  const existing = JSON.parse(localStorage.getItem(JOBS_STORAGE_KEY) || '[]');
  if (!existing.includes(jobId)) {
    existing.push(jobId);
    localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(existing));
  }
}

// ─── Components ───

function StepBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={`${styles.step} ${active ? styles.stepActive : ''}`}>
      <span>{label}</span>
    </div>
  );
}

export default function ParseAction() {
  const [step, setStep] = useState<Step>('config');
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(loadLlmConfig);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'ok' | 'error'; message: string; latency_ms?: number } | null>(null);
  const [configExpanded, setConfigExpanded] = useState(true);

  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [entries, setEntries] = useState<ParseEntryState[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<{ status: string; total: number; completed: number; failed: number; results: unknown[]; errors: unknown[] } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [saveOption, setSaveOption] = useState<'json' | 'db'>('json');
  const [dryRun, setDryRun] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');

  // ── Job polling ──
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/actions/parse/jobs/${jobId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setPageError(data.error);
          setParsing(false);
          return;
        }
        setJob(data);
        // Merge results into entries
        setEntries((prev) => {
          const next = [...prev];
          for (const r of data.results || []) {
            const idx = r.index as number;
            if (next[idx]) {
              next[idx] = { ...next[idx], clean: r.clean as KosClean, parseStatus: 'done', parseError: null };
            }
          }
          for (const e of data.errors || []) {
            const idx = e.index as number;
            if (next[idx]) {
              next[idx] = { ...next[idx], parseStatus: 'error', parseError: e.error };
            }
          }
          return next;
        });
        if (data.status === 'running' || data.status === 'pending') {
          setTimeout(poll, 2000);
        } else {
          setParsing(false);
        }
      } catch (e) {
        if (!cancelled) setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  // ── Step helpers ──
  const goStep = (s: Step) => setStep(s);

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
        setTestResult({ status: 'ok', message: `Connected! ${data.model} (${data.latency_ms}ms)`, latency_ms: data.latency_ms });
      } else {
        setTestResult({ status: 'error', message: data.error || 'Connection failed' });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setTestingLlm(false);
    }
  };

  const handleLoadSource = async () => {
    setPageError('');
    setRawEntries([]);
    setEntries([]);
    setSelectedIndices(new Set());
    try {
      const res = await fetch('/api/kos');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid DB response');
      // Map KosOut back to RawEntry shape for LLM parser
      const loaded: RawEntry[] = data.map((d: Record<string, unknown>) => ({
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
      }));
      setRawEntries(loaded);
      setEntries(loaded.map((raw, idx) => ({
        index: idx,
        raw,
        clean: null,
        parseStatus: 'idle',
        parseError: null,
        reviewStatus: 'pending',
        edits: null,
        promptOverride: null,
      })));
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Load failed');
    }
  };

  // Auto-load from DB when entering load step
  useEffect(() => {
    if (step === 'load' && rawEntries.length === 0) {
      handleLoadSource();
    }
  }, [step]);

  const toggleSelectAll = () => {
    if (selectedIndices.size === rawEntries.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(rawEntries.map((_, i) => i)));
    }
  };

  const toggleSelectOne = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const startParse = async (indices?: number[]) => {
    setPageError('');
    const target = indices ?? Array.from(selectedIndices);
    if (target.length === 0) return;
    const toParse = target.map((i) => entries[i].raw);
    setParsing(true);
    setEntries((prev) => {
      const next = [...prev];
      for (const i of target) {
        next[i] = { ...next[i], parseStatus: 'queued' };
      }
      return next;
    });
    try {
      const res = await fetch('/api/actions/parse/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entries: toParse,
          override_config: llmConfig,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobId(data.job_id);
      recordJobId(data.job_id);
      setEntries((prev) => {
        const next = [...prev];
        for (const i of target) {
          next[i] = { ...next[i], parseStatus: 'parsing' };
        }
        return next;
      });
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Parse failed');
      setParsing(false);
    }
  };

  const reparseEntry = async (idx: number) => {
    setPageError('');
    const entry = entries[idx];
    if (!entry) return;
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], parseStatus: 'parsing', parseError: null };
      return next;
    });
    try {
      const res = await fetch('/api/actions/parse/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entry: entry.raw,
          custom_prompt: entry.promptOverride || undefined,
          override_config: llmConfig,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], clean: data as KosClean, parseStatus: 'done', parseError: null, reviewStatus: 'pending' };
        return next;
      });
    } catch (e) {
      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], parseStatus: 'error', parseError: e instanceof Error ? e.message : 'Error' };
        return next;
      });
    }
  };

  const activeEntry = activeReviewIndex !== null ? entries[activeReviewIndex] : null;
  const effectiveClean = useMemo(() => {
    if (!activeEntry) return null;
    const base = activeEntry.clean;
    if (!base) return null;
    if (!activeEntry.edits) return base;
    return { ...base, ...activeEntry.edits } as KosClean;
  }, [activeEntry]);

  const updateEdit = useCallback((patch: Partial<KosClean>) => {
    if (activeReviewIndex === null) return;
    setEntries((prev) => {
      const next = [...prev];
      const entry = next[activeReviewIndex];
      next[activeReviewIndex] = { ...entry, edits: { ...(entry.edits || {}), ...patch } };
      return next;
    });
  }, [activeReviewIndex]);

  const approveEntry = (idx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], reviewStatus: 'approved' };
      return next;
    });
  };

  const rejectEntry = (idx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], reviewStatus: 'rejected' };
      return next;
    });
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setSaveResult(null);
    try {
      const approved = entries.filter((e) => e.reviewStatus === 'approved');
      if (saveOption === 'json') {
        const payload = approved.map((e) => {
          const clean = e.edits ? { ...(e.clean as KosClean), ...e.edits } : e.clean;
          return { ...clean, data_status: 'reviewed' };
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data_kost_clean.json';
        a.click();
        URL.revokeObjectURL(url);
        setSaveResult(`Exported ${payload.length} entries to JSON file.`);
      } else {
        const items = approved.map((e) => {
          const clean = e.edits ? { ...(e.clean as KosClean), ...e.edits } : e.clean;
          return { id: clean.id, parsed_data: clean, data_status: 'reviewed' };
        });
        const res = await fetch('/api/actions/parse/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items, dry_run: dryRun }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSaveResult(`DB import: ${data.updated} updated, ${data.skipped} skipped. ${data.errors?.length ? data.errors.length + ' errors.' : ''}`);
      }
    } catch (e) {
      setSaveResult(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  };

  const stats = useMemo(() => {
    const approved = entries.filter((e) => e.reviewStatus === 'approved').length;
    const rejected = entries.filter((e) => e.reviewStatus === 'rejected').length;
    const pending = entries.filter((e) => e.reviewStatus === 'pending').length;
    return { approved, rejected, pending, total: entries.length };
  }, [entries]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🧹 Parse & Clean Data Kos</h1>
        <a href="/kos" className={styles.outlineButton}>Back to List</a>
      </header>

      {pageError && <div className={styles.error}>{pageError}</div>}

      <div className={styles.stepper}>
        <StepBadge label="Config" active={step === 'config'} />
        <span className={styles.stepDivider} />
        <StepBadge label="Load" active={step === 'load'} />
        <span className={styles.stepDivider} />
        <StepBadge label="Parse" active={step === 'parse'} />
        <span className={styles.stepDivider} />
        <StepBadge label="Review" active={step === 'review'} />
        <span className={styles.stepDivider} />
        <StepBadge label="Save" active={step === 'save'} />
      </div>

      {/* ── STEP 0: LLM Config ── */}
      {step === 'config' && (
        <div className={styles.card}>
          <div className={styles.flexBetween} style={{ marginBottom: '0.75rem', cursor: 'pointer' }} onClick={() => setConfigExpanded((v) => !v)}>
            <h2 className={styles.cardTitle}>⚙️ LLM Configuration {configExpanded ? '▾' : '▸'}</h2>
          </div>
          {configExpanded && (
            <>
              <div className={styles.configGrid}>
                <div className={styles.field}>
                  <label>Preset</label>
                  <select
                    value={MODEL_PRESETS.find((p) => p.base === llmConfig.api_base && p.model === llmConfig.model)?.label || 'Custom...'}
                    onChange={(e) => {
                      const preset = MODEL_PRESETS.find((p) => p.label === e.target.value);
                      if (preset) {
                        setLlmConfig((prev) => ({ ...prev, api_base: preset.base, model: preset.model }));
                      }
                    }}
                  >
                    {MODEL_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>API Base URL</label>
                  <input type="text" value={llmConfig.api_base} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_base: e.target.value }))} placeholder="https://api.openai.com/v1" />
                </div>
                <div className={styles.field}>
                  <label>API Key</label>
                  <input type="password" value={llmConfig.api_key} onChange={(e) => setLlmConfig((prev) => ({ ...prev, api_key: e.target.value }))} placeholder="sk-..." />
                </div>
                <div className={styles.field}>
                  <label>Model</label>
                  <input type="text" value={llmConfig.model} onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))} placeholder="gpt-4o" />
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
                <button onClick={handleTestLlm} disabled={testingLlm}>{testingLlm ? 'Testing...' : '🧪 Test Connection'}</button>
                <button onClick={() => { saveLlmConfig(llmConfig); setTestResult(null); }}>💾 Save Config</button>
              </div>
              {testResult && (
                <div className={`${styles.testResult} ${testResult.status === 'ok' ? styles.testOk : styles.testErr}`}>
                  {testResult.status === 'ok' ? '✅' : '❌'} {testResult.message}
                </div>
              )}
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button onClick={() => goStep('load')}>Next: Load Data →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 1: Load Source ── */}
      {step === 'load' && (
        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📂 Load Data from Database</h2>
            <p className={styles.textMuted} style={{ marginBottom: '0.75rem' }}>
              Data dimuat otomatis dari koleksi <code>kos</code> di MongoDB.
            </p>
            <button onClick={handleLoadSource} disabled={rawEntries.length > 0}>Reload from DB</button>
          </div>

          {rawEntries.length > 0 && (
            <div className={styles.card}>
              <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
                <span className={styles.textMuted}>{rawEntries.length} entries loaded</span>
                <div className={styles.gap1}>
                  <button onClick={toggleSelectAll}>{selectedIndices.size === rawEntries.length ? 'Deselect All' : 'Select All'}</button>
                  <button onClick={() => startParse()} disabled={selectedIndices.size === 0 || parsing}>Parse Selected ({selectedIndices.size})</button>
                  <button onClick={() => startParse(rawEntries.map((_, i) => i))} disabled={parsing}>Parse All</button>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.checkboxCol}><input type="checkbox" checked={selectedIndices.size === rawEntries.length && rawEntries.length > 0} onChange={toggleSelectAll} /></th>
                      <th>#</th>
                      <th>Nama</th>
                      <th>Jenis</th>
                      <th>Harga (raw)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawEntries.map((r, i) => (
                      <tr key={i}>
                        <td className={styles.checkboxCol}><input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleSelectOne(i)} /></td>
                        <td>{r.No}</td>
                        <td>{r['Nama kos']}</td>
                        <td>{r['Jenis kos']}</td>
                        <td className={styles.textMuted}>{r.Harga?.slice(0, 40) || '-'}{r.Harga?.length > 40 ? '...' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button onClick={() => goStep('parse')} disabled={entries.every((e) => e.parseStatus === 'idle')}>
                  Next: Parse Progress →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Parse Progress ── */}
      {step === 'parse' && (
        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>⏳ Parse Progress</h2>
            {job && (
              <div style={{ marginBottom: '1rem' }}>
                <div className={styles.flexBetween} style={{ marginBottom: '0.25rem' }}>
                  <span>Job {job.job_id || jobId}</span>
                  <span className={styles.textMuted}>{job.completed}/{job.total} done · {job.failed} errors</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${job.total ? (job.completed / job.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Nama</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.index}>
                      <td>{e.raw.No}</td>
                      <td>
                        {e.parseStatus === 'done' && <span className={styles.statusDone}>✓ Done</span>}
                        {e.parseStatus === 'error' && <span className={styles.statusError}>⚠ Error</span>}
                        {e.parseStatus === 'parsing' && <span className={styles.statusParsing}>⏳ Parsing</span>}
                        {e.parseStatus === 'queued' && <span className={styles.statusQueue}>⬜ Queue</span>}
                        {e.parseStatus === 'idle' && <span className={styles.statusQueue}>⬜ Idle</span>}
                      </td>
                      <td>{e.raw['Nama kos']}</td>
                      <td>
                        {e.parseStatus === 'done' && (
                          <button className={styles.editBtn} onClick={() => { setActiveReviewIndex(e.index); goStep('review'); }}>
                            Review
                          </button>
                        )}
                        {e.parseStatus === 'error' && (
                          <button className={styles.editBtn} onClick={() => reparseEntry(e.index)}>Retry</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.actionsRow}>
              <button onClick={() => { if (jobId) fetch(`/api/actions/parse/jobs/${jobId}/cancel`, { method: 'POST' }); }} disabled={!parsing}>Stop Parsing</button>
              <button onClick={() => goStep('review')} disabled={!entries.some((e) => e.parseStatus === 'done')}>Next: Review →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review ── */}
      {step === 'review' && (
        <div>
          <div className={styles.reviewLayout}>
            {/* Left: entry list */}
            <div className={styles.entryList}>
              {entries.map((e) => (
                <div
                  key={e.index}
                  className={`${styles.entryListItem} ${activeReviewIndex === e.index ? styles.entryListItemActive : ''}`}
                  onClick={() => { setActiveReviewIndex(e.index); setEditingReview(false); }}
                >
                  <span>{e.raw.No}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.raw['Nama kos']}</span>
                  {e.reviewStatus === 'approved' && <span className={`${styles.badge} ${styles.badgeReviewed}`}>✓</span>}
                  {e.reviewStatus === 'rejected' && <span className={`${styles.badge} ${styles.badgeRejected}`}>✕</span>}
                  {e.parseStatus === 'error' && <span className={`${styles.badge} ${styles.badgeRejected}`}>!</span>}
                </div>
              ))}
            </div>

            {/* Right: diff + edit */}
            <div className={styles.reviewPanel}>
              {activeEntry && effectiveClean ? (
                <>
                  <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>Review #{activeEntry.raw.No}: {effectiveClean.nama}</h3>
                    <div className={styles.gap1}>
                      <button className={styles.editBtn} onClick={() => setEditingReview((v) => !v)}>{editingReview ? 'Done Editing' : 'Edit Fields'}</button>
                      <button className={styles.approveBtn} onClick={() => approveEntry(activeReviewIndex)}>Approve</button>
                      <button className={styles.rejectBtn} onClick={() => rejectEntry(activeReviewIndex)}>Reject</button>
                    </div>
                  </div>

                  {!editingReview && (
                    <div className={styles.diffPanel}>
                      <div className={styles.diffBox}>
                        <strong style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Raw</strong>
                        <pre>{JSON.stringify(activeEntry.raw, null, 2)}</pre>
                      </div>
                      <div className={styles.diffBox}>
                        <strong style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cleaned</strong>
                        <pre>{JSON.stringify(effectiveClean, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  <div className={styles.humanReview}>
                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Harga</div>
                      {editingReview ? (
                        <HargaEditor value={effectiveClean.harga} onChange={(v) => updateEdit({ harga: v })} />
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {effectiveClean.harga.map((h, i) => (
                            <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', background: 'var(--accent-light)', fontSize: '0.8rem' }}>
                              {h.tipe_kamar ? `${h.tipe_kamar} · ` : ''}Rp {h.min.toLocaleString()}{h.min !== h.max ? ` - ${h.max.toLocaleString()}` : ''} / {h.periode}
                            </span>
                          ))}
                          {effectiveClean.harga.length === 0 && <span className={styles.textMuted}>-</span>}
                        </div>
                      )}
                    </div>

                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Fasilitas</div>
                      {editingReview ? (
                        <FasilitasEditor value={effectiveClean.fasilitas} onChange={(v) => updateEdit({ fasilitas: v })} />
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {effectiveClean.fasilitas.dalam_kamar.map((f) => <span key={f} className={`${styles.badge} ${styles.badgeReviewed}`}>{f}</span>)}
                          {effectiveClean.fasilitas.bersama.map((f) => <span key={f} className={`${styles.badge} ${styles.badgeParsed}`}>{f}</span>)}
                          {effectiveClean.fasilitas.utilitas.map((f) => <span key={f} className={`${styles.badge} ${styles.badgeRaw}`}>{f}</span>)}
                          {effectiveClean.fasilitas.catatan && <span className={styles.textMuted}>{effectiveClean.fasilitas.catatan}</span>}
                        </div>
                      )}
                    </div>

                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Peraturan</div>
                      {editingReview ? (
                        <PeraturanEditor value={effectiveClean.peraturan} onChange={(v) => updateEdit({ peraturan: v })} />
                      ) : (
                        <div style={{ fontSize: '0.85rem' }}>
                          <div>Jam malam: {effectiveClean.peraturan.jam_malam ?? '-'}</div>
                          <div>Tamu lawan jenis: {effectiveClean.peraturan.tamu_lawan_jenis ?? '-'}</div>
                          <div>Tamu menginap: {effectiveClean.peraturan.tamu_menginap === null ? '-' : effectiveClean.peraturan.tamu_menginap ? 'Diizinkan' : 'Dilarang'}</div>
                          <div>Hewan: {effectiveClean.peraturan.boleh_hewan === null ? '-' : effectiveClean.peraturan.boleh_hewan ? 'Diizinkan' : 'Dilarang'}</div>
                          {effectiveClean.peraturan.lainnya.length > 0 && <div>Lainnya: {effectiveClean.peraturan.lainnya.join(', ')}</div>}
                        </div>
                      )}
                    </div>

                    <div className={styles.reviewSection}>
                      <div className={styles.reviewSectionTitle}>Kontak</div>
                      {editingReview ? (
                        <KontakEditor value={effectiveClean.kontak} onChange={(v) => updateEdit({ kontak: v })} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {effectiveClean.kontak.map((k, i) => (
                            <a key={i} href={k.url_wa} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                              {k.nama || 'Tanpa Nama'} — {k.nomor_wa}
                            </a>
                          ))}
                          {effectiveClean.kontak.length === 0 && <span className={styles.textMuted}>-</span>}
                        </div>
                      )}
                    </div>

                    {activeEntry.parseStatus === 'error' && (
                      <div className={styles.error} style={{ marginTop: '0.75rem' }}>
                        Error: {activeEntry.parseError}
                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Custom prompt override (optional)</label>
                          <textarea
                            rows={2}
                            value={activeEntry.promptOverride || ''}
                            onChange={(e) => setEntries((prev) => {
                              const next = [...prev];
                              next[activeReviewIndex] = { ...next[activeReviewIndex], promptOverride: e.target.value || null };
                              return next;
                            })}
                            style={{ width: '100%', fontSize: '0.8rem' }}
                            placeholder="Instruksi tambahan untuk re-parse..."
                          />
                          <button onClick={() => reparseEntry(activeReviewIndex)} style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Re-parse</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.textMuted}>Pilih entri di sidebar untuk review.</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button onClick={() => goStep('save')} disabled={stats.approved === 0}>Next: Save ({stats.approved} approved) →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Save ── */}
      {step === 'save' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>💾 Save / Export</h2>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Summary:</strong> {stats.approved} approved, {stats.rejected} rejected, {stats.pending} pending / {stats.total} total
          </div>

          <div className={styles.saveOptions}>
            <label className={styles.saveOption}>
              <input type="radio" name="save" checked={saveOption === 'json'} onChange={() => setSaveOption('json')} />
              <span>Save to clean JSON (download file)</span>
            </label>
            <label className={styles.saveOption}>
              <input type="radio" name="save" checked={saveOption === 'db'} onChange={() => setSaveOption('db')} />
              <span>Import to Database (overwrite kos table parsed_data)</span>
            </label>
          </div>

          {saveOption === 'db' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              <span>Dry-run (preview only, no actual write)</span>
            </label>
          )}

          <div className={styles.actionsRow}>
            <button onClick={handleSave} disabled={saveLoading || stats.approved === 0}>
              {saveLoading ? 'Saving...' : 'Execute'}
            </button>
            <button className={styles.editBtn} onClick={() => goStep('review')}>← Back to Review</button>
          </div>

          {saveResult && (
            <div className={saveResult.includes('failed') || saveResult.includes('Error') ? styles.error : styles.success} style={{ marginTop: '1rem' }}>
              {saveResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
