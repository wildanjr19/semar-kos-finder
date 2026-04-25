'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './edit.module.css';

interface Location {
  id: string;
  nama: string;
  lat: number;
  lon: number;
}

export default function MasterUnsEdit() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loc, setLoc] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/master-uns/${id}`);
        if (!res.ok) throw new Error('Location not found');
        const data: Location = await res.json();
        setLoc(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loc) return;
    setError('');
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body = {
      nama: (form.get('nama') as string).trim(),
      lat: parseFloat(form.get('lat') as string),
      lon: parseFloat(form.get('lon') as string),
    };

    if (!body.nama || isNaN(body.lat) || isNaN(body.lon)) {
      setError('Nama, Latitude, and Longitude are required.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/master-uns/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: { error: 'Update failed' } }));
        throw new Error(data.detail?.error || 'Update failed');
      }
      router.push('/master-uns');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;
  if (!loc) return <div className={styles.container}><div className={styles.error}>{error || 'Location not found'}</div></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Edit Location</h1>
        <a href="/master-uns" className={styles.ghostButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="id">ID</label>
          <input type="text" id="id" name="id" readOnly defaultValue={loc.id} style={{ opacity: 0.6 }} />
        </div>

        <div className={styles.field}>
          <label htmlFor="nama">Nama *</label>
          <input type="text" id="nama" name="nama" required defaultValue={loc.nama} />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="lat">Latitude *</label>
            <input type="number" step="any" id="lat" name="lat" required defaultValue={loc.lat} />
          </div>
          <div className={styles.field}>
            <label htmlFor="lon">Longitude *</label>
            <input type="number" step="any" id="lon" name="lon" required defaultValue={loc.lon} />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
