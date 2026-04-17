'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './edit.module.css';

const JENIS_OPTIONS = ['Putra', 'Putri', 'Campuran', 'Tidak diketahui'] as const;

interface Kos {
  id: string;
  nama: string;
  jenis: string;
  alamat: string;
  harga: string;
  fasilitas: string;
  peraturan: string;
  kontak: string;
  lat: number;
  lon: number;
}

export default function KosEdit() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [kos, setKos] = useState<Kos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/kos/${id}`);
        if (!res.ok) throw new Error('Kos not found');
        setKos(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kos) return;
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
      const res = await fetch(`/api/kos/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(data.error || 'Update failed');
      }
      router.push('/kos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;
  if (!kos) return <div className={styles.container}><div className={styles.error}>{error || 'Kos not found'}</div></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Edit Kos</h1>
        <a href="/kos" className={styles.outlineButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="nama">Nama *</label>
          <input type="text" id="nama" name="nama" required defaultValue={kos.nama} />
        </div>

        <div className={styles.field}>
          <label htmlFor="jenis">Jenis</label>
          <select id="jenis" name="jenis" defaultValue={kos.jenis}>
            {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="alamat">Alamat</label>
          <input type="text" id="alamat" name="alamat" defaultValue={kos.alamat} />
        </div>

        <div className={styles.field}>
          <label htmlFor="harga">Harga</label>
          <input type="text" id="harga" name="harga" defaultValue={kos.harga} />
        </div>

        <div className={styles.field}>
          <label htmlFor="fasilitas">Fasilitas</label>
          <textarea id="fasilitas" name="fasilitas" rows={3} defaultValue={kos.fasilitas} />
        </div>

        <div className={styles.field}>
          <label htmlFor="peraturan">Peraturan</label>
          <textarea id="peraturan" name="peraturan" rows={3} defaultValue={kos.peraturan} />
        </div>

        <div className={styles.field}>
          <label htmlFor="kontak">Kontak</label>
          <input type="text" id="kontak" name="kontak" defaultValue={kos.kontak} />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="lat">Latitude *</label>
            <input type="number" step="any" id="lat" name="lat" required defaultValue={kos.lat} />
          </div>
          <div className={styles.field}>
            <label htmlFor="lon">Longitude *</label>
            <input type="number" step="any" id="lon" name="lon" required defaultValue={kos.lon} />
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}