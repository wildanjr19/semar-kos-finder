'use client';

import { useEffect, useState, useCallback } from 'react';

export interface LlmConfig {
  api_base: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

export function useUserLlmConfig() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/config/llm');
      if (res.status === 404) {
        setConfig(null);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (cfg: LlmConfig) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/config/llm', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(cfg);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save config');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, fetchConfig, saveConfig };
}
