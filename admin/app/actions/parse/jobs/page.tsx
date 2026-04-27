'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../parse.module.css';
import { useJobPoller, JobState } from '@/hooks/useJobPoller';

interface JobSummary {
  job_id: string;
  username: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

export default function ParseJobsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'done'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/actions/parse/jobs${filter !== 'all' ? `?status=${filter}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setJobs(data);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const t = setInterval(fetchJobs, 5000);
    return () => clearInterval(t);
  }, [filter]);

  const activeIds = useMemo(() => jobs.filter((j) => j.status === 'running' || j.status === 'pending').map((j) => j.job_id), [jobs]);
  const polledJobs = useJobPoller(activeIds, { interval: 2000 });

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }
    let cancelled = false;
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/actions/parse/jobs/${selectedJobId}`);
        const data = await res.json();
        if (!cancelled && !data.error) {
          setSelectedJobDetail(data as JobState);
        }
      } catch {
        if (!cancelled) setSelectedJobDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    fetchDetail();
    const t = setInterval(fetchDetail, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [selectedJobId]);

  const handleCancel = async (jobId: string) => {
    try {
      await fetch(`/api/actions/parse/jobs/${jobId}/cancel`, { method: 'POST' });
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  const selectedDetail = selectedJobId
    ? ((polledJobs[selectedJobId] as JobState | undefined) || selectedJobDetail || jobs.find((j) => j.job_id === selectedJobId))
    : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🧹 Parse Jobs</h1>
        <a href="/actions/parse" className={styles.outlineButton}>← Back to Parse</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['all', 'running', 'done'] as const).map((f) => (
              <button
                key={f}
                className={filter === f ? styles.approveBtn : styles.editBtn}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'running' ? 'Running' : 'Done'}
              </button>
            ))}
          </div>
          <button onClick={fetchJobs} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Total</th>
                <th>Done</th>
                <th>Failed</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const isActive = j.status === 'running' || j.status === 'pending';
                const pctDone = j.total ? Math.round((j.completed / j.total) * 100) : 0;
                const pctFailed = j.total ? Math.round((j.failed / j.total) * 100) : 0;
                return (
                  <tr key={j.job_id}>
                    <td><code>{j.job_id}</code></td>
                    <td>
                      <span className={
                        j.status === 'done' ? styles.statusDone :
                        j.status === 'error' ? styles.statusError :
                        j.status === 'running' ? styles.statusParsing :
                        j.status === 'cancelled' ? styles.statusQueue :
                        styles.statusQueue
                      }>
                        {j.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.progressBar} style={{ width: '120px', display: 'flex', overflow: 'hidden' }}>
                        <div className={styles.progressFill} style={{ width: `${pctDone}%`, background: '#22c55e' }} />
                        <div style={{ width: `${pctFailed}%`, background: '#ef4444', transition: 'width 0.3s ease', height: '100%' }} />
                      </div>
                    </td>
                    <td>{j.total}</td>
                    <td>{j.completed}</td>
                    <td>{j.failed}</td>
                    <td>{new Date(j.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className={styles.editBtn} onClick={() => setSelectedJobId(j.job_id)}>View</button>
                        {isActive && (
                          <button className={styles.rejectBtn} onClick={() => handleCancel(j.job_id)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.textMuted} style={{ textAlign: 'center' }}>No jobs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedDetail && (
        <div className={styles.card} style={{ marginTop: '1rem' }}>
          <div className={styles.flexBetween} style={{ marginBottom: '0.75rem' }}>
            <h3 className={styles.cardTitle}>Job {selectedDetail.job_id}</h3>
            <button className={styles.editBtn} onClick={() => setSelectedJobId(null)}>Close</button>
          </div>
          {detailLoading && <div className={styles.textMuted} style={{ marginBottom: '0.75rem' }}>Loading detail...</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><strong>Status</strong><div>{selectedDetail.status}</div></div>
            <div><strong>Total</strong><div>{selectedDetail.total}</div></div>
            <div><strong>Completed</strong><div>{selectedDetail.completed}</div></div>
            <div><strong>Failed</strong><div>{selectedDetail.failed}</div></div>
          </div>
          <div className={styles.importPreview} style={{ marginBottom: '1rem' }}>
            Parse job hanya menjalankan ekstraksi. Hasil parse disimpan ke data kos sebagai <strong>parsed</strong>, review final tetap dilakukan di halaman parse wizard.
          </div>
          {'results' in selectedDetail && Array.isArray(selectedDetail.results) && selectedDetail.results.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Results</strong>
              <div className={styles.tableWrap} style={{ marginTop: '0.5rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>#</th><th>Status</th><th>Preview</th></tr>
                  </thead>
                  <tbody>
                    {selectedDetail.results.map((r: { index: number; error: string | null }) => (
                      <tr key={r.index}>
                        <td>{r.index}</td>
                        <td className={r.error ? styles.statusError : styles.statusDone}>{r.error ? 'Error' : 'Done'}</td>
                        <td className={styles.textMuted}>{r.error || 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {'errors' in selectedDetail && Array.isArray(selectedDetail.errors) && selectedDetail.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Errors</strong>
              <div className={styles.tableWrap} style={{ marginTop: '0.5rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>#</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {selectedDetail.errors.map((e: { index: number; error: string }) => (
                      <tr key={e.index}>
                        <td>{e.index}</td>
                        <td className={styles.statusError}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
