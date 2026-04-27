'use client';

import { useState } from 'react';

// ─── Harga Editor ───

interface HargaItem {
  min: number;
  max: number;
  periode: 'bulanan' | 'semesteran' | 'tahunan' | 'per3bulan' | 'mingguan';
  tipe_kamar: string | null;
  catatan: string | null;
}

export function HargaEditor({ value, onChange }: { value: HargaItem[]; onChange: (v: HargaItem[]) => void }) {
  const add = () => {
    onChange([...value, { min: 0, max: 0, periode: 'bulanan', tipe_kamar: null, catatan: null }]);
  };
  const remove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };
  const update = (idx: number, patch: Partial<HargaItem>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {value.map((h, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', background: 'var(--surface-raised)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Min (Rp)
              <input type="number" value={h.min} onChange={(e) => update(i, { min: Number(e.target.value) })} style={{ width: '100%', marginTop: '2px' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Max (Rp)
              <input type="number" value={h.max} onChange={(e) => update(i, { max: Number(e.target.value) })} style={{ width: '100%', marginTop: '2px' }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Periode
              <select value={h.periode} onChange={(e) => update(i, { periode: e.target.value as HargaItem['periode'] })} style={{ width: '100%', marginTop: '2px' }}>
                <option value="bulanan">bulanan</option>
                <option value="semesteran">semesteran</option>
                <option value="tahunan">tahunan</option>
                <option value="per3bulan">per3bulan</option>
                <option value="mingguan">mingguan</option>
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Tipe Kamar
              <input type="text" value={h.tipe_kamar ?? ''} onChange={(e) => update(i, { tipe_kamar: e.target.value || null })} style={{ width: '100%', marginTop: '2px' }} />
            </label>
          </div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Catatan
            <input type="text" value={h.catatan ?? ''} onChange={(e) => update(i, { catatan: e.target.value || null })} style={{ width: '100%', marginTop: '2px' }} />
          </label>
          <button type="button" onClick={() => remove(i)} style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', fontSize: '0.75rem', padding: '4px 8px' }}>Hapus</button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>+ Tambah Harga</button>
    </div>
  );
}

// ─── Fasilitas Editor ───

interface FasilitasValue {
  dalam_kamar: string[];
  bersama: string[];
  utilitas: string[];
  catatan: string;
}

function ChipInput({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  };
  const remove = (v: string) => onChange(items.filter((x) => x !== v));

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
        {items.map((item) => (
          <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'var(--success-bg)', color: 'var(--success)', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
            {item}
            <button type="button" onClick={() => remove(item)} style={{ background: 'none', color: 'inherit', padding: 0, fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Tambah..." style={{ flex: 1, fontSize: '0.8rem', padding: '4px 8px' }} />
        <button type="button" onClick={add} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>+</button>
      </div>
    </div>
  );
}

export function FasilitasEditor({ value, onChange }: { value: FasilitasValue; onChange: (v: FasilitasValue) => void }) {
  return (
    <div>
      <ChipInput label="Dalam Kamar" items={value.dalam_kamar} onChange={(v) => onChange({ ...value, dalam_kamar: v })} />
      <ChipInput label="Bersama" items={value.bersama} onChange={(v) => onChange({ ...value, bersama: v })} />
      <ChipInput label="Utilitas" items={value.utilitas} onChange={(v) => onChange({ ...value, utilitas: v })} />
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
        Catatan
        <textarea value={value.catatan} onChange={(e) => onChange({ ...value, catatan: e.target.value })} rows={2} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }} />
      </label>
    </div>
  );
}

// ─── Peraturan Editor ───

interface PeraturanValue {
  jam_malam: string | null;
  tamu_lawan_jenis: 'dilarang' | 'terbatas' | 'bebas' | null;
  tamu_menginap: boolean | null;
  boleh_hewan: boolean | null;
  lainnya: string[];
}

export function PeraturanEditor({ value, onChange }: { value: PeraturanValue; onChange: (v: PeraturanValue) => void }) {
  const [ruleInput, setRuleInput] = useState('');
  const addRule = () => {
    const v = ruleInput.trim();
    if (v && !value.lainnya.includes(v)) onChange({ ...value, lainnya: [...value.lainnya, v] });
    setRuleInput('');
  };
  const removeRule = (v: string) => onChange({ ...value, lainnya: value.lainnya.filter((x) => x !== v) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
        Jam Malam
        <input type="text" value={value.jam_malam ?? ''} onChange={(e) => onChange({ ...value, jam_malam: e.target.value || null })} placeholder="e.g. 22:00 atau 'tidak ada'" style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }} />
      </label>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
        Tamu Lawan Jenis
        <select value={value.tamu_lawan_jenis ?? ''} onChange={(e) => onChange({ ...value, tamu_lawan_jenis: (e.target.value || null) as PeraturanValue['tamu_lawan_jenis'] })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }}>
          <option value="">Tidak diketahui</option>
          <option value="dilarang">Dilarang</option>
          <option value="terbatas">Terbatas</option>
          <option value="bebas">Bebas</option>
        </select>
      </label>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
        Tamu Menginap
        <select value={value.tamu_menginap === null ? '' : String(value.tamu_menginap)} onChange={(e) => onChange({ ...value, tamu_menginap: e.target.value === '' ? null : e.target.value === 'true' })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }}>
          <option value="">Tidak diketahui</option>
          <option value="true">Diizinkan</option>
          <option value="false">Dilarang</option>
        </select>
      </label>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
        Boleh Hewan
        <select value={value.boleh_hewan === null ? '' : String(value.boleh_hewan)} onChange={(e) => onChange({ ...value, boleh_hewan: e.target.value === '' ? null : e.target.value === 'true' })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }}>
          <option value="">Tidak diketahui</option>
          <option value="true">Diizinkan</option>
          <option value="false">Dilarang</option>
        </select>
      </label>
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Lainnya</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
          {value.lainnya.map((r) => (
            <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.75rem', border: '1px solid var(--danger-border)' }}>
              {r}
              <button type="button" onClick={() => removeRule(r)} style={{ background: 'none', color: 'inherit', padding: 0, fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input type="text" value={ruleInput} onChange={(e) => setRuleInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }} placeholder="Tambah aturan..." style={{ flex: 1, fontSize: '0.8rem', padding: '4px 8px' }} />
          <button type="button" onClick={addRule} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ─── Kontak Editor ───

interface KontakItem {
  nama: string;
  nomor_wa: string;
  url_wa: string;
}

export function KontakEditor({ value, onChange }: { value: KontakItem[]; onChange: (v: KontakItem[]) => void }) {
  const add = () => {
    onChange([...value, { nama: '', nomor_wa: '', url_wa: '' }]);
  };
  const remove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };
  const update = (idx: number, patch: Partial<KontakItem>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    // auto-update url_wa if nomor_wa changes
    if ('nomor_wa' in patch && patch.nomor_wa) {
      next[idx].url_wa = `https://wa.me/${patch.nomor_wa}`;
    }
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {value.map((k, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', background: 'var(--surface-raised)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Nama
              <input type="text" value={k.nama} onChange={(e) => update(i, { nama: e.target.value })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Nomor WA
              <input type="text" value={k.nomor_wa} onChange={(e) => update(i, { nomor_wa: e.target.value })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }} />
            </label>
          </div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            URL WA
            <input type="text" value={k.url_wa} onChange={(e) => update(i, { url_wa: e.target.value })} style={{ width: '100%', marginTop: '2px', fontSize: '0.8rem' }} />
          </label>
          <button type="button" onClick={() => remove(i)} style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', fontSize: '0.75rem', padding: '4px 8px' }}>Hapus</button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>+ Tambah Kontak</button>
    </div>
  );
}
