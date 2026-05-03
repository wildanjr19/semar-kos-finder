'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, PrototypeChrome } from '../chrome';
import styles from '../prototype.module.css';
import type { JobItemState, JobState } from '@/hooks/useJobPoller';
import { useJobPoller } from '@/hooks/useJobPoller';

type JobFilter = 'all' | 'running' | 'done' | 'cancelled' | 'error';
type BadgeTone = 'raw' | 'parsed' | 'reviewed' | 'rejected' | 'blue' | 'rose' | 'amber';

interface JobSummary {
  job_id: string;
  username: string;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'error';
  total: number;
  completed: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asJobState(value: unknown): JobState | null {
  if (!isRecord(value)) return null;
  if (typeof value.job_id !== 'string') return null;
  if (typeof value.status !== 'string') return null;
  if (typeof value.total !== 'number') return null;
  if (typeof value.completed !== 'number') return null;
  if (typeof value.failed !== 'number') return null;
  if (!Array.isArray(value.results)) return null;
  if (!Array.isArray(value.errors)) return null;
  if (typeof value.created_at !== 'string') return null;
  return {
    ...value,
    current_index: typeof value.current_index === 'number' ? value.current_index : null,
    items: Array.isArray(value.items) ? value.items : [],
  } as unknown as JobState;
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

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID');
}

function normalizeStatus(job: Pick<JobSummary, 'status' | 'failed'>): JobFilter {
  if (job.status === 'done' && job.failed > 0) return 'error';
  if (job.status === 'pending' || job.status === 'running') return 'running';
  if (job.status === 'done') return 'done';
  if (job.status === 'cancelled') return 'cancelled';
  return 'error';
}

function jobTone(job: Pick<JobSummary, 'status' | 'failed'>): 'raw' | 'parsed' | 'reviewed' | 'rejected' | 'amber' {
  const status = normalizeStatus(job);
  if (status === 'done') return 'reviewed';
  if (status === 'running') return 'parsed';
  if (status === 'cancelled' || status === 'error') return 'rejected';
  return 'amber';
}

function readableStatus(job: Pick<JobSummary, 'status' | 'failed'>): string {
  const status = normalizeStatus(job);
  if (status === 'running') return 'Running';
  if (status === 'done') return 'Done';
  if (status === 'cancelled') return 'Cancelled';
  if (job.status === 'done' && job.failed > 0) return 'Done (with errors)';
  return 'Error';
}

function itemStatusTone(status: JobItemState['status']): BadgeTone {
  if (status === 'done') return 'parsed';
  if (status === 'error' || status === 'cancelled') return 'rejected';
  if (status === 'in_progress') return 'blue';
  return 'amber';
}

function itemStatusLabel(status: JobItemState['status']): string {
  if (status === 'todo') return 'Todo';
  if (status === 'in_progress') return 'In progress';
  if (status === 'done') return 'Done';
  if (status === 'cancelled') return 'Cancelled';
  return 'Error';
}

function shouldIncludeFilter(job: Pick<JobSummary, 'status' | 'failed'>, filter: JobFilter): boolean {
  if (filter === 'all') return true;
  return normalizeStatus(job) === filter;
}

export default function PrototypeJobsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobFilter>('all');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Monitor batch parse dan cancel job aktif langsung dari prototype.');
  const [selectedDetail, setSelectedDetail] = useState<JobState | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/actions/parse/jobs', { cache: 'no-store' });
      const payload = await readJsonSafe(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal mengambil daftar jobs.'));
      }
      if (!Array.isArray(payload)) {
        throw new Error('Response jobs tidak valid.');
      }

      const mapped = payload.filter(isRecord).map((item) => ({
        job_id: String(item.job_id || ''),
        username: String(item.username || ''),
        status: (['pending', 'running', 'done', 'cancelled', 'error'].includes(String(item.status || ''))
          ? String(item.status)
          : 'error') as JobSummary['status'],
        total: Number(item.total || 0),
        completed: Number(item.completed || 0),
        failed: Number(item.failed || 0),
        created_at: String(item.created_at || ''),
        updated_at: String(item.updated_at || ''),
      }));

