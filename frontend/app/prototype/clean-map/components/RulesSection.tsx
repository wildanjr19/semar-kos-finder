"use client";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChipGroup } from "./ChipGroup";

type RulesSectionProps = {
  selectedJamMalam: string | null;
  selectedTamuLawanJenis: string | null;
  selectedTamuMenginap: string | null;
  selectedBolehHewan: string | null;
  onJamMalamChange: (value: string) => void;
  onTamuLawanJenisChange: (value: string | null) => void;
  onTamuMenginapChange: (value: string | null) => void;
  onBolehHewanChange: (value: string | null) => void;
};

const JAM_MALAM_OPTIONS = [
  { value: "Tidak ada", label: "Tidak ada" },
  { value: "22:00", label: "22:00" },
  { value: "23:00", label: "23:00" },
  { value: "24:00", label: "24:00" },
  { value: "21:00", label: "21:00" },
  { value: "20:00", label: "20:00" },
];

const TAMU_LAWAN_JENIS_OPTIONS = [
  { value: "dilarang", label: "Dilarang" },
  { value: "terbatas", label: "Terbatas" },
  { value: "bebas", label: "Bebas" },
];

const TRI_STATE_CYCLE = ["Semua", "Ya", "Tidak"];

const TRI_STATE_OPTIONS = [
  { value: "Semua", label: "Semua" },
  { value: "Ya", label: "Ya" },
  { value: "Tidak", label: "Tidak" },
];

/**
 * Tri-state chip behavior:
 * - If clicking an unselected chip, select it
 * - If clicking the already-selected chip, cycle to the next option
 * This prevents "deselect to null" default of radio-mode ChipGroup,
 * keeping the filter always in one of the 3 meaningful states.
 */
function useTriState(
  currentValue: string | null,
  onChange: (value: string | null) => void
) {
  return (clickedValue: string) => {
    if (clickedValue === currentValue) {
      const idx = TRI_STATE_CYCLE.indexOf(currentValue ?? "Semua");
      const nextIdx = (idx + 1) % TRI_STATE_CYCLE.length;
      onChange(TRI_STATE_CYCLE[nextIdx]);
    } else {
      onChange(clickedValue);
    }
  };
}

export function RulesSection({
  selectedJamMalam,
  selectedTamuLawanJenis,
  selectedTamuMenginap,
  selectedBolehHewan,
  onJamMalamChange,
  onTamuLawanJenisChange,
  onTamuMenginapChange,
  onBolehHewanChange,
}: RulesSectionProps) {
  const handleTamuMenginap = useTriState(selectedTamuMenginap, onTamuMenginapChange);
  const handleBolehHewan = useTriState(selectedBolehHewan, onBolehHewanChange);

  return (
    <div className="space-y-5 px-2 py-2">
      {/* ── Jam Malam ── */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Jam Malam</p>
        <Select value={selectedJamMalam ?? undefined} onValueChange={onJamMalamChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih jam malam" />
          </SelectTrigger>
          <SelectContent>
            {JAM_MALAM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tamu Lawan Jenis ── */}
      <ChipGroup
        label="Tamu Lawan Jenis"
        options={TAMU_LAWAN_JENIS_OPTIONS}
        value={selectedTamuLawanJenis}
        onChange={onTamuLawanJenisChange}
        mode="radio"
      />

      {/* ── Tamu Menginap (tri-state) ── */}
      <ChipGroup
        label="Tamu Menginap"
        options={TRI_STATE_OPTIONS}
        value={selectedTamuMenginap}
        onChange={(value) => {
          // ChipGroup radio mode always returns string | null
          if (value === null) handleTamuMenginap("Semua");
          else if (typeof value === "string") handleTamuMenginap(value);
        }}
        mode="radio"
      />

      {/* ── Boleh Hewan (tri-state) ── */}
      <ChipGroup
        label="Boleh Hewan"
        options={TRI_STATE_OPTIONS}
        value={selectedBolehHewan}
        onChange={(value) => {
          if (value === null) handleBolehHewan("Semua");
          else if (typeof value === "string") handleBolehHewan(value);
        }}
        mode="radio"
      />
    </div>
  );
}
