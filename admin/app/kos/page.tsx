'use client';

import { useEffect, useState, useCallback } from 'react';
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
  ac_status: string;
  tipe_pembayaran: string[] | null;
}

const JENIS_STYLES: Record<string, string> = {
  Putra: styles.badgeBlue,
  Putri: styles.badgeRose,
  Campuran: styles.badgeAmber,
  'Tidak diketahui': styles.badgeMuted,
};

const AC_STYLES: Record<string, string> = {
  ac: styles.badgeGreen,
  non_ac: styles.badgeMuted,
  keduanya: styles.badgeAmber,
};

const AC_LABELS: Record<string, string> = {
  ac: 'AC',
  non_ac: 'Non-AC',
  keduanya: 'Keduanya',
};

export default function KosList() {
  const [items, setItems] = useState<Kos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Kos | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Kos | null>(null);
  const [detailAnimating, setDetailAnimating] = useState(false);

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

  const openDetail = useCallback((kos: Kos) => {
    setDetailTarget(kos);
    requestAnimationFrame(() => setDetailAnimating(true));
  }, []);

  const closeDetail = useCallback(() => {
    setDetailAnimating(false);
    setTimeout(() => setDetailTarget(null), 280);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailTarget) closeDetail();
        if (deleteTarget) setDeleteTarget(null);
        if (bulkDeleteCount > 0) setBulkDeleteCount(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailTarget, deleteTarget, bulkDeleteCount, closeDetail]);

  const filtered = items.filter((k) => {
    const q = search.toLowerCase();
    return k.nama.toLowerCase().includes(q)
      || k.jenis_kos.toLowerCase().includes(q)
      || k.alamat.toLowerCase().includes(q)
      || k.narahubung.toLowerCase().includes(q)
      || k.fasilitas.toLowerCase().includes(q);
  });

  const filteredIds = filtered.map((k) => k.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kos/${targetId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({ detail: { error: 'Delete failed' } }));
        throw new Error(data.detail?.error || 'Delete failed');
      }
      setDeleteTarget(null);
      setSelectedIds((prev) => prev.filter((id) => id !== targetId));
      await fetchKos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/kos/bulk', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: { error: 'Delete failed' } }));
        throw new Error(data.detail?.error || 'Delete failed');
      }
      setBulkDeleteCount(0);
      setSelectedIds([]);
      await fetchKos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Daftar Kos</h1>
          <p className={styles.headerMeta}>{items.length} kos tercatat</p>
        </div>
        <div className={styles.actions}>
          <a href="/actions/parse" className={styles.ghostButton}>Parse Action</a>
          <a href="/kos/import" className={styles.ghostButton}>Bulk Import</a>
          <a href="/kos/new" className={styles.primaryButton}>Tambah Kos</a>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
          >
            Logout
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.searchBar}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Cari nama, jenis, alamat, kontak, fasilitas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        {search && (
          <button type="button" className={styles.searchClear} onClick={() => setSearch('')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.bulkCount}>{selectedIds.length} dipilih</span>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setBulkDeleteCount(selectedIds.length)}
          >
            Hapus
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Memuat daftar kos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ opacity: 0.4, marginBottom: '1rem' }}>
            <path d="M9 10h.01" strokeLinecap="round" /><path d="M15 10h.01" strokeLinecap="round" />
            <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
          </svg>
          <p>Tidak ada kos ditemukan.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className={styles.checkbox}
                  />
                </th>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Harga</th>
                <th>AC</th>
                <th>Pembayaran</th>
                <th>Kontak</th>
                <th className={styles.actionCol}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr
                  key={k.id}
                  className={selectedIds.includes(k.id) ? styles.selectedRow : ''}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT' &&
                        !(e.target as HTMLElement).closest('a') &&
                        !(e.target as HTMLElement).closest('button')) {
                      openDetail(k);
                    }
                  }}
                >
                  <td className={styles.checkboxCol} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(k.id)}
                      onChange={() => toggleSelectOne(k.id)}
                      className={styles.checkbox}
                    />
                  </td>
                  <td>
                    <div className={styles.cellName}>{k.nama}</div>
                    <div className={styles.cellAddress}>{k.alamat.slice(0, 60)}{k.alamat.length > 60 ? '...' : ''}</div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${JENIS_STYLES[k.jenis_kos] || styles.badgeMuted}`}>
                      {k.jenis_kos}
                    </span>
                  </td>
                  <td className={styles.cellPrice}>{k.harga || '-'}</td>
                  <td>
                    <span className={`${styles.badge} ${AC_STYLES[k.ac_status] || styles.badgeMuted}`}>
                      {AC_LABELS[k.ac_status] || k.ac_status || '-'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.cellPills}>
                      {k.tipe_pembayaran ? k.tipe_pembayaran.map((t) => (
                        <span key={t} className={`${styles.badge} ${styles.badgeSmall} ${styles.badgeMuted}`}>{t}</span>
                      )) : <span className={styles.textMuted}>-</span>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.cellContact}>{k.narahubung || '-'}</div>
                    {k.narahubung_nama && <div className={styles.cellContactName}>{k.narahubung_nama}</div>}
                  </td>
                  <td className={styles.actionCol} onClick={(e) => e.stopPropagation()}>
                    <a href={`/kos/${k.id}/edit`} className={styles.editBtn}>Edit</a>
                    <button type="button" className={styles.deleteBtnInline} onClick={() => setDeleteTarget(k)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailTarget && (
        <div
          className={`${styles.overlay} ${detailAnimating ? styles.overlayVisible : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div className={`${styles.detailModal} ${detailAnimating ? styles.detailModalVisible : ''}`}>
            <button type="button" className={styles.detailClose} onClick={closeDetail} aria-label="Tutup">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>

            <div className={styles.detailHeader}>
              <div className={styles.detailBadges}>
                <span className={`${styles.badge} ${JENIS_STYLES[detailTarget.jenis_kos] || styles.badgeMuted}`}>
                  {detailTarget.jenis_kos}
                </span>
                {detailTarget.ac_status && (
                  <span className={`${styles.badge} ${AC_STYLES[detailTarget.ac_status] || styles.badgeMuted}`}>
                    {AC_LABELS[detailTarget.ac_status] || detailTarget.ac_status}
                  </span>
                )}
              </div>
              <h2 className={styles.detailTitle}>{detailTarget.nama}</h2>
              {detailTarget.harga && (
                <p className={styles.detailPrice}>{detailTarget.harga}</p>
              )}
            </div>

            <div className={styles.detailBody}>
              <div className={styles.detailSection}>
                <h3 className={styles.detailSectionTitle}>Alamat</h3>
                <p className={styles.detailText}>{detailTarget.alamat || '-'}</p>
                {detailTarget.plus_code && (
                  <p className={styles.detailSubtext}>Plus Code: {detailTarget.plus_code}</p>
                )}
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Fasilitas</h3>
                  <p className={styles.detailText}>{detailTarget.fasilitas || '-'}</p>
                </div>
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Peraturan</h3>
                  <p className={styles.detailText}>{detailTarget.peraturan || '-'}</p>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Narahubung</h3>
                  <p className={styles.detailText}>{detailTarget.narahubung || '-'}</p>
                  {detailTarget.narahubung_nama && (
                    <p className={styles.detailSubtext}>Atas nama: {detailTarget.narahubung_nama}</p>
                  )}
                </div>
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Koordinat</h3>
                  <p className={styles.detailText}>
                    Lat: {detailTarget.lat}, Lon: {detailTarget.long}
                  </p>
                </div>
              </div>

              {detailTarget.tipe_pembayaran && detailTarget.tipe_pembayaran.length > 0 && (
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Tipe Pembayaran</h3>
                  <div className={styles.detailPills}>
                    {detailTarget.tipe_pembayaran.map((t) => (
                      <span key={t} className={`${styles.badge} ${styles.badgeMuted}`}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.detailFooter}>
              <a href={`/kos/${detailTarget.id}/edit`} className={styles.primaryButton}>Edit Kos</a>
              <button type="button" className={styles.ghostButton} onClick={closeDetail}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={`${styles.overlay} ${styles.overlayVisible}`} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={`${styles.detailModal} ${styles.detailModalVisible}`} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Konfirmasi Hapus</h2>
            <p className={styles.modalText}>Hapus <strong>{deleteTarget.nama}</strong>? Aksi ini tidak dapat dibatalkan.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} disabled={deleting} onClick={() => setDeleteTarget(null)}>Batal</button>
              <button type="button" className={styles.dangerButton} disabled={deleting} onClick={handleSingleDelete}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteCount > 0 && (
        <div className={`${styles.overlay} ${styles.overlayVisible}`} onClick={() => !deleting && setBulkDeleteCount(0)}>
          <div className={`${styles.detailModal} ${styles.detailModalVisible}`} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Konfirmasi Hapus Massal</h2>
            <p className={styles.modalText}>Hapus <strong>{bulkDeleteCount}</strong> item yang dipilih? Aksi ini tidak dapat dibatalkan.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} disabled={deleting} onClick={() => setBulkDeleteCount(0)}>Batal</button>
              <button type="button" className={styles.dangerButton} disabled={deleting} onClick={handleBulkDelete}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
