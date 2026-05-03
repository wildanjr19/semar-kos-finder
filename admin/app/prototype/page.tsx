'use client';

import { useEffect, useState } from 'react';
import { Badge, PrototypeChrome } from './chrome';
import { KosItem, MasterUnsItem, loadKos, loadMasterUns } from './shared';
import styles from './prototype.module.css';

export default function PrototypeOpsPage() {
  const [kos, setKos] = useState<KosItem[]>([]);
  const [masters, setMasters] = useState<MasterUnsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const [nextKos, nextMasters] = await Promise.all([loadKos(), loadMasterUns()]);
        if (cancelled) return;
        setKos(nextKos);
        setMasters(nextMasters);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal mengambil data DB.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const needsReview = kos.filter((item) => item.status === 'Parsed' || item.status === 'Rejected');
  const metrics = [
    { label: 'Total kos', value: kos.length, tone: 'info' },
    { label: 'Butuh review', value: needsReview.length, tone: 'warning' },
    { label: 'Siap publish', value: kos.filter((item) => item.status === 'Reviewed').length, tone: 'success' },
    { label: 'Master UNS', value: masters.length, tone: 'muted' },
  ];

  return (
    <PrototypeChrome active="ops">
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Ops Console</p>
          <h1>Admin command center</h1>
        </div>
        <div className={styles.topbarActions}>
          <a href="/prototype/kos" className={styles.secondaryLinkButton}>Open Kos CRUD</a>
          <a href="/prototype/clean-data" className={styles.primaryLinkButton}>Review Data</a>
        </div>
      </header>

      <section className={styles.actionPanel}>
        <strong>Live prototype</strong>
        <span>Overview baca DB. Halaman detail jalan penuh ke backend admin untuk CRUD dan parse workflow.</span>
      </section>
      {loading && <section className={styles.actionPanel}><strong>Loading DB</strong><span>Mengambil Kos dan Master UNS...</span></section>}
      {error && <section className={`${styles.actionPanel} ${styles.errorPanel}`} role="alert"><strong>DB load failed</strong><span>{error}</span></section>}

      <section className={styles.heroGrid}>
        <div className={styles.heroCard}>
          <p className={styles.eyebrow}>Today focus</p>
          <h2>{needsReview.length} data butuh review sebelum publish.</h2>
          <p>Gunakan Overview untuk triage cepat. Buka halaman khusus untuk CRUD Kos, Master UNS, Clean Data, dan Jobs.</p>
          <div className={styles.heroActions}>
            <a href="/prototype/clean-data" className={styles.primaryLinkButton}>Open review queue</a>
            <a href="/prototype/jobs" className={styles.ghostButton}>View jobs</a>
          </div>
        </div>
        <div className={styles.metricsGrid}>{metrics.map((item) => <article key={item.label} className={styles.metricCard}><span className={`${styles.metricDot} ${styles[`tone${item.tone}` as keyof typeof styles]}`} /><strong>{item.value}</strong><span>{item.label}</span></article>)}</div>
      </section>

      <section className={styles.sectionGrid}>
        <div className={styles.panelWide}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Review queue</p><h2>Kos perlu tindakan</h2></div><a href="/prototype/kos" className={styles.secondaryLinkButton}>See all</a></div>
          <div className={styles.desktopTableWrap}><table className={styles.table}><thead><tr><th>Kos</th><th>Status</th><th>Issue</th></tr></thead><tbody>{needsReview.slice(0, 8).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><br /><span>{item.address}</span></td><td><Badge tone={item.status === 'Rejected' ? 'rejected' : 'parsed'}>{item.status}</Badge></td><td>{item.issue}</td></tr>)}{needsReview.length === 0 && <tr><td colSpan={3} className={styles.emptyTableCell}>{loading ? 'Memuat queue...' : 'Tidak ada queue review.'}</td></tr>}</tbody></table></div>
        </div>
        <aside className={styles.drawer}><div className={styles.drawerHeader}><p className={styles.eyebrow}>Navigation model</p><h2>Multipage structure</h2><p>Ops page untuk triage. CRUD dan review berat pindah ke halaman khusus agar URL, pagination, dan state lebih jelas.</p></div><div className={styles.detailList}><a href="/prototype/kos" className={styles.secondaryLinkButton}>Kos CRUD</a><a href="/prototype/master-uns" className={styles.secondaryLinkButton}>Master UNS</a><a href="/prototype/clean-data" className={styles.secondaryLinkButton}>Clean Data</a><a href="/prototype/jobs" className={styles.secondaryLinkButton}>Jobs</a></div></aside>
      </section>
    </PrototypeChrome>
  );
}
