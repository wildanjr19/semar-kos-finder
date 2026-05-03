'use client';

import { useEffect, useState } from 'react';
import { Badge, PrototypeChrome } from '../chrome';
import { MasterUnsItem, loadMasterUns } from '../shared';
import styles from '../prototype.module.css';

export default function PrototypeMasterUnsPage() {
  const [items, setItems] = useState<MasterUnsItem[]>([]);
  const [selected, setSelected] = useState<MasterUnsItem | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('CRUD Master UNS aktif. Perubahan menulis ke API admin.');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MasterUnsItem | null>(null);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const data = await loadMasterUns();
      setItems(data);
      setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil Master UNS.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const data = await loadMasterUns();
        if (cancelled) return;
        setItems(data);
        setSelected(data[0] || null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal mengambil Master UNS.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => setPage(1), [search, pageSize]);

  const query = search.toLowerCase();
  const filtered = items.filter((item) => !query || [item.name, item.code, item.category, item.coordinate].join(' ').toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const startCreate = () => setEditing({ id: '', name: '', category: 'UNS Location', code: '', coordinate: '0, 0', lat: 0, lon: 0, status: 'Needs Check', linkedKos: 0 });
  const startEdit = (item: MasterUnsItem) => setEditing(item);

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.id || !editing.name || Number.isNaN(editing.lat) || Number.isNaN(editing.lon)) {
      setError('ID, nama, lat, dan lon wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    const body = { id: editing.id.trim(), nama: editing.name.trim(), lat: editing.lat, lon: editing.lon };
    try {
      const exists = items.some((item) => item.id === editing.id);
      const res = await fetch(exists ? `/api/master-uns/${editing.id}` : '/api/master-uns', {
        method: exists ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: { error: 'Save failed' } }));
        throw new Error(data.detail?.error || 'Save failed');
      }
      setEditing(null);
      setNotice(exists ? 'Lokasi berhasil diupdate.' : 'Lokasi baru berhasil dibuat.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm(`Hapus ${selected.name}?`)) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/master-uns/${selected.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      setNotice(`${selected.name} berhasil dihapus.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PrototypeChrome active="master">
      <header className={styles.topbar}><div><p className={styles.eyebrow}>Master UNS</p><h1>Referensi lokasi kampus</h1></div><div className={styles.topbarActions}><label className={styles.searchLabel}><span>Search lokasi</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, koordinat..." /></label><button type="button" className={styles.primaryButton} onClick={startCreate}>Tambah lokasi</button></div></header>
      <section className={styles.actionPanel}><strong>Status</strong><span>{notice}</span></section>
      {loading && <section className={styles.actionPanel}><strong>Loading DB</strong><span>Mengambil Master UNS...</span></section>}
      {error && <section className={`${styles.actionPanel} ${styles.errorPanel}`} role="alert"><strong>DB load failed</strong><span>{error}</span></section>}
      <section className={styles.jobsPanel}>
        <div className={styles.paginationBar}><span>{filtered.length === 0 ? '0 data' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} dari ${filtered.length} lokasi`}</span><label>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={6}>6</option><option value={12}>12</option><option value={24}>24</option></select></label><div className={styles.pageButtons}><button type="button" className={styles.tableAction} disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</button><span>Page {safePage} / {totalPages}</span><button type="button" className={styles.tableAction} disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></div>
        <div className={styles.masterGrid}>{pageItems.length === 0 && <div className={styles.emptyState}>{loading ? 'Memuat Master UNS...' : 'Tidak ada lokasi.'}</div>}{pageItems.map((item) => <button key={item.id} type="button" className={`${styles.masterCard} ${selected?.id === item.id ? styles.selectedCard : ''}`} onClick={() => setSelected(item)}><div className={styles.cardTopline}><Badge>{item.category}</Badge><Badge tone={item.status === 'Valid' ? 'reviewed' : 'parsed'}>{item.status}</Badge></div><h3>{item.name}</h3><dl className={styles.compactDetails}><div><dt>Kode</dt><dd>{item.code}</dd></div><div><dt>Koordinat</dt><dd>{item.coordinate}</dd></div></dl></button>)}</div>
        {selected && <aside className={styles.masterDetail}><strong>{selected.name}</strong><span>{selected.category} - {selected.code} - {selected.coordinate}</span><Badge tone={selected.status === 'Valid' ? 'reviewed' : 'parsed'}>{selected.status}</Badge><div className={styles.cardActions}><button type="button" className={styles.secondaryButton} onClick={() => startEdit(selected)}>Edit</button><button type="button" className={styles.dangerAction} disabled={saving} onClick={deleteSelected}>Delete</button></div></aside>}
      </section>

      {editing && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setEditing(null)}>
          <section className={styles.importModal} role="dialog" aria-modal="true" aria-labelledby="master-editor-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Master UNS CRUD</p><h2 id="master-editor-title">{items.some((item) => item.id === editing.id) ? 'Edit lokasi' : 'Tambah lokasi'}</h2></div><button type="button" className={styles.iconButton} onClick={() => setEditing(null)}>x</button></div>
            <div className={styles.formGrid}>
              <label>ID<input value={editing.id} disabled={items.some((item) => item.id === editing.id)} onChange={(event) => setEditing({ ...editing, id: event.target.value, code: event.target.value })} /></label>
              <label>Nama<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label>Latitude<input type="number" step="any" value={editing.lat} onChange={(event) => setEditing({ ...editing, lat: Number(event.target.value), coordinate: `${Number(event.target.value)}, ${editing.lon}` })} /></label>
              <label>Longitude<input type="number" step="any" value={editing.lon} onChange={(event) => setEditing({ ...editing, lon: Number(event.target.value), coordinate: `${editing.lat}, ${Number(event.target.value)}` })} /></label>
            </div>
            <div className={styles.modalActions}><button type="button" className={styles.ghostButton} onClick={() => setEditing(null)}>Batal</button><button type="button" className={styles.primaryButton} disabled={saving} onClick={saveEditing}>{saving ? 'Saving...' : 'Save'}</button></div>
          </section>
        </div>
      )}
    </PrototypeChrome>
  );
}
