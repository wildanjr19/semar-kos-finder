import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <div className={styles.banner}>
      Belum ada kos reviewed dengan parsed_data valid. Approve data dari admin dulu.
    </div>
  );
}
