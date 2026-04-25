'use client';

import { useEffect, useState } from 'react';

interface JobSummary {
  job_id: string;
  status: string;
  total: number;
  completed: number;
}

export default function BackgroundTaskIndicator() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // We don't have a list endpoint, so we rely on localStorage tracking
        const stored = localStorage.getItem('parse_jobs');
        if (stored) {
          const jobIds: string[] = JSON.parse(stored);
          const active: JobSummary[] = [];
          for (const id of jobIds) {
            const res = await fetch(`/api/actions/parse/jobs/${id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'running' || data.status === 'pending') {
                active.push({
                  job_id: data.job_id,
                  status: data.status,
                  total: data.total,
                  completed: data.completed,
                });
              }
            }
          }
          setJobs(active);
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (jobs.length === 0) return null;

  return (
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
    }}>
      {jobs.map((j) => (
        <div key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔄</span>
          <span>Parse {j.completed}/{j.total}</span>
          <a href="/actions/parse" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Lihat</a>
        </div>
      ))}
    </div>
  );
}
