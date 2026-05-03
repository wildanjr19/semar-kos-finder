'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type JobItemStatus = 'todo' | 'in_progress' | 'done' | 'error' | 'cancelled';

export interface JobItemState {
  index: number;
  id: string;
  name: string;
  status: JobItemStatus;
  error: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface JobState {
  job_id: string;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'error';
  total: number;
  completed: number;
  failed: number;
  current_index: number | null;
  items: JobItemState[];
  results: Array<{ index: number; raw: unknown; clean: unknown; error: string | null }>;
  errors: Array<{ index: number; raw: unknown; error: string }>;
  created_at: string;
}

interface UseJobPollerOptions {
  interval?: number;
  onComplete?: (job: JobState) => void;
  onError?: (job: JobState) => void;
  onProgress?: (job: JobState) => void;
  onMissing?: (jobId: string) => void;
}

type FetchJobResult =
  | { job: JobState; missing: false }
  | { job: null; missing: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJobState(value: unknown): value is JobState {
  if (!isRecord(value)) return false;
  return (
    typeof value.job_id === 'string' &&
    ['pending', 'running', 'done', 'cancelled', 'error'].includes(String(value.status)) &&
    typeof value.total === 'number' &&
    typeof value.completed === 'number' &&
    typeof value.failed === 'number' &&
    Array.isArray(value.items) &&
    Array.isArray(value.results) &&
    Array.isArray(value.errors) &&
    typeof value.created_at === 'string'
  );
}

export function useJobPoller(
  jobIds: string[],
  options: UseJobPollerOptions = {}
) {
  const { interval = 2000, onComplete, onError, onProgress, onMissing } = options;
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const prevStatuses = useRef<Record<string, string>>({});

  const fetchJob = useCallback(async (jobId: string): Promise<FetchJobResult> => {
    try {
      const res = await fetch(`/api/actions/parse/jobs/${jobId}`);
      const data: unknown = await res.json().catch(() => null);
      if (res.status === 404) return { job: null, missing: true };
      if (!res.ok) return { job: null, missing: false };
      if (!isJobState(data)) return { job: null, missing: true };
      return { job: data, missing: false };
    } catch {
      return { job: null, missing: false };
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
        const result = await fetchJob(jobId);
        if (!result.job) {
          if (result.missing) {
            delete prevStatuses.current[jobId];
            setJobs((prev) => {
              if (!(jobId in prev)) return prev;
              const next = { ...prev };
              delete next[jobId];
              return next;
            });
            if (onMissing) onMissing(jobId);
          }
          continue;
        }

        const job = result.job;

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
  }, [jobIds, interval, fetchJob, onComplete, onError, onProgress, onMissing]);

  return jobs;
}
