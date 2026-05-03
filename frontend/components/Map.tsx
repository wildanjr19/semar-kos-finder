"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  Destination, RawDestination, RouteApiResponse,
  Kos, RawKos, KosClean
} from "../types/kos";
import {
  isCleanData, toNumber, decodeEncodedPolyline,
  formatDistanceMeters, formatDuration,
  normalizeJenisKos, normalizeTamuLawanJenis,
  getJenisBadgeColor, getMarkerGradient,
  getMarkerTextColor, getMarkerLetter,
  parseContact
} from "../lib/kos-helpers";
import styles from "./Map.module.css";

function createSectionLabel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.letterSpacing = "0.08em";
  el.style.textTransform = "uppercase";
  el.style.color = "#8a9a80";
  el.style.marginBottom = "6px";
  return el;
}

function createChip(text: string, styles?: Partial<CSSStyleDeclaration>): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.textContent = text.trim();
  chip.style.display = "inline-block";
  chip.style.padding = "3px 10px";
  chip.style.borderRadius = "999px";
  chip.style.fontSize = "11px";
  chip.style.fontWeight = "600";
  chip.style.lineHeight = "1.4";
  chip.style.backgroundColor = "#f0f4eb";
  chip.style.color = "#4a5a45";
  chip.style.border = "1px solid #d8e0d0";
  if (styles) {
    Object.assign(chip.style, styles);
  }
  return chip;
}

