"use client";

import type { CleanKos } from "../../../../types/kos";
import { formatPrice } from "../../../../lib/kos-helpers";
import styles from "./PreviewList.module.css";

type PreviewListProps = {
  items: CleanKos[];
  expanded: boolean;
  onToggleExpand: () => void;
  onItemClick: (kos: CleanKos) => void;
};

export function PreviewList({ items, expanded, onToggleExpand, onItemClick }: PreviewListProps) {
  const previewItems = items.slice(0, 5);

  return (
    <div className={styles.container}>
      <div className={styles.sectionLabel}>Preview data</div>
      {!expanded ? (
        <button type="button" className={styles.toggleLink} onClick={onToggleExpand}>
          Lihat {previewItems.length} data
        </button>
      ) : (
        <>
          <div className={styles.cardGrid}>
            {previewItems.map((item) => (
              <button
                key={item.sourceId || item.id}
                type="button"
                className={styles.card}
                onClick={() => onItemClick(item)}
              >
                <strong className={styles.cardName}>{item.nama}</strong>
                <span className={styles.cardMeta}>
                  {item.jenis_kos} |{" "}
                  {item.harga[0] ? formatPrice(item.harga[0]) : "Harga belum tersedia"}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.toggleLink} onClick={onToggleExpand}>
            Tutup
          </button>
        </>
      )}
    </div>
  );
}
