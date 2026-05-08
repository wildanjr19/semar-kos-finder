"use client";

import { ChipGroup } from "./ChipGroup";

type RoomSectionProps = {
  selectedGender: string | null;
  selectedAc: string | null;
  onGenderChange: (value: string | null) => void;
  onAcChange: (value: string | null) => void;
};

const GENDER_OPTIONS = [
  { value: "Putra", label: "Putra" },
  { value: "Putri", label: "Putri" },
  { value: "Campuran", label: "Campuran" },
];

const AC_OPTIONS = [
  { value: "ac", label: "AC" },
  { value: "non_ac", label: "Non-AC" },
  { value: "keduanya", label: "Keduanya" },
];

export function RoomSection({
  selectedGender,
  selectedAc,
  onGenderChange,
  onAcChange,
}: RoomSectionProps) {
  return (
    <div className="space-y-4 px-2 py-2">
      <ChipGroup
        label="Jenis Kos"
        options={GENDER_OPTIONS}
        value={selectedGender}
        onChange={onGenderChange}
        mode="radio"
      />
      <ChipGroup
        label="AC"
        options={AC_OPTIONS}
        value={selectedAc}
        onChange={onAcChange}
        mode="radio"
      />
    </div>
  );
}
