'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './new.module.css';

export default function MasterUnsNew() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body = {
      id: (form.get('id') as string).trim(),
      nama: (form.get('nama') as string).trim(),
      lat: parseFloat(form.get('lat') as string),
      lon: parseFloat(form.get('lon') as string),
    };

    if (!body.id || !body.nama || isNaN(body.lat) || isNaN(body.lon)) {
      setError('ID, Nama, Latitude, and Longitude are required.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/master-uns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: { error: 'Create failed' } }));
        throw new Error(data.detail?.error || 'Create failed');
      }
      router.push('/master-uns');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Add Location</h1>
        <a href="/master-uns" className={styles.ghostButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="id">ID *</label>
          <input type="text" id="id" name="id" required placeholder="e.g. fmipa" />
        </div>

        <div className={styles.field}>
          <label htmlFor="nama">Nama *</label>
          <input type="text" id="nama" name="nama" required placeholder="e.g. Fakultas MIPA" />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="lat">Latitude *</label>
            <input type="number" step="any" id="lat" name="lat" required placeholder="-7.559" />
          </div>
          <div className={styles.field}>
            <label htmlFor="lon">Longitude *</label>
            <input type="number" step="any" id="lon" name="lon" required placeholder="110.858" />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Location'}
        </button>
      </form>
    </div>
  );
}
