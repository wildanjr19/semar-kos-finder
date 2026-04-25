'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './master-uns.module.css';

interface Location {
  id: string;
  nama: string;
  lat: number;
  lon: number;
}

export default function MasterUnsList() {
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/master-uns');
      if (!res.ok) throw new Error('Failed to load');
      const data: Location[] = await res.json();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nama.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filtered.map((i) => i.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDelete = async (loc: Location) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/master-uns/${loc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setItems((prev) => prev.filter((i) => i.id !== loc.id));
      setSelectedIds((prev) => prev.filter((id) => id !== loc.id));
      setDeleteTarget(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteCount(selectedIds.length);
    setDeleting(true);
    try {
      const res = await fetch('/api/master-uns/bulk', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
      setSelectedIds([]);
      setBulkDeleteCount(0);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleImport = async (text: string) => {
    setImporting(true);
    setImportError('');
    setImportResult('');
    try {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON');
      }
      if (!Array.isArray(data)) {
        throw new Error('JSON must be an array of objects');
      }
      const res = await fetch('/api/master-uns/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({ error: 'Import failed' }));
      if (!res.ok) throw new Error(result.error || 'Import failed');
      setImportResult(
        `Inserted: ${result.inserted || 0}, Updated: ${result.updated || 0}, Skipped: ${result.skipped || 0}`
      );
      await fetchItems();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      handleImport(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1>Master UNS</h1>
          <p className={styles.headerMeta}>
            {items.length} location{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.ghostButton}
            onClick={() => setImportOpen(true)}
          >
            Import JSON
          </button>
          <a href="/master-uns/new" className={styles.primaryButton}>
            + Add Location
          </a>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.searchBar}>
        <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.searchClear} onClick={() => setSearch('')} aria-label="Clear">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.bulkCount}>{selectedIds.length} selected</span>
          <button
            className={styles.dangerButton}
            onClick={handleBulkDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading locations...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No locations found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={
                      filtered.length > 0 &&
                      filtered.every((i) => selectedIds.includes(i.id))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th className={styles.actionCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={selectedIds.includes(item.id) ? styles.selectedRow : ''}
                >
                  <td className={styles.checkboxCol}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td>
                    <div className={styles.cellId}>{item.id}</div>
                  </td>
                  <td>
                    <div className={styles.cellName}>{item.nama}</div>
                  </td>
                  <td className={styles.cellCoord}>{item.lat}</td>
                  <td className={styles.cellCoord}>{item.lon}</td>
                  <td className={styles.actionCol}>
                    <a href={`/master-uns/${item.id}/edit`} className={styles.editBtn}>
                      Edit
                    </a>
                    <button
                      className={styles.deleteBtnInline}
                      onClick={() => setDeleteTarget(item)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      <div
        className={`${styles.overlay} ${deleteTarget ? styles.overlayVisible : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteTarget(null);
        }}
      >
        <div className={`${styles.detailModal} ${deleteTarget ? styles.detailModalVisible : ''}`}>
          <div style={{ padding: '1.5rem 2rem' }}>
            <h2 className={styles.modalTitle}>Delete Location</h2>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{deleteTarget?.nama}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.ghostButton} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className={styles.dangerButton}
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import modal */}
      <div
        className={`${styles.overlay} ${importOpen ? styles.overlayVisible : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setImportOpen(false);
        }}
      >
        <div className={`${styles.detailModal} ${importOpen ? styles.detailModalVisible : ''}`}>
          <div style={{ padding: '1.5rem 2rem' }}>
            <h2 className={styles.modalTitle}>Import JSON</h2>
            <p className={styles.modalText}>
              Upload or paste a JSON array of objects with <code>id</code>, <code>nama</code>,{' '}
              <code>lat</code>, <code>lon</code>.
            </p>

            <div
              className={`${styles.importZone} ${dragOver ? styles.importZoneActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,application/json';
                input.onchange = (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (e) => handleImport(String(e.target?.result || ''));
                  reader.readAsText(file);
                };
                input.click();
              }}
            >
              <div>Drop JSON file here or click to browse</div>
              <div className={styles.importHint}>
                [{'{"id":"fmipa","nama":"FMIPA","lat":-7.559,"lon":110.858}'}]
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <textarea
                rows={4}
                placeholder="Or paste JSON here..."
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
                onChange={(e) => {
                  if (e.target.value.trim()) handleImport(e.target.value);
                }}
              />
            </div>

            {importError && (
              <div className={styles.error} style={{ marginTop: '1rem' }}>
                {importError}
              </div>
            )}
            {importResult && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  fontWeight: 500,
                }}
              >
                {importResult}
              </div>
            )}

            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button className={styles.ghostButton} onClick={() => setImportOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
