'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useJobPoller, JobState } from '@/hooks/useJobPoller';

const JOBS_STORAGE_KEY = 'parse_jobs';

interface Banner {
  id: string;
  type: 'done' | 'error';
  message: string;
}

export default function BackgroundTaskIndicator() {
  const [storedIds, setStoredIds] = useState<string[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const prevJobs = useRef<Record<string, JobState>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(JOBS_STORAGE_KEY);
    if (raw) {
      try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setStoredIds(ids);
      } catch { /* ignore */ }
    }
  }, []);

  const handleComplete = useCallback((job: JobState) => {
    setBanners((prev) => [
      ...prev,
      { id: job.job_id, type: 'done', message: `Job ${job.job_id} completed (${job.completed}/${job.total})` },
    ]);
    setTimeout(() => {
      setStoredIds((prev) => {
        const next = prev.filter((id) => id !== job.job_id);
        localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }, 5000);
  }, []);

  const handleError = useCallback((job: JobState) => {
    setBanners((prev) => [
      ...prev,
      { id: job.job_id, type: 'error', message: `Job ${job.job_id} failed` },
    ]);
    setTimeout(() => {
      setStoredIds((prev) => {
        const next = prev.filter((id) => id !== job.job_id);
        localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }, 5000);
  }, []);

  const jobs = useJobPoller(storedIds, {
    interval: 2000,
    onComplete: handleComplete,
    onError: handleError,
  });

  const activeJobs = storedIds
    .map((id) => jobs[id])
    .filter((j): j is JobState => !!j && (j.status === 'running' || j.status === 'pending'));

  const dismissBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <>
      {/* Floating indicator */}
      {activeJobs.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 100,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '0.8rem',
          minWidth: '220px',
        }}>
          {activeJobs.map((j) => {
            const pctDone = j.total ? (j.completed / j.total) * 100 : 0;
            const pctFailed = j.total ? (j.failed / j.total) * 100 : 0;
            return (
              <div key={j.job_id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span>🔄</span>
                  <span>Parse {j.completed}/{j.total}</span>
                  <a href="/actions/parse" style={{ color: 'var(--accent)', textDecoration: 'underline', marginLeft: 'auto' }}>Lihat</a>
                </div>
                {/* Segmented progress bar */}
                <div style={{
                  height: '6px',
                  background: 'var(--border)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  display: 'flex',
                }}>
                  <div style={{
                    width: `${pctDone}%`,
                    background: '#22c55e',
                    transition: 'width 0.3s ease',
                  }} />
                  <div style={{
                    width: `${pctFailed}%`,
                    background: '#ef4444',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                  {Math.round(pctDone)}% done{j.failed > 0 ? ` · ${j.failed} failed` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-app banners */}
      {banners.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {banners.map((b) => (
            <div
              key={b.id}
              style={{
                background: b.type === 'done' ? '#dcfce7' : '#fee2e2',
                border: `1px solid ${b.type === 'done' ? '#86efac' : '#fca5a5'}`,
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                boxShadow: 'var(--shadow-lg)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: '240px',
              }}
            >
              <span>{b.type === 'done' ? '✅' : '❌'}</span>
              <span style={{ flex: 1 }}>{b.message}</span>
              <button
                onClick={() => dismissBanner(b.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
