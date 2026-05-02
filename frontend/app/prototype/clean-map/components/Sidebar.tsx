"use client";

import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function Sidebar({ isOpen, onToggle, children }: SidebarProps) {
  return (
    <>
      <aside
        className={`${styles.sidebar} ${!isOpen ? styles.hidden : ""}`}
        aria-label="Filter dan preview data kos"
      >
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.label}>Prototype map</div>
            <h1 className={styles.heading}>Clean kos reviewed</h1>
            <p className={styles.description}>
              Menampilkan hanya data dengan status reviewed dan parsed_data valid.
            </p>
          </div>
          <a href="/" className={styles.mapLink}>
            Map utama
          </a>
        </div>
        {children}
      </aside>
      <button
        type="button"
        className={`${styles.fab} ${isOpen ? styles.fabOpen : styles.fabClosed}`}
        onClick={onToggle}
        aria-label={isOpen ? "Tutup sidebar" : "Buka sidebar"}
      >
        <span className={`${styles.fabIcon} ${isOpen ? styles.fabIconOpen : ""}`}>
          ›
        </span>
      </button>
    </>
  );
}
