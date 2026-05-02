"use client";

import type { CleanKos, Destination } from "../../../../types/kos";
import {
  formatPrice,
  normalizeTamuLawanJenis,
  getJenisBadgeColor,
} from "../../../../lib/kos-helpers";
import { RouteControls } from "./RouteControls";
import styles from "./Popup.module.css";

type PopupProps = {
  kos: CleanKos;
  destinations: Destination[];
  onShowRoute: (coords: Array<[number, number]>) => void;
  onClearRoute: () => void;
};

export function Popup({ kos, destinations, onShowRoute, onClearRoute }: PopupProps) {
  const colors = getJenisBadgeColor(kos.jenis_kos);

  const acLabel =
    kos.ac_status === "keduanya"
      ? "AC dan non-AC"
      : kos.ac_status === "ac"
        ? "AC"
        : "Non-AC";

  const addressText = kos.plus_code
    ? `${kos.alamat} | Plus Code: ${kos.plus_code}`
    : kos.alamat || "Alamat belum tersedia";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <strong className={styles.title}>{kos.nama}</strong>
          <span
            className={styles.chip}
            style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
          >
            {kos.jenis_kos}
          </span>
        </div>
        <span className={`${styles.chip} ${styles.chipGreen} ${styles.cleanBadge}`}>
          Reviewed clean data
        </span>
      </div>

      <div className={styles.metaRow}>
        <span
          className={`${styles.chip} ${
            kos.ac_status === "ac" || kos.ac_status === "keduanya"
              ? styles.chipBlue
              : styles.chipSlate
          }`}
        >
          {acLabel}
        </span>
        {kos.tipe_pembayaran.map((tp) => (
          <span key={tp} className={`${styles.chip} ${styles.chipAmber}`}>
            {tp}
          </span>
        ))}
      </div>

      <div className={styles.addressBox}>{addressText}</div>

      <section className={styles.section}>
        <div className={styles.label}>Harga clean</div>
        <div className={styles.hargaGrid}>
          {kos.harga.length === 0 ? (
            <span className={`${styles.chip} ${styles.chipSlate}`}>Harga belum tersedia</span>
          ) : (
            kos.harga.map((harga, idx) => (
              <div key={idx} className={styles.hargaCard}>
                {harga.tipe_kamar
                  ? `${harga.tipe_kamar} - ${formatPrice(harga)}`
                  : formatPrice(harga)}
                {harga.catatan && (
                  <div className={styles.hargaNote}>{harga.catatan}</div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.label}>Fasilitas clean</div>
        <div className={styles.chipGroup}>
          {kos.fasilitas.dalam_kamar.length === 0 &&
          kos.fasilitas.bersama.length === 0 &&
          kos.fasilitas.utilitas.length === 0 ? (
            <span className={`${styles.chip} ${styles.chipSlate}`}>
              Fasilitas belum tersedia
            </span>
          ) : (
            <>
              {kos.fasilitas.dalam_kamar.map((f) => (
                <span key={f} className={`${styles.chip} ${styles.chipBlue}`}>
                  {f}
                </span>
              ))}
              {kos.fasilitas.bersama.map((f) => (
                <span key={f} className={`${styles.chip} ${styles.chipGreen}`}>
                  {f}
                </span>
              ))}
              {kos.fasilitas.utilitas.map((f) => (
                <span key={f} className={`${styles.chip} ${styles.chipAmber}`}>
                  {f}
                </span>
              ))}
            </>
          )}
          {kos.fasilitas.catatan && (
            <div className={styles.fasilitasNote}>{kos.fasilitas.catatan}</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.label}>Peraturan clean</div>
        <div className={styles.chipGroup}>
          {kos.peraturan.jam_malam && (
            <span className={`${styles.chip} ${styles.chipAmber}`}>
              Jam malam: {kos.peraturan.jam_malam}
            </span>
          )}
          {normalizeTamuLawanJenis(kos.peraturan.tamu_lawan_jenis).map((rule) => (
            <span key={rule} className={`${styles.chip} ${styles.chipPink}`}>
              Tamu lawan jenis: {rule}
            </span>
          ))}
          {kos.peraturan.tamu_menginap === true && (
            <span className={`${styles.chip} ${styles.chipGreen}`}>
              Tamu menginap diizinkan
            </span>
          )}
          {kos.peraturan.tamu_menginap === false && (
            <span className={`${styles.chip} ${styles.chipPink}`}>
              Tamu menginap dilarang
            </span>
          )}
          {kos.peraturan.boleh_hewan === true && (
            <span className={`${styles.chip} ${styles.chipGreen}`}>
              Hewan diizinkan
            </span>
          )}
          {kos.peraturan.boleh_hewan === false && (
            <span className={`${styles.chip} ${styles.chipPink}`}>
              Hewan dilarang
            </span>
          )}
          {kos.peraturan.lainnya.map((r) => (
            <span key={r} className={`${styles.chip} ${styles.chipSlate}`}>
              {r}
            </span>
          ))}
          {!kos.peraturan.jam_malam &&
            normalizeTamuLawanJenis(kos.peraturan.tamu_lawan_jenis).length === 0 &&
            kos.peraturan.tamu_menginap === null &&
            kos.peraturan.boleh_hewan === null &&
            kos.peraturan.lainnya.length === 0 && (
              <span className={`${styles.chip} ${styles.chipSlate}`}>
                Peraturan belum tersedia
              </span>
            )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.label}>Kontak clean</div>
        <div className={styles.kontakGrid}>
          {kos.kontak.length === 0 ? (
            <span className={`${styles.chip} ${styles.chipSlate}`}>
              Kontak belum tersedia
            </span>
          ) : (
            kos.kontak.map((kontak) => {
              const href = kontak.url_wa || `https://wa.me/${kontak.nomor_wa}`;
              return (
                <a
                  key={kontak.nomor_wa}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.kontakLink}
                >
                  {kontak.nama
                    ? `${kontak.nama} - ${kontak.nomor_wa}`
                    : kontak.nomor_wa}
                </a>
              );
            })
          )}
        </div>
      </section>

      <RouteControls
        kos={kos}
        destinations={destinations}
        onShowRoute={onShowRoute}
        onClearRoute={onClearRoute}
      />
    </div>
  );
}
