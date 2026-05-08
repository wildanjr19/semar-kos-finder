'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface JobState {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'error';
  total: number;
  completed: number;
  failed: number;
  results: Array<{ index: number; raw: unknown; clean: unknown; error: string | null }>;
  errors: Array<{ index: number; raw: unknown; error: string }>;
  created_at: string;
}

interface UseJobPollerOptions {
  interval?: number;
  onComplete?: (job: JobState) => void;
  onError?: (job: JobState) => void;
  onProgress?: (job: JobState) => void;
}

export function useJobPoller(
  jobIds: string[],
  options: UseJobPollerOptions = {}
) {
  const { interval = 2000, onComplete, onError, onProgress } = options;
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const prevStatuses = useRef<Record<string, string>>({});

  const fetchJob = useCallback(async (jobId: string): Promise<JobState | null> => {
    try {
      const res = await fetch(`/api/actions/parse/jobs/${jobId}`);
      const data = await res.json();
      if (data.error) return null;
      return data as JobState;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (jobIds.length === 0) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const poll = async () => {
      if (cancelled) return;
      const activeIds: string[] = [];

      for (const jobId of jobIds) {
        const job = await fetchJob(jobId);
        if (!job) continue;

        setJobs((prev) => ({ ...prev, [jobId]: job }));

        const prevStatus = prevStatuses.current[jobId];
        if (prevStatus && prevStatus !== job.status) {
          if (job.status === 'done' && onComplete) onComplete(job);
          if (job.status === 'error' && onError) onError(job);
        }
        if (onProgress) onProgress(job);
        prevStatuses.current[jobId] = job.status;

        if (job.status === 'running' || job.status === 'pending') {
          activeIds.push(jobId);
        }
      }

      if (activeIds.length > 0 && !cancelled) {
        const t = setTimeout(poll, interval);
        timers.push(t);
      }
    };

    poll();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [jobIds, interval, fetchJob, onComplete, onError, onProgress]);

  return jobs;
}
