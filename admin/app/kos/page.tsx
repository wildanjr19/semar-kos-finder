'use client';

import { useEffect, useState } from 'react';
import styles from './kos.module.css';

interface Kos {
  id: string;
  nama: string;
  jenis_kos: string;
  alamat: string;
  plus_code: string;
  harga: string;
  fasilitas: string;
  peraturan: string;
  narahubung: string;
  narahubung_nama: string;
  lat: number;
  long: number;
}

export default function KosList() {
  const [items, setItems] = useState<Kos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Kos | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchKos = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/kos');
      if (!res.ok) throw new Error('Failed to fetch kos list');
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKos(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kos/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || 'Delete failed');
      }
      setDeleteTarget(null);
      await fetchKos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = items.filter((k) => {
    const q = search.toLowerCase();
    return k.nama.toLowerCase().includes(q)
      || k.jenis_kos.toLowerCase().includes(q)
      || k.alamat.toLowerCase().includes(q)
      || k.narahubung.toLowerCase().includes(q);
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Kos List</h1>
        <div className={styles.actions}>
          <a href="/actions/parse" className={styles.outlineButton}>Parse Action</a>
          <a href="/kos/new" className={styles.button}>Add Kos</a>
          <button
            type="button"
            className={styles.outlineButton}
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
          >
            Logout
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search by nama, jenis, alamat, kontak..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No kos found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Harga</th>
                <th>Kontak</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id}>
                  <td>{k.nama}</td>
                  <td>{k.jenis_kos}</td>
                  <td>{k.harga}</td>
                  <td>{k.narahubung}</td>
                  <td className={styles.actionCell}>
                    <a href={`/kos/${k.id}/edit`} className={styles.editBtn}>Edit</a>
                    <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(k)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Confirm Delete</h2>
            <p>Delete <strong>{deleteTarget.nama}</strong>? This cannot be undone.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.outlineButton} disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className={styles.deleteBtn} disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}