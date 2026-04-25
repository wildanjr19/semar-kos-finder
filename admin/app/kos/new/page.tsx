'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './new.module.css';

const JENIS_OPTIONS = ['Putra', 'Putri', 'Campuran', 'Tidak diketahui'] as const;
const AC_OPTIONS = ['ac', 'non_ac', 'keduanya'] as const;
const PEMBAYARAN_OPTIONS = ['bulanan', 'semesteran', 'tahunan', 'per3bulan', 'mingguan'] as const;

export default function KosNew() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tipePembayaran, setTipePembayaran] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body = {
      nama: form.get('nama') as string,
      jenis: form.get('jenis_kos') as string,
      alamat: form.get('alamat') as string,
      plus_code: form.get('plus_code') as string,
      harga: form.get('harga') as string,
      fasilitas: form.get('fasilitas') as string,
      peraturan: form.get('peraturan') as string,
      kontak: form.get('narahubung') as string,
      narahubung_nama: form.get('narahubung_nama') as string,
      lat: parseFloat(form.get('lat') as string),
      lon: parseFloat(form.get('long') as string),
      ac_status: form.get('ac_status') as string,
      tipe_pembayaran: tipePembayaran.length > 0 ? tipePembayaran : null,
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
        const data = await res.json().catch(() => ({ detail: { error: 'Create failed' } }));
        throw new Error(data.detail?.error || 'Create failed');
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
        <a href="/kos" className={styles.ghostButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="nama">Nama *</label>
          <input type="text" id="nama" name="nama" required />
        </div>

        <div className={styles.field}>
          <label htmlFor="jenis_kos">Jenis Kos</label>
          <select id="jenis_kos" name="jenis_kos" defaultValue="Tidak diketahui">
            {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="alamat">Alamat</label>
          <input type="text" id="alamat" name="alamat" />
        </div>

        <div className={styles.field}>
          <label htmlFor="plus_code">Plus Code</label>
          <input type="text" id="plus_code" name="plus_code" placeholder="e.g. CVX5+R2" />
        </div>

        <div className={styles.field}>
          <label htmlFor="harga">Harga</label>
          <input type="text" id="harga" name="harga" placeholder="e.g. 1.500.000/bulan" />
        </div>

        <div className={styles.field}>
          <label htmlFor="ac_status">AC Status</label>
          <select id="ac_status" name="ac_status" defaultValue="">
            <option value="">—</option>
            {AC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label>Tipe Pembayaran</label>
          <div className={styles.checkboxGroup}>
            {PEMBAYARAN_OPTIONS.map((o) => (
              <label key={o} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  value={o}
                  checked={tipePembayaran.includes(o)}
                  onChange={(e) => {
                    setTipePembayaran((prev) =>
                      e.target.checked ? [...prev, o] : prev.filter((x) => x !== o)
                    );
                  }}
                />
                {o}
              </label>
            ))}
          </div>
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
          <label htmlFor="narahubung">Narahubung</label>
          <input type="text" id="narahubung" name="narahubung" placeholder="e.g. https://wa.me/628..." />
        </div>

        <div className={styles.field}>
          <label htmlFor="narahubung_nama">Narahubung Nama</label>
          <input type="text" id="narahubung_nama" name="narahubung_nama" placeholder="e.g. Pak Joko" />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="lat">Latitude *</label>
            <input type="number" step="any" id="lat" name="lat" required placeholder="-7.55" />
          </div>
          <div className={styles.field}>
            <label htmlFor="long">Longitude *</label>
            <input type="number" step="any" id="long" name="long" required placeholder="110.85" />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Kos'}
        </button>
      </form>
    </div>
  );
}