export default function Map() {
  const [data, setData] = useState<Kos[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const routeSourceId = "route-source";
  const routeLayerId = "route-layer";
  const welcomeStorageKey = "unskosfinder_welcome_seen";

  const closeWelcome = () => {
    setShowWelcome(false);
    window.sessionStorage.setItem(welcomeStorageKey, "1");
  };

  useEffect(() => {
    setIsHydrated(true);
    const hasSeenWelcome = window.sessionStorage.getItem(welcomeStorageKey) === "1";
    setShowWelcome(!hasSeenWelcome);
  }, []);

  useEffect(() => {
    if (!showWelcome) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWelcome();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showWelcome]);

  const clearRoute = () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(routeLayerId)) {
      map.removeLayer(routeLayerId);
    }
    if (map.getSource(routeSourceId)) {
      map.removeSource(routeSourceId);
    }
  };

  const drawRoute = (coordinates: Array<[number, number]>) => {
    const map = mapRef.current;
    if (!map || coordinates.length < 2) return;

    const routeFeature = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
    };

    const source = map.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(routeFeature as never);
    } else {
      map.addSource(routeSourceId, {
        type: "geojson",
        data: routeFeature as never,
      });
      map.addLayer({
        id: routeLayerId,
        type: "line",
        source: routeSourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
    }

    const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
    coordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 60, duration: 900, maxZoom: 15 });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [110.856, -7.559],
      zoom: 14,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    const onMapLoad = () => {
      // eslint-disable-next-line no-console
      console.log("[UNSKosFinder] Map ready");
      setMapReady(true);
    };
    mapRef.current.on("load", onMapLoad);
    if (mapRef.current.loaded()) {
      // eslint-disable-next-line no-console
      console.log("[UNSKosFinder] Map already ready");
      setMapReady(true);
    }

    return () => {
      mapRef.current?.off("load", onMapLoad);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    fetch("/api/kos")
      .then((res) => res.json())
      .then((res: unknown) => {
        const arr = Array.isArray(res) ? res : [];
        const mapped: Kos[] = arr
          .map((item: RawKos) => {
            const rawNarahubung = String(item.narahubung ?? "-");
            const contactParsed = parseContact(rawNarahubung);
            const contactMatch = rawNarahubung.match(/^(.*?)\s*\(([^)]+)\)$/);
            const narahubung = contactMatch ? contactMatch[1].trim() : rawNarahubung;
            const narahubung_nama = contactMatch ? contactMatch[2].trim() : "";

            return {
              id: String(item.id ?? ""),
              nama: String(item.nama ?? "Tanpa Nama"),
              jenis: String(item.jenis_kos ?? "Tidak diketahui"),
              alamat: String(item.alamat ?? ""),
              plus_code: String(item.plus_code ?? ""),
              lat: toNumber(item.lat),
              lon: toNumber(item.long),
              harga: String(item.harga ?? "-"),
              fasilitas: String(item.fasilitas ?? ""),
              peraturan: String(item.peraturan ?? ""),
              narahubung,
              narahubung_nama: narahubung_nama || (contactParsed.href ? contactParsed.label : ""),
              ac_status: String(item.ac_status ?? "non_ac"),
              tipe_pembayaran: Array.isArray(item.tipe_pembayaran) ? item.tipe_pembayaran : [],
              data_status: String(item.data_status ?? "raw"),
              parsed_data: item.parsed_data ?? null,
            };
          })
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
        // eslint-disable-next-line no-console
        console.log(`[UNSKosFinder] Loaded ${mapped.length} kos items`);
        setData(mapped);
      });
  }, []);

  useEffect(() => {
    fetch("/api/master-uns")
      .then((res) => res.json())
      .then((res: RawDestination[]) => {
        const arr = Array.isArray(res) ? res : [];
        const mapped = arr
          .map((item) => ({
            id: item.id ?? "",
            nama: item.nama ?? "Tanpa Nama",
            lat: toNumber(item.lat),
            lon: toNumber(item.lon),
          }))
          .filter(
            (item) =>
              item.id.trim().length > 0 &&
              Number.isFinite(item.lat) &&
              Number.isFinite(item.lon),
          );
        setDestinations(mapped);
      });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());

    // eslint-disable-next-line no-console
    console.log(`[UNSKosFinder] Rendering ${data.length} markers`);
    if (data.length > 0) {
      const first = data[0];
      const projected = map.project([first.lon, first.lat]);
      // eslint-disable-next-line no-console
      console.log(`[UNSKosFinder] First marker: lng=${first.lon}, lat=${first.lat}, pixel=${Math.round(projected.x)},${Math.round(projected.y)}`);
    }

    markersRef.current = data.map((kos) => {
      const jenis = normalizeJenisKos(kos.jenis);
      const jenisColor = getJenisBadgeColor(jenis);

      // Marker element
      const el = document.createElement("div");
      el.className = styles.marker;
      el.style.background = getMarkerGradient(jenis);
      el.style.color = getMarkerTextColor(jenis);
      el.textContent = getMarkerLetter(jenis);

      // Popup content
      const popupNode = document.createElement("div");
      popupNode.className = styles.popupContent;

      // Header: Title + Jenis badge
      const header = document.createElement("div");
      header.className = styles.popupHeader;

      const title = document.createElement("strong");
      title.textContent = kos.nama;
      title.className = styles.popupTitle;

      const jenisBadge = document.createElement("span");
      jenisBadge.textContent = jenis;
      jenisBadge.className = styles.popupBadge;
      jenisBadge.style.backgroundColor = jenisColor.bg;
      jenisBadge.style.color = jenisColor.text;
      jenisBadge.style.border = `1px solid ${jenisColor.border}`;

      header.append(title, jenisBadge);

      // Meta row: AC + Payment
      const metaRow = document.createElement("div");
      metaRow.className = styles.popupMetaRow;

      const acChip = createChip(kos.ac_status === "ac" ? "🧊 AC" : "Non-AC", {
        backgroundColor: kos.ac_status === "ac" ? "#e0f2fe" : "#f1f5f9",
        color: kos.ac_status === "ac" ? "#0369a1" : "#64748b",
        border: kos.ac_status === "ac" ? "1px solid #bae6fd" : "1px solid #e2e8f0",
      });
      metaRow.appendChild(acChip);

      kos.tipe_pembayaran.forEach((tp) => {
        const paymentChip = createChip(tp, {
          backgroundColor: "#f3e8ff",
          color: "#7e22ce",
          border: "1px solid #e9d5ff",
        });
        metaRow.appendChild(paymentChip);
      });

      // Alamat
      const alamatSection = document.createElement("div");
      alamatSection.className = styles.popupSection;
      const alamatText = document.createElement("div");
      alamatText.textContent = `📍 ${kos.alamat || "Alamat tidak tersedia"}`;
      alamatText.className = styles.popupAlamatText;
      alamatSection.appendChild(alamatText);

      if (kos.plus_code) {
        const plusCode = document.createElement("div");
        plusCode.textContent = `Plus Code: ${kos.plus_code}`;
        plusCode.className = styles.popupPlusCode;
        alamatSection.appendChild(plusCode);
      }

      // Harga
      const hargaSection = document.createElement("div");
      hargaSection.className = styles.popupSection;
      const hargaLabel = createSectionLabel("Harga");
      hargaSection.appendChild(hargaLabel);

      const hargaTags = document.createElement("div");
      hargaTags.className = styles.popupTagContainer;

      if (isCleanData(kos) && kos.parsed_data) {
        const clean = kos.parsed_data;
        if (clean.harga.length > 0) {
          clean.harga.forEach((h) => {
            const tag = document.createElement("span");
            const tipe = h.tipe_kamar ? `${h.tipe_kamar} · ` : "";
            tag.textContent = `${tipe}Rp ${h.min.toLocaleString()}${h.min !== h.max ? ` - ${h.max.toLocaleString()}` : ""} / ${h.periode}`;
            tag.className = styles.priceTag;
            hargaTags.appendChild(tag);
          });
        } else {
          const tag = document.createElement("span");
          tag.textContent = "Harga belum tersedia";
          tag.className = styles.priceTagUnavailable;
          hargaTags.appendChild(tag);
        }
      } else if (kos.harga && kos.harga !== "-") {
        const parts = kos.harga.split(";").map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          parts.forEach((part) => {
            const tag = document.createElement("span");
            tag.textContent = part;
            tag.className = styles.priceTag;
            hargaTags.appendChild(tag);
          });
        } else {
          const tag = document.createElement("span");
          tag.textContent = kos.harga;
          tag.className = styles.priceTag;
          hargaTags.appendChild(tag);
        }
      } else {
        const tag = document.createElement("span");
        tag.textContent = "Harga belum tersedia";
        tag.className = styles.priceTagUnavailable;
        hargaTags.appendChild(tag);
      }
      hargaSection.appendChild(hargaTags);

      // Fasilitas
      const fasilitasSection = document.createElement("div");
      fasilitasSection.className = styles.popupSection;
      const fasilitasLabel = createSectionLabel("Fasilitas");
      fasilitasSection.appendChild(fasilitasLabel);

      if (isCleanData(kos) && kos.parsed_data) {
        const f = kos.parsed_data.fasilitas;
        const fasilitasWrap = document.createElement("div");
        fasilitasWrap.className = styles.fasilitasWrap;
        f.dalam_kamar.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        f.bersama.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        f.utilitas.forEach((item) => fasilitasWrap.appendChild(createChip(item)));
        if (f.catatan) {
          const note = document.createElement("div");
          note.textContent = f.catatan;
          note.className = styles.fasilitasNote;
          fasilitasWrap.appendChild(note);
        }
        fasilitasSection.appendChild(fasilitasWrap);
      } else {
        const fasilitasText = document.createElement("div");
        fasilitasText.textContent = kos.fasilitas || "-";
        fasilitasText.className = styles.fasilitasFallback;
        fasilitasSection.appendChild(fasilitasText);
      }

      // Peraturan
      const peraturanSection = document.createElement("div");
      peraturanSection.className = styles.popupSection;
      const peraturanLabel = createSectionLabel("Peraturan");
      peraturanSection.appendChild(peraturanLabel);

      if (isCleanData(kos) && kos.parsed_data) {
        const p = kos.parsed_data.peraturan;
        const peraturanWrap = document.createElement("div");
        peraturanWrap.className = styles.peraturanWrap;
        if (p.jam_malam) peraturanWrap.appendChild(createChip(`⏰ ${p.jam_malam}`));
        normalizeTamuLawanJenis(p.tamu_lawan_jenis).forEach((rule) => {
          peraturanWrap.appendChild(createChip(`👫 ${rule}`));
        });
        if (p.tamu_menginap === true) peraturanWrap.appendChild(createChip("🛏 Tamu menginap"));
        if (p.boleh_hewan === true) peraturanWrap.appendChild(createChip("🐕 Hewan diizinkan"));
        p.lainnya.forEach((r) => peraturanWrap.appendChild(createChip(r)));
        if (peraturanWrap.childNodes.length === 0) {
          peraturanWrap.textContent = "-";
          peraturanWrap.className = styles.peraturanFallback;
        }
        peraturanSection.appendChild(peraturanWrap);
      } else {
        const peraturanText = document.createElement("div");
        peraturanText.textContent = kos.peraturan || "-";
        peraturanText.className = styles.peraturanFallback;
        peraturanSection.appendChild(peraturanText);
      }

      // Kontak
      const kontakSection = document.createElement("div");
      kontakSection.className = styles.kontakSection;

      if (isCleanData(kos) && kos.parsed_data) {
        const kontakWrap = document.createElement("div");
        kontakWrap.className = styles.kontakWrap;
        kos.parsed_data.kontak.forEach((k) => {
          const waLink = document.createElement("a");
          waLink.href = k.url_wa;
          waLink.target = "_blank";
          waLink.rel = "noopener noreferrer";
          waLink.textContent = `${k.nama || "Kontak"} — ${k.nomor_wa}`;
          waLink.className = styles.kontakLink;
          kontakWrap.appendChild(waLink);
        });
        if (kos.parsed_data.kontak.length === 0) {
          const fallback = document.createElement("span");
          fallback.textContent = "-";
          fallback.className = styles.kontakFallback;
          kontakWrap.appendChild(fallback);
        }
        kontakSection.appendChild(kontakWrap);
      } else {
        const parsedContact = parseContact(kos.narahubung);
        if (parsedContact.href) {
          const waLink = document.createElement("a");
          waLink.href = parsedContact.href;
          waLink.target = "_blank";
          waLink.rel = "noopener noreferrer";
          waLink.textContent = parsedContact.label || kos.narahubung;
          waLink.className = styles.kontakLink;
          kontakSection.appendChild(waLink);
        } else {
          const fallback = document.createElement("span");
          fallback.textContent = parsedContact.label;
          fallback.className = styles.kontakFallback;
          kontakSection.appendChild(fallback);
        }
      }

      // Route section
      const routeSection = document.createElement("div");
      routeSection.className = styles.routeSection;

      const routeLabel = document.createElement("div");
      routeLabel.textContent = "Rute ke kampus";
      routeLabel.className = styles.routeLabel;

      const destinationSelect = document.createElement("select");
      destinationSelect.className = styles.destinationSelect;

      destinationSelect.onfocus = () => {
        destinationSelect.style.borderColor = "#829AB1";
        destinationSelect.style.boxShadow = "0 0 0 3px rgba(130, 154, 177, 0.2)";
      };
      destinationSelect.onblur = () => {
        destinationSelect.style.borderColor = "#bfc9d6";
        destinationSelect.style.boxShadow = "none";
      };

      if (destinations.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.text = "Tujuan belum tersedia";
        destinationSelect.append(option);
      } else {
        destinations.forEach((destination) => {
          const option = document.createElement("option");
          option.value = destination.id;
          option.text = destination.nama;
          destinationSelect.append(option);
        });
      }

      const routeButton = document.createElement("button");
      routeButton.type = "button";
      routeButton.textContent = "Tampilkan Rute";
      routeButton.className = styles.routeButton;

      const clearRouteButton = document.createElement("button");
      clearRouteButton.type = "button";
      clearRouteButton.textContent = "Hapus Rute";
      clearRouteButton.className = styles.clearRouteButton;

      const routeResult = document.createElement("div");
      routeResult.className = styles.routeResult;

      routeButton.onclick = async () => {
        const selectedId = destinationSelect.value;
        const selectedDestination = destinations.find((item) => item.id === selectedId);

        if (!selectedDestination) {
          routeResult.textContent = "Pilih tujuan terlebih dahulu.";
          routeResult.style.color = "#8a3b2f";
          return;
        }

        routeButton.disabled = true;
        clearRouteButton.disabled = true;
        routeButton.style.opacity = "0.65";
        clearRouteButton.style.opacity = "0.65";
        routeResult.textContent = "Menghitung rute...";
        routeResult.style.color = "#334155";

        try {
          const response = await fetch("/api/directions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { lat: kos.lat, lon: kos.lon },
              destination: { lat: selectedDestination.lat, lon: selectedDestination.lon },
              travelMode: "WALK",
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result?.error ?? "Gagal menghitung rute");
          }

          const routeData = result as RouteApiResponse;
          const coordinates = decodeEncodedPolyline(routeData.encodedPolyline);

          if (map.isStyleLoaded()) {
            drawRoute(coordinates);
          } else {
            map.once("load", () => drawRoute(coordinates));
          }

          routeResult.textContent = `Jarak: ${formatDistanceMeters(routeData.distanceMeters)} | Estimasi jalan kaki: ${formatDuration(routeData.duration)}`;
          routeResult.style.color = "#2f5133";
        } catch (error) {
          routeResult.textContent =
            error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil rute.";
          routeResult.style.color = "#8a3b2f";
        } finally {
          routeButton.disabled = false;
          clearRouteButton.disabled = false;
          routeButton.style.opacity = "1";
          clearRouteButton.style.opacity = "1";
        }
      };

      clearRouteButton.onclick = () => {
        clearRoute();
        routeResult.textContent = "Rute dihapus.";
        routeResult.style.color = "#5f6e7e";
      };

      routeSection.append(
        routeLabel,
        destinationSelect,
        routeButton,
        clearRouteButton,
        routeResult,
      );

      popupNode.append(
        header,
        metaRow,
        alamatSection,
        hargaSection,
        fasilitasSection,
        peraturanSection,
        kontakSection,
        routeSection,
      );

      const popup = new maplibregl.Popup({ offset: 25, className: "kos-popup" }).setDOMContent(popupNode);
      popup.on("close", clearRoute);

      return new maplibregl.Marker({ element: el, offset: [0, -18] })
        .setLngLat([kos.lon, kos.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [data.length, destinations.length, mapReady]);

  return (
    <div className={styles.pageContainer}>
      <div ref={mapContainerRef} className={styles.mapContainer} />

      {isHydrated && showWelcome && (
        <div className={styles.welcomeOverlay}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Informasi awal UNSKosFinder"
            className={styles.welcomeDialog}
          >
            <button
              type="button"
              aria-label="Tutup informasi awal"
              onClick={closeWelcome}
              className={styles.welcomeCloseBtn}
            >
              ✕
            </button>

            <h2 className={styles.welcomeTitle}>
              Selamat datang di UNSKosFinder
            </h2>
            <p className={styles.welcomeParagraph}>
              Cari kos sekitar UNS jadi lebih cepat lewat peta interaktif.
            </p>

            <div className={styles.welcomeSection}>
              <strong className={styles.welcomeLabel}>
                Cara pakai:
              </strong>
              <ul className={styles.welcomeList}>
                <li>Klik pin kos di peta untuk lihat detail.</li>
                <li>Pilih tujuan kampus lalu klik Tampilkan Rute.</li>
                <li>Gunakan kontak yang tertera untuk menghubungi pemilik.</li>
              </ul>
            </div>

            <div className={styles.welcomeWarning}>
              Waspada Penipuan
            </div>

            <div className={styles.welcomeInfo}>
              Informasi harga dapat berubah sewaktu-waktu.
            </div>

            <button
              type="button"
              onClick={closeWelcome}
              className={styles.welcomePrimaryBtn}
            >
              Saya mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
