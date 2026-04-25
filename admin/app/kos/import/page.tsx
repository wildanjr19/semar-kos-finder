'use client';

import { useState, useCallback } from 'react';
import styles from './import.module.css';

interface KosItem {
  No: number | string;
  'Nama kos': string;
  'Jenis kos': string;
  Alamat: string;
  Plus_Code?: string;
  Harga: string;
  Fasilitas?: string;
  Peraturan?: string;
  Narahubung: string;
  lat?: number;
  long?: number;
  [key: string]: unknown;
}

interface ExistingKos {
  id: string;
  [key: string]: unknown;
}

interface DuplicateReportItem {
  type: 'internal' | 'database';
  nama: string;
  incoming_idx: number;
  incoming_no: string | number;
  existing_idx?: number;
  existing_no?: string | number;
  existing_nama?: string;
  existing_alamat?: string;
  existing_narahubung?: string;
}

type IdStrategy = 'auto_increment' | 'parse_json';

export default function KosImport() {
  const [jsonText, setJsonText] = useState('');
  const [parsedItems, setParsedItems] = useState<KosItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [idStrategy, setIdStrategy] = useState<IdStrategy>('auto_increment');
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [duplicateReport, setDuplicateReport] = useState<DuplicateReportItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState('');

  const parseJson = useCallback((text: string) => {
    setParseError('');
    setParsedItems([]);
    setSelectedIds(new Set());
    setConflicts([]);
    setDuplicateReport([]);
    setError('');
    setSuccess('');

    if (!text.trim()) return;

    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        setParseError('JSON must be an array.');
        return;
      }
      setParsedItems(data as KosItem[]);
    } catch {
      setParseError('Invalid JSON.');
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      parseJson(text);
    };
    reader.readAsText(file);
  }, [parseJson]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    parseJson(text);
  }, [parseJson]);

  const toggleSelect = useCallback((index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === parsedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedItems.map((_, i) => i)));
    }
  }, [selectedIds.size, parsedItems.length]);

  const checkConflicts = useCallback(async () => {
    if (idStrategy !== 'parse_json') {
      setConflicts([]);
      return;
    }

    try {
      const res = await fetch('/api/kos');
      if (!res.ok) throw new Error('Failed to fetch existing kos');
      const existing: ExistingKos[] = await res.json();
      const existingIds = new Set(existing.map(k => k.id));

      const conflicting = parsedItems
        .filter((_, i) => selectedIds.has(i))
        .filter(item => existingIds.has(String(item.No)))
        .map(item => String(item.No));

      setConflicts(conflicting);
    } catch {
      setConflicts([]);
    }
  }, [idStrategy, parsedItems, selectedIds]);

  const handleSubmit = useCallback(async () => {
    setError('');
    setSuccess('');
    setDuplicateReport([]);

    if (idStrategy === 'parse_json') {
      await checkConflicts();
      try {
        const res = await fetch('/api/kos');
        if (res.ok) {
          const existing: ExistingKos[] = await res.json();
          const existingIds = new Set(existing.map(k => k.id));
          const conflicting = parsedItems
            .filter((_, i) => selectedIds.has(i))
            .filter(item => existingIds.has(String(item.No)))
            .map(item => String(item.No));

          if (conflicting.length > 0) {
            setConflicts(conflicting);
            return;
          }
        }
      } catch {
      }
    }

    const items = parsedItems
      .filter((_, i) => selectedIds.has(i))
      .map(item => ({
        No: item.No,
        'Nama kos': item['Nama kos'],
        'Jenis kos': item['Jenis kos'],
        Alamat: item.Alamat,
        Plus_Code: item.Plus_Code ?? '',
        Harga: item.Harga,
        Fasilitas: item.Fasilitas ?? '',
        Peraturan: item.Peraturan ?? '',
        Narahubung: item.Narahubung,
        lat: item.lat ?? 0,
        long: item.long ?? 0,
      }));

    setSubmitting(true);
    try {
      const res = await fetch('/api/kos/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items, id_strategy: idStrategy }),
      });

      if (res.status === 409) {
        const data = await res.json();
        const conflictIds: string[] = data.detail?.conflicts ?? data.conflicts ?? [];
        setConflicts(conflictIds);
        setError(`Conflicts detected for IDs: ${conflictIds.join(', ')}`);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let msg = 'Bulk import failed';
        if (typeof data.detail === 'string') {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
        } else if (data.detail?.error) {
          msg = data.detail.error;
        } else if (data.error) {
          msg = data.error;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const count = data.created ?? items.length;
      let msg = `Successfully imported ${count} kos.`;
      const totalSkipped = (data.skipped_internal ?? 0) + (data.skipped_db ?? 0);
      if (totalSkipped > 0) {
        msg += ` ${totalSkipped} duplicates skipped.`;
      }
      setSuccess(msg);
      setDuplicateReport(data.duplicate_report ?? []);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [idStrategy, parsedItems, selectedIds, checkConflicts]);

  const allSelected = parsedItems.length > 0 && selectedIds.size === parsedItems.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Bulk Import Kos</h1>
        <a href="/kos" className={styles.outlineButton}>Back to List</a>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      {parseError && <div className={styles.error}>{parseError}</div>}

      <div className={styles.inputSection}>
        <label htmlFor="jsonInput">Paste JSON Array</label>
        <textarea
          id="jsonInput"
          className={styles.textarea}
          value={jsonText}
          onChange={handleTextareaChange}
          placeholder='[{"No": 1, "Nama kos": "...", "Jenis kos": "...", "Alamat": "...", "Harga": "...", "Narahubung": "..."}]'
        />

        <div className={styles.fileInput}>
          <label>Or upload a JSON file:</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {parsedItems.length > 0 && (
        <>
          <div className={styles.controls}>
            <label htmlFor="idStrategy">ID Strategy:</label>
            <select
              id="idStrategy"
              className={styles.select}
              value={idStrategy}
              onChange={(e) => {
                setIdStrategy(e.target.value as IdStrategy);
                setConflicts([]);
              }}
            >
              <option value="auto_increment">Auto Increment</option>
              <option value="parse_json">Parse from JSON</option>
            </select>

            <button
              type="button"
              className={styles.submitBtn}
              disabled={selectedIds.size === 0 || submitting || conflicts.length > 0}
              onClick={handleSubmit}
            >
              {submitting ? 'Importing...' : `Add Selected (${selectedIds.size})`}
            </button>
          </div>

          {conflicts.length > 0 && (
            <div className={styles.warning}>
              <strong>Conflicting IDs detected:</strong>
              <ul className={styles.conflictList}>
                {conflicts.map(id => <li key={id}>ID {id} already exists</li>)}
              </ul>
            </div>
          )}

          {duplicateReport.length > 0 && (
            <div className={styles.tableWrap}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>
                Duplicate Report ({duplicateReport.length} skipped)
              </h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Incoming</th>
                    <th>Existing</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateReport.map((dup, i) => (
                    <tr key={i}>
                      <td>
                        {dup.type === 'internal' ? (
                          <span style={{ color: '#856404', fontWeight: 600 }}>Same file</span>
                        ) : (
                          <span style={{ color: '#c00', fontWeight: 600 }}>In DB</span>
                        )}
                      </td>
                      <td>{dup.nama}</td>
                      <td>
                        Row {dup.incoming_idx} (No {String(dup.incoming_no)})<br />
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                          {parsedItems[dup.incoming_idx - 1]?.Alamat?.substring(0, 40)}...
                        </span>
                      </td>
                      <td>
                        {dup.type === 'internal' ? (
                          <>
                            Row {dup.existing_idx} (No {String(dup.existing_no)})<br />
                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                              {parsedItems[(dup.existing_idx ?? 1) - 1]?.Alamat?.substring(0, 40)}...
                            </span>
                          </>
                        ) : (
                          <>
                            <strong>{dup.existing_nama}</strong><br />
                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                              {dup.existing_alamat?.substring(0, 40)}...
                            </span><br />
                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                              {dup.existing_narahubung}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>No</th>
                  <th>Nama kos</th>
                  <th>Jenis kos</th>
                  <th>Alamat</th>
                  <th>Harga</th>
                  <th>Narahubung</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(i)}
                        onChange={() => toggleSelect(i)}
                      />
                    </td>
                    <td>{String(item.No)}</td>
                    <td>{item['Nama kos']}</td>
                    <td>{item['Jenis kos']}</td>
                    <td>{item.Alamat}</td>
                    <td>{item.Harga}</td>
                    <td>{item.Narahubung}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}