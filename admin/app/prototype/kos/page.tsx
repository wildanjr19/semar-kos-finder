'use client';

import { useEffect, useState } from 'react';
import { Badge, PrototypeChrome } from '../chrome';
import { KosItem, KosStatus, loadKos } from '../shared';
import styles from '../prototype.module.css';

export default function PrototypeKosPage() {
  const [items, setItems] = useState<KosItem[]>([]);
  const [selected, setSelected] = useState<KosItem | null>(null);
  const [editing, setEditing] = useState<KosItem | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<KosStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('CRUD prototype aktif. Perubahan menulis ke API admin.');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const data = await loadKos();
      setItems(data);
      setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data kos.');
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
        const data = await loadKos();
        if (cancelled) return;
        setItems(data);
        setSelected(data[0] || null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal mengambil data kos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => setPage(1), [search, status, pageSize]);

  const query = search.toLowerCase();
  const filtered = items
    .filter((item) => status === 'All' || item.status === status)
    .filter((item) => !query || [item.name, item.address, item.contact, item.price, item.issue, ...item.facilities].join(' ').toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const startCreate = () => setEditing({ id: '', name: '', type: 'Putri', status: 'Raw', price: '', address: '', contact: '', facilities: [], lat: 0, lon: 0, issue: '', score: 50 });
  const startEdit = (item: KosItem) => setEditing(item);

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.name || !editing.lat || !editing.lon) {
      setError('Nama, lat, dan lon wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      nama: editing.name,
      jenis: editing.type,
      alamat: editing.address,
      plus_code: '',
      harga: editing.price,
      fasilitas: editing.facilities.join(', '),
      peraturan: '',
      kontak: editing.contact,
      narahubung_nama: '',
      lat: editing.lat,
      lon: editing.lon,
      ac_status: '',
      tipe_pembayaran: null,
    };
    try {
      const res = await fetch(editing.id ? `/api/kos/${editing.id}` : '/api/kos', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: { error: 'Save failed' } }));
        throw new Error(data.detail?.error || 'Save failed');
      }
      setEditing(null);
      setNotice(editing.id ? 'Kos berhasil diupdate.' : 'Kos baru berhasil dibuat.');
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
      const res = await fetch(`/api/kos/${selected.id}`, { method: 'DELETE' });
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
    <PrototypeChrome active="kos">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Kos CRUD</p>
          <h1>Kelola data kos</h1>
        </div>
        <div className={styles.topbarActions}>
          <label className={styles.searchLabel}>
            <span>Search kos</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Cari nama, alamat, kontak..." />
          </label>
          <button type="button" className={styles.primaryButton} onClick={startCreate}>Tambah kos</button>
        </div>
      </header>

      <section className={styles.actionPanel}><strong>Status</strong><span>{notice}</span></section>
      {loading && <section className={styles.actionPanel}><strong>Loading DB</strong><span>Mengambil data kos...</span></section>}
      {error && <section className={`${styles.actionPanel} ${styles.errorPanel}`} role="alert"><strong>DB load failed</strong><span>{error}</span></section>}

      <section className={styles.sectionGrid}>
        <div className={styles.panelWide}>
          <div className={styles.subHeaderRow}>
            <div className={styles.filterChips} aria-label="Filter by status">
              {(['All', 'Raw', 'Parsed', 'Reviewed', 'Rejected'] as const).map((value) => (
                <button key={value} type="button" className={status === value ? styles.filterChipActive : styles.filterChip} onClick={() => setStatus(value)}>{value}</button>
              ))}
            </div>
          </div>

          <div className={styles.paginationBar}>
            <span>{filtered.length === 0 ? '0 data' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} dari ${filtered.length} kos`}</span>
            <label>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
            <div className={styles.pageButtons}>
              <button type="button" className={styles.tableAction} disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</button>
              <span>Page {safePage} / {totalPages}</span>
              <button type="button" className={styles.tableAction} disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          </div>

          <div className={styles.desktopTableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Kos</th><th>Status</th><th>Harga</th><th>Quality</th><th>Issue</th><th>Aksi</th></tr></thead>
              <tbody>
                {pageItems.length === 0 && <tr><td colSpan={6} className={styles.emptyTableCell}>{loading ? 'Memuat data kos...' : 'Tidak ada data kos.'}</td></tr>}
                {pageItems.map((item) => (
                  <tr key={item.id} className={selected?.id === item.id ? styles.selectedRow : ''}>
                    <td><button type="button" className={styles.rowButton} onClick={() => setSelected(item)}><strong>{item.name}</strong><span>{item.address}</span></button></td>
                    <td><Badge tone={item.status === 'Reviewed' ? 'reviewed' : item.status === 'Parsed' ? 'parsed' : item.status === 'Rejected' ? 'rejected' : 'raw'}>{item.status}</Badge></td>
                    <td className={styles.priceCell}>{item.price}</td>
                    <td><div className={styles.scoreWrap}><span style={{ width: `${item.score}%` }} /></div></td>
                    <td>{item.issue}</td>
                    <td><div className={styles.cardActions}><button type="button" className={styles.tableAction} onClick={() => setSelected(item)}>Detail</button><button type="button" className={styles.inlineLink} onClick={() => startEdit(item)}>Edit</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.drawer} aria-label="Kos detail">
          {selected ? <><div className={styles.drawerHeader}><Badge>{selected.type}</Badge><h2>{selected.name}</h2><p>{selected.address}</p></div><dl className={styles.detailList}><div><dt>Harga</dt><dd>{selected.price}</dd></div><div><dt>Kontak</dt><dd>{selected.contact}</dd></div><div><dt>Koordinat</dt><dd>{selected.lat}, {selected.lon}</dd></div><div><dt>Issue</dt><dd>{selected.issue}</dd></div></dl><div className={styles.facilityList}>{selected.facilities.map((facility) => <span key={facility}>{facility}</span>)}</div><div className={styles.drawerActions}><button type="button" className={styles.secondaryButton} onClick={() => startEdit(selected)}>Edit</button><button type="button" className={styles.dangerAction} disabled={saving} onClick={deleteSelected}>Delete</button></div></> : <div className={styles.emptyState}>Pilih kos.</div>}
        </aside>
      </section>

      {editing && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setEditing(null)}>
          <section className={styles.importModal} role="dialog" aria-modal="true" aria-labelledby="kos-editor-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Kos CRUD</p><h2 id="kos-editor-title">{editing.id ? 'Edit kos' : 'Tambah kos'}</h2></div><button type="button" className={styles.iconButton} onClick={() => setEditing(null)}>x</button></div>
            <div className={styles.formGrid}>
              <label>Nama<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label>Jenis<select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as KosItem['type'] })}><option value="Putri">Putri</option><option value="Putra">Putra</option><option value="Campuran">Campuran</option></select></label>
              <label>Harga<input value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /></label>
              <label>Kontak<input value={editing.contact} onChange={(event) => setEditing({ ...editing, contact: event.target.value })} /></label>
              <label className={styles.fullField}>Alamat<textarea rows={3} value={editing.address} onChange={(event) => setEditing({ ...editing, address: event.target.value })} /></label>
              <label>Latitude<input type="number" step="any" value={editing.lat} onChange={(event) => setEditing({ ...editing, lat: Number(event.target.value) })} /></label>
              <label>Longitude<input type="number" step="any" value={editing.lon} onChange={(event) => setEditing({ ...editing, lon: Number(event.target.value) })} /></label>
              <label className={styles.fullField}>Fasilitas<textarea rows={3} value={editing.facilities.join(', ')} onChange={(event) => setEditing({ ...editing, facilities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            </div>
            <div className={styles.modalActions}><button type="button" className={styles.ghostButton} onClick={() => setEditing(null)}>Batal</button><button type="button" className={styles.primaryButton} disabled={saving} onClick={saveEditing}>{saving ? 'Saving...' : 'Save'}</button></div>
          </section>
        </div>
      )}
    </PrototypeChrome>
  );
}
