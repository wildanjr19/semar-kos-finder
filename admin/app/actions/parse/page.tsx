'use client';

import { useState } from 'react';
import styles from './parse.module.css';

export default function ParseAction() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResponse(null);
    setStatus(null);

    try {
      const res = await fetch('/api/actions/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });
      setStatus(res.status);
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Parse Kos Action</h1>
        <a href="/kos" className={styles.outlineButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.layout}>
        <div className={styles.inputSection}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="inputData">Input Data (Raw Text / JSON)</label>
              <textarea
                id="inputData"
                rows={15}
                placeholder="Paste data here... e.g. &quot;ubah harga kos wisma azima jadi 1.5jt&quot;"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Parsing...' : 'Parse Data'}
            </button>
          </form>
        </div>

        <div className={styles.responseSection}>
          <h2>Response Panel</h2>
          {status !== null && (
            <div className={styles.statusBadge} data-status={status >= 200 && status < 300 ? 'ok' : 'error'}>
              HTTP {status}
            </div>
          )}
          <div className={styles.panel}>
            {response ? (
              <pre>{JSON.stringify(response, null, 2)}</pre>
            ) : (
              <pre>Awaiting input...</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}