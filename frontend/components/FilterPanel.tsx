"use client";

import { useMemo, useState } from "react";

type FilterPanelProps = {
  side?: "left" | "right";
};

type OptionItem = {
  key: string;
  label: string;
  count?: number;
};

const MIN_PRICE = 300_000;
const MAX_PRICE = 3_500_000;
const MIN_GAP = 100_000;

const AC_OPTIONS: OptionItem[] = [
  { key: "ac", label: "AC", count: 128 },
  { key: "non-ac", label: "Non-AC", count: 94 },
];

const PAYMENT_OPTIONS: OptionItem[] = [
  { key: "bulanan", label: "Bulanan", count: 210 },
  { key: "semesteran", label: "Semesteran", count: 72 },
  { key: "tahunan", label: "Tahunan", count: 34 },
];

const BATH_OPTIONS: OptionItem[] = [
  { key: "dalam", label: "Dalam", count: 141 },
  { key: "luar", label: "Luar", count: 63 },
];

const ELECTRIC_OPTIONS: OptionItem[] = [
  { key: "termasuk", label: "Termasuk", count: 120 },
  { key: "belum", label: "Belum Termasuk", count: 84 },
];

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const parseRupiahInput = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function FilterPanel({ side = "left" }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [priceMin, setPriceMin] = useState(450_000);
  const [priceMax, setPriceMax] = useState(2_000_000);
  const [acSelection, setAcSelection] = useState<string[]>([]);
  const [paymentSelection, setPaymentSelection] = useState<string[]>([]);
  const [bathSelection, setBathSelection] = useState<string[]>([]);
  const [electricSelection, setElectricSelection] = useState<string[]>([]);

  const matchCount = 128;
  const totalCount = 412;

  const minPercent = useMemo(
    () => ((priceMin - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100,
    [priceMin],
  );
  const maxPercent = useMemo(
    () => ((priceMax - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100,
    [priceMax],
  );

  const updateMinPrice = (value: number) => {
    const next = clamp(value, MIN_PRICE, priceMax - MIN_GAP);
    setPriceMin(next);
  };

  const updateMaxPrice = (value: number) => {
    const next = clamp(value, priceMin + MIN_GAP, MAX_PRICE);
    setPriceMax(next);
  };

  const toggleSelection = (value: string, setState: (updater: (prev: string[]) => string[]) => void) => {
    setState((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const resetAll = () => {
    setPriceMin(450_000);
    setPriceMax(2_000_000);
    setAcSelection([]);
    setPaymentSelection([]);
    setBathSelection([]);
    setElectricSelection([]);
  };

  return (
    <div className="filterShell">
      <button type="button" className="filterTrigger" onClick={() => setIsOpen(true)}>
        Filter
      </button>

      <button
        type="button"
        className={`filterBackdrop ${isOpen ? "open" : ""}`}
        aria-label="Tutup panel filter"
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`filterPanel ${isOpen ? "open" : ""} ${side === "right" ? "sideRight" : "sideLeft"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filter kos"
      >
        <header className="filterHeader">
          <div>
            <h3>Filter Kos</h3>
            <p>
              {matchCount} kos cocok dari {totalCount}
            </p>
          </div>
          <button type="button" className="filterClose" onClick={() => setIsOpen(false)}>
            X
          </button>
        </header>

        <div className="filterBody">
          <section className="filterCard">
            <h4>Harga</h4>
            <div className="priceRange">
              <div className="rangeTrack">
                <div
                  className="rangeFill"
                  style={{ left: `${Math.max(0, minPercent)}%`, right: `${Math.max(0, 100 - maxPercent)}%` }}
                />
              </div>
              <div className="rangeInputs">
                <input
                  type="range"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step={50_000}
                  value={priceMin}
                  onChange={(event) => updateMinPrice(Number(event.target.value))}
                  aria-label="Harga minimum"
                />
                <input
                  type="range"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step={50_000}
                  value={priceMax}
                  onChange={(event) => updateMaxPrice(Number(event.target.value))}
                  aria-label="Harga maksimum"
                />
              </div>
            </div>
            <div className="priceInputs">
              <label>
                <span>Min (Rp)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiah(priceMin)}
                  onChange={(event) => updateMinPrice(parseRupiahInput(event.target.value))}
                />
              </label>
              <label>
                <span>Max (Rp)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiah(priceMax)}
                  onChange={(event) => updateMaxPrice(parseRupiahInput(event.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="filterCard">
            <h4>AC</h4>
            {AC_OPTIONS.map((option) => (
              <label key={option.key} className="filterOption">
                <span className="filterOptionMain">
                  <input
                    type="checkbox"
                    checked={acSelection.includes(option.key)}
                    onChange={() => toggleSelection(option.key, setAcSelection)}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="filterCount">{option.count}</span>
              </label>
            ))}
          </section>

          <section className="filterCard">
            <h4>Periode Pembayaran</h4>
            <p className="filterHint">Pilih satu atau lebih. Hasil memakai logika OR.</p>
            {PAYMENT_OPTIONS.map((option) => (
              <label key={option.key} className="filterOption">
                <span className="filterOptionMain">
                  <input
                    type="checkbox"
                    checked={paymentSelection.includes(option.key)}
                    onChange={() => toggleSelection(option.key, setPaymentSelection)}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="filterCount">{option.count}</span>
              </label>
            ))}
          </section>

          <section className="filterCard">
            <h4>Kamar Mandi</h4>
            {BATH_OPTIONS.map((option) => (
              <label key={option.key} className="filterOption">
                <span className="filterOptionMain">
                  <input
                    type="checkbox"
                    checked={bathSelection.includes(option.key)}
                    onChange={() => toggleSelection(option.key, setBathSelection)}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="filterCount">{option.count}</span>
              </label>
            ))}
          </section>

          <section className="filterCard">
            <h4>Listrik</h4>
            {ELECTRIC_OPTIONS.map((option) => (
              <label key={option.key} className="filterOption">
                <span className="filterOptionMain">
                  <input
                    type="checkbox"
                    checked={electricSelection.includes(option.key)}
                    onChange={() => toggleSelection(option.key, setElectricSelection)}
                  />
                  <span>{option.label}</span>
                </span>
                <span className="filterCount">{option.count}</span>
              </label>
            ))}
          </section>
        </div>

        <footer className="filterFooter">
          <button type="button" className="filterGhost" onClick={resetAll}>
            Reset Semua
          </button>
          <button type="button" className="filterPrimary" onClick={() => setIsOpen(false)}>
            Tutup Panel
          </button>
        </footer>
      </aside>

      <style jsx>{`
        .filterShell {
          position: relative;
          z-index: 1000;
        }

        .filterTrigger {
          border: 1px solid rgba(148, 163, 184, 0.6);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.95);
          color: #1f2937;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
        }

        .filterBackdrop {
          position: fixed;
          inset: 0;
          z-index: 1001;
          border: none;
          background: rgba(15, 23, 42, 0.28);
          opacity: 0;
          pointer-events: none;
          transition: opacity 220ms ease;
        }

        .filterBackdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .filterPanel {
          position: fixed;
          top: 16px;
          bottom: 16px;
          z-index: 1002;
          width: min(380px, calc(100% - 32px));
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: linear-gradient(165deg, #ffffff 0%, #f4f7f2 60%, #fbf5ee 100%);
          box-shadow: 0 20px 42px rgba(15, 23, 42, 0.22);
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        .filterPanel.sideLeft {
          left: 16px;
          transform: translateX(-112%);
        }

        .filterPanel.sideRight {
          right: 16px;
          transform: translateX(112%);
        }

        .filterPanel.open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .filterHeader {
          padding: 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          background: rgba(255, 255, 255, 0.9);
        }

        .filterHeader h3 {
          margin: 0;
          font-size: 18px;
          color: #1f2937;
        }

        .filterHeader p {
          margin: 4px 0 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .filterClose {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #334155;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
        }

        .filterBody {
          padding: 16px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filterCard {
          border: 1px solid rgba(148, 163, 184, 0.26);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.82);
          padding: 12px;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        }

        .filterCard h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #1f2937;
        }

        .filterHint {
          margin: 0 0 10px 0;
          color: #64748b;
          font-size: 12px;
        }

        .filterOption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 8px;
          border-radius: 10px;
          cursor: pointer;
        }

        .filterOption:hover {
          background: rgba(241, 245, 249, 0.8);
        }

        .filterOptionMain {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
        }

        .filterOptionMain input {
          width: 15px;
          height: 15px;
          accent-color: #2563eb;
        }

        .filterCount {
          font-size: 11px;
          line-height: 1;
          font-weight: 700;
          border-radius: 999px;
          padding: 5px 8px;
          color: #334155;
          background: #e2e8f0;
          border: 1px solid #cbd5e1;
        }

        .priceRange {
          position: relative;
          margin-bottom: 10px;
        }

        .rangeTrack {
          position: relative;
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .rangeFill {
          position: absolute;
          top: 0;
          bottom: 0;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          border-radius: 999px;
        }

        .rangeInputs {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
        }

        .rangeInputs input[type="range"] {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 18px;
          margin: 0;
          transform: translateY(-50%);
          background: transparent;
          pointer-events: none;
          -webkit-appearance: none;
        }

        .rangeInputs input[type="range"]::-webkit-slider-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
          -webkit-appearance: none;
        }

        .rangeInputs input[type="range"]::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
        }

        .rangeInputs input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: transparent;
        }

        .rangeInputs input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: transparent;
        }

        .priceInputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          min-width: 0;
          width: 100%;
        }

        .priceInputs label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          color: #64748b;
          min-width: 0;
        }

        .priceInputs input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
          color: #1f2937;
          background: #ffffff;
        }

        .filterFooter {
          padding: 14px 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(255, 255, 255, 0.92);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .filterGhost,
        .filterPrimary {
          border-radius: 11px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .filterGhost {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
        }

        .filterPrimary {
          border: 1px solid #1d4ed8;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
        }

        @media (max-width: 720px) {
          .filterPanel {
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: min(82vh, 640px);
            border-radius: 18px 18px 0 0;
            transform: translateY(110%);
          }

          .filterPanel.open {
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .filterPanel,
          .filterBackdrop {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

export default FilterPanel;
