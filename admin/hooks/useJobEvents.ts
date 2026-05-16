'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { JobState, useJobPoller } from './useJobPoller';

export type JobConnectionStatus = 'live' | 'reconnecting' | 'polling';

interface UseJobEventsOptions {
  interval?: number;
  onComplete?: (job: JobState) => void;
  onError?: (job: JobState) => void;
  onProgress?: (job: JobState) => void;
  onMissing?: (jobId: string) => void;
  maxEventSourceErrors?: number;
}

interface UseJobEventsResult {
  jobs: Record<string, JobState>;
  connectionStatus: JobConnectionStatus;
  connectionStatuses: Record<string, JobConnectionStatus>;
}

const TERMINAL_STATUSES = new Set<JobState['status']>(['done', 'cancelled', 'error']);
const JOB_EVENTS = ['job.snapshot', 'job.progress', 'job.completed', 'job.error', 'job.cancelled'] as const;

function parseJobEvent(event: MessageEvent<string>): JobState | null {
  try {
    const data: unknown = JSON.parse(event.data);
    if (typeof data === 'object' && data !== null && 'job_id' in data) {
      return data as JobState;
    }
  } catch {
    return null;
  }
  return null;
}

function toConnectionStatus(statuses: Record<string, JobConnectionStatus>): JobConnectionStatus {
  const values = Object.values(statuses);
  if (values.includes('polling')) return 'polling';
  if (values.includes('reconnecting')) return 'reconnecting';
  return 'live';
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useJobEvents(
  jobIds: string[],
  options: UseJobEventsOptions = {},
): UseJobEventsResult {
  const {
    interval = 2000,
    onComplete,
    onError,
    onProgress,
    onMissing,
    maxEventSourceErrors = 3,
  } = options;
  const [eventJobs, setEventJobs] = useState<Record<string, JobState>>({});
  const [fallbackIds, setFallbackIds] = useState<string[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, JobConnectionStatus>>({});
  const prevStatuses = useRef<Record<string, JobState['status']>>({});

  const fallbackJobs = useJobPoller(fallbackIds, { interval, onComplete, onError, onProgress, onMissing });

  useEffect(() => {
    const activeJobIds = jobIds.filter((jobId) => !fallbackIds.includes(jobId));
    const activeJobIdSet = new Set(activeJobIds);

    setFallbackIds((prev) => {
      const next = prev.filter((jobId) => jobIds.includes(jobId));
      return sameStringArray(prev, next) ? prev : next;
    });
    setEventJobs((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([jobId]) => jobIds.includes(jobId)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setConnectionStatuses((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([jobId]) => jobIds.includes(jobId)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });

    if (activeJobIds.length === 0) return;

    if (typeof EventSource === 'undefined') {
      setFallbackIds((prev) => Array.from(new Set([...prev, ...activeJobIds])));
      setConnectionStatuses((prev) => {
        const next = { ...prev };
        activeJobIds.forEach((jobId) => {
          next[jobId] = 'polling';
        });
        return next;
      });
      return;
    }

    const sources = new Map<string, EventSource>();
    const errorCounts = new Map<string, number>();

    const setStatus = (jobId: string, status: JobConnectionStatus) => {
      setConnectionStatuses((prev) => ({ ...prev, [jobId]: status }));
    };

    const moveToPolling = (jobId: string) => {
      sources.get(jobId)?.close();
      sources.delete(jobId);
      setStatus(jobId, 'polling');
      setFallbackIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    };

    const handleJob = (job: JobState) => {
      if (!activeJobIdSet.has(job.job_id)) return;

      setEventJobs((prev) => ({ ...prev, [job.job_id]: job }));

      const prevStatus = prevStatuses.current[job.job_id];
      if (prevStatus && prevStatus !== job.status) {
        if (job.status === 'done' && onComplete) onComplete(job);
        if (job.status === 'error' && onError) onError(job);
      }
      if (onProgress) onProgress(job);
      prevStatuses.current[job.job_id] = job.status;

      if (TERMINAL_STATUSES.has(job.status)) {
        sources.get(job.job_id)?.close();
        sources.delete(job.job_id);
      }
    };

    for (const jobId of activeJobIds) {
      const source = new EventSource(`/api/actions/parse/jobs/${encodeURIComponent(jobId)}/events`);
      sources.set(jobId, source);
      setStatus(jobId, 'reconnecting');

      source.onopen = () => {
        errorCounts.set(jobId, 0);
        setStatus(jobId, 'live');
      };
      source.onerror = () => {
        const nextCount = (errorCounts.get(jobId) ?? 0) + 1;
        errorCounts.set(jobId, nextCount);
        if (nextCount >= maxEventSourceErrors) {
          moveToPolling(jobId);
          return;
        }
        setStatus(jobId, 'reconnecting');
      };
      source.addEventListener('heartbeat', () => {
        setStatus(jobId, 'live');
      });
      for (const eventName of JOB_EVENTS) {
        source.addEventListener(eventName, (event) => {
          const job = parseJobEvent(event as MessageEvent<string>);
          if (job) handleJob(job);
        });
      }
    }

    return () => {
      sources.forEach((source) => source.close());
    };
  }, [fallbackIds, interval, jobIds, maxEventSourceErrors, onComplete, onError, onMissing, onProgress]);

  const jobs = useMemo(() => ({ ...eventJobs, ...fallbackJobs }), [eventJobs, fallbackJobs]);
  const connectionStatus = useMemo(() => toConnectionStatus(connectionStatuses), [connectionStatuses]);

  return { jobs, connectionStatus, connectionStatuses };
}
