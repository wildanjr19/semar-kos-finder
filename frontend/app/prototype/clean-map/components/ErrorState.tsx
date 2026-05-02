import styles from "./ErrorState.module.css";

type ErrorStateProps = {
  message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  return <div className={styles.banner}>{message}</div>;
}
