'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './new.module.css';

const JENIS_OPTIONS = ['Putra', 'Putri', 'Campuran', 'Tidak diketahui'] as const;

export default function KosNew() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body = {
      nama: form.get('nama') as string,
      jenis: form.get('jenis') as string,
      alamat: form.get('alamat') as string,
      harga: form.get('harga') as string,
      fasilitas: form.get('fasilitas') as string,
      peraturan: form.get('peraturan') as string,
      kontak: form.get('kontak') as string,
      lat: parseFloat(form.get('lat') as string),
      lon: parseFloat(form.get('lon') as string),
    };

    if (!body.nama || isNaN(body.lat) || isNaN(body.lon)) {
      setError('Nama, lat, and lon are required.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/kos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Create failed' }));
        throw new Error(data.error || 'Create failed');
      }
      router.push('/kos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Add Kos</h1>
        <a href="/kos" className={styles.outlineButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="nama">Nama *</label>
          <input type="text" id="nama" name="nama" required />
        </div>

        <div className={styles.field}>
          <label htmlFor="jenis">Jenis</label>
          <select id="jenis" name="jenis" defaultValue="Tidak diketahui">
            {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="alamat">Alamat</label>
          <input type="text" id="alamat" name="alamat" />
        </div>

        <div className={styles.field}>
          <label htmlFor="harga">Harga</label>
          <input type="text" id="harga" name="harga" placeholder="e.g. 1.500.000/bulan" />
        </div>

        <div className={styles.field}>
          <label htmlFor="fasilitas">Fasilitas</label>
          <textarea id="fasilitas" name="fasilitas" rows={3} />
        </div>

        <div className={styles.field}>
          <label htmlFor="peraturan">Peraturan</label>
          <textarea id="peraturan" name="peraturan" rows={3} />
        </div>

        <div className={styles.field}>
          <label htmlFor="kontak">Kontak</label>
          <input type="text" id="kontak" name="kontak" placeholder="e.g. https://wa.me/628..." />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="lat">Latitude *</label>
            <input type="number" step="any" id="lat" name="lat" required placeholder="-7.55" />
          </div>
          <div className={styles.field}>
            <label htmlFor="lon">Longitude *</label>
            <input type="number" step="any" id="lon" name="lon" required placeholder="110.85" />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Kos'}
        </button>
      </form>
    </div>
  );
}