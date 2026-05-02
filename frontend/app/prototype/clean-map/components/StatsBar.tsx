import type { CleanKos } from "../../../../types/kos";
import { normalizeJenisKos } from "../../../../lib/kos-helpers";
import styles from "./StatsBar.module.css";

type StatsBarProps = {
  items: CleanKos[];
};

export function StatsBar({ items }: StatsBarProps) {
  const counts = items.reduce(
    (acc, item) => {
      const jenis = normalizeJenisKos(item.jenis_kos);
      if (jenis === "Putri") acc.putri += 1;
      else if (jenis === "Putra") acc.putra += 1;
      else if (jenis === "Campuran") acc.campuran += 1;
      return acc;
    },
    { putri: 0, putra: 0, campuran: 0 },
  );

  const total = items.length;

  const stats = [
    { label: "Total", value: total, cardKey: "Neutral", valueKey: "Neutral" },
    { label: "Putri", value: counts.putri, cardKey: "Putri", valueKey: "Putri" },
    { label: "Putra", value: counts.putra, cardKey: "Putra", valueKey: "Putra" },
    { label: "Campur", value: counts.campuran, cardKey: "Campur", valueKey: "Campur" },
  ] as const;

  return (
    <div className={styles.grid}>
      {stats.map(({ label, value, cardKey, valueKey }) => (
        <div
          key={label}
          className={`${styles.card} ${
            cardKey === "Neutral" ? styles.cardNeutral : styles[`card${cardKey}` as keyof typeof styles]
          }`}
        >
          <div
            className={`${styles.value} ${
              valueKey === "Neutral"
                ? styles.valueNeutral
                : styles[`value${valueKey}` as keyof typeof styles]
            }`}
          >
            {value}
          </div>
          <div className={styles.label}>{label}</div>
        </div>
      ))}
    </div>
  );
}
