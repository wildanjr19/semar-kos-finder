import styles from "./LoadingState.module.css";

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Memuat clean data..." }: LoadingStateProps) {
  return <div className={styles.banner}>{message}</div>;
}