      setJobs(mapped);
      setSelectedId((current) => {
        if (current && mapped.some((job) => job.job_id === current)) return current;
        return mapped[0]?.job_id || null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal mengambil daftar jobs.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchJobs();
    const timer = setInterval(() => {
      void fetchJobs();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  const activeIds = useMemo(
    () => jobs
      .filter((job) => job.status === 'running' || job.status === 'pending')
      .map((job) => job.job_id),
    [jobs],
  );

  const polledJobs = useJobPoller(activeIds, { interval: 2000 });

  const mergedJobs = useMemo(() => jobs.map((job) => {
    const live = polledJobs[job.job_id];
    if (!live) return job;
    return {
      ...job,
      status: live.status,
      total: live.total,
      completed: live.completed,
      failed: live.failed,
    };
  }), [jobs, polledJobs]);

  const filteredJobs = useMemo(
    () => mergedJobs.filter((job) => shouldIncludeFilter(job, filter)),
    [filter, mergedJobs],
  );

  const selectedSummary = useMemo(
    () => filteredJobs.find((job) => job.job_id === selectedId) || null,
    [filteredJobs, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/actions/parse/jobs/${selectedId}`, { cache: 'no-store' });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, 'Gagal mengambil detail job.'));
        }
        const detail = asJobState(payload);
        if (!cancelled && detail) {
          setSelectedDetail(detail);
        }
      } catch {
        if (!cancelled) setSelectedDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    void fetchDetail();
    const timer = setInterval(() => {
      void fetchDetail();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId]);

  const cancelSelected = async () => {
    if (!selectedSummary || (selectedSummary.status !== 'running' && selectedSummary.status !== 'pending')) {
      return;
    }
    setWorking(true);
    setError('');
    try {
      const response = await fetch(`/api/actions/parse/jobs/${selectedSummary.job_id}/cancel`, {
        method: 'POST',
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Gagal cancel job terpilih.'));
      }
      setMessage(`Job ${selectedSummary.job_id} dibatalkan.`);
      await fetchJobs();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Gagal cancel job terpilih.');
    } finally {
      setWorking(false);
    }
  };

  const detail = selectedId ? polledJobs[selectedId] || selectedDetail : null;
  const detailItems = detail?.items || [];
  const detailItemCounts = {
    todo: detailItems.filter((item) => item.status === 'todo').length,
    inProgress: detailItems.filter((item) => item.status === 'in_progress').length,
    done: detailItems.filter((item) => item.status === 'done').length,
    error: detailItems.filter((item) => item.status === 'error').length,
    cancelled: detailItems.filter((item) => item.status === 'cancelled').length,
  };
  const progressPercent = selectedSummary
    ? Math.round(((selectedSummary.completed + selectedSummary.failed) / Math.max(selectedSummary.total, 1)) * 100)
    : 0;

  const stats = useMemo(() => ({
    running: mergedJobs.filter((job) => normalizeStatus(job) === 'running').length,
    done: mergedJobs.filter((job) => normalizeStatus(job) === 'done').length,
    error: mergedJobs.filter((job) => normalizeStatus(job) === 'error').length,
    cancelled: mergedJobs.filter((job) => normalizeStatus(job) === 'cancelled').length,
  }), [mergedJobs]);

  return (
    <PrototypeChrome active="jobs">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Parse Jobs</p>
          <h1>Monitor job parsing</h1>
        </div>
        <div className={styles.topbarActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void fetchJobs()} disabled={loading || working}>{loading ? 'Reloading...' : 'Reload'}</button>
          <button type="button" className={styles.dangerAction} onClick={cancelSelected} disabled={!selectedSummary || (selectedSummary.status !== 'running' && selectedSummary.status !== 'pending') || working}>Cancel selected</button>
        </div>
      </header>

      <section className={styles.actionPanel} aria-live="polite">
        <strong>Live job mode</strong>
        <span>{message}</span>
      </section>

      {error && <section className={`${styles.actionPanel} ${styles.errorPanel}`} role="alert"><strong>Job error</strong><span>{error}</span></section>}

      <section className={styles.metricsGrid}>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.toneinfo}`} /><strong>{stats.running}</strong><span>Running</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonesuccess}`} /><strong>{stats.done}</strong><span>Done</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonewarning}`} /><strong>{stats.error}</strong><span>Error</span></article>
        <article className={styles.metricCard}><span className={`${styles.metricDot} ${styles.tonemuted}`} /><strong>{stats.cancelled}</strong><span>Cancelled</span></article>
      </section>

      <section className={styles.sectionGrid}>
        <div className={styles.panelWide}>
          <div className={styles.filterChips} aria-label="Filter job status">
            {(['all', 'running', 'done', 'cancelled', 'error'] as const).map((entry) => (
              <button key={entry} type="button" className={filter === entry ? styles.filterChipActive : styles.filterChip} onClick={() => setFilter(entry)}>
                {entry}
              </button>
            ))}
          </div>

          <div className={styles.desktopTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Updated</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.emptyTableCell}>{loading ? 'Memuat jobs...' : 'Belum ada parse job.'}</td>
                  </tr>
                )}

                {filteredJobs.map((job) => {
                  const percent = Math.round(((job.completed + job.failed) / Math.max(job.total, 1)) * 100);
                  return (
                    <tr key={job.job_id} className={selectedId === job.job_id ? styles.selectedRow : ''}>
                      <td>
                        <button type="button" className={styles.rowButton} onClick={() => setSelectedId(job.job_id)}>
                          <strong>{job.job_id}</strong>
                          <span>{job.completed}/{job.total} done - {job.failed} gagal</span>
                        </button>
                      </td>
                      <td><Badge tone={jobTone(job)}>{readableStatus(job)}</Badge></td>
                      <td><div className={styles.jobProgress}><span style={{ width: `${percent}%` }} /></div></td>
                      <td>{formatDate(job.updated_at || job.created_at)}</td>
                      <td>
                        <button type="button" className={styles.tableAction} onClick={() => setSelectedId(job.job_id)}>Detail</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {filteredJobs.map((job) => {
              const percent = Math.round(((job.completed + job.failed) / Math.max(job.total, 1)) * 100);
              return (
                <article key={job.job_id} className={styles.kosCard}>
                  <div className={styles.cardTopline}>
                    <Badge tone={jobTone(job)}>{readableStatus(job)}</Badge>
                    <Badge tone="amber">{percent}%</Badge>
                  </div>
                  <strong>{job.job_id}</strong>
                  <p>{job.completed}/{job.total} done - {job.failed} gagal</p>
                  <button type="button" className={styles.tableAction} onClick={() => setSelectedId(job.job_id)}>Detail</button>
                </article>
              );
            })}
          </div>
        </div>

        <aside className={styles.drawer}>
          {selectedSummary ? (
            <>
              <div className={styles.drawerHeader}>
                <Badge tone={jobTone(selectedSummary)}>{readableStatus(selectedSummary)}</Badge>
                <h2>{selectedSummary.job_id}</h2>
                <p>{selectedSummary.completed}/{selectedSummary.total} done - {selectedSummary.failed} gagal</p>
              </div>

              <div className={styles.cleanField}><strong>progress</strong><span>{progressPercent}%</span></div>
              <div className={styles.cleanField}><strong>created</strong><span>{formatDate(selectedSummary.created_at)}</span></div>
              <div className={styles.cleanField}><strong>updated</strong><span>{formatDate(selectedSummary.updated_at || selectedSummary.created_at)}</span></div>

              {detailItems.length > 0 && (
                <article className={styles.compareCardStrong}>
                  <span className={styles.compareLabel}>Item queue</span>
                  <div className={styles.cardTopline}>
                    <Badge tone="amber">Todo {detailItemCounts.todo}</Badge>
                    <Badge tone="blue">In progress {detailItemCounts.inProgress}</Badge>
                    <Badge tone="parsed">Done {detailItemCounts.done}</Badge>
                    <Badge tone="rejected">Error {detailItemCounts.error}</Badge>
                    {detailItemCounts.cancelled > 0 && <Badge tone="rejected">Cancelled {detailItemCounts.cancelled}</Badge>}
                  </div>
                  {detailItems.map((item) => (
                    <div key={`${item.index}-${item.id}`} className={styles.cleanField}>
                      <strong>#{item.index + 1}</strong>
                      <span>
                        <Badge tone={itemStatusTone(item.status)}>{itemStatusLabel(item.status)}</Badge>{' '}
                        {item.name || item.id || 'Kos tanpa nama'}
                        {item.error ? ` - ${item.error}` : ''}
                      </span>
                    </div>
                  ))}
                </article>
              )}

              {detailLoading && <div className={styles.actionPanel}><strong>Loading detail</strong><span>Mengambil hasil parse job...</span></div>}

              {detail?.errors && detail.errors.length > 0 && (
                <article className={styles.compareCard}>
                  <span className={styles.compareLabel}>Errors ({detail.errors.length})</span>
                  {detail.errors.slice(0, 5).map((item) => (
                    <p key={`${item.index}-${item.error}`}>#{item.index}: {item.error}</p>
                  ))}
                </article>
              )}

              {detail?.results && detail.results.length > 0 && (
                <article className={styles.compareCardStrong}>
                  <span className={styles.compareLabel}>Latest results</span>
                  {detail.results.slice(-5).map((item) => (
                    <p key={`${item.index}-${item.error || 'ok'}`}>#{item.index}: {item.error ? `ERROR - ${item.error}` : 'OK'}</p>
                  ))}
                </article>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>Pilih job untuk lihat detail.</div>
          )}
        </aside>
      </section>
    </PrototypeChrome>
  );
}
