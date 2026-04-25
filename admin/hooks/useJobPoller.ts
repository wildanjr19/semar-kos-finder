'use client';

import { useEffect, useState } from 'react';

export interface JobState {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'cancelled';
  total: number;
  completed: number;
  failed: number;
  results: Array<{ index: number; raw: unknown; clean: unknown; error: string | null }>;
  errors: Array<{ index: number; raw: unknown; error: string }>;
  created_at: string;
}

export function useJobPoller(jobId: string | null) {
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/actions/parse/jobs/${jobId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          // handle error
          console.error('Job poll error:', data.error);
        } else {
          setJob(data);
          if (data.status === 'running' || data.status === 'pending') {
            setTimeout(poll, 2000);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Job poll network error:', e);
          setTimeout(poll, 5000);
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  return job;
}
