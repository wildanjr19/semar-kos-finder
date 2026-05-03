'use client';

import { useEffect, useState, useCallback } from 'react';
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
    const hasFailedItems = job.failed > 0;
    setBanners((prev) => [
      ...prev,
      {
        id: job.job_id,
        type: hasFailedItems ? 'error' : 'done',
        message: hasFailedItems
          ? `Job ${job.job_id} selesai dengan gagal ${job.failed}/${job.total}`
          : `Job ${job.job_id} selesai (${job.completed}/${job.total})`,
      },
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

  useJobPoller(storedIds, {
    interval: 2000,
    onComplete: handleComplete,
    onError: handleError,
  });

  const dismissBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <>
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
