'use client';

import { ReactNode, useEffect, useState } from 'react';
import styles from './prototype.module.css';

function resolveTheme(): 'dark' | 'light' {
  const htmlTheme = document.documentElement.getAttribute('data-semar-ops-theme');
  if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;

  const savedTheme = window.localStorage.getItem('semar-ops-theme') || document.cookie
    .split('; ')
    .find((row) => row.startsWith('semar-ops-theme='))
    ?.split('=')[1];

  return savedTheme === 'dark' ? 'dark' : 'light';
}

export function PrototypeChrome({ children, active }: { children: ReactNode; active: 'ops' | 'kos' | 'master' | 'clean' | 'jobs' }) {
  const [darkMode, setDarkMode] = useState(() => resolveTheme() === 'dark');
  const itemClass = (key: typeof active) => key === active ? styles.navItemActive : styles.navItem;

  useEffect(() => {
    const nextDarkMode = resolveTheme() === 'dark';
    setDarkMode((current) => current === nextDarkMode ? current : nextDarkMode);
  }, []);

  const toggleTheme = () => {
    setDarkMode((current) => {
      const next = !current;
      const theme = next ? 'dark' : 'light';
      window.localStorage.setItem('semar-ops-theme', theme);
      document.cookie = `semar-ops-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.setAttribute('data-semar-ops-theme', theme);
      return next;
    });
  };

  return (
    <main className={styles.shell} data-theme={darkMode ? 'dark' : 'light'}>
      <aside className={styles.sidebar} aria-label="Prototype navigation">
        <a href="/prototype" className={styles.brandButton} aria-label="Open ops console">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span>
            <strong>Semar Ops</strong>
            <small>Admin Console</small>
          </span>
        </a>
        <nav className={styles.navList}>
          <a href="/prototype" className={itemClass('ops')}>Overview</a>
          <a href="/prototype/kos" className={itemClass('kos')}>Kos CRUD</a>
          <a href="/prototype/master-uns" className={itemClass('master')}>Master UNS</a>
          <a href="/prototype/clean-data" className={itemClass('clean')}>Clean Data</a>
          <a href="/prototype/jobs" className={itemClass('jobs')}>Parse Jobs</a>
        </nav>
        <button type="button" className={styles.secondaryButton} onClick={toggleTheme} aria-pressed={darkMode}>
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
        <div className={styles.sidebarNote}>
          <strong>Live DB + API</strong>
          <span>Prototype baca DB dan jalankan mutasi nyata via admin API.</span>
        </div>
      </aside>
      <section className={styles.content}>{children}</section>
    </main>
  );
}

export function Badge({ children, tone = 'raw' }: { children: ReactNode; tone?: 'raw' | 'parsed' | 'reviewed' | 'rejected' | 'blue' | 'rose' | 'amber' }) {
  const toneClass = {
    raw: styles.badgeRaw,
    parsed: styles.badgeParsed,
    reviewed: styles.badgeReviewed,
    rejected: styles.badgeRejected,
    blue: styles.badgeBlue,
    rose: styles.badgeRose,
    amber: styles.badgeAmber,
  }[tone];

  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}
